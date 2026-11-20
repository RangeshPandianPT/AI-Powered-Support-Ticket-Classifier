"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { 
  Users, Sparkles, AlertTriangle, ShieldCheck, TrendingDown, 
  TrendingUp, Star, Search, RefreshCw, X, ChevronRight, 
  ExternalLink, Mail, Phone, Building2, DollarSign, HeartHandshake,
  Clock, CheckCircle, ArrowRight, Copy, Check
} from "lucide-react";
import Navbar from "../components/Navbar";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Customer 360 Drawer
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [playbook, setPlaybook] = useState<any>(null);
  const [generatingPlaybook, setGeneratingPlaybook] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [tierFilter, riskFilter]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/customers", {
        params: {
          tier: tierFilter,
          risk: riskFilter,
          search: searchQuery
        }
      });
      setCustomers(res.data || []);
      if (selectedCustomer) {
        const updated = res.data.find((c: any) => c.id === selectedCustomer.id);
        if (updated) setSelectedCustomer(updated);
      }
    } catch (e) {
      console.error("Failed to load customers", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  const handleOpen360 = async (cust: any) => {
    setSelectedCustomer(cust);
    setPlaybook(null);
    setCopiedEmail(false);
    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/customers/${cust.id}`);
      setSelectedCustomer(res.data);
    } catch (e) {
      console.error("Failed to fetch full customer 360", e);
    }
  };

  const handleGeneratePlaybook = async (customerId: number) => {
    setGeneratingPlaybook(true);
    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/customers/${customerId}/retention-playbook`);
      setPlaybook(res.data);
      // Refresh customer to get new activity log
      const updated = await axios.get(`http://127.0.0.1:8000/api/customers/${customerId}`);
      setSelectedCustomer(updated.data);
    } catch (e) {
      console.error("Failed to generate retention playbook", e);
    } finally {
      setGeneratingPlaybook(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  // High-level statistics
  const totalAccounts = customers.length;
  const criticalOrHighCount = customers.filter(c => c.churn_risk >= 45).length;
  const atRiskMRR = customers
    .filter(c => c.churn_risk >= 45)
    .reduce((sum, c) => sum + (c.mrr || 0), 0);
  const avgHealth = totalAccounts > 0
    ? Math.round(customers.reduce((sum, c) => sum + (c.health_score || 0), 0) / totalAccounts)
    : 85;

  const getTierBadgeStyle = (tier: string) => {
    switch (tier) {
      case "VIP Enterprise":
        return { background: "linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(245, 158, 11, 0.35))", color: "#fef08a", border: "1px solid rgba(234, 179, 8, 0.5)" };
      case "Pro":
        return { background: "rgba(59, 130, 246, 0.2)", color: "#93c5fd", border: "1px solid rgba(59, 130, 246, 0.4)" };
      default:
        return { background: "rgba(148, 163, 184, 0.15)", color: "#cbd5e1", border: "1px solid rgba(148, 163, 184, 0.3)" };
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
          <span style={{ color: "#38bdf8", fontWeight: 600 }}>Customer 360 & Churn Radar</span>
        </div>

        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div style={{
              background: "linear-gradient(135deg, #10b981, #059669)",
              padding: "10px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 18px rgba(16, 185, 129, 0.35)"
            }}>
              <Users size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                Customer 360 & Churn Intelligence
              </h1>
              <p style={{ color: "#94a3b8", fontSize: "0.88rem", marginTop: "0.2rem" }}>
                Predictive churn risk scoring, account health metrics, lifetime sentiment tracking, and automated AI retention playbooks.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchCustomers} title="Refresh Accounts">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Executive Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ background: "rgba(59, 130, 246, 0.2)", padding: 12, borderRadius: 10, color: "#60a5fa" }}>
              <Building2 size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>Managed Accounts</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>{totalAccounts}</div>
              <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Enterprise & Mid-Market</div>
            </div>
          </div>

          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ background: "rgba(239, 68, 68, 0.2)", padding: 12, borderRadius: 10, color: "#f87171" }}>
              <TrendingDown size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>At-Risk Accounts</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#f87171" }}>{criticalOrHighCount}</div>
              <div style={{ fontSize: "0.72rem", color: "#fca5a5" }}>Churn Risk &ge; 45%</div>
            </div>
          </div>

          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ background: "rgba(245, 158, 11, 0.2)", padding: 12, borderRadius: 10, color: "#fbbf24" }}>
              <DollarSign size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>At-Risk MRR</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>${atRiskMRR.toLocaleString()}</div>
              <div style={{ fontSize: "0.72rem", color: "#fbbf24" }}>Monthly Revenue Exposure</div>
            </div>
          </div>

          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ background: "rgba(16, 185, 129, 0.2)", padding: 12, borderRadius: 10, color: "#34d399" }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>Avg Account Health</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>{avgHealth}/100</div>
              <div style={{ fontSize: "0.72rem", color: "#34d399" }}>Portfolio Health Baseline</div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="glass-card" style={{ padding: "0.9rem 1.25rem", marginBottom: "1.5rem", display: "flex", gap: "1.25rem", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, maxWidth: 380 }}>
            <div style={{ position: "relative", width: "100%" }}>
              <input
                type="text"
                placeholder="Search by customer, company, or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-text"
                style={{ width: "100%", paddingLeft: "2.2rem", fontSize: "0.85rem" }}
              />
              <Search size={15} color="#94a3b8" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
            </div>
            <button type="submit" className="btn btn-secondary btn-sm" style={{ padding: "0.45rem 0.85rem" }}>
              Search
            </button>
          </form>

          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>Tier:</span>
              <select
                value={tierFilter}
                onChange={e => setTierFilter(e.target.value)}
                className="input-select"
                style={{ padding: "0.35rem 0.65rem", fontSize: "0.82rem" }}
              >
                <option value="All">All Tiers</option>
                <option value="VIP Enterprise">VIP Enterprise</option>
                <option value="Pro">Pro</option>
                <option value="Standard">Standard</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>Risk Level:</span>
              <select
                value={riskFilter}
                onChange={e => setRiskFilter(e.target.value)}
                className="input-select"
                style={{ padding: "0.35rem 0.65rem", fontSize: "0.82rem" }}
              >
                <option value="All">All Risk Levels</option>
                <option value="Critical">Critical Risk (&ge;70%)</option>
                <option value="High">High Risk (&ge;45%)</option>
                <option value="Healthy">Healthy (&lt;25%)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Customer Directory Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "#94a3b8" }}>
            <RefreshCw size={32} className="animate-spin" style={{ margin: "0 auto 1rem" }} />
            <p>Loading customer intelligence radar...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="glass-card" style={{ textAlign: "center", padding: "4rem 2rem", color: "#94a3b8" }}>
            <Users size={48} color="#94a3b8" style={{ margin: "0 auto 1rem" }} />
            <h3 style={{ color: "#fff", fontSize: "1.2rem", fontWeight: 700 }}>No Customers Found</h3>
            <p style={{ maxWidth: 450, margin: "0.5rem auto 1.5rem", fontSize: "0.85rem" }}>
              No accounts match the current filters. Adjust your search or clear tier filters to view accounts.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {customers.map((cust) => (
              <div
                key={cust.id}
                className="glass-card"
                style={{
                  borderLeft: `4px solid ${cust.risk_color}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "1.25rem",
                  padding: "1.25rem 1.5rem"
                }}
              >
                {/* Account Details */}
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem", flexWrap: "wrap" }}>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", margin: 0 }}>
                      {cust.company || cust.name}
                    </h3>
                    <span style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      ...getTierBadgeStyle(cust.tier)
                    }}>
                      {cust.tier}
                    </span>
                    <span style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "12px",
                      background: `${cust.risk_color}22`,
                      color: cust.risk_color,
                      border: `1px solid ${cust.risk_color}55`
                    }}>
                      {cust.risk_tier} ({cust.churn_risk}% Churn)
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.82rem", color: "#94a3b8" }}>
                    <span>Contact: <strong style={{ color: "#e2e8f0" }}>{cust.name}</strong></span>
                    <span>&bull;</span>
                    <span>Email: <strong style={{ color: "#93c5fd" }}>{cust.email}</strong></span>
                    <span>&bull;</span>
                    <span>MRR: <strong style={{ color: "#34d399" }}>${(cust.mrr || 0).toLocaleString()}/mo</strong></span>
                  </div>

                  <div style={{ display: "flex", gap: "1.2rem", marginTop: "0.6rem", fontSize: "0.78rem", color: "#cbd5e1" }}>
                    <span>Tickets: <strong>{cust.total_tickets}</strong> ({cust.open_tickets} Open)</span>
                    <span>Frustrated Issues: <strong style={{ color: cust.frustrated_tickets > 0 ? "#f87171" : "#10b981" }}>{cust.frustrated_tickets}</strong></span>
                    <span>Avg CSAT: <strong>{cust.avg_csat} ★</strong></span>
                    <span>Lead: <strong>{cust.account_manager}</strong></span>
                  </div>
                </div>

                {/* Churn Risk Bar & Score */}
                <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                  <div style={{ minWidth: 140, textAlign: "right" }}>
                    <div style={{ fontSize: "0.74rem", color: "#94a3b8", marginBottom: "0.25rem" }}>Health vs Churn</div>
                    <div style={{
                      height: 8,
                      width: 140,
                      background: "rgba(255, 255, 255, 0.1)",
                      borderRadius: 4,
                      overflow: "hidden"
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${cust.churn_risk}%`,
                        background: cust.risk_color,
                        borderRadius: 4
                      }} />
                    </div>
                    <div style={{ fontSize: "0.7rem", color: cust.risk_color, marginTop: "0.25rem", fontWeight: 700 }}>
                      Health: {cust.health_score}/100
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpen360(cust)}
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.95rem" }}
                  >
                    <span>View 360</span>
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Slide-Over Customer 360 Dossier Drawer */}
        {selectedCustomer && (
          <div style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-end"
          }}>
            <div style={{
              width: "100%",
              maxWidth: 720,
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
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem", flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      ...getTierBadgeStyle(selectedCustomer.tier)
                    }}>
                      {selectedCustomer.tier}
                    </span>
                    <span style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "12px",
                      background: `${selectedCustomer.risk_color}22`,
                      color: selectedCustomer.risk_color,
                      border: `1px solid ${selectedCustomer.risk_color}55`
                    }}>
                      {selectedCustomer.risk_tier} ({selectedCustomer.churn_risk}% Churn)
                    </span>
                  </div>

                  <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fff", margin: "0.2rem 0" }}>
                    {selectedCustomer.company || selectedCustomer.name}
                  </h2>
                  <div style={{ display: "flex", gap: "1rem", color: "#94a3b8", fontSize: "0.82rem" }}>
                    <span>Contact: <strong style={{ color: "#fff" }}>{selectedCustomer.name}</strong></span>
                    <span>&bull;</span>
                    <span>MRR: <strong style={{ color: "#34d399" }}>${(selectedCustomer.mrr || 0).toLocaleString()}/mo</strong></span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCustomer(null)}
                  style={{ background: "rgba(255, 255, 255, 0.08)", border: "none", borderRadius: "8px", color: "#94a3b8", padding: "6px", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Health & Score Overview Banner */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                <div style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "10px",
                  padding: "0.85rem 1rem"
                }}>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>Account Health Score</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: selectedCustomer.risk_color, margin: "0.2rem 0" }}>
                    {selectedCustomer.health_score}/100
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>
                    Based on {selectedCustomer.total_tickets} support interactions &amp; CSAT surveys.
                  </div>
                </div>

                <div style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "10px",
                  padding: "0.85rem 1rem"
                }}>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>Dedicated Account Lead</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", margin: "0.3rem 0" }}>
                    {selectedCustomer.account_manager}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    {selectedCustomer.primary_phone || "Phone on file"} &bull; {selectedCustomer.email}
                  </div>
                </div>
              </div>

              {/* AI Churn Mitigation & Retention Studio */}
              <div style={{
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                borderRadius: "12px",
                padding: "1.25rem",
                marginBottom: "1.5rem"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <HeartHandshake size={18} color="#38bdf8" />
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff", margin: 0 }}>
                      AI Customer Retention Playbook
                    </h3>
                  </div>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleGeneratePlaybook(selectedCustomer.id)}
                    disabled={generatingPlaybook}
                    style={{ fontSize: "0.78rem", background: "linear-gradient(135deg, #0284c7, #2563eb)" }}
                  >
                    <Sparkles size={14} />
                    {generatingPlaybook ? "Synthesizing..." : "Generate AI Playbook"}
                  </button>
                </div>

                {playbook ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "0.85rem" }}>
                    <div style={{ background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "8px", padding: "0.75rem" }}>
                      <div style={{ fontSize: "0.74rem", color: "#38bdf8", textTransform: "uppercase", fontWeight: 700 }}>
                        Strategy: {playbook.recommended_action}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#fde68a", marginTop: "0.3rem" }}>
                        Concession Offer: <strong>{playbook.concession_offer}</strong> (Urgency: {playbook.urgency})
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: "0.76rem", color: "#94a3b8", fontWeight: 700, marginBottom: "0.3rem" }}>Key Talking Points:</div>
                      <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.8rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                        {(playbook.talking_points || []).map((pt: string, idx: number) => (
                          <li key={idx}>{pt}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                        <span style={{ fontSize: "0.76rem", color: "#94a3b8", fontWeight: 700 }}>AI Executive Outreach Email Draft:</span>
                        <button
                          onClick={() => copyToClipboard(playbook.outreach_email_draft)}
                          style={{ background: "transparent", border: "none", color: "#38bdf8", fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}
                        >
                          {copiedEmail ? <Check size={12} /> : <Copy size={12} />}
                          {copiedEmail ? "Copied" : "Copy Email"}
                        </button>
                      </div>
                      <textarea
                        readOnly
                        rows={6}
                        value={playbook.outreach_email_draft}
                        className="input-textarea"
                        style={{ width: "100%", fontSize: "0.8rem", background: "rgba(15, 23, 42, 0.95)", color: "#e2e8f0", lineHeight: 1.5 }}
                      />
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: "0.82rem", color: "#94a3b8", margin: 0 }}>
                    Click "Generate AI Playbook" to synthesize customized retention talking points, recommended concession budget, and an executive outreach email draft.
                  </p>
                )}
              </div>

              {/* Recent Support Tickets */}
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", marginBottom: "0.75rem" }}>
                  Customer Support Ticket History ({selectedCustomer.recent_tickets?.length || 0})
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {(selectedCustomer.recent_tickets || []).map((t: any) => (
                    <div
                      key={t.id}
                      style={{
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid rgba(255, 255, 255, 0.07)",
                        borderRadius: "8px",
                        padding: "0.65rem 0.85rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.82rem"
                      }}
                    >
                      <div style={{ flex: 1, marginRight: "0.75rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                          <span style={{ fontWeight: 700, color: "#fff" }}>Ticket #{t.id}</span>
                          <span className={`badge ${t.priority === "High" ? "badge-danger" : "badge-neutral"}`} style={{ fontSize: "0.68rem", padding: "1px 6px" }}>
                            {t.priority}
                          </span>
                          <span className={`badge ${t.status === "Open" ? "badge-warning" : "badge-success"}`} style={{ fontSize: "0.68rem", padding: "1px 6px" }}>
                            {t.status}
                          </span>
                          <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{t.sentiment}</span>
                        </div>
                        <div style={{ color: "#cbd5e1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 420 }}>
                          {t.summary || t.ticket_text}
                        </div>
                      </div>

                      <Link
                        href={`/tickets/${t.id}`}
                        target="_blank"
                        style={{ color: "#38bdf8", display: "flex", alignItems: "center", gap: 3, fontSize: "0.78rem", textDecoration: "none" }}
                      >
                        Open <ExternalLink size={12} />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

              {/* Engagement Activity Log */}
              {selectedCustomer.activity_log && selectedCustomer.activity_log.length > 0 && (
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", marginBottom: "0.75rem" }}>
                    Account Engagement Activity
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {selectedCustomer.activity_log.map((act: any) => (
                      <div
                        key={act.id}
                        style={{
                          background: "rgba(255, 255, 255, 0.02)",
                          borderLeft: "3px solid #38bdf8",
                          borderRadius: "4px",
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.78rem"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
                          <strong style={{ color: "#fff" }}>{act.title}</strong>
                          <span>{new Date(act.created_at).toLocaleDateString()}</span>
                        </div>
                        <div style={{ color: "#cbd5e1", marginTop: "0.2rem" }}>{act.details}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
