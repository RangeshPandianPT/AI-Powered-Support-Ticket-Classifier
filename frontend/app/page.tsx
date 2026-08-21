"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { Send, Inbox, AlertTriangle, CheckCircle, Clock } from "lucide-react";

export default function Home() {
  const [ticketText, setTicketText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [ingesting, setIngesting] = useState(false);

  // Fetch recent tickets
  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/tickets");
      setTickets(res.data.slice(0, 5)); // Show last 5
    } catch (e) {
      console.error("Failed to fetch tickets", e);
    }
  };

  const handleClassify = async () => {
    if (!ticketText.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.post("http://127.0.0.1:8000/api/tickets/classify", {
        ticket_text: ticketText
      });
      setResult(res.data);
      fetchTickets();
      setTicketText("");
    } catch (e) {
      console.error(e);
      alert("Error classifying ticket. Is backend running?");
    }
    setLoading(false);
  };

  const handleIngestEmails = async () => {
    setIngesting(true);
    try {
      await axios.post("http://127.0.0.1:8000/api/email/ingest");
      alert("Emails successfully ingested and processed by AI Agents!");
      fetchTickets();
    } catch (e) {
      console.error(e);
      alert("Failed to ingest emails.");
    }
    setIngesting(false);
  };

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>AI Agent Helpdesk</h1>
          <p style={{ color: "#94a3b8", marginTop: "0.5rem" }}>Multi-Agent Classification, RAG & Webhooks</p>
        </div>
        <button className="btn" onClick={handleIngestEmails} disabled={ingesting}>
          <Inbox size={20} />
          {ingesting ? "Ingesting IMAP..." : "Simulate IMAP Ingestion"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Left Column - Input */}
        <div className="glass-card">
          <h2 style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Send size={24} color="#3b82f6" /> New Manual Ticket
          </h2>
          <textarea
            className="textarea"
            rows={5}
            placeholder="Paste customer message here..."
            value={ticketText}
            onChange={(e) => setTicketText(e.target.value)}
          ></textarea>
          <button 
            className="btn" 
            style={{ marginTop: "1rem", width: "100%", justifyContent: "center" }}
            onClick={handleClassify}
            disabled={loading}
          >
            {loading ? "AI Agents Analyzing..." : "Process via LangGraph"}
          </button>
        </div>

        {/* Right Column - Result */}
        {result && (
          <div className="glass-card" style={{ border: result.classification.requires_immediate_escalation ? "1px solid #ef4444" : "" }}>
            <h2 style={{ marginBottom: "1rem" }}>AI Analysis Results</h2>
            {result.classification.requires_immediate_escalation && (
              <div style={{ background: "rgba(239, 68, 68, 0.2)", padding: "1rem", borderRadius: "8px", marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center", color: "#fca5a5" }}>
                <AlertTriangle className="animate-pulse" />
                <b>URGENT: Escalation Slack Webhook Fired!</b>
              </div>
            )}
            
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Category</div>
                <div style={{ fontWeight: "bold" }}>{result.classification.category}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Priority</div>
                <div className={`badge ${result.classification.priority === "High" ? "badge-danger" : "badge-warning"}`}>
                  {result.classification.priority}
                </div>
              </div>
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.5rem" }}>RAG Enhanced Draft Response:</div>
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "8px", fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>
                {result.classification.draft_response}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: "3rem" }}>
        <h2 style={{ marginBottom: "1.5rem" }}>Recent Database Tickets</h2>
        <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
          {tickets.map(t => (
            <div key={t.id} className="glass-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                  <span className={`status-indicator ${t.status === "Open" ? "status-open" : "status-resolved"}`}></span>
                  <strong style={{ fontSize: "1.1rem" }}>#{t.id} - {t.category}</strong>
                  <span className="badge badge-neutral">{t.assigned_team}</span>
                  {t.requires_immediate_escalation === 1 && <span className="badge badge-danger">Urgent</span>}
                </div>
                <p style={{ color: "#94a3b8", fontSize: "0.9rem", maxWidth: "800px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {t.ticket_text}
                </p>
              </div>
              <div style={{ color: "#64748b", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Clock size={14} /> {new Date(t.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
          {tickets.length === 0 && <p style={{ color: "#64748b" }}>No tickets found. Ingest emails or create one manually.</p>}
        </div>
      </div>
    </div>
  );
}
