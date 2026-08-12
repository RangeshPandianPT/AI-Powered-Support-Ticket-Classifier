import sqlite3
import json
from datetime import datetime
import os
from typing import List, Dict, Any, Optional
from schema import TicketClassification

DB_FILE = os.path.join(os.path.dirname(__file__), "tickets.db")

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

def save_ticket(
    ticket_text: str, 
    classification: TicketClassification, 
    provider_used: str = "OpenAI",
    status: str = "Open"
) -> int:
    """Save a classified ticket into the SQLite database."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        action_items_json = json.dumps(classification.key_action_items)
        cursor.execute("""
            INSERT INTO tickets (
                ticket_text, summary, category, assigned_team, priority, 
                sentiment, confidence_score, draft_response, key_action_items, 
                requires_immediate_escalation, status, provider_used, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))
        conn.commit()
        return cursor.lastrowid

def get_all_tickets(
    status_filter: Optional[str] = None, 
    team_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    search_query: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieve tickets from the database with optional filtering."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM tickets WHERE 1=1"
        params = []

        if status_filter and status_filter != "All":
            query += " AND status = ?"
            params.append(status_filter)
            
        if team_filter and team_filter != "All":
            query += " AND assigned_team = ?"
            params.append(team_filter)

        if priority_filter and priority_filter != "All":
            query += " AND priority = ?"
            params.append(priority_filter)

        if search_query and search_query.strip():
            query += " AND (ticket_text LIKE ? OR summary LIKE ?)"
            term = f"%{search_query.strip()}%"
            params.extend([term, term])

        query += " ORDER BY created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        results = []
        for row in rows:
            item = dict(row)
            try:
                item['key_action_items'] = json.loads(item['key_action_items']) if item['key_action_items'] else []
            except Exception:
                item['key_action_items'] = []
            results.append(item)
            
        return results

def update_ticket_status(ticket_id: int, new_status: str) -> bool:
    """Update the resolution status of a ticket."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE tickets SET status = ? WHERE id = ?", (new_status, ticket_id))
        row_count = cursor.rowcount
        conn.commit()
        return row_count > 0

def delete_ticket(ticket_id: int) -> bool:
    """Delete a ticket from the database."""
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM tickets WHERE id = ?", (ticket_id,))
        row_count = cursor.rowcount
        conn.commit()
        return row_count > 0

def get_analytics_summary() -> Dict[str, Any]:
    """Calculate key analytics metrics from stored tickets."""
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

        return {
            "total_tickets": total_tickets,
            "total_escalations": total_escalations,
            "total_open": total_open,
            "avg_confidence": avg_confidence
        }
