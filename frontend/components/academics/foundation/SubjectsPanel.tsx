"use client";
import { useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { Subject, Toast } from "./types";

interface Props {
  subjects: Subject[];
  loading: boolean;
  onRefresh: () => void;
  showToast: (msg: string, tone?: Toast["tone"]) => void;
}

type SubjectType = "compulsory" | "optional" | "elective";

interface SubjectForm {
  name: string;
  code: string;
  subject_type: SubjectType;
}

const TYPE_STYLES: Record<SubjectType, string> = {
  compulsory: "bg-blue-100 text-blue-700",
  optional:   "bg-amber-100 text-amber-700",
  elective:   "bg-violet-100 text-violet-700",
};

function extractErrors(body: unknown): string {
  if (!body || typeof body !== "object") return "Failed to save.";
  const p = body as Record<string, unknown>;
  const src = (p.errors ?? p) as Record<string, unknown>;
  const msgs: string[] = [];
  for (const v of Object.values(src)) {
    if (Array.isArray(v)) msgs.push(v[0] as string);
    else if (typeof v === "string") msgs.push(v);
  }
  return msgs.join(" ") || "Failed to save.";
}

const EMPTY: SubjectForm = { name: "", code: "", subject_type: "compulsory" };

export default function SubjectsPanel({ subjects, loading, onRefresh, showToast }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SubjectForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<SubjectType | "all">("all");

  function openAdd() {
    setForm(EMPTY);
    setEditingId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(s: Subject) {
    setForm({ name: s.name, code: s.code, subject_type: s.subject_type });
    setEditingId(s.id);
    setError("");
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditingId(null);
    setError("");
  }

  async function save() {
    if (!form.name || !form.code) { setError("Name and code are required."); return; }
    setSaving(true);
    setError("");
    try {
      const url = editingId ? `/api/v1/core/subjects/${editingId}/` : "/api/v1/core/subjects/";
      await apiRequestWithRefresh(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, code: form.code, subject_type: form.subject_type }),
      });
      showToast(editingId ? "Subject updated." : `Subject "${form.name}" created.`);
      cancel();
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        try { setError(extractErrors(JSON.parse(err.message) as unknown)); return; } catch { /* ignore */ }
        setError(err.message);
      } else setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: Subject) {
    if (!confirm(`Delete subject "${s.name}"?`)) return;
    setDeletingId(s.id);
    try {
      await apiRequestWithRefresh(`/api/v1/core/subjects/${s.id}/`, { method: "DELETE" });
      showToast(`"${s.name}" deleted.`);
      onRefresh();
    } catch {
      showToast("Failed to delete subject.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = filter === "all" ? subjects : subjects.filter((s) => s.subject_type === filter);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Subject Catalog</h2>
          <p className="text-xs text-gray-400 mt-0.5">Manage all subjects: compulsory, optional, and elective.</p>
        </div>
        {!showForm && (
          <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
            <span>＋</span> New Subject
          </button>
        )}
      </div>

      {/* Filter pills */}
      {!showForm && subjects.length > 0 && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {(["all", "compulsory", "optional", "elective"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={[
                "px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors capitalize",
                filter === t
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300",
              ].join(" ")}
            >
              {t === "all" ? `All (${subjects.length})` : `${t} (${subjects.filter((s) => s.subject_type === t).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-bold text-emerald-700 mb-3">{editingId ? "Edit Subject" : "Create Subject"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div className="sm:col-span-1">
              <label className="text-[11px] font-semibold text-gray-500 block mb-1">Name <span className="text-red-500">*</span></label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Mathematics"
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-400 bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 block mb-1">Code <span className="text-red-500">*</span></label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="MATH"
                maxLength={10}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-400 bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 block mb-1">Type</label>
              <select
                value={form.subject_type}
                onChange={(e) => setForm((f) => ({ ...f, subject_type: e.target.value as SubjectType }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-400 bg-white"
              >
                <option value="compulsory">Compulsory</option>
                <option value="optional">Optional</option>
                <option value="elective">Elective</option>
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >{saving ? "Saving…" : editingId ? "Update" : "Create"}</button>
            <button onClick={cancel} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Subject grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[1,2,3,4].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-2xl mb-2">📚</p>
          <p className="text-sm font-medium">{subjects.length === 0 ? "No subjects yet" : "No subjects match filter"}</p>
          {subjects.length === 0 && <p className="text-xs mt-1">Add subjects to the school&apos;s catalog.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-all group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 truncate">{s.name}</span>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${TYPE_STYLES[s.subject_type]}`}>
                    {s.subject_type.charAt(0).toUpperCase() + s.subject_type.slice(1)}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 font-mono mt-0.5">{s.code}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => openEdit(s)}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                >Edit</button>
                <button
                  onClick={() => void handleDelete(s)}
                  disabled={deletingId === s.id}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-40"
                >{deletingId === s.id ? "…" : "✕"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
