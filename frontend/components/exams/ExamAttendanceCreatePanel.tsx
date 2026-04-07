"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type Exam = { id: number; title: string };
type SchoolClass = { id: number; class_name?: string; name?: string };
type Section = { id: number; section_name?: string; name?: string; class_id?: number };
type Subject = { id: number; subject_name?: string; name?: string };

type StudentRow = {
  student_record_id: number;
  student: number;
  class: number;
  section: number | null;
  admission_no: string;
  first_name: string;
  last_name: string;
  roll_no: string;
  attendance_type: string;
};

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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

export default function ExamAttendanceCreatePanel() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filteredSections = useMemo(() => {
    if (!classId) return [];
    return sections.filter((s) => s.class_id === Number(classId));
  }, [sections, classId]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiGet<{ exams: Exam[]; classes: SchoolClass[]; sections: Section[]; subjects: Subject[] }>("/api/v1/exams/exam-attendance/index/");
        setExams(data.exams || []);
        setClasses(data.classes || []);
        setSections(data.sections || []);
        setSubjects(data.subjects || []);
      } catch {
        setError("Failed to load attendance criteria.");
      }
    };
    void load();
  }, []);

  const search = async () => {
    if (!examId || !classId || !subjectId || !examDate) {
      setError("Exam, class, subject and date are required.");
      return;
    }
    try {
      setError("");
      setSuccess("");
      const data = await apiPost<{ students: StudentRow[] }>("/api/v1/exams/exam-attendance/create-search/", {
        exam: Number(examId),
        class_id: Number(classId),
        section: sectionId ? Number(sectionId) : 0,
        subject: Number(subjectId),
        exam_date: examDate,
      });
      const list = data.students || [];
      setStudents(list);
      const map: Record<number, string> = {};
      list.forEach((s) => {
        map[s.student_record_id] = s.attendance_type || "P";
      });
      setAttendance(map);
    } catch (e) {
      setStudents([]);
      setError(e instanceof Error ? e.message : "No Result Found");
    }
  };

  const setType = (studentRecordId: number, type: string) => {
    setAttendance((prev) => ({ ...prev, [studentRecordId]: type }));
  };

  const save = async () => {
    if (!examId || !classId || !subjectId || students.length === 0) return;
    try {
      setError("");
      setSuccess("");
      await apiPost("/api/v1/exams/exam-attendance/store/", {
        exam_id: Number(examId),
        class_id: Number(classId),
        section_id: sectionId ? Number(sectionId) : 0,
        subject_id: Number(subjectId),
        attendance: Object.fromEntries(
          students.map((s) => [
            String(s.student_record_id),
            {
              student: s.student,
              class: Number(classId),
              section: sectionId ? Number(sectionId) : s.section,
              attendance_type: attendance[s.student_record_id] || "P",
            },
          ])
        ),
      });
      await search();
      setSuccess("Operation successful");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    }
  };

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid"><h1 style={{ margin: 0, fontSize: 24 }}>Exam Attendance Create</h1></div>
      </section>
      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Select Criteria</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr)) auto", gap: 8 }}>
              <select value={examId} onChange={(e) => setExamId(e.target.value)} style={fieldStyle()}>
                <option value="">Select Exam *</option>
                {exams.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
              </select>
              <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }} style={fieldStyle()}>
                <option value="">Select Class *</option>
                {classes.map((x) => <option key={x.id} value={x.id}>{x.class_name || x.name || `Class ${x.id}`}</option>)}
              </select>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={fieldStyle()}>
                <option value="">Select Subject *</option>
                {subjects.map((x) => <option key={x.id} value={x.id}>{x.subject_name || x.name || `Subject ${x.id}`}</option>)}
              </select>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={fieldStyle()}>
                <option value="">All Sections</option>
                {filteredSections.map((x) => <option key={x.id} value={x.id}>{x.section_name || x.name || `Section ${x.id}`}</option>)}
              </select>
              <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} style={fieldStyle()} />
              <button type="button" onClick={() => void search()} style={buttonStyle()}>Search</button>
            </div>
            {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
            {success && <p style={{ color: "#059669", marginTop: 8 }}>{success}</p>}
          </div>

          {students.length > 0 && (
            <div className="white-box" style={boxStyle()}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Admission No</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Student Name</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Roll No</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.student_record_id}>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{s.admission_no}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{s.first_name} {s.last_name}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{s.roll_no || "-"}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <label style={{ marginRight: 16 }}><input type="radio" name={`att-${s.student_record_id}`} checked={(attendance[s.student_record_id] || "P") === "P"} onChange={() => setType(s.student_record_id, "P")} /> Present</label>
                        <label><input type="radio" name={`att-${s.student_record_id}`} checked={(attendance[s.student_record_id] || "P") === "A"} onChange={() => setType(s.student_record_id, "A")} /> Absent</label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <button type="button" onClick={() => void save()} style={buttonStyle()}>Save Attendance</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
