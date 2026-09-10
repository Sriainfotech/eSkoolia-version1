"use client";
/**
 * Examination › Schedule & Logistics — "every cycle" group: Timetable →
 * Admit Cards → Seat Plan. Wired to the real backend (apps/exams/views.py::
 * ExamCommandCenterAPIView/DetailAPIView for the timetable + conflict
 * detection, plus ExamPlanAdmitCard and ExamPlanSeatPlan for the other steps)
 * via hooks/useExamsApi.ts — replaces the earlier static mockup. Conflicts
 * surface the backend's real ExamRoutine.clean() message; there is no
 * "suggest a free room" engine, so resolution means editing the slot.
 * Palette from lib/examTheme.ts.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Calendar, Plus, AlertTriangle, CreditCard, Grid3x3, Check, X, Pencil, Trash2,
} from "lucide-react";
import { examTheme as T } from "@/lib/examTheme";
import {
  createExamRoutine,
  deleteExamRoutine,
  ExamsApiError,
  generateAdmitCard,
  generateSeatPlan,
  saveAdmitCardSetting,
  saveSeatPlanSetting,
  searchAdmitCard,
  searchSeatPlan,
  updateExamRoutine,
  useAdmitCardIndex,
  useAdmitCardSetting,
  useExamRoutines,
  useExamScheduleCriteria,
  useExamSetupSubjectsByClass,
  useSeatPlanIndex,
  useSeatPlanSetting,
} from "@/hooks/useExamsApi";
import type { AdmitCardSetting, ExamPlanStudentRecord, ExamRoutineRow, SeatPlanSetting } from "@/types/exams";

type StepId = 1 | 2 | 3;
const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: "Timetable" },
  { id: 2, label: "Admit Cards" },
  { id: 3, label: "Seat Plan" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(value: string) {
  return value ? value.slice(0, 5) : "";
}

interface RoutineConflict {
  routineId: number;
  type: "room" | "class" | "teacher";
  detail: string;
}

function detectConflicts(rows: ExamRoutineRow[]): RoutineConflict[] {
  const conflicts: RoutineConflict[] = [];
  const overlaps = (a: ExamRoutineRow, b: ExamRoutineRow) => a.start_time < b.end_time && b.start_time < a.end_time;
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      if (!overlaps(a, b)) continue;
      if (a.room && a.room.toUpperCase() === b.room.toUpperCase()) {
        conflicts.push({ routineId: a.id, type: "room", detail: `Room ${a.room} double-booked: ${a.class_name} ${a.subject} and ${b.class_name} ${b.subject} at ${formatTime(a.start_time)}` });
      }
      if (a.class_id === b.class_id && (a.section_id ?? null) === (b.section_id ?? null)) {
        conflicts.push({ routineId: a.id, type: "class", detail: `${a.class_name}-${a.section || "All"} double-booked: ${a.subject} and ${b.subject} overlap at ${formatTime(a.start_time)}` });
      }
      if (a.teacher_id && a.teacher_id === b.teacher_id) {
        conflicts.push({ routineId: a.id, type: "teacher", detail: `${a.teacher} is assigned to two rooms at ${formatTime(a.start_time)}: ${a.room} and ${b.room}` });
      }
    }
  }
  return conflicts;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.ink2 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.purple, display: "inline-block" }} />
      {children}
    </div>
  );
}

function Chip({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button" onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
        borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        border: `1px solid ${checked ? T.purple : T.borderStrong}`,
        background: checked ? T.purpleSoft : "#fff",
        color: checked ? T.purple : T.ink2,
      }}
    >
      <span style={{
        width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${checked ? T.purple : T.borderStrong}`,
        background: checked ? T.purple : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {checked && <Check size={10} color="#fff" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

const selectSx: React.CSSProperties = {
  height: 36, borderRadius: 8, border: `1px solid ${T.borderStrong}`,
  padding: "0 10px", fontSize: 12.5, color: T.ink1, background: "#fff", outline: "none",
};

export default function ScheduleLogisticsPage() {
  const [step, setStep] = useState<StepId>(1);

  const { data: criteria } = useExamScheduleCriteria();
  const [examTypeId, setExamTypeId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());

  useEffect(() => {
    if (!criteria) return;
    if (examTypeId === null && criteria.exam_types.length) setExamTypeId(criteria.exam_types[0].id);
    if (classId === null && criteria.classes.length) setClassId(criteria.classes[0].id);
  }, [criteria, examTypeId, classId]);

  const sectionsForClass = useMemo(() => (criteria?.sections ?? []).filter((s) => s.class_id === classId), [criteria, classId]);
  useEffect(() => {
    if (!sectionsForClass.length) { setSectionId(null); return; }
    if (!sectionsForClass.some((s) => s.id === sectionId)) setSectionId(sectionsForClass[0].id);
  }, [sectionsForClass, sectionId]);

  const { data: routines, loading: routinesLoading, refetch: refetchRoutines } = useExamRoutines({
    date, exam_type_id: examTypeId ?? undefined,
  });
  const rows = useMemo(() => routines ?? [], [routines]);
  const conflicts = useMemo(() => detectConflicts(rows), [rows]);
  const conflictedIds = new Set(conflicts.map((c) => c.routineId));

  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ExamRoutineRow | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formClassId, setFormClassId] = useState<number | null>(null);
  const [formSectionId, setFormSectionId] = useState<number | null>(null);
  const [formSubjectId, setFormSubjectId] = useState<number | null>(null);
  const [formTeacherId, setFormTeacherId] = useState<number | null>(null);
  const [formRoomId, setFormRoomId] = useState<number | null>(null);
  const [formStart, setFormStart] = useState("09:00");
  const [formEnd, setFormEnd] = useState("11:00");
  const { data: formSubjects } = useExamSetupSubjectsByClass(formClassId);
  const formSections = useMemo(() => (criteria?.sections ?? []).filter((s) => s.class_id === formClassId), [criteria, formClassId]);

  const openNewSlot = () => {
    setEditingRow(null);
    setFormClassId(classId);
    setFormSectionId(sectionId);
    setFormSubjectId(null);
    setFormTeacherId(null);
    setFormRoomId(null);
    setFormStart("09:00");
    setFormEnd("11:00");
    setSaveError(null);
    setFormOpen(true);
  };

  const openEditSlot = (row: ExamRoutineRow) => {
    setEditingRow(row);
    setFormClassId(row.class_id);
    setFormSectionId(row.section_id);
    setFormSubjectId(row.subject_id);
    setFormTeacherId(row.teacher_id);
    setFormRoomId(row.room_id);
    setFormStart(formatTime(row.start_time));
    setFormEnd(formatTime(row.end_time));
    setSaveError(null);
    setFormOpen(true);
  };

  const handleSaveSlot = async () => {
    if (!examTypeId || !formClassId || !formSubjectId) {
      setSaveError("Class and subject are required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        exam_type_id: examTypeId,
        class_id: formClassId,
        section_id: formSectionId,
        subject: formSubjectId,
        teacher_id: formTeacherId,
        room_id: formRoomId,
        exam_date: date,
        start_time: `${formStart}:00`,
        end_time: `${formEnd}:00`,
      };
      if (editingRow) {
        await updateExamRoutine(editingRow.id, payload);
      } else {
        await createExamRoutine(payload);
      }
      setFormOpen(false);
      await refetchRoutines();
    } catch (e) {
      setSaveError(e instanceof ExamsApiError ? e.message : "Failed to save this slot — check for a scheduling conflict.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async (row: ExamRoutineRow) => {
    await deleteExamRoutine(row.id);
    await refetchRoutines();
  };

  // ─── Admit cards ──────────────────────────────────────────────────────────
  const { data: admitSettingData, refetch: refetchAdmitSetting } = useAdmitCardSetting();
  const { data: admitIndex } = useAdmitCardIndex();
  const [admitRecords, setAdmitRecords] = useState<ExamPlanStudentRecord[]>([]);
  const [admitGenerated, setAdmitGenerated] = useState<Set<number>>(new Set());
  const [admitLoading, setAdmitLoading] = useState(false);
  const [admitGenerating, setAdmitGenerating] = useState(false);

  useEffect(() => {
    if (step !== 2 || !examTypeId || !classId || !sectionId) return;
    setAdmitLoading(true);
    searchAdmitCard({ exam: examTypeId, class_id: classId, section: sectionId })
      .then((res) => { setAdmitRecords(res.records); setAdmitGenerated(new Set(res.old_admit_ids)); })
      .catch(() => { setAdmitRecords([]); setAdmitGenerated(new Set()); })
      .finally(() => setAdmitLoading(false));
  }, [step, examTypeId, classId, sectionId]);

  const toggleAdmitField = async (patch: Partial<AdmitCardSetting>) => {
    await saveAdmitCardSetting(patch);
    await refetchAdmitSetting();
  };

  const handleGenerateAdmit = async () => {
    if (!examTypeId || !admitRecords.length) return;
    setAdmitGenerating(true);
    try {
      const data: Record<string, { student_record_id: number }> = {};
      admitRecords.forEach((r) => { data[String(r.student_record_id)] = { student_record_id: r.student_record_id }; });
      await generateAdmitCard(examTypeId, data);
      setAdmitGenerated(new Set(admitRecords.map((r) => r.student_record_id)));
    } finally {
      setAdmitGenerating(false);
    }
  };

  // ─── Seat plan ────────────────────────────────────────────────────────────
  const { data: seatSettingData, refetch: refetchSeatSetting } = useSeatPlanSetting();
  useSeatPlanIndex();
  const [seatRecords, setSeatRecords] = useState<ExamPlanStudentRecord[]>([]);
  const [seatGenerated, setSeatGenerated] = useState<Set<number>>(new Set());
  const [seatLoading, setSeatLoading] = useState(false);
  const [seatGenerating, setSeatGenerating] = useState(false);

  useEffect(() => {
    if (step !== 3 || !examTypeId || !classId || !sectionId) return;
    setSeatLoading(true);
    searchSeatPlan({ exam: examTypeId, class_id: classId, section: sectionId })
      .then((res) => { setSeatRecords(res.records); setSeatGenerated(new Set(res.seat_plan_ids)); })
      .catch(() => { setSeatRecords([]); setSeatGenerated(new Set()); })
      .finally(() => setSeatLoading(false));
  }, [step, examTypeId, classId, sectionId]);

  const toggleSeatField = async (patch: Partial<SeatPlanSetting>) => {
    await saveSeatPlanSetting(patch);
    await refetchSeatSetting();
  };

  const handleGenerateSeat = async () => {
    if (!examTypeId || !seatRecords.length) return;
    setSeatGenerating(true);
    try {
      const data: Record<string, { student_record_id: number }> = {};
      seatRecords.forEach((r) => { data[String(r.student_record_id)] = { student_record_id: r.student_record_id }; });
      await generateSeatPlan(examTypeId, data);
      setSeatGenerated(new Set(seatRecords.map((r) => r.student_record_id)));
    } finally {
      setSeatGenerating(false);
    }
  };

  const examTypeTitle = criteria?.exam_types.find((e) => e.id === examTypeId)?.title ?? "";
  const className = criteria?.classes.find((c) => c.id === classId)?.class_name ?? "";
  const sectionName = criteria?.sections.find((s) => s.id === sectionId)?.section_name ?? "";
  const admitSetting = admitSettingData?.setting;
  const seatSetting = seatSettingData?.setting;

  return (
    <div style={{ minHeight: "100%", background: T.page, padding: "12px 20px 40px" }}>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24 }}>
        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 12 }}>
          <Link href="/dashboard" style={{ color: T.ink2, textDecoration: "none" }}>Dashboard</Link>
          <span style={{ color: T.ink3 }}>/</span>
          <Link href="/exams/command-center" style={{ color: T.ink2, textDecoration: "none" }}>Examinations</Link>
          <span style={{ color: T.ink3 }}>/</span>
          <span style={{ color: T.ink1, fontWeight: 600 }}>Schedule & Logistics</span>
        </nav>

        <Link
          href="/exams/command-center"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600,
            color: T.ink1, textDecoration: "none", border: `1px solid ${T.borderStrong}`,
            borderRadius: 8, padding: "6px 12px", background: "#fff", marginBottom: 16,
          }}
        >
          <ArrowLeft size={13} /> Back to Command Center
        </Link>

        {/* Hero */}
        <div style={{ marginBottom: 18 }}>
          <Eyebrow>Schedule & Logistics · {examTypeTitle || "Loading…"}</Eyebrow>
          <h1 style={{ margin: "6px 0 6px", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, fontSize: 30 }}>
            <span style={{ fontFamily: "Georgia, serif", fontWeight: 900, color: T.ink1 }}>The part that&apos;s</span>
            <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: "italic", fontWeight: 500, color: T.purple }}>
              different every time.
            </span>
          </h1>
          <p style={{ fontSize: 13, color: T.ink2, lineHeight: 1.6, maxWidth: 640, margin: "0 0 14px" }}>
            Dates, rooms and invigilators change every cycle even when the exam pattern doesn&apos;t.
            Admit cards and seating both build off this timetable.
          </p>

          <div style={{ display: "flex", gap: 8 }}>
            {STEPS.map((s) => {
              const done = s.id < step;
              const active = s.id === step;
              return (
                <button
                  key={s.id} type="button" onClick={() => setStep(s.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    height: 30, padding: "0 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer",
                    border: `1px solid ${active ? T.purple : done ? T.ok : T.borderStrong}`,
                    background: active ? T.purple : done ? T.okSoft : "#fff",
                    color: active ? "#fff" : done ? T.ok : T.ink3,
                  }}
                >
                  {done && <Check size={11} strokeWidth={3} />}
                  Step {s.id} · {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Shared exam/class/section/date picker */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          <select style={selectSx} value={examTypeId ?? ""} onChange={(e) => setExamTypeId(Number(e.target.value))}>
            {(criteria?.exam_types ?? []).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
          <select style={selectSx} value={classId ?? ""} onChange={(e) => setClassId(Number(e.target.value))}>
            {(criteria?.classes ?? []).map((o) => <option key={o.id} value={o.id}>{o.class_name}</option>)}
          </select>
          <select style={selectSx} value={sectionId ?? ""} onChange={(e) => setSectionId(Number(e.target.value))}>
            {sectionsForClass.map((o) => <option key={o.id} value={o.id}>{o.section_name}</option>)}
          </select>
          {step === 1 && (
            <input type="date" style={selectSx} value={date} onChange={(e) => setDate(e.target.value)} />
          )}
        </div>

        {step === 1 && (
          <>
            {conflicts.length > 0 && (
              <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: T.danger, marginBottom: 10 }}>
                  <AlertTriangle size={14} strokeWidth={2} /> {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} need attention
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {conflicts.map((c, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: T.dangerSoft }}>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: T.ink1 }}>{c.detail}</div>
                      <button
                        type="button"
                        onClick={() => { const row = rows.find((r) => r.id === c.routineId); if (row) openEditSlot(row); }}
                        style={{ height: 32, padding: "0 12px", borderRadius: 8, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                      >
                        Resolve
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: T.ink1 }}>
                <Calendar size={15} color={T.purple} /> {rows.length} exam{rows.length === 1 ? "" : "s"} on {date}
              </div>
              <button
                type="button" onClick={openNewSlot}
                style={{
                  display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 9,
                  border: `1px solid ${T.purple}`, background: T.purple, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                }}
              >
                <Plus size={13} /> Assign new slot
              </button>
            </div>

            {formOpen && (
              <div style={{ background: "#fff", border: `1px solid ${T.purple}55`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.ink1 }}>{editingRow ? "Edit slot" : "New slot"}</span>
                  <button type="button" onClick={() => setFormOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink3 }}><X size={16} /></button>
                </div>
                {saveError && <div style={{ background: T.dangerSoft, color: T.danger, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{saveError}</div>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
                  <select style={selectSx} value={formClassId ?? ""} onChange={(e) => { setFormClassId(Number(e.target.value)); setFormSubjectId(null); }}>
                    {(criteria?.classes ?? []).map((o) => <option key={o.id} value={o.id}>{o.class_name}</option>)}
                  </select>
                  <select style={selectSx} value={formSectionId ?? ""} onChange={(e) => setFormSectionId(Number(e.target.value) || null)}>
                    <option value="">All sections</option>
                    {formSections.map((o) => <option key={o.id} value={o.id}>{o.section_name}</option>)}
                  </select>
                  <select style={selectSx} value={formSubjectId ?? ""} onChange={(e) => setFormSubjectId(Number(e.target.value))}>
                    <option value="">Select subject</option>
                    {(formSubjects ?? []).map((o) => <option key={o.id} value={o.id}>{o.subject_name}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  <select style={selectSx} value={formTeacherId ?? ""} onChange={(e) => setFormTeacherId(Number(e.target.value) || null)}>
                    <option value="">No teacher</option>
                    {(criteria?.teachers ?? []).map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                  </select>
                  <select style={selectSx} value={formRoomId ?? ""} onChange={(e) => setFormRoomId(Number(e.target.value) || null)}>
                    <option value="">No room</option>
                    {(criteria?.rooms ?? []).map((o) => <option key={o.id} value={o.id}>{o.room_no}</option>)}
                  </select>
                  <input type="time" style={selectSx} value={formStart} onChange={(e) => setFormStart(e.target.value)} />
                  <input type="time" style={selectSx} value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <button
                    type="button" onClick={handleSaveSlot} disabled={saving}
                    style={{ height: 36, padding: "0 16px", borderRadius: 9, border: `1px solid ${T.purple}`, background: T.purple, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? "Saving…" : editingRow ? "Save changes" : "Create slot"}
                  </button>
                </div>
              </div>
            )}

            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 0.8fr 0.8fr 0.9fr 1fr 70px", gap: 8, padding: "10px 16px", fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${T.border}` }}>
                <span>Subject</span><span>Class</span><span>Room</span><span>Time</span><span>Invigilator</span><span />
              </div>
              {routinesLoading && <div style={{ padding: 16, fontSize: 12.5, color: T.ink3 }}>Loading…</div>}
              {!routinesLoading && rows.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: T.ink3 }}>No exams scheduled for this date yet.</div>}
              {rows.map((r) => {
                const isConflict = conflictedIds.has(r.id);
                return (
                  <div
                    key={r.id}
                    style={{
                      display: "grid", gridTemplateColumns: "1fr 0.8fr 0.8fr 0.9fr 1fr 70px", gap: 8,
                      padding: "12px 16px", fontSize: 12.5, color: T.ink1,
                      background: isConflict ? T.dangerSoft : "#fff",
                      borderBottom: `1px solid ${T.border}`, alignItems: "center",
                    }}
                  >
                    <span>{r.subject}</span>
                    <span>{r.class_name}-{r.section || "All"}</span>
                    <span style={{ color: isConflict ? T.danger : T.ink1, fontWeight: isConflict ? 700 : 400 }}>{r.room || "—"}</span>
                    <span>{formatTime(r.start_time)}–{formatTime(r.end_time)}</span>
                    <span style={{ color: isConflict ? T.danger : T.ink1, fontWeight: isConflict ? 700 : 400 }}>{r.teacher || "—"}</span>
                    <span style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => openEditSlot(r)} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink3, padding: 2, display: "flex" }}><Pencil size={13} /></button>
                      <button type="button" onClick={() => void handleDeleteSlot(r)} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink3, padding: 2, display: "flex" }}><Trash2 size={13} /></button>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: T.purpleSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CreditCard size={16} color={T.purple} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink1 }}>Admit Cards</div>
                <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>{className}-{sectionName} · {examTypeTitle}</div>
              </div>
            </div>

            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                Include on the card
              </div>
              {admitSetting && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  <Chip label="Student photo" checked={admitSetting.student_photo} onToggle={() => toggleAdmitField({ student_photo: !admitSetting.student_photo })} />
                  <Chip label="Student name" checked={admitSetting.student_name} onToggle={() => toggleAdmitField({ student_name: !admitSetting.student_name })} />
                  <Chip label="Admission no." checked={admitSetting.admission_no} onToggle={() => toggleAdmitField({ admission_no: !admitSetting.admission_no })} />
                  <Chip label="Class & section" checked={admitSetting.class_section} onToggle={() => toggleAdmitField({ class_section: !admitSetting.class_section })} />
                  <Chip label="Exam name" checked={admitSetting.exam_name} onToggle={() => toggleAdmitField({ exam_name: !admitSetting.exam_name })} />
                  <Chip label="Academic year label" checked={admitSetting.academic_year_label} onToggle={() => toggleAdmitField({ academic_year_label: !admitSetting.academic_year_label })} />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 8, fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", padding: "0 4px 8px" }}>
                <span>Student</span><span>Admission No.</span><span>Status</span>
              </div>
              {admitLoading && <div style={{ fontSize: 12.5, color: T.ink3, padding: "8px 4px" }}>Loading…</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {admitRecords.map((s) => {
                  const done = admitGenerated.has(s.student_record_id);
                  return (
                    <div key={s.student_record_id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 8, padding: "8px 4px", fontSize: 13, color: T.ink1, borderTop: `1px solid ${T.border}` }}>
                      <span>{s.first_name} {s.last_name}</span>
                      <span>{s.admission_no}</span>
                      <span>
                        {done
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: T.ok, background: T.okSoft, borderRadius: 999, padding: "3px 10px" }}>Already generated</span>
                          : <span style={{ fontSize: 12, color: T.ink3 }}>Not yet generated</span>}
                      </span>
                    </div>
                  );
                })}
                {!admitLoading && admitRecords.length === 0 && (
                  <div style={{ fontSize: 12.5, color: T.ink3, padding: "8px 4px" }}>No exam schedule found for this class/section yet.</div>
                )}
              </div>

              <button
                type="button" onClick={handleGenerateAdmit} disabled={admitGenerating || admitRecords.length === 0}
                style={{ marginTop: 16, height: 40, padding: "0 18px", borderRadius: 10, border: `1px solid ${T.ok}`, background: T.ok, color: "#fff", fontSize: 13, fontWeight: 700, cursor: admitGenerating ? "default" : "pointer", opacity: admitGenerating || admitRecords.length === 0 ? 0.7 : 1 }}
              >
                {admitGenerating ? "Generating…" : "Generate Admit Cards"}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: T.purpleSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Grid3x3 size={16} color={T.purple} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink1 }}>Seat Plan</div>
                <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>{className}-{sectionName} · {examTypeTitle}</div>
              </div>
            </div>

            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                Include on the seating chart
              </div>
              {seatSetting && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  <Chip label="School name" checked={seatSetting.school_name} onToggle={() => toggleSeatField({ school_name: !seatSetting.school_name })} />
                  <Chip label="Roll no." checked={seatSetting.roll_no} onToggle={() => toggleSeatField({ roll_no: !seatSetting.roll_no })} />
                  <Chip label="Student photo" checked={seatSetting.student_photo} onToggle={() => toggleSeatField({ student_photo: !seatSetting.student_photo })} />
                  <Chip label="Academic year label" checked={seatSetting.academic_year_label} onToggle={() => toggleSeatField({ academic_year_label: !seatSetting.academic_year_label })} />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 8, fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", padding: "0 4px 8px" }}>
                <span>Student</span><span>Roll No.</span><span>Status</span>
              </div>
              {seatLoading && <div style={{ fontSize: 12.5, color: T.ink3, padding: "8px 4px" }}>Loading…</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {seatRecords.map((s) => {
                  const done = seatGenerated.has(s.student_record_id);
                  return (
                    <div key={s.student_record_id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 8, padding: "8px 4px", fontSize: 13, color: T.ink1, borderTop: `1px solid ${T.border}` }}>
                      <span>{s.first_name} {s.last_name}</span>
                      <span>{s.roll_no}</span>
                      <span>
                        {done
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: T.ok, background: T.okSoft, borderRadius: 999, padding: "3px 10px" }}>Already generated</span>
                          : <span style={{ fontSize: 12, color: T.ink3 }}>Not yet generated</span>}
                      </span>
                    </div>
                  );
                })}
                {!seatLoading && seatRecords.length === 0 && (
                  <div style={{ fontSize: 12.5, color: T.ink3, padding: "8px 4px" }}>No exam schedule found for this class/section yet.</div>
                )}
              </div>

              <button
                type="button" onClick={handleGenerateSeat} disabled={seatGenerating || seatRecords.length === 0}
                style={{ marginTop: 16, height: 40, padding: "0 18px", borderRadius: 10, border: `1px solid ${T.ok}`, background: T.ok, color: "#fff", fontSize: 13, fontWeight: 700, cursor: seatGenerating ? "default" : "pointer", opacity: seatGenerating || seatRecords.length === 0 ? 0.7 : 1 }}
              >
                {seatGenerating ? "Generating…" : "Generate Seat Plan"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
