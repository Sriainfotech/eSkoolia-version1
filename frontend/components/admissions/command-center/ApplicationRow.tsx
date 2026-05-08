"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, MessageSquare, Clock, Pencil, ChevronDown } from "lucide-react";
import type { ApiInquiry } from "@/types/admissions";

interface Props {
  inquiry: ApiInquiry;
  isSelected: boolean;
  today: string;
  onToggleSelect: (id: number) => void;
  onOpenDetail: (inquiry: ApiInquiry) => void;
  onOpenLog: (inquiry: ApiInquiry) => void;
  onOpenCall: (inquiry: ApiInquiry) => void;
  onOpenWA: (inquiry: ApiInquiry) => void;
  onInlineStageMove: (id: number, stage: string) => Promise<void>;
}

const INLINE_STAGE_OPTIONS = [
  { value: "new",       label: "New" },
  { value: "contacted", label: "In Conversation" },
  { value: "visited",   label: "Decision Pending" },
  { value: "enrolled",  label: "Enrolled" },
  { value: "waitlisted",label: "Waitlist" },
  { value: "declined",  label: "Cold / Dropped" },
];

function nameColor(name: string): string {
  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6", "#10b981"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xff;
  return colors[hash % colors.length];
}

function getSourceStyle(sourceName: string): string {
  const n = (sourceName || "").toLowerCase();
  if (n.includes("walk")) return "bg-blue-50 text-blue-700 border border-blue-100";
  if (n.includes("whatsapp") || n.includes("wa")) return "bg-green-50 text-green-700 border border-green-100";
  if (n.includes("web") || n.includes("online")) return "bg-purple-50 text-purple-700 border border-purple-100";
  if (n.includes("phone") || n.includes("call")) return "bg-gray-50 text-gray-700 border border-gray-200";
  if (n.includes("refer")) return "bg-amber-50 text-amber-700 border border-amber-100";
  return "bg-gray-50 text-gray-700 border border-gray-200";
}

// ── T4: Parent sentiment detection (client-side, zero API cost) ───────────────
type SentimentSignal = { emoji: string; label: string; color: string };

function detectSentiment(note: string | null | undefined): SentimentSignal | null {
  const n = (note || "").toLowerCase();
  if (/rude|angry|upset|complain|threaten|difficult|aggressive/.test(n))
    return { emoji: "🔴", label: "Difficult", color: "#dc2626" };
  if (/fee|expensive|costly|afford|budget|price|cheap|discount/.test(n))
    return { emoji: "💰", label: "Fee sensitive", color: "#d97706" };
  if (/busy|no time|call back|not now|tied up|later/.test(n))
    return { emoji: "⏰", label: "Busy", color: "#7c3aed" };
  const qCount = (n.match(/\?/g) || []).length;
  if (qCount >= 2 || /curriculum|syllabus|ratio|extracurricular/.test(n))
    return { emoji: "❓", label: "FAQ heavy", color: "#0891b2" };
  return null;
}

// ── T8: Next Best Action chip ─────────────────────────────────────────────────
function nextBestAction(inq: ApiInquiry, today: string): { label: string; color: string; bg: string } | null {
  const overdue = inq.next_follow_up_date != null && inq.next_follow_up_date < today;
  const dueToday = inq.next_follow_up_date === today;
  if (inq.status === "enrolled" || inq.status === "declined") return null;
  if (overdue) return { label: "📞 Call now", color: "#991b1b", bg: "#fee2e2" };
  if (dueToday && inq.status === "visited") return { label: "⚖️ Ask for decision", color: "#92400e", bg: "#fef3c7" };
  if (dueToday) return { label: "💬 Follow up today", color: "#1e40af", bg: "#dbeafe" };
  if (inq.status === "new") return { label: "👋 First contact", color: "#065f46", bg: "#d1fae5" };
  if (inq.status === "visited") return { label: "⚖️ Await decision", color: "#5b21b6", bg: "#ede9fe" };
  return null;
}

/** Age of this inquiry in days since it was submitted (query_date) */
function inquiryAge(inquiry: ApiInquiry, today: string): number {
  const ref = inquiry.query_date;
  if (!ref) return 0;
  return Math.max(0, Math.floor((new Date(today).getTime() - new Date(`${ref}T00:00:00`).getTime()) / 864e5));
}

const STAGE_MAP: Record<string, { label: string; cls: string }> = {
  new:        { label: "New",               cls: "bg-blue-100 text-blue-700" },
  contacted:  { label: "In Conversation",   cls: "bg-indigo-100 text-indigo-700" },
  visited:    { label: "Decision Pending",  cls: "bg-amber-100 text-amber-700" },
  enrolled:   { label: "Enrolled",          cls: "bg-green-100 text-green-700" },
  waitlisted: { label: "Waitlist",          cls: "bg-purple-100 text-purple-700" },
  declined:   { label: "Cold / Dropped",    cls: "bg-gray-100 text-gray-500" },
};

function formatDate(v: string | null | undefined): string {
  if (!v) return "–";
  const d = new Date(`${v}T00:00:00`);
  if (isNaN(d.getTime())) return v;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ApplicationRow({
  inquiry: inq,
  isSelected,
  today,
  onToggleSelect,
  onOpenDetail,
  onOpenLog,
  onOpenCall,
  onOpenWA,
  onInlineStageMove,
}: Props) {
  const [stageMenuOpen, setStageMenuOpen] = useState(false);
  const [movingStage, setMovingStage] = useState(false);

  const age = inquiryAge(inq, today);
  const ageColor =
    age <= 2 ? "text-gray-500" : age <= 7 ? "text-amber-600 font-semibold" : "text-red-600 font-semibold";
  const sentiment = detectSentiment(inq.note);
  const nba = nextBestAction(inq, today);

  // Overdue left border — draws attention on rows that haven't been actioned
  const isOverdue = inq.next_follow_up_date != null && inq.next_follow_up_date < today && inq.status !== "enrolled" && inq.status !== "declined";
  const overdueDays = isOverdue
    ? Math.round((new Date(today).getTime() - new Date(inq.next_follow_up_date!).getTime()) / 86400000)
    : 0;
  const leftBorderClass = overdueDays > 7
    ? "border-l-2 border-l-red-400"
    : overdueDays > 2
    ? "border-l-2 border-l-amber-400"
    : "";

  const stage = STAGE_MAP[inq.status] ?? { label: inq.status, cls: "bg-gray-100 text-gray-600" };
  const initials = (inq.full_name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const handleStageSelect = async (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    setStageMenuOpen(false);
    setMovingStage(true);
    try {
      await onInlineStageMove(inq.id, value);
    } finally {
      setMovingStage(false);
    }
  };

  return (
    <tr
      className={`border-b border-gray-50 hover:bg-indigo-50/20 transition-colors group cursor-pointer ${leftBorderClass} ${isSelected ? "bg-indigo-50/40" : ""} ${movingStage ? "opacity-50" : ""}`}
      onClick={() => onOpenDetail(inq)}
    >
      {/* Checkbox */}
      <td className="px-3 py-2.5 w-8">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => { e.stopPropagation(); onToggleSelect(inq.id); }}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
      </td>

      {/* Name + Avatar */}
      <td className="px-3 py-2.5 min-w-[180px]">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0"
            style={{ background: nameColor(inq.full_name) }}
          >
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {inq.child_name ? (
                <span className="text-sm font-semibold text-gray-900 leading-tight">{inq.child_name}</span>
              ) : (
                <span className="text-sm font-semibold text-gray-900 leading-tight">{inq.full_name}</span>
              )}
              {sentiment && (
                <span title={sentiment.label} className="text-xs leading-none" aria-label={sentiment.label}>{sentiment.emoji}</span>
              )}
              {inq.has_sibling_enrolled === "yes" && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 leading-none">👨‍👩‍👦 Sibling</span>
              )}
            </div>
            {inq.child_name && (
              <div className="text-xs text-gray-500 leading-tight">Parent: {inq.full_name}</div>
            )}
            <div className="text-xs text-gray-400">{inq.phone}</div>
          </div>
        </div>
      </td>

      {/* Grade */}
      <td className="px-3 py-2.5">
        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
          {inq.class_name_resolved || "–"}
        </span>
      </td>

      {/* Source badge */}
      <td className="px-3 py-2.5">
        {inq.source_name ? (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSourceStyle(inq.source_name)}`}>
            {inq.source_name}
          </span>
        ) : (
          <span className="text-xs text-gray-300">–</span>
        )}
      </td>

      {/* Age (days since inquiry) */}
      <td className="px-3 py-2.5">
        <span className={`text-xs ${ageColor}`} title="Days since inquiry was submitted">{age}d</span>
      </td>

      {/* Stage — inline dropdown on click */}
      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setStageMenuOpen((v) => !v); }}
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-opacity hover:opacity-80 ${stage.cls}`}
            title="Click to change stage"
          >
            {stage.label}
            <ChevronDown size={9} className="opacity-60" />
          </button>
          <AnimatePresence>
            {stageMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-1 left-0 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-30 min-w-[165px]"
              >
                {INLINE_STAGE_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={(e) => void handleStageSelect(e, s.value)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${inq.status === s.value ? "font-semibold text-indigo-600 bg-indigo-50/50" : "text-gray-700"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </td>

      {/* Follow-up + Next Best Action (T8) */}
      <td className="px-3 py-2.5">
        <div className="flex flex-col gap-1">
          {inq.next_follow_up_date ? (
            inq.next_follow_up_date < today ? (
              <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                Overdue {overdueDays}d
              </span>
            ) : inq.next_follow_up_date === today ? (
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Today</span>
            ) : (
              <span className="text-xs text-gray-500">{formatDate(inq.next_follow_up_date)}</span>
            )
          ) : (
            <span className="text-xs text-gray-300">–</span>
          )}
          {nba && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ color: nba.color, background: nba.bg }}
              title="Next Best Action"
            >{nba.label}</span>
          )}
        </div>
      </td>

      {/* Counsellor */}
      <td className="px-3 py-2.5">
        <span className="text-xs text-gray-600">{inq.assigned || "–"}</span>
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          {inq.phone && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenCall(inq); }}
              className="p-1.5 rounded-lg hover:bg-green-100 text-green-700 transition-colors"
              title="Call"
            >
              <Phone size={13} />
            </button>
          )}
          {inq.phone && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenWA(inq); }}
              className="p-1.5 rounded-lg hover:bg-green-100 text-green-700 transition-colors"
              title="WhatsApp"
            >
              <MessageSquare size={13} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onOpenLog(inq); }}
            className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
            title="Log Update"
          >
            <Clock size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenDetail(inq); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            title="View Details"
          >
            <Pencil size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

