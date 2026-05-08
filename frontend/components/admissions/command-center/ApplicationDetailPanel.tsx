"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, MessageSquare, Clock, Pencil, ChevronDown, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { ApiInquiry } from "@/types/admissions";

interface Props {
  inquiry: ApiInquiry | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenLog: (inquiry: ApiInquiry) => void;
  onOpenCall: (inquiry: ApiInquiry) => void;
  onOpenWA: (inquiry: ApiInquiry) => void;
  onEdit: (inquiry: ApiInquiry) => void;
  today: string;
  onReload: () => void;
}

const REQUIRED_DOCS = [
  { key: "birth_cert",  label: "Birth Certificate" },
  { key: "tc",          label: "Transfer Certificate (TC)" },
  { key: "aadhar",      label: "Aadhar Card Copy" },
  { key: "photos",      label: "Passport Photos (4)" },
  { key: "report_card", label: "Previous Report Card" },
  { key: "address_proof", label: "Address Proof" },
];

const STAGE_OPTIONS = [
  { value: "new",        label: "New" },
  { value: "contacted",  label: "In Conversation" },
  { value: "visited",    label: "Decision Pending" },
  { value: "enrolled",   label: "Enrolled" },
  { value: "waitlisted", label: "Waitlist" },
  { value: "declined",   label: "Cold / Dropped" },
];

const STAGE_MAP: Record<string, string> = {
  new:        "bg-blue-100 text-blue-700",
  contacted:  "bg-indigo-100 text-indigo-700",
  visited:    "bg-amber-100 text-amber-700",
  enrolled:   "bg-green-100 text-green-700",
  waitlisted: "bg-purple-100 text-purple-700",
  declined:   "bg-gray-100 text-gray-500",
};

const STAGE_LABELS: Record<string, string> = {
  new: "New", contacted: "In Conversation", visited: "Decision Pending",
  enrolled: "Enrolled", waitlisted: "Waitlist", declined: "Cold / Dropped",
};

function parseDocStatus(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  const result: Record<string, string> = {};
  raw.split(",").forEach((part) => {
    const [k, v] = part.split(":");
    if (k && v) result[k.trim()] = v.trim();
  });
  return result;
}

function getDocIcon(status: string) {
  if (status === "yes" || status === "received") return <CheckCircle2 size={13} className="text-green-500" />;
  if (status === "no" || status === "missing") return <XCircle size={13} className="text-red-400" />;
  return <AlertCircle size={13} className="text-gray-300" />;
}

function formatDate(v: string | null | undefined): string {
  if (!v) return "–";
  const d = new Date(`${v}T00:00:00`);
  if (isNaN(d.getTime())) return v;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function ApplicationDetailPanel({ inquiry, isOpen, onClose, onOpenLog, onOpenCall, onOpenWA, onEdit, today, onReload }: Props) {
  const [siblingBanner, setSiblingBanner] = useState(false);
  const [dupRecord, setDupRecord] = useState<ApiInquiry | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeConfirm, setMergeConfirm] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [localDocStatus, setLocalDocStatus] = useState<Record<string, string>>({});
  const [docSavingKey, setDocSavingKey] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState<string>("");

  useEffect(() => {
    if (!inquiry) { setSiblingBanner(false); setDupRecord(null); return; }
    setNoteText("");
    setLocalStatus(null);
    setLocalNotes(inquiry.note || "");
    setLocalDocStatus(parseDocStatus(inquiry.documents_status));
    setMergeConfirm(false);
    setDupRecord(null);
    if (!inquiry.phone) return;
    apiRequestWithRefresh<{ results?: ApiInquiry[]; count?: number } | ApiInquiry[]>(
      `/api/v1/admissions/inquiries/?phone=${inquiry.phone}&active_status=1`
    )
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.results ?? []);
        const others = list.filter((i) => i.id !== inquiry.id);
        // Same phone + same class = duplicate → offer merge
        const dup = others.find(
          (i) => i.school_class != null && inquiry.school_class != null && i.school_class === inquiry.school_class
        );
        // Same phone + different class = sibling
        const sibling = others.some(
          (i) => i.school_class != null && inquiry.school_class != null && i.school_class !== inquiry.school_class
        );
        setDupRecord(dup ?? null);
        setSiblingBanner(sibling && !dup);
      })
      .catch(() => {});
  }, [inquiry]);

  const handleMerge = async () => {
    if (!inquiry || !dupRecord) return;
    setMerging(true);
    try {
      await apiRequestWithRefresh(`/api/v1/admissions/inquiries/${inquiry.id}/merge/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: dupRecord.id }),
      });
      setMergeConfirm(false);
      setDupRecord(null);
      onReload();
    } catch {
      // error handled by apiRequestWithRefresh
    } finally {
      setMerging(false);
    }
  };

  const handleStageChange = async (status: string) => {
    if (!inquiry) return;
    setStageOpen(false);
    setLocalStatus(status); // optimistic update
    try {
      await apiRequestWithRefresh(`/api/v1/admissions/inquiries/${inquiry.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          active_status: status === "enrolled" || status === "declined" ? 2 : 1,
          follow_up_date: today,
        }),
      });
      onReload();
    } catch {
      setLocalStatus(null); // revert on failure
    }
  };

  const handleDocToggle = async (docKey: string) => {
    if (!inquiry) return;
    const current = localDocStatus[docKey];
    const next = current === "received" ? "missing" : current === "missing" ? "" : "received";
    const updated = { ...localDocStatus };
    if (next === "") { delete updated[docKey]; } else { updated[docKey] = next; }
    setLocalDocStatus(updated);
    setDocSavingKey(docKey);
    const serialized = Object.entries(updated).map(([k, v]) => `${k}:${v}`).join(",");
    try {
      await apiRequestWithRefresh(`/api/v1/admissions/inquiries/${inquiry.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents_status: serialized }),
      });
      onReload();
    } catch {
      setLocalDocStatus(parseDocStatus(inquiry.documents_status)); // revert
    } finally {
      setDocSavingKey(null);
    }
  };

  const saveNote = async () => {
    if (!inquiry || !noteText.trim()) return;
    setNoteSaving(true);
    const timestamp = new Date().toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
    const entry = `[${timestamp}] ${noteText.trim()}`;
    const updated = localNotes ? `${localNotes}\n${entry}` : entry;
    try {
      await apiRequestWithRefresh(`/api/v1/admissions/inquiries/${inquiry.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: updated }),
      });
      setLocalNotes(updated); // show new note immediately
      setNoteText("");
      onReload();
    } catch { /* ignore */ } finally {
      setNoteSaving(false);
    }
  };

  const docStatus = localDocStatus;
  const activityLines = localNotes.split("\n").filter(Boolean).reverse();
  const displayStatus = localStatus ?? inquiry?.status ?? "";

  return (
    <AnimatePresence>
      {isOpen && inquiry && (
        <>
          {/* Backdrop (mobile) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={onClose}
          />
          <motion.div
            key="detail-panel"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } }}
            exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
            className="fixed right-0 top-0 h-full w-full md:w-96 bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start gap-3 px-4 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-gray-900 truncate">{inquiry.full_name}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STAGE_MAP[displayStatus] ?? "bg-gray-100 text-gray-600"}`}>
                    {STAGE_LABELS[displayStatus] ?? displayStatus}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {inquiry.class_name_resolved && <span className="mr-2">📚 {inquiry.class_name_resolved}</span>}
                  {inquiry.assigned && <span>👤 {inquiry.assigned}</span>}
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 flex-shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* Duplicate merge banner */}
            {dupRecord && (
              <div className="mx-4 mt-3 px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800 flex-shrink-0">
                <div className="flex items-start justify-between gap-2">
                  <span>⚠️ Duplicate found: <strong>{dupRecord.full_name}</strong> (#{dupRecord.id}) has the same phone &amp; class.</span>
                  <button
                    onClick={() => setMergeConfirm(true)}
                    className="flex-shrink-0 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Merge
                  </button>
                </div>
                {mergeConfirm && (
                  <div className="mt-2 pt-2 border-t border-orange-200">
                    <p className="mb-2 font-semibold">Keep <em>this</em> record (#{inquiry?.id}) and absorb #{dupRecord.id}? The duplicate will be deleted.</p>
                    <div className="flex gap-2">
                      <button
                        disabled={merging}
                        onClick={handleMerge}
                        className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg disabled:opacity-50"
                      >
                        {merging ? "Merging…" : "✓ Confirm Merge"}
                      </button>
                      <button
                        onClick={() => setMergeConfirm(false)}
                        className="text-xs font-semibold text-orange-700 bg-white border border-orange-200 px-3 py-1 rounded-lg hover:bg-orange-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sibling banner */}
            {siblingBanner && (
              <div className="mx-4 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex-shrink-0">
                ⚠️ Another active inquiry found with this phone number — possible sibling!
              </div>
            )}

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {/* Quick actions */}
              <div className="px-4 py-3 border-b border-gray-50 flex flex-wrap gap-2">
                {/* Move Stage */}
                <div className="relative">
                  <button
                    onClick={() => setStageOpen((v) => !v)}
                    className="flex items-center gap-1 border border-gray-200 text-gray-700 rounded-lg px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
                  >
                    Move Stage <ChevronDown size={11} />
                  </button>
                  <AnimatePresence>
                    {stageOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="absolute top-full mt-1 left-0 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 min-w-[170px]"
                      >
                        {STAGE_OPTIONS.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => handleStageChange(s.value)}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${displayStatus === s.value ? "font-semibold text-indigo-600" : "text-gray-700"}`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => onOpenLog(inquiry)}
                  className="flex items-center gap-1 border border-gray-200 text-gray-700 rounded-lg px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
                >
                  <Clock size={11} /> Log
                </button>
                {inquiry.phone && (
                  <>
                    <button
                      onClick={() => onOpenCall(inquiry)}
                      className="flex items-center gap-1 border border-green-200 text-green-700 rounded-lg px-3 py-1.5 text-xs hover:bg-green-50 transition-colors"
                    >
                      <Phone size={11} /> Call
                    </button>
                    <button
                      onClick={() => onOpenWA(inquiry)}
                      className="flex items-center gap-1 border border-green-200 text-green-700 rounded-lg px-3 py-1.5 text-xs hover:bg-green-50 transition-colors"
                    >
                      <MessageSquare size={11} /> WhatsApp
                    </button>
                  </>
                )}
                <button
                  onClick={() => onEdit(inquiry)}
                  className="flex items-center gap-1 border border-indigo-200 text-indigo-700 rounded-lg px-3 py-1.5 text-xs hover:bg-indigo-50 transition-colors ml-auto"
                >
                  <Pencil size={11} /> Edit
                </button>
              </div>

              {/* Application details */}
              <div className="px-4 py-3 border-b border-gray-50 space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Details</p>
                {inquiry.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-16 flex-shrink-0 text-xs">Phone</span>
                    <span className="text-gray-800 font-medium">{inquiry.phone}</span>
                  </div>
                )}
                {inquiry.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-16 flex-shrink-0 text-xs">Email</span>
                    <span className="text-gray-800 text-xs">{inquiry.email}</span>
                  </div>
                )}
                {inquiry.source_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-16 flex-shrink-0 text-xs">Source</span>
                    <span className="text-gray-800 text-xs">{inquiry.source_name}</span>
                  </div>
                )}
                {inquiry.query_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-16 flex-shrink-0 text-xs">Inquiry</span>
                    <span className="text-gray-800 text-xs">{formatDate(inquiry.query_date)}</span>
                  </div>
                )}
                {inquiry.next_follow_up_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-16 flex-shrink-0 text-xs">Follow-up</span>
                    <span className={`text-xs font-medium ${inquiry.next_follow_up_date < today ? "text-red-600" : "text-gray-800"}`}>
                      {formatDate(inquiry.next_follow_up_date)}
                      {inquiry.next_follow_up_date < today && " (overdue)"}
                    </span>
                  </div>
                )}
                {inquiry.lead_score !== undefined && inquiry.lead_score >= 40 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-16 flex-shrink-0 text-xs">Score</span>
                    <span className={`text-xs font-bold ${inquiry.lead_score >= 70 ? "text-red-600" : "text-amber-600"}`}>
                      {inquiry.lead_score >= 70 ? "🔥" : "🟡"} {inquiry.lead_score}
                    </span>
                  </div>
                )}
                {inquiry.description && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs text-gray-600 leading-relaxed">
                    {inquiry.description}
                  </div>
                )}
              </div>

              {/* Document checklist */}
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Documents <span className="text-[10px] font-normal text-gray-400 ml-1">(click to toggle)</span></p>
                <div className="space-y-1.5">
                  {REQUIRED_DOCS.map((d) => {
                    const status = docStatus[d.key];
                    const isReceived = status === "yes" || status === "received";
                    const isMissing = status === "no" || status === "missing";
                    const isSaving = docSavingKey === d.key;
                    return (
                      <button
                        key={d.key}
                        onClick={() => void handleDocToggle(d.key)}
                        disabled={isSaving}
                        className={`w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 transition-colors ${
                          isReceived ? "bg-green-50 hover:bg-green-100" :
                          isMissing ? "bg-red-50 hover:bg-red-100" :
                          "hover:bg-gray-50"
                        } ${isSaving ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
                      >
                        {getDocIcon(status)}
                        <span className={`text-xs flex-1 ${isReceived ? "text-green-800" : isMissing ? "text-red-700" : "text-gray-700"}`}>
                          {d.label}
                        </span>
                        <span className={`text-[10px] font-medium ${isReceived ? "text-green-600" : isMissing ? "text-red-500" : "text-gray-400"}`}>
                          {isReceived ? "✓ Received" : isMissing ? "✗ Missing" : "Pending"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Activity log */}
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Activity Log</p>
                {activityLines.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No activity logged yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {activityLines.map((line, i) => (
                      <div key={i} className="text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add note */}
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add Note</p>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Type a quick note…"
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  onClick={saveNote}
                  disabled={!noteText.trim() || noteSaving}
                  className="mt-2 bg-indigo-600 text-white rounded-lg px-4 py-1.5 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {noteSaving ? "Saving…" : "Save Note"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
