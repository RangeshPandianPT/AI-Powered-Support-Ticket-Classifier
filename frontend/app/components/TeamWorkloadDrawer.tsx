"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  Users, X, Briefcase, CheckCircle, AlertTriangle, 
  Sparkles, RefreshCw, Loader2, ShieldCheck, Mail, ArrowUpRight
} from "lucide-react";

interface TeamMemberWorkload {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  skills: string[];
  status: string;
  avatar_color: string;
  open_tickets: number;
  capacity_pct: number;
  is_at_capacity: boolean;
}

interface TeamWorkloadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAgentFilter?: (agentName: string) => void;
}

export default function TeamWorkloadDrawer({
  isOpen,
  onClose,
  onSelectAgentFilter
}: TeamWorkloadDrawerProps) {
  const [team, setTeam] = useState<TeamMemberWorkload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchWorkload();
    }
  }, [isOpen]);

  const fetchWorkload = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/team/workload");
      setTeam(res.data || []);
    } catch (e) {
      console.error("Failed to load team workload", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalActiveTickets = team.reduce((acc, m) => acc + (m.open_tickets || 0), 0);
  const onlineAgents = team.filter(m => m.status === "Online" || m.status === "In Shift").length;
  const avgLoad = team.length > 0 ? (totalActiveTickets / team.length).toFixed(1) : "0";

  return (
    <div className="workload-drawer-overlay" id="team-workload-modal">
      <div className="workload-drawer-container">
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <div className="icon-badge-blue">
              <Users size={18} />
            </div>
            <div>
              <h2 className="drawer-title">Team Workload & Capacity Center</h2>
              <p className="drawer-subtitle">
                Real-time staffing distribution, skill matrices, and active ticket allocations.
              </p>
            </div>
          </div>

          <div className="drawer-actions-right">
            <button 
              onClick={fetchWorkload} 
              className="btn-icon-refresh"
              title="Refresh workload metrics"
            >
              <RefreshCw size={15} className={loading ? "spin-icon" : ""} />
            </button>
            <button 
              id="btn-close-workload-drawer"
              onClick={onClose} 
              className="btn-icon-close"
              title="Close drawer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Telemetry Summary Cards */}
        <div className="workload-stats-grid">
          <div className="stat-card-mini">
            <span className="stat-label-mini">Active Staff</span>
            <span className="stat-val-mini text-success">{onlineAgents} / {team.length}</span>
            <span className="stat-sub-mini">Online or on shift</span>
          </div>

          <div className="stat-card-mini">
            <span className="stat-label-mini">Assigned Tickets</span>
            <span className="stat-val-mini text-primary">{totalActiveTickets}</span>
            <span className="stat-sub-mini">Currently in progress</span>
          </div>

          <div className="stat-card-mini">
            <span className="stat-label-mini">Average Load</span>
            <span className="stat-val-mini text-accent">{avgLoad}</span>
            <span className="stat-sub-mini">Cases per specialist</span>
          </div>
        </div>

        {/* Specialists List */}
        <div className="specialists-scroll-area">
          {loading ? (
            <div className="drawer-loading">
              <Loader2 size={24} className="spin-icon" />
              <span>Fetching team roster and ticket counts...</span>
            </div>
          ) : (
            <div className="specialists-grid">
              {team.map((member) => {
                const isHeavy = member.capacity_pct >= 80;
                return (
                  <div key={member.id} className="specialist-card" id={`specialist-${member.id}`}>
                    <div className="specialist-card-top">
                      <div 
                        className="specialist-avatar"
                        style={{ background: member.avatar_color }}
                      >
                        {member.name.charAt(0)}
                      </div>

                      <div className="specialist-header-meta">
                        <div className="name-and-status">
                          <span className="spec-name">{member.name}</span>
                          <span className={`status-chip chip-${member.status.toLowerCase().replace(" ", "-")}`}>
                            {member.status}
                          </span>
                        </div>
                        <p className="spec-role">{member.role}</p>
                        <p className="spec-dept">{member.department}</p>
                      </div>
                    </div>

                    {/* Capacity Progress Bar */}
                    <div className="capacity-bar-group">
                      <div className="capacity-labels">
                        <span className="cap-label-title">Active Workload</span>
                        <span className={`cap-label-val ${isHeavy ? "text-danger" : "text-primary"}`}>
                          {member.open_tickets} / 8 cases ({member.capacity_pct}%)
                        </span>
                      </div>
                      <div className="progress-track">
                        <div 
                          className={`progress-fill ${isHeavy ? "fill-danger" : "fill-primary"}`}
                          style={{ width: `${Math.min(100, member.capacity_pct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Skills Chips */}
                    <div className="spec-skills-row">
                      {member.skills.map((skill, sIdx) => (
                        <span key={sIdx} className="spec-skill-pill">
                          {skill}
                        </span>
                      ))}
                    </div>

                    {/* Filter Button */}
                    {onSelectAgentFilter && (
                      <button 
                        className="btn-filter-agent-tickets"
                        onClick={() => {
                          onSelectAgentFilter(member.name);
                          onClose();
                        }}
                      >
                        <span>View Assigned Cases</span>
                        <ArrowUpRight size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
