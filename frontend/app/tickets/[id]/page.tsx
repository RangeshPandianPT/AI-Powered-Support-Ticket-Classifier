"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  AlertTriangle, Clock, ArrowLeft, CheckCircle, Trash2, Send, 
  Sparkles, Bot, Copy, Check, Save, MessageSquare, Loader2, RefreshCw,
  User, ShieldCheck, HelpCircle, Flame, Smile, Frown, MessageCircle,
  Users, History, Lock, Zap, Radio, Link2, Unlink, Building2, HeartHandshake
} from "lucide-react";
import Navbar from "../../components/Navbar";
import AssigneeRoutingCard from "../../components/AssigneeRoutingCard";
import InternalNotesSection from "../../components/InternalNotesSection";
import TicketAuditTimeline from "../../components/TicketAuditTimeline";
import TeamWorkloadDrawer from "../../components/TeamWorkloadDrawer";
import AIQualityInspector from "../../components/AIQualityInspector";
import SmartMacrosModal from "../../components/SmartMacrosModal";

interface MessageItem {
  id?: number;
  ticket_id?: number;
  sender: "customer" | "agent";
  message_text: string;
  sentiment?: string;
  created_at?: string;
}

export default function TicketDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Response Editor State
  const [draftText, setDraftText] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [copied, setCopied] = useState(false);
  const [replySentSuccess, setReplySentSuccess] = useState<string | null>(null);
  const [checkedActions, setCheckedActions] = useState<Record<number, boolean>>({});

  // Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [activePersona, setActivePersona] = useState<string | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customInputText, setCustomInputText] = useState("");
  const [isSendingCustomMsg, setIsSendingCustomMsg] = useState(false);

  // Copilot State
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);

  // Collaboration & Activity State
  const [activeBottomTab, setActiveBottomTab] = useState<"notes" | "audit">("notes");
  const [workloadDrawerOpen, setWorkloadDrawerOpen] = useState(false);
  const [auditRefreshTrigger, setAuditRefreshTrigger] = useState(0);
  const [macrosModalOpen, setMacrosModalOpen] = useState(false);

  // Incident Cluster Association State
  const [linkedIncident, setLinkedIncident] = useState<any>(null);
  const [allIncidents, setAllIncidents] = useState<any[]>([]);
  const [selectedIncidentToLink, setSelectedIncidentToLink] = useState<string>("");
  const [isLinkingIncident, setIsLinkingIncident] = useState(false);

  // Auto-Pilot Rules State
  const [automationLogs, setAutomationLogs] = useState<any[]>([]);
  const [runningAutomations, setRunningAutomations] = useState(false);
  const [automationFeedback, setAutomationFeedback] = useState<string | null>(null);

  // Customer 360 Intelligence State
  const [customer360, setCustomer360] = useState<any>(null);
  const [retentionMemo, setRetentionMemo] = useState<any>(null);
  const [generatingRetentionMemo, setGeneratingRetentionMemo] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTicketData();
      fetchIncidentData();
      fetchAutomationLogs();
      fetchCustomer360();
    }
  }, [id]);

  const fetchCustomer360 = async () => {
    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/tickets/${id}/customer`);
      setCustomer360(res.data);
    } catch (e) {
      console.error("Failed to fetch customer 360", e);
    }
  };

  const handleGenerateTicketRetention = async () => {
    if (!customer360) return;
    setGeneratingRetentionMemo(true);
    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/customers/${customer360.id}/retention-playbook`);
      setRetentionMemo(res.data);
    } catch (e) {
      console.error("Failed to generate retention memo", e);
    } finally {
      setGeneratingRetentionMemo(false);
    }
  };

  const fetchAutomationLogs = async () => {
    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/tickets/${id}/automations/logs`);
      setAutomationLogs(res.data || []);
    } catch (e) {
      console.error("Failed to fetch automation logs", e);
    }
  };

  const handleRunAutomations = async () => {
    setRunningAutomations(true);
    setAutomationFeedback(null);
    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/tickets/${id}/automations/run`, {
        dry_run: false,
        trigger_event: "ON_MANUAL"
      });
      const count = res.data?.rules_matched || 0;
      setAutomationFeedback(
        count > 0
          ? `Executed ${count} Auto-Pilot rule(s)!`
          : "All active rules evaluated — no new triggers matched."
      );
      await Promise.all([fetchTicketData(), fetchIncidentData(), fetchAutomationLogs()]);
      setAuditRefreshTrigger(t => t + 1);
    } catch (e) {
      console.error("Failed to run automations", e);
    } finally {
      setRunningAutomations(false);
    }
  };

  const fetchIncidentData = async () => {
    try {
      const [incRes, allRes] = await Promise.all([
        axios.get(`http://127.0.0.1:8000/api/tickets/${id}/incident`),
        axios.get("http://127.0.0.1:8000/api/incidents")
      ]);
      setLinkedIncident(incRes.data || null);
      setAllIncidents(allRes.data || []);
    } catch (e) {
      console.error("Failed to fetch incident data", e);
    }
  };

  const handleLinkIncident = async () => {
    if (!selectedIncidentToLink) return;
    setIsLinkingIncident(true);
    try {
      await axios.post(`http://127.0.0.1:8000/api/tickets/${id}/incident/link`, {
        incident_id: Number(selectedIncidentToLink),
        actor_name: ticket?.assignee_name || "Support Agent"
      });
      await fetchIncidentData();
      setAuditRefreshTrigger(t => t + 1);
    } catch (e) {
      console.error("Failed to link incident", e);
    } finally {
      setIsLinkingIncident(false);
    }
  };

  const handleUnlinkIncident = async () => {
    if (!linkedIncident) return;
    try {
      await axios.delete(`http://127.0.0.1:8000/api/incidents/${linkedIncident.id}/tickets/${id}`);
      setLinkedIncident(null);
      await fetchIncidentData();
      setAuditRefreshTrigger(t => t + 1);
    } catch (e) {
      console.error("Failed to unlink incident", e);
    }
  };

  const fetchTicketData = async () => {
    setLoading(true);
    try {
      const [ticketRes, msgRes] = await Promise.all([
        axios.get(`http://127.0.0.1:8000/api/tickets/${id}`),
        axios.get(`http://127.0.0.1:8000/api/tickets/${id}/messages`)
      ]);
      setTicket(ticketRes.data);
      setDraftText(ticketRes.data.draft_response || "");
      setMessages(msgRes.data || []);
    } catch (e) {
      console.error("Failed to fetch ticket data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      await axios.put(`http://127.0.0.1:8000/api/tickets/${id}/status`, { status: newStatus });
      setTicket((prev: any) => ({ ...prev, status: newStatus }));
      setAuditRefreshTrigger(t => t + 1);
    } catch (e) {
      console.error("Failed to update status", e);
    }
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      await axios.put(`http://127.0.0.1:8000/api/tickets/${id}/draft`, { draft_response: draftText });
      setTicket((prev: any) => ({ ...prev, draft_response: draftText }));
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
    if (!draftText.trim()) return;
    setIsSendingReply(true);
    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/tickets/${id}/reply`, {
        reply_text: draftText,
        mark_resolved: false
      });
      setReplySentSuccess(res.data.message);
      if (res.data.messages) {
        setMessages(res.data.messages);
      }
      if (res.data.ticket) {
        setTicket(res.data.ticket);
      }
      setDraftText("");
      setAuditRefreshTrigger(t => t + 1);
      setTimeout(() => setReplySentSuccess(null), 5000);
    } catch (e) {
      console.error("Failed to send reply", e);
      alert("Failed to dispatch reply.");
    } finally {
      setIsSendingReply(false);
    }
  };

  // Simulate customer response
  const handleSimulateCustomerReply = async (persona: string) => {
    setIsSimulating(true);
    setActivePersona(persona);
    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/tickets/${id}/simulate-reply`, {
        persona
      });
      if (res.data.messages) {
        setMessages(res.data.messages);
      }
      if (res.data.ticket) {
        setTicket(res.data.ticket);
      }
      if (res.data.triage_update?.draft_response) {
        setDraftText(res.data.triage_update.draft_response);
      }
      setAuditRefreshTrigger(t => t + 1);
    } catch (e) {
      console.error("Failed to simulate reply", e);
      alert("Simulation failed. Ensure backend server is running.");
    } finally {
      setIsSimulating(false);
      setActivePersona(null);
    }
  };

  // Send manual custom customer message
  const handleSendCustomMessage = async () => {
    if (!customInputText.trim()) return;
    setIsSendingCustomMsg(true);
    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/tickets/${id}/messages`, {
        sender: "customer",
        message_text: customInputText.trim(),
        sentiment: "Neutral"
      });
      if (res.data.messages) {
        setMessages(res.data.messages);
      }
      setCustomInputText("");
      setShowCustomInput(false);
    } catch (e) {
      console.error("Failed to send custom message", e);
    } finally {
      setIsSendingCustomMsg(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to permanently delete this ticket and its message history?")) {
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
          Loading ticket intelligence & conversation history...
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

  const renderSentimentIcon = (sentiment?: string) => {
    const s = (sentiment || "").toLowerCase();
    if (s.includes("happy") || s.includes("resolved") || s.includes("satisfied")) {
      return <Smile size={14} color="#34d399" />;
    } else if (s.includes("angry") || s.includes("frustrated")) {
      return <Flame size={14} color="#f87171" />;
    }
    return <MessageCircle size={14} color="#94a3b8" />;
  };

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

              {/* Omnichannel Origin Badge */}
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "6px",
                background: ticket.channel === "whatsapp" ? "rgba(34, 197, 94, 0.2)" :
                            ticket.channel === "slack" ? "rgba(168, 85, 247, 0.2)" :
                            ticket.channel === "sms" ? "rgba(249, 115, 22, 0.2)" :
                            ticket.channel === "chat" ? "rgba(14, 165, 233, 0.2)" : "rgba(148, 163, 184, 0.2)",
                color: ticket.channel === "whatsapp" ? "#4ade80" :
                       ticket.channel === "slack" ? "#c084fc" :
                       ticket.channel === "sms" ? "#fb923c" :
                       ticket.channel === "chat" ? "#38bdf8" : "#cbd5e1",
                border: "1px solid rgba(255, 255, 255, 0.1)"
              }}>
                {ticket.channel === "whatsapp" ? "💬 WhatsApp" :
                 ticket.channel === "slack" ? "🟣 Slack" :
                 ticket.channel === "sms" ? "📱 SMS" :
                 ticket.channel === "chat" ? "💬 Live Chat" : "📧 Email"}
              </span>

              {/* SLA Target Badge */}
              {ticket.is_sla_breached ? (
                <span className="sla-pill breached animate-pulse">
                  <AlertTriangle size={13} /> SLA Breached ({ticket.sla_target_hours || 4}h target)
                </span>
              ) : ticket.sla_remaining_minutes !== undefined && ticket.status === "Open" ? (
                <span className={`sla-pill ${ticket.sla_remaining_minutes < 120 ? 'warning' : 'normal'}`}>
                  <Clock size={13} /> 
                  {ticket.sla_remaining_minutes > 0 ? (
                    `${Math.floor(ticket.sla_remaining_minutes / 60)}h ${ticket.sla_remaining_minutes % 60}m SLA remaining`
                  ) : "SLA Due"}
                </span>
              ) : null}

              {ticket.requires_immediate_escalation === 1 && (
                <span className="badge badge-danger">
                  <AlertTriangle size={12} /> Urgent Escalation
                </span>
              )}
            </div>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
              Ingested on {new Date(ticket.created_at).toLocaleString()} via {ticket.provider_used || "AutoDesk AI"} • {messages.length} message{messages.length === 1 ? "" : "s"} in thread
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button 
              id="btn-open-team-workload"
              className="btn btn-secondary"
              onClick={() => setWorkloadDrawerOpen(true)}
              title="View team workload distribution and staffing capacity"
            >
              <Users size={16} /> Team Workload
            </button>

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
              title="Delete this ticket and message history"
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
              <strong>Reply Delivered!</strong>
              <div style={{ fontSize: "0.85rem", color: "#a7f3d0" }}>{replySentSuccess} Message added to timeline.</div>
            </div>
          </div>
        )}

        {/* Linked Incident Outage Alert Banner */}
        {linkedIncident && (
          <div style={{
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            borderRadius: "12px",
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{
                background: "rgba(239, 68, 68, 0.25)",
                padding: "8px",
                borderRadius: "8px",
                color: "#f87171"
              }}>
                <Radio size={20} className="animate-pulse" />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <strong style={{ color: "#fff", fontSize: "0.95rem" }}>
                    Linked to Incident Cluster: [{linkedIncident.incident_code}] {linkedIncident.title}
                  </strong>
                  <span className={`badge ${linkedIncident.severity.includes("P1") ? "badge-danger" : "badge-warning"}`}>
                    {linkedIncident.severity}
                  </span>
                  <span className="badge badge-neutral">{linkedIncident.status}</span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#cbd5e1", marginTop: "0.2rem" }}>
                  Root Cause: {linkedIncident.root_cause_analysis || linkedIncident.summary}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Link 
                href="/incidents" 
                className="btn btn-primary btn-sm"
                style={{ fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
              >
                <Radio size={14} /> Open War Room
              </Link>
              <button 
                onClick={handleUnlinkIncident}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "0.78rem" }}
                title="Unlink this ticket from the incident"
              >
                Unlink
              </button>
            </div>
          </div>
        )}

        {/* Main 2-Column Grid */}
        <div style={{ display: "grid", gridTemplateColumns: copilotOpen ? "1.8fr 1.2fr" : "1.8fr 1.2fr", gap: "2rem" }}>
          
          {/* Left Column: Multi-Turn Conversation Thread & Response Studio */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            
            {/* Conversation Timeline Card */}
            <div className="glass-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <MessageSquare size={18} color="#38bdf8" />
                    <span>Conversation Thread</span>
                  </h2>
                  <p style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                    Multi-turn interaction between customer and support agents
                  </p>
                </div>
                <span className="badge badge-neutral" style={{ fontSize: "0.75rem" }}>
                  {messages.length} message{messages.length === 1 ? "" : "s"}
                </span>
              </div>

              {/* Message List */}
              <div className="msg-thread" style={{ marginBottom: "1.5rem" }}>
                {messages.map((m, index) => {
                  const isCustomer = m.sender === "customer";
                  return (
                    <div key={m.id || index} className={`msg-row ${isCustomer ? "customer" : "agent"}`}>
                      <div className={`msg-avatar ${isCustomer ? "customer" : "agent"}`}>
                        {isCustomer ? <User size={18} /> : <ShieldCheck size={18} />}
                      </div>

                      <div className={`msg-bubble ${isCustomer ? "customer" : "agent"}`}>
                        <div className="msg-header" style={{ justifyContent: isCustomer ? "flex-start" : "flex-end" }}>
                          <strong>{isCustomer ? "Customer" : "Support Agent (You)"}</strong>
                          <span>•</span>
                          <span>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}</span>
                          {isCustomer && m.sentiment && (
                            <span className="badge" style={{ 
                              fontSize: "0.7rem", 
                              padding: "0.15rem 0.45rem", 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: "0.25rem",
                              background: m.sentiment === "Happy" ? "rgba(16, 185, 129, 0.2)" : m.sentiment === "Frustrated" || m.sentiment === "Angry" ? "rgba(239, 68, 68, 0.2)" : "rgba(255, 255, 255, 0.08)",
                              color: m.sentiment === "Happy" ? "#6ee7b7" : m.sentiment === "Frustrated" || m.sentiment === "Angry" ? "#fca5a5" : "#cbd5e1"
                            }}>
                              {renderSentimentIcon(m.sentiment)}
                              {m.sentiment}
                            </span>
                          )}
                          {!isCustomer && (
                            <span style={{ fontSize: "0.7rem", color: "#a5b4fc", display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <Check size={11} /> Delivered
                            </span>
                          )}
                        </div>
                        <div style={{ whiteSpace: "pre-wrap", color: isCustomer ? "#e2e8f0" : "#f8fafc" }}>
                          {m.message_text}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Customer Reply Simulator Bar */}
              <div style={{ 
                background: "rgba(0, 0, 0, 0.4)", 
                border: "1px dashed rgba(255, 255, 255, 0.15)", 
                borderRadius: "12px", 
                padding: "1rem 1.25rem" 
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Sparkles size={15} color="#38bdf8" />
                    <span>Simulate Customer Reaction & Follow-up:</span>
                  </div>
                  {isSimulating && (
                    <span style={{ fontSize: "0.8rem", color: "#38bdf8", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Loader2 size={13} className="animate-spin" /> Customer thinking...
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: showCustomInput ? "0.75rem" : 0 }}>
                  <button 
                    className="filter-pill"
                    onClick={() => handleSimulateCustomerReply("dynamic")}
                    disabled={isSimulating}
                    style={{ fontSize: "0.78rem", background: activePersona === "dynamic" ? "rgba(59, 130, 246, 0.3)" : undefined }}
                    title="AI evaluates the agent's latest reply and simulates a realistic customer follow-up"
                  >
                    ⚡ Auto Dynamic Reaction
                  </button>
                  <button 
                    className="filter-pill"
                    onClick={() => handleSimulateCustomerReply("satisfied")}
                    disabled={isSimulating}
                    style={{ fontSize: "0.78rem", background: activePersona === "satisfied" ? "rgba(16, 185, 129, 0.3)" : undefined }}
                    title="Simulate customer confirming issue is solved and expressing gratitude"
                  >
                    😊 Solved / Thankful
                  </button>
                  <button 
                    className="filter-pill"
                    onClick={() => handleSimulateCustomerReply("frustrated")}
                    disabled={isSimulating}
                    style={{ fontSize: "0.78rem", background: activePersona === "frustrated" ? "rgba(239, 68, 68, 0.3)" : undefined }}
                    title="Simulate customer stating it still failed and demanding immediate escalation"
                  >
                    😤 Still Failing / Escalate
                  </button>
                  <button 
                    className="filter-pill"
                    onClick={() => handleSimulateCustomerReply("inquiring")}
                    disabled={isSimulating}
                    style={{ fontSize: "0.78rem", background: activePersona === "inquiring" ? "rgba(245, 158, 11, 0.3)" : undefined }}
                    title="Simulate customer asking a logical follow-up question"
                  >
                    ❓ Clarification Question
                  </button>
                  <button 
                    className="filter-pill"
                    onClick={() => setShowCustomInput(!showCustomInput)}
                    style={{ fontSize: "0.78rem" }}
                  >
                    ✍️ {showCustomInput ? "Cancel Custom" : "Custom Reply"}
                  </button>
                </div>

                {/* Custom manual message input */}
                {showCustomInput && (
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                    <input 
                      type="text"
                      className="input"
                      placeholder="Type a custom customer response..."
                      value={customInputText}
                      onChange={(e) => setCustomInputText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendCustomMessage()}
                      style={{ margin: 0, padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}
                    />
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={handleSendCustomMessage}
                      disabled={isSendingCustomMsg || !customInputText.trim()}
                    >
                      <Send size={14} /> Send
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Interactive Response Studio */}
            <div className="glass-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Sparkles size={18} color="#60a5fa" />
                    <span>AI Response Studio</span>
                  </h2>
                  <p style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                    Review, tone-shift, or edit the AI draft before dispatching to the customer
                  </p>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => setMacrosModalOpen(true)}
                    title="Open Enterprise Smart Macros Library"
                    style={{ background: "rgba(139, 92, 246, 0.2)", border: "1px solid rgba(139, 92, 246, 0.4)", color: "#c4b5fd", display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <Zap size={14} color="#a78bfa" />
                    <span>Smart Macros</span>
                  </button>
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
                rows={8}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                style={{ lineHeight: 1.55, fontSize: "0.92rem", marginBottom: "1rem" }}
                placeholder="Draft response will appear here... you can edit directly or apply quick tone adjustments."
              ></textarea>

              {/* Dispatch Action */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  {draftText.length} characters • {draftText.split(/\s+/).filter(Boolean).length} words
                </span>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSendReply}
                  disabled={!draftText.trim() || isSendingReply}
                >
                  {isSendingReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  <span>Dispatch via {ticket.channel ? ticket.channel.toUpperCase() : "Email"} Reply</span>
                </button>
              </div>
            </div>

            {/* AI Quality Assurance & CSAT Sentinel */}
            <AIQualityInspector 
              ticket={ticket}
              draftText={draftText}
              onApplyPolishedDraft={(newDraft) => setDraftText(newDraft)}
              onRefreshTicket={fetchTicketData}
            />
          </div>

          {/* Right Column: Assignee Routing, AI Triage Metadata & Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            
            {/* Customer 360 & Churn Intelligence Card */}
            {customer360 && (
              <div className="glass-card" style={{ borderLeft: `4px solid ${customer360.risk_color || '#3b82f6'}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "0.4rem", margin: 0 }}>
                    <Building2 size={16} color="#38bdf8" />
                    Customer 360
                  </h3>
                  <Link href="/customers" style={{ fontSize: "0.74rem", color: "#38bdf8", textDecoration: "none" }}>
                    Dossier &rarr;
                  </Link>
                </div>

                <div style={{ marginBottom: "0.6rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.2rem" }}>
                    <strong style={{ fontSize: "0.92rem", color: "#fff" }}>
                      {customer360.company || customer360.name}
                    </strong>
                    <span className="badge badge-warning" style={{ fontSize: "0.68rem" }}>
                      {customer360.tier}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                    {customer360.name} &bull; {customer360.email}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", background: "rgba(255, 255, 255, 0.03)", padding: "0.5rem 0.65rem", borderRadius: "6px", marginBottom: "0.75rem", fontSize: "0.78rem" }}>
                  <div>
                    <span style={{ color: "#94a3b8" }}>Health Score:</span>{" "}
                    <strong style={{ color: customer360.risk_color }}>{customer360.health_score}/100</strong>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8" }}>Churn Risk:</span>{" "}
                    <strong style={{ color: customer360.risk_color }}>{customer360.churn_risk}%</strong>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8" }}>MRR:</span>{" "}
                    <strong style={{ color: "#34d399" }}>${(customer360.mrr || 0).toLocaleString()}/mo</strong>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8" }}>Total Tickets:</span>{" "}
                    <strong style={{ color: "#e2e8f0" }}>{customer360.total_tickets}</strong>
                  </div>
                </div>

                {customer360.churn_risk >= 45 && !retentionMemo && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleGenerateTicketRetention}
                    disabled={generatingRetentionMemo}
                    style={{ width: "100%", fontSize: "0.76rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
                  >
                    <HeartHandshake size={14} color="#f87171" />
                    {generatingRetentionMemo ? "Synthesizing..." : "Generate Retention Playbook"}
                  </button>
                )}

                {retentionMemo && (
                  <div style={{ background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.25)", padding: "0.55rem 0.75rem", borderRadius: "6px", fontSize: "0.76rem" }}>
                    <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: "0.2rem" }}>
                      AI Retention Offer:
                    </div>
                    <div style={{ color: "#fde68a", lineHeight: 1.4 }}>
                      {retentionMemo.concession_offer}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Assignee Routing & Specialist Allocation Card */}
            <AssigneeRoutingCard 
              ticketId={ticket.id}
              currentAssigneeName={ticket.assignee_name || "Unassigned"}
              ticketCategory={ticket.category}
              ticketPriority={ticket.priority}
              onAssigneeUpdated={(newAssignee) => {
                setTicket((prev: any) => ({ ...prev, assignee_name: newAssignee }));
                setAuditRefreshTrigger(t => t + 1);
              }}
            />

            {/* Incident Cluster Association Card */}
            <div className="glass-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "0.4rem", margin: 0 }}>
                  <Radio size={16} color="#ef4444" />
                  Incident Cluster
                </h3>
                {linkedIncident && (
                  <span className="badge badge-danger" style={{ fontSize: "0.7rem" }}>
                    {linkedIncident.incident_code}
                  </span>
                )}
              </div>

              {linkedIncident ? (
                <div>
                  <div style={{ fontSize: "0.85rem", color: "#e2e8f0", fontWeight: 600, marginBottom: "0.3rem" }}>
                    {linkedIncident.title}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                    <span className={`badge ${linkedIncident.severity.includes("P1") ? "badge-danger" : "badge-warning"}`}>
                      {linkedIncident.severity}
                    </span>
                    <span className="badge badge-neutral">{linkedIncident.status}</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Link 
                      href="/incidents"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, textAlign: "center", fontSize: "0.75rem", textDecoration: "none" }}
                    >
                      War Room
                    </Link>
                    <button 
                      onClick={handleUnlinkIncident}
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: "0.75rem" }}
                    >
                      Unlink
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.6rem" }}>
                    Link this ticket to an ongoing incident cluster for mass responses.
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <select 
                      value={selectedIncidentToLink}
                      onChange={(e) => setSelectedIncidentToLink(e.target.value)}
                      className="input-select"
                      style={{ flex: 1, fontSize: "0.78rem", padding: "0.35rem 0.5rem" }}
                    >
                      <option value="">Select Active Incident...</option>
                      {allIncidents.filter(i => i.status !== "Resolved").map(inc => (
                        <option key={inc.id} value={inc.id}>
                          {inc.incident_code}: {inc.title.slice(0, 24)}...
                        </option>
                      ))}
                    </select>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={handleLinkIncident}
                      disabled={!selectedIncidentToLink || isLinkingIncident}
                      style={{ fontSize: "0.75rem" }}
                    >
                      {isLinkingIncident ? "..." : "Link"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Auto-Pilot Workflow Rules Card */}
            <div className="glass-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "0.4rem", margin: 0 }}>
                  <Zap size={16} color="#f59e0b" />
                  Auto-Pilot Rules
                </h3>
                <Link href="/automations" style={{ fontSize: "0.74rem", color: "#38bdf8", textDecoration: "none" }}>
                  Manage Rules
                </Link>
              </div>

              {automationFeedback && (
                <div style={{
                  fontSize: "0.78rem",
                  color: "#fde68a",
                  background: "rgba(245, 158, 11, 0.14)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  padding: "0.45rem 0.65rem",
                  borderRadius: "6px",
                  marginBottom: "0.65rem"
                }}>
                  {automationFeedback}
                </div>
              )}

              {automationLogs.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginBottom: "0.75rem", maxHeight: "140px", overflowY: "auto" }}>
                  {automationLogs.map((log: any) => (
                    <div key={log.id} style={{
                      fontSize: "0.78rem",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.07)",
                      borderRadius: "6px",
                      padding: "0.45rem 0.65rem"
                    }}>
                      <div style={{ fontWeight: 700, color: "#fbbf24" }}>⚡ {log.rule_name}</div>
                      <div style={{ color: "#94a3b8", fontSize: "0.72rem", marginTop: "0.15rem" }}>
                        {(log.actions_applied || []).join(" • ")}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.75rem" }}>
                  No automated workflow triggers have executed on this ticket yet.
                </p>
              )}

              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRunAutomations}
                disabled={runningAutomations}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", fontSize: "0.78rem" }}
              >
                <Zap size={14} color="#f59e0b" />
                {runningAutomations ? "Evaluating Rules..." : "Run Auto-Pilot Rules Now"}
              </button>
            </div>

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
                    <div style={{ fontWeight: 600, color: "#e2e8f0", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: 5 }}>
                      {renderSentimentIcon(ticket.sentiment)}
                      {ticket.sentiment}
                    </div>
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

        {/* Collaboration & Governance Workspace: Staff Notes & Audit Log */}
        <div style={{ marginTop: "2.5rem" }} id="collaboration-governance-hub">
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)", 
            paddingBottom: "0.85rem", 
            marginBottom: "1.25rem",
            flexWrap: "wrap",
            gap: "0.75rem"
          }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                id="tab-internal-notes"
                onClick={() => setActiveBottomTab("notes")}
                className={`btn ${activeBottomTab === "notes" ? "btn-warning" : "btn-outline"}`}
                style={{ fontSize: "0.85rem", padding: "0.5rem 1.1rem", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
              >
                <Lock size={15} /> Private Internal Notes & Handover
              </button>
              <button
                id="tab-audit-trail"
                onClick={() => setActiveBottomTab("audit")}
                className={`btn ${activeBottomTab === "audit" ? "btn-primary" : "btn-outline"}`}
                style={{ fontSize: "0.85rem", padding: "0.5rem 1.1rem", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
              >
                <History size={15} /> Audit Trail & Lifecycle Activity
              </button>
            </div>

            <button
              onClick={() => setWorkloadDrawerOpen(true)}
              className="btn btn-outline"
              style={{ fontSize: "0.82rem", padding: "0.45rem 0.85rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              <Users size={14} color="#60a5fa" /> Team Capacity Roster
            </button>
          </div>

          {activeBottomTab === "notes" ? (
            <InternalNotesSection 
              ticketId={ticket.id} 
              onActivityLogged={() => setAuditRefreshTrigger(t => t + 1)}
            />
          ) : (
            <TicketAuditTimeline 
              ticketId={ticket.id} 
              refreshTrigger={auditRefreshTrigger}
            />
          )}
        </div>
      </div>

      {/* Slide-out Team Workload Drawer */}
      <TeamWorkloadDrawer
        isOpen={workloadDrawerOpen}
        onClose={() => setWorkloadDrawerOpen(false)}
      />

      {/* Enterprise Smart Macros Modal */}
      <SmartMacrosModal
        isOpen={macrosModalOpen}
        onClose={() => setMacrosModalOpen(false)}
        ticket={ticket}
        onSelectMacro={(macroText) => setDraftText(macroText)}
      />
    </>
  );
}
