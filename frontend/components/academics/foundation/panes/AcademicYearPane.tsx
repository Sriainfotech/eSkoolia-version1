"use client"; // force reload 1
import { useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { AcademicYear, Toast } from "../types";
import HolidayCalendarCard from "./HolidayCalendarCard";
import ConfirmDeleteDialog from "../ConfirmDeleteDialog";

interface Props {
  years: AcademicYear[];
  loading: boolean;
  onRefresh: () => void;
  showToast: (msg: string, tone?: Toast["tone"]) => void;
  onNext: () => void;
}

interface TermDate {
  start_date: string;
  end_date: string;
}

interface YearForm {
  board: string;
  number_of_terms: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_active: boolean; // Fix #1E
  terms: TermDate[];
}

const EMPTY: YearForm = { board: "", number_of_terms: "", start_date: "", end_date: "", is_current: false, is_active: true, terms: [] }; // Fix #1E

/** Parse number of terms from the select value, e.g. "2 Terms (Semester)" → 2 */
function parseTermCount(val: string): number {
  const m = val.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Term label based on count and index */
const TERM_LABELS: Record<number, string[]> = {
  2: ["Semester 1", "Semester 2"],
  3: ["Trimester 1", "Trimester 2", "Trimester 3"],
  4: ["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4"],
};

/** Split academic year date range evenly into `count` terms, or return empty dates if main dates missing */
function splitTermDates(startStr: string, endStr: string, count: number): TermDate[] {
  if (count <= 0) return [];
  if (!startStr || !endStr) {
    return Array.from({ length: count }, () => ({ start_date: "", end_date: "" }));
  }
  const start = new Date(startStr).getTime();
  const end   = new Date(endStr).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) {
    return Array.from({ length: count }, () => ({ start_date: "", end_date: "" }));
  }
  const total = end - start;
  const chunk = total / count;
  return Array.from({ length: count }, (_, i) => {
    const s = new Date(start + chunk * i);
    const e = new Date(i === count - 1 ? end : start + chunk * (i + 1) - 86400000);
    return {
      start_date: s.toISOString().slice(0, 10),
      end_date:   e.toISOString().slice(0, 10),
    };
  });
}

function derivedName(s: string, e: string) {
  if (!s || !e) return "";
  const sy = new Date(s).getFullYear();
  const ey = new Date(e).getFullYear();
  return sy && ey ? `${sy}-${ey}` : "";
}

function flatErrors(body: unknown): string {
  if (!body || typeof body !== "object") return "Failed to save.";
  const p = body as Record<string, unknown>;
  const src = (p.errors ?? p) as Record<string, unknown>;
  return Object.values(src)
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .join(" ") || "Failed to save.";
}

/* ── Card chrome ── */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-xl border border-[#E8ECEF] shadow-[0_1px_4px_rgba(0,0,0,.08)] p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export default function AcademicYearPane({ years, loading, onRefresh, showToast, onNext }: Props) {
  const [form, setForm]        = useState<YearForm>(EMPTY);
  const [editingId, setEditId] = useState<number | null>(null);
  const [saving, setSaving]    = useState(false);
  const [error, setError]      = useState("");
  const [dateWarning, setDateWarning] = useState(""); // Fix #1D
  const [deletingId, setDelId] = useState<number | null>(null);
  const [makingId, setMaking]  = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AcademicYear | null>(null);

  const name = derivedName(form.start_date, form.end_date);

  function openEdit(y: AcademicYear) {
    const tc = parseTermCount(y.number_of_terms || "");
    const existingTerms = tc > 0 ? splitTermDates(y.start_date, y.end_date, tc) : [];
    setForm({ board: y.board || "", number_of_terms: y.number_of_terms || "", start_date: y.start_date, end_date: y.end_date, is_current: y.is_current, is_active: y.is_active ?? true, terms: existingTerms }); // Fix #1E; ?? true Fix #W4
    setEditId(y.id);
    setError("");
    setDateWarning(""); // Fix #1D
  }
  function cancelEdit() { setForm(EMPTY); setEditId(null); setError(""); setDateWarning(""); } // Fix #1D

  /** Re-split terms whenever main dates or term count changes */
  function handleTermCountChange(val: string) {
    const tc = parseTermCount(val);
    setForm((f) => ({ ...f, number_of_terms: val, terms: splitTermDates(f.start_date, f.end_date, tc) }));
  }

  function handleMainDateChange(field: "start_date" | "end_date", val: string) {
    setForm((f) => {
      const next = { ...f, [field]: val };
      const tc = parseTermCount(f.number_of_terms);
      if (tc > 0) next.terms = splitTermDates(next.start_date, next.end_date, tc);
      return next;
    });
  }

  function handleTermDateChange(idx: number, field: "start_date" | "end_date", val: string) {
    setForm((f) => {
      const terms = f.terms.map((t, i) => i === idx ? { ...t, [field]: val } : t);
      return { ...f, terms };
    });
  }

  // Fix #1D — compute inline date warnings (warnings only, not blockers — user can still submit)
  function computeDateWarning(start: string, end: string): string {
    if (!start || !end) return "";
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return "";
    const nineMonths = new Date(s);
    nineMonths.setMonth(nineMonths.getMonth() + 9);
    if (e < nineMonths) return "Academic year must be at least 9 months.";
    const others = years.filter((y) => y.id !== editingId);
    if (others.length > 0) {
      const latestEnd = others.map((y) => new Date(y.end_date)).reduce((a, b) => (a > b ? a : b));
      const limit = new Date(latestEnd);
      limit.setMonth(limit.getMonth() + 3);
      if (s > limit) return "Year should start close to when the previous year ends.";
    }
    return "";
  }

  async function save() {
    if (!form.start_date || !form.end_date) { setError("Both dates are required."); return; }
    if (new Date(form.end_date) <= new Date(form.start_date)) {
      const m = "End date must be after the start date.";
      setError(m); showToast(m, "error"); return;
    }
    
    // Validate term dates if present
    const tc = parseTermCount(form.number_of_terms);
    if (tc > 0) {
      for (let i = 0; i < tc; i++) {
        const t = form.terms[i];
        if (t && t.start_date && t.end_date && new Date(t.end_date) <= new Date(t.start_date)) {
          const m = `Term ${i + 1} end date must be after its start date.`;
          setError(m); showToast(m, "error"); return;
        }
      }
    }

    setSaving(true); setError("");
    try {
      const url = editingId
        ? `/api/v1/core/academic-years/${editingId}/`
        : "/api/v1/core/academic-years/";
      await apiRequestWithRefresh(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board: form.board, number_of_terms: form.number_of_terms, start_date: form.start_date, end_date: form.end_date, is_current: form.is_current, is_active: form.is_active, terms: form.terms }), // Fix #1E
      });
      showToast(editingId ? "Academic year updated." : `Year ${name} created.`);
      cancelEdit();
      onRefresh();
    } catch (err: unknown) {
      let msg = "Failed to save academic year.";
      let fields: Record<string, unknown> = {};
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message) as { error?: { field_errors?: Record<string, unknown>; message?: string }; field_errors?: Record<string, unknown>; message?: string };
          fields = parsed?.error?.field_errors ?? parsed?.field_errors ?? {};
          msg = flatErrors(parsed) || parsed?.error?.message || parsed?.message || err.message;
        } catch { msg = err.message; }
      }
      const dateErr = fields.date;
      const yearErr = fields.year_name;
      if (Array.isArray(dateErr) && dateErr.some((d) => /overlap/i.test(String(d)))) {
        msg = `This date range overlaps an existing academic year (${name}). Pick different dates or edit the existing one.`;
      } else if (Array.isArray(yearErr) && yearErr.some((y) => /already exists|unique/i.test(String(y)))) {
        msg = `Academic year "${name}" already exists. Edit it from the list below instead.`;
      } else if (/overlap/i.test(msg)) {
        msg = `This date range overlaps an existing academic year. Pick different dates.`;
      } else if (/already exists|unique/i.test(msg)) {
        msg = `Academic year "${name}" already exists. Edit it from the list below instead.`;
      }
      setError(msg);
      showToast(msg, "error");
    } finally { setSaving(false); }
  }

  async function handleDelete(y: AcademicYear) {
    setPendingDelete(y);
  }

  async function confirmDelete() {
    const y = pendingDelete;
    if (!y) return;
    setDelId(y.id);
    try {
      await apiRequestWithRefresh(`/api/v1/core/academic-years/${y.id}/`, { method: "DELETE" });
      showToast(`"${y.name}" deleted.`);
      setPendingDelete(null);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (/\b404\b|not[_ ]?found/i.test(msg)) {
        showToast("This academic year no longer exists. Refreshing the list\u2026", "error");
        setPendingDelete(null);
        onRefresh();
      } else {
        showToast("Failed to delete.", "error");
      }
    }
    finally { setDelId(null); }
  }

  async function makeCurrent(y: AcademicYear) {
    setMaking(y.id);
    try {
      await apiRequestWithRefresh(`/api/v1/core/academic-years/${y.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_current: true }),
      });
      showToast(`"${y.name}" is now the current academic year.`);
      onRefresh();
    } catch { showToast("Failed to update.", "error"); }
    finally { setMaking(null); }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Recent → oldest so the newest academic years surface first
  const sortedYears = [...years].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );

  // "Make Current" is only allowed for the year whose date range actually
  // contains today — past and future years can't be marked current.
  function isTooFarFromToday(y: AcademicYear): boolean {
    const start = new Date(y.start_date);
    const end = new Date(y.end_date);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return today < start || today > end;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Left: form ── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[14px] font-bold text-[#1A1D1F]">
              {editingId ? "Edit Academic Year" : "New Academic Year"}
              {name && !editingId && (
                <span className="ml-2 text-[#5B4FCF] font-semibold text-[13px]">→ {name}</span>
              )}
            </div>
            <div className="text-[11px] text-[#6F767E] mt-0.5">
              {editingId ? "Update the year dates or current status" : "Define the start and end dates for the school year"}
            </div>
          </div>
        </div>

        <div className="mb-3">
          <label className="text-[11px] font-semibold text-[#6F767E] block mb-1">
            Board / Curriculum
          </label>
          <select
            value={form.board}
            onChange={(e) => setForm((f) => ({ ...f, board: e.target.value }))}
            className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-1.5 text-[13px] text-[#1A1D1F] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors"
          >
            <option value="">Select...</option>
            <option value="CBSE">CBSE</option>
            <option value="ICSE">ICSE</option>
            <option value="State Board">State Board</option>
            <option value="IB">IB (International Baccalaureate)</option>
            <option value="IGCSE">IGCSE (Cambridge)</option>
            <option value="NIOS">NIOS</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="mb-3">
          <label className="text-[11px] font-semibold text-[#6F767E] block mb-1">
            Number of Terms
          </label>
          <select
            value={form.number_of_terms}
            onChange={(e) => handleTermCountChange(e.target.value)}
            className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-1.5 text-[13px] text-[#1A1D1F] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors"
          >
            <option value="">Select...</option>
            <option value="2 Terms (Semester)">2 Terms (Semester)</option>
            <option value="3 Terms (Trimester)">3 Terms (Trimester)</option>
            <option value="4 Terms (Quarter)">4 Terms (Quarter)</option>
          </select>
        </div>

        {/* ── Academic Year dates ── */}
        <div className="mb-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#6F767E] block mb-1">
                Start Date <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="date"
                value={form.start_date}
                max={form.end_date || undefined}
                onChange={(e) => { handleMainDateChange("start_date", e.target.value); setDateWarning(computeDateWarning(e.target.value, form.end_date)); }}
                className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-1.5 text-[13px] text-[#1A1D1F] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#6F767E] block mb-1">
                End Date <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="date"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={(e) => { handleMainDateChange("end_date", e.target.value); setDateWarning(computeDateWarning(form.start_date, e.target.value)); }}
                className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-1.5 text-[13px] text-[#1A1D1F] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors"
              />
            </div>
          </div>
        </div>

        {/* ── Term date rows ── */}
        {parseTermCount(form.number_of_terms) > 0 && (
          <div className="mt-3 mb-3 border border-[#E8ECEF] rounded-xl overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#F5F3FF] border-b border-[#E8ECEF]">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5B4FCF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span className="text-[11px] font-bold text-[#5B4FCF] uppercase tracking-widest">FOUNDATION</span>
              <span className="ml-auto text-[10px] text-[#9FA6AD] font-medium">Auto-populated · editable</span>
            </div>
            {Array.from({ length: parseTermCount(form.number_of_terms) }).map((_, idx) => {
              const termCount = parseTermCount(form.number_of_terms);
              const labels = TERM_LABELS[termCount] ?? Array.from({ length: termCount }, (_, i) => `Term ${i + 1}`);
              const term = form.terms[idx] || { start_date: "", end_date: "" };
              return (
                <div key={idx} className={`px-3 py-2.5 ${idx < termCount - 1 ? "border-b border-[#E8ECEF]" : ""}`}>
                  <p className="text-[11px] font-semibold text-[#1A1D1F] mb-1.5">
                    Term {idx + 1}
                    <span className="ml-1.5 text-[10px] font-normal text-[#9FA6AD]">— {labels[idx]}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#9FA6AD] block mb-0.5">Start Date</label>
                      <input
                        type="date"
                        value={term.start_date}
                        max={term.end_date || undefined}
                        onChange={(e) => handleTermDateChange(idx, "start_date", e.target.value)}
                        className="w-full bg-[#FAFBFC] border-[1.5px] border-[#E8ECEF] rounded-[8px] px-2 py-1 text-[12px] text-[#1A1D1F] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#9FA6AD] block mb-0.5">End Date</label>
                      <input
                        type="date"
                        value={term.end_date}
                        min={term.start_date || undefined}
                        onChange={(e) => handleTermDateChange(idx, "end_date", e.target.value)}
                        className="w-full bg-[#FAFBFC] border-[1.5px] border-[#E8ECEF] rounded-[8px] px-2 py-1 text-[12px] text-[#1A1D1F] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* spacer so warning / checkbox follows naturally */}
        <div className="mb-3" />

        {/* Fix #1D — inline date warning (warning only, user can still submit) */}
        {dateWarning && (
          <p className="text-[11px] text-[#92400E] bg-[#FEF3C7] border border-[#FCD34D] rounded-[10px] px-3 py-2 mb-3">
            ⚠ {dateWarning}
          </p>
        )}

        <label className="flex items-center gap-2 text-[13px] text-[#6F767E] cursor-pointer select-none mb-3">
          <input
            type="checkbox"
            checked={form.is_current}
            onChange={(e) => setForm((f) => ({ ...f, is_current: e.target.checked }))}
            className="accent-[#5B4FCF]"
          />
          Set as current academic year
        </label>

        {/* Fix #1E — is_active toggle, only shown in edit mode */}
        {editingId && (
          <label className="flex items-center gap-2 text-[13px] text-[#6F767E] cursor-pointer select-none mb-3">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="accent-[#5B4FCF]"
            />
            Active (uncheck to soft-deactivate this year)
          </label>
        )}

        {error && (
          <p className="text-[12px] text-[#B91C1C] bg-[#FEE2E2] border border-[#FCA5A5] rounded-[10px] px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => void save()}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-[7px] rounded-[10px] bg-[#5B4FCF] text-white text-[13px] font-semibold hover:bg-[#4A3FBF] disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : editingId ? "Update Year" : "Save Year"}
          </button>
          {editingId && (
            <button onClick={cancelEdit} className="px-3.5 py-[7px] rounded-[10px] border border-[#E8ECEF] text-[13px] text-[#6F767E] hover:bg-[#F0F2F5] transition-colors">
              Cancel
            </button>
          )}
          <button
            onClick={onNext}
            className="px-3.5 py-[7px] rounded-[10px] border border-[#E8ECEF] text-[13px] text-[#6F767E] hover:bg-[#F0F2F5] transition-colors"
          >
            Next: Classes →
          </button>
        </div>

        {/* ── Academic years list ── */}
        {years.length > 0 && (
          <div className="mt-5 border-t border-[#E8ECEF] pt-4 space-y-2">
            <p className="text-[11px] font-bold text-[#6F767E] uppercase tracking-wide mb-3">
              Academic Years <span className="ml-1 font-normal normal-case text-[#9FA6AD]">({years.length})</span>
            </p>

            {sortedYears.map((y) => {
              const endDate = new Date(y.end_date);
              endDate.setHours(0, 0, 0, 0);
              const isArchived = !y.is_current && endDate < today;
              const isInactive = y.is_active === false;
              const tooFar = isTooFarFromToday(y);

              return (
                <div
                  key={y.id}
                  className={[
                    "flex items-center gap-3 px-4 py-3 rounded-xl border-[1.5px] transition-all",
                    isInactive
                      ? "border-[#E8ECEF] bg-[#FFF8F8] opacity-70"
                      : y.is_current
                        ? "border-[#5B4FCF] bg-[#F5F3FF]"
                        : isArchived
                          ? "border-[#E8ECEF] bg-[#FAFBFC]"
                          : "border-[#E8ECEF] bg-[#F0F2F5] hover:border-[#C7C3F0]",
                  ].join(" ")}
                >
                  {/* Status dot */}
                  <span
                    className={[
                      "w-2 h-2 rounded-full flex-shrink-0",
                      isInactive ? "bg-[#FCA5A5]" : y.is_current ? "bg-[#22C55E]" : isArchived ? "bg-[#D2D7DC]" : "bg-[#9FA6AD]",
                    ].join(" ")}
                  />

                  {/* Year name + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={[
                          "text-[13px] font-bold",
                          isInactive ? "text-[#9FA6AD] line-through" : y.is_current ? "text-[#5B4FCF]" : "text-[#1A1D1F]",
                        ].join(" ")}
                      >
                        {y.name}
                      </span>
                      {isInactive && (
                        <span className="px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] text-[10px] font-semibold border border-[#FCA5A5]">
                          Inactive
                        </span>
                      )}
                      {y.is_current && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#5B4FCF] text-white text-[10px] font-bold tracking-wide">
                          ✓ CURRENT
                        </span>
                      )}
                      {isArchived && (
                        <span className="px-2 py-0.5 rounded-full bg-[#F0F2F5] text-[#9FA6AD] text-[10px] font-semibold border border-[#E8ECEF]">
                          Archived
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#9FA6AD] mt-0.5">
                      {y.start_date} → {y.end_date}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {y.is_current ? (
                      <span className="text-[11px] text-[#5B4FCF] font-semibold px-1">
                        Current Year
                      </span>
                    ) : isInactive ? (
                      <span className="text-[11px] text-[#9FA6AD] px-1" title="Re-activate this year before making it current">
                        —
                      </span>
                    ) : tooFar ? (
                      <span
                        className="text-[11px] text-[#9FA6AD] px-1"
                        title="Only the year whose date range includes today can be made current."
                      >
                        —
                      </span>
                    ) : (
                      <button
                        onClick={() => void makeCurrent(y)}
                        disabled={makingId === y.id}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#EEF0FF] text-[#5B4FCF] hover:bg-[#5B4FCF] hover:text-white disabled:opacity-40 transition-all whitespace-nowrap"
                      >
                        {makingId === y.id ? "…" : "Make Current"}
                      </button>
                    )}

                    {/* Edit */}
                    <button
                      onClick={() => openEdit(y)}
                      title="Edit year"
                      className="p-1.5 rounded-lg text-[#9FA6AD] hover:bg-[#EEF0FF] hover:text-[#5B4FCF] transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => void handleDelete(y)}
                      disabled={deletingId === y.id}
                      title="Delete year"
                      className="p-1.5 rounded-lg text-[#9FA6AD] hover:bg-[#FEE2E2] hover:text-[#B91C1C] disabled:opacity-40 transition-colors"
                    >
                      {deletingId === y.id
                        ? <span className="text-[11px] px-0.5">…</span>
                        : <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                      }
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Right: holiday calendar (real data, popup form) ── */}
      <HolidayCalendarCard
        years={years}
        currentYear={years.find((y) => y.is_current)}
        showToast={showToast}
      />

      <ConfirmDeleteDialog
        open={!!pendingDelete}
        title="Delete Academic Year"
        message={
          <>
            Are you sure you want to delete <strong>“{pendingDelete?.name}”</strong>? All holidays
            and related data linked to this year will also be removed.
          </>
        }
        loading={deletingId === pendingDelete?.id}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
