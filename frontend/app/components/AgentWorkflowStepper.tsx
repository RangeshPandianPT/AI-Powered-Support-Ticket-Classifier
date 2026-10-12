"use client";
import { useState } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Bot, Database, Mail, BellRing, Loader2 } from "lucide-react";

interface WorkflowStep {
  agent: string;
  status: string;
  summary: string;
  details?: Record<string, any>;
}

interface AgentWorkflowStepperProps {
  steps?: WorkflowStep[];
  isLoading?: boolean;
}

const DEFAULT_AGENTS = [
  {
    name: "Triage Agent",
    icon: Bot,
    color: "#3b82f6",
    role: "LLM Classification & Sentiment Assessment"
  },
  {
    name: "RAG Knowledge Agent",
    icon: Database,
    color: "#8b5cf6",
    role: "ChromaDB Semantic Document Search"
  },
  {
    name: "Response Drafter Agent",
    icon: Mail,
    color: "#10b981",
    role: "Context-Aware Customer Resolution Drafting"
  },
  {
    name: "Escalation Sentinel",
    icon: BellRing,
    color: "#ef4444",
    role: "SLA Evaluation & Slack Webhook Dispatch"
  }
];

export default function AgentWorkflowStepper({ steps, isLoading }: AgentWorkflowStepperProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  return (
    <div style={{ marginTop: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#cbd5e1", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>LangGraph Multi-Agent Execution Flow</span>
          {isLoading && <Loader2 size={16} className="animate-spin" color="#3b82f6" />}
        </h4>
        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
          {steps && steps.length > 0 ? `${steps.length} Agents Executed` : "4-Stage Pipeline"}
        </span>
      </div>

      <div className="stepper-container">
        {DEFAULT_AGENTS.map((agentConfig, idx) => {
          const stepData = steps?.find(s => s.agent === agentConfig.name);
          const isDone = Boolean(stepData);
          const isEscalated = stepData?.status === "escalated";
          const Icon = agentConfig.icon;

          return (
            <div 
              key={agentConfig.name}
              className={`step-card ${isDone ? "active" : ""} ${isEscalated ? "escalated" : ""}`}
              style={{
                opacity: !isDone && !isLoading ? 0.6 : 1,
                borderColor: isEscalated ? "#ef4444" : isDone ? "rgba(59, 130, 246, 0.4)" : "rgba(255, 255, 255, 0.08)"
              }}
            >
              <div 
                className="step-icon" 
                style={{ 
                  background: isEscalated 
                    ? "rgba(239, 68, 68, 0.2)" 
                    : isDone 
                      ? `${agentConfig.color}25` 
                      : "rgba(255, 255, 255, 0.05)",
                  color: isEscalated ? "#ef4444" : isDone ? agentConfig.color : "#94a3b8"
                }}
              >
                {isLoading && !isDone ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Icon size={18} />
                )}
              </div>

              <div className="step-content">
                <div className="step-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="step-title">{agentConfig.name}</span>
                    {isDone && (
                      <span className={`badge ${isEscalated ? "badge-danger" : "badge-success"}`} style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem" }}>
                        {isEscalated ? "Urgent Alert" : "Passed"}
                      </span>
                    )}
                  </div>

                  {stepData?.details && (
                    <button 
                      onClick={() => toggleExpand(idx)}
                      style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center" }}
                      title="Inspect agent details"
                    >
                      {expandedIndex === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  )}
                </div>

                <div className="step-summary">
                  {stepData ? stepData.summary : agentConfig.role}
                </div>

                {expandedIndex === idx && stepData?.details && (
                  <div style={{
                    marginTop: "0.75rem",
                    padding: "0.75rem",
                    background: "rgba(0, 0, 0, 0.35)",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                    fontFamily: "monospace",
                    color: "#93c5fd",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word"
                  }}>
                    {JSON.stringify(stepData.details, null, 2)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
