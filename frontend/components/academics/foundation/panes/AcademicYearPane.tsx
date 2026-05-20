"use client";
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

interface YearForm {
  start_date: string;
  end_date: string;
  is_current: boolean;
}

const EMPTY: YearForm = { start_date: "", end_date: "", is_current: false };

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
  const [deletingId, setDelId] = useState<number | null>(null);
  const [makingId, setMaking]  = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AcademicYear | null>(null);

  const name = derivedName(form.start_date, form.end_date);

  function openEdit(y: AcademicYear) {
    setForm({ start_date: y.start_date, end_date: y.end_date, is_current: y.is_current });
    setEditId(y.id);
    setError("");
  }
  function cancelEdit() { setForm(EMPTY); setEditId(null); setError(""); }

  async function save() {
    if (!form.start_date || !form.end_date) { setError("Both dates are required."); return; }
    if (new Date(form.end_date) <= new Date(form.start_date)) {
      const m = "End date must be after the start date.";
      setError(m); showToast(m, "error"); return;
    }
    setSaving(true); setError("");
    try {
      const url = editingId
        ? `/api/v1/core/academic-years/${editingId}/`
        : "/api/v1/core/academic-years/";
      await apiRequestWithRefresh(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: form.start_date, end_date: form.end_date, is_current: form.is_current }),
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

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-semibold text-[#6F767E] block mb-1">
              Start Date <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
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
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-1.5 text-[13px] text-[#1A1D1F] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-[#6F767E] cursor-pointer select-none mb-3">
          <input
            type="checkbox"
            checked={form.is_current}
            onChange={(e) => setForm((f) => ({ ...f, is_current: e.target.checked }))}
            className="accent-[#5B4FCF]"
          />
          Set as current academic year
        </label>

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

            {years.map((y) => {
              const endDate = new Date(y.end_date);
              endDate.setHours(0, 0, 0, 0);
              const isArchived = !y.is_current && endDate < today;

              return (
                <div
                  key={y.id}
                  className={[
                    "flex items-center gap-3 px-4 py-3 rounded-xl border-[1.5px] transition-all",
                    y.is_current
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
                      y.is_current ? "bg-[#22C55E]" : isArchived ? "bg-[#D2D7DC]" : "bg-[#9FA6AD]",
                    ].join(" ")}
                  />

                  {/* Year name + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={[
                          "text-[13px] font-bold",
                          y.is_current ? "text-[#5B4FCF]" : "text-[#1A1D1F]",
                        ].join(" ")}
                      >
                        {y.name}
                      </span>
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
