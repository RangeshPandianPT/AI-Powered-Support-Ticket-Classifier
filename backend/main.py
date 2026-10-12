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
from classifier import rewrite_draft_llm, copilot_chat_llm
from rag_kb import get_all_kb_docs, add_to_kb, delete_from_kb, search_kb
from pypdf import PdfReader
import database as db

app = FastAPI(title="AI Support Intelligence API")

# Setup CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB
db.init_db()

class TicketRequest(BaseModel):
    ticket_text: str
    provider: str = "Auto"
    openai_key: Optional[str] = None
    gemini_key: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str

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
    update_ticket_status(ticket_id, req.status)
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

@app.post("/api/tickets/{ticket_id}/reply")
def send_reply_endpoint(ticket_id: int, req: SendReplyRequest):
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db.update_ticket_draft(ticket_id, req.reply_text)
    return {
        "status": "sent",
        "message": f"Customer reply dispatched successfully for Ticket #{ticket_id}",
        "recipient": req.customer_email or "customer@example.com"
    }

@app.delete("/api/tickets/{ticket_id}")
def delete_ticket_endpoint(ticket_id: int):
    delete_ticket(ticket_id)
    return {"message": "Ticket deleted successfully"}

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
