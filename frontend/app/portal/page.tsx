"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { 
  Sparkles, Send, CheckCircle2, Clock, ShieldCheck, 
  HelpCircle, ArrowLeft, Lightbulb, Star, MessageSquare, 
  ChevronRight, AlertCircle, RefreshCw, ThumbsUp 
} from "lucide-react";
import Navbar from "../components/Navbar";

export default function CustomerPortal() {
  // Form State
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [issueText, setIssueText] = useState("");
  const [urgency, setUrgency] = useState("Normal");
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<any>(null);

  // AI Deflection State
  const [deflectionResults, setDeflectionResults] = useState<string[]>([]);
  const [isSearchingDeflection, setIsSearchingDeflection] = useState(false);
  const [deflectedCount, setDeflectedCount] = useState(0);
  const [problemSolvedNotice, setProblemSolvedNotice] = useState(false);

  // Customer Tickets Tracker
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Customer CSAT rating state
  const [ratedTickets, setRatedTickets] = useState<Record<number, number>>({});

  useEffect(() => {
    fetchRecentCustomerTickets();
  }, []);

  const fetchRecentCustomerTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/tickets");
      setRecentTickets(res.data.slice(0, 5));
    } catch (e) {
      console.error("Failed to load customer tickets", e);
    } finally {
      setLoadingTickets(false);
    }
  };

  // Debounced AI Deflection search
  useEffect(() => {
    if (!issueText || issueText.length < 15) {
      setDeflectionResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingDeflection(true);
      try {
        const res = await axios.post("http://127.0.0.1:8000/api/portal/deflect", {
          query: issueText
        });
        setDeflectionResults(res.data?.suggestions || []);
      } catch (e) {
        // Fallback heuristics if endpoint not ready
        setDeflectionResults([]);
      } finally {
        setIsSearchingDeflection(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [issueText]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueText.trim()) return;

    setSubmitting(true);
    try {
      const fullPrompt = `Customer: ${customerName || "Customer"} (${customerEmail || "customer@example.com"})\nReported Issue: ${issueText}`;
      const res = await axios.post("http://127.0.0.1:8000/api/tickets/classify", {
        ticket_text: fullPrompt,
        provider: "Auto"
      });

      setSubmittedTicket({
        id: res.data.id,
        classification: res.data.classification,
        customerName: customerName || "Customer",
        customerEmail: customerEmail || "customer@example.com"
      });

      // Reset form
      setIssueText("");
      setDeflectionResults([]);
      fetchRecentCustomerTickets();
    } catch (e: any) {
      console.error("Ticket submission failed", e);
      alert("Failed to submit ticket. Please check backend connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeflected = () => {
    setDeflectedCount(prev => prev + 1);
    setProblemSolvedNotice(true);
    setIssueText("");
    setDeflectionResults([]);
    setTimeout(() => setProblemSolvedNotice(false), 5000);
  };

  const handleRateTicket = async (ticketId: number, rating: number) => {
    try {
      await axios.post(`http://127.0.0.1:8000/api/tickets/${ticketId}/csat`, {
        rating: rating,
        feedback_tag: rating === 5 ? "⚡ Super Fast Resolution" : "🎯 Helpful Support",
        comment: "Rated via Customer Self-Service Portal.",
        customer_name: customerName || "Customer"
      });
      setRatedTickets(prev => ({ ...prev, [ticketId]: rating }));
    } catch (e) {
      console.error("Failed to rate ticket", e);
    }
  };

  return (
    <>
      <Navbar />

      <div className="container" style={{ maxWidth: 1040, paddingBottom: "4rem" }}>
        {/* Top Switcher Banner */}
        <div style={{
          background: "linear-gradient(90deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))",
          border: "1px solid rgba(59, 130, 246, 0.25)",
          borderRadius: 12,
          padding: "0.75rem 1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.75rem",
          flexWrap: "wrap",
          gap: "0.5rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} color="#60a5fa" />
            <span style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>
              Viewing <strong>Customer Self-Service Portal</strong>. Switch back to Internal Agent Desk anytime.
            </span>
          </div>
          <Link href="/" className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <ArrowLeft size={14} /> Agent Console
          </Link>
        </div>

        {/* Portal Hero */}
        <div style={{ textAlign: "center", marginBottom: "2.25rem" }}>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
            Customer Help & Resolution Portal
          </h1>
          <p style={{ color: "#94a3b8", marginTop: "0.5rem", fontSize: "1rem", maxWidth: 640, margin: "0.5rem auto 0" }}>
            Get instant assistance powered by AI knowledge base deflection or submit a ticket directly to our tier support specialists.
          </p>
        </div>

        {/* Problem Solved Deflection Alert */}
        {problemSolvedNotice && (
          <div style={{
            background: "rgba(16, 185, 129, 0.2)",
            border: "1px solid #10b981",
            borderRadius: 10,
            padding: "1rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            color: "#34d399"
          }}>
            <CheckCircle2 size={20} />
            <div>
              <strong>Fantastic! We are delighted the policy guide resolved your issue.</strong>
              <div style={{ fontSize: "0.82rem", color: "#a7f3d0" }}>
                Ticket deflected. No further waiting required!
              </div>
            </div>
          </div>
        )}

        {/* Success Confirmation Card */}
        {submittedTicket && (
          <div className="glass-card" style={{
            padding: "1.5rem",
            marginBottom: "2rem",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            background: "rgba(16, 185, 129, 0.08)"
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(16, 185, 129, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <CheckCircle2 size={24} color="#10b981" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#f8fafc" }}>
                    Ticket #{submittedTicket.id} Successfully Ingested!
                  </h3>
                  <span className="badge badge-green">Open & Assigned</span>
                </div>
                <p style={{ margin: "0.4rem 0 1rem 0", color: "#cbd5e1", fontSize: "0.9rem" }}>
                  Thank you, <strong>{submittedTicket.customerName}</strong>. Our LangGraph AI has routed your request to the <strong>{submittedTicket.classification.assigned_team}</strong> team.
                </p>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "0.75rem",
                  background: "rgba(15, 23, 42, 0.6)",
                  padding: "0.88rem",
                  borderRadius: 8,
                  fontSize: "0.82rem"
                }}>
                  <div>
                    <span style={{ color: "#94a3b8" }}>Priority Level:</span>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>{submittedTicket.classification.priority}</div>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8" }}>Target SLA:</span>
                    <div style={{ fontWeight: 600, color: "#34d399" }}>
                      {submittedTicket.classification.priority === "High" ? "Under 4 Hours" : "Under 12 Hours"}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8" }}>Issue Category:</span>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>{submittedTicket.classification.category}</div>
                  </div>
                </div>

                <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
                  <Link href={`/tickets/${submittedTicket.id}`} className="btn btn-primary btn-sm">
                    View Ticket Detail
                  </Link>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSubmittedTicket(null)}
                  >
                    Submit Another Request
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem" }}>
          {/* Left Column: Ticket Ingestion Form */}
          <div className="glass-card" style={{ padding: "1.5rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.18rem", fontWeight: 600, color: "#f8fafc", marginBottom: "0.25rem" }}>
              Submit a Support Ticket
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "0.82rem", margin: "0 0 1.25rem 0" }}>
              Our AI workflow triages and routes your message directly to specialists.
            </p>

            <form onSubmit={handleSubmitTicket} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "#cbd5e1", marginBottom: 4 }}>
                    Your Name
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Alex Johnson"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="search-input"
                    style={{ width: "100%", fontSize: "0.85rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "#cbd5e1", marginBottom: 4 }}>
                    Email Address
                  </label>
                  <input 
                    type="email"
                    required
                    placeholder="alex@company.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="search-input"
                    style={{ width: "100%", fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", color: "#cbd5e1", marginBottom: 4 }}>
                  How can we help you? Describe your issue in detail:
                </label>
                <textarea 
                  required
                  rows={5}
                  placeholder="Describe what happened, any error messages, or transaction reference numbers..."
                  value={issueText}
                  onChange={(e) => setIssueText(e.target.value)}
                  className="search-input"
                  style={{ width: "100%", fontSize: "0.88rem", lineHeight: 1.5, resize: "vertical" }}
                />
              </div>

              {/* Real-time AI Knowledge Base Deflection Assistant */}
              {isSearchingDeflection && (
                <div style={{ fontSize: "0.78rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
                  <RefreshCw size={13} className="animate-spin" />
                  Searching knowledge base for instant answers...
                </div>
              )}

              {deflectionResults.length > 0 && (
                <div style={{
                  background: "rgba(139, 92, 246, 0.12)",
                  border: "1px solid rgba(139, 92, 246, 0.3)",
                  borderRadius: 10,
                  padding: "1rem"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.5rem" }}>
                    <Lightbulb size={16} color="#fbbf24" />
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#f8fafc" }}>
                      Instant Solution Found in Knowledge Base:
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#cbd5e1", lineHeight: 1.5, background: "rgba(15, 23, 42, 0.5)", padding: "0.75rem", borderRadius: 6 }}>
                    {deflectionResults[0]}
                  </div>

                  <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={handleDeflected}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4, background: "rgba(16, 185, 129, 0.2)", color: "#34d399", border: "1px solid #10b981" }}
                    >
                      <ThumbsUp size={13} />
                      This Solved My Issue!
                    </button>
                  </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={submitting || !issueText.trim()}
                className="btn btn-primary"
                style={{
                  background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "0.75rem"
                }}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Ingesting & Triaging Ticket...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Submit Support Request
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Track My Tickets & CSAT */}
          <div className="glass-card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.18rem", fontWeight: 600, color: "#f8fafc" }}>
                Recent Support Requests
              </h2>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                Live Status Tracker
              </span>
            </div>

            {loadingTickets ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                Loading tickets...
              </div>
            ) : recentTickets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                No active tickets found.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {recentTickets.map((t) => {
                  const isResolved = t.status === "Resolved";
                  const rating = ratedTickets[t.id] || t.csat_score;
                  return (
                    <div 
                      key={t.id}
                      style={{
                        background: "rgba(15, 23, 42, 0.4)",
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                        borderRadius: 10,
                        padding: "0.88rem"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f1f5f9" }}>
                          Ticket #{t.id}
                        </span>
                        <span style={{
                          fontSize: "0.72rem",
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: isResolved ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)",
                          color: isResolved ? "#34d399" : "#60a5fa"
                        }}>
                          {t.status}
                        </span>
                      </div>

                      <p style={{ margin: "0.25rem 0 0.5rem 0", color: "#94a3b8", fontSize: "0.78rem", lineClamp: 2, overflow: "hidden" }}>
                        {t.summary || t.ticket_text?.slice(0, 90)}...
                      </p>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "#64748b" }}>
                        <span>Assigned to: {t.assigned_team}</span>
                        <Link href={`/tickets/${t.id}`} style={{ color: "#a78bfa", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 2 }}>
                          Details <ChevronRight size={12} />
                        </Link>
                      </div>

                      {/* Direct CSAT Rating Widget for Resolved Tickets */}
                      {isResolved && (
                        <div style={{ marginTop: "0.6rem", paddingTop: "0.5rem", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "0.72rem", color: "#cbd5e1" }}>Rate resolution:</span>
                          <div style={{ display: "flex", gap: 3 }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleRateTicket(t.id, star)}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                                title={`${star} Star`}
                              >
                                <Star 
                                  size={15} 
                                  color={(rating && rating >= star) ? "#fbbf24" : "#475569"} 
                                  fill={(rating && rating >= star) ? "#fbbf24" : "none"} 
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
