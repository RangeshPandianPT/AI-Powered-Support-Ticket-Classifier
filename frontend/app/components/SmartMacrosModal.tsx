"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Zap, X, Search, Check, Copy, Sparkles, Filter, 
  ArrowRight, ShieldCheck, Tag, FileText, CheckCircle2 
} from "lucide-react";

interface SmartMacrosModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: any;
  onSelectMacro: (macroText: string) => void;
}

export default function SmartMacrosModal({
  isOpen,
  onClose,
  ticket,
  onSelectMacro
}: SmartMacrosModalProps) {
  const [macros, setMacros] = useState<any[]>([]);
  const [recommended, setRecommended] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeMacro, setActiveMacro] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchMacros();
    }
  }, [isOpen, ticket?.id]);

  const fetchMacros = async () => {
    setLoading(true);
    try {
      const [allRes, recRes] = await Promise.all([
        axios.get("http://127.0.0.1:8000/api/macros"),
        ticket?.id ? axios.get(`http://127.0.0.1:8000/api/tickets/${ticket.id}/macros/recommend`) : Promise.resolve({ data: [] })
      ]);
      setMacros(allRes.data || []);
      setRecommended(recRes.data || []);
      if (recRes.data && recRes.data.length > 0) {
        setActiveMacro(recRes.data[0]);
      } else if (allRes.data && allRes.data.length > 0) {
        setActiveMacro(allRes.data[0]);
      }
    } catch (e) {
      console.error("Failed to load macros", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const categories = ["All", "Billing", "Technical Support", "Shipping", "Executive Escalations", "Product Inquiry"];

  const filteredMacros = macros.filter((m) => {
    const matchesCat = selectedCategory === "All" || m.category.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesSearch = 
      m.title.toLowerCase().includes(search.toLowerCase()) || 
      m.template_text.toLowerCase().includes(search.toLowerCase()) ||
      (m.tags && m.tags.some((t: string) => t.toLowerCase().includes(search.toLowerCase())));
    return matchesCat && matchesSearch;
  });

  const getInterpolatedText = (macro: any) => {
    if (!macro) return "";
    let text = macro.template_text || "";
    const replacements: Record<string, string> = {
      "{{customer_name}}": "Customer",
      "{{ticket_id}}": ticket?.id ? String(ticket.id) : "001",
      "{{category}}": ticket?.category || "General Support",
      "{{priority}}": ticket?.priority || "Medium",
      "{{assigned_team}}": ticket?.assigned_team || "Support Team",
      "{{agent_name}}": ticket?.assignee_name || "Support Specialist",
      "{{date}}": new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    };

    for (const [key, val] of Object.entries(replacements)) {
      text = text.replaceAll(key, val);
    }
    return text;
  };

  const handleApply = () => {
    if (!activeMacro) return;
    const finalContent = getInterpolatedText(activeMacro);
    onSelectMacro(finalContent);
    setApplied(true);
    setTimeout(() => {
      setApplied(false);
      onClose();
    }, 1200);
  };

  const handleCopy = () => {
    if (!activeMacro) return;
    const finalContent = getInterpolatedText(activeMacro);
    navigator.clipboard.writeText(finalContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(3, 7, 18, 0.75)",
      backdropFilter: "blur(8px)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "1rem"
    }}>
      <div style={{
        background: "#0f172a",
        border: "1px solid rgba(139, 92, 246, 0.3)",
        borderRadius: 16,
        width: "100%",
        maxWidth: 960,
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
      }}>
        {/* Header */}
        <div style={{
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(139, 92, 246, 0.3)"
            }}>
              <Zap size={18} color="#60a5fa" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600, color: "#f8fafc" }}>
                Enterprise Smart Macros Library
              </h2>
              <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                Standardized, compliant one-click responses with dynamic placeholder interpolation
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: 6,
              borderRadius: 8
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div style={{
          padding: "0.88rem 1.5rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
          background: "rgba(15, 23, 42, 0.5)"
        }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
            <input 
              type="text"
              placeholder="Search macros by keyword, tag, or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
              style={{ paddingLeft: 32, fontSize: "0.85rem", width: "100%" }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto" }}>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCategory(c)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: "0.75rem",
                  background: selectedCategory === c ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.05)",
                  border: selectedCategory === c ? "1px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.08)",
                  color: selectedCategory === c ? "#93c5fd" : "#94a3b8",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* AI Recommendations Banner */}
        {recommended.length > 0 && !search && selectedCategory === "All" && (
          <div style={{
            padding: "0.6rem 1.5rem",
            background: "linear-gradient(90deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.15))",
            borderBottom: "1px solid rgba(139, 92, 246, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem"
          }}>
            <Sparkles size={16} color="#a78bfa" />
            <span style={{ fontSize: "0.8rem", color: "#c4b5fd", fontWeight: 500 }}>
              AI Ticket Recommendation:
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {recommended.slice(0, 2).map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setActiveMacro(rec)}
                  style={{
                    background: activeMacro?.id === rec.id ? "rgba(139, 92, 246, 0.4)" : "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(139, 92, 246, 0.4)",
                    color: "#f8fafc",
                    padding: "2px 8px",
                    borderRadius: 6,
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <span>{rec.title}</span>
                  <span style={{ fontSize: "0.7rem", color: "#34d399" }}>{rec.match_confidence}% Match</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Split Pane: Macro List & Live Preview */}
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", flex: 1, minHeight: 420, overflow: "hidden" }}>
          {/* Left: Macro List */}
          <div style={{
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            overflowY: "auto",
            padding: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem"
          }}>
            {filteredMacros.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#64748b", fontSize: "0.85rem" }}>
                No macros match your filter.
              </div>
            ) : (
              filteredMacros.map((m) => {
                const isSelected = activeMacro?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setActiveMacro(m)}
                    style={{
                      padding: "0.75rem",
                      borderRadius: 10,
                      cursor: "pointer",
                      background: isSelected ? "rgba(59, 130, 246, 0.15)" : "rgba(15, 23, 42, 0.4)",
                      border: isSelected ? "1px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.05)",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: isSelected ? "#93c5fd" : "#f1f5f9" }}>
                        {m.title}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                      <span style={{ fontSize: "0.68rem", padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "#94a3b8" }}>
                        {m.category}
                      </span>
                      {(m.tags || []).slice(0, 2).map((t: string) => (
                        <span key={t} style={{ fontSize: "0.68rem", padding: "1px 6px", borderRadius: 4, background: "rgba(139, 92, 246, 0.15)", color: "#c4b5fd" }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Live Interpolated Preview */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "rgba(10, 15, 30, 0.6)"
          }}>
            {activeMacro ? (
              <>
                <div style={{
                  padding: "1rem 1.25rem",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 600, color: "#f8fafc" }}>
                      {activeMacro.title}
                    </h3>
                    <span style={{ fontSize: "0.75rem", color: "#34d399", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={12} /> Placeholders populated with Ticket #{ticket?.id || "N/A"} context
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleCopy}
                      title="Copy to clipboard"
                    >
                      {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleApply}
                      style={{
                        background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      {applied ? <Check size={14} /> : <Zap size={14} />}
                      {applied ? "Applied!" : "Insert into Draft"}
                    </button>
                  </div>
                </div>

                <div style={{ padding: "1.25rem", flex: 1, overflowY: "auto" }}>
                  <pre style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    fontSize: "0.88rem",
                    lineHeight: 1.6,
                    color: "#cbd5e1",
                    background: "rgba(15, 23, 42, 0.7)",
                    padding: "1rem",
                    borderRadius: 10,
                    border: "1px solid rgba(255, 255, 255, 0.06)"
                  }}>
                    {getInterpolatedText(activeMacro)}
                  </pre>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#64748b" }}>
                Select a macro from the list to preview.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
