"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { 
  AlertTriangle, ShieldAlert, Sparkles, CheckCircle2, Clock, 
  Users, ArrowLeft, RefreshCw, Radio, Send, ChevronRight, 
  ExternalLink, Layers, X, Plus, Zap, AlertCircle, CheckCircle
} from "lucide-react";
import Navbar from "../components/Navbar";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");

  // Clustering scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  // Selected Incident War Room Drawer
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastNewStatus, setBroadcastNewStatus] = useState("Monitoring");
  const [markTicketsResolved, setMarkTicketsResolved] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

  // Declare Incident Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSeverity, setNewSeverity] = useState("P2 - Major");
  const [newCategory, setNewCategory] = useState("Technical Support");
  const [newSummary, setNewSummary] = useState("");
  const [newRCA, setNewRCA] = useState("");
  const [newServices, setNewServices] = useState("");
  const [newSuggestedAction, setNewSuggestedAction] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchIncidents();
  }, [statusFilter, severityFilter]);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/incidents", {
        params: { status: statusFilter, severity: severityFilter }
      });
      setIncidents(res.data || []);
      if (selectedIncident) {
        const refreshed = res.data.find((i: any) => i.id === selectedIncident.id);
        if (refreshed) setSelectedIncident(refreshed);
      }
    } catch (e) {
      console.error("Failed to fetch incidents", e);
    } finally {
      setLoading(false);
    }
  };

  const handleScanClusters = async () => {
    setIsScanning(true);
    setScanResult(null);
    try {
      const res = await axios.post("http://127.0.0.1:8000/api/incidents/detect");
      setScanResult(res.data);
      await fetchIncidents();
    } catch (e) {
      console.error("Failed to run cluster detection", e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleOpenWarRoom = (incident: any) => {
    setSelectedIncident(incident);
    setBroadcastSuccess(null);
    // Pre-populate recommended broadcast message
    const servicesStr = incident.impacted_services && incident.impacted_services.length > 0 
      ? incident.impacted_services.join(", ") 
      : "our systems";
    setBroadcastText(
      `We are actively addressing the issue affecting ${servicesStr}. Our engineering teams have isolated the root cause: "${incident.root_cause_analysis || 'service degradation'}". Remediation is underway and updates will be posted here as milestones complete.`
    );
    setBroadcastNewStatus(incident.status === "Investigating" ? "Identified" : incident.status);
    setMarkTicketsResolved(false);
  };

  const handleSendBroadcast = async () => {
    if (!selectedIncident || !broadcastText.trim()) return;
    setIsBroadcasting(true);
    setBroadcastSuccess(null);
    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/incidents/${selectedIncident.id}/broadcast`, {
        broadcast_message: broadcastText,
        new_status: broadcastNewStatus,
        mark_tickets_resolved: markTicketsResolved,
        actor_name: "Incident Commander"
      });
      setBroadcastSuccess(`Broadcast successfully dispatched to ${res.data.dispatched_count} linked customer ticket(s)!`);
      await fetchIncidents();
      const updated = await axios.get(`http://127.0.0.1:8000/api/incidents/${selectedIncident.id}`);
      setSelectedIncident(updated.data);
    } catch (e: any) {
      alert("Failed to dispatch broadcast: " + (e.response?.data?.detail || e.message));
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsCreating(true);
    try {
      const servicesList = newServices.split(",").map(s => s.trim()).filter(Boolean);
      await axios.post("http://127.0.0.1:8000/api/incidents", {
        title: newTitle,
        severity: newSeverity,
        category: newCategory,
        summary: newSummary,
        root_cause_analysis: newRCA,
        impacted_services: servicesList,
        suggested_action: newSuggestedAction,
        lead_responder: "Incident Commander"
      });
      setCreateModalOpen(false);
      setNewTitle("");
      setNewSummary("");
      setNewRCA("");
      setNewServices("");
      setNewSuggestedAction("");
      await fetchIncidents();
    } catch (e) {
      console.error("Failed to create incident", e);
    } finally {
      setIsCreating(false);
    }
  };

  // Metrics calculations
  const activeCount = incidents.filter(i => i.status !== "Resolved").length;
  const criticalCount = incidents.filter(i => i.severity.includes("P1") && i.status !== "Resolved").length;
  const totalBlastRadius = incidents.reduce((acc, i) => acc + (i.linked_ticket_count || 0), 0);

  const getSeverityBadgeClass = (sev: string) => {
    if (sev.includes("P1")) return "badge-danger";
    if (sev.includes("P2")) return "badge-warning";
    if (sev.includes("P3")) return "badge-info";
    return "badge-neutral";
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "Investigating":
        return { background: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.4)" };
      case "Identified":
        return { background: "rgba(245, 158, 11, 0.2)", color: "#fcd34d", border: "1px solid rgba(245, 158, 11, 0.4)" };
      case "Monitoring":
        return { background: "rgba(59, 130, 246, 0.2)", color: "#93c5fd", border: "1px solid rgba(59, 130, 246, 0.4)" };
      case "Resolved":
        return { background: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7", border: "1px solid rgba(16, 185, 129, 0.4)" };
      default:
        return { background: "rgba(148, 163, 184, 0.2)", color: "#cbd5e1" };
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
          <span style={{ color: "#38bdf8", fontWeight: 600 }}>Incident Command Center</span>
        </div>

        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.75rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{
                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                padding: "8px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 15px rgba(239, 68, 68, 0.4)"
              }}>
                <Radio size={24} color="#fff" className="animate-pulse" />
              </div>
              <div>
                <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                  Incident Command Center & War Room
                </h1>
                <p style={{ color: "#94a3b8", fontSize: "0.88rem", marginTop: "0.2rem" }}>
                  AI-driven outage pattern clustering, automated root cause analysis, and mass customer broadcast dispatch.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleScanClusters}
              disabled={isScanning}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <Zap size={15} color="#38bdf8" />
              {isScanning ? "Analyzing Clusters..." : "AI Cluster Scanner"}
            </button>

            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setCreateModalOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "linear-gradient(135deg, #ef4444, #b91c1c)" }}
            >
              <Plus size={16} />
              Declare Incident
            </button>

            <button 
              className="btn btn-secondary btn-sm"
              onClick={fetchIncidents}
              title="Refresh Incidents"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Cluster Scan Notification Alert */}
        {scanResult && (
          <div style={{
            background: "rgba(56, 189, 248, 0.15)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            borderRadius: "10px",
            padding: "0.9rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#e0f2fe"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Sparkles size={20} color="#38bdf8" />
              <div>
                <strong>AI Sentinel Scan Completed:</strong> Scanned {scanResult.scanned_tickets} recent tickets and found {scanResult.clusters_found} incident pattern cluster(s).
              </div>
            </div>
            <button 
              onClick={() => setScanResult(null)}
              style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Stat Overview Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "1.75rem"
        }}>
          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ background: "rgba(239, 68, 68, 0.2)", padding: 12, borderRadius: 10, color: "#f87171" }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Active Outages</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>{activeCount}</div>
              <div style={{ fontSize: "0.72rem", color: criticalCount > 0 ? "#f87171" : "#10b981" }}>
                {criticalCount} Critical (P1)
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ background: "rgba(245, 158, 11, 0.2)", padding: 12, borderRadius: 10, color: "#fbbf24" }}>
              <Users size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Blast Radius</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>{totalBlastRadius}</div>
              <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Affected Customer Tickets</div>
            </div>
          </div>

          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ background: "rgba(59, 130, 246, 0.2)", padding: 12, borderRadius: 10, color: "#60a5fa" }}>
              <ShieldAlert size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI Clustering</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>100%</div>
              <div style={{ fontSize: "0.72rem", color: "#38bdf8" }}>Automated Semantic Grouping</div>
            </div>
          </div>

          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ background: "rgba(16, 185, 129, 0.2)", padding: 12, borderRadius: 10, color: "#34d399" }}>
              <Clock size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Target MTTR</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>&lt; 45m</div>
              <div style={{ fontSize: "0.72rem", color: "#10b981" }}>Fast Mass Broadcast</div>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="glass-card" style={{ padding: "0.9rem 1.25rem", marginBottom: "1.5rem", display: "flex", gap: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Status:</span>
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              className="input-select"
              style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
            >
              <option value="All">All Statuses</option>
              <option value="Investigating">Investigating</option>
              <option value="Identified">Identified</option>
              <option value="Monitoring">Monitoring</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Severity:</span>
            <select 
              value={severityFilter} 
              onChange={e => setSeverityFilter(e.target.value)}
              className="input-select"
              style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
            >
              <option value="All">All Severities</option>
              <option value="P1 - Critical">P1 - Critical</option>
              <option value="P2 - Major">P2 - Major</option>
              <option value="P3 - Moderate">P3 - Moderate</option>
            </select>
          </div>
        </div>

        {/* Incidents Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "#94a3b8" }}>
            <RefreshCw size={32} className="animate-spin" style={{ margin: "0 auto 1rem" }} />
            <p>Loading active incident radar...</p>
          </div>
        ) : incidents.length === 0 ? (
          <div className="glass-card" style={{ textAlign: "center", padding: "4rem 2rem", color: "#94a3b8" }}>
            <CheckCircle2 size={48} color="#10b981" style={{ margin: "0 auto 1rem" }} />
            <h3 style={{ color: "#fff", fontSize: "1.2rem", fontWeight: 700 }}>All Systems Nominal</h3>
            <p style={{ maxWidth: 500, margin: "0.5rem auto 1.5rem", fontSize: "0.88rem" }}>
              No active incidents matching your filters. Click "AI Cluster Scanner" above to analyze recent tickets for emerging patterns.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={handleScanClusters}>
              Scan For Anomalies Now
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {incidents.map((inc) => (
              <div 
                key={inc.id}
                className="glass-card"
                style={{
                  borderLeft: inc.severity.includes("P1") 
                    ? "4px solid #ef4444" 
                    : inc.severity.includes("P2") 
                      ? "4px solid #f59e0b" 
                      : "4px solid #3b82f6",
                  position: "relative",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                      <span style={{ 
                        fontFamily: "monospace", 
                        fontWeight: 700, 
                        fontSize: "0.95rem", 
                        color: "#38bdf8", 
                        background: "rgba(56, 189, 248, 0.1)",
                        padding: "2px 8px",
                        borderRadius: "6px"
                      }}>
                        {inc.incident_code}
                      </span>
                      <span className={`badge ${getSeverityBadgeClass(inc.severity)}`}>
                        {inc.severity}
                      </span>
                      <span style={{ 
                        padding: "2px 8px", 
                        borderRadius: "12px", 
                        fontSize: "0.75rem", 
                        fontWeight: 600,
                        ...getStatusBadgeStyle(inc.status)
                      }}>
                        {inc.status}
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                        Category: <strong style={{ color: "#e2e8f0" }}>{inc.category}</strong>
                      </span>
                    </div>

                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", margin: "0.3rem 0 0.5rem" }}>
                      {inc.title}
                    </h3>
                    
                    <p style={{ color: "#cbd5e1", fontSize: "0.88rem", lineHeight: 1.5, margin: "0 0 0.8rem", maxWidth: "850px" }}>
                      {inc.summary}
                    </p>

                    {/* Impacted Services Chips */}
                    {inc.impacted_services && inc.impacted_services.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Impacted:</span>
                        {inc.impacted_services.map((svc: string, idx: number) => (
                          <span key={idx} style={{
                            fontSize: "0.75rem",
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            padding: "2px 7px",
                            borderRadius: "4px",
                            color: "#93c5fd"
                          }}>
                            {svc}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Root Cause Hypothesis Box */}
                    {inc.root_cause_analysis && (
                      <div style={{
                        background: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "8px",
                        padding: "0.6rem 0.85rem",
                        fontSize: "0.82rem",
                        color: "#94a3b8",
                        marginBottom: "0.75rem"
                      }}>
                        <strong style={{ color: "#38bdf8" }}>Root Cause Diagnosis: </strong>
                        <span style={{ color: "#e2e8f0" }}>{inc.root_cause_analysis}</span>
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", fontSize: "0.78rem", color: "#94a3b8" }}>
                      <div>Lead: <strong style={{ color: "#e2e8f0" }}>{inc.lead_responder}</strong></div>
                      <div>Created: <strong>{new Date(inc.created_at).toLocaleDateString()} {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
                      {inc.resolved_at && (
                        <div style={{ color: "#34d399" }}>Resolved: <strong>{new Date(inc.resolved_at).toLocaleDateString()}</strong></div>
                      )}
                    </div>
                  </div>

                  {/* Right Action Column */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.75rem", minWidth: 180 }}>
                    <div style={{
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "8px",
                      padding: "0.5rem 0.85rem",
                      textAlign: "center",
                      width: "100%"
                    }}>
                      <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#38bdf8" }}>
                        {inc.linked_ticket_count || 0}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase" }}>
                        Affected Tickets
                      </div>
                    </div>

                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => handleOpenWarRoom(inc)}
                      style={{ 
                        width: "100%", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        gap: "0.4rem",
                        background: "linear-gradient(135deg, #2563eb, #1d4ed8)"
                      }}
                    >
                      <Radio size={14} />
                      Open War Room
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Incident War Room Slide-Over Drawer */}
        {selectedIncident && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-end"
          }}>
            <div style={{
              width: "100%",
              maxWidth: "680px",
              height: "100%",
              backgroundColor: "#0b0f19",
              borderLeft: "1px solid rgba(255, 255, 255, 0.15)",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.8)",
              padding: "1.75rem"
            }}>
              {/* Drawer Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                    <span style={{ 
                      fontFamily: "monospace", 
                      fontWeight: 800, 
                      fontSize: "1rem", 
                      color: "#38bdf8",
                      background: "rgba(56, 189, 248, 0.1)",
                      padding: "2px 8px",
                      borderRadius: "6px"
                    }}>
                      {selectedIncident.incident_code}
                    </span>
                    <span className={`badge ${getSeverityBadgeClass(selectedIncident.severity)}`}>
                      {selectedIncident.severity}
                    </span>
                    <span style={{ 
                      padding: "2px 8px", 
                      borderRadius: "12px", 
                      fontSize: "0.75rem", 
                      fontWeight: 600,
                      ...getStatusBadgeStyle(selectedIncident.status)
                    }}>
                      {selectedIncident.status}
                    </span>
                  </div>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                    {selectedIncident.title}
                  </h2>
                </div>

                <button 
                  onClick={() => setSelectedIncident(null)}
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "none",
                    borderRadius: "8px",
                    color: "#94a3b8",
                    padding: "6px",
                    cursor: "pointer"
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* RCA & Playbook Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
                <div style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "8px",
                  padding: "0.85rem 1rem"
                }}>
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>
                    Incident Summary
                  </div>
                  <div style={{ fontSize: "0.88rem", color: "#e2e8f0", lineHeight: 1.5 }}>
                    {selectedIncident.summary}
                  </div>
                </div>

                <div style={{
                  background: "rgba(56, 189, 248, 0.06)",
                  border: "1px solid rgba(56, 189, 248, 0.2)",
                  borderRadius: "8px",
                  padding: "0.85rem 1rem"
                }}>
                  <div style={{ fontSize: "0.78rem", color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Sparkles size={14} />
                    AI Root Cause Analysis
                  </div>
                  <div style={{ fontSize: "0.88rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                    {selectedIncident.root_cause_analysis}
                  </div>
                </div>

                {selectedIncident.suggested_action && (
                  <div style={{
                    background: "rgba(16, 185, 129, 0.06)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    borderRadius: "8px",
                    padding: "0.85rem 1rem"
                  }}>
                    <div style={{ fontSize: "0.78rem", color: "#34d399", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>
                      Remediation Playbook
                    </div>
                    <div style={{ fontSize: "0.88rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                      {selectedIncident.suggested_action}
                    </div>
                  </div>
                )}
              </div>

              {/* Linked Customer Tickets Section */}
              <div style={{ marginBottom: "1.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", margin: 0 }}>
                    Linked Customer Tickets ({selectedIncident.linked_tickets?.length || 0})
                  </h3>
                  <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                    Blast Radius: <strong>{selectedIncident.blast_radius_score || 0}%</strong>
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "220px", overflowY: "auto" }}>
                  {selectedIncident.linked_tickets && selectedIncident.linked_tickets.length > 0 ? (
                    selectedIncident.linked_tickets.map((t: any) => (
                      <div 
                        key={t.id}
                        style={{
                          background: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid rgba(255, 255, 255, 0.07)",
                          borderRadius: "6px",
                          padding: "0.6rem 0.85rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.85rem"
                        }}
                      >
                        <div style={{ flex: 1, marginRight: "0.75rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                            <span style={{ fontWeight: 700, color: "#fff" }}>Ticket #{t.id}</span>
                            <span className={`badge ${t.priority === "High" ? "badge-danger" : "badge-neutral"}`} style={{ fontSize: "0.7rem", padding: "1px 6px" }}>
                              {t.priority}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{t.status}</span>
                          </div>
                          <div style={{ color: "#cbd5e1", fontSize: "0.8rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "340px" }}>
                            {t.summary || t.ticket_text}
                          </div>
                        </div>

                        <Link 
                          href={`/tickets/${t.id}`}
                          target="_blank"
                          style={{
                            color: "#38bdf8",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.2rem",
                            fontSize: "0.78rem",
                            textDecoration: "none"
                          }}
                        >
                          View <ExternalLink size={12} />
                        </Link>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#94a3b8", fontSize: "0.85rem", padding: "1rem", textAlign: "center" }}>
                      No tickets linked to this incident cluster yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Mass Customer Broadcast Studio */}
              <div style={{
                background: "rgba(30, 41, 59, 0.7)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "10px",
                padding: "1.25rem",
                marginTop: "auto"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
                  <Send size={18} color="#38bdf8" />
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff", margin: 0 }}>
                    Mass Customer Broadcast Dispatcher
                  </h3>
                </div>
                <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "0 0 0.85rem" }}>
                  Dispatch synchronized updates simultaneously to all {selectedIncident.linked_tickets?.length || 0} customer threads in this incident cluster.
                </p>

                {broadcastSuccess && (
                  <div style={{
                    background: "rgba(16, 185, 129, 0.2)",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    borderRadius: "6px",
                    padding: "0.6rem 0.85rem",
                    color: "#6ee7b7",
                    fontSize: "0.85rem",
                    marginBottom: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}>
                    <CheckCircle size={16} />
                    {broadcastSuccess}
                  </div>
                )}

                <textarea
                  value={broadcastText}
                  onChange={e => setBroadcastText(e.target.value)}
                  rows={4}
                  className="input-textarea"
                  style={{
                    width: "100%",
                    fontSize: "0.85rem",
                    marginBottom: "0.85rem",
                    background: "rgba(15, 23, 42, 0.8)",
                    lineHeight: 1.5
                  }}
                  placeholder="Enter message to broadcast to all affected customer tickets..."
                />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Set Incident Status:</span>
                    <select
                      value={broadcastNewStatus}
                      onChange={e => setBroadcastNewStatus(e.target.value)}
                      className="input-select"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                    >
                      <option value="Investigating">Investigating</option>
                      <option value="Identified">Identified</option>
                      <option value="Monitoring">Monitoring</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "#e2e8f0", cursor: "pointer" }}>
                    <input 
                      type="checkbox"
                      checked={markTicketsResolved}
                      onChange={e => setMarkTicketsResolved(e.target.checked)}
                    />
                    Auto-resolve all linked tickets
                  </label>
                </div>

                <button 
                  className="btn btn-primary"
                  onClick={handleSendBroadcast}
                  disabled={isBroadcasting || !broadcastText.trim()}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                    fontWeight: 700
                  }}
                >
                  <Send size={15} />
                  {isBroadcasting 
                    ? "Dispatching to All Customers..." 
                    : `Dispatch Broadcast to ${selectedIncident.linked_tickets?.length || 0} Tickets`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Declare Incident Modal */}
        {createModalOpen && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
          }}>
            <div className="glass-card" style={{
              width: "100%",
              maxWidth: "560px",
              padding: "1.75rem",
              borderRadius: "12px",
              border: "1px solid rgba(239, 68, 68, 0.3)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <AlertTriangle size={20} color="#ef4444" />
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                    Declare Operational Incident
                  </h3>
                </div>
                <button 
                  onClick={() => setCreateModalOpen(false)}
                  style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateIncident} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                    Incident Title *
                  </label>
                  <input 
                    type="text"
                    required
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g., Stripe Webhook 504 Timeout Spike"
                    className="input-text"
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                      Severity
                    </label>
                    <select 
                      value={newSeverity}
                      onChange={e => setNewSeverity(e.target.value)}
                      className="input-select"
                      style={{ width: "100%" }}
                    >
                      <option value="P1 - Critical">P1 - Critical</option>
                      <option value="P2 - Major">P2 - Major</option>
                      <option value="P3 - Moderate">P3 - Moderate</option>
                      <option value="P4 - Low">P4 - Low</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                      Category
                    </label>
                    <select 
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      className="input-select"
                      style={{ width: "100%" }}
                    >
                      <option value="Technical Support">Technical Support</option>
                      <option value="Billing & Payments">Billing & Payments</option>
                      <option value="Logistics & Shipping">Logistics & Shipping</option>
                      <option value="Platform / Security">Platform / Security</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                    Impacted Services (comma-separated)
                  </label>
                  <input 
                    type="text"
                    value={newServices}
                    onChange={e => setNewServices(e.target.value)}
                    placeholder="e.g., Stripe Gateway, Checkout API, Mobile App"
                    className="input-text"
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                    Summary
                  </label>
                  <textarea 
                    value={newSummary}
                    onChange={e => setNewSummary(e.target.value)}
                    placeholder="Describe customer impact and symptoms..."
                    rows={2}
                    className="input-textarea"
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                    Root Cause Hypothesis
                  </label>
                  <textarea 
                    value={newRCA}
                    onChange={e => setNewRCA(e.target.value)}
                    placeholder="Engineering diagnosis or known cause..."
                    rows={2}
                    className="input-textarea"
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCreateModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-sm"
                    disabled={isCreating}
                    style={{ background: "linear-gradient(135deg, #ef4444, #b91c1c)" }}
                  >
                    {isCreating ? "Declaring..." : "Declare Incident"}
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

