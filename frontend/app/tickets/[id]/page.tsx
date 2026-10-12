"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  AlertTriangle, Clock, ArrowLeft, CheckCircle, Trash2, Send, 
  Sparkles, Bot, Copy, Check, Save, MessageSquare, Loader2, RefreshCw 
} from "lucide-react";
import Navbar from "../../components/Navbar";

export default function TicketDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Response Editor State
  const [draftText, setDraftText] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [replySentSuccess, setReplySentSuccess] = useState<string | null>(null);
  const [checkedActions, setCheckedActions] = useState<Record<number, boolean>>({});

  // Copilot State
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTicket();
    }
  }, [id]);

  const fetchTicket = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/tickets/${id}`);
      setTicket(res.data);
      setDraftText(res.data.draft_response || "");
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

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      await axios.put(`http://127.0.0.1:8000/api/tickets/${id}/draft`, { draft_response: draftText });
      setTicket({ ...ticket, draft_response: draftText });
      alert("Draft response updated successfully!");
    } catch (e) {
      console.error("Failed to save draft", e);
      alert("Error saving draft.");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleRewriteTone = async (toneInstruction: string) => {
    setIsRewriting(true);
    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/tickets/${id}/rewrite-draft`, {
        tone_instruction: toneInstruction
      });
      if (res.data.revised_draft) {
        setDraftText(res.data.revised_draft);
      }
    } catch (e) {
      console.error("Failed to rewrite draft", e);
      alert("Tone refinement failed. Is backend running?");
    } finally {
      setIsRewriting(false);
    }
  };

  const handleCopyDraft = () => {
    navigator.clipboard.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendReply = async () => {
    if (!confirm("Simulate dispatching this email response to the customer?")) return;
    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/tickets/${id}/reply`, {
        reply_text: draftText
      });
      setReplySentSuccess(res.data.message);
      // Auto-resolve ticket
      handleUpdateStatus("Resolved");
    } catch (e) {
      console.error("Failed to send reply", e);
      alert("Failed to dispatch reply.");
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to permanently delete this ticket?")) {
      try {
        await axios.delete(`http://127.0.0.1:8000/api/tickets/${id}`);
        router.push("/tickets");
      } catch (e) {
        console.error("Failed to delete ticket", e);
      }
    }
  };

  const handleSendCopilot = async (overrideMessage?: string) => {
    const msg = (overrideMessage || copilotInput).trim();
    if (!msg) return;

    const newHistory = [...copilotMessages, { role: "user" as const, content: msg }];
    setCopilotMessages(newHistory);
    setCopilotInput("");
    setCopilotLoading(true);

    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/tickets/${id}/copilot`, {
        message: msg,
        history: newHistory
      });
      setCopilotMessages([...newHistory, { role: "assistant" as const, content: res.data.reply }]);
    } catch (e) {
      console.error("Copilot error", e);
      setCopilotMessages([
        ...newHistory, 
        { role: "assistant" as const, content: "Sorry, I could not complete that request." }
      ]);
    } finally {
      setCopilotLoading(false);
    }
  };

  const toggleActionCheck = (idx: number) => {
    setCheckedActions(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container" style={{ textAlign: "center", padding: "4rem", color: "#94a3b8" }}>
          Loading ticket intelligence...
        </div>
      </>
    );
  }

  if (!ticket) {
    return (
      <>
        <Navbar />
        <div className="container" style={{ textAlign: "center", padding: "4rem", color: "#94a3b8" }}>
          Ticket #{id} not found.
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="container">
        {/* Top Breadcrumb & Action Header */}
        <div className="header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <Link href="/tickets" style={{ color: "#94a3b8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.88rem" }}>
                <ArrowLeft size={16} /> Back to All Tickets
              </Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <h1 style={{ fontSize: "2rem" }}>Ticket #{ticket.id}</h1>
              <span className={`badge ${ticket.status === "Open" ? "badge-warning" : "badge-success"}`}>
                <span className={`status-indicator ${ticket.status === "Open" ? "status-open" : "status-resolved"}`}></span>
                {ticket.status}
              </span>
              <span className="badge badge-neutral">{ticket.assigned_team}</span>
              {ticket.requires_immediate_escalation === 1 && (
                <span className="badge badge-danger">
                  <AlertTriangle size={12} /> Urgent Escalation
                </span>
              )}
            </div>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
              Ingested on {new Date(ticket.created_at).toLocaleString()} via {ticket.provider_used || "AutoDesk AI"}
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button 
              className={`btn ${copilotOpen ? "btn-purple" : "btn-secondary"}`}
              onClick={() => setCopilotOpen(!copilotOpen)}
            >
              <Bot size={16} />
              {copilotOpen ? "Hide AI Copilot" : "Open AI Copilot"}
            </button>

            {ticket.status === "Open" ? (
              <button 
                className="btn btn-success" 
                onClick={() => handleUpdateStatus("Resolved")}
              >
                <CheckCircle size={16} /> Mark Resolved
              </button>
            ) : (
              <button 
                className="btn btn-outline" 
                onClick={() => handleUpdateStatus("Open")}
              >
                Reopen Ticket
              </button>
            )}

            <button 
              className="btn btn-danger" 
              onClick={handleDelete}
              title="Delete this ticket"
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        </div>

        {/* Reply Dispatched Alert */}
        {replySentSuccess && (
          <div style={{
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            borderRadius: "12px",
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            color: "#6ee7b7",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem"
          }}>
            <CheckCircle size={20} />
            <div>
              <strong>Reply Sent!</strong>
              <div style={{ fontSize: "0.85rem", color: "#a7f3d0" }}>{replySentSuccess} Ticket marked as Resolved.</div>
            </div>
          </div>
        )}

        {/* Main 2-Column Grid */}
        <div style={{ display: "grid", gridTemplateColumns: copilotOpen ? "1.8fr 1.2fr" : "1.8fr 1.2fr", gap: "2rem" }}>
          {/* Left Column: Customer Message + Response Editor */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            {/* Customer Message */}
            <div className="glass-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff" }}>Customer Inbound Message</h2>
                <span className="badge badge-neutral" style={{ fontSize: "0.75rem" }}>Original Raw Text</span>
              </div>
              <div style={{ 
                background: "rgba(0, 0, 0, 0.35)", 
                padding: "1.25rem", 
                borderRadius: "10px", 
                fontSize: "0.95rem", 
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
                color: "#e2e8f0",
                border: "1px solid rgba(255, 255, 255, 0.05)"
              }}>
                {ticket.ticket_text}
              </div>
            </div>

            {/* Interactive Response Editor */}
            <div className="glass-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Sparkles size={18} color="#60a5fa" />
                    <span>AI Response Studio</span>
                  </h2>
                  <p style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                    Review, tone-shift, or edit the AI draft before dispatching to customer
                  </p>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button 
                    className="btn btn-outline btn-sm" 
                    onClick={handleCopyDraft}
                    title="Copy response to clipboard"
                  >
                    {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft}
                    title="Save edited draft to database"
                  >
                    {isSavingDraft ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Draft
                  </button>
                </div>
              </div>

              {/* Tone Quick Adjustment Pills */}
              <div style={{ marginBottom: "0.85rem" }}>
                <span style={{ fontSize: "0.78rem", color: "#94a3b8", display: "block", marginBottom: "0.4rem", fontWeight: 600 }}>
                  Quick Tone Refinement:
                </span>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button 
                    className="filter-pill" 
                    onClick={() => handleRewriteTone("Make it deeply empathetic, apologetic, and reassure the customer")}
                    disabled={isRewriting}
                    style={{ fontSize: "0.78rem" }}
                  >
                    🌸 Empathetic & Apologetic
                  </button>
                  <button 
                    className="filter-pill" 
                    onClick={() => handleRewriteTone("Make it concise, direct, and actionable in bullet points")}
                    disabled={isRewriting}
                    style={{ fontSize: "0.78rem" }}
                  >
                    ⚡ Concise & Direct
                  </button>
                  <button 
                    className="filter-pill" 
                    onClick={() => handleRewriteTone("Make it formal, corporate executive tone with professional assurance")}
                    disabled={isRewriting}
                    style={{ fontSize: "0.78rem" }}
                  >
                    💼 Formal Executive
                  </button>
                  <button 
                    className="filter-pill" 
                    onClick={() => handleRewriteTone("Include an apology and offer a 20% refund credit code")}
                    disabled={isRewriting}
                    style={{ fontSize: "0.78rem" }}
                  >
                    🎁 Offer 20% Credit
                  </button>
                </div>
              </div>

              {isRewriting && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#60a5fa", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                  <Loader2 size={15} className="animate-spin" />
                  AI Agent refining response tone...
                </div>
              )}

              {/* Textarea Editor */}
              <textarea
                className="textarea"
                rows={9}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                style={{ lineHeight: 1.55, fontSize: "0.92rem", marginBottom: "1rem" }}
                placeholder="Draft response will appear here..."
              ></textarea>

              {/* Dispatch Action */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  {draftText.length} characters • {draftText.split(/\s+/).filter(Boolean).length} words
                </span>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSendReply}
                  disabled={!draftText.trim()}
                >
                  <Send size={16} /> Simulate Send Email Reply
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: AI Triage Metadata + Copilot */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            {/* AI Triage Card */}
            <div className="glass-card" style={{ 
              border: ticket.requires_immediate_escalation === 1 ? "1px solid #ef4444" : undefined 
            }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "1rem", color: "#fff" }}>
                AI Triage Classification
              </h2>

              {ticket.requires_immediate_escalation === 1 && (
                <div style={{ 
                  background: "rgba(239, 68, 68, 0.2)", 
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  padding: "0.75rem 1rem", 
                  borderRadius: "8px", 
                  marginBottom: "1rem", 
                  display: "flex", 
                  gap: "0.5rem", 
                  alignItems: "center", 
                  color: "#fca5a5" 
                }}>
                  <AlertTriangle className="animate-pulse" size={18} />
                  <div>
                    <strong>Urgent SLA Breach Warning</strong>
                    <div style={{ fontSize: "0.75rem" }}>Escalation webhook alert triggered</div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div>
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Issue Category</div>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#fff" }}>{ticket.category}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Assigned Team</div>
                    <span className="badge badge-neutral" style={{ marginTop: "0.25rem" }}>{ticket.assigned_team}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Priority Level</div>
                    <span className={`badge ${ticket.priority === "High" ? "badge-danger" : ticket.priority === "Medium" ? "badge-warning" : "badge-neutral"}`} style={{ marginTop: "0.25rem" }}>
                      {ticket.priority}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>User Sentiment</div>
                    <div style={{ fontWeight: 600, color: "#e2e8f0", marginTop: "0.25rem" }}>{ticket.sentiment}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>AI Confidence</div>
                    <div style={{ fontWeight: 600, color: "#10b981", marginTop: "0.25rem" }}>
                      {(ticket.confidence_score * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Executive Summary</div>
                  <div style={{ fontSize: "0.88rem", color: "#cbd5e1", marginTop: "0.25rem", fontStyle: "italic" }}>
                    "{ticket.summary}"
                  </div>
                </div>
              </div>
            </div>

            {/* Key Action Items Checklist */}
            <div className="glass-card">
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.75rem", color: "#fff" }}>
                Key Agent Action Items
              </h2>
              {ticket.key_action_items && ticket.key_action_items.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {ticket.key_action_items.map((item: string, i: number) => {
                    const isChecked = Boolean(checkedActions[i]);
                    return (
                      <label 
                        key={i} 
                        style={{ 
                          display: "flex", 
                          alignItems: "flex-start", 
                          gap: "0.75rem", 
                          fontSize: "0.88rem", 
                          color: isChecked ? "#64748b" : "#e2e8f0",
                          textDecoration: isChecked ? "line-through" : "none",
                          cursor: "pointer",
                          background: "rgba(0,0,0,0.2)",
                          padding: "0.6rem 0.75rem",
                          borderRadius: "8px"
                        }}
                      >
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => toggleActionCheck(i)}
                          style={{ marginTop: "0.2rem" }}
                        />
                        <span>{item}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No explicit action items extracted.</p>
              )}
            </div>

            {/* AI Copilot Side Chat Drawer */}
            {copilotOpen && (
              <div className="glass-card" style={{ borderColor: "rgba(139, 92, 246, 0.4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#c084fc", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Bot size={18} /> Support Agent Copilot
                  </h3>
                  <span className="badge badge-purple" style={{ fontSize: "0.7rem" }}>RAG Grounded</span>
                </div>

                {/* Copilot Quick Questions */}
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                  <button 
                    className="filter-pill"
                    onClick={() => handleSendCopilot("What is our exact refund policy for this issue?")}
                    style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem" }}
                  >
                    🔍 Refund Policy?
                  </button>
                  <button 
                    className="filter-pill"
                    onClick={() => handleSendCopilot("Draft a quick internal escalation handover note for the team lead.")}
                    style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem" }}
                  >
                    📝 Internal Note?
                  </button>
                  <button 
                    className="filter-pill"
                    onClick={() => handleSendCopilot("Is this customer at high risk of churn? What should we offer?")}
                    style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem" }}
                  >
                    ⚠️ Churn Risk?
                  </button>
                </div>

                {/* Chat History Box */}
                <div style={{ 
                  background: "rgba(0, 0, 0, 0.35)", 
                  borderRadius: "10px", 
                  padding: "0.85rem", 
                  minHeight: "160px",
                  maxHeight: "240px", 
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                  marginBottom: "0.75rem"
                }}>
                  {copilotMessages.length === 0 ? (
                    <div style={{ color: "#64748b", fontSize: "0.82rem", textAlign: "center", padding: "1.5rem 0" }}>
                      Ask anything about this ticket or our company policies.
                    </div>
                  ) : (
                    copilotMessages.map((m, idx) => (
                      <div 
                        key={idx}
                        style={{
                          alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                          background: m.role === "user" ? "rgba(59, 130, 246, 0.25)" : "rgba(139, 92, 246, 0.15)",
                          border: `1px solid ${m.role === "user" ? "rgba(59, 130, 246, 0.4)" : "rgba(139, 92, 246, 0.3)"}`,
                          padding: "0.5rem 0.75rem",
                          borderRadius: "8px",
                          fontSize: "0.82rem",
                          maxWidth: "85%",
                          color: "#f1f5f9",
                          whiteSpace: "pre-wrap"
                        }}
                      >
                        {m.content}
                      </div>
                    ))
                  )}
                  {copilotLoading && (
                    <div style={{ alignSelf: "flex-start", color: "#c084fc", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Loader2 size={13} className="animate-spin" /> Copilot thinking...
                    </div>
                  )}
                </div>

                {/* Copilot Input */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ask Copilot..."
                    value={copilotInput}
                    onChange={(e) => setCopilotInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendCopilot()}
                    style={{ margin: 0, padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}
                  />
                  <button 
                    className="btn btn-purple btn-sm"
                    onClick={() => handleSendCopilot()}
                    disabled={copilotLoading || !copilotInput.trim()}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
