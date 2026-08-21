import os
from typing import TypedDict, Optional
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

def triage_node(state: AgentState):
    """Classify the ticket."""
    ticket = state["ticket_text"]
    try:
        classification, provider_used = classify_ticket(
            ticket, 
            provider=state.get("provider", "Auto"),
            openai_key=state.get("openai_key"),
            gemini_key=state.get("gemini_key")
        )
        return {"classification": classification, "provider_used": provider_used, "status": "triaged"}
    except Exception as e:
        # Fallback in case of failure
        return {"status": "error", "draft_response": f"Error: {str(e)}"}

def research_node(state: AgentState):
    """Fetch relevant KB articles based on ticket text and category."""
    classification = state.get("classification")
    if not classification:
        return {}
    
    # Use ticket text or category for search
    query = f"{classification.category.value} {state['ticket_text']}"
    kb_context = search_kb(query)
    return {"kb_context": kb_context, "status": "researched"}

def draft_node(state: AgentState):
    """Draft a better response using KB context."""
    classification = state.get("classification")
    kb_context = state.get("kb_context", "")
    
    if not classification:
        return {}
        
    # In a real app we'd call an LLM again, but let's simulate it by appending KB context 
    # to make it faster and save tokens for this demo, or we can use OpenAI directly.
    # We will just enhance the existing draft.
    original_draft = classification.draft_response
    
    enhanced_draft = (
        f"{original_draft}\n\n"
        f"--- (AI Knowledge Base Context Applied) ---\n"
        f"Relevant Policy: {kb_context}"
    )
    
    # Modify classification object in memory
    classification.draft_response = enhanced_draft
    return {"classification": classification, "draft_response": enhanced_draft, "status": "drafted"}

def notify_node(state: AgentState):
    """Send webhook if escalation is required."""
    classification = state.get("classification")
    if classification and classification.requires_immediate_escalation:
        # Simulate webhook
        print(f"[SLACK WEBHOOK MOCK] URGENT TICKET: {classification.category.value} - {classification.summary}")
        return {"notification_sent": True, "status": "notified"}
    return {"notification_sent": False, "status": "completed"}

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
        "status": "started"
    }
    result = ticket_agent.invoke(initial_state)
    return result
