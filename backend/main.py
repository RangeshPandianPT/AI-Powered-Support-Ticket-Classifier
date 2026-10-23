from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import io
import csv

from database import get_all_tickets, save_ticket, update_ticket_status, delete_ticket, get_analytics_summary
from langgraph_workflow import run_ticket_workflow
from email_ingestion import check_new_emails
from classifier import rewrite_draft_llm, copilot_chat_llm, simulate_customer_reply_llm, reclassify_conversation_thread
from rag_kb import get_all_kb_docs, add_to_kb, delete_from_kb, search_kb
from pypdf import PdfReader
import database as db
import collaboration as collab
import qa_and_macros as qam

app = FastAPI(title="AI Support Intelligence API")

# Setup CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB and collaboration tables
db.init_db()
collab.init_collaboration_db()
qam.init_qa_db()

class QAAuditRequest(BaseModel):
    draft_text: str

class CSATSubmitRequest(BaseModel):
    rating: int
    feedback_tag: str = "Fast Resolution"
    comment: str = ""
    customer_name: str = "Customer"

class PortalDeflectRequest(BaseModel):
    query: str

class TicketRequest(BaseModel):
    ticket_text: str
    provider: str = "Auto"
    openai_key: Optional[str] = None
    gemini_key: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str
    actor_name: str = "Agent"

class DraftUpdate(BaseModel):
    draft_response: str

class RewriteRequest(BaseModel):
    tone_instruction: str

class CopilotRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = None

class SendReplyRequest(BaseModel):
    reply_text: str
    customer_email: Optional[str] = None
    mark_resolved: bool = True

class MessageCreateRequest(BaseModel):
    sender: str = "customer"
    message_text: str
    sentiment: Optional[str] = None

class SimulateReplyRequest(BaseModel):
    persona: str = "dynamic"

class AssignTicketRequest(BaseModel):
    assignee_name: str
    assignee_email: Optional[str] = None
    actor_name: str = "Support Lead"

class InternalNoteCreateRequest(BaseModel):
    author_name: str
    note_text: str
    author_role: str = "Support Agent"
    note_type: str = "internal"
    tags: Optional[List[str]] = None
    is_pinned: bool = False

@app.post("/api/tickets/classify")
def classify_ticket_endpoint(req: TicketRequest):
    try:
        # Run the full LangGraph workflow
        result = run_ticket_workflow(
            ticket_text=req.ticket_text,
            provider=req.provider,
            openai_key=req.openai_key,
            gemini_key=req.gemini_key
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result.get("draft_response", "Unknown error"))
            
        classification = result["classification"]
        
        # Save to DB
        db_id = save_ticket(
            ticket_text=req.ticket_text, 
            classification=classification, 
            provider_used=result["provider_used"], 
            status="Open"
        )

        collab.log_audit_event(
            ticket_id=db_id,
            action_type="CREATED",
            actor_name="LangGraph Triage Agent",
            actor_role="AI System",
            details=f"Ticket ingested and categorized as {classification.category.value} ({classification.priority.value} Priority)"
        )
        
        return {
            "id": db_id,
            "classification": classification.model_dump(),
            "provider_used": result["provider_used"],
            "kb_context_used": result.get("kb_context"),
            "notification_sent": result.get("notification_sent"),
            "steps": result.get("steps", [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tickets")
def list_ticketsEndpoint(
    status: str = "All", 
    team: str = "All", 
    priority: str = "All",
    search: Optional[str] = None
):
    return get_all_tickets(status, team, priority, search)

@app.get("/api/tickets/{ticket_id}")
def get_ticket_endpoint(ticket_id: int):
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@app.get("/api/analytics")
def analytics_endpoint():
    return get_analytics_summary()

@app.put("/api/tickets/{ticket_id}/status")
def update_status_endpoint(ticket_id: int, req: StatusUpdate):
    prev = db.get_ticket_by_id(ticket_id)
    old_status = prev.get("status") if prev else "Unknown"
    update_ticket_status(ticket_id, req.status)
    collab.log_audit_event(
        ticket_id=ticket_id,
        action_type="STATUS_CHANGE",
        actor_name=req.actor_name,
        details=f"Ticket status changed from '{old_status}' to '{req.status}'",
        old_value=old_status,
        new_value=req.status
    )
    return {"message": "Status updated successfully"}

@app.put("/api/tickets/{ticket_id}/draft")
def update_draft_endpoint(ticket_id: int, req: DraftUpdate):
    success = db.update_ticket_draft(ticket_id, req.draft_response)
    if not success:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"message": "Draft updated successfully"}

@app.post("/api/tickets/{ticket_id}/rewrite-draft")
def rewrite_draft_endpoint(ticket_id: int, req: RewriteRequest):
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    revised = rewrite_draft_llm(
        ticket_text=ticket["ticket_text"],
        current_draft=ticket.get("draft_response") or "",
        tone_instruction=req.tone_instruction
    )
    return {"revised_draft": revised}

@app.post("/api/tickets/{ticket_id}/copilot")
def copilot_endpoint(ticket_id: int, req: CopilotRequest):
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    kb_context = search_kb(f"{ticket['category']} {ticket['ticket_text']}", n_results=1)
    
    reply = copilot_chat_llm(
        ticket_context=ticket,
        user_message=req.message,
        history=req.history,
        kb_context=kb_context
    )
    return {"reply": reply}

@app.get("/api/tickets/{ticket_id}/messages")
def get_ticket_messages_endpoint(ticket_id: int):
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    messages = db.get_ticket_messages(ticket_id)
    return messages

@app.post("/api/tickets/{ticket_id}/messages")
def add_ticket_message_endpoint(ticket_id: int, req: MessageCreateRequest):
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    msg_id = db.add_ticket_message(ticket_id, req.sender, req.message_text, req.sentiment)
    messages = db.get_ticket_messages(ticket_id)
    return {"id": msg_id, "messages": messages}

@app.post("/api/tickets/{ticket_id}/simulate-reply")
def simulate_reply_endpoint(ticket_id: int, req: SimulateReplyRequest):
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    existing_messages = db.get_ticket_messages(ticket_id)
    simulated = simulate_customer_reply_llm(
        ticket_context=ticket,
        message_history=existing_messages,
        persona=req.persona
    )
    
    # Record customer reply into thread
    db.add_ticket_message(
        ticket_id=ticket_id,
        sender="customer",
        message_text=simulated["message"],
        sentiment=simulated["sentiment"]
    )
    
    # Re-evaluate thread sentiment and draft
    updated_messages = db.get_ticket_messages(ticket_id)
    triage_update = reclassify_conversation_thread(ticket, updated_messages)
    
    db.update_ticket_conversation(
        ticket_id=ticket_id,
        sentiment=triage_update["sentiment"],
        draft_response=triage_update["draft_response"],
        requires_immediate_escalation=triage_update["requires_immediate_escalation"],
        status=triage_update["status"]
    )
    
    collab.log_audit_event(
        ticket_id=ticket_id,
        action_type="CUSTOMER_REPLY",
        actor_name="Customer",
        details=f"Inbound message received via {req.persona} simulation"
    )

    updated_ticket = db.get_ticket_by_id(ticket_id)
    return {
        "simulated_reply": simulated,
        "triage_update": triage_update,
        "messages": updated_messages,
        "ticket": updated_ticket
    }

@app.post("/api/tickets/{ticket_id}/reply")
def send_reply_endpoint(ticket_id: int, req: SendReplyRequest):
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Append outbound agent reply to the conversation thread
    db.add_ticket_message(
        ticket_id=ticket_id,
        sender="agent",
        message_text=req.reply_text,
        sentiment="Helpful"
    )
    
    # Update draft response in database
    db.update_ticket_draft(ticket_id, req.reply_text)
    
    if req.mark_resolved:
        db.update_ticket_status(ticket_id, "Resolved")

    collab.log_audit_event(
        ticket_id=ticket_id,
        action_type="DRAFT_SENT",
        actor_name="Support Agent",
        details=f"Outbound reply dispatched to customer ({'Marked Resolved' if req.mark_resolved else 'Kept In Progress'})"
    )
        
    updated_ticket = db.get_ticket_by_id(ticket_id)
    messages = db.get_ticket_messages(ticket_id)
    
    return {
        "status": "sent",
        "message": f"Customer reply dispatched successfully for Ticket #{ticket_id}",
        "recipient": req.customer_email or "customer@example.com",
        "ticket": updated_ticket,
        "messages": messages
    }

@app.delete("/api/tickets/{ticket_id}")
def delete_ticket_endpoint(ticket_id: int):
    delete_ticket(ticket_id)
    return {"message": "Ticket deleted successfully"}

# ==========================================
# Team Collaboration & Internal Notes API
# ==========================================

@app.get("/api/team/workload")
def get_team_workload_endpoint():
    return collab.get_team_workload_summary()

@app.get("/api/team/members")
def get_team_members_endpoint():
    return collab.get_team_members()

@app.put("/api/tickets/{ticket_id}/assign")
def assign_ticket_endpoint(ticket_id: int, req: AssignTicketRequest):
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    result = collab.assign_ticket_to_agent(
        ticket_id=ticket_id,
        assignee_name=req.assignee_name,
        assignee_email=req.assignee_email,
        actor_name=req.actor_name
    )
    return result

@app.post("/api/tickets/{ticket_id}/auto-assign")
def auto_assign_ticket_endpoint(ticket_id: int):
    try:
        return collab.auto_assign_ticket_ai(ticket_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tickets/{ticket_id}/notes")
def get_internal_notes_endpoint(ticket_id: int):
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return collab.get_internal_notes(ticket_id)

@app.post("/api/tickets/{ticket_id}/notes")
def add_internal_note_endpoint(ticket_id: int, req: InternalNoteCreateRequest):
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    note = collab.add_internal_note(
        ticket_id=ticket_id,
        author_name=req.author_name,
        author_role=req.author_role,
        note_text=req.note_text,
        note_type=req.note_type,
        tags=req.tags,
        is_pinned=req.is_pinned
    )
    return note

@app.delete("/api/tickets/notes/{note_id}")
def delete_internal_note_endpoint(note_id: int):
    success = collab.delete_internal_note(note_id)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Internal note deleted successfully"}

@app.post("/api/tickets/notes/{note_id}/pin")
def toggle_pin_note_endpoint(note_id: int):
    new_pinned = collab.toggle_pin_internal_note(note_id)
    if new_pinned is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Pin status updated", "is_pinned": new_pinned}

@app.post("/api/tickets/{ticket_id}/generate-handover")
def generate_handover_endpoint(ticket_id: int):
    try:
        return collab.generate_ai_shift_handover(ticket_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tickets/{ticket_id}/audit-logs")
def get_audit_logs_endpoint(ticket_id: int):
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return collab.get_ticket_audit_logs(ticket_id)

@app.post("/api/email/ingest")
def ingest_emails_endpoint(background_tasks: BackgroundTasks):
    """Trigger email ingestion manually."""
    emails = check_new_emails()
    results = []
    
    for email in emails:
        # Run workflow
        res = run_ticket_workflow(email["body"])
        if res.get("status") != "error" and res.get("classification"):
            cls = res["classification"]
            # Save to DB
            db_id = save_ticket(
                ticket_text=email["body"], 
                classification=cls, 
                provider_used=res.get("provider_used", "Auto"), 
                status="Open"
            )
            results.append({"email_id": email["id"], "db_id": db_id, "status": "Success"})
        else:
            results.append({"email_id": email["id"], "status": "Failed"})
            
    return {"message": f"Processed {len(emails)} emails.", "details": results}

@app.post("/api/tickets/batch-csv")
async def batch_csv_endpoint(file: Optional[UploadFile] = File(None)):
    """Process a batch of support tickets from an uploaded CSV or default sample_tickets.csv."""
    rows = []
    if file:
        content = await file.read()
        text_content = content.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text_content))
        rows = list(reader)
    else:
        csv_path = os.path.join(os.path.dirname(__file__), "sample_tickets.csv")
        if os.path.exists(csv_path):
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                rows = list(reader)
        else:
            raise HTTPException(status_code=400, detail="No file provided and sample_tickets.csv not found.")

    if not rows:
        raise HTTPException(status_code=400, detail="CSV file contains no data rows.")

    processed = []
    successful = 0
    failed = 0

    for row in rows:
        ticket_text = (
            row.get("Ticket Description") or 
            row.get("ticket_text") or 
            row.get("Description") or 
            row.get("body") or 
            ""
        ).strip()

        if not ticket_text:
            continue

        try:
            res = run_ticket_workflow(ticket_text=ticket_text)
            if res.get("status") != "error" and res.get("classification"):
                cls = res["classification"]
                db_id = save_ticket(
                    ticket_text=ticket_text,
                    classification=cls,
                    provider_used=res.get("provider_used", "Auto"),
                    status="Open"
                )
                processed.append({
                    "id": db_id,
                    "customer": row.get("Customer Name", "Customer"),
                    "summary": cls.summary,
                    "category": cls.category.value,
                    "priority": cls.priority.value,
                    "assigned_team": cls.assigned_team.value,
                    "escalated": cls.requires_immediate_escalation,
                    "status": "Success"
                })
                successful += 1
            else:
                failed += 1
        except Exception as e:
            failed += 1
            print(f"[Batch CSV Error]: {e}")

    return {
        "message": f"Batch completed: {successful} tickets classified, {failed} failed.",
        "total_rows": len(rows),
        "successful": successful,
        "failed": failed,
        "tickets": processed
    }

@app.get("/api/kb")
def get_kb_documents():
    return get_all_kb_docs()

@app.post("/api/kb")
async def add_kb_document(
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    if file:
        content = await file.read()
        extracted_text = ""
        if file.filename.endswith(".pdf"):
            try:
                reader = PdfReader(io.BytesIO(content))
                for page in reader.pages:
                    extracted_text += page.extract_text() + "\n"
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")
        else:
            # Assume text file
            extracted_text = content.decode("utf-8")
        
        doc_id = add_to_kb(extracted_text)
        return {"message": "Document added", "id": doc_id}
        
    elif text:
        doc_id = add_to_kb(text)
        return {"message": "Document added", "id": doc_id}
        
    raise HTTPException(status_code=400, detail="Must provide either text or file")

@app.delete("/api/kb/{doc_id}")
def delete_kb_document(doc_id: str):
    delete_from_kb(doc_id)
    return {"message": "Document deleted successfully"}

# ==========================================
# Quality Assurance (QA) & CSAT Endpoints
# ==========================================

@app.post("/api/tickets/{ticket_id}/qa-audit")
def qa_audit_endpoint(ticket_id: int, req: QAAuditRequest):
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    kb_context = search_kb(f"{ticket['category']} {ticket['ticket_text']}", n_results=1)
    qa_eval = qam.evaluate_draft_qa(ticket, req.draft_text, kb_context)
    qam.save_ticket_qa_score(ticket_id, qa_eval["overall_score"], qa_eval["grade"])
    collab.log_audit_event(
        ticket_id=ticket_id,
        action_type="QA_AUDITED",
        actor_name="AI QA Sentinel",
        details=f"Draft evaluated: Score {qa_eval['overall_score']}% (Grade {qa_eval['grade']})"
    )
    return qa_eval

@app.post("/api/tickets/{ticket_id}/csat")
def submit_csat_endpoint(ticket_id: int, req: CSATSubmitRequest):
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    result = qam.submit_csat_survey(
        ticket_id=ticket_id,
        rating=req.rating,
        feedback_tag=req.feedback_tag,
        comment=req.comment,
        customer_name=req.customer_name
    )
    collab.log_audit_event(
        ticket_id=ticket_id,
        action_type="CSAT_LOGGED",
        actor_name=req.customer_name,
        details=f"Customer CSAT Survey: {req.rating} / 5 Stars ({req.feedback_tag})"
    )
    return result

@app.get("/api/csat/analytics")
def get_csat_analytics_endpoint():
    return qam.get_csat_analytics()

# ==========================================
# Smart Macros Library Endpoints
# ==========================================

@app.get("/api/macros")
def get_macros_endpoint():
    return qam.get_all_macros()

@app.get("/api/tickets/{ticket_id}/macros/recommend")
def recommend_macros_endpoint(ticket_id: int):
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return qam.get_recommended_macros(ticket)

# ==========================================
# Customer Portal AI Deflection Endpoint
# ==========================================

@app.post("/api/portal/deflect")
def portal_deflect_endpoint(req: PortalDeflectRequest):
    docs = search_kb(req.query, n_results=2)
    suggestions = []
    if docs:
        for d in docs.split("\n\n"):
            clean = d.strip()
            if clean and len(clean) > 20:
                suggestions.append(clean[:350] + ("..." if len(clean) > 350 else ""))
    if not suggestions:
        # Fallback knowledge base guidelines
        q = req.query.lower()
        if "refund" in q or "charge" in q or "billing" in q:
            suggestions.append("Billing Policy: All duplicate or disputed charges are 100% reversed within 3-5 business days upon submission. No cancellation fees apply.")
        elif "delay" in q or "ship" in q or "track" in q or "package" in q:
            suggestions.append("Shipping Policy: If tracking hasn't updated for over 48 hours, our fulfillment team initiates an automatic Priority Carrier Trace or dispatches a free replacement.")
        elif "500" in q or "api" in q or "server" in q or "error" in q:
            suggestions.append("Technical Support Policy: Production endpoint errors are assigned directly to on-call Engineering Liaisons with a guaranteed 2-hour root cause analysis.")
        else:
            suggestions.append("Knowledge Guide: Submit your request below and our automated AI triage system will route you to the appropriate specialist team immediately.")
    return {"suggestions": suggestions}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
