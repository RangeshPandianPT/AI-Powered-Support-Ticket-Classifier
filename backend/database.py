import sqlite3
import json
from datetime import datetime, timedelta
import os
from typing import List, Dict, Any, Optional
from schema import TicketClassification

DB_FILE = os.path.join(os.path.dirname(__file__), "tickets.db")

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def calculate_sla_hours(priority: str) -> int:
    """Return the SLA target in hours based on issue priority."""
    p = (priority or "").strip().lower()
    if p == "high":
        return 4
    elif p == "medium":
        return 12
    return 24

def enrich_ticket_data(ticket: Dict[str, Any]) -> Dict[str, Any]:
    """Enrich ticket record with computed SLA status, remaining minutes, and action items."""
    try:
        ticket['key_action_items'] = json.loads(ticket['key_action_items']) if ticket.get('key_action_items') else []
    except Exception:
        ticket['key_action_items'] = []

    # Calculate SLA status
    created_at_str = ticket.get("created_at")
    priority = ticket.get("priority", "Medium")
    sla_hours = calculate_sla_hours(priority)
    ticket["sla_target_hours"] = sla_hours

    try:
        if created_at_str:
            # Handle standard SQLite timestamp format
            created_dt = datetime.strptime(created_at_str.split(".")[0], "%Y-%m-%d %H:%M:%S")
        else:
            created_dt = datetime.now()

        sla_deadline_dt = created_dt + timedelta(hours=sla_hours)
        ticket["sla_deadline"] = sla_deadline_dt.strftime("%Y-%m-%d %H:%M:%S")

        remaining_seconds = (sla_deadline_dt - datetime.now()).total_seconds()
        remaining_minutes = int(remaining_seconds / 60)
        ticket["sla_remaining_minutes"] = remaining_minutes
        ticket["is_sla_breached"] = remaining_minutes <= 0 and ticket.get("status") == "Open"
    except Exception:
        ticket["sla_deadline"] = None
        ticket["sla_remaining_minutes"] = 0
        ticket["is_sla_breached"] = False

    ticket["assignee_name"] = ticket.get("assignee_name") or "Unassigned"
    return ticket

def init_db():
    """Initialize the SQLite database schema if it doesn't exist."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_text TEXT NOT NULL,
                summary TEXT,
                category TEXT NOT NULL,
                assigned_team TEXT NOT NULL,
                priority TEXT NOT NULL,
                sentiment TEXT NOT NULL,
                confidence_score REAL NOT NULL,
                draft_response TEXT,
                key_action_items TEXT,
                requires_immediate_escalation INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'Open',
                provider_used TEXT NOT NULL DEFAULT 'OpenAI',
                sla_deadline TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Add sla_deadline column if upgrading existing DB
        try:
            cursor.execute("ALTER TABLE tickets ADD COLUMN sla_deadline TIMESTAMP")
        except sqlite3.OperationalError:
            pass

        # Multi-turn conversation messages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ticket_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id INTEGER NOT NULL,
                sender TEXT NOT NULL, -- 'customer' or 'agent'
                message_text TEXT NOT NULL,
                sentiment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id)")
        conn.commit()

def save_ticket(
    ticket_text: str, 
    classification: TicketClassification, 
    provider_used: str = "OpenAI",
    status: str = "Open"
) -> int:
    """Save a classified ticket into the SQLite database and seed initial customer message."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        action_items_json = json.dumps(classification.key_action_items)
        now_dt = datetime.now()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
        sla_hours = calculate_sla_hours(classification.priority.value)
        sla_deadline_str = (now_dt + timedelta(hours=sla_hours)).strftime("%Y-%m-%d %H:%M:%S")

        cursor.execute("""
            INSERT INTO tickets (
                ticket_text, summary, category, assigned_team, priority, 
                sentiment, confidence_score, draft_response, key_action_items, 
                requires_immediate_escalation, status, provider_used, sla_deadline, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            ticket_text,
            classification.summary,
            classification.category.value,
            classification.assigned_team.value,
            classification.priority.value,
            classification.sentiment.value,
            float(classification.confidence_score),
            classification.draft_response,
            action_items_json,
            1 if classification.requires_immediate_escalation else 0,
            status,
            provider_used,
            sla_deadline_str,
            now_str
        ))
        ticket_id = cursor.lastrowid

        # Insert initial inbound customer message into ticket_messages
        cursor.execute("""
            INSERT INTO ticket_messages (ticket_id, sender, message_text, sentiment, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            ticket_id,
            "customer",
            ticket_text,
            classification.sentiment.value,
            now_str
        ))

        conn.commit()
        return ticket_id

def add_ticket_message(
    ticket_id: int, 
    sender: str, 
    message_text: str, 
    sentiment: Optional[str] = None
) -> int:
    """Append a message to a ticket's conversation thread."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO ticket_messages (ticket_id, sender, message_text, sentiment, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (ticket_id, sender, message_text, sentiment, now_str))
        conn.commit()
        return cursor.lastrowid

def get_ticket_messages(ticket_id: int) -> List[Dict[str, Any]]:
    """Retrieve full conversation thread for a ticket."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM ticket_messages 
            WHERE ticket_id = ? 
            ORDER BY created_at ASC, id ASC
        """, (ticket_id,))
        rows = cursor.fetchall()
        
        # If no messages exist yet (e.g. legacy ticket), backfill from ticket_text
        if not rows:
            cursor.execute("SELECT ticket_text, sentiment, created_at FROM tickets WHERE id = ?", (ticket_id,))
            t_row = cursor.fetchone()
            if t_row:
                add_ticket_message(
                    ticket_id=ticket_id,
                    sender="customer",
                    message_text=t_row["ticket_text"],
                    sentiment=t_row["sentiment"]
                )
                cursor.execute("""
                    SELECT * FROM ticket_messages 
                    WHERE ticket_id = ? 
                    ORDER BY created_at ASC, id ASC
                """, (ticket_id,))
                rows = cursor.fetchall()

        return [dict(row) for row in rows]

def get_all_tickets(
    status_filter: Optional[str] = None, 
    team_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    search_query: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieve tickets from the database with optional filtering and SLA calculations."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        query = """
            SELECT t.*, 
                   (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id) AS message_count
            FROM tickets t
            WHERE 1=1
        """
        params = []

        if status_filter and status_filter != "All":
            query += " AND t.status = ?"
            params.append(status_filter)
            
        if team_filter and team_filter != "All":
            query += " AND t.assigned_team = ?"
            params.append(team_filter)

        if priority_filter and priority_filter != "All":
            query += " AND t.priority = ?"
            params.append(priority_filter)

        if search_query and search_query.strip():
            query += " AND (t.ticket_text LIKE ? OR t.summary LIKE ?)"
            term = f"%{search_query.strip()}%"
            params.extend([term, term])

        query += " ORDER BY t.created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        results = []
        for row in rows:
            item = enrich_ticket_data(dict(row))
            # Ensure message_count has at least 1 (the initial customer message)
            if not item.get("message_count"):
                item["message_count"] = 1
            results.append(item)
            
        return results

def get_ticket_by_id(ticket_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve a single ticket by its ID with conversation and SLA metadata."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT t.*, 
                   (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id) AS message_count
            FROM tickets t 
            WHERE t.id = ?
        """, (ticket_id,))
        row = cursor.fetchone()
        if not row:
            return None
            
        item = enrich_ticket_data(dict(row))
        if not item.get("message_count"):
            item["message_count"] = 1
        return item

def update_ticket_conversation(
    ticket_id: int, 
    sentiment: str, 
    draft_response: Optional[str] = None,
    requires_immediate_escalation: Optional[bool] = None,
    status: Optional[str] = None
) -> bool:
    """Update ticket metadata after a customer or agent multi-turn interaction."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        updates = ["sentiment = ?"]
        params = [sentiment]

        if draft_response is not None:
            updates.append("draft_response = ?")
            params.append(draft_response)

        if requires_immediate_escalation is not None:
            updates.append("requires_immediate_escalation = ?")
            params.append(1 if requires_immediate_escalation else 0)

        if status is not None:
            updates.append("status = ?")
            params.append(status)

        params.append(ticket_id)
        query = f"UPDATE tickets SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        row_count = cursor.rowcount
        conn.commit()
        return row_count > 0

def update_ticket_status(ticket_id: int, new_status: str) -> bool:
    """Update the resolution status of a ticket."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE tickets SET status = ? WHERE id = ?", (new_status, ticket_id))
        row_count = cursor.rowcount
        conn.commit()
        return row_count > 0

def update_ticket_draft(ticket_id: int, new_draft: str) -> bool:
    """Update the draft response of a ticket."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE tickets SET draft_response = ? WHERE id = ?", (new_draft, ticket_id))
        row_count = cursor.rowcount
        conn.commit()
        return row_count > 0

def delete_ticket(ticket_id: int) -> bool:
    """Delete a ticket and its messages from the database."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM ticket_messages WHERE ticket_id = ?", (ticket_id,))
        cursor.execute("DELETE FROM tickets WHERE id = ?", (ticket_id,))
        row_count = cursor.rowcount
        conn.commit()
        return row_count > 0

def get_analytics_summary() -> Dict[str, Any]:
    """Calculate key analytics metrics from stored tickets including SLA breaches."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM tickets")
        total_tickets = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM tickets WHERE requires_immediate_escalation = 1")
        total_escalations = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM tickets WHERE status = 'Open'")
        total_open = cursor.fetchone()[0]

        cursor.execute("SELECT AVG(confidence_score) FROM tickets")
        avg_confidence = cursor.fetchone()[0] or 0.0

        # Query all open tickets to compute current SLA breaches
        cursor.execute("SELECT created_at, priority FROM tickets WHERE status = 'Open'")
        open_rows = cursor.fetchall()
        sla_breaches = 0
        now = datetime.now()
        for r in open_rows:
            try:
                c_dt = datetime.strptime(r[0].split(".")[0], "%Y-%m-%d %H:%M:%S")
                target_hours = calculate_sla_hours(r[1])
                if (c_dt + timedelta(hours=target_hours)) < now:
                    sla_breaches += 1
            except Exception:
                pass

        return {
            "total_tickets": total_tickets,
            "total_escalations": total_escalations,
            "total_open": total_open,
            "avg_confidence": avg_confidence,
            "sla_breaches": sla_breaches
        }

