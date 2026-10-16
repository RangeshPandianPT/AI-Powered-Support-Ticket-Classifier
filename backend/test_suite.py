import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(__file__))

import database as db
from schema import TicketClassification, IssueCategory, AssignedTeam, IssuePriority, UserSentiment
from classifier import rewrite_draft_llm, copilot_chat_llm
from rag_kb import search_kb, add_to_kb, get_all_kb_docs
from langgraph_workflow import run_ticket_workflow
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_database_crud():
    db.init_db()
    
    # Create sample classification
    cls = TicketClassification(
        summary="Customer needs a refund for defective mouse",
        category=IssueCategory.BILLING,
        assigned_team=AssignedTeam.CUSTOMER_SUCCESS,
        priority=IssuePriority.HIGH,
        sentiment=UserSentiment.FRUSTRATED,
        confidence_score=0.95,
        draft_response="We are very sorry for the defective product. We have issued a full refund.",
        key_action_items=["Verify transaction", "Process return label"],
        requires_immediate_escalation=True
    )
    
    ticket_id = db.save_ticket(
        ticket_text="My mouse arrived broken and I want a refund now!",
        classification=cls,
        provider_used="TestProvider",
        status="Open"
    )
    assert ticket_id is not None
    assert ticket_id > 0

    # Retrieve ticket
    ticket = db.get_ticket_by_id(ticket_id)
    assert ticket is not None
    assert ticket["category"] == "Billing"
    assert ticket["priority"] == "High"
    assert ticket["requires_immediate_escalation"] == 1

    # Update status
    updated = db.update_ticket_status(ticket_id, "Resolved")
    assert updated is True
    ticket_updated = db.get_ticket_by_id(ticket_id)
    assert ticket_updated["status"] == "Resolved"

    # Update draft
    draft_updated = db.update_ticket_draft(ticket_id, "Updated customized response.")
    assert draft_updated is True
    ticket_draft = db.get_ticket_by_id(ticket_id)
    assert ticket_draft["draft_response"] == "Updated customized response."

    # Filter test
    filtered = db.get_all_tickets(status_filter="Resolved", search_query="defective mouse")
    assert len(filtered) >= 1

    # Analytics test
    analytics = db.get_analytics_summary()
    assert analytics["total_tickets"] >= 1
    assert analytics["avg_confidence"] > 0

def test_knowledge_base():
    docs = get_all_kb_docs()
    assert isinstance(docs, list)
    
    # Add doc
    doc_id = add_to_kb("Return Policy: 30 days unconditional return for electronics.")
    assert doc_id is not None
    
    # Search doc
    context = search_kb("electronics return")
    assert "Return" in context or "Refund" in context

def test_classifier_rewrite_and_copilot():
    # Test tone rewriter fallback
    sample_text = "I need help with my billing invoice."
    sample_draft = "Here is your invoice."
    empathetic_draft = rewrite_draft_llm(sample_text, sample_draft, "Make it deeply empathetic")
    assert len(empathetic_draft) > 10

    concise_draft = rewrite_draft_llm(sample_text, sample_draft, "Make it concise")
    assert len(concise_draft) > 10

    # Test copilot chat
    copilot_reply = copilot_chat_llm(
        ticket_context={"id": 1, "category": "Billing", "priority": "High", "ticket_text": sample_text},
        user_message="What should I do first?"
    )
    assert len(copilot_reply) > 5

def test_api_endpoints():
    # Analytics endpoint
    res = client.get("/api/analytics")
    assert res.status_code == 200
    data = res.json()
    assert "total_tickets" in data

    # Tickets list endpoint
    res = client.get("/api/tickets?status=All")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    # Batch CSV endpoint with sample tickets
    res = client.post("/api/tickets/batch-csv")
    assert res.status_code == 200
    batch_data = res.json()
    assert "successful" in batch_data
    assert batch_data["total_rows"] > 0

def test_conversation_threads_and_simulation():
    # 1. Create a ticket
    cls = TicketClassification(
        summary="Customer unable to access premium API endpoint",
        category=IssueCategory.TECHNICAL_SUPPORT,
        assigned_team=AssignedTeam.IT,
        priority=IssuePriority.HIGH,
        sentiment=UserSentiment.FRUSTRATED,
        confidence_score=0.92,
        draft_response="Please try regenerating your API credentials in settings.",
        key_action_items=["Verify account permissions", "Check API rate limit logs"],
        requires_immediate_escalation=True
    )
    ticket_id = db.save_ticket("I am getting 403 Forbidden on the premium API endpoint!", cls)
    assert ticket_id > 0

    # 2. Verify SLA metadata
    t = db.get_ticket_by_id(ticket_id)
    assert t is not None
    assert t["sla_target_hours"] == 4
    assert "sla_deadline" in t
    assert "sla_remaining_minutes" in t
    assert t["message_count"] >= 1

    # 3. Verify initial message was seeded
    messages = db.get_ticket_messages(ticket_id)
    assert len(messages) >= 1
    assert messages[0]["sender"] == "customer"
    assert "403 Forbidden" in messages[0]["message_text"]

    # 4. Test agent reply via API
    res = client.post(f"/api/tickets/{ticket_id}/reply", json={
        "reply_text": "Here is a regenerated test key to unblock you immediately.",
        "mark_resolved": False
    })
    assert res.status_code == 200
    reply_data = res.json()
    assert len(reply_data["messages"]) == 2
    assert reply_data["messages"][1]["sender"] == "agent"

    # 5. Test simulated customer reply via API (satisfied persona)
    res = client.post(f"/api/tickets/{ticket_id}/simulate-reply", json={
        "persona": "satisfied"
    })
    assert res.status_code == 200
    sim_data = res.json()
    assert sim_data["simulated_reply"]["sentiment"] == "Happy"
    assert len(sim_data["messages"]) == 3
    assert sim_data["ticket"]["status"] == "Resolved"

    # 6. Test manual message append
    res = client.post(f"/api/tickets/{ticket_id}/messages", json={
        "sender": "customer",
        "message_text": "One quick question, does this key expire in 30 days?",
        "sentiment": "Neutral"
    })
    assert res.status_code == 200
    assert len(res.json()["messages"]) == 4

if __name__ == "__main__":
    test_database_crud()
    print("Database CRUD test passed!")
    test_knowledge_base()
    print("Knowledge base test passed!")
    test_classifier_rewrite_and_copilot()
    print("Classifier rewrite and copilot test passed!")
    test_api_endpoints()
    print("API endpoints test passed!")
    test_conversation_threads_and_simulation()
    print("Conversation threads & customer simulation tests passed!")
    print("\nALL BACKEND TESTS PASSED!")

