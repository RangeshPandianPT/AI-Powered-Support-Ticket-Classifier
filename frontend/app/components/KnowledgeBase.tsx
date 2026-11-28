"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { BookOpen, Upload, Trash2, FileText, CheckCircle, Database, Plus, Search, Sparkles, AlertTriangle, RefreshCw } from "lucide-react";

export default function KnowledgeBase() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<"file" | "text" | "search" | "gaps">("file");
  const [searchFilter, setSearchFilter] = useState("");

  // Semantic RAG Tester State
  const [ragQuery, setRagQuery] = useState("");
  const [ragResults, setRagResults] = useState<any[]>([]);
  const [searchingRag, setSearchingRag] = useState(false);

  // AI Gap Detector State
  const [gapReport, setGapReport] = useState<any>(null);
  const [scanningGaps, setScanningGaps] = useState(false);
  const [publishingGap, setPublishingGap] = useState<string | null>(null);

  const fetchDocs = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/kb");
      setDocs(res.data);
    } catch (e) {
      console.error("Failed to fetch KB docs", e);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleAddText = async () => {
    if (!textInput.trim()) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("text", textInput);
      await axios.post("http://127.0.0.1:8000/api/kb", formData);
      setTextInput("");
      fetchDocs();
    } catch (e) {
      console.error(e);
      alert("Failed to add text to KB.");
    }
    setLoading(false);
  };

  const handleUploadFile = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await axios.post("http://127.0.0.1:8000/api/kb", formData);
      setFile(null);
      fetchDocs();
    } catch (e) {
      console.error(e);
      alert("Failed to upload file to KB.");
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document from vector storage?")) return;
    try {
      await axios.delete(`http://127.0.0.1:8000/api/kb/${id}`);
      fetchDocs();
    } catch (e) {
      console.error(e);
      alert("Failed to delete document.");
    }
  };

  const handleSemanticSearch = async () => {
    if (!ragQuery.trim()) return;
    setSearchingRag(true);
    try {
      const res = await axios.post("http://127.0.0.1:8000/api/kb/search", {
        query: ragQuery,
        n_results: 3
      });
      setRagResults(res.data?.results || []);
    } catch (e) {
      console.error("Semantic search failed", e);
    } finally {
      setSearchingRag(false);
    }
  };

  const handleScanGaps = async () => {
    setScanningGaps(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/kb/gaps");
      setGapReport(res.data);
    } catch (e) {
      console.error("Failed to scan KB gaps", e);
    } finally {
      setScanningGaps(false);
    }
  };

  const handleSynthesizeAndPublish = async (gap: any) => {
    setPublishingGap(gap.category);
    try {
      const ticketId = gap.sample_ticket_ids?.[0] || null;
      await axios.post("http://127.0.0.1:8000/api/kb/synthesize", {
        topic: gap.suggested_title,
        ticket_id: ticketId,
        auto_publish: true
      });
      await Promise.all([fetchDocs(), handleScanGaps()]);
    } catch (e) {
      console.error("Failed to synthesize KB article", e);
    } finally {
      setPublishingGap(null);
    }
  };

  const filteredDocs = docs.filter(d => 
    d.content.toLowerCase().includes(searchFilter.toLowerCase()) || 
    d.id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="glass-card" style={{ marginTop: "2.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "rgba(139, 92, 246, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#c084fc"
          }}>
            <Database size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#fff" }}>
              RAG Knowledge Base & Policy Store
            </h2>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
              Vectorized documents in ChromaDB used by LangGraph to ground customer draft responses
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button 
            className={`filter-pill ${activeTab === "file" ? "active" : ""}`}
            onClick={() => setActiveTab("file")}
          >
            Upload File (.pdf / .txt)
          </button>
          <button 
            className={`filter-pill ${activeTab === "text" ? "active" : ""}`}
            onClick={() => setActiveTab("text")}
          >
            Add FAQ Policy Text
          </button>
          <button 
            className={`filter-pill ${activeTab === "search" ? "active" : ""}`}
            onClick={() => setActiveTab("search")}
          >
            🔍 Semantic RAG Tester
          </button>
          <button 
            className={`filter-pill ${activeTab === "gaps" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("gaps");
              if (!gapReport) handleScanGaps();
            }}
          >
            ✨ AI Gap Detector
          </button>
        </div>
      </div>

      {/* Input Form / RAG Tester / Gap Detector */}
      <div style={{
        background: "rgba(15, 23, 42, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "14px",
        padding: "1.5rem",
        marginBottom: "2rem"
      }}>
        {activeTab === "file" ? (
          <div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.5rem" }}>
              Upload Policy Document (PDF or Text)
            </div>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <input 
                type="file" 
                accept=".txt,.pdf"
                onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                style={{ color: "#94a3b8", fontSize: "0.9rem" }}
              />
              <button 
                className="btn btn-purple" 
                onClick={handleUploadFile} 
                disabled={!file || loading}
              >
                <Upload size={16} /> {loading ? "Indexing vector embeddings..." : "Index Document"}
              </button>
            </div>
          </div>
        ) : activeTab === "text" ? (
          <div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.5rem" }}>
              Insert Support FAQ / Policy Directive
            </div>
            <textarea
              className="textarea"
              rows={3}
              placeholder="e.g. Refund Policy: Customers can request a full refund within 30 days of purchase..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              style={{ marginBottom: "0.85rem" }}
            ></textarea>
            <button 
              className="btn btn-purple" 
              onClick={handleAddText} 
              disabled={!textInput.trim() || loading}
            >
              <Plus size={16} /> {loading ? "Storing..." : "Add to Knowledge Base"}
            </button>
          </div>
        ) : activeTab === "search" ? (
          <div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.5rem" }}>
              Test Semantic Vector Retrieval &amp; Similarity Scoring
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
              <input
                type="text"
                className="input"
                placeholder="Ask a customer question (e.g. 'How do I get a refund for a duplicate charge?')"
                value={ragQuery}
                onChange={(e) => setRagQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSemanticSearch()}
                style={{ flex: 1, margin: 0 }}
              />
              <button
                className="btn btn-purple"
                onClick={handleSemanticSearch}
                disabled={searchingRag || !ragQuery.trim()}
              >
                <Search size={15} /> {searchingRag ? "Searching..." : "Test Retrieval"}
              </button>
            </div>

            {ragResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {ragResults.map((r, i) => (
                  <div key={i} style={{
                    background: "rgba(139, 92, 246, 0.08)",
                    border: "1px solid rgba(139, 92, 246, 0.25)",
                    borderRadius: "8px",
                    padding: "0.75rem 1rem"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                      <span className="badge badge-purple" style={{ fontSize: "0.7rem" }}>{r.id}</span>
                      <span style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: r.similarity_score >= 60 ? "#34d399" : "#fbbf24"
                      }}>
                        {r.similarity_score}% Semantic Match (dist: {r.distance})
                      </span>
                    </div>
                    <p style={{ fontSize: "0.84rem", color: "#e2e8f0", margin: 0, lineHeight: 1.45 }}>
                      {r.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Sparkles size={16} color="#c084fc" />
                  AI Knowledge Coverage &amp; Gap Analyzer
                </div>
                <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                  Compares recent support tickets against ChromaDB embeddings to find undocumented issues
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleScanGaps}
                disabled={scanningGaps}
              >
                <RefreshCw size={14} className={scanningGaps ? "animate-spin" : ""} />
                {scanningGaps ? "Scanning..." : "Rescan Tickets"}
              </button>
            </div>

            {gapReport && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem", background: "rgba(255,255,255,0.03)", padding: "0.75rem 1rem", borderRadius: "8px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                      <span style={{ color: "#cbd5e1" }}>KB Deflection Coverage ({gapReport.covered_tickets}/{gapReport.scanned_tickets} recent tickets)</span>
                      <strong style={{ color: gapReport.kb_coverage_score >= 70 ? "#34d399" : "#fbbf24" }}>{gapReport.kb_coverage_score}%</strong>
                    </div>
                    <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        width: `${gapReport.kb_coverage_score}%`,
                        height: "100%",
                        background: gapReport.kb_coverage_score >= 70 ? "#10b981" : "#f59e0b"
                      }} />
                    </div>
                  </div>
                </div>

                {gapReport.gaps && gapReport.gaps.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                    {gapReport.gaps.map((gap: any, idx: number) => (
                      <div key={idx} style={{
                        background: "rgba(245, 158, 11, 0.08)",
                        border: "1px solid rgba(245, 158, 11, 0.25)",
                        borderRadius: "8px",
                        padding: "0.75rem 1rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1rem",
                        flexWrap: "wrap"
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                            <AlertTriangle size={14} color="#fbbf24" />
                            <strong style={{ color: "#fff", fontSize: "0.86rem" }}>{gap.suggested_title}</strong>
                            <span className="badge badge-warning" style={{ fontSize: "0.68rem" }}>{gap.ticket_count} uncovered tickets</span>
                          </div>
                          <div style={{ fontSize: "0.76rem", color: "#94a3b8" }}>
                            Avg KB Match: {gap.avg_similarity}% &bull; Sample Ticket IDs: {gap.sample_ticket_ids.map((id: number) => `#${id}`).join(", ")}
                          </div>
                        </div>
                        <button
                          className="btn btn-purple btn-sm"
                          onClick={() => handleSynthesizeAndPublish(gap)}
                          disabled={publishingGap === gap.category}
                        >
                          <Sparkles size={13} />
                          {publishingGap === gap.category ? "Publishing..." : "Synthesize & Publish to KB"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: "0.84rem", color: "#34d399", textAlign: "center", padding: "0.75rem" }}>
                    ✔ All scanned tickets are well covered by existing Knowledge Base policies!
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Document List Header with Search */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#e2e8f0" }}>
          Indexed Policies ({docs.length})
        </h3>
        {docs.length > 0 && (
          <div style={{ position: "relative", width: "260px" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#64748b" }} />
            <input 
              type="text" 
              className="input" 
              placeholder="Search knowledge docs..." 
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{ paddingLeft: "2rem", paddingBottom: "0.45rem", paddingTop: "0.45rem", fontSize: "0.85rem" }}
            />
          </div>
        )}
      </div>

      {/* Documents List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", maxHeight: "380px", overflowY: "auto" }}>
        {docs.length === 0 ? (
          <p style={{ color: "#64748b", padding: "1rem", textAlign: "center" }}>
            No documents in Knowledge Base. Add FAQs or upload policies above.
          </p>
        ) : filteredDocs.length === 0 ? (
          <p style={{ color: "#64748b", padding: "1rem" }}>No matching documents found.</p>
        ) : (
          filteredDocs.map((doc) => (
            <div 
              key={doc.id} 
              style={{ 
                background: "rgba(15, 23, 42, 0.4)", 
                border: "1px solid rgba(255, 255, 255, 0.06)",
                padding: "1rem 1.25rem", 
                borderRadius: "10px", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "flex-start", 
                gap: "1rem" 
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                  <span className="badge badge-purple" style={{ fontSize: "0.7rem" }}>{doc.id}</span>
                </div>
                <p style={{ fontSize: "0.88rem", color: "#e2e8f0", lineHeight: 1.5 }}>
                  {doc.content}
                </p>
              </div>
              <button 
                className="btn btn-danger btn-sm" 
                onClick={() => handleDelete(doc.id)}
                title="Delete from vector database"
                style={{ flexShrink: 0 }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
