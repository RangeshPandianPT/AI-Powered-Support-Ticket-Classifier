"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { BookOpen, Upload, Trash2, FileText, CheckCircle, Database, Plus, Search } from "lucide-react";

export default function KnowledgeBase() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<"text" | "file">("file");
  const [searchFilter, setSearchFilter] = useState("");

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

        <div style={{ display: "flex", gap: "0.5rem" }}>
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
        </div>
      </div>

      {/* Input Form */}
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
        ) : (
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
