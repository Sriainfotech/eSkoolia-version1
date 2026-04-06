"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type SchoolClass = { id: number; class_name?: string; name?: string };
type Section = { id: number; section_name?: string; name?: string; class_id?: number };
type ExamType = { id: number; title: string };
type Subject = { id: number; subject_name?: string; name?: string };
type Teacher = { id: number; full_name: string };
type ExamPeriod = { id: number; period: string };
type ClassRoom = { id: number; room_no: string };

type RoutineRow = {
  section: number | null;
  subject: number;
  teacher_id: number | null;
  exam_period_id: number | null;
  date: string;
  start_time: string;
  end_time: string;
  room: string;
};

type ExistingRoutine = {
  id: number;
  section: number | null;
  subject: number;
  teacher: number | null;
  exam_period: number | null;
  exam_date: string;
  start_time: string;
  end_time: string;
  room: string;
  subject_name: string;
  class_name: string;
  section_name: string;
  teacher_name: string;
};

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
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

function toTimeHHMM(value: string): string {
  return (value || "").slice(0, 5);
}

export default function ExamSchedulePanel() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [periods, setPeriods] = useState<ExamPeriod[]>([]);
  const [rooms, setRooms] = useState<ClassRoom[]>([]);

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [examTypeId, setExamTypeId] = useState("");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rows, setRows] = useState<RoutineRow[]>([]);
  const [existing, setExisting] = useState<ExistingRoutine[]>([]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredSections = useMemo(() => {
    if (!classId) return [];
    const id = Number(classId);
    return sections.filter((s) => s.class_id === id);
  }, [classId, sections]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiGet<{
          classes: SchoolClass[];
          sections: Section[];
          rooms: ClassRoom[];
          exam_types: ExamType[];
          teachers: Teacher[];
          exam_periods: ExamPeriod[];
        }>("/api/v1/exams/exam-schedule/index/");
        setClasses(data.classes || []);
        setSections(data.sections || []);
        setRooms(data.rooms || []);
        setExamTypes(data.exam_types || []);
        setTeachers(data.teachers || []);
        setPeriods(data.exam_periods || []);
      } catch {
        setError("Failed to load schedule criteria.");
      }
    };
    void load();
  }, []);

  const search = async () => {
    if (!classId || !examTypeId) {
      setError("Exam and class are required.");
      return;
    }

    try {
      setError("");
      const payload = {
        exam_type: Number(examTypeId),
        class: Number(classId),
        section: sectionId ? Number(sectionId) : 0,
      };
      const data = await apiPost<{ subjects: Subject[]; exam_schedule: ExistingRoutine[] }>("/api/v1/exams/exam-schedule/search/", payload);
      const subjectRows = data.subjects || [];
      setSubjects(subjectRows);
      setExisting(data.exam_schedule || []);

      const mappedRows: RoutineRow[] = subjectRows.map((subject) => {
        const ex = (data.exam_schedule || []).find((r) => r.subject === subject.id);
        return {
          section: ex?.section ?? (sectionId ? Number(sectionId) : null),
          subject: subject.id,
          teacher_id: ex?.teacher ?? null,
          exam_period_id: ex?.exam_period ?? null,
          date: ex?.exam_date ?? new Date().toISOString().slice(0, 10),
          start_time: toTimeHHMM(ex?.start_time || "09:00"),
          end_time: toTimeHHMM(ex?.end_time || "10:00"),
          room: ex?.room || "",
        };
      });
      setRows(mappedRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No Result Found");
      setSubjects([]);
      setRows([]);
      setExisting([]);
    }
  };

  const updateRow = (index: number, patch: Partial<RoutineRow>) => {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  };

  const submit = async () => {
    if (!classId || !examTypeId || rows.length === 0) {
      setError("Search and prepare routine rows first.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await apiPost("/api/v1/exams/exam-schedule/store/", {
        class_id: Number(classId),
        section_id: sectionId ? Number(sectionId) : 0,
        exam_type_id: Number(examTypeId),
        routine: rows.map((row) => ({
          section: row.section || 0,
          subject: row.subject,
          teacher_id: row.teacher_id || 0,
          exam_period_id: row.exam_period_id || 0,
          date: row.date,
          start_time: row.start_time,
          end_time: row.end_time,
          room: row.room || "",
        })),
      });

      setSuccess("Exam routine has been assigned successfully");
      await search();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Exam Schedule</h1>
            <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
              <span>Dashboard</span><span>/</span><span>Examinations</span><span>/</span><span>Exam Schedule</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Select Criteria</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr)) auto", gap: 8 }}>
              <select value={examTypeId} onChange={(e) => setExamTypeId(e.target.value)} style={fieldStyle()}>
                <option value="">Select Exam *</option>
                {examTypes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }} style={fieldStyle()}>
                <option value="">Select Class *</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.class_name || item.name || `Class ${item.id}`}</option>)}
              </select>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={fieldStyle()}>
                <option value="">All Sections</option>
                {filteredSections.map((item) => <option key={item.id} value={item.id}>{item.section_name || item.name || `Section ${item.id}`}</option>)}
              </select>
              <input value={subjects.length ? `${subjects.length} subjects loaded` : "No subjects loaded"} readOnly style={{ ...fieldStyle(), color: "var(--text-muted)" }} />
              <button type="button" onClick={() => void search()} style={buttonStyle()}>Search</button>
            </div>
            {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
            {success && <p style={{ color: "#059669", marginTop: 8 }}>{success}</p>}
          </div>

          {rows.length > 0 && (
            <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Exam Routine Rows</h3>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Subject</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Section</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Date</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Period</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Start</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>End</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Teacher</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Room</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`routine-${row.subject}-${index}`}>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        {subjects.find((s) => s.id === row.subject)?.subject_name || subjects.find((s) => s.id === row.subject)?.name || `Subject ${row.subject}`}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <select value={row.section ?? 0} onChange={(e) => updateRow(index, { section: Number(e.target.value) || null })} style={fieldStyle()}>
                          <option value={0}>All Sections</option>
                          {filteredSections.map((item) => <option key={item.id} value={item.id}>{item.section_name || item.name || `Section ${item.id}`}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <input type="date" value={row.date} onChange={(e) => updateRow(index, { date: e.target.value })} style={fieldStyle()} />
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <select value={row.exam_period_id ?? 0} onChange={(e) => updateRow(index, { exam_period_id: Number(e.target.value) || null })} style={fieldStyle()}>
                          <option value={0}>Select Period</option>
                          {periods.map((item) => <option key={item.id} value={item.id}>{item.period}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <input
                          type="time"
                          value={toTimeHHMM(row.start_time)}
                          onChange={(e) => updateRow(index, { start_time: e.target.value })}
                          style={fieldStyle()}
                        />
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <input
                          type="time"
                          value={toTimeHHMM(row.end_time)}
                          onChange={(e) => updateRow(index, { end_time: e.target.value })}
                          style={fieldStyle()}
                        />
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <select value={row.teacher_id ?? 0} onChange={(e) => updateRow(index, { teacher_id: Number(e.target.value) || null })} style={fieldStyle()}>
                          <option value={0}>Select Teacher</option>
                          {teachers.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <select
                          value={row.room}
                          onChange={(e) => updateRow(index, { room: e.target.value })}
                          style={fieldStyle()}
                        >
                          <option value="">Select Room</option>
                          {row.room && !rooms.some((item) => item.room_no === row.room) ? (
                            <option value={row.room}>{row.room}</option>
                          ) : null}
                          {rooms.map((item) => (
                            <option key={item.id} value={item.room_no}>
                              {item.room_no}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 12, textAlign: "right" }}>
                <button type="button" onClick={() => void submit()} style={buttonStyle()} disabled={saving}>
                  {saving ? "Saving..." : "Save Routine"}
                </button>
              </div>
            </div>
          )}

          {existing.length > 0 && (
            <div className="white-box" style={boxStyle()}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Existing Schedule</h3>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Date</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Subject</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Class/Sec</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Teacher</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Time</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Room</th>
                  </tr>
                </thead>
                <tbody>
                  {existing.map((item) => (
                    <tr key={item.id}>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.exam_date}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.subject_name}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.class_name} ({item.section_name || "All"})</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.teacher_name || "-"}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{toTimeHHMM(item.start_time)} - {toTimeHHMM(item.end_time)}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.room || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
