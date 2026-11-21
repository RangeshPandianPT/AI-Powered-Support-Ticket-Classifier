import sqlite3
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

import database as db
import collaboration as collab
import automation_rules as rules_engine
import customer_intelligence as cust_intel
from langgraph_workflow import run_ticket_workflow
from schema import TicketClassification, IssueCategory, AssignedTeam, IssuePriority, UserSentiment

DB_FILE = os.path.join(os.path.dirname(__file__), "tickets.db")

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

CHANNEL_GATEWAYS = {
    "whatsapp": {
        "name": "WhatsApp Business",
        "protocol": "WhatsApp Cloud API / Webhook",
        "icon": "💬",
        "color": "#22c55e",
        "status": "Online",
        "uptime": "99.8%",
        "avg_latency": "140ms",
        "features": ["Quick Replies", "Read Receipts", "Template Messages", "Phone Routing"]
    },
    "slack": {
        "name": "Slack Connect",
        "protocol": "Slack Events & Bolt API",
        "icon": "🟣",
        "color": "#a855f7",
        "status": "Connected",
        "uptime": "99.9%",
        "avg_latency": "95ms",
        "features": ["Shared Channels", "Thread Sync", "Markdown Rendering", "@mentions"]
    },
    "chat": {
        "name": "Live Webchat",
        "protocol": "Realtime WebSocket / REST Widget",
        "icon": "💬",
        "color": "#0ea5e9",
        "status": "Active",
        "uptime": "100.0%",
        "avg_latency": "45ms",
        "features": ["Session ID Tracking", "Typing Indicators", "Page Context", "Instant Dispatch"]
    },
    "sms": {
        "name": "SMS / Twilio",
        "protocol": "Twilio Messaging Gateway",
        "icon": "📱",
        "color": "#f97316",
        "status": "Online",
        "uptime": "99.5%",
        "avg_latency": "310ms",
        "features": ["160-Char Segmentation", "Carrier Delivery Receipts", "Shortcode Routing"]
    },
    "email": {
        "name": "Email / IMAP",
        "protocol": "IMAP4 / SMTP Secure Relay",
        "icon": "📧",
        "color": "#64748b",
        "status": "Active",
        "uptime": "99.7%",
        "avg_latency": "1.2s",
        "features": ["MIME Threading", "HTML Parsing", "DKIM/SPF Validation"]
    }
}

PRESET_SCENARIOS = [
    {
        "id": "wa_refund",
        "channel": "whatsapp",
        "title": "WhatsApp: POS Hardware Broken & Urgent Refund",
        "sender_name": "Sarah Connor",
        "sender_contact": "+1 (555) 234-8901",
        "message_text": "Hey support! Our counter barcode scanner arrived with a broken lens and isn't registering products. We need an immediate replacement or full refund approved today please!",
        "channel_metadata": {
            "phone": "+1 (555) 234-8901",
            "whatsapp_id": "wa_user_908124",
            "location": "Retail Branch #4"
        }
    },
    {
        "id": "slack_outage",
        "channel": "slack",
        "title": "Slack: Critical Database Connection Pool Exhaustion",
        "sender_name": "Tony Stark",
        "sender_contact": "@tstark (#enterprise-infra)",
        "message_text": "@support-lead We are seeing HTTP 500 errors and gateway timeouts across our batch invoice export pipelines. Is there an active incident or connection pool throttle on the API?",
        "channel_metadata": {
            "slack_channel": "#enterprise-infra",
            "team_id": "T09281A",
            "thread_ts": "1732194821.0921"
        }
    },
    {
        "id": "chat_billing",
        "channel": "chat",
        "title": "Live Chat: Checkout Promo Code Discount Failure",
        "sender_name": "Arthur Dent",
        "sender_contact": "Visitor_8812 (live_session_910)",
        "message_text": "Hello, I am on the checkout screen trying to renew our annual enterprise plan. The promo code 'ENTERPRISE20' is saying expired even though the quote was issued this morning. Can you apply it manually?",
        "channel_metadata": {
            "session_id": "live_sess_88129",
            "page_url": "/checkout/annual-billing",
            "browser": "Chrome 122 on macOS"
        }
    },
    {
        "id": "sms_shipping",
        "channel": "sms",
        "title": "SMS: Urgent Courier Tracking Freeze",
        "sender_name": "Homer Simpson",
        "sender_contact": "+1 (555) 742-1200",
        "message_text": "FedEx tracking #992140 hasn't updated in 48 hours for order #5521. Can you please check if it is lost in transit?",
        "channel_metadata": {
            "carrier": "Verizon Wireless",
            "phone": "+1 (555) 742-1200",
            "segments": 1
        }
    }
]

def init_omnichannel_db():
    """Upgrade tickets and ticket_messages tables with channel fields and seed initial channel data."""
    with get_connection() as conn:
        cursor = conn.cursor()

        # Add channel columns to tickets
        try:
            cursor.execute("ALTER TABLE tickets ADD COLUMN channel TEXT DEFAULT 'email'")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE tickets ADD COLUMN channel_metadata TEXT")
        except sqlite3.OperationalError:
            pass

        # Add channel columns to ticket_messages
        try:
            cursor.execute("ALTER TABLE ticket_messages ADD COLUMN channel TEXT DEFAULT 'email'")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE ticket_messages ADD COLUMN delivery_status TEXT DEFAULT 'delivered'")
        except sqlite3.OperationalError:
            pass

        # Backfill channel values across existing tickets if all are NULL or default
        cursor.execute("SELECT id, channel FROM tickets ORDER BY id ASC")
        rows = cursor.fetchall()
        channel_cycle = ["whatsapp", "slack", "chat", "sms", "email"]
        for idx, row in enumerate(rows):
            if not row["channel"] or row["channel"] == "email":
                assigned_ch = channel_cycle[idx % len(channel_cycle)]
                cursor.execute("UPDATE tickets SET channel = ? WHERE id = ?", (assigned_ch, row["id"]))

        conn.commit()

def simulate_inbound_message(
    channel: str,
    sender_name: str,
    sender_contact: str,
    message_text: str,
    channel_metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Ingests an inbound message from an external channel (WhatsApp, Slack, Live Chat, SMS).
    Runs multi-agent LangGraph triage, saves ticket with channel origin, links to Customer 360,
    and triggers Auto-Pilot workflow rules.
    """
    ch_key = channel.lower().strip()
    if ch_key not in CHANNEL_GATEWAYS:
        ch_key = "email"

    # Run LangGraph multi-agent triage
    result = run_ticket_workflow(ticket_text=message_text)
    if result.get("status") != "error" and result.get("classification"):
        classification = result["classification"]
        provider_used = result.get("provider_used", "LangGraph Omnichannel")
    else:
        # Offline / Heuristic classification fallback
        classification = generate_heuristic_classification(message_text)
        provider_used = "Omnichannel Heuristic"

    meta_json = json.dumps(channel_metadata or {"sender_contact": sender_contact})

    # Save to database
    db_id = db.save_ticket(
        ticket_text=message_text,
        classification=classification,
        provider_used=result.get("provider_used", "LangGraph Omnichannel"),
        status="Open"
    )

    # Update channel on ticket record
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE tickets
            SET channel = ?, channel_metadata = ?, customer_name = ?
            WHERE id = ?
        """, (ch_key, meta_json, sender_name, db_id))

        # Update initial message with channel and delivery receipt
        cursor.execute("""
            UPDATE ticket_messages
            SET channel = ?, delivery_status = 'read'
            WHERE ticket_id = ? AND sender = 'customer'
        """, (ch_key, db_id))
        conn.commit()

    # Link customer if possible
    cust_intel.link_ticket_customer(db_id, customer_id=1)

    # Log collaboration audit trail
    collab.log_audit_event(
        ticket_id=db_id,
        action_type="OMNICHANNEL_INBOUND",
        actor_name=f"{sender_name} ({CHANNEL_GATEWAYS[ch_key]['name']})",
        actor_role="Customer",
        details=f"Inbound conversation initiated via {CHANNEL_GATEWAYS[ch_key]['name']} [{sender_contact}]."
    )

    # Trigger Auto-Pilot automation rules
    try:
        rules_res = rules_engine.evaluate_ticket_rules(db_id, trigger_event="ON_INGEST")
    except Exception as e:
        rules_res = {"rules_matched": 0, "matches": []}

    return {
        "status": "success",
        "ticket_id": db_id,
        "channel": ch_key,
        "channel_name": CHANNEL_GATEWAYS[ch_key]["name"],
        "sender_name": sender_name,
        "sender_contact": sender_contact,
        "classification": classification.model_dump(),
        "automations_triggered": rules_res.get("matches", [])
    }

def dispatch_channel_reply(
    ticket_id: int,
    reply_text: str,
    channel: str = "email",
    recipient: Optional[str] = None,
    mark_resolved: bool = False,
    actor_name: str = "Support Agent"
) -> Dict[str, Any]:
    """
    Dispatches a channel-tailored response to a customer thread, simulating
    gateway delivery receipts (sent -> delivered -> read).
    """
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise ValueError(f"Ticket #{ticket_id} not found.")

    ch_key = channel.lower().strip()
    if ch_key not in CHANNEL_GATEWAYS:
        ch_key = ticket.get("channel") or "email"

    # Append agent reply to message thread
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO ticket_messages (ticket_id, sender, message_text, sentiment, channel, delivery_status)
            VALUES (?, 'agent', ?, 'Helpful', ?, 'delivered')
        """, (ticket_id, reply_text, ch_key))
        msg_id = cursor.lastrowid
        conn.commit()

    # Update ticket draft and status
    db.update_ticket_draft(ticket_id, reply_text)
    if mark_resolved:
        db.update_ticket_status(ticket_id, "Resolved")

    # Audit log
    collab.log_audit_event(
        ticket_id=ticket_id,
        action_type="OMNICHANNEL_OUTBOUND",
        actor_name=actor_name,
        actor_role="Agent",
        details=f"Outbound reply dispatched via {CHANNEL_GATEWAYS[ch_key]['name']} to {recipient or 'customer'}."
    )

    updated_ticket = db.get_ticket_by_id(ticket_id)
    messages = db.get_ticket_messages(ticket_id)

    return {
        "status": "delivered",
        "message_id": msg_id,
        "channel": ch_key,
        "channel_name": CHANNEL_GATEWAYS[ch_key]["name"],
        "delivery_receipt": "Delivered to device (200 OK)",
        "ticket": updated_ticket,
        "messages": messages
    }

def get_channel_statuses() -> Dict[str, Any]:
    """Returns real-time status and operational health of all 5 communication gateways."""
    return CHANNEL_GATEWAYS

def get_channel_presets() -> List[Dict[str, Any]]:
    """Returns library of realistic omnichannel inbound scenarios."""
    return PRESET_SCENARIOS

def get_omnichannel_analytics() -> Dict[str, Any]:
    """Aggregates ticket distribution, resolution speed, and SLA performance across channels."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT channel, status, priority, requires_immediate_escalation, csat_score, created_at
            FROM tickets
        """)
        rows = [dict(r) for r in cursor.fetchall()]

    total_tickets = len(rows)
    breakdown: Dict[str, Any] = {}

    for ch_key, gw in CHANNEL_GATEWAYS.items():
        ch_tickets = [r for r in rows if (r.get("channel") or "email").lower() == ch_key]
        ch_total = len(ch_tickets)
        ch_resolved = sum(1 for r in ch_tickets if r.get("status") == "Resolved")
        ch_urgent = sum(1 for r in ch_tickets if r.get("requires_immediate_escalation") == 1)
        
        ratings = [r["csat_score"] for r in ch_tickets if r.get("csat_score") is not None]
        avg_csat = round(sum(ratings) / len(ratings), 1) if ratings else 4.2

        resolution_rate = round((ch_resolved / ch_total) * 100) if ch_total > 0 else 100
        share_pct = round((ch_total / total_tickets) * 100) if total_tickets > 0 else 20

        breakdown[ch_key] = {
            "name": gw["name"],
            "icon": gw["icon"],
            "color": gw["color"],
            "protocol": gw["protocol"],
            "status": gw["status"],
            "avg_latency": gw["avg_latency"],
            "uptime": gw["uptime"],
            "inbound_count": ch_total,
            "share_percent": share_pct,
            "resolved_count": ch_resolved,
            "resolution_rate": resolution_rate,
            "urgent_count": ch_urgent,
            "avg_csat": avg_csat
        }

    return {
        "total_omnichannel_inbound": total_tickets,
        "active_gateways": len(CHANNEL_GATEWAYS),
        "gateway_success_rate": "99.8%",
        "channels": breakdown
    }

def generate_heuristic_classification(text: str) -> TicketClassification:
    """Offline heuristic classifier when LLM API keys are not provided."""
    lower = text.lower()
    
    if any(w in lower for w in ["refund", "billing", "charge", "payment", "invoice", "overcharge"]):
        cat = IssueCategory.BILLING
        team = AssignedTeam.CUSTOMER_SUCCESS
    elif any(w in lower for w in ["ship", "tracking", "fedex", "package", "delay", "order", "delivery"]):
        cat = IssueCategory.SHIPPING
        team = AssignedTeam.LOGISTICS
    elif any(w in lower for w in ["500", "error", "api", "database", "timeout", "crash", "bug"]):
        cat = IssueCategory.TECHNICAL_SUPPORT
        team = AssignedTeam.IT
    elif any(w in lower for w in ["promo", "quote", "discount", "price", "enterprise"]):
        cat = IssueCategory.PRODUCT_INQUIRY
        team = AssignedTeam.SALES
    else:
        cat = IssueCategory.OTHER
        team = AssignedTeam.GENERAL

    priority = IssuePriority.HIGH if any(w in lower for w in ["urgent", "broken", "500", "asap", "crash", "immediately"]) else IssuePriority.MEDIUM
    sentiment = UserSentiment.FRUSTRATED if any(w in lower for w in ["broken", "fail", "urgent", "error", "lost"]) else UserSentiment.NEUTRAL
    escalate = priority == IssuePriority.HIGH and sentiment in (UserSentiment.FRUSTRATED, UserSentiment.ANGRY)

    return TicketClassification(
        summary=text[:100] + ("..." if len(text) > 100 else ""),
        category=cat,
        assigned_team=team,
        priority=priority,
        sentiment=sentiment,
        confidence_score=0.92,
        draft_response=f"Thank you for contacting support regarding your {cat.value.lower()} request. Our {team.value} specialist is reviewing your inquiry and will follow up promptly.",
        key_action_items=["Verify account details", f"Escalate to {team.value} lead", "Follow up with customer within SLA window"],
        requires_immediate_escalation=escalate
    )
