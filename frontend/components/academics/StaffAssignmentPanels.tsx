"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users, UserCheck, Activity, AlertTriangle,
  ChevronDown, ChevronRight, Lock, Edit2, X,
  CheckCircle, XCircle, Zap, RefreshCw,
} from "lucide-react";
import { apiRequestWithRefresh } from "@/lib/api-auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type AcademicYear = { id: number; name: string; is_current: boolean };
type SchoolClass = { id: number; name: string; numeric_order?: number };
type Section = { id: number; school_class: number; name: string; capacity?: number };
type Teacher = { id: number; full_name: string; designation?: string; periods_per_week?: number };

type CTAssignment = {
  id: number;
  section_id: number;
  class_id: number;
  teacher_id: number;
  teacher_name: string;
  is_locked: boolean;
  academic_year_id: number;
};

// Subject assignment from /api/v1/academics/staff/subject-assignments/
// section_id is null for class-level (Foundation) assignments
type SubjectRow = {
  id: number;
  class_id: number;
  section_id: number | null;   // null = class-level assignment (applies to all sections)
  subject_id: number;
  subject_name: string;
  teacher_id: number | null;
  teacher_name: string;
  academic_year_id: number | null;
  is_optional: boolean;
};

type KPI = { total_teachers: number; ct_assigned: number; avg_load: number; overloaded: number };
type AuditLog = {
  id: number; section_name: string; class_name: string;
  old_teacher_name: string; new_teacher_name: string;
  reason: string; changed_by_name: string; changed_at: string;
};
type WorkloadEntry = {
  teacher_id: number; teacher_name: string;
  periods_per_week: number; max_periods: number;
  subjects_count: number; sections_count: number;
  load_pct: number; is_overloaded: boolean;
  status: "normal" | "near-limit" | "overloaded";
};
type Toast = { id: string; type: "success" | "error" | "warning"; message: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers as Record<string, string> | undefined) },
  });
}

function asList<T>(v: T[] | { results?: T[] }): T[] {
  return Array.isArray(v) ? v : (v as { results?: T[] }).results ?? [];
}

async function fetchAll<T>(path: string): Promise<T[]> {
  const merged: T[] = [];
  let next: string | null = path;
  for (let i = 0; i < 50 && next; i++) {
    type P = T[] | { results?: T[]; next?: string | null };
    const res: P = await apiFetch<P>(next);
    merged.push(...asList(res as T[] | { results?: T[] }));
    next = (res as { next?: string | null }).next ?? null;
    if (next) {
      try { const u: URL = new URL(next); next = u.pathname + u.search; }
      catch { next = null; }
    }
  }
  return merged;
}

const CLASS_LEVEL_MAP: Record<string, string[]> = {
  "Pre-Primary": ["Nursery", "LKG", "UKG"],
  Primary: ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"],
  Middle: ["Grade 6", "Grade 7", "Grade 8"],
  Secondary: ["Grade 9", "Grade 10"],
  "Senior Secondary": ["Grade 11", "Grade 12"],
};

function classLevel(name: string): string {
  for (const [lvl, names] of Object.entries(CLASS_LEVEL_MAP)) {
    if (names.includes(name)) return lvl;
  }
  return "Other";
}

const CLASS_BADGE_COLORS = [
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-blue-100 text-blue-800",
  "bg-purple-100 text-purple-800",
  "bg-rose-100 text-rose-800",
  "bg-teal-100 text-teal-800",
  "bg-indigo-100 text-indigo-800",
  "bg-orange-100 text-orange-800",
  "bg-cyan-100 text-cyan-800",
  "bg-pink-100 text-pink-800",
  "bg-lime-100 text-lime-800",
  "bg-fuchsia-100 text-fuchsia-800",
];

const SUBJECT_PILL_COLORS = [
  "bg-cyan-100 text-cyan-800 border border-cyan-200",
  "bg-green-100 text-green-800 border border-green-200",
  "bg-rose-100 text-rose-800 border border-rose-200",
  "bg-purple-100 text-purple-800 border border-purple-200",
  "bg-orange-100 text-orange-800 border border-orange-200",
  "bg-blue-100 text-blue-800 border border-blue-200",
  "bg-yellow-100 text-yellow-800 border border-yellow-200",
  "bg-indigo-100 text-indigo-800 border border-indigo-200",
  "bg-pink-100 text-pink-800 border border-pink-200",
  "bg-teal-100 text-teal-800 border border-teal-200",
  "bg-lime-100 text-lime-800 border border-lime-200",
  "bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200",
];

// ─── Toast ────────────────────────────────────────────────────────────────────

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((p) => [...p, { id, type, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);
  const remove = useCallback((id: string) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  return { toasts, show, remove };
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[3100] space-y-2 w-80 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium ${
            t.type === "success" ? "bg-green-50 border-green-200 text-green-800"
            : t.type === "error" ? "bg-red-50 border-red-200 text-red-800"
            : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          {t.type === "success" ? <CheckCircle size={16} /> : t.type === "error" ? <XCircle size={16} /> : <AlertTriangle size={16} />}
          <p className="flex-1">{t.message}</p>
          <button onClick={() => onRemove(t.id)} className="opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Cards ─────────────────────────────────────────────────────────────────

function KpiCards({ kpi }: { kpi: KPI | null }) {
  const cards = [
    { label: "Total Teachers", value: kpi?.total_teachers ?? 0, icon: <Users size={18} />, color: "bg-[var(--soft)] text-[var(--brand)]" },
    { label: "CT Assigned", value: kpi?.ct_assigned ?? 0, icon: <UserCheck size={18} />, color: "bg-green-50 text-green-700" },
    { label: "Avg Load / Week", value: kpi?.avg_load ? `${kpi.avg_load}p` : "—", icon: <Activity size={18} />, color: "bg-blue-50 text-blue-700" },
    { label: "Overloaded", value: kpi?.overloaded ?? 0, icon: <AlertTriangle size={18} />, color: "bg-red-50 text-red-700" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-[var(--line)] rounded-2xl p-4 shadow-sm">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${c.color}`}>{c.icon}</div>
          <div className="text-2xl font-extrabold text-gray-900">{c.value}</div>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── CT Change Modal ──────────────────────────────────────────────────────────

function CTChangeModal({
  isOpen, currentTeacherName, teachers, saving, onConfirm, onCancel,
}: {
  isOpen: boolean; currentTeacherName: string; teachers: Teacher[];
  saving: boolean; onConfirm: (newTeacherId: number, reason: string) => void; onCancel: () => void;
}) {
  const [newId, setNewId] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { if (isOpen) { setNewId(""); setReason(""); setErr(""); } }, [isOpen]);
  if (!isOpen) return null;

  const confirm = () => {
    if (!reason.trim()) { setErr("Please enter a reason to continue."); return; }
    if (!newId) return;
    onConfirm(newId as number, reason);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[3000] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b">
          <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
            <Edit2 size={14} className="text-amber-600" />
          </div>
          <h3 className="font-bold text-gray-900 flex-1">Change Class Teacher</h3>
          <button onClick={onCancel}><X size={18} className="text-gray-400 hover:text-gray-700" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="bg-gray-50 rounded-xl p-3 text-sm">
            <span className="text-gray-500">Current: </span>
            <span className="font-semibold text-gray-800">{currentTeacherName || "—"}</span>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
              New Teacher <span className="text-red-500">*</span>
            </label>
            <select
              value={newId}
              onChange={(e) => setNewId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)] bg-gray-50"
            >
              <option value="">Select teacher…</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}{t.designation ? ` (${t.designation})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
              Reason for Change <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (e.target.value.trim()) setErr(""); }}
              placeholder="Enter reason for changing class teacher…"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)] bg-gray-50 resize-none"
            />
            {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={saving || !newId}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block" />}
            Confirm Change
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Assign Modal ────────────────────────────────────────────────────────

function BulkAssignModal({
  isOpen, teachers, classes, sections, saving, onConfirm, onCancel,
}: {
  isOpen: boolean; teachers: Teacher[]; classes: SchoolClass[]; sections: Section[];
  saving: boolean;
  onConfirm: (classId: number, sectionId: number | null, teacherId: number, bulkClass: boolean) => void;
  onCancel: () => void;
}) {
  const [classId, setClassId] = useState<number | "">("");
  const [sectionId, setSectionId] = useState<number | "">("");
  const [teacherId, setTeacherId] = useState<number | "">("");
  const [bulk, setBulk] = useState(false);

  useEffect(() => { if (isOpen) { setClassId(""); setSectionId(""); setTeacherId(""); setBulk(false); } }, [isOpen]);
  if (!isOpen) return null;

  const filteredSections = sections.filter((s) => s.school_class === classId);

  return (
    <div className="fixed inset-0 bg-black/50 z-[3000] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b">
          <Zap size={18} className="text-[var(--brand)]" />
          <h3 className="font-bold text-gray-900 flex-1">Bulk Assign Class Teacher</h3>
          <button onClick={onCancel}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
              Teacher <span className="text-red-500">*</span>
            </label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)] bg-gray-50"
            >
              <option value="">Select teacher…</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
              Class <span className="text-red-500">*</span>
            </label>
            <select
              value={classId}
              onChange={(e) => { setClassId(e.target.value ? Number(e.target.value) : ""); setSectionId(""); }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)] bg-gray-50"
            >
              <option value="">Select class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={bulk} onChange={(e) => setBulk(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-600">Assign to all sections of this class</span>
          </label>
          {!bulk && classId && (
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Section</label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : "")}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)] bg-gray-50"
              >
                <option value="">Select section…</option>
                {filteredSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => {
              if (teacherId && classId) {
                onConfirm(classId as number, sectionId ? sectionId as number : null, teacherId as number, bulk);
              }
            }}
            disabled={saving || !teacherId || !classId || (!bulk && !sectionId)}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--brand)] text-white disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block" />}
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Subject Teacher Row ──────────────────────────────────────────────────────

function SubjectTeacherRow({
  row, subjectName, colorClass, teachers, onSave, saving,
}: {
  row: SubjectRow; subjectName: string; colorClass: string; teachers: Teacher[];
  onSave: (rowId: number, teacherId: number) => Promise<void>; saving: boolean;
}) {
  const [selected, setSelected] = useState<number | "">(row.teacher_id ?? "");
  const [editing, setEditing] = useState(!row.teacher_id);

  useEffect(() => {
    setSelected(row.teacher_id ?? "");
    setEditing(!row.teacher_id);
  }, [row.teacher_id]);

  const assignedTeacher = teachers.find((t) => t.id === row.teacher_id);
  const isOverloaded =
    assignedTeacher?.periods_per_week !== undefined &&
    assignedTeacher.periods_per_week > 28;

  const handleSave = async () => {
    if (!selected) return;
    await onSave(row.id, selected as number);
    setEditing(false);
  };

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40 transition-colors">
      {/* Subject badge */}
      <td className="py-2 pl-0 pr-3 w-[148px]">
        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[11px] font-semibold w-[140px] text-center truncate ${colorClass}`}>
          {subjectName}
        </span>
      </td>

      {/* Teacher column */}
      <td className="py-2 pr-3">
        {editing ? (
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value ? Number(e.target.value) : "")}
            disabled={saving}
            className="w-[200px] min-w-[160px] max-w-[200px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[var(--brand)] bg-white disabled:opacity-60"
          >
            <option value="">— Select Teacher —</option>
            {teachers.map((t) => {
              const load = t.periods_per_week;
              const over = load !== undefined && load > 28;
              return (
                <option key={t.id} value={t.id}>
                  {over ? "⚠ " : ""}{t.full_name}{load !== undefined ? ` (${load}/28)` : ""}
                </option>
              );
            })}
          </select>
        ) : (
          <div className="flex items-center gap-2">
            <div>
              <p className={`text-sm font-semibold leading-tight ${
                isOverloaded ? "text-red-700" : "text-gray-800"
              }`}>
                {isOverloaded && <span className="mr-1">⚠</span>}
                {assignedTeacher?.full_name ?? row.teacher_name}
              </p>
              {assignedTeacher?.periods_per_week !== undefined && (
                <p className={`text-[11px] leading-tight ${
                  isOverloaded ? "text-red-500" : "text-gray-400"
                }`}>
                  {assignedTeacher.periods_per_week}/28 periods
                </p>
              )}
            </div>
            {isOverloaded && (
              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">OVERLOADED</span>
            )}
          </div>
        )}
      </td>

      {/* Action */}
      <td className="py-2 pr-0 w-[90px] text-right">
        {editing ? (
          <button
            onClick={handleSave}
            disabled={saving || !selected}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--brand)] text-white text-xs font-semibold disabled:opacity-40 whitespace-nowrap"
          >
            {saving
              ? <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full inline-block" />
              : <CheckCircle size={11} />}
            Assign
          </button>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs font-semibold hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors whitespace-nowrap"
          >
            <Edit2 size={11} /> Edit
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  section, teachers, subjectRows, ctAssignment, ctAssignments,
  onCTConfirmLock, onCTEditRequest, onSubjectSave, savingSubjKeys, savingCT,
  isOpen, onToggle, schoolClass,
}: {
  section: Section; teachers: Teacher[];
  subjectRows: SubjectRow[];
  ctAssignment: CTAssignment | undefined;
  ctAssignments: CTAssignment[];
  onCTConfirmLock: (sectionId: number, teacherId: number) => Promise<void>;
  onCTEditRequest: (ctId: number, currentTeacherName: string) => void;
  onSubjectSave: (rowId: number, teacherId: number) => Promise<void>;
  savingSubjKeys: Set<number>; savingCT: boolean;
  isOpen: boolean;
  onToggle: () => void;
  schoolClass: SchoolClass;
}) {
  const [selectedCT, setSelectedCT] = useState<number | "">(ctAssignment?.teacher_id ?? "");
  const [ctValidationError, setCTValidationError] = useState("");

  useEffect(() => { setSelectedCT(ctAssignment?.teacher_id ?? ""); }, [ctAssignment?.teacher_id]);

  // Check if selected teacher is already assigned as CT elsewhere
  useEffect(() => {
    if (!selectedCT) {
      setCTValidationError("");
      return;
    }
    
    const existingAssignment = ctAssignments.find(
      (ct) => ct.teacher_id === selectedCT && ct.section_id !== section.id
    );
    
    if (existingAssignment) {
      setCTValidationError(`This teacher is already assigned as Class Teacher for another section.`);
    } else {
      setCTValidationError("");
    }
  }, [selectedCT, ctAssignments, section.id]);

  const isLocked = !!ctAssignment?.is_locked;
  const ctTeacherName = ctAssignment
    ? teachers.find((t) => t.id === ctAssignment.teacher_id)?.full_name ?? ctAssignment.teacher_name
    : "";

  // Build teacher options with assignment info
  const teacherOptions = teachers.map((t) => {
    const assigned = ctAssignments.find((ct) => ct.teacher_id === t.id && ct.section_id !== section.id);
    return {
      ...t,
      isAssigned: !!assigned,
      assignedTo: assigned ? `Already CT: Another Section` : "",
    };
  });

  return (
    <div className="border border-gray-100 rounded-xl bg-white mb-2 overflow-hidden">
      {/* Section header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-gray-50/80 transition-colors"
        onClick={onToggle}
      >
        <span className="text-gray-400">{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
        <span className="font-bold text-gray-800 text-sm">Sec {section.name}</span>
        {section.capacity !== undefined && (
          <span className="text-xs text-gray-400">Strength: {section.capacity}</span>
        )}
        <span className="text-xs text-gray-400">| {subjectRows.length} Subject{subjectRows.length !== 1 ? "s" : ""} Assigned</span>
        <span className="flex-1" />
        {isLocked && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
            <Lock size={11} /> CT Assigned
          </span>
        )}
      </div>

      {isOpen && (
        <div className="border-t border-gray-100">
          {/* CLASS TEACHER block */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Class Teacher</p>
            {isLocked ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                  <Lock size={14} className="text-green-600 shrink-0" />
                  <span className="text-sm font-semibold text-green-800">{ctTeacherName}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (ctAssignment) onCTEditRequest(ctAssignment.id, ctTeacherName ?? "");
                  }}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors shrink-0"
                >
                  <Edit2 size={12} /> Edit Class Teacher
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <select
                    value={selectedCT}
                    onChange={(e) => setSelectedCT(e.target.value ? Number(e.target.value) : "")}
                    disabled={savingCT}
                    className={`flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:bg-white disabled:opacity-60 ${
                      ctValidationError 
                        ? "border-red-400 bg-red-50 focus:border-red-500" 
                        : "border-gray-200 bg-gray-50 focus:border-[var(--brand)]"
                    }`}
                  >
                    <option value="">Select Teacher</option>
                    {teacherOptions.map((t) => (
                      <option key={t.id} value={t.id} disabled={t.isAssigned}>
                        {t.full_name}
                        {t.periods_per_week !== undefined ? ` (${t.periods_per_week}p)` : ""}
                        {t.isAssigned ? ` - Already CT: ${t.assignedTo}` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => { if (selectedCT && !ctValidationError) onCTConfirmLock(section.id, selectedCT as number); }}
                    disabled={!selectedCT || savingCT || !!ctValidationError}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
                  >
                    {savingCT
                      ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block" />
                      : <CheckCircle size={15} />}
                    Confirm &amp; Lock
                  </button>
                </div>
                {ctValidationError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{ctValidationError}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SUBJECT TEACHERS block */}
          <div className="px-4 pt-3 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Subject Teachers
                {subjectRows.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-bold bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">
                    {subjectRows.length}
                  </span>
                )}
              </p>
            </div>
            {subjectRows.length === 0 ? (
              <p className="text-sm text-gray-400 py-2 text-center">
                No subjects configured. Set up subjects in Foundation first.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="pb-1.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide w-[148px]">Subject</th>
                      <th className="pb-1.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">Teacher</th>
                      <th className="pb-1.5 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wide w-[90px]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectRows.map((row, idx) => (
                      <SubjectTeacherRow
                        key={row.id}
                        row={row}
                        subjectName={row.subject_name || `Subject ${row.subject_id}`}
                        colorClass={SUBJECT_PILL_COLORS[idx % SUBJECT_PILL_COLORS.length]}
                        teachers={teachers}
                        onSave={onSubjectSave}
                        saving={savingSubjKeys.has(row.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Class Accordion ──────────────────────────────────────────────────────────

function ClassAccordion({
  cls, colorClass, sections, teachers, subjectRows, ctAssignments,
  onCTConfirmLock, onCTEditRequest, onSubjectSave, savingCTSects, savingSubjKeys,
}: {
  cls: SchoolClass; colorClass: string;
  sections: Section[]; teachers: Teacher[];
  subjectRows: SubjectRow[];
  ctAssignments: CTAssignment[];
  onCTConfirmLock: (sectionId: number, teacherId: number) => Promise<void>;
  onCTEditRequest: (ctId: number, name: string) => void;
  onSubjectSave: (rowId: number, teacherId: number) => Promise<void>;
  savingCTSects: Set<number>; savingSubjKeys: Set<number>;
}) {
  const [open, setOpen] = useState(false);
  const [openSectionId, setOpenSectionId] = useState<number | null>(null);
  const classSections = sections.filter((s) => s.school_class === cls.id);
  const confirmedCT = ctAssignments.filter((ct) => ct.is_locked).length;
  const classSubjects = new Set(subjectRows.map((r) => r.subject_id)).size;

  return (
    <div className="bg-white border border-[var(--line)] rounded-2xl overflow-hidden shadow-sm mb-3">
      {/* Accordion header */}
      <button
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`shrink-0 px-2.5 py-0.5 rounded-md text-xs font-bold ${colorClass}`}>{cls.name}</span>
        <span className="text-sm text-gray-500">
          {classSections.length} section{classSections.length !== 1 ? "s" : ""}
          {" · "}
          {confirmedCT}/{classSections.length} CT confirmed
          {" · "}
          {classSubjects} subject{classSubjects !== 1 ? "s" : ""}
        </span>
        <span className="flex-1" />
        <span className="text-gray-400">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3">
          {classSections.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">
              No sections configured for {cls.name}. Add sections in Core Setup.
            </p>
          ) : (
            classSections.map((sec) => {
              // Include section-specific rows AND class-level (section_id=null) rows,
              // deduplicating by subject_id so section-specific takes priority.
              const sectionSpecific = subjectRows.filter((r) => r.section_id === sec.id);
              const classLevel = subjectRows.filter((r) => r.section_id === null);
              const seenSubjects = new Set(sectionSpecific.map((r) => r.subject_id));
              const merged = [
                ...sectionSpecific,
                ...classLevel.filter((r) => !seenSubjects.has(r.subject_id)),
              ];
              const ct = ctAssignments.find((c) => c.section_id === sec.id);
              return (
                <SectionCard
                  key={sec.id}
                  section={sec}
                  teachers={teachers}
                  subjectRows={merged}
                  ctAssignment={ct}
                  ctAssignments={ctAssignments}
                  onCTConfirmLock={onCTConfirmLock}
                  onCTEditRequest={onCTEditRequest}
                  onSubjectSave={onSubjectSave}
                  savingSubjKeys={savingSubjKeys}
                  savingCT={savingCTSects.has(sec.id)}
                  isOpen={openSectionId === sec.id}
                  onToggle={() => setOpenSectionId(openSectionId === sec.id ? null : sec.id)}
                  schoolClass={cls}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Workload Tab ─────────────────────────────────────────────────────────────

function WorkloadTab({ academicYearId }: { academicYearId: number | null }) {
  const [data, setData] = useState<WorkloadEntry[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!academicYearId) return;
    setLoading(true);
    apiFetch<WorkloadEntry[]>(`/api/v1/academics/staff/workload/?academic_year_id=${academicYearId}`)
      .then((r) => setData(Array.isArray(r) ? r : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [academicYearId]);

  const barColor = (s: WorkloadEntry["status"]) =>
    s === "overloaded" ? "bg-red-500" : s === "near-limit" ? "bg-amber-400" : "bg-green-500";

  if (loading) return <div className="py-16 text-center text-gray-400 text-sm">Loading workload data…</div>;
  if (!data.length) return <div className="py-16 text-center text-gray-400 text-sm">No workload data. Assign timetable periods first.</div>;
  return (
    <div className="bg-white border border-[var(--line)] rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Teacher", "Subjects", "Sections", "Periods / Week", "Load", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.teacher_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-semibold text-gray-800">{row.teacher_name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{row.subjects_count}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{row.sections_count}</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-800">{row.periods_per_week} / {row.max_periods}</td>
                <td className="px-4 py-3 min-w-[140px]">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor(row.status)}`} style={{ width: `${Math.min(row.load_pct, 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-right">{row.load_pct}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {row.status === "overloaded"
                    ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Overloaded</span>
                    : row.status === "near-limit"
                    ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Near Limit</span>
                    : <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Normal</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────────

function AuditLogTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    apiFetch<AuditLog[]>("/api/v1/academics/staff/audit-log/")
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-16 text-center text-gray-400 text-sm">Loading audit log…</div>;
  if (!logs.length) return <div className="py-16 text-center text-gray-400 text-sm">No audit records yet. CT changes will appear here.</div>;
  return (
    <div className="bg-white border border-[var(--line)] rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              {["Class / Section", "Old Teacher", "New Teacher", "Reason", "Changed By", "Date"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-semibold text-gray-800">{log.class_name} — {log.section_name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{log.old_teacher_name}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{log.new_teacher_name}</td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{log.reason}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{log.changed_by_name}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{new Date(log.changed_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function StaffAssignmentPanels() {
  const { toasts, show: showToast, remove: removeToast } = useToasts();

  const [activeTab, setActiveTab] = useState<"assignments" | "workload" | "audit">("assignments");
  const [levelFilter, setLevelFilter] = useState("All");

  // Data
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjectRows, setSubjectRows] = useState<SubjectRow[]>([]);
  const [ctAssignments, setCtAssignments] = useState<CTAssignment[]>([]);
  const [kpi, setKpi] = useState<KPI | null>(null);

  // Loading / saving
  const [loadingInit, setLoadingInit] = useState(true);
  const [savingCTSects, setSavingCTSects] = useState<Set<number>>(new Set());
  const [savingSubjKeys, setSavingSubjKeys] = useState<Set<number>>(new Set());
  const [ctModal, setCtModal] = useState<{ open: boolean; ctId: number | null; name: string }>({ open: false, ctId: null, name: "" });
  const [savingCTModal, setSavingCTModal] = useState(false);
  const [bulkModal, setBulkModal] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchCT = useCallback(async (yearId: number) => {
    try {
      const res = await apiFetch<CTAssignment[]>(`/api/v1/academics/staff/class-teachers/?academic_year_id=${yearId}`);
      setCtAssignments(Array.isArray(res) ? res : (res as { results?: CTAssignment[] }).results ?? []);
    } catch {
      showToast("Failed to load class teacher assignments.", "error");
    }
  }, [showToast]);

  const fetchSubjectRows = useCallback(async (yearId: number) => {
    try {
      // Staff endpoint: returns subject_name + handles class-level (section_id=null) rows
      const rows = await apiFetch<SubjectRow[]>(
        `/api/v1/academics/staff/subject-assignments/?academic_year_id=${yearId}`
      );
      setSubjectRows(Array.isArray(rows) ? rows : []);
    } catch {
      showToast("Failed to load subject assignments. Please retry.", "error");
    }
  }, [showToast]);

  const fetchKpi = useCallback(async (yearId: number) => {
    try {
      const res = await apiFetch<KPI>(`/api/v1/academics/staff/kpi/?academic_year_id=${yearId}`);
      setKpi(res);
    } catch {
      showToast("Failed to load assignment summary.", "error");
    }
  }, [showToast]);

  useEffect(() => {
    (async () => {
      try {
        const [yrs, cls, secs, techs] = await Promise.all([
          fetchAll<AcademicYear>("/api/v1/core/academic-years/?page_size=50"),
          fetchAll<SchoolClass>("/api/v1/core/classes/?page_size=100"),
          fetchAll<Section>("/api/v1/core/sections/?page_size=500"),
          apiFetch<Teacher[]>("/api/v1/academics/staff/teachers/")
            .then((r) => Array.isArray(r) ? r : (r as { results?: Teacher[] }).results ?? []),
        ]);
        setAcademicYears(yrs);
        setClasses(cls.sort((a, b) => (a.numeric_order ?? 0) - (b.numeric_order ?? 0)));
        setSections(secs);
        setTeachers(techs);

        const cur = yrs.find((y) => y.is_current) ?? yrs[0];
        if (cur) {
          setSelectedYearId(cur.id);
          await Promise.all([fetchCT(cur.id), fetchSubjectRows(cur.id), fetchKpi(cur.id)]);
        }
      } catch {
        showToast("Failed to load data. Please refresh.", "error");
      } finally {
        setLoadingInit(false);
      }
    })();
  }, [fetchCT, fetchSubjectRows, fetchKpi, showToast]);

  const onYearChange = async (yearId: number) => {
    setSelectedYearId(yearId);
    await Promise.all([fetchCT(yearId), fetchSubjectRows(yearId), fetchKpi(yearId)]);
  };

  // ── CT Confirm & Lock ─────────────────────────────────────────────────────

  const handleCTConfirmLock = useCallback(async (sectionId: number, teacherId: number) => {
    if (!selectedYearId) return;
    setSavingCTSects((s) => new Set(s).add(sectionId));
    try {
      const cls = sections.find((s) => s.id === sectionId)?.school_class;
      const res = await apiFetch<{ success: boolean; data?: { id: number }; message?: string }>(
        "/api/v1/academics/staff/class-teachers/",
        { method: "POST", body: JSON.stringify({ section_id: sectionId, teacher_id: teacherId, class_id: cls, academic_year_id: selectedYearId }) }
      );
      if (!res.success) { showToast(res.message ?? "Failed to assign.", "error"); return; }
      const ctId = res.data?.id;
      if (ctId) await apiFetch(`/api/v1/academics/staff/class-teachers/${ctId}/lock/`, { method: "POST" });
      showToast("Class teacher confirmed and locked.", "success");
      await Promise.all([fetchCT(selectedYearId), fetchKpi(selectedYearId)]);
    } catch (err: unknown) {
      showToast((err as { message?: string })?.message ?? "Failed to save.", "error");
    } finally {
      setSavingCTSects((s) => { const n = new Set(s); n.delete(sectionId); return n; });
    }
  }, [selectedYearId, sections, fetchCT, fetchKpi, showToast]);

  // ── CT Edit modal ─────────────────────────────────────────────────────────

  const handleCTEditRequest = useCallback((ctId: number, name: string) => {
    setCtModal({ open: true, ctId, name });
  }, []);

  const handleCTModalConfirm = useCallback(async (newTeacherId: number, reason: string) => {
    if (!ctModal.ctId || !selectedYearId) return;
    setSavingCTModal(true);
    try {
      const res = await apiFetch<{ success: boolean; message?: string }>(
        `/api/v1/academics/staff/class-teachers/${ctModal.ctId}/unlock/`,
        { method: "POST", body: JSON.stringify({ new_teacher_id: newTeacherId, reason }) }
      );
      if (!res.success) { showToast(res.message ?? "Failed.", "error"); return; }
      await apiFetch(`/api/v1/academics/staff/class-teachers/${ctModal.ctId}/lock/`, { method: "POST" });
      showToast("Class teacher updated and locked.", "success");
      setCtModal({ open: false, ctId: null, name: "" });
      await Promise.all([fetchCT(selectedYearId), fetchKpi(selectedYearId)]);
    } catch (err: unknown) {
      showToast((err as { message?: string })?.message ?? "Failed.", "error");
    } finally {
      setSavingCTModal(false);
    }
  }, [ctModal.ctId, selectedYearId, fetchCT, fetchKpi, showToast]);

  // ── Subject teacher save ──────────────────────────────────────────────────

  const handleSubjectSave = useCallback(async (rowId: number, teacherId: number) => {
    setSavingSubjKeys((s) => new Set(s).add(rowId));
    try {
      // Use staff/subject-assignments endpoint — no section validation required
      const res = await apiFetch<{ success: boolean; message?: string }>(
        `/api/v1/academics/staff/subject-assignments/${rowId}/`,
        { method: "PATCH", body: JSON.stringify({ teacher_id: teacherId }) }
      );
      if (res && !res.success) {
        showToast(res.message ?? "Failed to save.", "error");
        return;
      }
      showToast("Subject teacher saved.", "success");
      if (selectedYearId) await fetchSubjectRows(selectedYearId);
    } catch (err: unknown) {
      showToast((err as { message?: string })?.message ?? "Failed to save.", "error");
    } finally {
      setSavingSubjKeys((s) => { const n = new Set(s); n.delete(rowId); return n; });
    }
  }, [selectedYearId, fetchSubjectRows, showToast]);

  // ── Bulk assign ───────────────────────────────────────────────────────────

  const handleBulkAssign = useCallback(async (classId: number, sectionId: number | null, teacherId: number, bulkClass: boolean) => {
    if (!selectedYearId) return;
    setSavingBulk(true);
    try {
      const targets = bulkClass
        ? sections.filter((s) => s.school_class === classId)
        : sections.filter((s) => s.id === sectionId);
      for (const sec of targets) {
        await apiFetch<{ success: boolean }>("/api/v1/academics/staff/class-teachers/", {
          method: "POST",
          body: JSON.stringify({ section_id: sec.id, teacher_id: teacherId, class_id: classId, academic_year_id: selectedYearId }),
        });
      }
      showToast(`Class teacher assigned to ${targets.length} section(s).`, "success");
      setBulkModal(false);
      await Promise.all([fetchCT(selectedYearId), fetchKpi(selectedYearId)]);
    } catch (err: unknown) {
      showToast((err as { message?: string })?.message ?? "Bulk assignment failed.", "error");
    } finally {
      setSavingBulk(false);
    }
  }, [selectedYearId, sections, fetchCT, fetchKpi, showToast]);

  // ── Filter classes ────────────────────────────────────────────────────────

  const filteredClasses = levelFilter === "All"
    ? classes
    : classes.filter((c) => classLevel(c.name) === levelFilter);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[var(--brand)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2 mt-1">
        <div>
          <div className="text-[11px] font-bold text-[#6F767E] tracking-[0.05em] uppercase mb-1">
            STAFF RECORDS
          </div>
          <h1 className="m-0 flex items-baseline gap-2" style={{ fontSize: 36 }}>
            <span style={{ fontFamily: 'Georgia, serif', fontWeight: 900, color: '#1A1D1F' }}>Staff</span>
            <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic', fontWeight: 500, color: '#5B4FCF' }}>Assignment</span>
          </h1>
          <p className="mt-1.5 text-[13px] text-[#6F767E]">
            Assign class teachers and subject teachers to every section
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {academicYears.length > 0 && (
            <select
              value={selectedYearId ?? ""}
              onChange={(e) => onYearChange(Number(e.target.value))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)] bg-white"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (Current)" : ""}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setBulkModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--brand)] text-white text-sm font-semibold hover:bg-[var(--strong)] transition-colors"
          >
            <Zap size={14} /> Bulk Assign
          </button>
          <button
            onClick={() => selectedYearId && Promise.all([fetchCT(selectedYearId), fetchSubjectRows(selectedYearId), fetchKpi(selectedYearId)])}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <KpiCards kpi={kpi} />

      {/* Tab strip */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["assignments", "workload", "audit"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab ? "bg-white text-[var(--brand)] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "assignments" ? "Class Assignments" : tab === "workload" ? "Workload" : "Audit Log"}
          </button>
        ))}
      </div>

      {/* ── Assignments tab ── */}
      {activeTab === "assignments" && (
        <>
          {/* Level filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {["All", "Pre-Primary", "Primary", "Middle", "Secondary", "Senior Secondary"].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  levelFilter === lvl
                    ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[var(--brand)] hover:text-[var(--brand)]"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Class accordions */}
          {filteredClasses.length === 0 ? (
            <div className="bg-white border border-[var(--line)] rounded-2xl p-10 text-center text-gray-400 text-sm">
              No classes found. Configure classes in Core Setup first.
            </div>
          ) : (
            filteredClasses.map((cls, idx) => {
              const clsRows = subjectRows.filter((r) => r.class_id === cls.id);
              const clsCTs = ctAssignments.filter((ct) => ct.class_id === cls.id);
              return (
                <ClassAccordion
                  key={cls.id}
                  cls={cls}
                  colorClass={CLASS_BADGE_COLORS[idx % CLASS_BADGE_COLORS.length]}
                  sections={sections}
                  teachers={teachers}
                  subjectRows={clsRows}
                  ctAssignments={clsCTs}
                  onCTConfirmLock={handleCTConfirmLock}
                  onCTEditRequest={handleCTEditRequest}
                  onSubjectSave={handleSubjectSave}
                  savingCTSects={savingCTSects}
                  savingSubjKeys={savingSubjKeys}
                />
              );
            })
          )}
        </>
      )}

      {/* ── Workload tab ── */}
      {activeTab === "workload" && <WorkloadTab academicYearId={selectedYearId} />}

      {/* ── Audit log tab ── */}
      {activeTab === "audit" && <AuditLogTab />}

      {/* CT change modal */}
      <CTChangeModal
        isOpen={ctModal.open}
        currentTeacherName={ctModal.name}
        teachers={teachers}
        saving={savingCTModal}
        onConfirm={handleCTModalConfirm}
        onCancel={() => setCtModal({ open: false, ctId: null, name: "" })}
      />

      {/* Bulk assign modal */}
      <BulkAssignModal
        isOpen={bulkModal}
        teachers={teachers}
        classes={classes}
        sections={sections}
        saving={savingBulk}
        onConfirm={handleBulkAssign}
        onCancel={() => setBulkModal(false)}
      />
    </div>
  );
}
