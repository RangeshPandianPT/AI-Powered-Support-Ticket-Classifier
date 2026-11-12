"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { 
  Zap, Plus, Play, CheckCircle2, Trash2, Power, RefreshCw, 
  Clock, Activity, ShieldCheck, X, ArrowRight, Sparkles, 
  ExternalLink, AlertCircle
} from "lucide-react";
import Navbar from "../components/Navbar";

interface ConditionItem {
  field: string;
  operator: string;
  value: string;
}

interface ActionItem {
  type: string;
  value: string;
}

export default function AutomationsPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulator State
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  // Create Rule Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleDesc, setRuleDesc] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("ON_INGEST");
  const [conditions, setConditions] = useState<ConditionItem[]>([
    { field: "priority", operator: "equals", value: "High" }
  ]);
  const [actions, setActions] = useState<ActionItem[]>([
    { type: "assign_agent", value: "Sarah Chen" }
  ]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, logsRes, ticketsRes] = await Promise.all([
        axios.get("http://127.0.0.1:8000/api/automations"),
        axios.get("http://127.0.0.1:8000/api/automations/logs"),
        axios.get("http://127.0.0.1:8000/api/tickets")
      ]);
      setRules(rulesRes.data || []);
      setLogs(logsRes.data || []);
      const tktList = ticketsRes.data || [];
      setTickets(tktList);
      if (tktList.length > 0 && !selectedTicketId) {
        setSelectedTicketId(String(tktList[0].id));
      }
    } catch (e) {
      console.error("Failed to fetch automation data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRule = async (ruleId: number) => {
    try {
      const res = await axios.put(`http://127.0.0.1:8000/api/automations/${ruleId}/toggle`);
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: res.data.is_active } : r));
    } catch (e) {
      console.error("Failed to toggle rule", e);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm("Delete this automation rule?")) return;
    try {
      await axios.delete(`http://127.0.0.1:8000/api/automations/${ruleId}`);
      setRules(prev => prev.filter(r => r.id !== ruleId));
    } catch (e) {
      console.error("Failed to delete rule", e);
    }
  };

  const handleRunSimulation = async (dryRun: boolean) => {
    if (!selectedTicketId) return;
    setSimulating(true);
    setSimResult(null);
    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/tickets/${selectedTicketId}/automations/run`, {
        dry_run: dryRun,
        trigger_event: "ON_MANUAL"
      });
      setSimResult(res.data);
      if (!dryRun) {
        await fetchData();
      }
    } catch (e) {
      console.error("Rule evaluation failed", e);
    } finally {
      setSimulating(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;
    setCreating(true);
    try {
      await axios.post("http://127.0.0.1:8000/api/automations", {
        name: ruleName,
        description: ruleDesc,
        trigger_event: triggerEvent,
        conditions,
        actions
      });
      setCreateOpen(false);
      setRuleName("");
      setRuleDesc("");
      setConditions([{ field: "priority", operator: "equals", value: "High" }]);
      setActions([{ type: "assign_agent", value: "Sarah Chen" }]);
      await fetchData();
    } catch (e) {
      console.error("Failed to create rule", e);
    } finally {
      setCreating(false);
    }
  };

  const activeRulesCount = rules.filter(r => r.is_active).length;
  const totalExecutions = rules.reduce((sum, r) => sum + (r.execution_count || 0), 0);
  const hoursSaved = (totalExecutions * 0.12).toFixed(1);

  return (
    <div className="layout">
      <Navbar />

      <main className="container" style={{ paddingBottom: "4rem" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.5rem", marginBottom: "0.75rem", fontSize: "0.85rem", color: "#94a3b8" }}>
          <Link href="/" style={{ color: "#94a3b8", textDecoration: "none" }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: "#38bdf8", fontWeight: 600 }}>Auto-Pilot Workflow Engine</span>
        </div>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div style={{
              background: "linear-gradient(135deg, #f59e0b, #ea580c)",
              padding: "10px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 18px rgba(245, 158, 11, 0.35)"
            }}>
              <Zap size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                Auto-Pilot Workflow & Trigger Rules
              </h1>
              <p style={{ color: "#94a3b8", fontSize: "0.88rem", marginTop: "0.2rem" }}>
                Define automated IF/THEN rules to route VIP tickets, link outages, stage macros, and recover low CSAT scores in real time.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setCreateOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
            >
              <Plus size={16} />
              Create Trigger Rule
            </button>
            <button className="btn btn-secondary btn-sm" onClick={fetchData} title="Refresh">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ background: "rgba(245, 158, 11, 0.2)", padding: 12, borderRadius: 10, color: "#fbbf24" }}>
              <Zap size={22} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>Active Rules</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>{activeRulesCount} / {rules.length}</div>
              <div style={{ fontSize: "0.72rem", color: "#10b981" }}>Listening on Ingest & CSAT</div>
            </div>
          </div>

          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ background: "rgba(59, 130, 246, 0.2)", padding: 12, borderRadius: 10, color: "#60a5fa" }}>
              <Activity size={22} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>Total Executions</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>{totalExecutions}</div>
              <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Automated Actions Fired</div>
            </div>
          </div>

          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ background: "rgba(16, 185, 129, 0.2)", padding: 12, borderRadius: 10, color: "#34d399" }}>
              <Clock size={22} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>Agent Time Saved</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>{hoursSaved}h</div>
              <div style={{ fontSize: "0.72rem", color: "#34d399" }}>Zero-touch Triage Overhead</div>
            </div>
          </div>

          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ background: "rgba(139, 92, 246, 0.2)", padding: 12, borderRadius: 10, color: "#a78bfa" }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>Audit Coverage</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>100%</div>
              <div style={{ fontSize: "0.72rem", color: "#a78bfa" }}>Full Action Traceability</div>
            </div>
          </div>
        </div>

        {/* Rule Simulator & Tester Card */}
        <div className="glass-card" style={{ marginBottom: "1.75rem", border: "1px solid rgba(56, 189, 248, 0.25)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "0.75rem" }}>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Sparkles size={18} color="#38bdf8" />
                Live Rule Simulator & Dry-Run Tester
              </h2>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "0.2rem 0 0" }}>
                Test active automation rules against any ticket without modifying state (Dry Run) or apply them immediately.
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={selectedTicketId}
                onChange={e => setSelectedTicketId(e.target.value)}
                className="input-select"
                style={{ minWidth: 260, fontSize: "0.85rem", padding: "0.4rem 0.65rem" }}
              >
                {tickets.map(t => (
                  <option key={t.id} value={t.id}>
                    #{t.id} [{t.priority}] {(t.summary || t.ticket_text || "").slice(0, 42)}...
                  </option>
                ))}
              </select>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleRunSimulation(true)}
                disabled={simulating || !selectedTicketId}
              >
                <Play size={14} /> {simulating ? "Testing..." : "Dry Run Test"}
              </button>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleRunSimulation(false)}
                disabled={simulating || !selectedTicketId}
                style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)" }}
              >
                <Zap size={14} /> Execute Live
              </button>
            </div>
          </div>

          {simResult && (
            <div style={{
              marginTop: "0.85rem",
              background: "rgba(15, 23, 42, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
              padding: "0.9rem 1rem"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#e2e8f0" }}>
                  {simResult.dry_run ? "🔍 Dry-Run Trace" : "⚡ Live Execution Result"} — Ticket #{simResult.ticket_id}
                </div>
                <span className={`badge ${simResult.rules_matched > 0 ? "badge-success" : "badge-neutral"}`}>
                  {simResult.rules_matched} / {simResult.rules_evaluated} Rules Matched
                </span>
              </div>

              {simResult.matches.length === 0 ? (
                <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                  No active rules matched this ticket's attributes.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {simResult.matches.map((m: any, idx: number) => (
                    <div key={idx} style={{
                      background: "rgba(16, 185, 129, 0.08)",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                      borderRadius: "6px",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.82rem"
                    }}>
                      <strong style={{ color: "#34d399" }}>✔ {m.rule_name}</strong>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                        {m.actions_applied.map((act: string, aIdx: number) => (
                          <span key={aIdx} style={{
                            background: "rgba(255, 255, 255, 0.07)",
                            padding: "2px 7px",
                            borderRadius: "4px",
                            color: "#e2e8f0",
                            fontSize: "0.75rem"
                          }}>
                            → {act}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Configured Rules List */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", marginBottom: "1rem" }}>
          Configured Workflow Rules ({rules.length})
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2.5rem" }}>
          {rules.map(rule => (
            <div
              key={rule.id}
              className="glass-card"
              style={{
                opacity: rule.is_active ? 1 : 0.65,
                borderLeft: rule.is_active ? "4px solid #f59e0b" : "4px solid #475569"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                    <span className={`badge ${rule.is_active ? "badge-warning" : "badge-neutral"}`}>
                      {rule.is_active ? "ACTIVE" : "PAUSED"}
                    </span>
                    <span style={{
                      fontFamily: "monospace",
                      fontSize: "0.75rem",
                      background: "rgba(56, 189, 248, 0.12)",
                      color: "#38bdf8",
                      padding: "2px 8px",
                      borderRadius: "5px"
                    }}>
                      TRIGGER: {rule.trigger_event}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                      Fired <strong style={{ color: "#fff" }}>{rule.execution_count}</strong> time{rule.execution_count === 1 ? "" : "s"}
                    </span>
                  </div>

                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", margin: "0.2rem 0" }}>
                    {rule.name}
                  </h3>
                  <p style={{ fontSize: "0.84rem", color: "#94a3b8", margin: "0 0 0.85rem" }}>
                    {rule.description}
                  </p>

                  {/* Visual IF -> THEN pipeline */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#fbbf24", letterSpacing: "0.05em" }}>IF</span>
                    {rule.conditions.map((c: ConditionItem, idx: number) => (
                      <span key={idx} style={{
                        background: "rgba(245, 158, 11, 0.12)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "0.76rem",
                        color: "#fde68a"
                      }}>
                        <strong>{c.field}</strong> {c.operator} "{c.value}"
                      </span>
                    ))}

                    <ArrowRight size={14} color="#64748b" />

                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#34d399", letterSpacing: "0.05em" }}>THEN</span>
                    {rule.actions.map((a: ActionItem, idx: number) => (
                      <span key={idx} style={{
                        background: "rgba(16, 185, 129, 0.12)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "0.76rem",
                        color: "#a7f3d0"
                      }}>
                        <strong>{a.type}</strong>: {a.value.slice(0, 42)}{a.value.length > 42 ? "..." : ""}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleToggleRule(rule.id)}
                    title={rule.is_active ? "Pause Rule" : "Activate Rule"}
                    style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
                  >
                    <Power size={14} color={rule.is_active ? "#10b981" : "#94a3b8"} />
                    {rule.is_active ? "Pause" : "Enable"}
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleDeleteRule(rule.id)}
                    title="Delete Rule"
                    style={{ color: "#f87171", borderColor: "rgba(239, 68, 68, 0.3)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Execution Audit Ledger */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", marginBottom: "1rem" }}>
          Recent Rule Execution Ledger
        </h2>

        <div className="glass-card" style={{ padding: "1rem" }}>
          {logs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.88rem" }}>
              No automated executions logged yet. Use the Live Rule Simulator above or ingest a new ticket to trigger Auto-Pilot!
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", color: "#94a3b8", textAlign: "left" }}>
                    <th style={{ padding: "0.6rem" }}>Timestamp</th>
                    <th style={{ padding: "0.6rem" }}>Ticket</th>
                    <th style={{ padding: "0.6rem" }}>Rule Fired</th>
                    <th style={{ padding: "0.6rem" }}>Trigger</th>
                    <th style={{ padding: "0.6rem" }}>Actions Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <td style={{ padding: "0.65rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                        {new Date(log.executed_at).toLocaleString()}
                      </td>
                      <td style={{ padding: "0.65rem" }}>
                        <Link href={`/tickets/${log.ticket_id}`} style={{ color: "#38bdf8", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          #{log.ticket_id} <ExternalLink size={12} />
                        </Link>
                      </td>
                      <td style={{ padding: "0.65rem", color: "#fff", fontWeight: 600 }}>
                        {log.rule_name}
                      </td>
                      <td style={{ padding: "0.65rem" }}>
                        <span className="badge badge-neutral" style={{ fontSize: "0.7rem" }}>{log.trigger_event}</span>
                      </td>
                      <td style={{ padding: "0.65rem" }}>
                        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                          {(log.actions_applied || []).map((act: string, i: number) => (
                            <span key={i} style={{
                              fontSize: "0.74rem",
                              background: "rgba(16, 185, 129, 0.14)",
                              color: "#6ee7b7",
                              padding: "2px 6px",
                              borderRadius: "4px"
                            }}>
                              {act}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Custom Rule Modal */}
        {createOpen && (
          <div style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.78)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
          }}>
            <div className="glass-card" style={{ width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", padding: "1.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Zap size={18} color="#f59e0b" />
                  Create Auto-Pilot Rule
                </h3>
                <button onClick={() => setCreateOpen(false)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateRule} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>Rule Name *</label>
                  <input
                    type="text"
                    required
                    value={ruleName}
                    onChange={e => setRuleName(e.target.value)}
                    placeholder="e.g., Enterprise SLA Priority Fast-Track"
                    className="input-text"
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>Trigger Event</label>
                    <select value={triggerEvent} onChange={e => setTriggerEvent(e.target.value)} className="input-select" style={{ width: "100%" }}>
                      <option value="ON_INGEST">ON_INGEST (New Ticket)</option>
                      <option value="ON_CSAT">ON_CSAT (Feedback Logged)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>Description</label>
                    <input
                      type="text"
                      value={ruleDesc}
                      onChange={e => setRuleDesc(e.target.value)}
                      placeholder="Short description..."
                      className="input-text"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                {/* IF Conditions Builder */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fbbf24" }}>IF Conditions (All Must Match)</label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                      onClick={() => setConditions([...conditions, { field: "ticket_text", operator: "contains", value: "" }])}
                    >
                      + Add Condition
                    </button>
                  </div>
                  {conditions.map((c, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr auto", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <select
                        value={c.field}
                        onChange={e => {
                          const next = [...conditions];
                          next[idx].field = e.target.value;
                          setConditions(next);
                        }}
                        className="input-select"
                      >
                        <option value="priority">priority</option>
                        <option value="category">category</option>
                        <option value="sentiment">sentiment</option>
                        <option value="ticket_text">ticket_text</option>
                        <option value="assigned_team">assigned_team</option>
                        <option value="csat_rating">csat_rating</option>
                      </select>

                      <select
                        value={c.operator}
                        onChange={e => {
                          const next = [...conditions];
                          next[idx].operator = e.target.value;
                          setConditions(next);
                        }}
                        className="input-select"
                      >
                        <option value="equals">equals</option>
                        <option value="contains">contains</option>
                        <option value="contains_any">contains_any</option>
                        <option value="lte">lte (&le;)</option>
                        <option value="gte">gte (&ge;)</option>
                      </select>

                      <input
                        type="text"
                        required
                        value={c.value}
                        onChange={e => {
                          const next = [...conditions];
                          next[idx].value = e.target.value;
                          setConditions(next);
                        }}
                        placeholder="Value..."
                        className="input-text"
                      />

                      {conditions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setConditions(conditions.filter((_, i) => i !== idx))}
                          style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer" }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* THEN Actions Builder */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#34d399" }}>THEN Actions</label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                      onClick={() => setActions([...actions, { type: "add_internal_note", value: "" }])}
                    >
                      + Add Action
                    </button>
                  </div>
                  {actions.map((a, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr auto", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <select
                        value={a.type}
                        onChange={e => {
                          const next = [...actions];
                          next[idx].type = e.target.value;
                          setActions(next);
                        }}
                        className="input-select"
                      >
                        <option value="assign_agent">assign_agent</option>
                        <option value="set_priority">set_priority</option>
                        <option value="set_status">set_status</option>
                        <option value="set_escalation">set_escalation</option>
                        <option value="link_incident">link_incident</option>
                        <option value="apply_macro">apply_macro</option>
                        <option value="add_internal_note">add_internal_note</option>
                      </select>

                      <input
                        type="text"
                        required
                        value={a.value}
                        onChange={e => {
                          const next = [...actions];
                          next[idx].value = e.target.value;
                          setActions(next);
                        }}
                        placeholder="e.g., Sarah Chen, High, INC-101..."
                        className="input-text"
                      />

                      {actions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setActions(actions.filter((_, i) => i !== idx))}
                          style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer" }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCreateOpen(false)}>Cancel</button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={creating}
                    style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
                  >
                    {creating ? "Saving..." : "Save & Activate Rule"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

