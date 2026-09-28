"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { BookOpen, Upload, Trash2, FileText, CheckCircle } from "lucide-react";

export default function KnowledgeBase() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [file, setFile] = useState<File | null>(null);

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
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await axios.delete(`http://127.0.0.1:8000/api/kb/${id}`);
      fetchDocs();
    } catch (e) {
      console.error(e);
      alert("Failed to delete document.");
    }
  };

  return (
    <div className="glass-card" style={{ marginTop: "2rem" }}>
      <h2 style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <BookOpen size={24} color="#a855f7" /> Knowledge Base Management
      </h2>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
        {/* Upload File Section */}
        <div style={{ background: "rgba(0,0,0,0.2)", padding: "1.5rem", borderRadius: "8px" }}>
          <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>Upload PDF / Text File</h3>
          <input 
            type="file" 
            accept=".txt,.pdf"
            onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
            style={{ marginBottom: "1rem", display: "block", color: "#94a3b8" }}
          />
          <button 
            className="btn" 
            onClick={handleUploadFile} 
            disabled={!file || loading}
          >
            <Upload size={18} /> {loading ? "Uploading..." : "Upload Document"}
          </button>
        </div>

        {/* Add Text Section */}
        <div style={{ background: "rgba(0,0,0,0.2)", padding: "1.5rem", borderRadius: "8px" }}>
          <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>Add Raw Text (FAQ/Policy)</h3>
          <textarea
            className="textarea"
            rows={3}
            placeholder="Paste raw text here..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            style={{ marginBottom: "1rem" }}
          ></textarea>
          <button 
            className="btn" 
            onClick={handleAddText} 
            disabled={!textInput.trim() || loading}
          >
            <FileText size={18} /> {loading ? "Adding..." : "Add Text"}
          </button>
        </div>
      </div>

      <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>Current Documents ({docs.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {docs.length === 0 ? (
          <p style={{ color: "#64748b" }}>No documents in Knowledge Base.</p>
        ) : (
          docs.map((doc, idx) => (
            <div key={idx} style={{ background: "rgba(0,0,0,0.2)", padding: "1rem", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.5rem" }}>ID: {doc.id}</p>
                <p style={{ fontSize: "0.9rem", color: "#e2e8f0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {doc.content}
                </p>
              </div>
              <button 
                className="btn btn-danger" 
                style={{ padding: "0.5rem" }} 
                onClick={() => handleDelete(doc.id)}
                title="Delete Document"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
