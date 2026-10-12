"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Layers, Ticket, BookOpen, Inbox, FileSpreadsheet } from "lucide-react";

interface NavbarProps {
  onOpenBatchCSV?: () => void;
  onIngestIMAP?: () => void;
  isIngesting?: boolean;
}

export default function Navbar({ onOpenBatchCSV, onIngestIMAP, isIngesting }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="top-nav">
      <Link href="/" className="brand">
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 15px rgba(59, 130, 246, 0.4)"
        }}>
          <Sparkles size={20} color="#fff" />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>AutoDesk AI</span>
            <span className="brand-badge">LangGraph</span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 400 }}>
            Multi-Agent Support Intelligence
          </div>
        </div>
      </Link>

      <nav className="nav-links">
        <Link href="/" className={`nav-link ${pathname === "/" ? "active" : ""}`}>
          <Layers size={16} style={{ display: "inline", marginRight: 6 }} />
          Dashboard
        </Link>
        <Link href="/tickets" className={`nav-link ${pathname.startsWith("/tickets") ? "active" : ""}`}>
          <Ticket size={16} style={{ display: "inline", marginRight: 6 }} />
          All Tickets
        </Link>

        {onOpenBatchCSV && (
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={onOpenBatchCSV}
            title="Batch Ingest CSV Tickets"
          >
            <FileSpreadsheet size={15} />
            Batch CSV
          </button>
        )}

        {onIngestIMAP && (
          <button 
            className="btn btn-sm" 
            onClick={onIngestIMAP} 
            disabled={isIngesting}
            style={{ minWidth: 140 }}
          >
            <Inbox size={15} />
            {isIngesting ? "Polling IMAP..." : "Poll IMAP"}
          </button>
        )}
      </nav>
    </header>
  );
}
