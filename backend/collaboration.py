import sqlite3
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_FILE = os.path.join(os.path.dirname(__file__), "tickets.db")

TEAM_MEMBERS = [
    {
        "id": "agent-1",
        "name": "Sarah Chen",
        "email": "sarah.chen@supportdesk.ai",
        "role": "Tier 2 Technical Support",
        "department": "IT Support",
        "skills": ["API Errors", "Authentication", "Cloud & Infra"],
        "status": "Online",
        "avatar_color": "#3b82f6"
    },
    {
        "id": "agent-2",
        "name": "Alex Rivera",
        "email": "alex.rivera@supportdesk.ai",
        "role": "Billing & Subscriptions Specialist",
        "department": "Billing",
        "skills": ["Refunds", "Invoicing", "Subscription Overrides"],
        "status": "Online",
        "avatar_color": "#10b981"
    },
    {
        "id": "agent-3",
        "name": "Priya Patel",
        "email": "priya.patel@supportdesk.ai",
        "role": "Customer Success Lead",
        "department": "Customer Success",
        "skills": ["Onboarding", "Feature Adoption", "Account Reviews"],
        "status": "In Shift",
        "avatar_color": "#8b5cf6"
    },
    {
        "id": "agent-4",
        "name": "Marcus Vance",
        "email": "marcus.v@supportdesk.ai",
        "role": "Logistics & Fulfillment Senior Rep",
        "department": "Operations",
        "skills": ["Shipment Delays", "Hardware Replacement", "RMA"],
        "status": "Online",
        "avatar_color": "#f59e0b"
    },
    {
        "id": "agent-5",
        "name": "Elena Rostova",
        "email": "elena.r@supportdesk.ai",
        "role": "Escalations & VIP Ombudsman",
        "department": "Executive Escalations",
        "skills": ["Executive Accounts", "Churn Prevention", "Legal/SLA Breach"],
        "status": "Busy",
        "avatar_color": "#ef4444"
    },
    {
        "id": "agent-6",
        "name": "Dev On-Call",
        "email": "dev-oncall@supportdesk.ai",
        "role": "Engineering Liaison",
        "department": "IT Support",
        "skills": ["Critical Bug Fixes", "DB Outages", "Security Hotfixes"],
        "status": "Standby",
        "avatar_color": "#06b6d4"
    }
]

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_collaboration_db():
    """Create collaboration tables and upgrade tickets table if columns are missing."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Upgrade tickets table with assignee fields
        try:
            cursor.execute("ALTER TABLE tickets ADD COLUMN assignee_name TEXT DEFAULT 'Unassigned'")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE tickets ADD COLUMN assignee_email TEXT")
        except sqlite3.OperationalError:
            pass

        # Internal notes table (staff-only confidential commentary & handover notes)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS internal_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id INTEGER NOT NULL,
                author_name TEXT NOT NULL,
                author_role TEXT DEFAULT 'Support Agent',
                note_text TEXT NOT NULL,
                note_type TEXT DEFAULT 'internal', -- 'internal', 'handover', 'escalation', 'call_log'
                tags TEXT, -- JSON array of string tags
                is_pinned INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_internal_notes_ticket_id ON internal_notes(ticket_id)")

        # Audit trail table (chronological lifecycle events)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ticket_audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id INTEGER NOT NULL,
                action_type TEXT NOT NULL, -- 'CREATED', 'ASSIGNED', 'STATUS_CHANGE', 'NOTE_ADDED', 'ESCALATED', 'DRAFT_SENT', 'AI_RECLASSIFIED', 'HANDOVER'
                actor_name TEXT NOT NULL,
                actor_role TEXT DEFAULT 'Agent',
                details TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ticket_audit_ticket_id ON ticket_audit_log(ticket_id)")
        conn.commit()

def log_audit_event(
    ticket_id: int, 
    action_type: str, 
    actor_name: str, 
    details: str, 
    actor_role: str = "Agent",
    old_value: Optional[str] = None, 
    new_value: Optional[str] = None
) -> int:
    """Record an audit trail event for a ticket."""
    init_collaboration_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO ticket_audit_log (ticket_id, action_type, actor_name, actor_role, details, old_value, new_value)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (ticket_id, action_type, actor_name, actor_role, details, old_value, new_value))
        conn.commit()
        return cursor.lastrowid

def get_ticket_audit_logs(ticket_id: int) -> List[Dict[str, Any]]:
    """Retrieve full chronological audit history for a ticket."""
    init_collaboration_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM ticket_audit_log
            WHERE ticket_id = ?
            ORDER BY created_at DESC, id DESC
        """, (ticket_id,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_team_members() -> List[Dict[str, Any]]:
    """Return the roster of support team members."""
    return TEAM_MEMBERS

def get_team_workload_summary() -> List[Dict[str, Any]]:
    """Return team members along with their current open ticket counts."""
    init_collaboration_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT assignee_name, COUNT(*) as open_count 
            FROM tickets 
            WHERE status != 'Resolved' AND assignee_name IS NOT NULL AND assignee_name != 'Unassigned'
            GROUP BY assignee_name
        """)
        counts = {row["assignee_name"]: row["open_count"] for row in cursor.fetchall()}

    result = []
    for member in TEAM_MEMBERS:
        assigned_count = counts.get(member["name"], 0)
        # Max recommended load per agent is 8
        capacity_pct = min(100, int((assigned_count / 8.0) * 100))
        result.append({
            **member,
            "open_tickets": assigned_count,
            "capacity_pct": capacity_pct,
            "is_at_capacity": assigned_count >= 8
        })
    return result

def assign_ticket_to_agent(
    ticket_id: int, 
    assignee_name: str, 
    assignee_email: Optional[str] = None, 
    actor_name: str = "Support Lead"
) -> Dict[str, Any]:
    """Assign ticket to a team member and record an audit log event."""
    init_collaboration_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT assignee_name FROM tickets WHERE id = ?", (ticket_id,))
        row = cursor.fetchone()
        old_assignee = row["assignee_name"] if row else "Unassigned"

        cursor.execute("""
            UPDATE tickets 
            SET assignee_name = ?, assignee_email = ?
            WHERE id = ?
        """, (assignee_name, assignee_email, ticket_id))
        conn.commit()

    log_audit_event(
        ticket_id=ticket_id,
        action_type="ASSIGNED",
        actor_name=actor_name,
        actor_role="Support Lead",
        details=f"Ticket reassigned to {assignee_name}",
        old_value=old_assignee,
        new_value=assignee_name
    )

    return {
        "ticket_id": ticket_id,
        "assignee_name": assignee_name,
        "assignee_email": assignee_email,
        "previous_assignee": old_assignee
    }

def auto_assign_ticket_ai(ticket_id: int, actor_name: str = "AI Auto-Router") -> Dict[str, Any]:
    """Intelligently route and assign a ticket to the best available agent based on category, priority, and load."""
    init_collaboration_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT category, priority, assigned_team, requires_immediate_escalation FROM tickets WHERE id = ?", (ticket_id,))
        ticket = cursor.fetchone()
        if not ticket:
            raise ValueError(f"Ticket #{ticket_id} not found")

    workload = get_team_workload_summary()

    # Rule 1: Immediate escalation goes to Elena Rostova (Escalations Ombudsman)
    if ticket["requires_immediate_escalation"] or str(ticket["priority"]).lower() == "high":
        vip_agent = next((m for m in workload if m["name"] == "Elena Rostova"), None)
        if vip_agent and not vip_agent["is_at_capacity"]:
            return assign_ticket_to_agent(ticket_id, vip_agent["name"], vip_agent["email"], actor_name=actor_name)

    # Rule 2: Department match sorted by lowest open ticket load
    category = str(ticket["category"]).lower()
    matching_agents = []
    
    if "billing" in category or "payment" in category or "refund" in category:
        matching_agents = [m for m in workload if "Billing" in m["department"]]
    elif "technical" in category or "bug" in category or "api" in category or "integration" in category:
        matching_agents = [m for m in workload if "IT" in m["department"]]
    elif "shipping" in category or "delivery" in category or "logistics" in category or "hardware" in category:
        matching_agents = [m for m in workload if "Operations" in m["department"]]
    else:
        matching_agents = [m for m in workload if "Customer Success" in m["department"]]

    if not matching_agents:
        matching_agents = workload

    # Pick the agent with lowest workload who is not away
    best_agent = sorted(matching_agents, key=lambda a: (a["open_tickets"], 0 if a["status"] == "Online" else 1))[0]

    return assign_ticket_to_agent(ticket_id, best_agent["name"], best_agent["email"], actor_name=actor_name)

def add_internal_note(
    ticket_id: int,
    author_name: str,
    note_text: str,
    author_role: str = "Support Agent",
    note_type: str = "internal",
    tags: Optional[List[str]] = None,
    is_pinned: bool = False
) -> Dict[str, Any]:
    """Add a private staff internal note or handover note."""
    init_collaboration_db()
    tags_json = json.dumps(tags or [])
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO internal_notes (ticket_id, author_name, author_role, note_text, note_type, tags, is_pinned)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (ticket_id, author_name, author_role, note_text, note_type, tags_json, 1 if is_pinned else 0))
        conn.commit()
        note_id = cursor.lastrowid

    log_audit_event(
        ticket_id=ticket_id,
        action_type="NOTE_ADDED",
        actor_name=author_name,
        actor_role=author_role,
        details=f"Added internal note ({note_type})"
    )

    return {
        "id": note_id,
        "ticket_id": ticket_id,
        "author_name": author_name,
        "author_role": author_role,
        "note_text": note_text,
        "note_type": note_type,
        "tags": tags or [],
        "is_pinned": is_pinned
    }

def get_internal_notes(ticket_id: int) -> List[Dict[str, Any]]:
    """Retrieve all internal notes for a ticket, with pinned notes first."""
    init_collaboration_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM internal_notes
            WHERE ticket_id = ?
            ORDER BY is_pinned DESC, created_at DESC, id DESC
        """, (ticket_id,))
        rows = cursor.fetchall()

    notes = []
    for row in rows:
        n = dict(row)
        try:
            n["tags"] = json.loads(n["tags"]) if n.get("tags") else []
        except Exception:
            n["tags"] = []
        notes.append(n)
    return notes

def delete_internal_note(note_id: int, actor_name: str = "Support Agent") -> bool:
    """Delete an internal note and log the audit event."""
    init_collaboration_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT ticket_id, author_name FROM internal_notes WHERE id = ?", (note_id,))
        row = cursor.fetchone()
        if not row:
            return False
        ticket_id = row["ticket_id"]
        cursor.execute("DELETE FROM internal_notes WHERE id = ?", (note_id,))
        conn.commit()

    log_audit_event(
        ticket_id=ticket_id,
        action_type="NOTE_DELETED",
        actor_name=actor_name,
        details=f"Deleted internal note #{note_id}"
    )
    return True

def toggle_pin_internal_note(note_id: int) -> Optional[bool]:
    """Toggle the pinned status of an internal note."""
    init_collaboration_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT is_pinned FROM internal_notes WHERE id = ?", (note_id,))
        row = cursor.fetchone()
        if not row:
            return None
        new_pinned = 0 if row["is_pinned"] else 1
        cursor.execute("UPDATE internal_notes SET is_pinned = ? WHERE id = ?", (new_pinned, note_id))
        conn.commit()
        return bool(new_pinned)

def generate_ai_shift_handover(ticket_id: int, actor_name: str = "AI Shift Handover Assistant") -> Dict[str, Any]:
    """Generate an automated structured handover briefing note using AI and save it as a pinned internal note."""
    init_collaboration_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,))
        t_row = cursor.fetchone()
        if not t_row:
            raise ValueError(f"Ticket #{ticket_id} not found")
        ticket = dict(t_row)

        cursor.execute("SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC", (ticket_id,))
        messages = [dict(r) for r in cursor.fetchall()]

    # Format brief summary
    category = ticket.get("category", "General")
    priority = ticket.get("priority", "Medium")
    sentiment = ticket.get("sentiment", "Neutral")
    customer_msg_count = sum(1 for m in messages if m["sender"] == "customer")
    agent_msg_count = sum(1 for m in messages if m["sender"] == "agent")

    handover_body = (
        f"📋 **SHIFT HANDOVER BRIEFING**\n\n"
        f"• **Category & Priority**: {category} | {priority} (Sentiment: {sentiment})\n"
        f"• **Conversation Depth**: {customer_msg_count} customer message(s), {agent_msg_count} agent reply(ies).\n"
        f"• **Latest Status**: Currently in '{ticket.get('status', 'Open')}' state.\n"
        f"• **Summary**: {ticket.get('summary', 'Customer reported an issue.')}\n"
        f"• **Pending Actions**: Review draft response and ensure SLA compliance before deadline ({ticket.get('sla_deadline', 'N/A')}).\n"
        f"• **Assigned Specialist**: {ticket.get('assignee_name', 'Unassigned')}"
    )

    note = add_internal_note(
        ticket_id=ticket_id,
        author_name="AI Handover Sentinel",
        author_role="AI Collaboration Bot",
        note_text=handover_body,
        note_type="handover",
        tags=["Shift Handover", "AI Generated", "Briefing"],
        is_pinned=True
    )

    log_audit_event(
        ticket_id=ticket_id,
        action_type="HANDOVER",
        actor_name=actor_name,
        actor_role="AI Sentinel",
        details="Generated automated shift handover briefing note"
    )

    return note
