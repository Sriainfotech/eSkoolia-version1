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
  ArrowLeft, Calendar, Plus, AlertTriangle, CreditCard, Grid3x3, Check, X, Pencil, Trash2, Search, Download, Laptop2,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { examTheme as T } from "@/lib/examTheme";
import {
  cancelPublishOnlineExam,
  createExamRoutine,
  createOnlineExam,
  deleteExamRoutine,
  deleteOnlineExam,
  ExamsApiError,
  generateAdmitCard,
  generateSeatPlan,
  publishOnlineExam,
  saveAdmitCardSetting,
  saveSeatPlanSetting,
  searchAdmitCard,
  searchSeatPlan,
  updateExamRoutine,
  updateOnlineExam,
  useAdmitCardIndex,
  useAdmitCardSetting,
  useExamRoutines,
  useExamScheduleCriteria,
  useExamSetupSubjectsByClass,
  useOnlineExamIndex,
  useSeatPlanIndex,
  useSeatPlanSetting,
} from "@/hooks/useExamsApi";
import type { AdmitCardSetting, ExamPlanStudentRecord, ExamRoutineRow, OnlineExamRow, SeatPlanSetting } from "@/types/exams";
import { useExamFocus } from "@/contexts/ExamFocusContext";

type StepId = 1 | 2 | 3 | 4;
const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: "Timetable" },
  { id: 2, label: "Admit Cards" },
  { id: 3, label: "Seat Plan" },
  { id: 4, label: "Online Exam Setup" },
];

function todayIso() {
  // toISOString() reads UTC, not the browser's local calendar day — east of UTC,
  // before local time catches up to UTC's date rollover, that silently returns
  // yesterday's date and the timetable opens on the wrong day. Build the local
  // date string by hand instead.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const { examTypeId, setExamTypeId, hydrated: examFocusHydrated } = useExamFocus();
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());

  useEffect(() => {
    if (!criteria || !examFocusHydrated) return;
    if (examTypeId === null && criteria.exam_types.length) setExamTypeId(criteria.exam_types[0].id);
    if (classId === null && criteria.classes.length) setClassId(criteria.classes[0].id);
  }, [criteria, examFocusHydrated, examTypeId, setExamTypeId, classId]);

  const sectionsForClass = useMemo(() => (criteria?.sections ?? []).filter((s) => s.class_id === classId), [criteria, classId]);
  useEffect(() => {
    if (!sectionsForClass.length) { setSectionId(null); return; }
    if (!sectionsForClass.some((s) => s.id === sectionId)) setSectionId(sectionsForClass[0].id);
  }, [sectionsForClass, sectionId]);

  const { data: routines, loading: routinesLoading, refetch: refetchRoutines } = useExamRoutines({
    date, exam_type_id: examTypeId ?? undefined,
  });
  const [routineSearch, setRoutineSearch] = useState("");
  // Separate from classId/sectionId above: those two seed the "new slot" /
  // Admit Card / Seat Plan defaults and always need one concrete class+section
  // (no "All" option makes sense there). The timetable itself should default to
  // showing the whole day, so it gets its own optional filter instead of reusing
  // that shared pair — that reuse is what made the shared pickers look like
  // timetable filters that silently did nothing.
  const [timetableClassFilter, setTimetableClassFilter] = useState<number | null>(null);
  const [timetableSectionFilter, setTimetableSectionFilter] = useState<number | null>(null);
  const timetableSectionOptions = useMemo(
    () => (criteria?.sections ?? []).filter((s) => s.class_id === timetableClassFilter),
    [criteria, timetableClassFilter],
  );
  useEffect(() => {
    if (timetableSectionFilter && !timetableSectionOptions.some((s) => s.id === timetableSectionFilter)) {
      setTimetableSectionFilter(null);
    }
  }, [timetableSectionOptions, timetableSectionFilter]);

  const allRows = useMemo(() => routines ?? [], [routines]);
  const rows = useMemo(() => {
    const q = routineSearch.trim().toLowerCase();
    return allRows.filter((r) => {
      if (timetableClassFilter && r.class_id !== timetableClassFilter) return false;
      if (timetableSectionFilter && r.section_id !== timetableSectionFilter) return false;
      if (!q) return true;
      return [r.subject, r.class_name, r.section, r.room, r.teacher].some((field) => (field || "").toLowerCase().includes(q));
    });
  }, [allRows, routineSearch, timetableClassFilter, timetableSectionFilter]);
  const conflicts = useMemo(() => detectConflicts(allRows), [allRows]);
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
  const [admitError, setAdmitError] = useState<string | null>(null);

  const [admitCustomizeOpen, setAdmitCustomizeOpen] = useState(false);
  const [admitCustomizeForm, setAdmitCustomizeForm] = useState({
    admit_sub_title: "",
    description: "",
    principal_signature: false,
    class_teacher_signature: false,
  });
  const [admitCustomizeSaving, setAdmitCustomizeSaving] = useState(false);

  const openAdmitCustomize = () => {
    if (admitSettingData?.setting) {
      setAdmitCustomizeForm({
        admit_sub_title: admitSettingData.setting.admit_sub_title || "",
        description: admitSettingData.setting.description || "",
        principal_signature: admitSettingData.setting.principal_signature || false,
        class_teacher_signature: admitSettingData.setting.class_teacher_signature || false,
      });
    }
    setAdmitCustomizeOpen(true);
  };

  const handleSaveAdmitCustomize = async () => {
    setAdmitCustomizeSaving(true);
    try {
      await saveAdmitCardSetting(admitCustomizeForm);
      await refetchAdmitSetting();
      setAdmitCustomizeOpen(false);
    } finally {
      setAdmitCustomizeSaving(false);
    }
  };

  useEffect(() => {
    if (step !== 2 || !examTypeId || !classId || !sectionId) return;
    if (!sectionsForClass.some((s) => s.id === sectionId)) return;
    let cancelled = false;
    setAdmitLoading(true);
    searchAdmitCard({ exam: examTypeId, class_id: classId, section: sectionId })
      .then((res) => {
        if (cancelled) return;
        setAdmitRecords(res?.records || []);
        setAdmitGenerated(new Set(res?.old_admit_ids || []));
        setAdmitError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("searchAdmitCard error", e);
        setAdmitRecords([]);
        setAdmitGenerated(new Set());
        setAdmitError(e instanceof ExamsApiError ? e.message : "Failed to load admit cards for this class/section.");
      })
      .finally(() => { if (!cancelled) setAdmitLoading(false); });
    return () => { cancelled = true; };
  }, [step, examTypeId, classId, sectionId, sectionsForClass]);

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

  const _drawAdmitCard = (doc: any, student: ExamPlanStudentRecord, cx: number) => {
    // Basic styling for a professional admit card
    doc.setDrawColor(0);
    doc.setLineWidth(1);
    doc.rect(10, 10, 190, 128); // Outer border

    // School Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("ESKOOLIA ACADEMY", cx, 22, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("123 Education Lane, Learning City", cx, 28, { align: "center" });

    doc.setLineWidth(0.5);
    doc.line(10, 34, 200, 34);

    const admitSetting = admitSettingData?.setting;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(admitSetting?.admit_sub_title || "ADMIT CARD", cx, 42, { align: "center" });

    // Details Section
    let y = 56;
    
    doc.setFontSize(11);

    if (admitSetting?.exam_name) {
      doc.setFont("helvetica", "bold");
      doc.text("Examination: ", 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(examTypeTitle || "N/A", 55, y);
      y += 8;
    }
    
    if (admitSetting?.student_name) {
      doc.setFont("helvetica", "bold");
      doc.text("Student Name: ", 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${student.first_name || ""} ${student.last_name || ""}`.trim() || "N/A", 55, y);
      y += 8;
    }
    
    if (admitSetting?.admission_no) {
      doc.setFont("helvetica", "bold");
      doc.text("Admission No: ", 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(student.admission_no || "N/A", 55, y);
      y += 8;
    }
    
    if (admitSetting?.class_section) {
      doc.setFont("helvetica", "bold");
      doc.text("Class/Section: ", 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${className}-${sectionName}`, 55, y);
      y += 8;
    }
    
    if (admitSetting?.academic_year_label) {
      doc.setFont("helvetica", "bold");
      doc.text("Academic Year: ", 20, y);
      doc.setFont("helvetica", "normal");
      doc.text("2026-2027", 55, y);
      y += 8;
    }
    
    if (admitSetting?.student_photo) {
      doc.rect(160, 42, 30, 35);
      doc.setFontSize(8);
      doc.text("Affix Photo", 175, 60, { align: "center" });
    }

    if (admitSetting?.description) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text(admitSetting.description, 20, 105, { maxWidth: 170 });
    }

    // Signatures
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    
    if (admitSetting?.principal_signature) {
      doc.line(20, 125, 60, 125);
      doc.text("Principal Signature", 40, 131, { align: "center" });
    }

    if (admitSetting?.class_teacher_signature) {
      doc.line(150, 125, 190, 125);
      doc.text("Class Teacher", 170, 131, { align: "center" });
    }
  };

  const downloadAdmitCard = (student: ExamPlanStudentRecord) => {
    const doc = new jsPDF({ format: "a5", orientation: "landscape" });
    const cx = doc.internal.pageSize.width / 2;
    _drawAdmitCard(doc, student, cx);
    doc.save(`Admit_Card_${student.admission_no}.pdf`);
  };

  const downloadAllAdmitCards = () => {
    const generatedStudents = admitRecords.filter(s => admitGenerated.has(s.student_record_id));
    if (generatedStudents.length === 0) return;
    
    const doc = new jsPDF({ format: "a5", orientation: "landscape" });
    const cx = doc.internal.pageSize.width / 2;
    
    generatedStudents.forEach((student, idx) => {
      if (idx > 0) doc.addPage();
      _drawAdmitCard(doc, student, cx);
    });
    
    doc.save(`All_Admit_Cards_${className}-${sectionName}.pdf`);
  };

  // ─── Seat plan ────────────────────────────────────────────────────────────
  const { data: seatSettingData, refetch: refetchSeatSetting } = useSeatPlanSetting();
  useSeatPlanIndex();
  const [seatRecords, setSeatRecords] = useState<ExamPlanStudentRecord[]>([]);
  const [seatGenerated, setSeatGenerated] = useState<Set<number>>(new Set());
  const [seatLoading, setSeatLoading] = useState(false);
  const [seatGenerating, setSeatGenerating] = useState(false);
  const [seatError, setSeatError] = useState<string | null>(null);

  useEffect(() => {
    if (step !== 3 || !examTypeId || !classId || !sectionId) return;
    if (!sectionsForClass.some((s) => s.id === sectionId)) return;
    let cancelled = false;
    setSeatLoading(true);
    searchSeatPlan({ exam: examTypeId, class_id: classId, section: sectionId })
      .then((res) => {
        if (cancelled) return;
        setSeatRecords(res.records);
        setSeatGenerated(new Set(res.seat_plan_ids));
        setSeatError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setSeatRecords([]);
        setSeatGenerated(new Set());
        setSeatError(e instanceof ExamsApiError ? e.message : "Failed to load seat plan for this class/section.");
      })
      .finally(() => { if (!cancelled) setSeatLoading(false); });
    return () => { cancelled = true; };
  }, [step, examTypeId, classId, sectionId, sectionsForClass]);

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

  // Printable seating list — same client-side PDF approach as the admit card
  // download above. The seat-plan API only tracks which students have a seat
  // plan generated, not an assigned room/seat number, so "Seat No." here is
  // the roll-sorted running order — an honest stand-in, not a fabricated field.
  const downloadSeatPlanPdf = () => {
    const doc = new jsPDF({ format: "a4", orientation: "portrait" });
    const cx = doc.internal.pageSize.width / 2;
    let y = 16;
    doc.setFont("helvetica", "bold");
    if (seatSetting?.school_name) {
      doc.setFontSize(16);
      doc.text("Eskoolia Academy", cx, y, { align: "center" });
      y += 8;
    }
    doc.setFontSize(13);
    doc.text("Seating Plan", cx, y, { align: "center" });
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${examTypeTitle} · ${className}-${sectionName}`, cx, y, { align: "center" });
    y += 6;
    if (seatSetting?.academic_year_label) {
      doc.text("Academic Year: 2026-2027", cx, y, { align: "center" });
      y += 6;
    }

    y += 10;
    
    // Draw Table Header
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y - 6, 180, 10, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Seat No.", 20, y);
    if (seatSetting?.roll_no) doc.text("Roll No.", 60, y);
    doc.text("Student Name", 100, y);
    // Header vertical lines
    doc.line(55, y - 6, 55, y + 4);
    doc.line(95, y - 6, 95, y + 4);
    
    y += 10;

    const ordered = [...seatRecords].sort((a, b) => (a.roll_no || "").localeCompare(b.roll_no || "", undefined, { numeric: true }));
    
    doc.setFont("helvetica", "normal");
    ordered.forEach((s, idx) => {
      if (y > 275) { 
        doc.addPage(); 
        y = 20; 
        doc.setFillColor(240, 240, 240);
        doc.rect(15, y - 6, 180, 10, "FD");
        doc.setFont("helvetica", "bold");
        doc.text("Seat No.", 20, y);
        if (seatSetting?.roll_no) doc.text("Roll No.", 60, y);
        doc.text("Student Name", 100, y);
        doc.line(55, y - 6, 55, y + 4);
        doc.line(95, y - 6, 95, y + 4);
        doc.setFont("helvetica", "normal");
        y += 10;
      }
      
      // Draw Row Borders
      doc.rect(15, y - 6, 180, 10);
      doc.line(55, y - 6, 55, y + 4);
      doc.line(95, y - 6, 95, y + 4);
      
      doc.text(String(idx + 1), 20, y);
      if (seatSetting?.roll_no) doc.text(s.roll_no || "-", 60, y);
      doc.text(`${s.first_name || ""} ${s.last_name || ""}`.trim(), 100, y);
      
      y += 10;
    });

    doc.save(`Seat_Plan_${className}-${sectionName}.pdf`);
  };

  // ─── Online exam setup ────────────────────────────────────────────────────
  // Real backend (OnlineExam* APIViews) — a complete, working CRUD already
  // existed server-side (and in the legacy, unlinked components/exams/OnlineExamPanel.tsx);
  // this wires the same feature into Schedule & Logistics as its own step
  // instead of duplicating it with mock state.
  const { data: onlineIndexData, refetch: refetchOnlineExams } = useOnlineExamIndex();
  const onlineExams = onlineIndexData?.online_exams ?? [];

  const [onlineEditId, setOnlineEditId] = useState<number | null>(null);
  const [onlineTitle, setOnlineTitle] = useState("");
  const [onlineClassId, setOnlineClassId] = useState<number | null>(null);
  const [onlineSectionIds, setOnlineSectionIds] = useState<number[]>([]);
  const [onlineSubjectId, setOnlineSubjectId] = useState<number | null>(null);
  const [onlineDate, setOnlineDate] = useState(todayIso());
  const [onlineStartTime, setOnlineStartTime] = useState("09:00");
  const [onlineEndTime, setOnlineEndTime] = useState("10:00");
  const [onlinePercentage, setOnlinePercentage] = useState("");
  const [onlineInstruction, setOnlineInstruction] = useState("");
  const [onlineAutoMark, setOnlineAutoMark] = useState(false);
  const [onlineSaving, setOnlineSaving] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [onlineSaved, setOnlineSaved] = useState(false);

  // Seed the form's class/section from the shared "For" picker once, so Step 4
  // opens pre-scoped to whatever the admin was just looking at in Steps 2/3.
  useEffect(() => {
    if (onlineClassId === null && classId !== null) setOnlineClassId(classId);
  }, [classId, onlineClassId]);
  useEffect(() => {
    if (onlineSectionIds.length === 0 && sectionId !== null) setOnlineSectionIds([sectionId]);
  }, [sectionId, onlineSectionIds.length]);

  const onlineSectionsForClass = useMemo(
    () => (onlineIndexData?.sections ?? []).filter((s) => s.class_id === onlineClassId),
    [onlineIndexData, onlineClassId],
  );
  useEffect(() => {
    setOnlineSectionIds((prev) => prev.filter((id) => onlineSectionsForClass.some((s) => s.id === id)));
  }, [onlineSectionsForClass]);

  const toggleOnlineSection = (id: number) =>
    setOnlineSectionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const resetOnlineForm = () => {
    setOnlineEditId(null);
    setOnlineTitle("");
    setOnlineClassId(classId);
    setOnlineSectionIds(sectionId !== null ? [sectionId] : []);
    setOnlineSubjectId(null);
    setOnlineDate(todayIso());
    setOnlineStartTime("09:00");
    setOnlineEndTime("10:00");
    setOnlinePercentage("");
    setOnlineInstruction("");
    setOnlineAutoMark(false);
    setOnlineError(null);
  };

  const editOnlineExam = (row: OnlineExamRow) => {
    setOnlineEditId(row.id);
    setOnlineTitle(row.title);
    setOnlineClassId(row.school_class);
    setOnlineSectionIds([row.section]);
    setOnlineSubjectId(row.subject);
    setOnlineDate(row.date);
    setOnlineStartTime((row.start_time || "").slice(0, 5));
    setOnlineEndTime((row.end_time || "").slice(0, 5));
    setOnlinePercentage(row.percentage || "");
    setOnlineInstruction(row.instruction || "");
    setOnlineAutoMark(row.auto_mark);
    setOnlineError(null);
  };

  const handleSaveOnlineExamSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnlineError(null);
    if (!onlineTitle.trim() || !onlineClassId || onlineSectionIds.length === 0 || !onlineSubjectId || !onlineDate || !onlineStartTime || !onlineEndTime) {
      setOnlineError("Title, class, section(s), subject, date and time are required.");
      return;
    }
    setOnlineSaving(true);
    try {
      const payload = {
        title: onlineTitle.trim(),
        class_id: onlineClassId,
        section: onlineEditId ? [onlineSectionIds[0]] : onlineSectionIds,
        subject: onlineSubjectId,
        date: onlineDate,
        start_time: `${onlineStartTime}:00`,
        end_time: `${onlineEndTime}:00`,
        percentage: onlinePercentage || undefined,
        instruction: onlineInstruction || undefined,
        auto_mark: onlineAutoMark,
      };
      if (onlineEditId) {
        await updateOnlineExam({ id: onlineEditId, ...payload });
      } else {
        await createOnlineExam(payload);
      }
      resetOnlineForm();
      await refetchOnlineExams();
      setOnlineSaved(true);
      window.setTimeout(() => setOnlineSaved(false), 2500);
    } catch (err) {
      setOnlineError(err instanceof ExamsApiError ? err.message : "Failed to save online exam.");
    } finally {
      setOnlineSaving(false);
    }
  };

  const removeOnlineExam = async (id: number) => {
    setOnlineError(null);
    try {
      await deleteOnlineExam(id);
      if (onlineEditId === id) resetOnlineForm();
      await refetchOnlineExams();
    } catch (err) {
      setOnlineError(err instanceof ExamsApiError ? err.message : "Delete failed.");
    }
  };

  const toggleOnlinePublish = async (row: OnlineExamRow) => {
    setOnlineError(null);
    try {
      if (row.status === 1) await cancelPublishOnlineExam(row.id);
      else await publishOnlineExam(row.id);
      await refetchOnlineExams();
    } catch (err) {
      setOnlineError(err instanceof ExamsApiError ? err.message : "Operation failed.");
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

        {/* Shared exam type picker — plus, from Step 2 on, the one concrete class/section
            those steps act on. Step 1's own class/section filters live with its table
            below instead of here, so they don't look like filters for this bar's own
            class/section (which only seed the "new slot" default). */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          <select style={selectSx} value={examFocusHydrated ? examTypeId ?? "" : ""} onChange={(e) => setExamTypeId(Number(e.target.value))}>
            {(criteria?.exam_types ?? []).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
          {step === 1 ? (
            <input type="date" style={selectSx} value={date} onChange={(e) => setDate(e.target.value)} />
          ) : (
            <>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em" }}>For</span>
              <select style={selectSx} value={classId ?? ""} onChange={(e) => setClassId(Number(e.target.value))}>
                {(criteria?.classes ?? []).map((o) => <option key={o.id} value={o.id}>{o.class_name}</option>)}
              </select>
              <select style={selectSx} value={sectionId ?? ""} onChange={(e) => setSectionId(Number(e.target.value))}>
                {sectionsForClass.map((o) => <option key={o.id} value={o.id}>{o.section_name}</option>)}
              </select>
            </>
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

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: T.ink1 }}>
                <Calendar size={15} color={T.purple} /> {rows.length} exam{rows.length === 1 ? "" : "s"} on {date}
                {(timetableClassFilter || routineSearch) && <span style={{ fontWeight: 500, color: T.ink3 }}>(filtered)</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <select
                  style={selectSx} value={timetableClassFilter ?? ""}
                  onChange={(e) => setTimetableClassFilter(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">All classes</option>
                  {(criteria?.classes ?? []).map((o) => <option key={o.id} value={o.id}>{o.class_name}</option>)}
                </select>
                <select
                  style={selectSx} value={timetableSectionFilter ?? ""} disabled={!timetableClassFilter}
                  onChange={(e) => setTimetableSectionFilter(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">All sections</option>
                  {timetableSectionOptions.map((o) => <option key={o.id} value={o.id}>{o.section_name}</option>)}
                </select>
                <div style={{ position: "relative" }}>
                  <Search size={13} color={T.ink3} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="text"
                    value={routineSearch}
                    onChange={(e) => setRoutineSearch(e.target.value)}
                    placeholder="Search..."
                    style={{ ...selectSx, width: 200, paddingLeft: 30 }}
                  />
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
              {!routinesLoading && rows.length === 0 && (
                <div style={{ fontSize: 13, color: T.ink2, background: T.hoverSoft, padding: "12px 16px", margin: "16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                  <AlertTriangle size={16} /> {routineSearch || timetableClassFilter ? "No exams match this filter." : "No exams scheduled for this date yet. Create a slot to get started."}
                </div>
              )}
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
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxWidth: "75%" }}>
                    <Chip label="Student photo" checked={admitSetting.student_photo} onToggle={() => toggleAdmitField({ student_photo: !admitSetting.student_photo })} />
                    <Chip label="Student name" checked={admitSetting.student_name} onToggle={() => toggleAdmitField({ student_name: !admitSetting.student_name })} />
                    <Chip label="Admission no." checked={admitSetting.admission_no} onToggle={() => toggleAdmitField({ admission_no: !admitSetting.admission_no })} />
                    <Chip label="Class & section" checked={admitSetting.class_section} onToggle={() => toggleAdmitField({ class_section: !admitSetting.class_section })} />
                    <Chip label="Exam name" checked={admitSetting.exam_name} onToggle={() => toggleAdmitField({ exam_name: !admitSetting.exam_name })} />
                    <Chip label="Academic year label" checked={admitSetting.academic_year_label} onToggle={() => toggleAdmitField({ academic_year_label: !admitSetting.academic_year_label })} />
                  </div>
                  <button
                    type="button" onClick={openAdmitCustomize}
                    style={{ height: 32, padding: "0 14px", borderRadius: 8, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Pencil size={13} /> Customize Template
                  </button>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 8, fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", padding: "0 4px 8px" }}>
                <span>Student</span><span>Admission No.</span><span>Status</span><span />
              </div>
              {admitLoading && <div style={{ fontSize: 12.5, color: T.ink3, padding: "8px 4px" }}>Loading…</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {admitRecords.map((s) => {
                  const done = admitGenerated.has(s.student_record_id);
                  return (
                    <div key={s.student_record_id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 8, padding: "8px 4px", fontSize: 13, color: T.ink1, borderTop: `1px solid ${T.border}`, alignItems: "center" }}>
                      <span>{s.first_name} {s.last_name}</span>
                      <span>{s.admission_no}</span>
                      <span>
                        {done
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: T.ok, background: T.okSoft, borderRadius: 999, padding: "3px 10px" }}>Already generated</span>
                          : <span style={{ fontSize: 12, color: T.ink3 }}>Not yet generated</span>}
                      </span>
                      <span>
                        {done && (
                          <button
                            type="button"
                            onClick={() => downloadAdmitCard(s)}
                            style={{
                              display: "flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: 7,
                              border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                            }}
                          >
                            <Download size={12} /> Download
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
                {!admitLoading && admitRecords.length === 0 && (
                  <div style={{ fontSize: 13, color: T.danger, background: T.dangerSoft, padding: "12px 16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, fontWeight: 600, marginTop: 8 }}>
                    <AlertTriangle size={16} />
                    {admitError ?? "No students are enrolled in this class/section yet."}
                  </div>
                )}
              </div>

              {admitRecords.length > 0 && (
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button
                    type="button" onClick={handleGenerateAdmit} disabled={admitGenerating}
                    style={{ height: 40, padding: "0 18px", borderRadius: 10, border: `1px solid ${T.ok}`, background: T.ok, color: "#fff", fontSize: 13, fontWeight: 700, cursor: admitGenerating ? "default" : "pointer", opacity: admitGenerating ? 0.7 : 1 }}
                  >
                    {admitGenerating ? "Generating…" : "Generate Admit Cards"}
                  </button>
                  {admitGenerated.size > 0 && (
                    <button
                      type="button" onClick={downloadAllAdmitCards}
                      style={{ height: 40, padding: "0 18px", borderRadius: 10, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <Download size={15} /> Download All Admit Cards (PDF)
                    </button>
                  )}
                </div>
              )}
            </div>

            {admitCustomizeOpen && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
                <div style={{ background: "#fff", width: "100%", maxWidth: 450, borderRadius: 16, overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>
                  <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: T.hoverSoft }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.ink1 }}>Customize Admit Card Template</h3>
                    <button type="button" onClick={() => setAdmitCustomizeOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink3, padding: 4 }}><X size={18} /></button>
                  </div>
                  <div style={{ padding: 24 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.ink2, marginBottom: 6 }}>Sub Title</label>
                        <input
                          type="text"
                          value={admitCustomizeForm.admit_sub_title}
                          onChange={(e) => setAdmitCustomizeForm({ ...admitCustomizeForm, admit_sub_title: e.target.value })}
                          style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: `1px solid ${T.borderStrong}`, fontSize: 13, color: T.ink1, outline: "none" }}
                          placeholder="e.g. ADMIT CARD"
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.ink2, marginBottom: 6 }}>Instructions / Description</label>
                        <textarea
                          value={admitCustomizeForm.description}
                          onChange={(e) => setAdmitCustomizeForm({ ...admitCustomizeForm, description: e.target.value })}
                          style={{ width: "100%", height: 80, padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.borderStrong}`, fontSize: 13, color: T.ink1, outline: "none", resize: "none" }}
                          placeholder="e.g. 1. Bring this card to the exam hall..."
                        />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.ink1, fontWeight: 500, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={admitCustomizeForm.principal_signature}
                            onChange={(e) => setAdmitCustomizeForm({ ...admitCustomizeForm, principal_signature: e.target.checked })}
                            style={{ width: 16, height: 16, cursor: "pointer" }}
                          />
                          Include Principal Signature
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.ink1, fontWeight: 500, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={admitCustomizeForm.class_teacher_signature}
                            onChange={(e) => setAdmitCustomizeForm({ ...admitCustomizeForm, class_teacher_signature: e.target.checked })}
                            style={{ width: 16, height: 16, cursor: "pointer" }}
                          />
                          Include Class Teacher Signature
                        </label>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: "16px 24px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end", gap: 12, background: T.hoverSoft }}>
                    <button
                      type="button" onClick={() => setAdmitCustomizeOpen(false)}
                      style={{ height: 36, padding: "0 16px", borderRadius: 9, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink2, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button" onClick={handleSaveAdmitCustomize} disabled={admitCustomizeSaving}
                      style={{ height: 36, padding: "0 16px", borderRadius: 9, border: `1px solid ${T.purple}`, background: T.purple, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: admitCustomizeSaving ? "default" : "pointer", opacity: admitCustomizeSaving ? 0.7 : 1 }}
                    >
                      {admitCustomizeSaving ? "Saving…" : "Save Template"}
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                  <div style={{ fontSize: 13, color: T.danger, background: T.dangerSoft, padding: "12px 16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, fontWeight: 600, marginTop: 8 }}>
                    <AlertTriangle size={16} />
                    {seatError ?? "No students are enrolled in this class/section yet."}
                  </div>
                )}
              </div>

              {seatRecords.length > 0 && (
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button
                    type="button" onClick={handleGenerateSeat} disabled={seatGenerating}
                    style={{ height: 40, padding: "0 18px", borderRadius: 10, border: `1px solid ${T.ok}`, background: T.ok, color: "#fff", fontSize: 13, fontWeight: 700, cursor: seatGenerating ? "default" : "pointer", opacity: seatGenerating ? 0.7 : 1 }}
                  >
                    {seatGenerating ? "Generating…" : "Generate Seat Plan"}
                  </button>
                  {seatGenerated.size > 0 && (
                    <button
                      type="button" onClick={downloadSeatPlanPdf}
                      style={{ height: 40, padding: "0 18px", borderRadius: 10, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                    >
                      Download Seat Plan PDF
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: T.purpleSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Laptop2 size={16} color={T.purple} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink1 }}>Online Exam Setup</div>
                <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>A self-contained, auto-markable online test — its own class, section(s) and subject, independent of the timetable above.</div>
              </div>
            </div>

            <form onSubmit={handleSaveOnlineExamSetup} style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.ink1 }}>{onlineEditId ? "Edit online exam" : "New online exam"}</span>
                {onlineEditId && (
                  <button type="button" onClick={resetOnlineForm} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink3, fontSize: 12, fontWeight: 600 }}>Cancel edit</button>
                )}
              </div>

              {onlineError && (
                <div style={{ background: T.dangerSoft, color: T.danger, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, marginBottom: 12 }}>{onlineError}</div>
              )}

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Title</label>
                <input
                  value={onlineTitle} onChange={(e) => setOnlineTitle(e.target.value)}
                  placeholder="e.g. Algebra Basics — Online Quiz" style={selectSx}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Class</label>
                  <select
                    style={selectSx} value={onlineClassId ?? ""}
                    onChange={(e) => { setOnlineClassId(Number(e.target.value)); setOnlineSectionIds([]); }}
                  >
                    <option value="">Select class</option>
                    {(onlineIndexData?.classes ?? []).map((o) => <option key={o.id} value={o.id}>{o.class_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Subject</label>
                  <select style={selectSx} value={onlineSubjectId ?? ""} onChange={(e) => setOnlineSubjectId(Number(e.target.value) || null)}>
                    <option value="">Select subject</option>
                    {(onlineIndexData?.subjects ?? []).map((o) => <option key={o.id} value={o.id}>{o.subject_name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                  Section{onlineEditId ? "" : "(s)"}
                </label>
                {onlineEditId ? (
                  <select
                    style={selectSx} value={onlineSectionIds[0] ?? ""}
                    onChange={(e) => setOnlineSectionIds(e.target.value ? [Number(e.target.value)] : [])}
                  >
                    <option value="">Select section</option>
                    {onlineSectionsForClass.map((o) => <option key={o.id} value={o.id}>{o.section_name}</option>)}
                  </select>
                ) : (
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {onlineSectionsForClass.map((o) => {
                        const checked = onlineSectionIds.includes(o.id);
                        return (
                          <button
                            key={o.id} type="button" onClick={() => toggleOnlineSection(o.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 999,
                              fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                              border: `1px solid ${checked ? T.purple : T.borderStrong}`,
                              background: checked ? T.purpleSoft : "#fff", color: checked ? T.purple : T.ink2,
                            }}
                          >
                            {checked && <Check size={11} strokeWidth={3} />} {o.section_name}
                          </button>
                        );
                      })}
                      {onlineClassId && onlineSectionsForClass.length === 0 && (
                        <span style={{ fontSize: 12, color: T.ink3 }}>No sections found for this class.</span>
                      )}
                      {!onlineClassId && <span style={{ fontSize: 12, color: T.ink3 }}>Select a class first.</span>}
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: 11.5, color: T.ink3 }}>Select one or many — creates the same online exam for every section chosen.</p>
                  </>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Date</label>
                  <input type="date" required value={onlineDate} onChange={(e) => setOnlineDate(e.target.value)} style={selectSx} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Start Time</label>
                  <input type="time" required value={onlineStartTime} onChange={(e) => setOnlineStartTime(e.target.value)} style={selectSx} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>End Time</label>
                  <input type="time" required value={onlineEndTime} onChange={(e) => setOnlineEndTime(e.target.value)} style={selectSx} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Passing %</label>
                  <input
                    type="text" inputMode="decimal" value={onlinePercentage} placeholder="e.g. 40"
                    onChange={(e) => setOnlinePercentage(e.target.value.replace(/[^0-9.]/g, ""))}
                    style={selectSx}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Instructions</label>
                  <input
                    value={onlineInstruction} onChange={(e) => setOnlineInstruction(e.target.value)}
                    placeholder="Shown to students before they start" style={selectSx}
                  />
                </div>
              </div>

              <Chip label="Auto-mark on submit" checked={onlineAutoMark} onToggle={() => setOnlineAutoMark((v) => !v)} />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                {onlineSaved && <span style={{ fontSize: 12, fontWeight: 600, color: T.ok }}>Saved.</span>}
                <button
                  type="submit" disabled={onlineSaving}
                  style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: T.purple, color: "#fff", fontSize: 13, fontWeight: 700, cursor: onlineSaving ? "default" : "pointer", opacity: onlineSaving ? 0.7 : 1 }}
                >
                  {onlineSaving ? "Saving…" : onlineEditId ? "Save changes" : "Create online exam"}
                </button>
              </div>
            </form>

            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 0.8fr 1fr 0.8fr 1.3fr", gap: 8, padding: "10px 16px", fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${T.border}` }}>
                <span>Title</span><span>Class / Section</span><span>Subject</span><span>Date</span><span>Status</span><span />
              </div>
              {onlineExams.length === 0 && (
                <div style={{ fontSize: 13, color: T.ink2, background: T.hoverSoft, padding: "12px 16px", margin: "16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                  <AlertTriangle size={16} /> No online exams created yet. Use the form above to add one.
                </div>
              )}
              {onlineExams.map((row) => (
                <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 0.8fr 1fr 0.8fr 1.3fr", gap: 8, alignItems: "center", padding: "10px 16px", fontSize: 12.5, color: T.ink1, borderBottom: `1px solid ${T.border}` }}>
                  <span>{row.title}</span>
                  <span>{row.class_name}-{row.section_name}</span>
                  <span>{row.subject_name}</span>
                  <span>{formatTime(row.start_time)}–{formatTime(row.end_time)} · {row.date}</span>
                  <span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "3px 10px",
                      color: row.status === 1 ? T.ok : T.ink2, background: row.status === 1 ? T.okSoft : T.hoverSoft,
                    }}>
                      {row.status === 1 ? "Published" : "Draft"}
                    </span>
                  </span>
                  <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => editOnlineExam(row)} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink3, padding: 2, display: "flex" }} title="Edit"><Pencil size={13} /></button>
                    <button type="button" onClick={() => void removeOnlineExam(row.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink3, padding: 2, display: "flex" }} title="Delete"><Trash2 size={13} /></button>
                    <button
                      type="button" onClick={() => void toggleOnlinePublish(row)}
                      style={{ height: 26, padding: "0 10px", borderRadius: 7, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                    >
                      {row.status === 1 ? "Unpublish" : "Publish"}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
