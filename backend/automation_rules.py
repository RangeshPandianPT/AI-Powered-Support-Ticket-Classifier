import sqlite3
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
import database as db
import collaboration as collab
import incident_management as im
import qa_and_macros as qam

DB_FILE = os.path.join(os.path.dirname(__file__), "tickets.db")

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_rules_db():
    """Initialize tables for Auto-Pilot Automation Rules & Execution Logs."""
    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS automation_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                trigger_event TEXT DEFAULT 'ON_INGEST',
                conditions_json TEXT NOT NULL,
                actions_json TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                execution_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rule_execution_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id INTEGER NOT NULL,
                rule_name TEXT NOT NULL,
                ticket_id INTEGER NOT NULL,
                trigger_event TEXT NOT NULL,
                actions_applied TEXT NOT NULL,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rule_id) REFERENCES automation_rules (id) ON DELETE CASCADE,
                FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rule_logs_ticket ON rule_execution_logs(ticket_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rule_logs_rule ON rule_execution_logs(rule_id)")

        # Seed default rules if empty
        cursor.execute("SELECT COUNT(*) as cnt FROM automation_rules")
        if cursor.fetchone()["cnt"] == 0:
            seed_default_rules(cursor)

        conn.commit()

def seed_default_rules(cursor):
    """Seed 4 enterprise Auto-Pilot workflow rules."""
    default_rules = [
        {
            "name": "VIP Frustration Escalation Sentinel",
            "description": "Automatically escalates high-priority frustrated tickets to Executive Ombudsman and flags internal staff notes.",
            "trigger_event": "ON_INGEST",
            "conditions": [
                {"field": "priority", "operator": "equals", "value": "High"},
                {"field": "sentiment", "operator": "contains_any", "value": "Frustrated,Angry,Urgent"}
            ],
            "actions": [
                {"type": "assign_agent", "value": "Elena Rostova"},
                {"type": "set_escalation", "value": "1"},
                {"type": "add_internal_note", "value": "[Auto-Pilot Sentinel] High-priority negative sentiment detected. Escalated to Executive Ombudsman."}
            ],
            "is_active": 1
        },
        {
            "name": "Express Billing & Refund Fast-Track",
            "description": "Routes billing refund inquiries to Billing Specialist and pre-stages the Refund Approval smart macro.",
            "trigger_event": "ON_INGEST",
            "conditions": [
                {"field": "category", "operator": "contains", "value": "Billing"},
                {"field": "ticket_text", "operator": "contains_any", "value": "refund,duplicate,charge,overcharged"}
            ],
            "actions": [
                {"type": "assign_agent", "value": "Alex Rivera"},
                {"type": "apply_macro", "value": "Refund"},
                {"type": "add_internal_note", "value": "[Auto-Pilot] Routed to Billing Specialist & staged refund policy macro."}
            ],
            "is_active": 1
        },
        {
            "name": "Systemic Outage Auto-Linker",
            "description": "Detects server 500 or gateway timeout symptoms, routes to Dev On-Call, and links to Incident INC-101.",
            "trigger_event": "ON_INGEST",
            "conditions": [
                {"field": "ticket_text", "operator": "contains_any", "value": "500,timeout,gateway,crash,outage"}
            ],
            "actions": [
                {"type": "assign_agent", "value": "Dev On-Call"},
                {"type": "link_incident", "value": "INC-101"},
                {"type": "add_internal_note", "value": "[Auto-Pilot] Detected systemic outage signature. Auto-linked to INC-101 War Room."}
            ],
            "is_active": 1
        },
        {
            "name": "Low CSAT Customer Recovery",
            "description": "Reopens any ticket receiving a 1- or 2-star CSAT rating, elevates to High Priority, and alerts Customer Success Lead.",
            "trigger_event": "ON_CSAT",
            "conditions": [
                {"field": "csat_rating", "operator": "lte", "value": "2"}
            ],
            "actions": [
                {"type": "set_status", "value": "Open"},
                {"type": "set_priority", "value": "High"},
                {"type": "assign_agent", "value": "Priya Patel"},
                {"type": "add_internal_note", "value": "[Auto-Pilot Recovery] Low CSAT survey logged. Ticket reopened for immediate retention outreach."}
            ],
            "is_active": 1
        }
    ]

    for r in default_rules:
        cursor.execute("""
            INSERT INTO automation_rules (name, description, trigger_event, conditions_json, actions_json, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            r["name"],
            r["description"],
            r["trigger_event"],
            json.dumps(r["conditions"]),
            json.dumps(r["actions"]),
            r["is_active"]
        ))

def get_all_rules() -> List[Dict[str, Any]]:
    """Retrieve all automation rules with parsed JSON conditions and actions."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM automation_rules ORDER BY is_active DESC, id ASC")
        rows = cursor.fetchall()
        rules = []
        for row in rows:
            r = dict(row)
            r["conditions"] = json.loads(r.pop("conditions_json", "[]"))
            r["actions"] = json.loads(r.pop("actions_json", "[]"))
            r["is_active"] = bool(r["is_active"])
            rules.append(r)
        return rules

def create_rule(
    name: str,
    description: str,
    trigger_event: str,
    conditions: List[Dict[str, Any]],
    actions: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Create a new automation rule."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO automation_rules (name, description, trigger_event, conditions_json, actions_json, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        """, (name, description, trigger_event, json.dumps(conditions), json.dumps(actions)))
        rule_id = cursor.lastrowid
        conn.commit()
        cursor.execute("SELECT * FROM automation_rules WHERE id = ?", (rule_id,))
        row = dict(cursor.fetchone())
        row["conditions"] = json.loads(row.pop("conditions_json", "[]"))
        row["actions"] = json.loads(row.pop("actions_json", "[]"))
        row["is_active"] = bool(row["is_active"])
        return row

def toggle_rule(rule_id: int) -> Optional[bool]:
    """Toggle a rule active/paused state."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT is_active FROM automation_rules WHERE id = ?", (rule_id,))
        row = cursor.fetchone()
        if not row:
            return None
        new_state = 0 if row["is_active"] else 1
        cursor.execute("UPDATE automation_rules SET is_active = ? WHERE id = ?", (new_state, rule_id))
        conn.commit()
        return bool(new_state)

def delete_rule(rule_id: int) -> bool:
    """Delete an automation rule."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM automation_rules WHERE id = ?", (rule_id,))
        conn.commit()
        return cursor.rowcount > 0

def get_execution_logs(limit: int = 40) -> List[Dict[str, Any]]:
    """Retrieve recent rule execution audit logs."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT l.*, t.summary as ticket_summary, t.category as ticket_category
            FROM rule_execution_logs l
            LEFT JOIN tickets t ON l.ticket_id = t.id
            ORDER BY l.executed_at DESC, l.id DESC
            LIMIT ?
        """, (limit,))
        logs = []
        for row in cursor.fetchall():
            item = dict(row)
            try:
                item["actions_applied"] = json.loads(item["actions_applied"])
            except Exception:
                item["actions_applied"] = [item["actions_applied"]]
            logs.append(item)
        return logs

def get_ticket_automation_logs(ticket_id: int) -> List[Dict[str, Any]]:
    """Retrieve automation execution logs specific to a single ticket."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM rule_execution_logs
            WHERE ticket_id = ?
            ORDER BY executed_at DESC, id DESC
        """, (ticket_id,))
        logs = []
        for row in cursor.fetchall():
            item = dict(row)
            try:
                item["actions_applied"] = json.loads(item["actions_applied"])
            except Exception:
                item["actions_applied"] = [item["actions_applied"]]
            logs.append(item)
        return logs

# ==========================================
# Rule Evaluator & Executor Engine
# ==========================================

def _evaluate_condition(cond: Dict[str, Any], ticket: Dict[str, Any], extra_context: Dict[str, Any]) -> bool:
    """Evaluate a single IF condition against ticket data and event context."""
    field = cond.get("field", "")
    op = cond.get("operator", "equals")
    target = cond.get("value", "")

    # Resolve field value
    if field in extra_context and extra_context[field] is not None:
        actual = extra_context[field]
    else:
        actual = ticket.get(field)

    if actual is None:
        return False

    actual_str = str(actual).lower().strip()
    target_str = str(target).lower().strip()

    if op == "equals":
        return actual_str == target_str
    elif op == "not_equals":
        return actual_str != target_str
    elif op == "contains":
        return target_str in actual_str
    elif op == "contains_any":
        tokens = [t.strip() for t in target_str.split(",") if t.strip()]
        return any(tok in actual_str for tok in tokens)
    elif op in ("gt", "gte", "lt", "lte"):
        try:
            num_actual = float(actual)
            num_target = float(target)
            if op == "gt": return num_actual > num_target
            if op == "gte": return num_actual >= num_target
            if op == "lt": return num_actual < num_target
            if op == "lte": return num_actual <= num_target
        except (ValueError, TypeError):
            return False
    return False

def _execute_action(action: Dict[str, Any], ticket: Dict[str, Any], rule_name: str, dry_run: bool) -> str:
    """Execute a single THEN action and return a human-readable trace message."""
    atype = action.get("type", "")
    val = str(action.get("value", ""))
    tid = ticket["id"]

    if atype == "assign_agent":
        if not dry_run:
            member = next((m for m in collab.TEAM_MEMBERS if m["name"].lower() == val.lower()), None)
            email = member["email"] if member else None
            collab.assign_ticket_to_agent(
                ticket_id=tid,
                assignee_name=val,
                assignee_email=email,
                actor_name=f"Auto-Pilot ({rule_name})"
            )
        return f"Assigned ticket to {val}"

    elif atype == "set_priority":
        if not dry_run:
            with get_connection() as conn:
                conn.execute("UPDATE tickets SET priority = ? WHERE id = ?", (val, tid))
                conn.commit()
            collab.log_audit_event(
                ticket_id=tid,
                action_type="PRIORITY_CHANGE",
                actor_name=f"Auto-Pilot ({rule_name})",
                actor_role="Automation",
                details=f"Priority set to '{val}' by rule '{rule_name}'"
            )
        return f"Set priority to {val}"

    elif atype == "set_status":
        if not dry_run:
            db.update_ticket_status(tid, val)
            collab.log_audit_event(
                ticket_id=tid,
                action_type="STATUS_CHANGE",
                actor_name=f"Auto-Pilot ({rule_name})",
                actor_role="Automation",
                details=f"Status updated to '{val}' by rule '{rule_name}'"
            )
        return f"Updated status to {val}"

    elif atype == "set_escalation":
        if not dry_run:
            with get_connection() as conn:
                conn.execute("UPDATE tickets SET requires_immediate_escalation = 1 WHERE id = ?", (tid,))
                conn.commit()
            collab.log_audit_event(
                ticket_id=tid,
                action_type="ESCALATED",
                actor_name=f"Auto-Pilot ({rule_name})",
                actor_role="Automation",
                details=f"Urgent escalation flag triggered by rule '{rule_name}'"
            )
        return "Triggered Urgent Escalation Alert"

    elif atype == "link_incident":
        if not dry_run:
            incidents = im.get_all_incidents()
            target_inc = next(
                (i for i in incidents if i["incident_code"].lower() == val.lower() or str(i["id"]) == val),
                incidents[0] if incidents else None
            )
            if target_inc:
                im.link_ticket_to_incident(target_inc["id"], tid, actor_name=f"Auto-Pilot ({rule_name})")
                return f"Linked to Incident {target_inc['incident_code']}"
        return f"Link to Incident {val}"

    elif atype == "add_internal_note":
        if not dry_run:
            collab.add_internal_note(
                ticket_id=tid,
                author_name=f"Auto-Pilot: {rule_name}",
                author_role="Automation Engine",
                note_text=val,
                note_type="escalation",
                tags=["Auto-Pilot"],
                is_pinned=True
            )
        return "Pinned automated internal staff note"

    elif atype == "apply_macro":
        macros = qam.get_all_macros()
        matched_macro = next(
            (m for m in macros if val.lower() in m["title"].lower() or val.lower() in m["category"].lower()),
            macros[0] if macros else None
        )
        if matched_macro:
            if not dry_run:
                interpolated = qam.interpolate_macro(matched_macro["template_text"], ticket, ticket.get("assignee_name") or "Support Team")
                db.update_ticket_draft(tid, interpolated)
                collab.log_audit_event(
                    ticket_id=tid,
                    action_type="MACRO_APPLIED",
                    actor_name=f"Auto-Pilot ({rule_name})",
                    actor_role="Automation",
                    details=f"Auto-staged Smart Macro '{matched_macro['title']}'"
                )
            return f"Staged Smart Macro: {matched_macro['title']}"
        return f"Apply Smart Macro ({val})"

    return f"Executed {atype}: {val}"

def evaluate_ticket_rules(
    ticket_id: int,
    trigger_event: str = "ON_INGEST",
    dry_run: bool = False,
    extra_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Evaluate all active rules matching trigger_event against a ticket.
    When dry_run=False, executes matched actions and logs execution history.
    """
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise ValueError(f"Ticket #{ticket_id} not found")

    ctx = extra_context or {}
    all_rules = get_all_rules()

    # For manual evaluations, test against all active rules regardless of trigger_event
    candidate_rules = [
        r for r in all_rules
        if r["is_active"] and (trigger_event == "ON_MANUAL" or r["trigger_event"] == trigger_event)
    ]

    matched_results = []
    for rule in candidate_rules:
        conditions = rule.get("conditions", [])
        if not conditions:
            continue

        all_passed = all(_evaluate_condition(c, ticket, ctx) for c in conditions)
        if all_passed:
            actions_applied = []
            for action in rule.get("actions", []):
                trace = _execute_action(action, ticket, rule["name"], dry_run=dry_run)
                actions_applied.append(trace)

            if not dry_run:
                with get_connection() as conn:
                    conn.execute(
                        "UPDATE automation_rules SET execution_count = execution_count + 1 WHERE id = ?",
                        (rule["id"],)
                    )
                    conn.execute("""
                        INSERT INTO rule_execution_logs (rule_id, rule_name, ticket_id, trigger_event, actions_applied)
                        VALUES (?, ?, ?, ?, ?)
                    """, (rule["id"], rule["name"], ticket_id, trigger_event, json.dumps(actions_applied)))
                    conn.commit()

            matched_results.append({
                "rule_id": rule["id"],
                "rule_name": rule["name"],
                "trigger_event": rule["trigger_event"],
                "actions_applied": actions_applied
            })

    return {
        "ticket_id": ticket_id,
        "trigger_event": trigger_event,
        "dry_run": dry_run,
        "rules_evaluated": len(candidate_rules),
        "rules_matched": len(matched_results),
        "matches": matched_results
    }

