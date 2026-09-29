"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Clock, ArrowLeft, CheckCircle } from "lucide-react";

export default function TicketDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchTicket();
    }
  }, [id]);

  const fetchTicket = async () => {
    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/tickets/${id}`);
      setTicket(res.data);
    } catch (e) {
      console.error("Failed to fetch ticket", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      await axios.put(`http://127.0.0.1:8000/api/tickets/${id}/status`, { status: newStatus });
      setTicket({ ...ticket, status: newStatus });
    } catch (e) {
      console.error("Failed to update status", e);
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this ticket?")) {
      try {
        await axios.delete(`http://127.0.0.1:8000/api/tickets/${id}`);
        router.push("/tickets");
      } catch (e) {
        console.error("Failed to delete ticket", e);
      }
    }
  };

  if (loading) return <div className="container" style={{ padding: "2rem" }}>Loading...</div>;
  if (!ticket) return <div className="container" style={{ padding: "2rem" }}>Ticket not found</div>;

  return (
    <div className="container">
      <div className="header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href="/tickets" style={{ display: "inline-flex", alignItems: "center", color: "#94a3b8", textDecoration: "none" }}>
              <ArrowLeft size={20} style={{ marginRight: "0.5rem" }}/> Back
            </Link>
            <h1>Ticket #{ticket.id}</h1>
          </div>
          <p style={{ color: "#94a3b8", marginTop: "0.5rem" }}>Created on {new Date(ticket.created_at).toLocaleString()}</p>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          {ticket.status === "Open" ? (
            <button className="btn" style={{ background: "#22c55e", borderColor: "#22c55e", color: "#fff" }} onClick={() => handleUpdateStatus("Resolved")}>
              <CheckCircle size={20} /> Mark as Resolved
            </button>
          ) : (
            <button className="btn btn-outline" onClick={() => handleUpdateStatus("Open")}>
              Reopen Ticket
            </button>
          )}
          <button className="btn" style={{ background: "transparent", borderColor: "#ef4444", color: "#ef4444" }} onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "2rem", marginTop: "2rem" }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div className="glass-card">
            <h2 style={{ marginBottom: "1rem" }}>Customer Message</h2>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "1.5rem", borderRadius: "8px", fontSize: "1rem", whiteSpace: "pre-wrap" }}>
              {ticket.ticket_text}
            </div>
          </div>
          
          <div className="glass-card">
            <h2 style={{ marginBottom: "1rem" }}>AI Draft Response</h2>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "1.5rem", borderRadius: "8px", fontSize: "0.95rem", whiteSpace: "pre-wrap", color: "#e2e8f0" }}>
              {ticket.draft_response || "No draft response available."}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div className="glass-card" style={{ border: ticket.requires_immediate_escalation ? "1px solid #ef4444" : "" }}>
            <h2 style={{ marginBottom: "1rem" }}>Classification</h2>
            
            {ticket.requires_immediate_escalation === 1 && (
              <div style={{ background: "rgba(239, 68, 68, 0.2)", padding: "1rem", borderRadius: "8px", marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center", color: "#fca5a5" }}>
                <AlertTriangle className="animate-pulse" />
                <b>Escalation Required</b>
              </div>
            )}
            
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Status</div>
                <div className={`badge ${ticket.status === "Open" ? "badge-warning" : "badge-success"}`}>
                  {ticket.status}
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Category</div>
                <div style={{ fontWeight: "bold" }}>{ticket.category}</div>
              </div>
              
              <div>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Assigned Team</div>
                <div className="badge badge-neutral">{ticket.assigned_team}</div>
              </div>
              
              <div>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Priority</div>
                <div className={`badge ${ticket.priority === "High" ? "badge-danger" : ticket.priority === "Medium" ? "badge-warning" : "badge-neutral"}`}>
                  {ticket.priority}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Sentiment</div>
                <div style={{ fontWeight: "bold" }}>{ticket.sentiment}</div>
              </div>
              
              <div>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>AI Confidence</div>
                <div style={{ fontWeight: "bold" }}>{(ticket.confidence_score * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>

          <div className="glass-card">
            <h2 style={{ marginBottom: "1rem" }}>Key Action Items</h2>
            {ticket.key_action_items && ticket.key_action_items.length > 0 ? (
              <ul style={{ paddingLeft: "1.5rem", color: "#e2e8f0" }}>
                {ticket.key_action_items.map((item: string, i: number) => (
                  <li key={i} style={{ marginBottom: "0.5rem" }}>{item}</li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "#94a3b8" }}>No action items identified.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
