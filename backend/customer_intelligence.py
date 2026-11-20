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

def init_customer_db():
    """Initialize customer profiles, churn scoring, and link with tickets."""
    with get_connection() as conn:
        cursor = conn.cursor()

        # Add customer tracking columns to tickets table if missing
        try:
            cursor.execute("ALTER TABLE tickets ADD COLUMN customer_id INTEGER")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE tickets ADD COLUMN customer_name TEXT")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE tickets ADD COLUMN customer_email TEXT")
        except sqlite3.OperationalError:
            pass

        # Customers Master Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                company TEXT,
                tier TEXT DEFAULT 'Standard', -- 'VIP Enterprise', 'Pro', 'Standard', 'Free'
                mrr REAL DEFAULT 299.0,
                account_manager TEXT DEFAULT 'Priya Patel',
                primary_phone TEXT,
                retention_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier)")

        # Customer Activity / Engagement Logs
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS customer_activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL,
                activity_type TEXT NOT NULL, -- 'TICKET_CREATED', 'CSAT_SUBMITTED', 'RETENTION_OFFER', 'CALL_LOG'
                title TEXT NOT NULL,
                details TEXT,
                sentiment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_cust_act_cid ON customer_activity(customer_id)")

        # Seed default enterprise customer accounts if empty
        cursor.execute("SELECT COUNT(*) as cnt FROM customers")
        if cursor.fetchone()["cnt"] == 0:
            seed_default_customers(cursor)

        conn.commit()

def seed_default_customers(cursor):
    """Seed realistic customer accounts across tiers and link to existing tickets."""
    default_accounts = [
        {
            "name": "Sarah Connor",
            "email": "sarah.connor@cyberdyne-ai.com",
            "company": "Cyberdyne AI Systems",
            "tier": "VIP Enterprise",
            "mrr": 4500.0,
            "account_manager": "Priya Patel",
            "primary_phone": "+1 (555) 234-8901",
            "retention_notes": "Key enterprise account with 200+ seat deployment. Highly sensitive to payment and API stability."
        },
        {
            "name": "Tony Stark",
            "email": "tstark@starkindustries.io",
            "company": "Stark Industries",
            "tier": "VIP Enterprise",
            "mrr": 8200.0,
            "account_manager": "Priya Patel",
            "primary_phone": "+1 (555) 902-1144",
            "retention_notes": "Tier-1 strategic partner. Expects sub-30 minute SLA on all technical incidents."
        },
        {
            "name": "Peter Gibbons",
            "email": "peter.g@initech-corp.com",
            "company": "Initech Corporation",
            "tier": "Pro",
            "mrr": 950.0,
            "account_manager": "Sarah Chen",
            "primary_phone": "+1 (555) 438-9921",
            "retention_notes": "Mid-market accounting automation client. Experienced duplicate billing issues in Q3."
        },
        {
            "name": "Homer Simpson",
            "email": "homer.s@springfield-power.com",
            "company": "Springfield Clean Energy",
            "tier": "Standard",
            "mrr": 350.0,
            "account_manager": "Alex Rivera",
            "primary_phone": "+1 (555) 742-1200",
            "retention_notes": "Logistics and shipping tracking queries. Sensitive to order delays."
        },
        {
            "name": "Arthur Dent",
            "email": "arthur@galactic-travels.org",
            "company": "Megadodo Publications",
            "tier": "Pro",
            "mrr": 1200.0,
            "account_manager": "Elena Rostova",
            "primary_phone": "+1 (555) 424-2424",
            "retention_notes": "High renewal churn risk due to repeated refund inquiries."
        }
    ]

    cust_ids = []
    for acc in default_accounts:
        cursor.execute("""
            INSERT INTO customers (name, email, company, tier, mrr, account_manager, primary_phone, retention_notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            acc["name"], acc["email"], acc["company"], acc["tier"],
            acc["mrr"], acc["account_manager"], acc["primary_phone"], acc["retention_notes"]
        ))
        cust_ids.append(cursor.lastrowid)

    # Link existing tickets to these customer profiles
    cursor.execute("SELECT id, category, sentiment FROM tickets ORDER BY id ASC")
    tickets = cursor.fetchall()

    for idx, tkt in enumerate(tickets):
        assigned_cust_id = cust_ids[idx % len(cust_ids)]
        cust = default_accounts[idx % len(default_accounts)]
        cursor.execute("""
            UPDATE tickets
            SET customer_id = ?, customer_name = ?, customer_email = ?
            WHERE id = ?
        """, (assigned_cust_id, cust["name"], cust["email"], tkt["id"]))

        # Add initial activity log
        cursor.execute("""
            INSERT INTO customer_activity (customer_id, activity_type, title, details, sentiment)
            VALUES (?, 'TICKET_CREATED', ?, ?, ?)
        """, (
            assigned_cust_id,
            f"Ticket #{tkt['id']} Opened ({tkt['category']})",
            f"Initial sentiment identified as {tkt['sentiment'] or 'Neutral'}.",
            tkt["sentiment"]
        ))

# ==========================================
# Predictive Churn & Health Scoring Engine
# ==========================================

def calculate_customer_health(customer_id: int) -> Dict[str, Any]:
    """
    Computes comprehensive 360 metrics for a customer:
    - Churn Risk Score (0 - 100%)
    - Customer Health Score (0 - 100)
    - Lifetime Ticket Distribution & Sentiment Trajectory
    - SLA Breaches & CSAT Average
    - Risk Tier Classification ('Low', 'Moderate', 'High', 'Critical')
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
        cust = cursor.fetchone()
        if not cust:
            return {}

        cust_dict = dict(cust)

        # Fetch tickets for this customer
        cursor.execute("""
            SELECT id, summary, ticket_text, category, priority, status, sentiment, 
                   requires_immediate_escalation, csat_score, created_at
            FROM tickets
            WHERE customer_id = ? OR customer_email = ?
            ORDER BY id DESC
        """, (customer_id, cust_dict["email"]))
        tickets = [dict(t) for t in cursor.fetchall()]

        # Fetch CSAT surveys
        cursor.execute("""
            SELECT s.rating, s.feedback_tag, s.comment, s.created_at
            FROM csat_surveys s
            JOIN tickets t ON s.ticket_id = t.id
            WHERE t.customer_id = ? OR t.customer_email = ?
            ORDER BY s.created_at DESC
        """, (customer_id, cust_dict["email"]))
        csats = [dict(c) for c in cursor.fetchall()]

    total_tickets = len(tickets)
    open_tickets = sum(1 for t in tickets if t["status"] == "Open")
    resolved_tickets = sum(1 for t in tickets if t["status"] == "Resolved")
    urgent_tickets = sum(1 for t in tickets if t["requires_immediate_escalation"] == 1)
    
    frustrated_count = sum(1 for t in tickets if (t.get("sentiment") or "").lower() in ["frustrated", "angry", "urgent"])
    positive_count = sum(1 for t in tickets if (t.get("sentiment") or "").lower() in ["happy", "satisfied", "resolved", "grateful"])

    # Average CSAT
    ratings = [c["rating"] for c in csats if c.get("rating")]
    avg_csat = round(sum(ratings) / len(ratings), 1) if ratings else 4.0

    # Churn Risk Calculation
    # Base churn risk
    base_churn = 15.0

    # Frustration ratio (up to +40%)
    if total_tickets > 0:
        frustration_ratio = frustrated_count / total_tickets
        base_churn += frustration_ratio * 40.0

    # Low CSAT penalty
    if avg_csat <= 2.0:
        base_churn += 30.0
    elif avg_csat <= 3.0:
        base_churn += 18.0

    # Urgent escalation penalty
    base_churn += urgent_tickets * 12.0

    # Tier sensitivity modifier (VIPs expect pristine service)
    if cust_dict["tier"] == "VIP Enterprise":
        base_churn += 10.0 if frustrated_count > 0 else -5.0
    elif cust_dict["tier"] == "Free":
        base_churn -= 5.0

    # Positive sentiment bonus
    if positive_count > 0:
        base_churn -= min(20.0, positive_count * 8.0)

    # Bound churn risk between 5% and 98%
    churn_risk = max(5, min(98, round(base_churn)))
    health_score = max(5, min(100, 100 - churn_risk))

    # Risk Tier Categorization
    if churn_risk >= 70:
        risk_tier = "Critical Risk"
        risk_color = "#ef4444"
    elif churn_risk >= 45:
        risk_tier = "High Risk"
        risk_color = "#f97316"
    elif churn_risk >= 25:
        risk_tier = "Moderate Risk"
        risk_color = "#eab308"
    else:
        risk_tier = "Healthy"
        risk_color = "#10b981"

    # Recent Sentiment Trajectory (chronological order)
    chronological_tickets = list(reversed(tickets))
    sentiment_history = [
        {"id": t["id"], "sentiment": t.get("sentiment") or "Neutral", "category": t["category"], "date": t["created_at"][:10]}
        for t in chronological_tickets[-6:]
    ]

    return {
        **cust_dict,
        "total_tickets": total_tickets,
        "open_tickets": open_tickets,
        "resolved_tickets": resolved_tickets,
        "urgent_tickets": urgent_tickets,
        "frustrated_tickets": frustrated_count,
        "avg_csat": avg_csat,
        "churn_risk": churn_risk,
        "health_score": health_score,
        "risk_tier": risk_tier,
        "risk_color": risk_color,
        "recent_tickets": tickets[:5],
        "sentiment_history": sentiment_history
    }

def get_all_customers(tier_filter: str = "All", risk_filter: str = "All", search: str = "") -> List[Dict[str, Any]]:
    """Retrieve all customer accounts enriched with dynamic churn risk and health metrics."""
    with get_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT id FROM customers WHERE 1=1"
        params = []

        if tier_filter != "All":
            query += " AND tier = ?"
            params.append(tier_filter)

        if search:
            query += " AND (name LIKE ? OR company LIKE ? OR email LIKE ?)"
            s_param = f"%{search}%"
            params.extend([s_param, s_param, s_param])

        query += " ORDER BY id ASC"
        cursor.execute(query, params)
        customer_ids = [r["id"] for r in cursor.fetchall()]

    enriched = []
    for cid in customer_ids:
        metrics = calculate_customer_health(cid)
        if not metrics:
            continue

        if risk_filter != "All":
            if risk_filter == "Critical" and metrics["risk_tier"] != "Critical Risk":
                continue
            if risk_filter == "High" and metrics["risk_tier"] != "High Risk":
                continue
            if risk_filter == "Healthy" and metrics["risk_tier"] != "Healthy":
                continue

        enriched.append(metrics)

    # Sort high churn risk to the top
    enriched.sort(key=lambda x: x["churn_risk"], reverse=True)
    return enriched

def get_customer_by_id(customer_id: int) -> Optional[Dict[str, Any]]:
    """Get full Customer 360 profile with complete tickets and activity timeline."""
    profile = calculate_customer_health(customer_id)
    if not profile:
        return None

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM customer_activity
            WHERE customer_id = ?
            ORDER BY created_at DESC
            LIMIT 20
        """, (customer_id,))
        profile["activity_log"] = [dict(r) for r in cursor.fetchall()]

    return profile

def get_customer_for_ticket(ticket_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve the Customer 360 record linked to a specific ticket."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT customer_id, customer_email FROM tickets WHERE id = ?", (ticket_id,))
        tkt = cursor.fetchone()
        if not tkt:
            return None

        cid = tkt["customer_id"]
        cemail = tkt["customer_email"]

        if not cid and cemail:
            cursor.execute("SELECT id FROM customers WHERE email = ?", (cemail,))
            match = cursor.fetchone()
            if match:
                cid = match["id"]
                cursor.execute("UPDATE tickets SET customer_id = ? WHERE id = ?", (cid, ticket_id))
                conn.commit()

        if not cid:
            # Fallback to first seeded customer for demonstration
            cursor.execute("SELECT id FROM customers LIMIT 1")
            first = cursor.fetchone()
            if first:
                cid = first["id"]
                cursor.execute("UPDATE tickets SET customer_id = ? WHERE id = ?", (cid, ticket_id))
                conn.commit()

    if cid:
        return get_customer_by_id(cid)
    return None

def link_ticket_customer(ticket_id: int, customer_id: int) -> bool:
    """Explicitly associate a ticket with a customer account."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name, email FROM customers WHERE id = ?", (customer_id,))
        cust = cursor.fetchone()
        if not cust:
            return False

        cursor.execute("""
            UPDATE tickets
            SET customer_id = ?, customer_name = ?, customer_email = ?
            WHERE id = ?
        """, (customer_id, cust["name"], cust["email"], ticket_id))
        conn.commit()

        collab.log_audit_event(
            ticket_id=ticket_id,
            action_type="CUSTOMER_LINKED",
            actor_name="Customer 360",
            actor_role="System",
            details=f"Associated with Customer Account: {cust['name']} ({cust['email']})"
        )
        return True

# ==========================================
# AI Retention Strategy & Playbook Generator
# ==========================================

def generate_retention_playbook(customer_id: int) -> Dict[str, Any]:
    """
    Synthesize an AI-backed churn mitigation strategy, talking points,
    and recommended concession budget for support leads.
    """
    cust = get_customer_by_id(customer_id)
    if not cust:
        raise ValueError(f"Customer #{customer_id} not found.")

    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    recent_issues = [
        f"- Ticket #{t['id']} ({t['category']}): \"{t['summary'] or t['ticket_text'][:80]}\" [Sentiment: {t['sentiment']}]"
        for t in cust.get("recent_tickets", [])[:4]
    ]
    issues_summary = "\n".join(recent_issues) if recent_issues else "No recent complaints."

    prompt = (
        "You are an Executive Customer Retention & Success Strategist.\n"
        f"A customer account is currently at {cust['churn_risk']}% Churn Risk ({cust['risk_tier']}).\n\n"
        f"Customer Dossier:\n"
        f"- Name: {cust['name']} | Company: {cust['company']}\n"
        f"- Subscription Tier: {cust['tier']} | Monthly Recurring Revenue: ${cust['mrr']:,.2f}\n"
        f"- Average CSAT: {cust['avg_csat']} / 5.0 | Total Tickets: {cust['total_tickets']}\n"
        f"- Account Manager: {cust['account_manager']}\n\n"
        f"Recent Support Pain Points:\n{issues_summary}\n\n"
        "Generate a structured retention playbook in valid JSON format:\n"
        "{\n"
        "  \"recommended_action\": \"Concise headline recommendation\",\n"
        "  \"urgency\": \"Immediate (<2 hours)\" | \"Today (<8 hours)\" | \"Standard Routine\",\n"
        "  \"concession_offer\": \"Specific suggested compensation or credit (e.g. $100 service credit, free tier upgrade for 1 month)\",\n"
        "  \"talking_points\": [\"point 1\", \"point 2\", \"point 3\"],\n"
        "  \"outreach_email_draft\": \"Empathetic executive outreach email from account manager to customer\"\n"
        "}"
    )

    if openai_key:
        try:
            client = OpenAI(api_key=openai_key)
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a customer retention AI. Output only JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            raw = json.loads(completion.choices[0].message.content)
            return log_retention_action(customer_id, raw)
        except Exception as e:
            print(f"[OpenAI Retention Error]: {e}")

    if gemini_key:
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
            return log_retention_action(customer_id, raw)
        except Exception as e:
            print(f"[Gemini Retention Error]: {e}")

    # Offline / Heuristic Retention Playbook
    fallback = generate_heuristic_retention(cust)
    return log_retention_action(customer_id, fallback)

def generate_heuristic_retention(cust: Dict[str, Any]) -> Dict[str, Any]:
    """Offline heuristic retention playbook tailored by account tier and pain points."""
    tier = cust.get("tier", "Standard")
    mrr = cust.get("mrr", 299.0)
    risk = cust.get("churn_risk", 50)

    if tier == "VIP Enterprise" or mrr >= 2500:
        return {
            "recommended_action": f"Executive Account Manager Review & Priority Engineering On-Call Assignee",
            "urgency": "Immediate (<2 hours)",
            "concession_offer": f"Grant 25% courtesy invoice credit (${round(mrr * 0.25):,.0f}) + complimentary VIP SLA escalation coverage for 60 days.",
            "talking_points": [
                f"Acknowledge recurring friction on their deployment and apologize on behalf of executive leadership.",
                "Detail concrete platform safeguards and root-cause fixes already deployed to eliminate duplicate issues.",
                "Offer a direct 1-on-1 monthly sync between their technical leads and our VP of Customer Experience."
            ],
            "outreach_email_draft": (
                f"Subject: Important Update Regarding Your Account with AutoDesk AI\n\n"
                f"Hi {cust['name'].split()[0]},\n\n"
                f"I am personally reviewing your recent support cases regarding {cust['company']}. We hold our service to the highest enterprise standards, and your experience fell short of our commitment to you.\n\n"
                f"I have applied an immediate courtesy credit of ${round(mrr * 0.25):,.0f} to your upcoming billing cycle and assigned Dev On-Call liaison monitoring to your account. I would welcome 15 minutes of your time this week to review our fixes and answer any questions.\n\n"
                f"Warm regards,\n{cust.get('account_manager', 'Priya Patel')}\nCustomer Success Leadership"
            )
        }
    elif tier == "Pro":
        return {
            "recommended_action": "Proactive Health Check-in & Complimentary Feature Add-on Waiver",
            "urgency": "Today (<8 hours)",
            "concession_offer": f"Provide $75 billing credit + 1 month free access to Advanced Automation Rules.",
            "talking_points": [
                "Express appreciation for their ongoing business and acknowledge the inconvenience faced.",
                "Confirm that all reported ticket items have been escalated and are being tracked to completion.",
                "Highlight upcoming feature releases designed specifically to resolve their workflow bottlenecks."
            ],
            "outreach_email_draft": (
                f"Subject: Checking in on your recent support experience\n\n"
                f"Hi {cust['name'].split()[0]},\n\n"
                f"I wanted to reach out directly to make sure your recent issues with {cust['company']} have been fully resolved to your satisfaction. To thank you for your patience, we've credited $75 to your next invoice.\n\n"
                f"Please let me know if you need any further assistance—we are here to help.\n\n"
                f"Best,\n{cust.get('account_manager', 'Support Team')}"
            )
        }
    else:
        return {
            "recommended_action": "Resolution Confirmation & Customer Delight Guarantee",
            "urgency": "Standard Routine",
            "concession_offer": "Offer $25 discount code on next order or renewal + priority queue routing.",
            "talking_points": [
                "Reassure customer that their feedback has been logged directly with our operations team.",
                "Provide clear step-by-step guidance on how to avoid similar issues in future orders.",
                "Invite feedback to help improve future support interactions."
            ],
            "outreach_email_draft": (
                f"Subject: How did we do? Here is an update on your support request\n\n"
                f"Hi {cust['name'].split()[0]},\n\n"
                f"We want to ensure your recent questions have been completely answered. As a token of our appreciation for your business, please use promo code LOYAL25 for $25 off your next renewal.\n\n"
                f"Thank you for choosing AutoDesk AI!\n\n"
                f"Sincerely,\n{cust.get('account_manager', 'Customer Support')}"
            )
        }

def log_retention_action(customer_id: int, playbook: Dict[str, Any]) -> Dict[str, Any]:
    """Save retention playbook to customer activity timeline."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO customer_activity (customer_id, activity_type, title, details, sentiment)
            VALUES (?, 'RETENTION_OFFER', ?, ?, 'Proactive')
        """, (
            customer_id,
            f"AI Retention Playbook Generated: {playbook.get('recommended_action', 'Offer Drafted')}",
            f"Concession: {playbook.get('concession_offer')} | Urgency: {playbook.get('urgency')}"
        ))
        conn.commit()
    return playbook
