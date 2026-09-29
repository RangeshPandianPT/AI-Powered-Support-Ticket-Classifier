"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { Clock, ExternalLink } from "lucide-react";

export default function TicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/tickets");
      setTickets(res.data);
    } catch (e) {
      console.error("Failed to fetch tickets", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>Ticket Management</h1>
          <p style={{ color: "#94a3b8", marginTop: "0.5rem" }}>All customer support tickets</p>
        </div>
        <Link href="/" className="btn btn-outline" style={{ display: "inline-flex", textDecoration: "none" }}>
          Back to Dashboard
        </Link>
      </div>

      <div style={{ marginTop: "2rem" }}>
        {loading ? (
          <p>Loading tickets...</p>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
            {tickets.map(t => (
              <Link key={t.id} href={`/tickets/${t.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="glass-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "transform 0.2s" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                      <span className={`status-indicator ${t.status === "Open" ? "status-open" : "status-resolved"}`}></span>
                      <strong style={{ fontSize: "1.1rem" }}>#{t.id} - {t.category}</strong>
                      <span className="badge badge-neutral">{t.assigned_team}</span>
                      {t.requires_immediate_escalation === 1 && <span className="badge badge-danger">Urgent</span>}
                    </div>
                    <p style={{ color: "#94a3b8", fontSize: "0.9rem", maxWidth: "800px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {t.ticket_text}
                    </p>
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Clock size={14} /> {new Date(t.created_at).toLocaleDateString()}
                    </span>
                    <ExternalLink size={16} />
                  </div>
                </div>
              </Link>
            ))}
            {tickets.length === 0 && <p style={{ color: "#64748b" }}>No tickets found.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
