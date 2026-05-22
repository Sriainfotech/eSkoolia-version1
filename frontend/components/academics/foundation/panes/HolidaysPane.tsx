"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { Toast, AcademicYear } from "../types";

interface Props {
  showToast: (msg: string, tone?: Toast["tone"]) => void;
  onBack: () => void;
  years: AcademicYear[];
  currentYear?: AcademicYear;
}

interface Holiday {
  id: number;
  school: number;
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

interface HolidayList { results?: Holiday[]; count?: number; }
interface HolidayResponse { success?: boolean; message?: string; data?: Holiday; }
interface SampleHolidaysResponse {
  success: boolean;
  year: number;
  count: number;
  results: Array<{
    name: string;
    date: string;
    end_date: string | null;
    holiday_type: string;
    description: string;
  }>;
}

const API = "/api/v1/core/holidays/";
const HOLIDAYS_PER_PAGE = 15;

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

function extractList<T>(resp: unknown): T[] {
  if (Array.isArray(resp)) return resp as T[];
  if (resp && typeof resp === "object" && Array.isArray((resp as { results?: T[] }).results)) {
    return (resp as { results: T[] }).results;
  }
  return [];
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

function fmtDateRange(start: string, end: string | null) {
  if (!end || end === start) return fmtDate(start);
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

function readError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: string; data?: { message?: string; errors?: Record<string, string[]> } };
    if (e.data?.errors) {
      const first = Object.values(e.data.errors)[0];
      if (Array.isArray(first) && first.length) return String(first[0]);
    }
    if (e.data?.message) return e.data.message;
    if (e.message) return e.message;
  }
  return "Something went wrong. Please try again.";
}

export default function HolidaysPane({ showToast, onBack, years, currentYear }: Props) {
  const sortedYears = useMemo(
    () => [...years].sort((a, b) => (a.start_date < b.start_date ? 1 : -1)),
    [years]
  );
  const defaultYearId = currentYear?.id ?? sortedYears[0]?.id ?? null;

  const [yearFilter, setYearFilter] = useState<number | null>(defaultYearId);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [items, setItems] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [holidaysPage, setHolidaysPage] = useState(0);

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [formName, setFormName] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formType, setFormType] = useState("public");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sample / copy modals
  const [showSample, setShowSample] = useState(false);
  const [samples, setSamples] = useState<SampleHolidaysResponse["results"]>([]);
  const [samplesLoading, setSamplesLoading] = useState(false);

  const [showCopy, setShowCopy] = useState(false);
  const [copySourceId, setCopySourceId] = useState<number | null>(null);
  const [copySaving, setCopySaving] = useState(false);

  const selectedYear = useMemo(
    () => sortedYears.find((y) => y.id === yearFilter) ?? null,
    [sortedYears, yearFilter]
  );

  const previousYears = useMemo(
    () => sortedYears.filter((y) => y.id !== yearFilter),
    [sortedYears, yearFilter]
  );

  // ── Data fetch ────────────────────────────────────────────────────────────
  const fetchItems = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page_size", "200");
      if (yearFilter) qs.set("academic_year", String(yearFilter));
      if (typeFilter) qs.set("type", typeFilter);
      const resp = await apiRequestWithRefresh<HolidayList | Holiday[]>(`${API}?${qs.toString()}`);
      setItems(extractList<Holiday>(resp));
      setHolidaysPage(0); // reset to first page on every fetch
    } catch (err) {
      showToast(readError(err), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (yearFilter == null && defaultYearId != null) setYearFilter(defaultYearId);
  }, [defaultYearId, yearFilter]);

  useEffect(() => {
    void fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearFilter, typeFilter]);

  // ── Form handlers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormDate("");
    setFormEndDate("");
    setFormType("public");
    setFormDescription("");
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (h: Holiday) => {
    setEditing(h);
    setFormName(h.name);
    setFormDate(h.date);
    setFormEndDate(h.end_date ?? "");
    setFormType(h.holiday_type);
    setFormDescription(h.description ?? "");
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditing(null);
    setFormError(null);
  };

  const submitForm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formName.trim()) { setFormError("Holiday name is required."); return; }
    if (!formDate) { setFormError("Date is required."); return; }
    if (formEndDate && formEndDate < formDate) {
      setFormError("End date cannot be before start date.");
      return;
    }

    const payload: Record<string, unknown> = {
      name: formName.trim(),
      date: formDate,
      end_date: formEndDate || null,
      holiday_type: formType,
      description: formDescription.trim(),
    };
    if (yearFilter) payload.academic_year = yearFilter;

    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        const resp = await apiRequestWithRefresh<HolidayResponse>(`${API}${editing.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        showToast(resp?.message ?? "Holiday updated.", "success");
      } else {
        const resp = await apiRequestWithRefresh<HolidayResponse>(API, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast(resp?.message ?? "Holiday added.", "success");
      }
      setShowForm(false);
      setEditing(null);
      void fetchItems();
    } catch (err) {
      setFormError(readError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (h: Holiday) => {
    try {
      await apiRequestWithRefresh<HolidayResponse>(`${API}${h.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ active_status: !h.active_status }),
      });
      showToast(h.active_status ? "Holiday disabled." : "Holiday enabled.", "success");
      void fetchItems();
    } catch (err) {
      showToast(readError(err), "error");
    }
  };

  const deleteHoliday = async (h: Holiday) => {
    if (!confirm(`Delete holiday "${h.name}" on ${fmtDate(h.date)}?`)) return;
    try {
      await apiRequestWithRefresh(`${API}${h.id}/`, { method: "DELETE" });
      showToast("Holiday deleted.", "success");
      void fetchItems();
    } catch (err) {
      showToast(readError(err), "error");
    }
  };

  // ── Sample defaults ───────────────────────────────────────────────────────
  const openSample = async () => {
    setShowSample(true);
    setSamplesLoading(true);
    try {
      const year = selectedYear?.start_date
        ? new Date(selectedYear.start_date).getFullYear()
        : new Date().getFullYear();
      const resp = await apiRequestWithRefresh<SampleHolidaysResponse>(
        `${API}sample-defaults/?year=${year}`
      );
      setSamples(resp?.results ?? []);
    } catch (err) {
      showToast(readError(err), "error");
      setShowSample(false);
    } finally {
      setSamplesLoading(false);
    }
  };

  const useSamples = async () => {
    if (!yearFilter) { showToast("Select an academic year first.", "error"); return; }
    setSamplesLoading(true);
    try {
      let created = 0, skipped = 0;
      for (const s of samples) {
        try {
          await apiRequestWithRefresh<HolidayResponse>(API, {
            method: "POST",
            body: JSON.stringify({
              academic_year: yearFilter,
              name: s.name,
              date: s.date,
              end_date: s.end_date,
              holiday_type: s.holiday_type,
              description: s.description,
            }),
          });
          created++;
        } catch {
          skipped++;
        }
      }
      showToast(
        `Added ${created} holiday${created !== 1 ? "s" : ""}` +
          (skipped ? `, skipped ${skipped} duplicate${skipped !== 1 ? "s" : ""}.` : "."),
        "success"
      );
      setShowSample(false);
      void fetchItems();
    } finally {
      setSamplesLoading(false);
    }
  };

  // ── Copy from previous year ───────────────────────────────────────────────
  const openCopy = () => {
    setCopySourceId(previousYears[0]?.id ?? null);
    setShowCopy(true);
  };

  const submitCopy = async () => {
    if (!copySourceId || !yearFilter) return;
    setCopySaving(true);
    try {
      const resp = await apiRequestWithRefresh<{ success: boolean; message?: string; created?: number }>(
        `${API}copy-from-year/`,
        {
          method: "POST",
          body: JSON.stringify({
            source_academic_year: copySourceId,
            target_academic_year: yearFilter,
            shift_year: true,
          }),
        }
      );
      showToast(resp?.message ?? "Holidays copied.", "success");
      setShowCopy(false);
      void fetchItems();
    } catch (err) {
      showToast(readError(err), "error");
    } finally {
      setCopySaving(false);
    }
  };

  const isEmpty = !loading && items.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-white rounded-xl border border-[#E8ECEF] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <h2 className="text-[18px] font-bold text-[#1A1D1F]">Holiday Calendar</h2>
            <p className="text-[12px] text-[#6F767E]">
              {selectedYear ? `Academic Year ${selectedYear.name}` : "Manage holidays for your academic year"}
            </p>
          </div>

          {/* Filters */}
          <select
            value={yearFilter ?? ""}
            onChange={(e) => setYearFilter(e.target.value ? Number(e.target.value) : null)}
            className="h-9 px-3 rounded-lg border border-[#E8ECEF] text-[13px] bg-white focus:outline-none focus:border-[#5B4FCF]"
          >
            {sortedYears.length === 0 && <option value="">No academic years</option>}
            {sortedYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}{y.is_current ? " (Current)" : ""}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[#E8ECEF] text-[13px] bg-white focus:outline-none focus:border-[#5B4FCF]"
          >
            <option value="">All Types</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {/* Actions */}
          <button
            type="button"
            onClick={openAdd}
            disabled={!yearFilter}
            className="h-9 px-4 rounded-lg bg-[#5B4FCF] hover:bg-[#4A3FBF] text-white text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Add Holiday
          </button>

          {previousYears.length > 0 && yearFilter && (
            <button
              type="button"
              onClick={openCopy}
              className="h-9 px-3 rounded-lg border border-[#E8ECEF] text-[13px] text-[#1A1D1F] hover:bg-[#F8F9FA] font-medium"
            >
              Copy from Previous Year
            </button>
          )}

          {isEmpty && yearFilter && (
            <button
              type="button"
              onClick={openSample}
              className="h-9 px-3 rounded-lg border border-[#5B4FCF] text-[13px] text-[#5B4FCF] hover:bg-[#EDE9FE] font-medium"
            >
              Use Sample Holidays
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E8ECEF] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-[#F8F9FA]">
              <tr className="text-left text-[11px] uppercase tracking-wide text-[#6F767E]">
                <th className="px-4 py-3 font-semibold w-[200px]">Date</th>
                <th className="px-4 py-3 font-semibold">Holiday</th>
                <th className="px-4 py-3 font-semibold w-[140px]">Type</th>
                <th className="px-4 py-3 font-semibold w-[120px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[#9FA6AD]">Loading…</td>
                </tr>
              )}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="w-12 h-12 rounded-full bg-[#F3E8FF] flex items-center justify-center text-[20px]">
                        ☼
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold text-[#1A1D1F]">No holidays yet</div>
                        <div className="text-[12px] text-[#6F767E] mt-1">
                          Get started by adding a holiday or use our sample list.
                        </div>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button
                          type="button"
                          onClick={openAdd}
                          disabled={!yearFilter}
                          className="h-8 px-3 rounded-lg bg-[#5B4FCF] hover:bg-[#4A3FBF] text-white text-[12px] font-semibold disabled:opacity-40"
                        >
                          + Add Holiday
                        </button>
                        <button
                          type="button"
                          onClick={openSample}
                          disabled={!yearFilter}
                          className="h-8 px-3 rounded-lg border border-[#5B4FCF] text-[12px] text-[#5B4FCF] hover:bg-[#EDE9FE] font-semibold disabled:opacity-40"
                        >
                          Use Sample Holidays
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && (() => {
                const totalPages = Math.ceil(items.length / HOLIDAYS_PER_PAGE);
                const safePage   = Math.min(holidaysPage, Math.max(0, totalPages - 1));
                const pageItems  = items.slice(safePage * HOLIDAYS_PER_PAGE, (safePage + 1) * HOLIDAYS_PER_PAGE);
                return pageItems.map((h) => {
                  const badge = TYPE_BADGE[h.holiday_type] ?? TYPE_BADGE.other;
                  return (
                  <tr
                    key={h.id}
                    className={`border-t border-[#F1F3F5] hover:bg-[#FAFBFC] ${!h.active_status ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="text-[#1A1D1F] font-medium">{fmtDateRange(h.date, h.end_date)}</div>
                      {h.duration_days && h.duration_days > 1 && (
                        <div className="text-[11px] text-[#9FA6AD] mt-0.5">{h.duration_days} days</div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-[#1A1D1F] font-medium">{h.name}</div>
                      {h.description && (
                        <div className="text-[11px] text-[#6F767E] mt-0.5">{h.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: badge.bg, color: badge.fg }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(h)}
                          title="Edit"
                          className="w-7 h-7 rounded-md hover:bg-[#EDE9FE] text-[#5B4FCF] text-[13px]"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(h)}
                          title={h.active_status ? "Disable" : "Enable"}
                          className="w-7 h-7 rounded-md hover:bg-[#F1F3F5] text-[#6F767E] text-[13px]"
                        >
                          {h.active_status ? "−" : "+"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteHoliday(h)}
                          title="Delete"
                          className="w-7 h-7 rounded-md hover:bg-[#FEE2E2] text-[#DC2626] text-[13px]"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                });
              })()}
            </tbody>
          </table>

          {/* Pagination bar */}
          {!loading && items.length > HOLIDAYS_PER_PAGE && (() => {
            const totalPages = Math.ceil(items.length / HOLIDAYS_PER_PAGE);
            const safePage   = Math.min(holidaysPage, totalPages - 1);
            return (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E8ECEF]">
                <span className="text-[10px] text-[#9FA6AD]">
                  {safePage * HOLIDAYS_PER_PAGE + 1}–{Math.min((safePage + 1) * HOLIDAYS_PER_PAGE, items.length)} of {items.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setHolidaysPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="w-6 h-6 flex items-center justify-center rounded-[6px] border border-[#E8ECEF] text-[#6F767E] hover:bg-[#EEF0FF] hover:text-[#5B4FCF] hover:border-[#C7C2F0] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[13px] font-bold"
                    title="Previous page"
                  >&lt;</button>
                  <span className="text-[10px] text-[#6F767E] min-w-[40px] text-center">{safePage + 1} / {totalPages}</span>
                  <button
                    onClick={() => setHolidaysPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage === totalPages - 1}
                    className="w-6 h-6 flex items-center justify-center rounded-[6px] border border-[#E8ECEF] text-[#6F767E] hover:bg-[#EEF0FF] hover:text-[#5B4FCF] hover:border-[#C7C2F0] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[13px] font-bold"
                    title="Next page"
                  >&gt;</button>
                </div>
              </div>
            );
          })()}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="h-9 px-4 rounded-lg border border-[#E8ECEF] text-[13px] text-[#1A1D1F] hover:bg-[#F8F9FA] font-medium"
        >
          ← Back
        </button>
        <div className="text-[12px] text-[#9FA6AD]">
          {items.length} holiday{items.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeForm}>
          <form
            onSubmit={submitForm}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-xl shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-[#E8ECEF]">
              <h3 className="text-[16px] font-bold text-[#1A1D1F]">
                {editing ? "Edit Holiday" : "Add Holiday"}
              </h3>
            </div>

            <div className="px-5 py-4 space-y-3">
              {formError && (
                <div className="px-3 py-2 rounded-md bg-[#FEE2E2] text-[#991B1B] text-[12px]">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[12px] font-semibold text-[#1A1D1F] mb-1">
                  Holiday Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Diwali"
                  className="w-full h-9 px-3 rounded-lg border border-[#E8ECEF] text-[13px] focus:outline-none focus:border-[#5B4FCF]"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#1A1D1F] mb-1">
                    Date <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-[#E8ECEF] text-[13px] focus:outline-none focus:border-[#5B4FCF]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#1A1D1F] mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    min={formDate || undefined}
                    className="w-full h-9 px-3 rounded-lg border border-[#E8ECEF] text-[13px] focus:outline-none focus:border-[#5B4FCF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#1A1D1F] mb-1">Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#E8ECEF] text-[13px] bg-white focus:outline-none focus:border-[#5B4FCF]"
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#1A1D1F] mb-1">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional"
                  className="w-full px-3 py-2 rounded-lg border border-[#E8ECEF] text-[13px] focus:outline-none focus:border-[#5B4FCF] resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[#E8ECEF] flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="h-9 px-4 rounded-lg border border-[#E8ECEF] text-[13px] text-[#1A1D1F] hover:bg-[#F8F9FA] font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-4 rounded-lg bg-[#5B4FCF] hover:bg-[#4A3FBF] text-white text-[13px] font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Holiday"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sample holidays modal */}
      {showSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !samplesLoading && setShowSample(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-[#E8ECEF]">
              <h3 className="text-[16px] font-bold text-[#1A1D1F]">Sample Holidays</h3>
              <p className="text-[12px] text-[#6F767E] mt-0.5">
                Common holidays for {selectedYear?.name ?? "this year"}. You can edit or remove them later.
              </p>
            </div>
            <div className="px-5 py-3 max-h-[360px] overflow-y-auto">
              {samplesLoading && samples.length === 0 ? (
                <div className="text-center py-6 text-[#9FA6AD] text-[13px]">Loading…</div>
              ) : (
                <ul className="divide-y divide-[#F1F3F5]">
                  {samples.map((s) => {
                    const badge = TYPE_BADGE[s.holiday_type] ?? TYPE_BADGE.other;
                    return (
                      <li key={`${s.date}-${s.name}`} className="py-2 flex items-center gap-3 text-[13px]">
                        <span className="w-[110px] text-[#6F767E]">{fmtDate(s.date)}</span>
                        <span className="flex-1 text-[#1A1D1F] font-medium">{s.name}</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: badge.bg, color: badge.fg }}
                        >
                          {badge.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="px-5 py-4 border-t border-[#E8ECEF] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSample(false)}
                disabled={samplesLoading}
                className="h-9 px-4 rounded-lg border border-[#E8ECEF] text-[13px] text-[#1A1D1F] hover:bg-[#F8F9FA] font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={useSamples}
                disabled={samplesLoading || samples.length === 0}
                className="h-9 px-4 rounded-lg bg-[#5B4FCF] hover:bg-[#4A3FBF] text-white text-[13px] font-semibold disabled:opacity-50"
              >
                {samplesLoading ? "Adding…" : `Use these for ${selectedYear?.name ?? "this year"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy from previous year modal */}
      {showCopy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !copySaving && setShowCopy(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-[#E8ECEF]">
              <h3 className="text-[16px] font-bold text-[#1A1D1F]">Copy Holidays from Previous Year</h3>
              <p className="text-[12px] text-[#6F767E] mt-0.5">
                Dates will be shifted to {selectedYear?.name ?? "the selected year"}.
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#1A1D1F] mb-1">Source Year</label>
                <select
                  value={copySourceId ?? ""}
                  onChange={(e) => setCopySourceId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full h-9 px-3 rounded-lg border border-[#E8ECEF] text-[13px] bg-white focus:outline-none focus:border-[#5B4FCF]"
                >
                  {previousYears.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[#E8ECEF] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCopy(false)}
                disabled={copySaving}
                className="h-9 px-4 rounded-lg border border-[#E8ECEF] text-[13px] text-[#1A1D1F] hover:bg-[#F8F9FA] font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitCopy}
                disabled={copySaving || !copySourceId}
                className="h-9 px-4 rounded-lg bg-[#5B4FCF] hover:bg-[#4A3FBF] text-white text-[13px] font-semibold disabled:opacity-50"
              >
                {copySaving ? "Copying…" : "Copy Holidays"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
