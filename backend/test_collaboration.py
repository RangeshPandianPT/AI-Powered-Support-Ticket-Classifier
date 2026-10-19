import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(__file__))

from collaboration import (
    init_collaboration_db,
    get_team_members,
    get_team_workload_summary,
    assign_ticket_to_agent,
    auto_assign_ticket_ai,
    add_internal_note,
    get_internal_notes,
    toggle_pin_internal_note,
    delete_internal_note,
    log_audit_event,
    get_ticket_audit_logs,
    generate_ai_shift_handover
)
import database as db
from schema import TicketClassification, IssueCategory, AssignedTeam, IssuePriority, UserSentiment

def test_collaboration_suite():
    print("Initializing collaboration schema...")
    init_collaboration_db()
    
    # 1. Test team roster and workload
    members = get_team_members()
    assert len(members) >= 5, f"Expected at least 5 team members, got {len(members)}"
    workload = get_team_workload_summary()
    assert len(workload) == len(members)
    print("[PASS] Team members & workload summary test passed!")

    # 2. Seed a test ticket if needed
    cls = TicketClassification(
        category=IssueCategory.BILLING,
        assigned_team=AssignedTeam.IT,
        priority=IssuePriority.HIGH,
        sentiment=UserSentiment.FRUSTRATED,
        confidence_score=0.95,
        summary="Double billed for enterprise subscription invoice",
        key_action_items=["Verify transaction log", "Process credit refund"],
        draft_response="We apologize for the billing discrepancy and will issue a refund immediately.",
        requires_immediate_escalation=True
    )
    ticket_id = db.save_ticket(
        ticket_text="I was charged twice for the renewal! Fix this immediately!",
        classification=cls,
        status="Open"
    )
    assert ticket_id > 0
    print(f"[PASS] Seeded test ticket #{ticket_id}")

    # 3. Test Manual Assignment and Audit Log
    assign_res = assign_ticket_to_agent(
        ticket_id=ticket_id,
        assignee_name="Alex Rivera",
        assignee_email="alex.rivera@supportdesk.ai",
        actor_name="Team Lead"
    )
    assert assign_res["assignee_name"] == "Alex Rivera"
    
    audit_logs = get_ticket_audit_logs(ticket_id)
    assert any(log["action_type"] == "ASSIGNED" for log in audit_logs)
    print("[PASS] Manual ticket assignment and audit logging test passed!")

    # 4. Test AI Auto-Routing
    auto_res = auto_assign_ticket_ai(ticket_id, actor_name="Test AI Router")
    assert auto_res["assignee_name"] is not None
    print(f"[PASS] AI auto-assigned ticket #{ticket_id} to {auto_res['assignee_name']}")

    # 5. Test Internal Notes (Add, Pin, Fetch, Delete)
    note = add_internal_note(
        ticket_id=ticket_id,
        author_name="Sarah Chen",
        author_role="Tier 2 Tech",
        note_text="Investigated payment gateway webhook; second charge was a gateway retry glitch.",
        note_type="internal",
        tags=["Gateway Bug", "Refund Needed"],
        is_pinned=False
    )
    assert note["id"] > 0
    
    notes = get_internal_notes(ticket_id)
    assert len(notes) >= 1
    assert notes[0]["author_name"] == "Sarah Chen"

    # Toggle Pin
    is_pinned = toggle_pin_internal_note(note["id"])
    assert is_pinned is True

    # 6. Test AI Shift Handover Note
    handover = generate_ai_shift_handover(ticket_id, actor_name="Night Shift Lead")
    assert handover["is_pinned"] is True
    assert "SHIFT HANDOVER BRIEFING" in handover["note_text"]
    print("[PASS] AI shift handover note generated successfully!")

    # Verify updated notes count and order (pinned first)
    all_notes = get_internal_notes(ticket_id)
    assert len(all_notes) >= 2
    assert all_notes[0]["is_pinned"] == 1

    # Clean up test note
    del_res = delete_internal_note(note["id"])
    assert del_res is True
    print("[PASS] Note pinning and deletion test passed!")

    # Final Audit Log check
    final_logs = get_ticket_audit_logs(ticket_id)
    assert len(final_logs) >= 3
    print(f"[PASS] Full audit trail verified with {len(final_logs)} lifecycle records!")
    print("\nALL COLLABORATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_collaboration_suite()
