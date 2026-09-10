"use client";
/**
 * Examination › Conduct & Marks — "during exam" group: exam-day attendance,
 * then marks entry, monitored subject-by-subject and cross-checked
 * student-by-student. Wired to the real backend (apps/exams/views.py —
 * the ExamAttendance, ExamMarksRegister and ExamMarksProgressSummaryAPIView
 * view classes) via hooks/useExamsApi.ts — replaces the earlier static
 * mockup. Palette from
 * lib/examTheme.ts.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, UserCheck, CheckSquare } from "lucide-react";
import { examTheme as T } from "@/lib/examTheme";
import { Accordion, Badge, ExamPicker, StepPills, ProgressBar, type Tone } from "@/components/exams/ExamUi";
import {
  ExamsApiError,
  searchExamAttendanceCreate,
  searchExamMarksReport,
  storeExamAttendance,
  useExamAttendanceCriteria,
  useExamMarksProgress,
} from "@/hooks/useExamsApi";
import type { ExamAttendanceStudentRow, ExamMarkRegisterRow } from "@/types/exams";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.ink2 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.purple, display: "inline-block" }} />
      {children}
    </div>
  );
}

const selectSx: React.CSSProperties = {
  height: 34, borderRadius: 8, border: `1px solid ${T.borderStrong}`,
  padding: "0 10px", fontSize: 12.5, color: T.ink1, background: "#fff", outline: "none",
};

const gradeTone = (g: string): Tone => (g.startsWith("A") ? "ok" : g.startsWith("B") ? "info" : g.startsWith("C") ? "warn" : "danger");

interface MatrixRow { rollNo: string; name: string; grades: Record<string, string | null>; absentSubjects: Set<string> }

export default function ConductAndMarksPage() {
  const { data: criteria } = useExamAttendanceCriteria();
  const [examTitle, setExamTitle] = useState("");
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!examTitle && criteria?.exams.length) setExamTitle(criteria.exams[0].title);
  }, [criteria, examTitle]);

  const examId = criteria?.exams.find((e) => e.title === examTitle)?.id ?? null;

  // ─── Step 1: attendance ───────────────────────────────────────────────────
  const [attSubjectId, setAttSubjectId] = useState<number | null>(null);
  const [attClassId, setAttClassId] = useState<number | null>(null);
  const [attSectionId, setAttSectionId] = useState<number | null>(null);
  const [attStudents, setAttStudents] = useState<ExamAttendanceStudentRow[]>([]);
  const [attMap, setAttMap] = useState<Record<number, "P" | "A">>({});
  const [attSearching, setAttSearching] = useState(false);
  const [attSaving, setAttSaving] = useState(false);
  const [attError, setAttError] = useState<string | null>(null);
  const [attSaved, setAttSaved] = useState(false);

  const attSectionsForClass = useMemo(() => (criteria?.sections ?? []).filter((s) => s.class_id === attClassId), [criteria, attClassId]);

  useEffect(() => {
    if (!examId || !attSubjectId || !attClassId) { setAttStudents([]); return; }
    setAttSearching(true);
    setAttError(null);
    setAttSaved(false);
    searchExamAttendanceCreate({ exam: examId, subject: attSubjectId, class_id: attClassId, section: attSectionId ?? undefined })
      .then((res) => {
        setAttStudents(res.students);
        const map: Record<number, "P" | "A"> = {};
        res.students.forEach((s) => { map[s.student_record_id] = s.attendance_type; });
        setAttMap(map);
      })
      .catch((e) => { setAttStudents([]); setAttError(e instanceof ExamsApiError ? e.message : "Failed to load roster."); })
      .finally(() => setAttSearching(false));
  }, [examId, attSubjectId, attClassId, attSectionId]);

  const presentCount = attStudents.filter((s) => attMap[s.student_record_id] === "P").length;

  const handleSaveAttendance = async () => {
    if (!examId || !attSubjectId || !attClassId) return;
    setAttSaving(true);
    setAttError(null);
    try {
      const attendance: Record<string, { student: number; attendance_type: "P" | "A" }> = {};
      attStudents.forEach((s) => {
        attendance[String(s.student_record_id)] = { student: s.student, attendance_type: attMap[s.student_record_id] ?? "P" };
      });
      await storeExamAttendance({ exam_id: examId, subject_id: attSubjectId, class_id: attClassId, section_id: attSectionId, attendance });
      setAttSaved(true);
    } catch (e) {
      setAttError(e instanceof ExamsApiError ? e.message : "Failed to save attendance.");
    } finally {
      setAttSaving(false);
    }
  };

  // ─── Step 2: marks progress monitor + cross-check matrix ─────────────────
  const { data: progress, loading: progressLoading } = useExamMarksProgress(examId);
  const progressRows = useMemo(() => progress?.rows ?? [], [progress]);

  const classSectionOptions = useMemo(() => {
    const seen = new Map<string, { classId: number; className: string; sectionId: number | null; sectionName: string }>();
    progressRows.forEach((r) => {
      const key = `${r.class_id}-${r.section_id ?? "all"}`;
      if (!seen.has(key)) seen.set(key, { classId: r.class_id, className: r.class_name, sectionId: r.section_id, sectionName: r.section_name });
    });
    return Array.from(seen.values());
  }, [progressRows]);

  const [matrixKey, setMatrixKey] = useState<string>("");
  useEffect(() => {
    if (!matrixKey && classSectionOptions.length) setMatrixKey(`${classSectionOptions[0].classId}-${classSectionOptions[0].sectionId ?? "all"}`);
  }, [classSectionOptions, matrixKey]);

  const matrixScope = classSectionOptions.find((o) => `${o.classId}-${o.sectionId ?? "all"}` === matrixKey) ?? null;
  const matrixSubjects = useMemo(
    () => progressRows.filter((r) => matrixScope && r.class_id === matrixScope.classId && (r.section_id ?? null) === (matrixScope.sectionId ?? null)),
    [progressRows, matrixScope],
  );

  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);

  useEffect(() => {
    if (!examId || !matrixScope || !matrixSubjects.length) { setMatrixRows([]); return; }
    let cancelled = false;
    setMatrixLoading(true);
    Promise.all(
      matrixSubjects.map((s) =>
        searchExamMarksReport({ exam: examId, subject: s.subject_id, class_id: matrixScope.classId, section: matrixScope.sectionId ?? undefined })
          .then((res) => ({ subjectName: s.subject_name, rows: res.marks_registers }))
          .catch(() => ({ subjectName: s.subject_name, rows: [] as ExamMarkRegisterRow[] })),
      ),
    ).then((perSubject) => {
      if (cancelled) return;
      const byStudent = new Map<string, MatrixRow>();
      perSubject.forEach(({ subjectName, rows }) => {
        rows.forEach((row) => {
          const key = row.roll_no || String(row.student);
          if (!byStudent.has(key)) {
            byStudent.set(key, { rollNo: row.roll_no, name: `${row.first_name} ${row.last_name}`.trim(), grades: {}, absentSubjects: new Set() });
          }
          const entry = byStudent.get(key)!;
          if (row.is_absent) entry.absentSubjects.add(subjectName);
          else entry.grades[subjectName] = row.total_gpa_grade || row.total_marks;
        });
      });
      setMatrixRows(Array.from(byStudent.values()).sort((a, b) => a.rollNo.localeCompare(b.rollNo)));
    }).finally(() => { if (!cancelled) setMatrixLoading(false); });
    return () => { cancelled = true; };
  }, [examId, matrixScope, matrixSubjects]);

  return (
    <div style={{ minHeight: "100%", background: T.page, padding: "12px 20px 40px" }}>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24 }}>
        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 12 }}>
          <Link href="/dashboard" style={{ color: T.ink2, textDecoration: "none" }}>Dashboard</Link>
          <span style={{ color: T.ink3 }}>/</span>
          <Link href="/exams/command-center" style={{ color: T.ink2, textDecoration: "none" }}>Examinations</Link>
          <span style={{ color: T.ink3 }}>/</span>
          <span style={{ color: T.ink1, fontWeight: 600 }}>Conduct & Marks</span>
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
        <div style={{ marginBottom: 16 }}>
          <Eyebrow>Conduct & Marks · {examTitle || "Loading…"}</Eyebrow>
          <h1 style={{ margin: "6px 0 6px", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, fontSize: 30 }}>
            <span style={{ fontFamily: "Georgia, serif", fontWeight: 900, color: T.ink1 }}>Marks are entered</span>
            <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: "italic", fontWeight: 500, color: T.purple }}>
              by the teacher who taught it.
            </span>
          </h1>
          <p style={{ fontSize: 13, color: T.ink2, lineHeight: 1.6, maxWidth: 640, margin: "0 0 14px" }}>
            Each subject teacher takes their own roll call and enters their own marks. This screen tracks
            who&apos;s done and who still needs a nudge.
          </p>
        </div>

        <ExamPicker
          icon={ClipboardList} value={examTitle} onChange={setExamTitle}
          options={(criteria?.exams ?? []).map((e) => e.title)}
          note="Switching here switches Results & Reports too — one exam in focus at a time, everywhere."
        />

        <div style={{ marginBottom: 16 }}>
          <StepPills step={step} setStep={setStep} steps={["Exam-day Attendance", "Marks Entry"]} />
        </div>

        {step === 1 ? (
          <>
            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: T.ink1, marginBottom: 10 }}>
                <UserCheck size={15} color={T.purple} strokeWidth={2} /> Exam-day attendance
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <select style={selectSx} value={attSubjectId ?? ""} onChange={(e) => setAttSubjectId(Number(e.target.value) || null)}>
                  <option value="">Select subject</option>
                  {(criteria?.subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                </select>
                <select style={selectSx} value={attClassId ?? ""} onChange={(e) => { setAttClassId(Number(e.target.value) || null); setAttSectionId(null); }}>
                  <option value="">Select class</option>
                  {(criteria?.classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                </select>
                <select style={selectSx} value={attSectionId ?? ""} onChange={(e) => setAttSectionId(Number(e.target.value) || null)}>
                  <option value="">All sections</option>
                  {attSectionsForClass.map((s) => <option key={s.id} value={s.id}>{s.section_name}</option>)}
                </select>
              </div>
            </div>

            {attError && (
              <div style={{ background: T.dangerSoft, color: T.danger, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>{attError}</div>
            )}
            {attSaved && (
              <div style={{ background: T.okSoft, color: T.ok, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>Attendance saved.</div>
            )}

            {attSearching && <div style={{ fontSize: 12.5, color: T.ink3 }}>Loading roster…</div>}

            {!attSearching && attStudents.length > 0 && (
              <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <Badge tone="ok">{presentCount}/{attStudents.length} present</Badge>
                  <button
                    type="button" onClick={handleSaveAttendance} disabled={attSaving}
                    style={{ height: 34, padding: "0 14px", borderRadius: 8, border: `1px solid ${T.purple}`, background: T.purple, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: attSaving ? "default" : "pointer", opacity: attSaving ? 0.7 : 1 }}
                  >
                    {attSaving ? "Saving…" : "Save attendance"}
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 100px", gap: 8, fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", padding: "0 4px 6px" }}>
                  <span>Roll</span><span>Student</span><span>Attendance</span>
                </div>
                {attStudents.map((s) => (
                  <div key={s.student_record_id} style={{ display: "grid", gridTemplateColumns: "70px 1fr 100px", gap: 8, padding: "6px 4px", fontSize: 12.5, color: T.ink1, borderTop: `1px solid ${T.border}`, alignItems: "center" }}>
                    <span style={{ fontFamily: "monospace" }}>{s.roll_no}</span>
                    <span>{s.first_name} {s.last_name}</span>
                    <button
                      type="button"
                      onClick={() => setAttMap((m) => ({ ...m, [s.student_record_id]: m[s.student_record_id] === "P" ? "A" : "P" }))}
                      style={{ border: "none", background: "none", cursor: "pointer", padding: 0, justifySelf: "start" }}
                    >
                      <Badge tone={attMap[s.student_record_id] === "P" ? "ok" : "danger"}>{attMap[s.student_record_id] === "P" ? "Present" : "Absent"}</Badge>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {progress && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.ink1, whiteSpace: "nowrap" }}>{progress.total_entered} / {progress.total_expected} entered</span>
                <div style={{ flex: 1 }}><ProgressBar value={progress.percent} /></div>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.purple }}>{progress.percent}%</span>
              </div>
            )}

            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1fr 1fr 1fr", gap: 8, padding: "10px 16px", fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${T.border}` }}>
                <span>Subject</span><span>Class</span><span>Teacher</span><span>Progress</span><span>Status</span>
              </div>
              {progressLoading && <div style={{ padding: 16, fontSize: 12.5, color: T.ink3 }}>Loading…</div>}
              {!progressLoading && progressRows.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: T.ink3 }}>No exam schedule found for {examTitle} yet.</div>}
              {progressRows.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1fr 1fr 1fr", gap: 8, alignItems: "center", padding: "10px 16px", fontSize: 12.5, color: T.ink1, borderBottom: `1px solid ${T.border}` }}>
                  <span>{r.subject_name}</span>
                  <span>{r.class_name}-{r.section_name}</span>
                  <span>{r.teacher_name || "—"}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11.5, color: T.ink2 }}>{r.entered}/{r.total}</span>
                  <span>
                    <Badge tone={r.status === "complete" ? "ok" : r.status === "in_progress" ? "warn" : "danger"}>
                      {r.status === "complete" ? "Complete" : r.status === "in_progress" ? "In progress" : "Not started"}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: T.ink1, marginBottom: 10 }}>
                <CheckSquare size={15} color={T.purple} strokeWidth={2} /> Cross-check scores entered
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <select style={selectSx} value={matrixKey} onChange={(e) => setMatrixKey(e.target.value)}>
                  {classSectionOptions.map((o) => {
                    const key = `${o.classId}-${o.sectionId ?? "all"}`;
                    return <option key={key} value={key}>{o.className}-{o.sectionName}</option>;
                  })}
                </select>
              </div>

              {matrixLoading && <div style={{ fontSize: 12.5, color: T.ink3 }}>Loading…</div>}
              {!matrixLoading && matrixRows.length > 0 && (
                <Accordion title={matrixScope ? `${matrixScope.className}-${matrixScope.sectionName}` : ""} right={<Badge tone="neutral">{matrixRows.length} students</Badge>} defaultOpen>
                  <div style={{ overflowX: "auto" }}>
                    <div style={{ display: "grid", gridTemplateColumns: `60px 1.3fr repeat(${matrixSubjects.length}, 90px)`, gap: 6, fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.03em", padding: "0 4px 6px", minWidth: 400 }}>
                      <span>Roll</span><span>Student</span>
                      {matrixSubjects.map((s) => <span key={s.subject_id}>{s.subject_name}</span>)}
                    </div>
                    {matrixRows.map((row) => (
                      <div key={row.rollNo} style={{ display: "grid", gridTemplateColumns: `60px 1.3fr repeat(${matrixSubjects.length}, 90px)`, gap: 6, padding: "6px 4px", fontSize: 12, color: T.ink1, borderTop: `1px solid ${T.border}`, alignItems: "center", minWidth: 400 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11 }}>{row.rollNo}</span>
                        <span>{row.name}</span>
                        {matrixSubjects.map((s) => {
                          if (row.absentSubjects.has(s.subject_name)) {
                            return <span key={s.subject_id} style={{ color: T.danger, fontWeight: 600, fontSize: 10.5 }}>Absent</span>;
                          }
                          const g = row.grades[s.subject_name];
                          return <span key={s.subject_id}>{g ? <Badge tone={gradeTone(g)}>{g}</Badge> : <span style={{ color: T.ink3 }}>–</span>}</span>;
                        })}
                      </div>
                    ))}
                  </div>
                </Accordion>
              )}
              {!matrixLoading && matrixRows.length === 0 && matrixScope && (
                <div style={{ fontSize: 12.5, color: T.ink3 }}>No marks entered yet for {matrixScope.className}-{matrixScope.sectionName}.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
