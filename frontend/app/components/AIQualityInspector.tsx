"use client";
import { useState } from "react";
import axios from "axios";
import { 
  ShieldCheck, Sparkles, CheckCircle2, AlertCircle, 
  ThumbsUp, Star, Wand2, RefreshCw, Award, HeartHandshake, 
  FileCheck2, Compass, MessageSquareQuote, Check
} from "lucide-react";

interface AIQualityInspectorProps {
  ticket: any;
  draftText: string;
  onApplyPolishedDraft: (newDraft: string) => void;
  onRefreshTicket?: () => void;
}

export default function AIQualityInspector({
  ticket,
  draftText,
  onApplyPolishedDraft,
  onRefreshTicket
}: AIQualityInspectorProps) {
  const [loading, setLoading] = useState(false);
  const [qaResult, setQaResult] = useState<any>(null);
  const [copiedPolished, setCopiedPolished] = useState(false);

  // CSAT Survey Simulator State
  const [starRating, setStarRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedTag, setSelectedTag] = useState("⚡ Super Fast Resolution");
  const [csatComment, setCsatComment] = useState("");
  const [submittingCsat, setSubmittingCsat] = useState(false);
  const [csatSubmitted, setCsatSubmitted] = useState(false);

  const CSAT_TAGS = [
    "⚡ Super Fast Resolution",
    "❤️ Highly Empathetic",
    "🎯 Clear Resolution Steps",
    "💡 Grounded & Accurate Policy",
    "⚠️ Needed Additional Follow-up"
  ];

  const handleRunQAAudit = async () => {
    if (!ticket?.id) return;
    setLoading(true);
    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/tickets/${ticket.id}/qa-audit`, {
        draft_text: draftText || ticket.draft_response || ""
      });
      setQaResult(res.data);
      if (onRefreshTicket) onRefreshTicket();
    } catch (e) {
      console.error("QA Audit failed", e);
      alert("Failed to run QA audit. Backend may be offline.");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPolish = () => {
    if (qaResult?.auto_polish_draft) {
      onApplyPolishedDraft(qaResult.auto_polish_draft);
      setCopiedPolished(true);
      setTimeout(() => setCopiedPolished(false), 2500);
    }
  };

  const handleSubmitCSAT = async () => {
    if (!ticket?.id) return;
    setSubmittingCsat(true);
    try {
      await axios.post(`http://127.0.0.1:8000/api/tickets/${ticket.id}/csat`, {
        rating: starRating,
        feedback_tag: selectedTag,
        comment: csatComment || "Fast and accurate customer support resolution.",
        customer_name: "Customer (Simulated)"
      });
      setCsatSubmitted(true);
      if (onRefreshTicket) onRefreshTicket();
      setTimeout(() => setCsatSubmitted(false), 4000);
    } catch (e) {
      console.error("CSAT submission failed", e);
      alert("Failed to submit CSAT rating.");
    } finally {
      setSubmittingCsat(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "#10b981";
    if (score >= 75) return "#3b82f6";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="glass-card" style={{ marginTop: "1.5rem", border: "1px solid rgba(139, 92, 246, 0.25)" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(139, 92, 246, 0.3)"
          }}>
            <ShieldCheck size={20} color="#a78bfa" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.08rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              AI Response Quality Assurance (QA) Sentinel
              <span className="badge badge-purple" style={{ fontSize: "0.72rem" }}>Enterprise Rubric</span>
            </h3>
            <p style={{ margin: "2px 0 0 0", color: "#94a3b8", fontSize: "0.82rem" }}>
              Audits outbound draft responses against empathy, compliance, and resolution completeness
            </p>
          </div>
        </div>

        <button 
          className="btn btn-secondary btn-sm"
          onClick={handleRunQAAudit}
          disabled={loading}
          style={{ minWidth: 160 }}
        >
          {loading ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Auditing Draft...
            </>
          ) : (
            <>
              <Sparkles size={14} color="#a78bfa" />
              Run Quality Audit
            </>
          )}
        </button>
      </div>

      {/* QA Results Presentation */}
      {qaResult ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Top Score Summary Banner */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: "1.5rem",
            background: "rgba(15, 23, 42, 0.6)",
            padding: "1.25rem",
            borderRadius: 12,
            border: `1px solid ${getScoreColor(qaResult.overall_score)}40`
          }}>
            {/* Big Score Gauge */}
            <div style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: `conic-gradient(${getScoreColor(qaResult.overall_score)} ${qaResult.overall_score * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 6
            }}>
              <div style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: "#0f172a",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <span style={{ fontSize: "1.25rem", fontWeight: 700, color: getScoreColor(qaResult.overall_score), lineHeight: 1 }}>
                  {qaResult.overall_score}%
                </span>
                <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 500 }}>
                  Grade {qaResult.grade}
                </span>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Award size={18} color={getScoreColor(qaResult.overall_score)} />
                <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: "1rem" }}>
                  QA Rating: Grade {qaResult.grade}
                </span>
                <span style={{
                  fontSize: "0.75rem",
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: qaResult.overall_score >= 85 ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                  color: qaResult.overall_score >= 85 ? "#34d399" : "#fbbf24"
                }}>
                  {qaResult.overall_score >= 85 ? "Ready to Dispatch" : "Needs Minor Revisions"}
                </span>
              </div>
              <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "0.85rem" }}>
                Draft evaluated across 4 pillars. {qaResult.strengths?.[0] || "Response is professional and grounded in support policies."}
              </p>
            </div>

            {qaResult.auto_polish_draft && (
              <button 
                className="btn btn-sm"
                onClick={handleApplyPolish}
                style={{
                  background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
                  boxShadow: "0 0 15px rgba(139, 92, 246, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                {copiedPolished ? (
                  <>
                    <Check size={14} />
                    Applied to Draft!
                  </>
                ) : (
                  <>
                    <Wand2 size={14} />
                    Apply AI Polish (100%)
                  </>
                )}
              </button>
            )}
          </div>

          {/* 4 Rubric Bars */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.75rem" }}>
            <div style={{ background: "rgba(15, 23, 42, 0.4)", padding: "0.88rem", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.35rem" }}>
                <span style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                  <HeartHandshake size={14} color="#ec4899" /> Empathy & Sentiment
                </span>
                <span style={{ fontWeight: 600, color: getScoreColor(qaResult.empathy_score) }}>{qaResult.empathy_score}%</span>
              </div>
              <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${qaResult.empathy_score}%`, height: "100%", background: "#ec4899", borderRadius: 3 }} />
              </div>
            </div>

            <div style={{ background: "rgba(15, 23, 42, 0.4)", padding: "0.88rem", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.35rem" }}>
                <span style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                  <FileCheck2 size={14} color="#10b981" /> Policy & KB Adherence
                </span>
                <span style={{ fontWeight: 600, color: getScoreColor(qaResult.policy_score) }}>{qaResult.policy_score}%</span>
              </div>
              <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${qaResult.policy_score}%`, height: "100%", background: "#10b981", borderRadius: 3 }} />
              </div>
            </div>

            <div style={{ background: "rgba(15, 23, 42, 0.4)", padding: "0.88rem", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.35rem" }}>
                <span style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                  <Compass size={14} color="#3b82f6" /> Actionability & SLA
                </span>
                <span style={{ fontWeight: 600, color: getScoreColor(qaResult.actionability_score) }}>{qaResult.actionability_score}%</span>
              </div>
              <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${qaResult.actionability_score}%`, height: "100%", background: "#3b82f6", borderRadius: 3 }} />
              </div>
            </div>

            <div style={{ background: "rgba(15, 23, 42, 0.4)", padding: "0.88rem", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.35rem" }}>
                <span style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                  <MessageSquareQuote size={14} color="#a855f7" /> Clarity & Tone
                </span>
                <span style={{ fontWeight: 600, color: getScoreColor(qaResult.clarity_score) }}>{qaResult.clarity_score}%</span>
              </div>
              <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${qaResult.clarity_score}%`, height: "100%", background: "#a855f7", borderRadius: 3 }} />
              </div>
            </div>
          </div>

          {/* Checklist & Suggestions Two-Column */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            {/* Compliance Checklist */}
            <div style={{ background: "rgba(15, 23, 42, 0.4)", padding: "1rem", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle2 size={15} color="#10b981" />
                Response Rubric Checklist
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {(qaResult.checklist || []).map((c: any, idx: number) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.8rem", color: c.passed ? "#94a3b8" : "#fca5a5" }}>
                    <span>{c.item}</span>
                    <span style={{
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontSize: "0.72rem",
                      background: c.passed ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: c.passed ? "#34d399" : "#f87171"
                    }}>
                      {c.passed ? "Pass" : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Improvement Suggestions */}
            <div style={{ background: "rgba(15, 23, 42, 0.4)", padding: "1rem", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={15} color="#fbbf24" />
                AI QA Recommendations
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#94a3b8", fontSize: "0.8rem", lineHeight: 1.5 }}>
                {(qaResult.suggestions || []).map((s: string, idx: number) => (
                  <li key={idx} style={{ marginBottom: "0.3rem" }}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          textAlign: "center",
          padding: "1.75rem",
          background: "rgba(15, 23, 42, 0.3)",
          borderRadius: 10,
          border: "1px dashed rgba(255, 255, 255, 0.1)"
        }}>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>
            Draft response has not been audited yet. Click <strong>Run Quality Audit</strong> to evaluate against enterprise empathy, SLA, and policy standards.
          </p>
        </div>
      )}

      {/* CSAT Customer Feedback Simulator Section */}
      <div style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid rgba(255, 255, 255, 0.07)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "#f8fafc", display: "flex", alignItems: "center", gap: 6 }}>
              <Star size={16} color="#fbbf24" fill="#fbbf24" />
              Customer CSAT Feedback Simulator
            </h4>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
              Simulate customer survey reaction to this ticket resolution
            </span>
          </div>

          {ticket?.csat_score && (
            <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: 6, background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
              Current Rating: {ticket.csat_score} / 5 Stars
            </span>
          )}
        </div>

        <div style={{ background: "rgba(15, 23, 42, 0.4)", padding: "1rem", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>Rating:</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setStarRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 2,
                    display: "flex"
                  }}
                  title={`${star} Star`}
                >
                  <Star 
                    size={22} 
                    color={(hoverRating !== null ? hoverRating >= star : starRating >= star) ? "#fbbf24" : "#475569"} 
                    fill={(hoverRating !== null ? hoverRating >= star : starRating >= star) ? "#fbbf24" : "none"} 
                  />
                </button>
              ))}
            </div>
            <span style={{ fontSize: "0.82rem", color: "#94a3b8", fontWeight: 500 }}>
              {starRating === 5 ? "Delighted (5/5)" : starRating === 4 ? "Satisfied (4/5)" : starRating === 3 ? "Neutral (3/5)" : "Dissatisfied"}
            </span>
          </div>

          {/* Quick Tag Selector */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
            {CSAT_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 16,
                  fontSize: "0.75rem",
                  background: selectedTag === tag ? "rgba(139, 92, 246, 0.3)" : "rgba(255, 255, 255, 0.05)",
                  border: selectedTag === tag ? "1px solid #8b5cf6" : "1px solid rgba(255, 255, 255, 0.08)",
                  color: selectedTag === tag ? "#c4b5fd" : "#94a3b8",
                  cursor: "pointer"
                }}
              >
                {tag}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input 
              type="text"
              className="search-input"
              style={{ fontSize: "0.82rem", padding: "0.45rem 0.75rem" }}
              placeholder="Add optional customer comment..."
              value={csatComment}
              onChange={(e) => setCsatComment(e.target.value)}
            />
            <button 
              className="btn btn-primary btn-sm"
              onClick={handleSubmitCSAT}
              disabled={submittingCsat}
              style={{ minWidth: 120 }}
            >
              {submittingCsat ? "Recording..." : csatSubmitted ? "Saved!" : "Submit CSAT"}
            </button>
          </div>

          {csatSubmitted && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "#34d399", display: "flex", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={14} /> CSAT survey recorded successfully! Aggregated to team analytics.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
