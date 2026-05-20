"use client";
import { useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { AcademicYear, Toast } from "./types";

interface Props {
  years: AcademicYear[];
  loading: boolean;
  onRefresh: () => void;
  showToast: (msg: string, tone?: Toast["tone"]) => void;
  onMarkCurrent?: (year: AcademicYear) => void;
}

interface YearFormState {
  start_date: string;
  end_date: string;
  is_current: boolean;
}

const EMPTY: YearFormState = { start_date: "", end_date: "", is_current: false };

function derivedName(start: string, end: string): string {
  if (!start || !end) return "";
  const sy = new Date(start).getFullYear();
  const ey = new Date(end).getFullYear();
  return sy && ey ? `${sy}-${ey}` : "";
}

export default function AcademicYearPanel({ years, loading, onRefresh, showToast }: Props) {
  const [form, setForm] = useState<YearFormState>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const name = derivedName(form.start_date, form.end_date);

  function openAdd() {
    setForm(EMPTY);
    setEditingId(null);
    setErrors({});
    setShowForm(true);
  }

  function openEdit(y: AcademicYear) {
    setForm({ start_date: y.start_date, end_date: y.end_date, is_current: y.is_current });
    setEditingId(y.id);
    setErrors({});
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditingId(null);
    setErrors({});
  }

  function extractErrors(body: unknown): Record<string, string> {
    if (!body || typeof body !== "object") return {};
    const errs: Record<string, string> = {};
    const payload = body as Record<string, unknown>;
    const src = (payload.errors ?? payload) as Record<string, unknown>;
    for (const [k, v] of Object.entries(src)) {
      if (Array.isArray(v)) errs[k] = v[0] as string;
      else if (typeof v === "string") errs[k] = v;
    }
    return errs;
  }

  async function save() {
    if (!form.start_date || !form.end_date) {
      setErrors({ date: "Both start and end dates are required." });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const url = editingId
        ? `/api/v1/core/academic-years/${editingId}/`
        : "/api/v1/core/academic-years/";
      await apiRequestWithRefresh(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: form.start_date,
          end_date: form.end_date,
          is_current: form.is_current,
        }),
      });
      showToast(editingId ? "Academic year updated." : `Academic year ${name} created.`);
      cancel();
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        try {
          const body = JSON.parse(err.message) as unknown;
          const fe = extractErrors(body);
          if (Object.keys(fe).length) { setErrors(fe); return; }
        } catch { /* ignore */ }
        setErrors({ _: err.message });
      } else {
        setErrors({ _: "Failed to save." });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(y: AcademicYear) {
    if (!confirm(`Delete "${y.name}"? This cannot be undone.`)) return;
    setDeletingId(y.id);
    try {
      await apiRequestWithRefresh(`/api/v1/core/academic-years/${y.id}/`, { method: "DELETE" });
      showToast(`"${y.name}" deleted.`);
      onRefresh();
    } catch {
      showToast("Failed to delete academic year.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSetCurrent(y: AcademicYear) {
    try {
      await apiRequestWithRefresh(`/api/v1/core/academic-years/${y.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_current: true }),
      });
      showToast(`"${y.name}" set as current year.`);
      onRefresh();
    } catch {
      showToast("Failed to update.", "error");
    }
  }

  const allErr = Object.values(errors).join(" ");

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Academic Years</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Define year boundaries. Marking one as current locks it as the active workspace.
          </p>
        </div>
        {!showForm && (
          <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
            <span>＋</span> New Year
          </button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <p className="text-xs font-bold text-indigo-700 mb-3">
            {editingId ? "Edit Academic Year" : "Create Academic Year"}
            {name && <span className="ml-2 text-indigo-400 font-semibold">→ {name}</span>}
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 block mb-1">Start Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 block mb-1">End Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 bg-white"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 mb-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_current}
              onChange={(e) => setForm((f) => ({ ...f, is_current: e.target.checked }))}
              className="accent-indigo-600"
            />
            Set as current academic year
          </label>
          {allErr && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{allErr}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : editingId ? "Update" : "Create"}
            </button>
            <button onClick={cancel} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Year list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : years.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-2xl mb-2">📅</p>
          <p className="text-sm font-medium">No academic years yet</p>
          <p className="text-xs mt-1">Create your first academic year to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {years.map((y) => (
            <div
              key={y.id}
              className={[
                "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                y.is_current
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-gray-200 bg-white hover:border-gray-300",
              ].join(" ")}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${y.is_current ? "bg-green-500" : "bg-gray-300"}`} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-gray-900">{y.name}</span>
                <span className="ml-3 text-xs text-gray-400">
                  {y.start_date} → {y.end_date}
                </span>
                {y.is_current && (
                  <span className="ml-2 inline-flex px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">
                    CURRENT
                  </span>
                )}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                {!y.is_current && (
                  <button
                    onClick={() => void handleSetCurrent(y)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                  >
                    Set Current
                  </button>
                )}
                <button
                  onClick={() => openEdit(y)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => void handleDelete(y)}
                  disabled={deletingId === y.id}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-40"
                >
                  {deletingId === y.id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
