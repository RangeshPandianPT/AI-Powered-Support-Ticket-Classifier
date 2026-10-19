"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  History, UserCheck, ShieldAlert, FileText, CheckCircle, 
  Clock, Sparkles, Send, ArrowRight, RefreshCw, Filter, Loader2, MessageSquare
} from "lucide-react";

interface AuditLogItem {
  id: number;
  ticket_id: number;
  action_type: string;
  actor_name: string;
  actor_role: string;
  details: string;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
}

interface TicketAuditTimelineProps {
  ticketId: number;
  refreshTrigger?: number;
}

export default function TicketAuditTimeline({ ticketId, refreshTrigger }: TicketAuditTimelineProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("ALL");

  useEffect(() => {
    if (ticketId) {
      fetchAuditLogs();
    }
  }, [ticketId, refreshTrigger]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/tickets/${ticketId}/audit-logs`);
      setLogs(res.data || []);
    } catch (e) {
      console.error("Failed to load audit logs", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterType === "ALL") return true;
    if (filterType === "ASSIGNMENT") return log.action_type === "ASSIGNED";
    if (filterType === "STATUS") return log.action_type === "STATUS_CHANGE" || log.action_type === "RESOLVED";
    if (filterType === "NOTES") return log.action_type === "NOTE_ADDED" || log.action_type === "HANDOVER" || log.action_type === "NOTE_DELETED";
    if (filterType === "REPLIES") return log.action_type === "DRAFT_SENT" || log.action_type === "CUSTOMER_REPLY";
    return true;
  });

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "ASSIGNED":
        return <UserCheck size={14} color="#3b82f6" />;
      case "STATUS_CHANGE":
      case "RESOLVED":
        return <CheckCircle size={14} color="#10b981" />;
      case "ESCALATED":
        return <ShieldAlert size={14} color="#ef4444" />;
      case "NOTE_ADDED":
      case "HANDOVER":
        return <FileText size={14} color="#f59e0b" />;
      case "DRAFT_SENT":
        return <Send size={14} color="#8b5cf6" />;
      case "CUSTOMER_REPLY":
        return <MessageSquare size={14} color="#06b6d4" />;
      default:
        return <Clock size={14} color="#94a3b8" />;
    }
  };

  const getActionBadgeClass = (actionType: string) => {
    switch (actionType) {
      case "ASSIGNED": return "audit-chip-blue";
      case "STATUS_CHANGE":
      case "RESOLVED": return "audit-chip-green";
      case "ESCALATED": return "audit-chip-red";
      case "NOTE_ADDED":
      case "HANDOVER": return "audit-chip-amber";
      case "DRAFT_SENT": return "audit-chip-purple";
      case "CUSTOMER_REPLY": return "audit-chip-cyan";
      default: return "audit-chip-gray";
    }
  };

  return (
    <div className="audit-timeline-card" id="ticket-audit-timeline-card">
      {/* Header */}
      <div className="audit-timeline-header">
        <div className="audit-title-group">
          <History size={18} color="#3b82f6" />
          <h3 className="section-title">Audit Trail & Activity Log</h3>
          <span className="badge-pill count-pill">{logs.length}</span>
        </div>

        <button 
          id="btn-refresh-audit-logs"
          onClick={fetchAuditLogs} 
          disabled={loading}
          className="btn-icon-refresh"
          title="Refresh audit timeline"
        >
          <RefreshCw size={14} className={loading ? "spin-icon" : ""} />
        </button>
      </div>

      <p className="audit-subtitle">
        Immutable, chronological activity records including lifecycle status transitions, personnel reassignments, and notes.
      </p>

      {/* Filter Tabs */}
      <div className="audit-filters-row">
        <span className="filter-label"><Filter size={12} /> Filter:</span>
        <button 
          className={`audit-filter-btn ${filterType === "ALL" ? "audit-filter-active" : ""}`}
          onClick={() => setFilterType("ALL")}
        >
          All ({logs.length})
        </button>
        <button 
          className={`audit-filter-btn ${filterType === "ASSIGNMENT" ? "audit-filter-active" : ""}`}
          onClick={() => setFilterType("ASSIGNMENT")}
        >
          Assignments
        </button>
        <button 
          className={`audit-filter-btn ${filterType === "STATUS" ? "audit-filter-active" : ""}`}
          onClick={() => setFilterType("STATUS")}
        >
          Status
        </button>
        <button 
          className={`audit-filter-btn ${filterType === "NOTES" ? "audit-filter-active" : ""}`}
          onClick={() => setFilterType("NOTES")}
        >
          Internal Notes
        </button>
        <button 
          className={`audit-filter-btn ${filterType === "REPLIES" ? "audit-filter-active" : ""}`}
          onClick={() => setFilterType("REPLIES")}
        >
          Replies
        </button>
      </div>

      {/* Timeline Stream */}
      <div className="timeline-stream-container">
        {loading && logs.length === 0 ? (
          <div className="timeline-loading">
            <Loader2 size={22} className="spin-icon" />
            <span>Loading audit history...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="timeline-empty">
            <Clock size={28} className="empty-icon" />
            <p>No activity records match the selected filter.</p>
          </div>
        ) : (
          <div className="timeline-list">
            {filteredLogs.map((log, index) => (
              <div key={log.id || index} className="timeline-item" id={`audit-log-${log.id}`}>
                <div className="timeline-left-axis">
                  <div className={`timeline-icon-node ${getActionBadgeClass(log.action_type)}`}>
                    {getActionIcon(log.action_type)}
                  </div>
                  {index < filteredLogs.length - 1 && <div className="timeline-connector-line" />}
                </div>

                <div className="timeline-content-card">
                  <div className="timeline-meta-bar">
                    <div className="actor-info">
                      <span className="actor-name">{log.actor_name}</span>
                      {log.actor_role && <span className="actor-role-tag">{log.actor_role}</span>}
                    </div>
                    <span className="timeline-date">{log.created_at}</span>
                  </div>

                  <div className="timeline-details-text">
                    {log.details}
                  </div>

                  {/* Value Diff Bar if present */}
                  {(log.old_value || log.new_value) && (
                    <div className="diff-pill-bar">
                      {log.old_value && (
                        <span className="diff-pill diff-old">
                          From: {log.old_value}
                        </span>
                      )}
                      {log.old_value && log.new_value && <ArrowRight size={12} color="#64748b" />}
                      {log.new_value && (
                        <span className="diff-pill diff-new">
                          To: {log.new_value}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
