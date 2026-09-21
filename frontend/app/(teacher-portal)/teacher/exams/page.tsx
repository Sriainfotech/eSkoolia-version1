"use client";

/**
 * Teacher Portal — Exam Marks Entry
 *
 * Workflow:
 *  1. Teacher sees a list of exams assigned to their classes that are open.
 *  2. Selects an exam row → loads student+mark-column grid.
 *  3. Enters marks per student per component (Theory / Practical / etc.).
 *  4. Can mark a student as Absent (clears their marks).
 *  5. Saves draft (auto-calculated total shown live).
 *  6. Locks (finalises) the register → status becomes "locked".
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  fetchTeacherExamList,
  fetchExamStudents,
  saveExamMarks,
  lockExamMarks,
  type TeacherExamItem,
  type ExamMarksPayload,
  type StudentMarkRow,
} from "@/lib/api/teacher";
import { ClipboardList, CheckCircle, Lock, Save, Loader2, AlertCircle, ChevronLeft } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Sk({ h = 16, w = "100%" }: { h?: number; w?: string }) {
  return (
    <div style={{ height: h, width: w, borderRadius: 8, background: "var(--bg-2)", animation: "pulse 1.5s ease-in-out infinite" }} />
  );
}

function statusBadge(s: TeacherExamItem["status"]) {
  const map = {
    pending:   { bg: "#FEF9C3", color: "#A16207", label: "Pending" },
    submitted: { bg: "#DBEAFE", color: "#1D4ED8", label: "Submitted" },
    locked:    { bg: "#D1FAE5", color: "#065F46", label: "Locked" },
  };
  const c = map[s];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

// ── Exam List ─────────────────────────────────────────────────────────────────

function ExamList({ onSelect }: { onSelect: (e: TeacherExamItem) => void }) {
  const [exams, setExams] = useState<TeacherExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchTeacherExamList()
      .then(setExams)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[1, 2, 3].map((i) => <Sk key={i} h={80} />)}
    </div>
  );

  if (error) return (
    <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", color: "#B91C1C", fontSize: 13 }}>
      Could not load exams. Please refresh.
    </div>
  );

  if (exams.length === 0) return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--bd)", borderRadius: 14, padding: "40px 32px", textAlign: "center" }}>
      <ClipboardList size={28} color="var(--ink-3)" style={{ marginBottom: 10 }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)", marginBottom: 4 }}>No exams open for marks entry</div>
      <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>The admin will notify you when marks entry is open.</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {exams.map((e) => (
        <button
          key={`${e.exam_id}-${e.class_id}-${e.section_id}-${e.subject_id}`}
          id={`exam-row-${e.exam_id}-${e.subject_id}`}
          onClick={() => e.status !== "locked" && onSelect(e)}
          style={{
            display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
            border: "1px solid var(--bd)", borderRadius: 13,
            background: e.status === "locked" ? "var(--bg-2)" : "var(--bg-1)",
            cursor: e.status === "locked" ? "default" : "pointer",
            textAlign: "left", transition: "box-shadow 0.15s",
          }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "#EEF2FF", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <ClipboardList size={18} color="#4F46E5" strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-1)", marginBottom: 3 }}>{e.exam_name}</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
              {e.class_name}{e.section_name ? ` · ${e.section_name}` : ""} · {e.subject_name}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            {statusBadge(e.status)}
            {e.end_date && (
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                Due {new Date(e.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Mark Entry Grid ───────────────────────────────────────────────────────────

function MarkEntryGrid({
  payload,
  onSaved,
  onLocked,
  onBack,
}: {
  payload: ExamMarksPayload;
  onSaved: () => void;
  onLocked: () => void;
  onBack: () => void;
}) {
  // Local copy of mark values keyed by studentId → setupId
  const [rows, setRows] = useState<StudentMarkRow[]>(payload.students);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute live total for a student
  function calcTotal(marks: Record<string, string>): number {
    return Object.values(marks).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  }

  function setMark(studentId: number, setupId: string, value: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.student_record_id !== studentId) return r;
        const newMarks = { ...r.marks, [setupId]: value };
        return { ...r, marks: newMarks, total_marks: String(calcTotal(newMarks).toFixed(2)) };
      })
    );
  }

  function toggleAbsent(studentId: number) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.student_record_id !== studentId) return r;
        const absent = !r.is_absent;
        const clearedMarks = absent ? Object.fromEntries(Object.keys(r.marks).map((k) => [k, ""])) : r.marks;
        return { ...r, is_absent: absent, marks: clearedMarks, total_marks: absent ? "0.00" : r.total_marks };
      })
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    try {
      await saveExamMarks({
        exam_id: payload.exam_id,
        class_id: payload.class_id,
        section_id: payload.section_id,
        subject_id: payload.subject_id,
        students: rows.map((r) => ({
          student_record_id: r.student_record_id,
          marks: r.marks,
          teacher_remarks: r.teacher_remarks,
          is_absent: r.is_absent,
        })),
      });
      setSaveMsg({ ok: true, text: "Draft saved successfully." });
      onSaved();
    } catch {
      setSaveMsg({ ok: false, text: "Save failed. Please try again." });
    } finally {
      setSaving(false);
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => setSaveMsg(null), 4000);
    }
  }

  async function handleLock() {
    if (!confirm("Lock marks? Teachers cannot edit after locking. Admin review will follow.")) return;
    setLocking(true);
    try {
      await lockExamMarks({
        exam_id: payload.exam_id,
        class_id: payload.class_id,
        section_id: payload.section_id,
        subject_id: payload.subject_id,
      });
      setSaveMsg({ ok: true, text: "Marks locked and submitted to admin." });
      onLocked();
    } catch {
      setSaveMsg({ ok: false, text: "Lock failed. Please save first and try again." });
    } finally {
      setLocking(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--bd)", background: "var(--bg-1)", color: "var(--ink-2)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          <ChevronLeft size={15} /> Back
        </button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-1)" }}>{payload.search_info.exam_name}</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{payload.search_info.class_name} · {payload.search_info.section_name}</div>
        </div>
      </div>

      {saveMsg && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 9, marginBottom: 14, background: saveMsg.ok ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${saveMsg.ok ? "#BBF7D0" : "#FECACA"}`, color: saveMsg.ok ? "#166534" : "#B91C1C", fontSize: 13 }}>
          {saveMsg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {saveMsg.text}
        </div>
      )}

      {/* Table */}
      <div style={{ border: "1px solid var(--bd)", borderRadius: 13, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "var(--bg-2)" }}>
              <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "var(--ink-3)", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>Roll No</th>
              <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "var(--ink-3)", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>Student</th>
              {payload.marks_entry_form.map((col) => (
                <th key={col.id} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "var(--ink-3)", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>
                  {col.exam_title}<br />
                  <span style={{ fontSize: 10, fontWeight: 400 }}>/{col.exam_mark}</span>
                </th>
              ))}
              <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "var(--ink-3)", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>Absent</th>
              <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: "var(--ink-3)", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((student, idx) => (
              <tr key={student.student_record_id} style={{ borderBottom: idx < rows.length - 1 ? "1px solid var(--bd)" : "none", background: student.is_absent ? "#FFFBEB" : "transparent" }}>
                <td style={{ padding: "9px 14px", color: "var(--ink-3)", whiteSpace: "nowrap" }}>{student.roll_no || "—"}</td>
                <td style={{ padding: "9px 14px", fontWeight: 500, color: "var(--ink-1)", whiteSpace: "nowrap" }}>
                  {student.first_name} {student.last_name}
                  <div style={{ fontSize: 10.5, color: "var(--ink-3)", fontWeight: 400 }}>{student.admission_no}</div>
                </td>
                {payload.marks_entry_form.map((col) => (
                  <td key={col.id} style={{ padding: "6px 10px", textAlign: "center" }}>
                    <input
                      id={`mark-${student.student_record_id}-${col.id}`}
                      type="number"
                      min={0}
                      max={parseFloat(col.exam_mark)}
                      step="0.5"
                      disabled={student.is_absent}
                      value={student.marks[String(col.id)] ?? ""}
                      onChange={(ev) => setMark(student.student_record_id, String(col.id), ev.target.value)}
                      style={{
                        width: 70, padding: "5px 8px", borderRadius: 7,
                        border: "1px solid var(--bd)", textAlign: "center",
                        fontSize: 13, background: student.is_absent ? "var(--bg-2)" : "var(--bg-1)",
                        color: "var(--ink-1)", outline: "none",
                      }}
                    />
                  </td>
                ))}
                <td style={{ padding: "6px 14px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={student.is_absent}
                    onChange={() => toggleAbsent(student.student_record_id)}
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#F59E0B" }}
                  />
                </td>
                <td style={{ padding: "9px 14px", textAlign: "center", fontWeight: 700, color: student.is_absent ? "var(--ink-3)" : "var(--ink-1)" }}>
                  {student.is_absent ? "Ab" : parseFloat(student.total_marks).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <button
          id="save-marks-btn"
          onClick={handleSave}
          disabled={saving}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 9, border: "none", background: "#4F46E5", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={15} />}
          {saving ? "Saving…" : "Save Draft"}
        </button>
        <button
          id="lock-marks-btn"
          onClick={handleLock}
          disabled={locking}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 9, border: "1.5px solid #D1FAE5", background: "#F0FDF4", color: "#065F46", fontSize: 13.5, fontWeight: 600, cursor: locking ? "not-allowed" : "pointer", opacity: locking ? 0.7 : 1 }}
        >
          {locking ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Lock size={15} />}
          {locking ? "Locking…" : "Lock & Submit"}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeacherExamsPage() {
  const [selected, setSelected] = useState<TeacherExamItem | null>(null);
  const [grid, setGrid] = useState<ExamMarksPayload | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadGrid = useCallback(async (exam: TeacherExamItem) => {
    setSelected(exam);
    setGrid(null);
    setGridError(null);
    setGridLoading(true);
    try {
      const data = await fetchExamStudents({
        exam_id: exam.exam_id,
        class_id: exam.class_id,
        section_id: exam.section_id,
        subject_id: exam.subject_id,
      });
      setGrid(data);
    } catch (err: unknown) {
      const msg = (err instanceof Error) ? err.message : "Could not load student list. Ensure attendance is recorded first.";
      setGridError(msg);
    } finally {
      setGridLoading(false);
    }
  }, []);

  function handleBack() {
    setSelected(null);
    setGrid(null);
    setGridError(null);
  }

  function handleSaved() {
    // Refresh list in background (badge update)
    setRefreshKey((k) => k + 1);
  }

  function handleLocked() {
    setRefreshKey((k) => k + 1);
    // Short delay, then go back so teacher can see the updated status
    setTimeout(handleBack, 1500);
  }

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 18, boxShadow: "var(--sh-1)", padding: "28px 30px" }}>
      <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 600, color: "var(--ink-1)", margin: "0 0 5px", lineHeight: 1.05, letterSpacing: "-0.03em", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            Exam{" "}
            <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "#4F46E5", fontSize: 38, letterSpacing: "-0.02em" }}>
              Marks Entry
            </em>
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55 }}>
            Enter, save and lock student marks for your assigned exams.
          </p>
        </div>
      </div>

      {/* Main content */}
      {!selected ? (
        <ExamList key={refreshKey} onSelect={loadGrid} />
      ) : gridLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Sk h={44} />
          <Sk h={160} />
        </div>
      ) : gridError ? (
        <div>
          <button onClick={handleBack} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--bd)", background: "var(--bg-1)", color: "var(--ink-2)", fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 14 }}>
            <ChevronLeft size={15} /> Back
          </button>
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", color: "#B91C1C", fontSize: 13 }}>
            {gridError}
          </div>
        </div>
      ) : grid ? (
        <MarkEntryGrid payload={grid} onSaved={handleSaved} onLocked={handleLocked} onBack={handleBack} />
      ) : null}
    </div>
  );
}
