"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { AcademicYear, Toast } from "../types";

interface Props {
  years: AcademicYear[];
  currentYear?: AcademicYear;
  showToast: (msg: string, tone?: Toast["tone"]) => void;
}

interface Holiday {
  id: number;
  academic_year: number | null;
  name: string;
  date: string;
  end_date: string | null;
  holiday_type: string;
  type_label?: string;
  description: string;
  active_status: boolean;
  duration_days?: number;
}

interface HolidayList { results?: Holiday[]; }
interface HolidayResponse { success?: boolean; message?: string; data?: Holiday; }

const API = "/api/v1/core/holidays/";

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "public",    label: "Public Holiday" },
  { value: "national",  label: "National" },
  { value: "religious", label: "Religious / Festival" },
  { value: "school",    label: "School Event" },
  { value: "other",     label: "Other" },
];

const TYPE_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  national:  { bg: "#DCFCE7", fg: "#15803D", label: "National" },
  religious: { bg: "#FEF3C7", fg: "#B45309", label: "Religious" },
  public:    { bg: "#EDE9FE", fg: "#5B4FCF", label: "Public" },
  school:    { bg: "#F3E8FF", fg: "#7C3AED", label: "School Event" },
  other:     { bg: "#F3F4F6", fg: "#6F767E", label: "Other" },
};

function fmtDate(iso: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch { return iso; }
}

function fmtDateRange(start: string, end: string | null) {
  if (!end || end === start) return fmtDate(start);
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

function extractList<T>(resp: unknown): T[] {
  if (Array.isArray(resp)) return resp as T[];
  if (resp && typeof resp === "object" && Array.isArray((resp as { results?: T[] }).results)) {
    return (resp as { results: T[] }).results;
  }
  return [];
}

function readError(err: unknown): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message) as {
        message?: string;
        errors?: Record<string, string[]>;
        error?: { field_errors?: Record<string, string[]>; message?: string };
      };
      const fe = parsed.errors ?? parsed.error?.field_errors;
      if (fe) {
        const first = Object.values(fe)[0];
        if (Array.isArray(first) && first.length) return String(first[0]);
      }
      return parsed.error?.message ?? parsed.message ?? err.message;
    } catch {
      return err.message;
    }
  }
  return "Something went wrong. Please try again.";
}

export default function HolidayCalendarCard({ years, currentYear, showToast }: Props) {
  const sortedYears = useMemo(
    () => [...years].sort((a, b) => (a.start_date < b.start_date ? 1 : -1)),
    [years]
  );
  const defaultYearId = currentYear?.id ?? sortedYears[0]?.id ?? null;

  const [yearId, setYearId] = useState<number | null>(defaultYearId);
  const [items, setItems] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [fName, setFName] = useState("");
  const [fDate, setFDate] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fType, setFType] = useState("public");
  const [fDesc, setFDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [showCopy, setShowCopy] = useState(false);
  const [copySourceId, setCopySourceId] = useState<number | null>(null);
  const [copyShift, setCopyShift] = useState(true);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (yearId == null && defaultYearId != null) setYearId(defaultYearId);
  }, [defaultYearId, yearId]);

  const selectedYear = useMemo(
    () => sortedYears.find((y) => y.id === yearId) ?? null,
    [sortedYears, yearId]
  );

  const fetchItems = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page_size", "200");
      if (yearId) qs.set("academic_year", String(yearId));
      const resp = await apiRequestWithRefresh<HolidayList | Holiday[]>(`${API}?${qs.toString()}`);
      setItems(extractList<Holiday>(resp));
    } catch (err) {
      showToast(readError(err), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (yearId != null) void fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearId]);

  function openAdd() {
    setEditing(null);
    setFName(""); setFDate(""); setFEnd(""); setFType("public"); setFDesc("");
    setFormError(null);
    setShowForm(true);
  }
  function openEdit(h: Holiday) {
    setEditing(h);
    setFName(h.name); setFDate(h.date); setFEnd(h.end_date ?? "");
    setFType(h.holiday_type); setFDesc(h.description ?? "");
    setFormError(null);
    setShowForm(true);
  }
  function closeForm() {
    if (saving) return;
    setShowForm(false); setEditing(null); setFormError(null);
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!fName.trim()) { setFormError("Holiday name is required."); return; }
    if (!fDate) { setFormError("Date is required."); return; }
    if (fEnd && fEnd < fDate) { setFormError("End date cannot be before start date."); return; }

    const payload: Record<string, unknown> = {
      name: fName.trim(),
      date: fDate,
      end_date: fEnd || null,
      holiday_type: fType,
      description: fDesc.trim(),
    };
    if (yearId) payload.academic_year = yearId;

    setSaving(true); setFormError(null);
    try {
      if (editing) {
        const resp = await apiRequestWithRefresh<HolidayResponse>(`${API}${editing.id}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        showToast(resp?.message ?? "Holiday updated.", "success");
      } else {
        const resp = await apiRequestWithRefresh<HolidayResponse>(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        showToast(resp?.message ?? "Holiday added.", "success");
      }
      setShowForm(false); setEditing(null);
      void fetchItems();
    } catch (err) {
      setFormError(readError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(h: Holiday) {
    if (!confirm(`Delete holiday "${h.name}" on ${fmtDate(h.date)}?`)) return;
    try {
      await apiRequestWithRefresh(`${API}${h.id}/`, { method: "DELETE" });
      showToast("Holiday deleted.", "success");
      void fetchItems();
    } catch (err) {
      showToast(readError(err), "error");
    }
  }

  function openCopy() {
    if (!yearId) return;
    const firstOther = sortedYears.find((y) => y.id !== yearId);
    setCopySourceId(firstOther ? firstOther.id : null);
    setCopyShift(true);
    setCopyError(null);
    setShowCopy(true);
  }
  function closeCopy() {
    if (copyBusy) return;
    setShowCopy(false);
    setCopyError(null);
  }
  async function submitCopy(e?: React.FormEvent) {
    e?.preventDefault();
    if (!yearId) return;
    if (!copySourceId) { setCopyError("Select a source academic year."); return; }
    if (copySourceId === yearId) { setCopyError("Source and target must differ."); return; }
    setCopyBusy(true); setCopyError(null);
    try {
      const resp = await apiRequestWithRefresh<{ success?: boolean; message?: string; created?: number; skipped?: number }>(
        `${API}copy-from-year/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_academic_year: copySourceId,
            target_academic_year: yearId,
            shift_year: copyShift,
          }),
        }
      );
      const created = resp?.created ?? 0;
      const skipped = resp?.skipped ?? 0;
      showToast(
        resp?.message ??
          `Copied ${created} holiday${created === 1 ? "" : "s"}${skipped ? `, skipped ${skipped}` : ""}.`,
        "success"
      );
      setShowCopy(false);
      void fetchItems();
    } catch (err) {
      setCopyError(readError(err));
    } finally {
      setCopyBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#E8ECEF] shadow-[0_1px_4px_rgba(0,0,0,.08)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3.5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="text-[14px] font-bold text-[#1A1D1F]">Holiday Calendar</div>
          {selectedYear && (
            <span className="text-[11px] text-[#9FA6AD]">{selectedYear.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {sortedYears.length > 1 && (
            <select
              value={yearId ?? ""}
              onChange={(e) => setYearId(e.target.value ? Number(e.target.value) : null)}
              className="h-7 px-2 rounded-md border border-[#E8ECEF] text-[11px] bg-white focus:outline-none focus:border-[#5B4FCF]"
            >
              {sortedYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}{y.is_current ? " ✓" : ""}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={openCopy}
            disabled={!yearId || sortedYears.length < 2}
            title={sortedYears.length < 2 ? "Need another academic year to copy from" : "Copy holidays from another academic year"}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#E8ECEF] bg-white text-[#5B4FCF] hover:bg-[#EEF0FF] text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span>Copy</span>
          </button>
          <button
            type="button"
            onClick={openAdd}
            disabled={!yearId}
            title="Add holiday"
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-[#5B4FCF] hover:bg-[#4A3FBF] text-white text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-[14px] leading-none">+</span>
            <span>Add Holiday</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[10px] border border-[#E8ECEF]">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-[#F0F2F5]">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-bold text-[#6F767E] uppercase tracking-wide border-b border-[#E8ECEF] w-[110px]">Date</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold text-[#6F767E] uppercase tracking-wide border-b border-[#E8ECEF]">Event</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold text-[#6F767E] uppercase tracking-wide border-b border-[#E8ECEF] w-[110px]">Type</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold text-[#6F767E] uppercase tracking-wide border-b border-[#E8ECEF] w-[70px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[#9FA6AD] text-[12px]">Loading…</td>
              </tr>
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center">
                  <div className="text-[12px] text-[#6F767E]">No holidays yet.</div>
                  <button
                    type="button"
                    onClick={openAdd}
                    disabled={!yearId}
                    className="mt-2 text-[12px] font-semibold text-[#5B4FCF] hover:underline disabled:opacity-40"
                  >
                    + Add your first holiday
                  </button>
                </td>
              </tr>
            )}

            {!loading && items.map((h) => {
              const badge = TYPE_BADGE[h.holiday_type] ?? TYPE_BADGE.other;
              return (
                <tr key={h.id} className={`hover:bg-[#FAFBFC] ${!h.active_status ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2 border-b border-[#E8ECEF] last:border-0 font-medium text-[#1A1D1F]">
                    {fmtDateRange(h.date, h.end_date)}
                  </td>
                  <td className="px-3 py-2 border-b border-[#E8ECEF] last:border-0">
                    <div className="text-[#1A1D1F]">{h.name}</div>
                    {h.description && (
                      <div className="text-[11px] text-[#9FA6AD] mt-0.5 truncate max-w-[260px]">{h.description}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 border-b border-[#E8ECEF] last:border-0">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ background: badge.bg, color: badge.fg }}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-b border-[#E8ECEF] last:border-0 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(h)}
                        title="Edit"
                        className="p-1 rounded-md text-[#9FA6AD] hover:bg-[#EEF0FF] hover:text-[#5B4FCF]"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(h)}
                        title="Delete"
                        className="p-1 rounded-md text-[#9FA6AD] hover:bg-[#FEE2E2] hover:text-[#B91C1C]"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeForm}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-xl shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-[#E8ECEF]">
              <h3 className="text-[15px] font-bold text-[#1A1D1F]">
                {editing ? "Edit Holiday" : "Add Holiday"}
              </h3>
              {selectedYear && (
                <p className="text-[11px] text-[#6F767E] mt-0.5">
                  For Academic Year {selectedYear.name}
                </p>
              )}
            </div>

            <div className="px-5 py-4 space-y-3">
              {formError && (
                <div className="px-3 py-2 rounded-md bg-[#FEE2E2] text-[#991B1B] text-[12px]">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-[#6F767E] mb-1">
                  Holiday Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  placeholder="e.g., Diwali"
                  className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-1.5 text-[13px] text-[#1A1D1F] outline-none focus:border-[#5B4FCF] focus:bg-white"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#6F767E] mb-1">
                    Date <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="date"
                    value={fDate}
                    onChange={(e) => setFDate(e.target.value)}
                    className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#5B4FCF] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6F767E] mb-1">End Date</label>
                  <input
                    type="date"
                    value={fEnd}
                    onChange={(e) => setFEnd(e.target.value)}
                    min={fDate || undefined}
                    className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#5B4FCF] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#6F767E] mb-1">Type</label>
                <select
                  value={fType}
                  onChange={(e) => setFType(e.target.value)}
                  className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#5B4FCF] focus:bg-white"
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#6F767E] mb-1">Description</label>
                <textarea
                  value={fDesc}
                  onChange={(e) => setFDesc(e.target.value)}
                  rows={2}
                  placeholder="Optional"
                  className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#5B4FCF] focus:bg-white resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[#E8ECEF] flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="px-3.5 py-[7px] rounded-[10px] border border-[#E8ECEF] text-[13px] text-[#6F767E] hover:bg-[#F0F2F5] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-3.5 py-[7px] rounded-[10px] bg-[#5B4FCF] text-white text-[13px] font-semibold hover:bg-[#4A3FBF] disabled:opacity-50"
              >
                {saving ? "Saving…" : editing ? "Update Holiday" : "Add Holiday"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Copy-from-year modal */}
      {showCopy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeCopy}
        >
          <form
            onSubmit={submitCopy}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-xl shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-[#E8ECEF]">
              <h3 className="text-[15px] font-bold text-[#1A1D1F]">Copy Holidays From Another Year</h3>
              {selectedYear && (
                <p className="text-[11px] text-[#6F767E] mt-0.5">
                  Target: Academic Year {selectedYear.name}
                </p>
              )}
            </div>

            <div className="px-5 py-4 space-y-3">
              {copyError && (
                <div className="px-3 py-2 rounded-md bg-[#FEE2E2] text-[#991B1B] text-[12px]">
                  {copyError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-[#6F767E] mb-1">
                  Source Academic Year <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  value={copySourceId ?? ""}
                  onChange={(e) => setCopySourceId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#5B4FCF] focus:bg-white"
                >
                  <option value="">— Select year —</option>
                  {sortedYears
                    .filter((y) => y.id !== yearId)
                    .map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}{y.is_current ? " (current)" : ""}
                      </option>
                    ))}
                </select>
              </div>

              <label className="flex items-start gap-2 text-[12px] text-[#1A1D1F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={copyShift}
                  onChange={(e) => setCopyShift(e.target.checked)}
                  className="mt-0.5 accent-[#5B4FCF]"
                />
                <span>
                  <span className="font-semibold">Shift dates to target year</span>
                  <span className="block text-[11px] text-[#6F767E]">
                    Re-base each holiday's date so it falls in the target academic year.
                  </span>
                </span>
              </label>
            </div>

            <div className="px-5 py-4 border-t border-[#E8ECEF] flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCopy}
                disabled={copyBusy}
                className="px-3.5 py-[7px] rounded-[10px] border border-[#E8ECEF] text-[13px] text-[#6F767E] hover:bg-[#F0F2F5] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={copyBusy}
                className="px-3.5 py-[7px] rounded-[10px] bg-[#5B4FCF] text-white text-[13px] font-semibold hover:bg-[#4A3FBF] disabled:opacity-50"
              >
                {copyBusy ? "Copying…" : "Copy Holidays"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
