"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { TimeSpinnerPicker } from "@/components/common/TimeSpinnerPicker";

type SchoolClass = { id: number; class_name?: string; name?: string };
type Section = { id: number; section_name?: string; name?: string; class_id?: number };
type Subject = { id: number; subject_name?: string; name?: string };

type OnlineExam = {
  id: number;
  title: string;
  school_class: number;
  class_name?: string;
  section: number;
  section_name?: string;
  subject: number;
  subject_name?: string;
  date: string;
  start_time: string;
  end_time: string;
  status: number;
  percentage?: string;
  instruction?: string;
  auto_mark?: boolean;
};

type MarkStudent = {
  id: number;
  admission_no?: string;
  first_name?: string;
  last_name?: string;
  roll_no?: string | number;
};

type ResultStudent = {
  id: number;
  student: number;
  admission_no?: string;
  first_name?: string;
  last_name?: string;
  roll_no?: string | number;
  total_marks?: string;
  status?: number;
};

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || body?.detail || `GET failed ${res.status}`);
  }
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
  return {
    height: 34,
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 8,
    padding: "0 10px",
    cursor: "pointer",
  } as const;
}

export default function OnlineExamPanel() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rows, setRows] = useState<OnlineExam[]>([]);

  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [percentage, setPercentage] = useState("");
  const [instruction, setInstruction] = useState("");
  const [autoMark, setAutoMark] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [marksPayload, setMarksPayload] = useState<{ online_exam?: OnlineExam; students?: MarkStudent[]; present_students?: number[] } | null>(null);
  const [resultPayload, setResultPayload] = useState<{ online_exam?: OnlineExam; students?: ResultStudent[]; present_students?: number[] } | null>(null);

  const filteredSections = useMemo(() => {
    if (!classId) return [];
    return sections.filter((item) => item.class_id === Number(classId));
  }, [sections, classId]);

  const resetForm = () => {
    setEditId(null);
    setTitle("");
    setClassId("");
    setSectionId("");
    setSubjectId("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setPercentage("");
    setInstruction("");
    setAutoMark(false);
  };

  const load = async () => {
    const data = await apiGet<{ classes: SchoolClass[]; sections: Section[]; subjects: Subject[]; online_exams: OnlineExam[] }>("/api/v1/exams/online-exam/");
    setClasses(data.classes || []);
    setSections(data.sections || []);
    setSubjects(data.subjects || []);
    setRows(data.online_exams || []);
  };

  useEffect(() => {
    const init = async () => {
      try {
        setError("");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load online exams.");
      }
    };
    void init();
  }, []);

  const save = async () => {
    if (!title || !classId || !sectionId || !subjectId || !date || !startTime || !endTime) {
      setError("Title, class, section, subject, date and time are required.");
      return;
    }

    try {
      setError("");
      setMessage("");
      const payload = {
        ...(editId ? { id: editId } : {}),
        title,
        class: Number(classId),
        section: [Number(sectionId)],
        subject: Number(subjectId),
        date,
        start_time: startTime,
        end_time: endTime,
        percentage: percentage || undefined,
        instruction,
        auto_mark: autoMark,
      };
      await apiPost(editId ? "/api/v1/exams/online-exam/update/" : "/api/v1/exams/online-exam/store/", payload);
      setMessage("Operation successful");
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed.");
    }
  };

  const edit = (row: OnlineExam) => {
    setEditId(row.id);
    setTitle(row.title || "");
    setClassId(String(row.school_class || ""));
    setSectionId(String(row.section || ""));
    setSubjectId(String(row.subject || ""));
    setDate(row.date || "");
    setStartTime((row.start_time || "").slice(0, 5));
    setEndTime((row.end_time || "").slice(0, 5));
    setPercentage(String(row.percentage || ""));
    setInstruction(row.instruction || "");
    setAutoMark(Boolean(row.auto_mark));
  };

  const remove = async (id: number) => {
    try {
      setError("");
      await apiPost("/api/v1/exams/online-exam/delete/", { id });
      setMessage("Operation successful");
      if (editId === id) resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  const publish = async (id: number) => {
    try {
      await apiGet(`/api/v1/exams/online-exam/publish/${id}/`);
      setMessage("Operation successful");
      setError("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed.");
    }
  };

  const cancelPublish = async (id: number) => {
    try {
      await apiGet(`/api/v1/exams/online-exam/publish-cancel/${id}/`);
      setMessage("Operation successful");
      setError("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed.");
    }
  };

  const loadMarks = async (id: number) => {
    try {
      const data = await apiGet<{ online_exam: OnlineExam; students: MarkStudent[]; present_students: number[] }>(`/api/v1/exams/online-exam/marks-register/${id}/`);
      setMarksPayload(data);
      setResultPayload(null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load marks register.");
    }
  };

  const loadResult = async (id: number) => {
    try {
      const data = await apiGet<{ online_exam: OnlineExam; students: ResultStudent[]; present_students: number[] }>(`/api/v1/exams/online-exam/result/${id}/`);
      setResultPayload(data);
      setMarksPayload(null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load result.");
    }
  };

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid"><h1 style={{ margin: 0, fontSize: 24 }}>Online Exam</h1></div>
      </section>
      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editId ? "Edit Online Exam" : "Add Online Exam"}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Exam title *" style={fieldStyle()} />
              <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }} style={fieldStyle()}>
                <option value="">Select Class *</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>{item.class_name || item.name || `Class ${item.id}`}</option>
                ))}
              </select>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={fieldStyle()}>
                <option value="">Select Section *</option>
                {filteredSections.map((item) => (
                  <option key={item.id} value={item.id}>{item.section_name || item.name || `Section ${item.id}`}</option>
                ))}
              </select>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={fieldStyle()}>
                <option value="">Select Subject *</option>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>{item.subject_name || item.name || `Subject ${item.id}`}</option>
                ))}
              </select>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle()} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, gridColumn: 'span 2' }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Start</label>
                  <TimeSpinnerPicker value={startTime} onChange={setStartTime} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>End</label>
                  <TimeSpinnerPicker value={endTime} onChange={setEndTime} />
                </div>
              </div>
              <input type="number" min="0" step="0.01" value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="Percentage" style={fieldStyle()} />
            </div>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8 }}>
              <input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Instruction" style={fieldStyle()} />
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                <input type="checkbox" checked={autoMark} onChange={(e) => setAutoMark(e.target.checked)} />
                Auto Mark
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => void save()} style={buttonStyle()}>{editId ? "Update" : "Save"}</button>
                {editId && (
                  <button type="button" onClick={resetForm} style={buttonStyle("#6b7280")}>Cancel</button>
                )}
              </div>
            </div>
            {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
            {message && <p style={{ color: "#059669", marginTop: 8 }}>{message}</p>}
          </div>

          <div className="white-box" style={boxStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Online Exam List</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>Title</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>Class</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>Section</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>Subject</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>Date</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>Status</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 12, color: "var(--muted)" }}>No online exam found.</td>
                    </tr>
                  )}
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>{row.title}</td>
                      <td style={{ borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>{row.class_name || "-"}</td>
                      <td style={{ borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>{row.section_name || "-"}</td>
                      <td style={{ borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>{row.subject_name || "-"}</td>
                      <td style={{ borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>{row.date}</td>
                      <td style={{ borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>{row.status === 1 ? "Published" : "Draft"}</td>
                      <td style={{ borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" style={buttonStyle("#0ea5e9")} onClick={() => edit(row)}>Edit</button>
                          <button type="button" style={buttonStyle("#dc2626")} onClick={() => void remove(row.id)}>Delete</button>
                          {row.status === 1 ? (
                            <button type="button" style={buttonStyle("#f59e0b")} onClick={() => void cancelPublish(row.id)}>Cancel Publish</button>
                          ) : (
                            <button type="button" style={buttonStyle("#16a34a")} onClick={() => void publish(row.id)}>Publish</button>
                          )}
                          <button type="button" style={buttonStyle("#7c3aed")} onClick={() => void loadMarks(row.id)}>Marks Register</button>
                          <button type="button" style={buttonStyle("#475569")} onClick={() => void loadResult(row.id)}>Result</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {marksPayload && (
            <div className="white-box" style={{ ...boxStyle(), marginTop: 12 }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Marks Register Preview</h3>
              <p style={{ margin: "0 0 8px" }}><strong>{marksPayload.online_exam?.title || "-"}</strong></p>
              <p style={{ margin: "0 0 12px" }}>Total Students: {marksPayload.students?.length || 0}</p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {(marksPayload.students || []).slice(0, 15).map((student) => (
                  <li key={student.id}>
                    {(student.first_name || "") + " " + (student.last_name || "")} ({student.roll_no || "-"})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resultPayload && (
            <div className="white-box" style={{ ...boxStyle(), marginTop: 12 }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Result Preview</h3>
              <p style={{ margin: "0 0 8px" }}><strong>{resultPayload.online_exam?.title || "-"}</strong></p>
              <p style={{ margin: "0 0 12px" }}>Submitted: {resultPayload.students?.length || 0}</p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {(resultPayload.students || []).slice(0, 15).map((student) => (
                  <li key={student.id}>
                    {(student.first_name || "") + " " + (student.last_name || "")} ({student.roll_no || "-"}) - {student.total_marks || "0.00"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
