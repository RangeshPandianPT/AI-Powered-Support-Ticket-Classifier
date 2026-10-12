"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { Send, Inbox, AlertTriangle, CheckCircle, Clock, ExternalLink, Bot, Sparkles, Copy, Check } from "lucide-react";
import Link from "next/link";
import Navbar from "./components/Navbar";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import KnowledgeBase from "./components/KnowledgeBase";
import AgentWorkflowStepper from "./components/AgentWorkflowStepper";
import BatchCSVModal from "./components/BatchCSVModal";

const SAMPLE_PROMPTS = [
  {
    label: "Refund Anger",
    text: "My credit card was charged $299 twice for invoice #8841. This is ridiculous, reverse the duplicate transaction immediately!"
  },
  {
    label: "Shipping Delay",
    text: "I ordered my package 2 weeks ago and the tracking number has been stuck on 'Pending Shipment'. I need this before Friday!"
  },
  {
    label: "Technical Bug",
    text: "When our developers hit the POST /v1/checkout endpoint in production, the server crashes with a 500 internal server error."
  },
  {
    label: "Sales Pricing",
    text: "Hi, I am looking for enterprise volume licensing and non-profit discounts for our team of 120 employees."
  }
];

export default function Home() {
  const [ticketText, setTicketText] = useState("");
  const [provider, setProvider] = useState("Auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [ingesting, setIngesting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [refreshTrigger]);

  const fetchTickets = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/tickets");
      setTickets(res.data.slice(0, 6));
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
        ticket_text: ticketText,
        provider: provider
      });
      setResult(res.data);
      setRefreshTrigger(prev => prev + 1);
    } catch (e: any) {
      console.error(e);
      alert(e.response?.data?.detail || "Error classifying ticket. Is backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleIngestEmails = async () => {
    setIngesting(true);
    try {
      const res = await axios.post("http://127.0.0.1:8000/api/email/ingest");
      alert(`Success: ${res.data.message}`);
      setRefreshTrigger(prev => prev + 1);
    } catch (e) {
      console.error(e);
      alert("Failed to ingest emails.");
    } finally {
      setIngesting(false);
    }
  };

  const handleCopyDraft = () => {
    if (result?.classification?.draft_response) {
      navigator.clipboard.writeText(result.classification.draft_response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <Navbar 
        onOpenBatchCSV={() => setIsBatchModalOpen(true)}
        onIngestIMAP={handleIngestEmails}
        isIngesting={ingesting}
      />

      <div className="container">
        {/* Analytics Live Telemetry */}
        <AnalyticsDashboard refreshTrigger={refreshTrigger} />

        {/* Multi-Agent LangGraph Workbench */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "3rem" }}>
          {/* Left Column: Ticket Input & Testing */}
          <div className="glass-card" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Send size={20} color="#3b82f6" /> 
                <span>Interactive Ticket Triage</span>
              </h2>
              <select 
                className="select" 
                value={provider} 
                onChange={(e) => setProvider(e.target.value)}
                style={{ width: "auto", padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
              >
                <option value="Auto">Auto (OpenAI / Gemini)</option>
                <option value="OpenAI">OpenAI (gpt-4o)</option>
                <option value="Google Gemini">Google Gemini (2.5-flash)</option>
              </select>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.85rem" }}>
              Quick test sample issues or type your own support message:
            </p>

            {/* Quick Sample Chips */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              {SAMPLE_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  className="filter-pill"
                  onClick={() => setTicketText(p.text)}
                  style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem" }}
                >
                  ⚡ {p.label}
                </button>
              ))}
            </div>

            <textarea
              className="textarea"
              rows={6}
              placeholder="Paste or write customer message here..."
              value={ticketText}
              onChange={(e) => setTicketText(e.target.value)}
              style={{ marginBottom: "1rem", flex: 1 }}
            ></textarea>

            <button 
              className="btn btn-primary" 
              style={{ width: "100%", justifyContent: "center", padding: "0.85rem" }}
              onClick={handleClassify}
              disabled={loading || !ticketText.trim()}
            >
              <Bot size={18} />
              {loading ? "LangGraph Agents Processing..." : "Execute LangGraph Workflow"}
            </button>
          </div>

          {/* Right Column: Multi-Agent Execution Results */}
          <div className="glass-card" style={{ 
            border: result?.classification?.requires_immediate_escalation ? "1px solid #ef4444" : undefined 
          }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Sparkles size={20} color="#a855f7" /> 
              <span>Multi-Agent Workflow Output</span>
            </h2>

            {loading && (
              <div style={{ padding: "2rem 0" }}>
                <AgentWorkflowStepper isLoading={true} />
              </div>
            )}

            {!loading && !result && (
              <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#64748b" }}>
                <Bot size={40} style={{ margin: "0 auto 1rem", opacity: 0.4 }} />
                <p>Run a ticket on the left to observe LangGraph triage, RAG retrieval, and draft generation in real time.</p>
              </div>
            )}

            {!loading && result && (
              <div>
                {result.classification.requires_immediate_escalation && (
                  <div style={{ 
                    background: "rgba(239, 68, 68, 0.2)", 
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    padding: "0.85rem 1rem", 
                    borderRadius: "10px", 
                    marginBottom: "1.25rem", 
                    display: "flex", 
                    gap: "0.5rem", 
                    alignItems: "center", 
                    color: "#fca5a5" 
                  }}>
                    <AlertTriangle className="animate-pulse" size={20} />
                    <div>
                      <strong>Urgent Escalation Triggered!</strong>
                      <div style={{ fontSize: "0.8rem", color: "#fecaca" }}>Slack alert notification dispatched via webhook.</div>
                    </div>
                  </div>
                )}

                {/* Workflow Stepper */}
                <AgentWorkflowStepper steps={result.steps} />

                {/* Key Classification Metadata */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", margin: "1.25rem 0" }}>
                  <div style={{ background: "rgba(0,0,0,0.3)", padding: "0.75rem", borderRadius: "8px" }}>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Assigned Team</div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff" }}>
                      {result.classification.assigned_team}
                    </div>
                  </div>

                  <div style={{ background: "rgba(0,0,0,0.3)", padding: "0.75rem", borderRadius: "8px" }}>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Priority Level</div>
                    <div className={`badge ${result.classification.priority === "High" ? "badge-danger" : result.classification.priority === "Medium" ? "badge-warning" : "badge-success"}`}>
                      {result.classification.priority}
                    </div>
                  </div>

                  <div style={{ background: "rgba(0,0,0,0.3)", padding: "0.75rem", borderRadius: "8px" }}>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Sentiment</div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#e2e8f0" }}>
                      {result.classification.sentiment}
                    </div>
                  </div>
                </div>

                {/* Draft Response */}
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1" }}>Contextual Draft Response</span>
                    <button 
                      onClick={handleCopyDraft} 
                      className="btn btn-outline btn-sm"
                      style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                    >
                      {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div style={{ 
                    background: "rgba(0, 0, 0, 0.4)", 
                    padding: "1rem", 
                    borderRadius: "10px", 
                    fontSize: "0.88rem", 
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                    color: "#f1f5f9"
                  }}>
                    {result.classification.draft_response}
                  </div>
                </div>

                {result.id && (
                  <div style={{ textAlign: "right", marginTop: "0.5rem" }}>
                    <Link href={`/tickets/${result.id}`} className="btn btn-secondary btn-sm">
                      Open in Full Ticket View <ExternalLink size={14} />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recent Database Tickets Section */}
        <div style={{ marginTop: "3.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff" }}>Recent Support Tickets</h2>
              <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Live tickets ingested into SQLite database</p>
            </div>
            <Link href="/tickets" className="btn btn-outline">
              View All Tickets ({tickets.length}) &rarr;
            </Link>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
            {tickets.map(t => (
              <Link key={t.id} href={`/tickets/${t.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="glass-card" style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  cursor: "pointer",
                  padding: "1.25rem 1.5rem"
                }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
                      <span className={`status-indicator ${t.status === "Open" ? "status-open" : "status-resolved"}`}></span>
                      <strong style={{ fontSize: "1.05rem", color: "#fff" }}>#{t.id} - {t.category}</strong>
                      <span className="badge badge-neutral">{t.assigned_team}</span>
                      <span className={`badge ${t.priority === "High" ? "badge-danger" : t.priority === "Medium" ? "badge-warning" : "badge-neutral"}`}>
                        {t.priority}
                      </span>
                      {t.requires_immediate_escalation === 1 && (
                        <span className="badge badge-danger">Urgent</span>
                      )}
                    </div>
                    <p style={{ color: "#94a3b8", fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.ticket_text}
                    </p>
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <Clock size={14} /> {new Date(t.created_at).toLocaleDateString()}
                    </span>
                    <ExternalLink size={16} />
                  </div>
                </div>
              </Link>
            ))}

            {tickets.length === 0 && (
              <div className="glass-card" style={{ textAlign: "center", padding: "2.5rem", color: "#64748b" }}>
                No tickets in database yet. Click "Poll IMAP", "Batch CSV", or enter a ticket above.
              </div>
            )}
          </div>
        </div>

        {/* Knowledge Base Manager */}
        <KnowledgeBase />
      </div>

      {/* Batch CSV Modal */}
      <BatchCSVModal 
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onSuccess={() => {
          fetchTickets();
          setRefreshTrigger(prev => prev + 1);
        }}
      />
    </>
  );
}
