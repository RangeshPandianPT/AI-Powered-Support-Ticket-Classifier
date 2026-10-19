"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  Lock, Sparkles, Pin, Trash2, Tag, Plus, CheckCircle, 
  AlertCircle, PhoneCall, ShieldAlert, FileText, Loader2, RefreshCw 
} from "lucide-react";

interface InternalNote {
  id: number;
  ticket_id: number;
  author_name: string;
  author_role: string;
  note_text: string;
  note_type: string;
  tags: string[];
  is_pinned: boolean | number;
  created_at: string;
}

interface InternalNotesSectionProps {
  ticketId: number;
  onActivityLogged?: () => void;
}

const COMMON_TAGS = ["Escalation", "Billing Override", "Customer Call", "Bug Report", "VIP Account", "Follow Up Needed"];

export default function InternalNotesSection({ ticketId, onActivityLogged }: InternalNotesSectionProps) {
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNoteText, setNewNoteText] = useState("");
  const [authorName, setAuthorName] = useState("Sarah Chen");
  const [authorRole, setAuthorRole] = useState("Tier 2 Tech");
  const [noteType, setNoteType] = useState("internal");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatingHandover, setGeneratingHandover] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    if (ticketId) {
      fetchNotes();
    }
  }, [ticketId]);

  const fetchNotes = async () => {
    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/tickets/${ticketId}/notes`);
      setNotes(res.data || []);
    } catch (e) {
      console.error("Failed to load internal notes", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    setSubmitting(true);
    try {
      await axios.post(`http://127.0.0.1:8000/api/tickets/${ticketId}/notes`, {
        author_name: authorName,
        author_role: authorRole,
        note_text: newNoteText,
        note_type: noteType,
        tags: selectedTags,
        is_pinned: isPinned
      });

      setNewNoteText("");
      setSelectedTags([]);
      setIsPinned(false);
      setFeedbackMsg("Internal note posted successfully.");
      setTimeout(() => setFeedbackMsg(null), 3000);
      await fetchNotes();
      if (onActivityLogged) onActivityLogged();
    } catch (e) {
      console.error("Failed to post internal note", e);
      alert("Failed to post internal note.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!confirm("Are you sure you want to delete this internal note?")) return;
    try {
      await axios.delete(`http://127.0.0.1:8000/api/tickets/notes/${noteId}`);
      setNotes(notes.filter(n => n.id !== noteId));
      if (onActivityLogged) onActivityLogged();
    } catch (e) {
      console.error("Failed to delete note", e);
      alert("Error deleting note.");
    }
  };

  const handleTogglePin = async (noteId: number) => {
    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/tickets/notes/${noteId}/pin`);
      setNotes(notes.map(n => n.id === noteId ? { ...n, is_pinned: res.data.is_pinned } : n)
        .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned)));
    } catch (e) {
      console.error("Failed to toggle pin", e);
    }
  };

  const handleGenerateHandover = async () => {
    setGeneratingHandover(true);
    try {
      const res = await axios.post(`http://127.0.0.1:8000/api/tickets/${ticketId}/generate-handover`);
      setFeedbackMsg("AI Shift Handover briefing created and pinned!");
      setTimeout(() => setFeedbackMsg(null), 4000);
      await fetchNotes();
      if (onActivityLogged) onActivityLogged();
    } catch (e) {
      console.error("Failed to generate shift handover", e);
      alert("Error generating shift handover note.");
    } finally {
      setGeneratingHandover(false);
    }
  };

  const getNoteTypeIcon = (type: string) => {
    switch (type) {
      case "handover":
        return <FileText size={15} color="#8b5cf6" />;
      case "escalation":
        return <ShieldAlert size={15} color="#ef4444" />;
      case "call_log":
        return <PhoneCall size={15} color="#06b6d4" />;
      default:
        return <Lock size={15} color="#f59e0b" />;
    }
  };

  return (
    <div className="internal-notes-card" id="internal-notes-section">
      {/* Confidential Staff Banner */}
      <div className="internal-notes-header">
        <div className="internal-title-group">
          <div className="confidential-pill">
            <Lock size={13} />
            <span>Staff Confidential</span>
          </div>
          <h3 className="section-title">Private Internal Notes</h3>
          <span className="badge-pill count-pill">{notes.length}</span>
        </div>

        <button 
          id="btn-ai-handover-generator"
          className="btn-ai-handover"
          onClick={handleGenerateHandover}
          disabled={generatingHandover}
          title="Analyze this ticket conversation and automatically generate an agent shift handover briefing note"
        >
          {generatingHandover ? (
            <>
              <Loader2 size={14} className="spin-icon" />
              <span>Synthesizing Handover...</span>
            </>
          ) : (
            <>
              <Sparkles size={14} />
              <span>⚡ Generate AI Shift Handover</span>
            </>
          )}
        </button>
      </div>

      <p className="internal-disclaimer">
        These notes are visible <strong>only to support agents and internal team members</strong>. 
        The customer will never see this content.
      </p>

      {feedbackMsg && (
        <div className="internal-success-banner" id="notes-feedback-banner">
          <CheckCircle size={15} />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Note Creation Form */}
      <form onSubmit={handleAddNote} className="internal-form" id="create-internal-note-form">
        <div className="form-meta-row">
          <div className="input-group-inline">
            <label htmlFor="note-author-input">Agent:</label>
            <select 
              id="note-author-input" 
              value={authorName} 
              onChange={(e) => {
                setAuthorName(e.target.value);
                if (e.target.value === "Sarah Chen") setAuthorRole("Tier 2 Tech");
                else if (e.target.value === "Alex Rivera") setAuthorRole("Billing Lead");
                else if (e.target.value === "Elena Rostova") setAuthorRole("Escalations Ombudsman");
                else setAuthorRole("Support Agent");
              }}
              className="select-mini"
            >
              <option value="Sarah Chen">Sarah Chen (IT Support)</option>
              <option value="Alex Rivera">Alex Rivera (Billing Specialist)</option>
              <option value="Priya Patel">Priya Patel (Customer Success)</option>
              <option value="Elena Rostova">Elena Rostova (Executive Escalations)</option>
              <option value="Dev On-Call">Dev On-Call (Engineering Liaison)</option>
            </select>
          </div>

          <div className="input-group-inline">
            <label htmlFor="note-type-input">Type:</label>
            <select 
              id="note-type-input" 
              value={noteType} 
              onChange={(e) => setNoteType(e.target.value)}
              className="select-mini"
            >
              <option value="internal">General Internal Note</option>
              <option value="call_log">Customer Call Log</option>
              <option value="escalation">Escalation Notice</option>
              <option value="handover">Shift Handover</option>
            </select>
          </div>

          <label className="checkbox-pinned-label">
            <input 
              type="checkbox" 
              id="pin-note-checkbox"
              checked={isPinned} 
              onChange={(e) => setIsPinned(e.target.checked)} 
            />
            <Pin size={13} />
            <span>Pin to Top</span>
          </label>
        </div>

        <textarea
          id="internal-note-textarea"
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          placeholder="Log internal details, account history, call observations, or next-step instructions for team members..."
          rows={3}
          className="internal-textarea"
          required
        />

        {/* Quick Tag Chips */}
        <div className="tag-chips-wrapper">
          <span className="tag-label"><Tag size={12} /> Tags:</span>
          {COMMON_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`tag-chip ${isSelected ? "tag-chip-selected" : ""}`}
              >
                {isSelected ? "✓ " : "+ "}{tag}
              </button>
            );
          })}
        </div>

        <div className="form-submit-row">
          <span className="char-count">{newNoteText.length} characters</span>
          <button 
            type="submit" 
            id="post-internal-note-btn" 
            className="btn-post-note"
            disabled={submitting || !newNoteText.trim()}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="spin-icon" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Plus size={14} />
                <span>Post Internal Note</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Notes List */}
      <div className="notes-list-container">
        {loading ? (
          <div className="notes-loading-state">
            <Loader2 size={24} className="spin-icon" />
            <span>Loading internal notes...</span>
          </div>
        ) : notes.length === 0 ? (
          <div className="notes-empty-state">
            <Lock size={28} className="empty-icon" />
            <p className="empty-title">No internal notes logged yet</p>
            <p className="empty-subtitle">
              Add confidential research, customer call transcripts, or generate an AI shift handover note for the next agent on duty.
            </p>
          </div>
        ) : (
          <div className="notes-stack">
            {notes.map((note) => {
              const isPinnedNote = Boolean(note.is_pinned);
              return (
                <div 
                  key={note.id} 
                  id={`internal-note-${note.id}`}
                  className={`internal-note-item ${isPinnedNote ? "note-pinned" : ""}`}
                >
                  <div className="note-item-header">
                    <div className="note-author-info">
                      <div className="author-avatar-chip">
                        {note.author_name.charAt(0)}
                      </div>
                      <div>
                        <div className="author-title-row">
                          <span className="author-name">{note.author_name}</span>
                          <span className="author-role-badge">{note.author_role}</span>
                        </div>
                        <span className="note-timestamp">{note.created_at}</span>
                      </div>
                    </div>

                    <div className="note-action-chips">
                      {isPinnedNote && (
                        <span className="pinned-badge">
                          <Pin size={11} /> Pinned
                        </span>
                      )}
                      <span className="note-type-badge">
                        {getNoteTypeIcon(note.note_type)}
                        <span>{note.note_type.replace("_", " ")}</span>
                      </span>
                      <button 
                        onClick={() => handleTogglePin(note.id)} 
                        title={isPinnedNote ? "Unpin note" : "Pin note to top"}
                        className="btn-icon-note"
                      >
                        <Pin size={13} color={isPinnedNote ? "#f59e0b" : "#94a3b8"} />
                      </button>
                      <button 
                        onClick={() => handleDeleteNote(note.id)} 
                        title="Delete note"
                        className="btn-icon-note btn-icon-danger"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="note-body-text">
                    {note.note_text}
                  </div>

                  {note.tags && note.tags.length > 0 && (
                    <div className="note-tags-row">
                      {note.tags.map((t, idx) => (
                        <span key={idx} className="note-pill-tag">#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
