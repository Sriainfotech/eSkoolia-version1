"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type Exam = { id: number; title: string };
type SchoolClass = { id: number; class_name?: string; name?: string };
type Section = { id: number; section_name?: string; name?: string; class_id?: number };
type Subject = { id: number; subject_name?: string; name?: string };
type Part = { id: number; exam_title: string; exam_mark: string };

type StudentRow = {
  student_record_id: number;
  student: number;
  class: number;
  section: number | null;
  admission_no: string;
  first_name: string;
  last_name: string;
  roll_no: string;
  marks: Record<string, string>;
  teacher_remarks: string;
  is_absent: boolean;
  total_marks: string;
  total_gpa_point: string;
  total_gpa_grade: string;
};

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`GET failed ${res.status}`);
  return (await res.json()) as T;
}

async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || body?.detail || "Operation failed");
  }
  return (await res.json()) as T;
}

function fieldStyle() {
  return { width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" } as const;
}

function boxStyle() {
  return { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 } as const;
}

function buttonStyle(color = "var(--primary)") {
  return { height: 36, border: `1px solid ${color}`, background: color, color: "#fff", borderRadius: 8, padding: "0 12px", cursor: "pointer" } as const;
}

export default function ExamMarksRegisterCreatePanel() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const [parts, setParts] = useState<Part[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [marksState, setMarksState] = useState<Record<number, Record<string, string>>>({});
  const [absentState, setAbsentState] = useState<Record<number, boolean>>({});
  const [remarksState, setRemarksState] = useState<Record<number, string>>({});

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filteredSections = useMemo(() => {
    if (!classId) return [];
    return sections.filter((s) => s.class_id === Number(classId));
  }, [sections, classId]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiGet<{ exams: Exam[]; classes: SchoolClass[]; sections: Section[]; subjects: Subject[] }>("/api/v1/exams/exam-marks/index/");
        setExams(data.exams || []);
        setClasses(data.classes || []);
        setSections(data.sections || []);
        setSubjects(data.subjects || []);
      } catch {
        setError("Failed to load marks criteria.");
      }
    };
    void load();
  }, []);

  const search = async () => {
    if (!examId || !classId || !subjectId) {
      setError("Exam, class and subject are required.");
      return;
    }

    try {
      setError("");
      setSuccess("");
      const data = await apiPost<{ students: StudentRow[]; marks_entry_form: Part[] }>("/api/v1/exams/exam-marks/create-search/", {
        exam: Number(examId),
        class_id: Number(classId),
        section: sectionId ? Number(sectionId) : 0,
        subject: Number(subjectId),
      });

      const rows = data.students || [];
      const setupParts = data.marks_entry_form || [];
      setStudents(rows);
      setParts(setupParts);

      const nextMarks: Record<number, Record<string, string>> = {};
      const nextAbsent: Record<number, boolean> = {};
      const nextRemarks: Record<number, string> = {};

      rows.forEach((row) => {
        const rowMarks: Record<string, string> = {};
        setupParts.forEach((part) => {
          rowMarks[String(part.id)] = row.marks?.[String(part.id)] ?? "0";
        });
        nextMarks[row.student_record_id] = rowMarks;
        nextAbsent[row.student_record_id] = !!row.is_absent;
        nextRemarks[row.student_record_id] = row.teacher_remarks || "";
      });

      setMarksState(nextMarks);
      setAbsentState(nextAbsent);
      setRemarksState(nextRemarks);
    } catch (e) {
      setStudents([]);
      setParts([]);
      setError(e instanceof Error ? e.message : "No Result Found");
    }
  };

  const updateMark = (studentRecordId: number, setupId: number, value: string) => {
    setMarksState((prev) => ({
      ...prev,
      [studentRecordId]: {
        ...(prev[studentRecordId] || {}),
        [String(setupId)]: value,
      },
    }));
  };

  const save = async () => {
    if (!examId || !classId || !subjectId || students.length === 0 || parts.length === 0) return;

    try {
      setError("");
      await apiPost("/api/v1/exams/exam-marks/store/", {
        exam_id: Number(examId),
        class_id: Number(classId),
        section_id: sectionId ? Number(sectionId) : 0,
        subject_id: Number(subjectId),
        markStore: Object.fromEntries(
          students.map((s) => {
            const sidMap: Record<number, number> = {};
            parts.forEach((p, idx) => {
              sidMap[idx] = p.id;
            });
            return [
              String(s.student_record_id),
              {
                student: s.student,
                class_id: Number(classId),
                section_id: s.section,
                subject_id: Number(subjectId),
                marks: marksState[s.student_record_id] || {},
                exam_Sids: sidMap,
                absent_students: absentState[s.student_record_id] ? s.student_record_id : "",
                teacher_remarks: remarksState[s.student_record_id] || "",
              },
            ];
          })
        ),
      });
      setSuccess("Operation successful");
      await search();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    }
  };

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid"><h1 style={{ margin: 0, fontSize: 24 }}>Add Marks</h1></div>
      </section>
      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Select Criteria</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr)) auto", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <label htmlFor="examId" style={{ marginBottom: 4, fontWeight: 500 }}>Exam</label>
                <select id="examId" value={examId} onChange={(e) => setExamId(e.target.value)} style={fieldStyle()}>
                  <option value="">Select Exam *</option>
                  {exams.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <label htmlFor="classId" style={{ marginBottom: 4, fontWeight: 500 }}>Class</label>
                <select id="classId" value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }} style={fieldStyle()}>
                  <option value="">Select Class *</option>
                  {classes.map((x) => <option key={x.id} value={x.id}>{x.class_name || x.name || `Class ${x.id}`}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <label htmlFor="subjectId" style={{ marginBottom: 4, fontWeight: 500 }}>Subject</label>
                <select id="subjectId" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={fieldStyle()}>
                  <option value="">Select Subject *</option>
                  {subjects.map((x) => <option key={x.id} value={x.id}>{x.subject_name || x.name || `Subject ${x.id}`}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <label htmlFor="sectionId" style={{ marginBottom: 4, fontWeight: 500 }}>Section</label>
                <select id="sectionId" value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={fieldStyle()}>
                  <option value="">All Sections</option>
                  {filteredSections.map((x) => <option key={x.id} value={x.id}>{x.section_name || x.name || `Section ${x.id}`}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button type="button" onClick={() => void search()} style={buttonStyle()}>Search</button>
              </div>
            </div>
            {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
            {success && <p style={{ color: "#059669", marginTop: 8 }}>{success}</p>}
          </div>

          {students.length > 0 && parts.length > 0 && (
            <div className="white-box" style={boxStyle()}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Admission No</th>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Student Name</th>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Roll No</th>
                      {parts.map((part) => (
                        <th key={part.id} style={{ padding: 8, borderBottom: "1px solid var(--line)", minWidth: 120 }}>{part.exam_title} ({part.exam_mark})</th>
                      ))}
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)", minWidth: 160 }}>Teacher Remarks</th>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.student_record_id}>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{s.admission_no}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{s.first_name} {s.last_name}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{s.roll_no || "-"}</td>
                        {parts.map((part) => (
                          <td key={`${s.student_record_id}-${part.id}`} style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={marksState[s.student_record_id]?.[String(part.id)] ?? "0"}
                              onChange={(e) => updateMark(s.student_record_id, part.id, e.target.value)}
                              style={{ ...fieldStyle(), height: 34 }}
                            />
                          </td>
                        ))}
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                          <input
                            type="text"
                            value={remarksState[s.student_record_id] || ""}
                            onChange={(e) => setRemarksState((prev) => ({ ...prev, [s.student_record_id]: e.target.value }))}
                            style={{ ...fieldStyle(), height: 34 }}
                          />
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                          <label>
                            <input
                              type="checkbox"
                              checked={!!absentState[s.student_record_id]}
                              onChange={(e) => setAbsentState((prev) => ({ ...prev, [s.student_record_id]: e.target.checked }))}
                            />{" "}
                            Yes
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <button type="button" onClick={() => void save()} style={buttonStyle()}>Save Marks</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
