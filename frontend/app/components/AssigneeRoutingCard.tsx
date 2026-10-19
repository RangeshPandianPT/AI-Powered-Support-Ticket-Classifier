"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  UserCheck, Sparkles, ChevronDown, Check, UserPlus, 
  ShieldCheck, Loader2, Users, AlertCircle, Briefcase, Zap
} from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  skills: string[];
  status: string;
  avatar_color: string;
  open_tickets?: number;
  capacity_pct?: number;
}

interface AssigneeRoutingCardProps {
  ticketId: number;
  currentAssigneeName?: string;
  currentAssigneeEmail?: string;
  ticketCategory?: string;
  ticketPriority?: string;
  onAssigneeUpdated: (newAssigneeName: string, newAssigneeEmail?: string) => void;
}

export default function AssigneeRoutingCard({
  ticketId,
  currentAssigneeName = "Unassigned",
  currentAssigneeEmail,
  ticketCategory,
  ticketPriority,
  onAssigneeUpdated
}: AssigneeRoutingCardProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAutoRouting, setIsAutoRouting] = useState(false);
  const [isManualAssigning, setIsManualAssigning] = useState(false);
  const [routingFeedback, setRoutingFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamWorkload();
  }, []);

  const fetchTeamWorkload = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/team/workload");
      setTeamMembers(res.data || []);
    } catch (e) {
      console.error("Failed to load team workload", e);
    }
  };

  const handleManualAssign = async (member: TeamMember) => {
    setIsManualAssigning(true);
    try {
      await axios.put(`http://127.0.0.1:8000/api/tickets/${ticketId}/assign`, {
        assignee_name: member.name,
        assignee_email: member.email,
        actor_name: "Staff Lead"
      });

      onAssigneeUpdated(member.name, member.email);
      setIsDropdownOpen(false);
      setRoutingFeedback(`Assigned to ${member.name}`);
      setTimeout(() => setRoutingFeedback(null), 3000);
      fetchTeamWorkload();
    } catch (e) {
      console.error("Failed to reassign ticket", e);
      alert("Error assigning ticket.");
    } finally {
      setIsManualAssigning(false);
    }
  };

  const handleAiAutoRoute = async () => {
    setIsAutoRouting(true);
    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/tickets/${ticketId}/auto-assign`);
      const assigned = res.data;
      onAssigneeUpdated(assigned.assignee_name, assigned.assignee_email);
      setRoutingFeedback(`AI routed to ${assigned.assignee_name}`);
      setTimeout(() => setRoutingFeedback(null), 4000);
      fetchTeamWorkload();
    } catch (e) {
      console.error("Failed to auto-route ticket", e);
      alert("Error executing AI auto-assignment.");
    } finally {
      setIsAutoRouting(false);
    }
  };

  const currentMember = teamMembers.find(m => m.name === currentAssigneeName);
  const isAssigned = currentAssigneeName && currentAssigneeName !== "Unassigned";

  return (
    <div className="assignee-routing-card" id="assignee-routing-component">
      <div className="assignee-header-row">
        <div className="assignee-title-group">
          <UserCheck size={16} color="#3b82f6" />
          <span className="card-label">Assigned Specialist</span>
        </div>

        {/* 1-Click AI Auto Route Button */}
        <button
          id="btn-ai-auto-route"
          className="btn-ai-autoroute"
          onClick={handleAiAutoRoute}
          disabled={isAutoRouting}
          title="Intelligently route to best available specialist based on load & skills"
        >
          {isAutoRouting ? (
            <>
              <Loader2 size={13} className="spin-icon" />
              <span>Routing...</span>
            </>
          ) : (
            <>
              <Zap size={13} />
              <span>⚡ AI Auto-Route</span>
            </>
          )}
        </button>
      </div>

      {routingFeedback && (
        <div className="routing-feedback-banner">
          <Sparkles size={13} color="#10b981" />
          <span>{routingFeedback}</span>
        </div>
      )}

      {/* Current Assignee Profile Display */}
      <div className="assignee-profile-box">
        <div 
          className="assignee-avatar-circle" 
          style={{ background: currentMember?.avatar_color || "#3b82f6" }}
        >
          {isAssigned ? currentAssigneeName.charAt(0) : "?"}
        </div>

        <div className="assignee-details">
          <div className="assignee-name-row">
            <span className="assignee-name-text">
              {currentAssigneeName || "Unassigned"}
            </span>
            {currentMember?.status && (
              <span className={`status-dot-badge status-${currentMember.status.toLowerCase()}`}>
                {currentMember.status}
              </span>
            )}
          </div>
          <p className="assignee-role-text">
            {currentMember ? `${currentMember.role} • ${currentMember.department}` : "No agent assigned to this case yet."}
          </p>
        </div>

        {/* Reassign Dropdown Trigger */}
        <div className="reassign-trigger-wrapper">
          <button
            id="btn-reassign-dropdown"
            className="btn-reassign-toggle"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <span>Transfer</span>
            <ChevronDown size={14} className={isDropdownOpen ? "rotate-180" : ""} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu of Available Agents */}
      {isDropdownOpen && (
        <div className="reassign-dropdown-menu" id="reassign-agent-menu">
          <div className="dropdown-menu-header">
            <Users size={14} />
            <span>Select Available Support Agent</span>
          </div>

          <div className="agent-options-list">
            {teamMembers.map((member) => {
              const isCurrent = member.name === currentAssigneeName;
              return (
                <button
                  key={member.id}
                  className={`agent-option-row ${isCurrent ? "agent-current" : ""}`}
                  onClick={() => handleManualAssign(member)}
                  disabled={isManualAssigning}
                >
                  <div 
                    className="agent-mini-avatar"
                    style={{ background: member.avatar_color }}
                  >
                    {member.name.charAt(0)}
                  </div>

                  <div className="agent-option-info">
                    <div className="agent-option-name-line">
                      <span className="agent-name">{member.name}</span>
                      <span className="agent-department-tag">{member.department}</span>
                    </div>
                    <div className="agent-workload-line">
                      <span className="workload-count">{member.open_tickets || 0} active tickets</span>
                      <span className="bullet-sep">•</span>
                      <span className="agent-status-label">{member.status}</span>
                    </div>
                  </div>

                  {isCurrent && <Check size={16} className="selected-check" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
