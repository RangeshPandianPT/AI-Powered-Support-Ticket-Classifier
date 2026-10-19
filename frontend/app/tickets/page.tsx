"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { Clock, ExternalLink, Search, Filter, AlertTriangle, CheckCircle, Trash2, ArrowLeft, RefreshCw, MessageSquare, UserCheck, Users } from "lucide-react";
import Navbar from "../components/Navbar";
import TeamWorkloadDrawer from "../components/TeamWorkloadDrawer";

export default function TicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [teamFilter, setTeamFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [workloadDrawerOpen, setWorkloadDrawerOpen] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "All") params.status = statusFilter;
      if (teamFilter !== "All") params.team = teamFilter;
      if (priorityFilter !== "All") params.priority = priorityFilter;
      if (search.trim()) params.search = search.trim();

      const res = await axios.get("http://127.0.0.1:8000/api/tickets", { params });
      setTickets(res.data);
    } catch (e) {
      console.error("Failed to fetch tickets", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchTickets();
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [search, statusFilter, teamFilter, priorityFilter]);

  const handleToggleStatus = async (e: React.MouseEvent, ticket: any) => {
    e.preventDefault();
    e.stopPropagation();
    const nextStatus = ticket.status === "Open" ? "Resolved" : "Open";
    try {
      await axios.put(`http://127.0.0.1:8000/api/tickets/${ticket.id}/status`, { status: nextStatus });
      setTickets(tickets.map(t => t.id === ticket.id ? { ...t, status: nextStatus } : t));
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleDeleteTicket = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete ticket #${id}? This cannot be undone.`)) return;
    try {
      await axios.delete(`http://127.0.0.1:8000/api/tickets/${id}`);
      setTickets(tickets.filter(t => t.id !== id));
    } catch (err) {
      console.error("Failed to delete ticket", err);
    }
  };

  // Sorting
  const sortedTickets = [...tickets].sort((a, b) => {
    if (sortBy === "oldest") {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sortBy === "priority") {
      const pWeights: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
      return (pWeights[b.priority] || 0) - (pWeights[a.priority] || 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const totalOpen = tickets.filter(t => t.status === "Open").length;
  const totalUrgent = tickets.filter(t => t.requires_immediate_escalation === 1).length;

  return (
    <>
      <Navbar />

      <div className="container">
        {/* Header */}
        <div className="header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <Link href="/" style={{ color: "#94a3b8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.88rem" }}>
                <ArrowLeft size={16} /> Back to Dashboard
              </Link>
            </div>
            <h1>Ticket Operations Center</h1>
            <p style={{ color: "#94a3b8", marginTop: "0.25rem" }}>
              Filter, search, and manage all incoming customer support tickets
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button 
              id="btn-operations-team-workload"
              className="btn btn-secondary" 
              onClick={() => setWorkloadDrawerOpen(true)}
              title="View team workload distribution and staffing capacity"
            >
              <Users size={16} /> Team Workload
            </button>
            <button className="btn btn-secondary" onClick={fetchTickets}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {/* Quick Stats Banner */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
          <div className="glass-card" style={{ padding: "1rem 1.25rem" }}>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Matching Tickets</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff" }}>{tickets.length}</div>
          </div>
          <div className="glass-card" style={{ padding: "1rem 1.25rem" }}>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Open & Pending</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--warning)" }}>{totalOpen}</div>
          </div>
          <div className="glass-card" style={{ padding: "1rem 1.25rem" }}>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Urgent Escalations</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--danger)" }}>{totalUrgent}</div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="filter-bar">
          <div style={{ position: "relative", flex: "1 1 260px" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "#64748b" }} />
            <input 
              type="text"
              className="input"
              placeholder="Search by text, summary, issue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "2.25rem", margin: 0, paddingBottom: "0.6rem", paddingTop: "0.6rem" }}
            />
          </div>

          {/* Status Pills */}
          <div className="filter-pills">
            {["All", "Open", "Resolved"].map(st => (
              <button
                key={st}
                className={`filter-pill ${statusFilter === st ? "active" : ""}`}
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Priority Select */}
          <select 
            className="select" 
            value={priorityFilter} 
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ width: "auto", padding: "0.55rem 0.85rem", fontSize: "0.85rem", margin: 0 }}
          >
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Team Select */}
          <select 
            className="select" 
            value={teamFilter} 
            onChange={(e) => setTeamFilter(e.target.value)}
            style={{ width: "auto", padding: "0.55rem 0.85rem", fontSize: "0.85rem", margin: 0 }}
          >
            <option value="All">All Teams</option>
            <option value="IT">IT</option>
            <option value="Logistics">Logistics</option>
            <option value="Customer Success">Customer Success</option>
            <option value="Sales">Sales</option>
            <option value="General Support">General Support</option>
          </select>

          {/* Sort By */}
          <select 
            className="select" 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            style={{ width: "auto", padding: "0.55rem 0.85rem", fontSize: "0.85rem", margin: 0 }}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="priority">Highest Priority</option>
          </select>
        </div>

        {/* Tickets Listing */}
        <div>
          {loading ? (
            <div className="glass-card" style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
              Loading matching tickets...
            </div>
          ) : sortedTickets.length === 0 ? (
            <div className="glass-card" style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
              No tickets matched the current search or filters.
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "1rem" }}>
              {sortedTickets.map(t => (
                <Link key={t.id} href={`/tickets/${t.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <div className="glass-card" style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center", 
                    cursor: "pointer",
                    padding: "1.25rem 1.5rem"
                  }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: "1.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                        <span className={`status-indicator ${t.status === "Open" ? "status-open" : "status-resolved"}`}></span>
                        <strong style={{ fontSize: "1.1rem", color: "#fff" }}>#{t.id} - {t.category}</strong>
                        <span className="badge badge-neutral">{t.assigned_team}</span>
                        <span className={`badge ${t.priority === "High" ? "badge-danger" : t.priority === "Medium" ? "badge-warning" : "badge-neutral"}`}>
                          {t.priority}
                        </span>
                        <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "#cbd5e1" }}>
                          {t.sentiment}
                        </span>
                        <span className="badge" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#93c5fd", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <MessageSquare size={11} /> {t.message_count || 1} msg{(t.message_count || 1) === 1 ? "" : "s"}
                        </span>
                        {t.assignee_name && t.assignee_name !== "Unassigned" ? (
                          <span className="badge" style={{ background: "rgba(139, 92, 246, 0.2)", color: "#c084fc", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <UserCheck size={11} /> {t.assignee_name}
                          </span>
                        ) : (
                          <span className="badge" style={{ background: "rgba(255, 255, 255, 0.05)", color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <UserCheck size={11} /> Unassigned
                          </span>
                        )}
                        {t.is_sla_breached ? (
                          <span className="sla-pill breached animate-pulse" style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
                            <AlertTriangle size={11} /> SLA Breached
                          </span>
                        ) : t.sla_remaining_minutes !== undefined && t.status === "Open" ? (
                          <span className={`sla-pill ${t.sla_remaining_minutes < 120 ? 'warning' : 'normal'}`} style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
                            <Clock size={11} /> {t.sla_remaining_minutes > 0 ? `${Math.floor(t.sla_remaining_minutes / 60)}h ${t.sla_remaining_minutes % 60}m SLA` : 'Due'}
                          </span>
                        ) : null}
                        {t.requires_immediate_escalation === 1 && (
                          <span className="badge badge-danger">
                            <AlertTriangle size={12} /> Urgent
                          </span>
                        )}
                      </div>

                      <div style={{ fontWeight: 600, color: "#e2e8f0", fontSize: "0.95rem", marginBottom: "0.25rem" }}>
                        {t.summary || t.ticket_text.slice(0, 80)}
                      </div>

                      <p style={{ color: "#94a3b8", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.ticket_text}
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0 }}>
                      <button 
                        className={`btn btn-sm ${t.status === "Open" ? "btn-success" : "btn-outline"}`}
                        onClick={(e) => handleToggleStatus(e, t)}
                        title={t.status === "Open" ? "Mark ticket as resolved" : "Reopen ticket"}
                      >
                        <CheckCircle size={14} />
                        {t.status === "Open" ? "Resolve" : "Reopen"}
                      </button>

                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={(e) => handleDeleteTicket(e, t.id)}
                        title="Delete ticket"
                        style={{ padding: "0.45rem" }}
                      >
                        <Trash2 size={14} />
                      </button>

                      <div style={{ color: "#64748b", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <Clock size={14} /> {new Date(t.created_at).toLocaleDateString()}
                      </div>

                      <ExternalLink size={16} color="#94a3b8" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <TeamWorkloadDrawer
        isOpen={workloadDrawerOpen}
        onClose={() => setWorkloadDrawerOpen(false)}
        onSelectAgentFilter={(agentName) => setSearch(agentName)}
      />
    </>
  );
}
