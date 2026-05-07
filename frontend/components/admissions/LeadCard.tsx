"use client";

import { Phone, MessageCircle, Mail, Calendar, User, FileText } from "lucide-react";

export type Lead = {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  class_name_resolved?: string;
  lead_score?: number;
  last_contacted_at?: string | null;
  next_follow_up_date?: string | null;
  documents_status?: string | null;
  status?: string;
  source_name?: string;
  assigned?: string;
};

type Props = {
  lead: Lead;
  onCall?: (lead: Lead) => void;
  onWhatsApp?: (lead: Lead) => void;
  onSMS?: (lead: Lead) => void;
  onEmail?: (lead: Lead) => void;
  onSchedule?: (lead: Lead) => void;
  onAssign?: (lead: Lead) => void;
  onSelect?: (lead: Lead, checked: boolean) => void;
  selected?: boolean;
  className?: string;
};

const SCORE_COLOR = (s?: number) => {
  if (!s) return "var(--line)";
  if (s >= 80) return "#22c55e";
  if (s >= 50) return "#f59e0b";
  return "#ef4444";
};

const DOC_BADGE: Record<string, string> = {
  none: "#6b7280",
  requested: "#f59e0b",
  partial: "#3b82f6",
  complete: "#22c55e",
};

export default function LeadCard({
  lead,
  onCall,
  onWhatsApp,
  onSMS,
  onEmail,
  onSchedule,
  onAssign,
  onSelect,
  selected = false,
  className = "",
}: Props) {
  const scoreColor = SCORE_COLOR(lead.lead_score);
  const docColor = DOC_BADGE[lead.documents_status ?? "none"] ?? "#6b7280";

  return (
    <div
      className={className}
      style={{
        background: "var(--surface)",
        border: `1.5px solid ${selected ? "var(--accent)" : "var(--line)"}`,
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        transition: "border-color 0.15s",
      }}
      role="article"
      aria-label={`Lead: ${lead.full_name}`}
    >
      {/* ── Top row: checkbox + name + score ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(lead, e.target.checked)}
            aria-label={`Select ${lead.full_name}`}
            style={{ accentColor: "var(--accent)", width: 16, height: 16, cursor: "pointer" }}
          />
        )}
        <span style={{ fontWeight: 600, fontSize: 15, flex: 1, color: "var(--text)" }}>
          {lead.full_name}
        </span>
        {lead.lead_score !== undefined && (
          <span
            aria-label={`Lead score ${lead.lead_score}`}
            style={{
              background: scoreColor,
              color: "#fff",
              borderRadius: 20,
              padding: "1px 8px",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {lead.lead_score}
          </span>
        )}
      </div>

      {/* ── Meta row ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: "var(--muted)" }}>
        {lead.class_name_resolved && (
          <span>Grade: <b style={{ color: "var(--text)" }}>{lead.class_name_resolved}</b></span>
        )}
        {lead.source_name && (
          <span>Source: <b style={{ color: "var(--text)" }}>{lead.source_name}</b></span>
        )}
        {lead.documents_status && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <FileText size={11} />
            <span
              style={{
                background: docColor,
                color: "#fff",
                borderRadius: 10,
                padding: "1px 6px",
                fontSize: 11,
              }}
            >
              {lead.documents_status}
            </span>
          </span>
        )}
      </div>

      {/* ── Timestamps ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", fontSize: 11, color: "var(--muted)" }}>
        {lead.last_contacted_at && (
          <span>Last contact: {new Date(lead.last_contacted_at).toLocaleDateString()}</span>
        )}
        {lead.next_follow_up_date && (
          <span>
            Next follow-up:{" "}
            <b style={{ color: "var(--accent)" }}>
              {new Date(lead.next_follow_up_date).toLocaleDateString()}
            </b>
          </span>
        )}
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
        {onCall && (
          <ActionBtn icon={<Phone size={13} />} label="Call" color="#22c55e" onClick={() => onCall(lead)} />
        )}
        {onWhatsApp && (
          <ActionBtn icon={<MessageCircle size={13} />} label="WhatsApp" color="#25d366" onClick={() => onWhatsApp(lead)} />
        )}
        {onSMS && (
          <ActionBtn icon={<MessageCircle size={13} />} label="SMS" color="#3b82f6" onClick={() => onSMS(lead)} />
        )}
        {onEmail && (
          <ActionBtn icon={<Mail size={13} />} label="Email" color="#8b5cf6" onClick={() => onEmail(lead)} />
        )}
        {onSchedule && (
          <ActionBtn icon={<Calendar size={13} />} label="Schedule" color="#f59e0b" onClick={() => onSchedule(lead)} />
        )}
        {onAssign && (
          <ActionBtn icon={<User size={13} />} label="Assign" color="#6b7280" onClick={() => onAssign(lead)} />
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: "transparent",
        border: `1px solid ${color}`,
        color: color,
        borderRadius: 6,
        padding: "3px 9px",
        fontSize: 11,
        cursor: "pointer",
        fontWeight: 500,
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = color + "18")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {icon}
      {label}
    </button>
  );
}
