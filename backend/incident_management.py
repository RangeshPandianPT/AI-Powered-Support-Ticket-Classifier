import sqlite3
import json
import os
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from openai import OpenAI
import database as db
import collaboration as collab

DB_FILE = os.path.join(os.path.dirname(__file__), "tickets.db")

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_incident_db():
    """Initialize database tables for Incident War Room and Ticket Clustering."""
    with get_connection() as conn:
        cursor = conn.cursor()

        # Incidents Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_code TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                severity TEXT NOT NULL DEFAULT 'P2 - Major',
                status TEXT NOT NULL DEFAULT 'Investigating',
                category TEXT NOT NULL DEFAULT 'Technical',
                summary TEXT,
                root_cause_analysis TEXT,
                impacted_services TEXT,
                suggested_action TEXT,
                lead_responder TEXT DEFAULT 'AI Incident Commander',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_incident_code ON incidents(incident_code)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_incident_status ON incidents(status)")

        # Incident-Ticket Mapping Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS incident_tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_id INTEGER NOT NULL,
                ticket_id INTEGER NOT NULL,
                relevance_score REAL DEFAULT 0.90,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE,
                FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
                UNIQUE(incident_id, ticket_id)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_inc_tickets_inc_id ON incident_tickets(incident_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_inc_tickets_tkt_id ON incident_tickets(ticket_id)")

        # Seed initial active incidents if table is empty
        cursor.execute("SELECT COUNT(*) as cnt FROM incidents")
        count = cursor.fetchone()["cnt"]
        if count == 0:
            seed_default_incidents(cursor)

        conn.commit()

def seed_default_incidents(cursor):
    """Seed representative incidents linked to sample tickets."""
    # Check existing tickets to link
    cursor.execute("SELECT id, ticket_text, category, priority FROM tickets ORDER BY id ASC")
    existing_tickets = cursor.fetchall()
    
    tkt_ids_tech = [t["id"] for t in existing_tickets if "api" in t["ticket_text"].lower() or "500" in t["ticket_text"].lower() or "error" in t["ticket_text"].lower()]
    tkt_ids_bill = [t["id"] for t in existing_tickets if "charge" in t["ticket_text"].lower() or "refund" in t["ticket_text"].lower() or "billing" in t["ticket_text"].lower()]
    
    # Incident 1: Payment Gateway Webhook Latency
    cursor.execute("""
        INSERT INTO incidents (
            incident_code, title, severity, status, category, summary, 
            root_cause_analysis, impacted_services, suggested_action, lead_responder
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "INC-101",
        "Payment Gateway Webhook Timeout & Duplicate Authorization Failures",
        "P1 - Critical",
        "Investigating",
        "Billing & Payments",
        "Multiple customer reports indicating checkout failures, 504 timeouts, and duplicate pending card charges.",
        "Stripe upstream webhook processor experienced 45-second latency spike following database connection pool exhaustion.",
        json.dumps(["Stripe Payment Gateway", "Checkout Microservice", "Invoice Dispatcher"]),
        "Drain stale Redis message queues, scale connection pool by 2.5x, and broadcast duplicate charge reassurance to customers.",
        "Sarah Chen (Billing Lead)"
    ))
    inc1_id = cursor.lastrowid

    # Link tech/billing tickets
    linked_count = 0
    for tid in (tkt_ids_bill + tkt_ids_tech)[:3]:
        cursor.execute("""
            INSERT OR IGNORE INTO incident_tickets (incident_id, ticket_id, relevance_score)
            VALUES (?, ?, ?)
        """, (inc1_id, tid, 0.94))
        linked_count += 1

    # Incident 2: Regional Fulfillment Courier Delay
    cursor.execute("""
        INSERT INTO incidents (
            incident_code, title, severity, status, category, summary, 
            root_cause_analysis, impacted_services, suggested_action, lead_responder
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "INC-102",
        "Midwest Fulfillment Center EDI Sync Failure & Courier Tracking Freeze",
        "P2 - Major",
        "Identified",
        "Logistics & Shipping",
        "Customer tracking numbers not updating for 48+ hours across FedEx Ground shipments departing Midwest Hub.",
        "EDI 214 tracking feed parser stalled after schema version mismatch deployed on warehouse scanner nodes.",
        json.dumps(["FedEx EDI Connector", "Warehouse Management API", "Notification Sentinel"]),
        "Roll back scanner firmware to v4.8.1 and trigger automated Priority Carrier Traces for affected orders.",
        "David Kim (Logistics Ops)"
    ))
    inc2_id = cursor.lastrowid

    # Link shipping tickets
    tkt_ids_ship = [t["id"] for t in existing_tickets if "track" in t["ticket_text"].lower() or "ship" in t["ticket_text"].lower() or "delay" in t["ticket_text"].lower()]
    for tid in tkt_ids_ship[:2]:
        cursor.execute("""
            INSERT OR IGNORE INTO incident_tickets (incident_id, ticket_id, relevance_score)
            VALUES (?, ?, ?)
        """, (inc2_id, tid, 0.88))

def get_all_incidents(status_filter: str = "All", severity_filter: str = "All") -> List[Dict[str, Any]]:
    """Retrieve all incidents with enriched statistics and linked ticket details."""
    with get_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM incidents WHERE 1=1"
        params = []

        if status_filter != "All":
            query += " AND status = ?"
            params.append(status_filter)
        if severity_filter != "All":
            query += " AND severity = ?"
            params.append(severity_filter)

        query += " ORDER BY CASE WHEN status = 'Investigating' THEN 1 WHEN status = 'Identified' THEN 2 WHEN status = 'Monitoring' THEN 3 ELSE 4 END, created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()

        incidents = []
        for r in rows:
            inc = dict(r)
            inc_id = inc["id"]

            # Parse impacted_services
            try:
                inc["impacted_services"] = json.loads(inc["impacted_services"]) if inc.get("impacted_services") else []
            except Exception:
                inc["impacted_services"] = [s.strip() for s in (inc.get("impacted_services") or "").split(",") if s.strip()]

            # Fetch linked tickets
            cursor.execute("""
                SELECT t.id, t.summary, t.category, t.priority, t.status, t.assigned_team, t.sentiment, t.created_at,
                       it.relevance_score
                FROM incident_tickets it
                JOIN tickets t ON it.ticket_id = t.id
                WHERE it.incident_id = ?
                ORDER BY t.id DESC
            """, (inc_id,))
            linked_tickets = [dict(t) for t in cursor.fetchall()]
            inc["linked_tickets"] = linked_tickets
            inc["linked_ticket_count"] = len(linked_tickets)

            # Blast radius metric (combining count and high priority ratio)
            high_count = sum(1 for t in linked_tickets if t.get("priority") == "High")
            inc["blast_radius_score"] = min(100, (len(linked_tickets) * 15) + (high_count * 20))

            incidents.append(inc)

        return incidents

def get_incident_by_id(incident_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve a single incident by ID with full ticket details."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
        row = cursor.fetchone()
        if not row:
            return None
        
        inc = dict(row)
        try:
            inc["impacted_services"] = json.loads(inc["impacted_services"]) if inc.get("impacted_services") else []
        except Exception:
            inc["impacted_services"] = [s.strip() for s in (inc.get("impacted_services") or "").split(",") if s.strip()]

        cursor.execute("""
            SELECT t.id, t.summary, t.ticket_text, t.category, t.priority, t.status, t.assigned_team, 
                   t.sentiment, t.assignee_name, t.created_at, it.relevance_score
            FROM incident_tickets it
            JOIN tickets t ON it.ticket_id = t.id
            WHERE it.incident_id = ?
            ORDER BY t.id DESC
        """, (incident_id,))
        inc["linked_tickets"] = [dict(t) for t in cursor.fetchall()]
        inc["linked_ticket_count"] = len(inc["linked_tickets"])
        return inc

def create_incident(
    title: str,
    severity: str = "P2 - Major",
    category: str = "Technical",
    summary: str = "",
    root_cause_analysis: str = "",
    impacted_services: Optional[List[str]] = None,
    suggested_action: str = "",
    lead_responder: str = "Support Lead",
    ticket_ids: Optional[List[int]] = None
) -> Dict[str, Any]:
    """Create a new operational incident and optionally link tickets."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Generate code INC-XXX
        cursor.execute("SELECT MAX(id) as max_id FROM incidents")
        row = cursor.fetchone()
        next_num = (row["max_id"] or 100) + 1
        code = f"INC-{next_num:03d}"

        services_json = json.dumps(impacted_services or [])

        cursor.execute("""
            INSERT INTO incidents (
                incident_code, title, severity, status, category, summary,
                root_cause_analysis, impacted_services, suggested_action, lead_responder
            ) VALUES (?, ?, ?, 'Investigating', ?, ?, ?, ?, ?, ?)
        """, (
            code, title, severity, category, summary,
            root_cause_analysis, services_json, suggested_action, lead_responder
        ))
        inc_id = cursor.lastrowid

        if ticket_ids:
            for tid in ticket_ids:
                cursor.execute("""
                    INSERT OR IGNORE INTO incident_tickets (incident_id, ticket_id, relevance_score)
                    VALUES (?, ?, ?)
                """, (inc_id, tid, 0.95))
                
                collab.log_audit_event(
                    ticket_id=tid,
                    action_type="INCIDENT_LINKED",
                    actor_name=lead_responder,
                    actor_role="Incident Commander",
                    details=f"Linked to Incident {code}: {title} ({severity})"
                )

        conn.commit()
        return get_incident_by_id(inc_id)

def link_ticket_to_incident(incident_id: int, ticket_id: int, actor_name: str = "Support Agent") -> bool:
    """Link an individual ticket to an existing incident."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT incident_code, title, severity FROM incidents WHERE id = ?", (incident_id,))
        inc = cursor.fetchone()
        if not inc:
            return False

        cursor.execute("""
            INSERT OR IGNORE INTO incident_tickets (incident_id, ticket_id, relevance_score)
            VALUES (?, ?, 0.95)
        """, (incident_id, ticket_id))
        
        cursor.execute("UPDATE incidents SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (incident_id,))
        conn.commit()

        collab.log_audit_event(
            ticket_id=ticket_id,
            action_type="INCIDENT_LINKED",
            actor_name=actor_name,
            actor_role="Support Agent",
            details=f"Associated with Incident {inc['incident_code']} ({inc['severity']}): {inc['title']}"
        )
        return True

def unlink_ticket_from_incident(incident_id: int, ticket_id: int) -> bool:
    """Remove a ticket association from an incident."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM incident_tickets WHERE incident_id = ? AND ticket_id = ?", (incident_id, ticket_id))
        conn.commit()
        return True

def get_ticket_incident(ticket_id: int) -> Optional[Dict[str, Any]]:
    """Find the active incident associated with a ticket (if any)."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT i.*, it.relevance_score
            FROM incident_tickets it
            JOIN incidents i ON it.incident_id = i.id
            WHERE it.ticket_id = ?
            ORDER BY i.created_at DESC
            LIMIT 1
        """, (ticket_id,))
        row = cursor.fetchone()
        if not row:
            return None
        inc = dict(row)
        try:
            inc["impacted_services"] = json.loads(inc["impacted_services"]) if inc.get("impacted_services") else []
        except Exception:
            inc["impacted_services"] = []
        return inc

# ==========================================
# AI Incident Clustering & Outage Detection
# ==========================================

def detect_incident_clusters() -> Dict[str, Any]:
    """
    Analyze recent tickets using semantic patterns and theme clustering to identify
    emerging incidents, spikes, and systemic outages.
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, ticket_text, summary, category, priority, status, sentiment, created_at
            FROM tickets
            ORDER BY id DESC
            LIMIT 50
        """)
        recent_tickets = [dict(t) for t in cursor.fetchall()]

    if not recent_tickets:
        return {"detected_incidents": [], "message": "No tickets available to analyze."}

    # Synthesize clusters using LLM or smart heuristic clustering
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    ticket_summaries = [
        f"ID #{t['id']} | {t['category']} | {t['priority']} | {t['sentiment']} | \"{t['summary'] or t['ticket_text'][:120]}\""
        for t in recent_tickets[:25]
    ]
    ticket_payload = "\n".join(ticket_summaries)

    prompt = (
        "You are an SRE / Customer Support Incident Commander.\n"
        "Analyze the following recent support tickets and identify any widespread systemic outages, recurring bugs, "
        "or multi-ticket clusters (where 2 or more tickets share an underlying root cause).\n\n"
        f"Recent Tickets:\n{ticket_payload}\n\n"
        "Return a valid JSON object with key 'clusters' containing an array of detected incidents:\n"
        "{\n"
        "  \"clusters\": [\n"
        "    {\n"
        "      \"title\": \"Title of the incident\",\n"
        "      \"severity\": \"P1 - Critical\" | \"P2 - Major\" | \"P3 - Moderate\",\n"
        "      \"category\": \"Billing & Payments\" | \"Technical Support\" | \"Logistics & Shipping\" | \"Platform\",\n"
        "      \"summary\": \"Concise description of the customer-facing issue\",\n"
        "      \"root_cause_hypothesis\": \"Technical hypothesis of the underlying failure\",\n"
        "      \"impacted_services\": [\"Service A\", \"Service B\"],\n"
        "      \"suggested_remediation\": \"Action items for support and engineering teams\",\n"
        "      \"ticket_ids\": [1, 2]\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Only return clusters that contain at least 2 tickets."
    )

    detected_clusters = []

    if openai_key:
        try:
            client = OpenAI(api_key=openai_key)
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an incident command clustering system. Return only JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            raw = json.loads(completion.choices[0].message.content)
            detected_clusters = raw.get("clusters", [])
        except Exception as e:
            print(f"[OpenAI Cluster Detection Error]: {e}")

    if not detected_clusters and gemini_key:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=gemini_key)
            res = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            raw = json.loads(res.text)
            detected_clusters = raw.get("clusters", [])
        except Exception as e:
            print(f"[Gemini Cluster Detection Error]: {e}")

    # Fallback heuristic pattern clustering
    if not detected_clusters:
        detected_clusters = generate_heuristic_clusters(recent_tickets)

    # Ingest or update detected clusters in database
    created_or_updated = []
    with get_connection() as conn:
        cursor = conn.cursor()
        for c in detected_clusters:
            tids = [int(tid) for tid in c.get("ticket_ids", []) if any(t["id"] == int(tid) for t in recent_tickets)]
            if len(tids) < 2:
                continue

            # Check if similar incident already exists
            title_slug = c.get("title", "")[:30]
            cursor.execute("SELECT id, incident_code FROM incidents WHERE title LIKE ? LIMIT 1", (f"%{title_slug}%",))
            existing = cursor.fetchone()

            if existing:
                inc_id = existing["id"]
                inc_code = existing["incident_code"]
            else:
                cursor.execute("SELECT MAX(id) as max_id FROM incidents")
                max_id = (cursor.fetchone()["max_id"] or 100) + 1
                inc_code = f"INC-{max_id:03d}"
                services = json.dumps(c.get("impacted_services", ["Core Platform"]))

                cursor.execute("""
                    INSERT INTO incidents (
                        incident_code, title, severity, status, category, summary,
                        root_cause_analysis, impacted_services, suggested_action, lead_responder
                    ) VALUES (?, ?, ?, 'Investigating', ?, ?, ?, ?, ?, 'AI Sentinel')
                """, (
                    inc_code,
                    c.get("title", "Detected Incident Cluster"),
                    c.get("severity", "P2 - Major"),
                    c.get("category", "General"),
                    c.get("summary", ""),
                    c.get("root_cause_hypothesis", "Pattern clustering detected repeated customer symptoms."),
                    services,
                    c.get("suggested_remediation", "Investigate service logs and deploy proactive communication."),
                ))
                inc_id = cursor.lastrowid

            # Link tickets
            newly_linked = 0
            for tid in tids:
                cursor.execute("""
                    INSERT OR IGNORE INTO incident_tickets (incident_id, ticket_id, relevance_score)
                    VALUES (?, ?, 0.92)
                """, (inc_id, tid))
                if cursor.rowcount > 0:
                    newly_linked += 1
                    collab.log_audit_event(
                        ticket_id=tid,
                        action_type="INCIDENT_AUTO_CLUSTERED",
                        actor_name="AI Outage Detector",
                        actor_role="Sentinel",
                        details=f"Auto-clustered into Incident {inc_code}: {c.get('title')}"
                    )

            conn.commit()
            created_or_updated.append({
                "incident_id": inc_id,
                "incident_code": inc_code,
                "title": c.get("title"),
                "severity": c.get("severity"),
                "linked_tickets_count": len(tids),
                "newly_linked": newly_linked
            })

    return {
        "status": "success",
        "scanned_tickets": len(recent_tickets),
        "clusters_found": len(created_or_updated),
        "clusters": created_or_updated
    }

def generate_heuristic_clusters(tickets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Offline clustering grouping tickets by recurring technical keywords and symptoms."""
    clusters = []

    # Cluster 1: Payment & Billing issues
    billing_tickets = [
        t["id"] for t in tickets 
        if any(w in (t.get("ticket_text", "") + " " + (t.get("summary") or "")).lower() 
               for w in ["charge", "refund", "billing", "duplicate", "invoice", "stripe", "credit"])
    ]
    if len(billing_tickets) >= 2:
        clusters.append({
            "title": "Payment Settlement & Duplicate Billing Discrepancy",
            "severity": "P1 - Critical",
            "category": "Billing & Payments",
            "summary": "Multiple accounts reporting unexpected pending authorization charges or duplicate debit transactions.",
            "root_cause_hypothesis": "Upstream payment gateway settlement batching delay or idempotency key replay in billing microservice.",
            "impacted_services": ["Billing API", "Stripe Webhook Gateway", "Ledger Engine"],
            "suggested_remediation": "Audit pending transaction ledger, verify Stripe event webhooks, and issue batch confirmation notices.",
            "ticket_ids": billing_tickets[:5]
        })

    # Cluster 2: API / 500 Server Errors
    tech_tickets = [
        t["id"] for t in tickets 
        if any(w in (t.get("ticket_text", "") + " " + (t.get("summary") or "")).lower() 
               for w in ["500", "api", "server", "crash", "timeout", "latency", "exception", "broken"])
    ]
    if len(tech_tickets) >= 2:
        clusters.append({
            "title": "Application Gateway Elevated 500 Server Error Spike",
            "severity": "P1 - Critical",
            "category": "Technical Support",
            "summary": "Customers encountering HTTP 500 Internal Server Errors and request timeout drops during active workflows.",
            "root_cause_hypothesis": "Database connection pool exhaustion and memory threshold throttle on backend API pods.",
            "impacted_services": ["Core API Gateway", "Database Connection Pool", "Redis Cache"],
            "suggested_remediation": "Increase connection pool limits, restart degraded worker pods, and monitor error budgets.",
            "ticket_ids": tech_tickets[:5]
        })

    # Cluster 3: Logistics / Shipment Delays
    shipping_tickets = [
        t["id"] for t in tickets 
        if any(w in (t.get("ticket_text", "") + " " + (t.get("summary") or "")).lower() 
               for w in ["ship", "tracking", "fedex", "ups", "delay", "delivery", "carrier", "package"])
    ]
    if len(shipping_tickets) >= 2:
        clusters.append({
            "title": "Regional Carrier Fulfillment & Tracking Ingestion Freeze",
            "severity": "P2 - Major",
            "category": "Logistics & Shipping",
            "summary": "Outbound orders experiencing unrecorded tracking milestones and delayed package transit scans.",
            "root_cause_hypothesis": "Carrier EDI API webhook throttle preventing automated fulfillment event synchronization.",
            "impacted_services": ["Fulfillment Sync Service", "FedEx/UPS Gateway", "Customer Notification Hub"],
            "suggested_remediation": "Initiate automated carrier tracer requests and push proactive delivery status updates.",
            "ticket_ids": shipping_tickets[:5]
        })

    return clusters

# ==========================================
# Mass Incident Broadcast & Bulk Actions
# ==========================================

def broadcast_incident_update(
    incident_id: int,
    broadcast_message: str,
    new_status: Optional[str] = None,
    mark_tickets_resolved: bool = False,
    actor_name: str = "Incident Commander"
) -> Dict[str, Any]:
    """
    Mass-broadcast an official incident communication message to all linked tickets.
    Appends the message into each ticket's conversation thread, updates ticket drafts,
    optionally resolves linked tickets, and logs audit events.
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
        inc = cursor.fetchone()
        if not inc:
            raise ValueError(f"Incident #{incident_id} not found.")

        cursor.execute("""
            SELECT it.ticket_id, t.status, t.summary, t.assignee_name
            FROM incident_tickets it
            JOIN tickets t ON it.ticket_id = t.id
            WHERE it.incident_id = ?
        """, (incident_id,))
        linked_records = cursor.fetchall()

    if not linked_records:
        return {"message": "No tickets linked to this incident.", "dispatched_count": 0}

    dispatched_tickets = []
    for rec in linked_records:
        tid = rec["ticket_id"]

        # Append message to conversation thread
        formatted_broadcast = (
            f"📢 [Incident Broadcast - {inc['incident_code']}]:\n\n"
            f"{broadcast_message}\n\n"
            f"— {actor_name} | Incident Response Team"
        )
        db.add_ticket_message(
            ticket_id=tid,
            sender="agent",
            message_text=formatted_broadcast,
            sentiment="Official Update"
        )

        # Update draft
        db.update_ticket_draft(tid, formatted_broadcast)

        # Optionally resolve ticket
        if mark_tickets_resolved:
            db.update_ticket_status(tid, "Resolved")

        # Audit log
        collab.log_audit_event(
            ticket_id=tid,
            action_type="INCIDENT_MASS_BROADCAST",
            actor_name=actor_name,
            actor_role="Incident Commander",
            details=f"Mass broadcast dispatched for Incident {inc['incident_code']} ({'Marked Resolved' if mark_tickets_resolved else 'Status Kept'})"
        )
        dispatched_tickets.append(tid)

    # Update incident record
    with get_connection() as conn:
        cursor = conn.cursor()
        if new_status:
            resolved_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S") if new_status == "Resolved" else None
            cursor.execute("""
                UPDATE incidents 
                SET status = ?, updated_at = CURRENT_TIMESTAMP, resolved_at = COALESCE(?, resolved_at)
                WHERE id = ?
            """, (new_status, resolved_at, incident_id))
        else:
            cursor.execute("UPDATE incidents SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (incident_id,))
        conn.commit()

    return {
        "status": "success",
        "incident_code": inc["incident_code"],
        "dispatched_count": len(dispatched_tickets),
        "ticket_ids": dispatched_tickets,
        "marked_resolved": mark_tickets_resolved,
        "new_incident_status": new_status or inc["status"]
    }

def resolve_incident(incident_id: int, resolution_notes: str, actor_name: str = "Incident Commander") -> Dict[str, Any]:
    """Mark an incident as Resolved with formal post-mortem notes."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT incident_code FROM incidents WHERE id = ?", (incident_id,))
        inc = cursor.fetchone()
        if not inc:
            raise ValueError(f"Incident #{incident_id} not found.")

        cursor.execute("""
            UPDATE incidents
            SET status = 'Resolved',
                root_cause_analysis = root_cause_analysis || '\n\n[Resolution Post-Mortem]: ' || ?,
                updated_at = CURRENT_TIMESTAMP,
                resolved_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (resolution_notes, incident_id))
        conn.commit()

    return get_incident_by_id(incident_id)

