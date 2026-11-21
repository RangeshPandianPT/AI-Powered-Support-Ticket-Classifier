"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { 
  Radio, Send, Sparkles, CheckCircle2, Clock, 
  MessageSquare, ExternalLink, RefreshCw, AlertCircle, 
  ChevronRight, ArrowRight, Activity, Zap, Check, Copy
} from "lucide-react";
import Navbar from "../components/Navbar";

export default function OmnichannelPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [presets, setPresets] = useState<any[]>([]);
  const [gateways, setGateways] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Simulation Form State
  const [selectedChannel, setSelectedChannel] = useState("whatsapp");
  const [senderName, setSenderName] = useState("Sarah Connor");
  const [senderContact, setSenderContact] = useState("+1 (555) 234-8901");
  const [messageText, setMessageText] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  useEffect(() => {
    fetchChannelData();
  }, []);

  const fetchChannelData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, presetsRes, gatewaysRes] = await Promise.all([
        axios.get("http://127.0.0.1:8000/api/channels/analytics"),
        axios.get("http://127.0.0.1:8000/api/channels/presets"),
        axios.get("http://127.0.0.1:8000/api/channels/status")
      ]);
      setAnalytics(analyticsRes.data || null);
      setPresets(presetsRes.data || []);
      setGateways(gatewaysRes.data || {});
      if (presetsRes.data && presetsRes.data.length > 0 && !messageText) {
        applyPreset(presetsRes.data[0]);
      }
    } catch (e) {
      console.error("Failed to load omnichannel data", e);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset: any) => {
    setSelectedChannel(preset.channel);
    setSenderName(preset.sender_name);
    setSenderContact(preset.sender_contact);
    setMessageText(preset.message_text);
    setSimResult(null);
  };

  const handleSimulateInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    setSimulating(true);
    setSimResult(null);
    try {
      const res = await axios.post("http://127.0.0.1:8000/api/channels/simulate-inbound", {
        channel: selectedChannel,
        sender_name: senderName,
        sender_contact: senderContact,
        message_text: messageText,
        channel_metadata: {
          contact: senderContact,
          timestamp: new Date().toISOString()
        }
      });
      setSimResult(res.data);
      // Refresh analytics counters
      const refreshed = await axios.get("http://127.0.0.1:8000/api/channels/analytics");
      setAnalytics(refreshed.data);
    } catch (e: any) {
      alert("Simulation failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setSimulating(false);
    }
  };

  const getChannelColor = (ch: string) => {
    switch (ch) {
      case "whatsapp": return "#22c55e";
      case "slack": return "#a855f7";
      case "chat": return "#0ea5e9";
      case "sms": return "#f97316";
      default: return "#64748b";
    }
  };

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case "whatsapp": return "💬";
      case "slack": return "🟣";
      case "chat": return "💬";
      case "sms": return "📱";
      default: return "📧";
    }
  };

  return (
    <div className="layout">
      <Navbar />

      <main className="container" style={{ paddingBottom: "4rem" }}>
        {/* Breadcrumb Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.5rem", marginBottom: "0.75rem", fontSize: "0.85rem", color: "#94a3b8" }}>
          <Link href="/" style={{ color: "#94a3b8", textDecoration: "none" }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: "#38bdf8", fontWeight: 600 }}>Omnichannel Command Center</span>
        </div>

        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div style={{
              background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
              padding: "10px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 18px rgba(14, 165, 233, 0.35)"
            }}>
              <Radio size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                Omnichannel Communications Hub
              </h1>
              <p style={{ color: "#94a3b8", fontSize: "0.88rem", marginTop: "0.2rem" }}>
                Real-time gateway telemetry and unified multi-agent triage across WhatsApp, Slack, Live Chat, SMS, and Email.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchChannelData} title="Refresh Telemetry">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Live Channel Gateways Telemetry Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
          {Object.entries(gateways).map(([key, gw]: [string, any]) => (
            <div
              key={key}
              className="glass-card"
              style={{
                borderLeft: `3px solid ${gw.color}`,
                padding: "1rem 1.15rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "1.1rem" }}>{gw.icon}</span>
                <span style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: "10px",
                  background: "rgba(34, 197, 94, 0.15)",
                  color: "#4ade80",
                  border: "1px solid rgba(34, 197, 94, 0.3)"
                }}>
                  {gw.status}
                </span>
              </div>
              <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem" }}>{gw.name}</div>
              <div style={{ fontSize: "0.74rem", color: "#94a3b8" }}>{gw.protocol}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#cbd5e1", marginTop: "0.4rem", paddingTop: "0.4rem", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <span>Latency: <strong>{gw.avg_latency}</strong></span>
                <span>Uptime: <strong style={{ color: "#34d399" }}>{gw.uptime}</strong></span>
              </div>
            </div>
          ))}
        </div>

        {/* Omnichannel Inbound Simulator Studio */}
        <div className="glass-card" style={{ marginBottom: "2rem", border: "1px solid rgba(14, 165, 233, 0.35)", padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Sparkles size={20} color="#38bdf8" />
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", margin: 0 }}>
                  Live Channel Inbound Simulator
                </h2>
              </div>
              <p style={{ fontSize: "0.82rem", color: "#94a3b8", margin: "0.25rem 0 0" }}>
                Select a communication channel and transmit real customer message streams into the multi-agent LangGraph triage pipeline.
              </p>
            </div>

            {/* 1-Click Scenario Preset Pills */}
            <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.74rem", padding: "0.3rem 0.65rem" }}
                >
                  {getChannelIcon(p.channel)} {p.title.split(":")[0]}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSimulateInbound} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Channel Tabs */}
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.4rem", textTransform: "uppercase" }}>
                Origin Channel
              </label>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {[
                  { key: "whatsapp", label: "WhatsApp Business", icon: "💬" },
                  { key: "slack", label: "Slack Connect", icon: "🟣" },
                  { key: "chat", label: "Live Webchat", icon: "💬" },
                  { key: "sms", label: "Twilio SMS", icon: "📱" },
                  { key: "email", label: "Email / IMAP", icon: "📧" }
                ].map(ch => (
                  <button
                    key={ch.key}
                    type="button"
                    onClick={() => setSelectedChannel(ch.key)}
                    style={{
                      background: selectedChannel === ch.key ? `${getChannelColor(ch.key)}25` : "rgba(255, 255, 255, 0.04)",
                      border: selectedChannel === ch.key ? `1.5px solid ${getChannelColor(ch.key)}` : "1px solid rgba(255, 255, 255, 0.08)",
                      color: selectedChannel === ch.key ? "#fff" : "#94a3b8",
                      borderRadius: "8px",
                      padding: "0.45rem 0.85rem",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem"
                    }}
                  >
                    <span>{ch.icon}</span>
                    <span>{ch.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                  Customer Name
                </label>
                <input
                  type="text"
                  required
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                  placeholder="e.g., Sarah Connor"
                  className="input-text"
                  style={{ width: "100%", fontSize: "0.85rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                  Channel Handle / Contact Endpoint
                </label>
                <input
                  type="text"
                  required
                  value={senderContact}
                  onChange={e => setSenderContact(e.target.value)}
                  placeholder="e.g., +1 (555) 234-8901, #enterprise-support, live_sess_991"
                  className="input-text"
                  style={{ width: "100%", fontSize: "0.85rem" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                Inbound Message Content
              </label>
              <textarea
                required
                rows={3}
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder="Type customer message or select a preset above..."
                className="input-textarea"
                style={{ width: "100%", fontSize: "0.85rem", lineHeight: 1.5 }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
              <div style={{ fontSize: "0.76rem", color: "#94a3b8" }}>
                Transmitting via: <strong style={{ color: getChannelColor(selectedChannel) }}>{selectedChannel.toUpperCase()} Gateway Protocol</strong>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={simulating || !messageText.trim()}
                style={{
                  background: `linear-gradient(135deg, ${getChannelColor(selectedChannel)}, #0284c7)`,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.55rem 1.25rem"
                }}
              >
                <Send size={15} />
                {simulating ? "Transmitting & Triaging..." : `Transmit Inbound via ${selectedChannel.toUpperCase()}`}
              </button>
            </div>
          </form>

          {/* Simulation Output Banner */}
          {simResult && (
            <div style={{
              marginTop: "1.25rem",
              background: "rgba(15, 23, 42, 0.8)",
              border: `1px solid ${getChannelColor(simResult.channel)}55`,
              borderRadius: "10px",
              padding: "1rem 1.25rem"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <CheckCircle2 size={18} color="#34d399" />
                  <strong style={{ color: "#fff", fontSize: "0.95rem" }}>
                    Inbound Stream Processed: Ticket #{simResult.ticket_id} Created
                  </strong>
                </div>

                <Link
                  href={`/tickets/${simResult.ticket_id}`}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.78rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
                >
                  <span>Open Ticket Studio</span>
                  <ExternalLink size={13} />
                </Link>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.78rem", marginBottom: "0.5rem" }}>
                <span className="badge badge-neutral">Category: {simResult.classification.category}</span>
                <span className={`badge ${simResult.classification.priority === "High" ? "badge-danger" : "badge-warning"}`}>
                  Priority: {simResult.classification.priority}
                </span>
                <span className="badge badge-neutral">Sentiment: {simResult.classification.sentiment}</span>
                <span style={{
                  padding: "2px 7px",
                  borderRadius: "4px",
                  background: `${getChannelColor(simResult.channel)}22`,
                  color: getChannelColor(simResult.channel),
                  fontWeight: 700
                }}>
                  Origin: {simResult.channel_name}
                </span>
              </div>

              {simResult.automations_triggered && simResult.automations_triggered.length > 0 && (
                <div style={{ fontSize: "0.78rem", color: "#fde68a", marginTop: "0.4rem" }}>
                  ⚡ Auto-Pilot Executed: {simResult.automations_triggered.map((a: any) => a.rule_name).join(", ")}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Channel Volume & Resolution Velocity Breakdown */}
        {analytics && analytics.channels && (
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", marginBottom: "1rem" }}>
              Omnichannel Gateway Performance &amp; Traffic Share
            </h2>

            <div className="glass-card" style={{ padding: "1rem" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", color: "#94a3b8", textAlign: "left" }}>
                      <th style={{ padding: "0.6rem" }}>Channel</th>
                      <th style={{ padding: "0.6rem" }}>Protocol</th>
                      <th style={{ padding: "0.6rem" }}>Inbound Volume</th>
                      <th style={{ padding: "0.6rem" }}>Traffic Share</th>
                      <th style={{ padding: "0.6rem" }}>Resolution Rate</th>
                      <th style={{ padding: "0.6rem" }}>Avg CSAT</th>
                      <th style={{ padding: "0.6rem" }}>Gateway Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(analytics.channels).map(([key, data]: [string, any]) => (
                      <tr key={key} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <td style={{ padding: "0.65rem", fontWeight: 700, color: "#fff" }}>
                          <span style={{ marginRight: "0.4rem" }}>{data.icon}</span>
                          {data.name}
                        </td>
                        <td style={{ padding: "0.65rem", color: "#94a3b8", fontSize: "0.76rem" }}>
                          {data.protocol}
                        </td>
                        <td style={{ padding: "0.65rem", fontWeight: 700, color: "#38bdf8" }}>
                          {data.inbound_count} tickets
                        </td>
                        <td style={{ padding: "0.65rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div style={{ width: 60, height: 6, background: "rgba(255, 255, 255, 0.1)", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${data.share_percent}%`, height: "100%", background: data.color }} />
                            </div>
                            <span style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>{data.share_percent}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "0.65rem", color: data.resolution_rate >= 70 ? "#34d399" : "#fbbf24" }}>
                          {data.resolution_rate}%
                        </td>
                        <td style={{ padding: "0.65rem", color: "#fbbf24" }}>
                          {data.avg_csat} ★
                        </td>
                        <td style={{ padding: "0.65rem", color: "#94a3b8", fontFamily: "monospace" }}>
                          {data.avg_latency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
