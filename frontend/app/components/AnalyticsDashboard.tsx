"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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
  }, [refreshTrigger]); // Re-fetch when refreshTrigger changes

  if (!metrics) return <div style={{ color: "#94a3b8", padding: "2rem" }}>Loading analytics...</div>;

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

  return (
    <div style={{ marginBottom: "3rem" }}>
      <h2 style={{ marginBottom: "1.5rem" }}>Live Dashboard</h2>
      
      {/* Metric Cards */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: "2rem", gap: "1.5rem" }}>
        <div className="glass-card" style={{ textAlign: "center", padding: "1.5rem" }}>
          <div style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "0.5rem" }}>Total Tickets</div>
          <div style={{ fontSize: "2.5rem", fontWeight: "bold", color: "#fff" }}>{metrics.total_tickets}</div>
        </div>
        <div className="glass-card" style={{ textAlign: "center", padding: "1.5rem" }}>
          <div style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "0.5rem" }}>Open Tickets</div>
          <div style={{ fontSize: "2.5rem", fontWeight: "bold", color: "var(--warning)" }}>{metrics.total_open}</div>
        </div>
        <div className="glass-card" style={{ textAlign: "center", padding: "1.5rem" }}>
          <div style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "0.5rem" }}>Total Escalations</div>
          <div style={{ fontSize: "2.5rem", fontWeight: "bold", color: "var(--danger)" }}>{metrics.total_escalations}</div>
        </div>
        <div className="glass-card" style={{ textAlign: "center", padding: "1.5rem" }}>
          <div style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "0.5rem" }}>Avg Confidence</div>
          <div style={{ fontSize: "2.5rem", fontWeight: "bold", color: "var(--success)" }}>{(metrics.avg_confidence * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* Charts */}
      {tickets.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
          <div className="glass-card" style={{ height: "300px", display: "flex", flexDirection: "column" }}>
            <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem", textAlign: "center", color: "#e2e8f0" }}>Tickets by Category</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickMargin={10} interval={0} angle={-45} textAnchor="end" />
                  <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.1)' }} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass-card" style={{ height: "300px", display: "flex", flexDirection: "column" }}>
            <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem", textAlign: "center", color: "#e2e8f0" }}>Tickets by Priority</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name === 'High' ? 'var(--danger)' : entry.name === 'Medium' ? 'var(--warning)' : 'var(--success)'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
