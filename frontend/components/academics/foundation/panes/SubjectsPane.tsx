"use client";
import { useState, useEffect, useCallback } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { SchoolClass, ClassSubjectEntry, ClassSubjectEntryType, Toast } from "../types";
import ConfirmDeleteDialog from "../ConfirmDeleteDialog";

/* ── Props ──────────────────────────────────────────────────── */
interface Props {
  classes:    SchoolClass[];
  showToast:  (msg: string, tone?: Toast["tone"]) => void;
  onBack:     () => void;
  onComplete: () => void;
}

/* ── Types ──────────────────────────────────────────────────── */
type SubjectType = ClassSubjectEntryType;

const TYPE_LABELS: Record<SubjectType, string> = {
  core:          "Core",
  co_curricular: "Co-curricular",
  optional:      "Optional",
};

const TYPE_CHIP: Record<SubjectType, string> = {
  core:          "bg-[#DBEAFE] text-[#1D4ED8]",
  co_curricular: "bg-[#D1FAE5] text-[#065F46]",
  optional:      "bg-[#EDE9FE] text-[#5B21B6]",
};

/* Code pill colours — deterministic hash from code string */
const PILL_PALETTE = [
  "bg-[#FEF3C7] text-[#92400E]",
  "bg-[#DBEAFE] text-[#1E40AF]",
  "bg-[#FCE7F3] text-[#9D174D]",
  "bg-[#D1FAE5] text-[#065F46]",
  "bg-[#EDE9FE] text-[#5B21B6]",
  "bg-[#FEE2E2] text-[#991B1B]",
  "bg-[#E0F2FE] text-[#0369A1]",
  "bg-[#FDF4FF] text-[#86198F]",
];

function pillColor(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) & 0xffff;
  return PILL_PALETTE[h % PILL_PALETTE.length];
}

/* Default subjects loaded when user clicks "Load Defaults" */
const DEF_SUBJECTS: { name: string; code: string; subject_type: SubjectType; periods_per_week: number }[] = [
  { name: "Mathematics",        code: "MATH", subject_type: "core",          periods_per_week: 5 },
  { name: "English",            code: "ENG",  subject_type: "core",          periods_per_week: 5 },
  { name: "Science",            code: "SCI",  subject_type: "core",          periods_per_week: 4 },
  { name: "Social Studies",     code: "SS",   subject_type: "core",          periods_per_week: 4 },
  { name: "Hindi",              code: "HIN",  subject_type: "core",          periods_per_week: 4 },
  { name: "Physical Education", code: "PE",   subject_type: "co_curricular", periods_per_week: 2 },
  { name: "Art and Craft",      code: "ART",  subject_type: "co_curricular", periods_per_week: 2 },
  { name: "Music",              code: "MUS",  subject_type: "co_curricular", periods_per_week: 1 },
  { name: "Computer Science",   code: "CS",   subject_type: "optional",      periods_per_week: 2 },
];

const API = "/api/v1/academics/class-subject-entries/";

/* ── Helpers ────────────────────────────────────────────────── */
function parseErr(e: unknown): string {
  try {
    const body = typeof (e as Error).message === "string" ? JSON.parse((e as Error).message) : e;
    if (body?.message) return body.message;
    const errs = body?.errors ?? body;
    if (typeof errs === "object" && errs !== null) {
      return Object.values(errs).flatMap((v) => (Array.isArray(v) ? v : [String(v)])).join(" ") || "Failed.";
    }
  } catch { /* noop */ }
  return "An unexpected error occurred.";
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function SubjectsPane({ classes, showToast, onBack, onComplete }: Props) {
  /* ── State ── */
  const [entries, setEntries]       = useState<ClassSubjectEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selCls, setSelCls]         = useState<number | null>(null);

  /* form */
  const [fname, setFname]           = useState("");
  const [fcode, setFcode]           = useState("");
  const [ftype, setFtype]           = useState<SubjectType>("core");
  const [alsoAdd, setAlsoAdd]       = useState<Set<number>>(new Set());
  const [formErr, setFormErr]       = useState("");

  /* actions */
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ClassSubjectEntry | null>(null);
  const [resetting, setResetting]   = useState(false);
  const [loadingDef, setLoadingDef] = useState(false);

  /* inline edit */
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName]   = useState("");
  const [editCode, setEditCode]   = useState("");
  const [editType, setEditType]   = useState<SubjectType>("core");
  const [editPeriods, setEditPeriods] = useState(5); // Fix #4H
  const [editSaving, setEditSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [globalSubjectNames, setGlobalSubjectNames] = useState<string[]>([]); // Fix #4E

  /* init: pick first class */
  useEffect(() => {
    if (classes.length > 0 && selCls === null) setSelCls(classes[0].id);
  }, [classes, selCls]);

  /* ── Fetch all entries once ── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Fix #4G — handle paginated response; request up to 1000 entries (backend _Pagination.max_page_size = 1000)
      const data = await apiRequestWithRefresh<{ results?: ClassSubjectEntry[] } | ClassSubjectEntry[]>(`${API}?page_size=1000`);
      setEntries(Array.isArray(data) ? data : (data.results ?? []));
    } catch (e) {
      showToast(parseErr(e), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  // Fix #4E — fetch global subjects catalog for name autocomplete (best-effort, non-blocking)
  useEffect(() => {
    void (async () => {
      try {
        const data = await apiRequestWithRefresh<{ results?: { name: string }[] } | { name: string }[]>("/api/v1/core/subjects/?page_size=200");
        const list = Array.isArray(data) ? data : (data.results ?? []);
        setGlobalSubjectNames(list.map((s) => s.name));
      } catch { /* ignore — datalist is best-effort */ }
    })();
  }, []);

  /* ── Derived ── */
  const countsByClass = entries.reduce<Record<number, number>>((acc, e) => {
    acc[e.school_class] = (acc[e.school_class] ?? 0) + 1;
    return acc;
  }, {});

  const classEntries = selCls !== null ? entries.filter((e) => e.school_class === selCls) : [];
  const totalEntries = entries.length;
  const selClass = classes.find((c) => c.id === selCls);

  /* ── "Also Add To" helpers ── */
  function toggleAlso(id: number) {
    setAlsoAdd((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function selectAllAlso() {
    setAlsoAdd(new Set(classes.filter((c) => c.id !== selCls).map((c) => c.id)));
  }
  function clearAlso() { setAlsoAdd(new Set()); }

  /* ── Add subject ── */
  async function handleAdd() {
    if (!fname.trim()) { setFormErr("Subject name is required."); return; }
    if (selCls === null) { setFormErr("Select a class first."); return; }
    setFormErr("");
    setSaving(true);
    const class_ids = [selCls, ...Array.from(alsoAdd)];
    try {
      const resp = await apiRequestWithRefresh<{
        success: boolean; created: number; skipped: number;
        data: ClassSubjectEntry[]; errors: { class_id: number; message: string }[];
      }>(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fname.trim(),
          code: fcode.trim().toUpperCase(),
          subject_type: ftype,
          class_ids,
        }),
      });

      if (resp.data?.length) {
        setEntries((prev) => [...prev, ...resp.data]);
      }

      const skippedMsgs = (resp.errors ?? []).map((err) => {
        const cls = classes.find((c) => c.id === err.class_id);
        return cls ? `${cls.name}: ${err.message}` : err.message;
      });

      if (resp.created > 0) {
        showToast(
          `Added "${fname.trim()}" to ${resp.created} class(es)${skippedMsgs.length ? ` (${skippedMsgs.length} skipped)` : ""}`,
          "success",
        );
      } else {
        showToast(skippedMsgs[0] ?? "Already assigned.", "error");
      }

      setFname(""); setFcode(""); setFtype("core"); setAlsoAdd(new Set());
    } catch (e) {
      showToast(parseErr(e), "error");
    } finally {
      setSaving(false);
    }
  }

  /* ── Delete single entry ── */
  async function handleDelete(entry: ClassSubjectEntry) {
    setPendingDelete(entry);
  }

  async function confirmDelete() {
    const entry = pendingDelete;
    if (!entry) return;
    setDeletingId(entry.id);
    try {
      await apiRequestWithRefresh(`${API}${entry.id}/`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      showToast("Subject removed.", "success");
      setPendingDelete(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/\b404\b|not[_ ]?found/i.test(msg)) {
        showToast("This subject no longer exists.", "error");
        setEntries((prev) => prev.filter((x) => x.id !== entry.id));
        setPendingDelete(null);
      } else {
        showToast(parseErr(e), "error");
      }
    } finally {
      setDeletingId(null);
    }
  }

  /* ── Start inline edit ── */
  function startEdit(entry: ClassSubjectEntry) {
    setEditingId(entry.id);
    setEditName(entry.name);
    setEditCode(entry.code);
    setEditType(entry.subject_type);
    setEditPeriods(entry.periods_per_week ?? 5); // Fix #4H
  }
  function cancelEdit() {
    setEditingId(null);
    setEditName(""); setEditCode(""); setEditType("core"); setEditPeriods(5); // Fix #4H
  }

  /* ── Save inline edit ── */
  async function handleSaveEdit(id: number) {
    if (!editName.trim()) { showToast("Subject name is required.", "error"); return; }
    setEditSaving(true);
    try {
      const updated = await apiRequestWithRefresh<ClassSubjectEntry>(`${API}${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim().toUpperCase(),
          subject_type: editType,
          periods_per_week: editPeriods, // Fix #4H
        }),
      });
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)));
      showToast("Subject updated.", "success");
      cancelEdit();
    } catch (e) {
      showToast(parseErr(e), "error");
    } finally {
      setEditSaving(false);
    }
  }

  /* ── Toggle active/inactive ── */
  async function handleToggleActive(entry: ClassSubjectEntry) {
    setTogglingId(entry.id);
    try {
      const updated = await apiRequestWithRefresh<ClassSubjectEntry>(`${API}${entry.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active_status: !entry.active_status }),
      });
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...updated } : e)));
      showToast(updated.active_status ? "Subject activated." : "Subject deactivated.", "success");
    } catch (e) {
      showToast(parseErr(e), "error");
    } finally {
      setTogglingId(null);
    }
  }

  /* ── Reset class ── */
  async function handleReset() {
    if (selCls === null) return;
    if (!confirm(`Remove all subjects from ${selClass?.name ?? "this class"}?`)) return;
    setResetting(true);
    try {
      await apiRequestWithRefresh(`${API}reset-class/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: selCls }),
      });
      setEntries((prev) => prev.filter((e) => e.school_class !== selCls));
      showToast(`All subjects removed from ${selClass?.name}.`, "success");
    } catch (e) {
      showToast(parseErr(e), "error");
    } finally {
      setResetting(false);
    }
  }

  /* ── Load defaults ── */
  async function handleLoadDefaults() {
    if (selCls === null) { showToast("Select a class first.", "error"); return; }
    setLoadingDef(true);
    let added = 0;
    for (const sub of DEF_SUBJECTS) {
      const already = entries.some((e) => e.school_class === selCls && e.code === sub.code);
      if (already) continue;
      try {
        const resp = await apiRequestWithRefresh<{ success: boolean; data: ClassSubjectEntry[] }>(
          API,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...sub, class_ids: [selCls] }),
          },
        );
        if (resp.data?.length) {
          setEntries((prev) => [...prev, ...resp.data]);
          added++;
        }
      } catch { /* skip already-existing */ }
    }
    showToast(
      added > 0 ? `${added} default subject(s) loaded.` : "All defaults already added.",
      added > 0 ? "success" : "error",
    );
    setLoadingDef(false);
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Top bar: class chips + actions ── */}
      <div className="bg-white rounded-xl border border-[#E8ECEF] shadow-[0_1px_4px_rgba(0,0,0,.08)] px-4 py-3 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold text-[#9FA6AD] tracking-widest mr-1 shrink-0">
          SELECT CLASS:
        </span>

        {classes.map((c) => {
          const cnt = countsByClass[c.id] ?? 0;
          const active = c.id === selCls;
          return (
            <button
              key={c.id}
              onClick={() => { setSelCls(c.id === selCls ? null : c.id); setAlsoAdd(new Set()); setFormErr(""); }}
              className={[
                "flex items-center gap-1 px-2.5 py-[4px] rounded-full text-[12px] font-semibold border transition-all",
                active
                  ? "bg-[#5B4FCF] text-white border-[#5B4FCF] shadow"
                  : "bg-white text-[#6F767E] border-[#E8ECEF] hover:border-[#5B4FCF] hover:text-[#5B4FCF]",
              ].join(" ")}
            >
              {c.name}
              {cnt > 0 && (
                <span
                  className={[
                    "text-[10px] font-bold px-1 rounded-full leading-[14px]",
                    active ? "bg-white/25 text-white" : "bg-[#5B4FCF]/10 text-[#5B4FCF]",
                  ].join(" ")}
                >
                  {cnt}
                </span>
              )}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            onClick={() => void handleLoadDefaults()}
            disabled={loadingDef || selCls === null}
            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-[#E8ECEF] text-[#6F767E] hover:border-[#5B4FCF] hover:text-[#5B4FCF] disabled:opacity-40 transition-all"
          >
            {loadingDef ? "Loading..." : "Load Defaults"}
          </button>

          <button
            onClick={onComplete}
            disabled={totalEntries === 0}
            className={[
              "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all",
              totalEntries > 0
                ? "bg-[#16A34A] text-white hover:bg-[#15803D] shadow"
                : "bg-[#E8ECEF] text-[#9FA6AD] cursor-not-allowed",
            ].join(" ")}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Complete Setup
          </button>
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── LEFT: Add Subject form ── */}
        <div className="w-[340px] shrink-0 bg-white rounded-xl border border-[#E8ECEF] shadow-[0_1px_4px_rgba(0,0,0,.08)] p-4 flex flex-col gap-3 overflow-y-auto">
          <div>
            <p className="text-[13px] font-bold text-[#1A1D1F]">
              Add Subject{selClass ? ` — ${selClass.name}` : ""}
            </p>
            {selClass && (
              <p className="text-[11px] text-[#9FA6AD] mt-0.5">
                Adds to {selClass.name}
                {alsoAdd.size > 0 && ` + ${alsoAdd.size} more class${alsoAdd.size > 1 ? "es" : ""}`}
              </p>
            )}
          </div>

          {formErr && (
            <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              {formErr}
            </p>
          )}

          {/* Subject Name */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#6F767E]">Subject Name *</label>
            <input
              value={fname}
              onChange={(e) => setFname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
              placeholder="e.g. Mathematics"
              list="global-subjects-list" // Fix #4E — autocomplete from global subjects catalog
              className="h-9 px-3 rounded-lg border border-[#E8ECEF] text-[13px] text-[#1A1D1F] focus:outline-none focus:border-[#5B4FCF] transition-colors"
            />
          </div>

          {/* Code */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#6F767E]">Code <span className="font-normal text-[#9FA6AD]">(optional)</span></label>
            <input
              value={fcode}
              onChange={(e) => setFcode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
              placeholder="e.g. MATH"
              maxLength={20}
              className="h-9 px-3 rounded-lg border border-[#E8ECEF] text-[13px] text-[#1A1D1F] focus:outline-none focus:border-[#5B4FCF] transition-colors"
            />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#6F767E]">Type</label>
            <select
              value={ftype}
              onChange={(e) => setFtype(e.target.value as SubjectType)}
              className="h-9 px-2 rounded-lg border border-[#E8ECEF] text-[13px] text-[#1A1D1F] focus:outline-none focus:border-[#5B4FCF] bg-white transition-colors"
            >
              <option value="core">Core</option>
              <option value="co_curricular">Co-curricular</option>
              <option value="optional">Optional</option>
            </select>
          </div>

          {/* Also Add To */}
          {classes.length > 1 && (
            <div className="flex flex-col gap-2 pt-1 border-t border-[#F4F4F4]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#9FA6AD] tracking-widest">ALSO ADD TO:</span>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllAlso}
                    className="text-[10px] text-[#5B4FCF] font-semibold hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-[#E8ECEF]">|</span>
                  <button
                    onClick={clearAlso}
                    className="text-[10px] text-[#9FA6AD] font-semibold hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {classes.map((c) => {
                  const isCurrent = c.id === selCls;
                  const checked   = alsoAdd.has(c.id);
                  return (
                    <button
                      key={c.id}
                      disabled={isCurrent}
                      onClick={() => toggleAlso(c.id)}
                      className={[
                        "px-2 py-[3px] rounded-full text-[11px] font-semibold border transition-all",
                        isCurrent
                          ? "bg-[#F4F4F4] text-[#C9CDD2] border-[#E8ECEF] cursor-not-allowed"
                          : checked
                          ? "bg-[#5B4FCF] text-white border-[#5B4FCF]"
                          : "bg-white text-[#6F767E] border-[#E8ECEF] hover:border-[#5B4FCF] hover:text-[#5B4FCF]",
                      ].join(" ")}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 mt-auto">
            <button
              onClick={onBack}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-[#E8ECEF] text-[12px] font-semibold text-[#6F767E] hover:border-[#5B4FCF] hover:text-[#5B4FCF] transition-all"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <button
              onClick={() => void handleAdd()}
              disabled={saving || selCls === null}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#5B4FCF] text-white text-[12px] font-semibold hover:bg-[#4A3FBF] disabled:opacity-50 transition-all"
            >
              {saving ? (
                "Adding..."
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                  </svg>
                  Add Subject
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── RIGHT: Subject Catalog ── */}
        <div className="flex-1 bg-white rounded-xl border border-[#E8ECEF] shadow-[0_1px_4px_rgba(0,0,0,.08)] p-4 flex flex-col gap-3 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-bold text-[#1A1D1F]">Subject Catalog</p>
              <p className="text-[11px] text-[#9FA6AD] mt-0.5">
                {loading
                  ? "Loading..."
                  : selClass
                  ? `${classEntries.length} subject${classEntries.length !== 1 ? "s" : ""} for ${selClass.name}`
                  : "Select a class"}
              </p>
            </div>

            {classEntries.length > 0 && (
              <button
                onClick={() => void handleReset()}
                disabled={resetting}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-[11px] font-semibold hover:bg-red-50 disabled:opacity-50 transition-all"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {resetting ? "Resetting..." : "Reset Class"}
              </button>
            )}
          </div>

          {/* List */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-[13px] text-[#9FA6AD]">
              Loading subjects...
            </div>
          ) : classEntries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-8">
              <div className="w-10 h-10 rounded-full bg-[#F0F2F5] flex items-center justify-center text-[#9FA6AD]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <p className="text-[13px] font-semibold text-[#6F767E]">
                {selClass ? `0 subjects for ${selClass.name} yet` : "Select a class to view subjects"}
              </p>
              <p className="text-[11px] text-[#9FA6AD]">Use the form on the left to add subjects.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {classEntries.map((entry) => {
                const isEditing = editingId === entry.id;
                const inactive  = !entry.active_status;

                if (isEditing) {
                  return (
                    <div
                      key={entry.id}
                      className="flex flex-col gap-2 px-3 py-2.5 rounded-lg border border-[#5B4FCF] bg-[#F5F4FF]"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Subject name"
                          className="flex-1 h-8 px-2 rounded-md border border-[#E8ECEF] bg-white text-[13px] text-[#1A1D1F] focus:outline-none focus:border-[#5B4FCF]"
                        />
                        <input
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                          placeholder="Code"
                          maxLength={20}
                          className="w-20 h-8 px-2 rounded-md border border-[#E8ECEF] bg-white text-[12px] text-[#1A1D1F] uppercase focus:outline-none focus:border-[#5B4FCF]"
                        />
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as SubjectType)}
                          className="h-8 px-2 rounded-md border border-[#E8ECEF] bg-white text-[12px] text-[#1A1D1F] focus:outline-none focus:border-[#5B4FCF]"
                        >
                          <option value="core">Core</option>
                          <option value="co_curricular">Co-curricular</option>
                          <option value="optional">Optional</option>
                        </select>
                        {/* Fix #4H — periods per week editable in inline edit */}
                        <input
                          type="number"
                          value={editPeriods}
                          min={1}
                          title="Periods per week"
                          onChange={(e) => setEditPeriods(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-14 h-8 px-2 rounded-md border border-[#E8ECEF] bg-white text-[12px] text-center focus:outline-none focus:border-[#5B4FCF]"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          disabled={editSaving}
                          className="px-3 py-1 rounded-md border border-[#E8ECEF] text-[11px] font-semibold text-[#6F767E] hover:border-[#9FA6AD] disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => void handleSaveEdit(entry.id)}
                          disabled={editSaving}
                          className="flex items-center gap-1 px-3 py-1 rounded-md bg-[#16A34A] text-white text-[11px] font-semibold hover:bg-[#15803D] disabled:opacity-50"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {editSaving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={entry.id}
                    className={[
                      "flex items-center gap-3 px-3 py-2 rounded-lg border border-[#F4F4F4] hover:border-[#E8ECEF] hover:bg-[#FAFAFA] group transition-all",
                      inactive ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    {/* Code pill */}
                    <span
                      className={[
                        "text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0",
                        pillColor(entry.code),
                      ].join(" ")}
                    >
                      {entry.code}
                    </span>

                    {/* Name + type */}
                    <div className="flex-1 min-w-0">
                      <p className={["text-[13px] font-semibold text-[#1A1D1F] truncate", inactive ? "line-through" : ""].join(" ")}>
                        {entry.name}
                      </p>
                      <p className="text-[11px] text-[#9FA6AD]">
                        <span
                          className={[
                            "inline-block px-1.5 py-px rounded text-[10px] font-semibold",
                            TYPE_CHIP[entry.subject_type] ?? "bg-[#F4F4F4] text-[#6F767E]",
                          ].join(" ")}
                        >
                          {TYPE_LABELS[entry.subject_type] ?? entry.subject_type}
                        </span>
                        {inactive && (
                          <span className="ml-1.5 inline-block px-1.5 py-px rounded text-[10px] font-semibold bg-[#FEE2E2] text-[#991B1B]">
                            Inactive
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Edit */}
                      <button
                        onClick={() => startEdit(entry)}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[#6F767E] hover:text-[#5B4FCF] hover:bg-[#F5F4FF] transition-all"
                        title="Edit subject"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>

                      {/* Toggle active/inactive */}
                      <button
                        onClick={() => void handleToggleActive(entry)}
                        disabled={togglingId === entry.id}
                        className={[
                          "w-7 h-7 flex items-center justify-center rounded-md transition-all disabled:opacity-50",
                          entry.active_status
                            ? "text-[#6F767E] hover:text-[#D97706] hover:bg-[#FEF3C7]"
                            : "text-[#16A34A] hover:bg-[#DCFCE7]",
                        ].join(" ")}
                        title={entry.active_status ? "Deactivate" : "Activate"}
                      >
                        {togglingId === entry.id ? (
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                        ) : entry.active_status ? (
                          /* minus = deactivate */
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                          </svg>
                        ) : (
                          /* plus = activate */
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                          </svg>
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => void handleDelete(entry)}
                        disabled={deletingId === entry.id}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[#9FA6AD] hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-all"
                        title="Remove subject"
                      >
                        {deletingId === entry.id ? (
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fix #4E — datalist for global subject name autocomplete */}
      <datalist id="global-subjects-list">
        {globalSubjectNames.map((n) => <option key={n} value={n} />)}
      </datalist>

      <ConfirmDeleteDialog
        open={!!pendingDelete}
        title="Remove Subject"
        message={
          <>
            Remove <strong>“{pendingDelete?.name}”</strong> from this class? Any teacher assignments
            and related links for this subject will also be removed.
          </>
        }
        confirmLabel="Remove"
        loading={deletingId === pendingDelete?.id}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
