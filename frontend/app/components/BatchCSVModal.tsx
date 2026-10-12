"use client";
import { useState } from "react";
import axios from "axios";
import { X, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface BatchCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BatchCSVModal({ isOpen, onClose, onSuccess }: BatchCSVModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProcessSample = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await axios.post("http://127.0.0.1:8000/api/tickets/batch-csv");
      setResult(res.data);
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to process sample tickets.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadCustomCSV = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post("http://127.0.0.1:8000/api/tickets/batch-csv", formData);
      setResult(res.data);
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to process uploaded CSV.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "rgba(59, 130, 246, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#60a5fa"
            }}>
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff" }}>Batch CSV Ingestion</h2>
              <p style={{ fontSize: "0.82rem", color: "#94a3b8" }}>Classify multiple customer tickets through LangGraph in bulk</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "10px",
            padding: "0.85rem 1rem",
            marginBottom: "1.25rem",
            color: "#fca5a5",
            fontSize: "0.88rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}>
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Quick Sample CSV Box */}
          <div style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "1.25rem"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Default Benchmark Dataset</span>
              <span className="badge badge-neutral">sample_tickets.csv</span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "1rem" }}>
              Contains 7 pre-configured realistic support tickets across Billing, Logistics, Technical Support, and Pricing queries.
            </p>
            <button 
              className="btn btn-secondary" 
              onClick={handleProcessSample}
              disabled={loading}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {loading && !file ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
              Process Benchmark Dataset (sample_tickets.csv)
            </button>
          </div>

          {/* Custom Upload Box */}
          <div style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "1.25rem"
          }}>
            <span style={{ fontWeight: 600, fontSize: "0.95rem", display: "block", marginBottom: "0.5rem" }}>
              Upload Custom CSV File
            </span>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "1rem" }}>
              CSV must contain a column named <code>Ticket Description</code>, <code>ticket_text</code>, or <code>Description</code>.
            </p>
            <input 
              type="file" 
              accept=".csv"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              style={{ marginBottom: "1rem", color: "#94a3b8", fontSize: "0.88rem" }}
            />
            <button 
              className="btn btn-primary" 
              onClick={handleUploadCustomCSV}
              disabled={!file || loading}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {loading && file ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Upload & Process Custom CSV
            </button>
          </div>

          {/* Results Summary */}
          {result && (
            <div style={{
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "12px",
              padding: "1.25rem"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#6ee7b7", marginBottom: "0.75rem", fontWeight: 700 }}>
                <CheckCircle2 size={18} />
                {result.message}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Successfully Classified</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#10b981" }}>{result.successful}</div>
                </div>
                <div style={{ background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Failed / Skipped</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: result.failed > 0 ? "#ef4444" : "#94a3b8" }}>{result.failed}</div>
                </div>
              </div>

              {result.tickets && result.tickets.length > 0 && (
                <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {result.tickets.map((t: any) => (
                    <div key={t.id} style={{
                      background: "rgba(0,0,0,0.25)",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <div>
                        <strong>#{t.id}</strong> {t.summary}
                      </div>
                      <span className={`badge ${t.escalated ? "badge-danger" : "badge-neutral"}`} style={{ fontSize: "0.7rem" }}>
                        {t.category}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
