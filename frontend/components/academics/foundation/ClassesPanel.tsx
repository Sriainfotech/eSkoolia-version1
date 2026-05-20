"use client";
import { useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { SchoolClass, Section, Toast } from "./types";

interface Props {
  classes: SchoolClass[];
  loading: boolean;
  onRefresh: () => void;
  showToast: (msg: string, tone?: Toast["tone"]) => void;
}

const VALID_NAMES = ["Nursery", "LKG", "UKG", ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`)];

interface ClassForm {
  name: string;
}

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

export default function ClassesPanel({ classes, loading, onRefresh, showToast }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ClassForm>({ name: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Section add sub-form (one at a time, per expanded class)
  const [sectionForm, setSectionForm] = useState<{ classId: number; name: string; capacity: string } | null>(null);
  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionError, setSectionError] = useState("");
  const [deletingSectionId, setDeletingSectionId] = useState<number | null>(null);

  function openAdd() {
    setForm({ name: "" });
    setEditingId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(c: SchoolClass) {
    setForm({ name: c.name });
    setEditingId(c.id);
    setError("");
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditingId(null);
    setError("");
  }

  async function saveClass() {
    if (!form.name) { setError("Class name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const url = editingId ? `/api/v1/core/classes/${editingId}/` : "/api/v1/core/classes/";
      await apiRequestWithRefresh(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name }),
      });
      showToast(editingId ? "Class updated." : `Class "${form.name}" created.`);
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

  async function deleteClass(c: SchoolClass) {
    if (!confirm(`Delete class "${c.name}"? All sections will be removed.`)) return;
    setDeletingId(c.id);
    try {
      await apiRequestWithRefresh(`/api/v1/core/classes/${c.id}/`, { method: "DELETE" });
      showToast(`Class "${c.name}" deleted.`);
      onRefresh();
    } catch {
      showToast("Failed to delete class.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  function openSectionForm(classId: number) {
    setSectionForm({ classId, name: "", capacity: "40" });
    setSectionError("");
  }

  async function saveSection() {
    if (!sectionForm) return;
    if (!sectionForm.name) { setSectionError("Section name is required."); return; }
    setSectionSaving(true);
    setSectionError("");
    try {
      await apiRequestWithRefresh("/api/v1/core/sections/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_class: sectionForm.classId,
          name: sectionForm.name,
          capacity: parseInt(sectionForm.capacity) || 40,
        }),
      });
      showToast(`Section "${sectionForm.name}" created.`);
      setSectionForm(null);
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        try { setSectionError(extractErrors(JSON.parse(err.message) as unknown)); return; } catch { /* ignore */ }
        setSectionError(err.message);
      } else setSectionError("Failed to save section.");
    } finally {
      setSectionSaving(false);
    }
  }

  async function deleteSection(sec: Section, cls: SchoolClass) {
    if (!confirm(`Delete section "${sec.name}" from "${cls.name}"?`)) return;
    setDeletingSectionId(sec.id);
    try {
      await apiRequestWithRefresh(`/api/v1/core/sections/${sec.id}/`, { method: "DELETE" });
      showToast(`Section "${sec.name}" deleted.`);
      onRefresh();
    } catch {
      showToast("Failed to delete section.", "error");
    } finally {
      setDeletingSectionId(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Classes & Sections</h2>
          <p className="text-xs text-gray-400 mt-0.5">Expand a class to view and manage its sections inline.</p>
        </div>
        {!showForm && (
          <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
            <span>＋</span> New Class
          </button>
        )}
      </div>

      {/* Class form */}
      {showForm && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-bold text-blue-700 mb-3">{editingId ? "Edit Class" : "Create Class"}</p>
          <div className="mb-3">
            <label className="text-[11px] font-semibold text-gray-500 block mb-1">Class Name <span className="text-red-500">*</span></label>
            <select
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400 bg-white"
            >
              <option value="">— select class —</option>
              {VALID_NAMES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => void saveClass()}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : editingId ? "Update" : "Create"}
            </button>
            <button onClick={cancel} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />)}</div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-2xl mb-2">🏫</p>
          <p className="text-sm font-medium">No classes yet</p>
          <p className="text-xs mt-1">Add your school&apos;s grade/class structure.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {classes.map((cls) => {
            const isOpen = expandedId === cls.id;
            return (
              <div key={cls.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                {/* Class row */}
                <div
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                  onClick={() => setExpandedId(isOpen ? null : cls.id)}
                >
                  <span className="text-gray-400 text-xs">{isOpen ? "▼" : "▶"}</span>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-gray-900">{cls.name}</span>
                    <span className="ml-3 text-xs text-gray-400">{cls.sections?.length ?? 0} sections · {cls.total_students} students</span>
                  </div>
                  <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openEdit(cls)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                    >Edit</button>
                    <button
                      onClick={() => void deleteClass(cls)}
                      disabled={deletingId === cls.id}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-40"
                    >{deletingId === cls.id ? "…" : "Delete"}</button>
                  </div>
                </div>

                {/* Sections dropdown */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-4 pt-3 pb-3 bg-gray-50">
                    {/* Existing sections */}
                    {cls.sections && cls.sections.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {cls.sections.map((sec) => (
                          <div key={sec.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-xs">
                            <span className="font-semibold text-gray-700">{sec.name}</span>
                            <span className="text-gray-400">cap {sec.capacity}</span>
                            <span className="text-gray-400">·</span>
                            <span className="text-gray-400">{sec.student_count} students</span>
                            <button
                              onClick={() => void deleteSection(sec, cls)}
                              disabled={deletingSectionId === sec.id}
                              className="ml-1 text-red-400 hover:text-red-600 text-[10px] disabled:opacity-40"
                              title="Delete section"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mb-3">No sections yet.</p>
                    )}

                    {/* Inline add section */}
                    {sectionForm?.classId === cls.id ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 block mb-0.5">Name</label>
                          <input
                            autoFocus
                            value={sectionForm.name}
                            onChange={(e) => setSectionForm((f) => f ? { ...f, name: e.target.value } : f)}
                            placeholder="e.g. A"
                            className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-400 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 block mb-0.5">Capacity</label>
                          <input
                            type="number"
                            value={sectionForm.capacity}
                            onChange={(e) => setSectionForm((f) => f ? { ...f, capacity: e.target.value } : f)}
                            className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-400 bg-white"
                            min={1} max={200}
                          />
                        </div>
                        <button
                          onClick={() => void saveSection()}
                          disabled={sectionSaving}
                          className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >{sectionSaving ? "…" : "Add"}</button>
                        <button
                          onClick={() => { setSectionForm(null); setSectionError(""); }}
                          className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-white transition-colors"
                        >Cancel</button>
                        {sectionError && <p className="w-full text-xs text-red-600 mt-1">{sectionError}</p>}
                      </div>
                    ) : (
                      <button
                        onClick={() => openSectionForm(cls.id)}
                        className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline"
                      >
                        <span>＋</span> Add Section
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
