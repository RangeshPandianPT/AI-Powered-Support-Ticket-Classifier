"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Ticket, AlertTriangle, CheckCircle2, TrendingUp, Sparkles } from "lucide-react";

export default function AnalyticsDashboard({ refreshTrigger }: { refreshTrigger: number }) {
  const [metrics, setMetrics] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [analyticsRes, ticketsRes] = await Promise.all([
        axios.get("http://127.0.0.1:8000/api/analytics"),
        axios.get("http://127.0.0.1:8000/api/tickets")
      ]);
      setMetrics(analyticsRes.data);
      setTickets(ticketsRes.data);
    } catch (e) {
      console.error("Failed to fetch analytics", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  if (!metrics) {
    return (
      <div className="glass-card" style={{ marginBottom: "2.5rem", textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
        Loading intelligence analytics...
      </div>
    );
  }

  // Process tickets for charts
  const categoryCounts = tickets.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const categoryData = Object.keys(categoryCounts).map(name => ({
    name,
    value: categoryCounts[name]
  }));

  const priorityCounts = tickets.reduce((acc, t) => {
    acc[t.priority] = (acc[t.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const priorityData = Object.keys(priorityCounts).map(name => ({
    name,
    value: priorityCounts[name]
  }));

  const PRIORITY_COLORS: Record<string, string> = {
    High: "#ef4444",
    Medium: "#f59e0b",
    Low: "#10b981"
  };

  return (
    <div style={{ marginBottom: "3rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff" }}>Live Operations Telemetry</h2>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Real-time ticket volume, agent classification confidence & triage stats</p>
        </div>
      </div>
      
      {/* Metric Cards */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: "1.75rem", gap: "1.25rem" }}>
        <div className="glass-card" style={{ padding: "1.5rem", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>Total Ingested</span>
            <div style={{ background: "rgba(59, 130, 246, 0.15)", padding: 6, borderRadius: 8, color: "#60a5fa" }}>
              <Ticket size={18} />
            </div>
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
            {metrics.total_tickets}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>From IMAP & Direct API</div>
        </div>

        <div className="glass-card" style={{ padding: "1.5rem", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>Active Open</span>
            <div style={{ background: "rgba(245, 158, 11, 0.15)", padding: 6, borderRadius: 8, color: "#fcd34d" }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "var(--warning)", letterSpacing: "-0.02em" }}>
            {metrics.total_open}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>Awaiting human review</div>
        </div>

        <div className="glass-card" style={{ padding: "1.5rem", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>Urgent Escalations</span>
            <div style={{ background: "rgba(239, 68, 68, 0.15)", padding: 6, borderRadius: 8, color: "#fca5a5" }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "var(--danger)", letterSpacing: "-0.02em" }}>
            {metrics.total_escalations}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>Slack alerts dispatched</div>
        </div>

        <div className="glass-card" style={{ padding: "1.5rem", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>AI Confidence Avg</span>
            <div style={{ background: "rgba(16, 185, 129, 0.15)", padding: 6, borderRadius: 8, color: "#6ee7b7" }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "var(--success)", letterSpacing: "-0.02em" }}>
            {(metrics.avg_confidence * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>LangGraph Triage Model</div>
        </div>
      </div>

      {/* Charts */}
      {tickets.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "1.5rem" }}>
          <div className="glass-card" style={{ minHeight: "310px", display: "flex", flexDirection: "column" }}>
            <h3 style={{ marginBottom: "1rem", fontSize: "1rem", fontWeight: 700, color: "#e2e8f0" }}>
              Distribution by Issue Category
            </h3>
            <div style={{ flex: 1, minHeight: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickMargin={10} interval={0} angle={-30} textAnchor="end" />
                  <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: "rgba(255,255,255,0.05)" }} 
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: "0.85rem" }} 
                  />
                  <Bar dataKey="value" fill="url(#blueGradient)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card" style={{ minHeight: "310px", display: "flex", flexDirection: "column" }}>
            <h3 style={{ marginBottom: "1rem", fontSize: "1rem", fontWeight: 700, color: "#e2e8f0" }}>
              Tickets by Priority Urgency
            </h3>
            <div style={{ flex: 1, minHeight: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={6}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name] || "#3b82f6"} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: "0.85rem" }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
