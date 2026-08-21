from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from database import get_all_tickets, save_ticket, update_ticket_status, delete_ticket, get_analytics_summary
from langgraph_workflow import run_ticket_workflow
from email_ingestion import check_new_emails
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
            "notification_sent": result.get("notification_sent")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tickets")
def list_ticketsEndpoint(status: str = "All", team: str = "All", priority: str = "All"):
    return get_all_tickets(status, team, priority)

@app.get("/api/analytics")
def analytics_endpoint():
    return get_analytics_summary()

@app.put("/api/tickets/{ticket_id}/status")
def update_status_endpoint(ticket_id: int, req: StatusUpdate):
    update_ticket_status(ticket_id, req.status)
    return {"message": "Status updated successfully"}

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
        if res["status"] != "error":
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
