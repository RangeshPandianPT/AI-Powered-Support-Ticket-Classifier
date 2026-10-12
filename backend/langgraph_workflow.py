import os
from typing import TypedDict, Optional, List, Dict, Any
from langgraph.graph import StateGraph, END
from classifier import classify_ticket
from rag_kb import search_kb
from schema import TicketClassification

class AgentState(TypedDict):
    ticket_text: str
    provider: str
    openai_key: Optional[str]
    gemini_key: Optional[str]
    classification: Optional[TicketClassification]
    provider_used: Optional[str]
    kb_context: Optional[str]
    draft_response: Optional[str]
    notification_sent: bool
    status: str
    steps: List[Dict[str, Any]]

def triage_node(state: AgentState):
    """Classify the ticket."""
    ticket = state["ticket_text"]
    steps = list(state.get("steps", []))
    try:
        classification, provider_used = classify_ticket(
            ticket, 
            provider=state.get("provider", "Auto"),
            openai_key=state.get("openai_key"),
            gemini_key=state.get("gemini_key")
        )
        steps.append({
            "agent": "Triage Agent",
            "status": "completed",
            "summary": f"Categorized as {classification.category.value} • {classification.priority.value} Priority • {classification.sentiment.value} Sentiment",
            "details": {
                "assigned_team": classification.assigned_team.value,
                "confidence": round(float(classification.confidence_score) * 100, 1),
                "provider": provider_used,
                "summary": classification.summary
            }
        })
        return {
            "classification": classification, 
            "provider_used": provider_used, 
            "status": "triaged",
            "steps": steps
        }
    except Exception as e:
        steps.append({
            "agent": "Triage Agent",
            "status": "error",
            "summary": f"Classification failed: {str(e)}",
            "details": {"error": str(e)}
        })
        return {"status": "error", "draft_response": f"Error: {str(e)}", "steps": steps}

def research_node(state: AgentState):
    """Fetch relevant KB articles based on ticket text and category."""
    classification = state.get("classification")
    steps = list(state.get("steps", []))
    if state.get("status") == "error" or not classification:
        return {"status": "error", "steps": steps}
    
    # Use ticket text or category for search
    query = f"{classification.category.value} {state['ticket_text']}"
    kb_context = search_kb(query)
    
    has_policy = "No relevant information found" not in kb_context
    steps.append({
        "agent": "RAG Knowledge Agent",
        "status": "completed",
        "summary": "Retrieved matching knowledge base documentation" if has_policy else "Queried KB (standard FAQ fallback)",
        "details": {
            "query": classification.category.value,
            "kb_context": kb_context[:160] + "..." if len(kb_context) > 160 else kb_context
        }
    })
    return {"kb_context": kb_context, "status": "researched", "steps": steps}

def draft_node(state: AgentState):
    """Draft a better response using KB context."""
    classification = state.get("classification")
    kb_context = state.get("kb_context", "")
    steps = list(state.get("steps", []))
    
    if state.get("status") == "error" or not classification:
        return {"status": "error", "steps": steps}
        
    original_draft = classification.draft_response
    
    if kb_context and "No relevant information found" not in kb_context:
        enhanced_draft = (
            f"{original_draft}\n\n"
            f"--- (AI Knowledge Base Policy Applied) ---\n"
            f"Relevant Policy: {kb_context}"
        )
    else:
        enhanced_draft = original_draft
    
    classification.draft_response = enhanced_draft
    steps.append({
        "agent": "Response Drafter Agent",
        "status": "completed",
        "summary": "Synthesized empathetic draft response with policy context",
        "details": {
            "action_items_count": len(classification.key_action_items),
            "action_items": classification.key_action_items
        }
    })
    return {"classification": classification, "draft_response": enhanced_draft, "status": "drafted", "steps": steps}

import urllib.request
import json

def notify_node(state: AgentState):
    """Send webhook if escalation is required."""
    classification = state.get("classification")
    steps = list(state.get("steps", []))
    notification_sent = False
    
    if state.get("status") == "error" or not classification:
        return {"notification_sent": False, "status": "error", "steps": steps}
    
    if classification.requires_immediate_escalation:
        webhook_url = os.getenv("SLACK_WEBHOOK_URL")
        message = f"🚨 *URGENT TICKET ESCALATION* 🚨\n*Category:* {classification.category.value}\n*Summary:* {classification.summary}\n*Sentiment:* {classification.sentiment.value} (Confidence: {int(classification.confidence_score * 100)}%)"
        
        if webhook_url:
            try:
                data = json.dumps({"text": message}).encode("utf-8")
                req = urllib.request.Request(webhook_url, data=data, headers={"Content-Type": "application/json"})
                urllib.request.urlopen(req)
                print(f"[SLACK WEBHOOK] Sent urgent alert to Slack.")
                notification_sent = True
            except Exception as e:
                print(f"[SLACK WEBHOOK] Failed to send alert: {e}")
        else:
            print(f"[SLACK WEBHOOK MOCK] URGENT TICKET: {classification.category.value} - {classification.summary}")
            notification_sent = True
            
        steps.append({
            "agent": "Escalation Sentinel",
            "status": "escalated",
            "summary": "Urgent escalation flagged: Slack webhook dispatched",
            "details": {
                "escalated": True,
                "reason": f"High priority ticket with {classification.sentiment.value} customer sentiment"
            }
        })
        return {"notification_sent": notification_sent, "status": "notified", "steps": steps}
        
    steps.append({
        "agent": "Escalation Sentinel",
        "status": "normal",
        "summary": "Standard routing: Ticket queued for normal SLA handling",
        "details": {
            "escalated": False,
            "assigned_team": classification.assigned_team.value if classification else "General"
        }
    })
    return {"notification_sent": False, "status": "completed", "steps": steps}

def build_workflow():
    workflow = StateGraph(AgentState)
    
    workflow.add_node("triage", triage_node)
    workflow.add_node("research", research_node)
    workflow.add_node("draft", draft_node)
    workflow.add_node("notify", notify_node)
    
    workflow.set_entry_point("triage")
    workflow.add_edge("triage", "research")
    workflow.add_edge("research", "draft")
    workflow.add_edge("draft", "notify")
    workflow.add_edge("notify", END)
    
    return workflow.compile()

# Singleton graph
ticket_agent = build_workflow()

def run_ticket_workflow(ticket_text: str, provider="Auto", openai_key=None, gemini_key=None):
    initial_state = {
        "ticket_text": ticket_text,
        "provider": provider,
        "openai_key": openai_key,
        "gemini_key": gemini_key,
        "notification_sent": False,
        "status": "started",
        "steps": []
    }
    result = ticket_agent.invoke(initial_state)
    return result
