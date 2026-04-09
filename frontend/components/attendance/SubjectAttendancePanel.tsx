"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";

type SchoolClass = { id: number; class_name?: string; name?: string };
type Section = { id: number; section_name?: string; name?: string; school_class?: number };
type Subject = { id: number; subject_name?: string; name?: string };
type ClassSubjectAssignmentRow = {
  subject?: { id?: number; name?: string; subject_name?: string } | number;
  subject_id?: number;
  subject_name?: string;
};

type SubjectStudentRow = {
  record_id: number;
  student: number;
  class: number;
  section: number;
  admission_no: string;
  first_name: string;
  last_name: string;
  roll_no: string;
  attendance_type: string | null;
  note: string;
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
  return {
    width: "100%",
    height: 40,
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "0 10px",
    background: "var(--surface)",
  } as const;
}

function buttonStyle(color = "var(--primary)") {
  return {
    height: 40,
    padding: "0 12px",
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
  } as const;
}

function boxStyle() {
  return { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 } as const;
}

function normalizeList<T>(payload: T[] | { results?: T[] } | { data?: T[] } | undefined | null): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  const results = (payload as { results?: T[] }).results;
  const data = (payload as { data?: T[] }).data;
  return results || data || [];
}

function isPositiveInteger(value: string) {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function normalizeClassLabel(label: string, id: number) {
  const trimmed = label.trim();
  if (!trimmed) return String(id);
  if (/^\d+$/.test(trimmed)) return trimmed;
  if (/^class\s*\d+$/i.test(trimmed)) return trimmed.replace(/[^\d]/g, "");
  return trimmed;
}

function isClassOptionValid(row: SchoolClass) {
  if (!Number.isInteger(row.id) || row.id <= 0) return false;
  const label = (row.class_name || row.name || "").trim();
  if (!label) return false;
  if (/[<>]/.test(label)) return false;
  if (/^(adc|undefined|null|nan)$/i.test(label)) return false;
  return true;
}

function sanitizeTextInput(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function skeletonCell(width: string | number) {
  return {
    width,
    height: 12,
    borderRadius: 999,
    background: "linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)",
    backgroundSize: "200% 100%",
    animation: "subjectAttendanceShimmer 1.2s ease-in-out infinite",
  } as const;
}

function parseSubjectsFromAssignments(rows: ClassSubjectAssignmentRow[]) {
  const map = new Map<number, Subject>();
  for (const row of rows) {
    const direct = typeof row.subject === "number" ? row.subject : row.subject?.id;
    const id = Number(row.subject_id || direct || 0);
    if (!id || Number.isNaN(id) || id <= 0) continue;
    const label = row.subject_name || (typeof row.subject === "object" ? row.subject?.subject_name || row.subject?.name : "") || "";
    if (!label.trim()) continue;
    map.set(id, { id, subject_name: label, name: label });
  }
  return Array.from(map.values()).sort((a, b) => (a.subject_name || a.name || "").localeCompare(b.subject_name || b.name || ""));
}

function resolveSubjectsFromAssignments(rows: ClassSubjectAssignmentRow[], subjectNameById: Map<number, string>) {
  const map = new Map<number, Subject>();
  for (const row of rows) {
    const direct = typeof row.subject === "number" ? row.subject : row.subject?.id;
    const id = Number(row.subject_id || direct || 0);
    if (!id || Number.isNaN(id) || id <= 0) continue;
    const assignmentName = row.subject_name || (typeof row.subject === "object" ? row.subject?.subject_name || row.subject?.name : "") || "";
    const resolvedName = assignmentName.trim() || subjectNameById.get(id) || "";
    if (!resolvedName.trim()) continue;
    map.set(id, { id, subject_name: resolvedName, name: resolvedName });
  }
  return Array.from(map.values()).sort((a, b) => (a.subject_name || a.name || "").localeCompare(b.subject_name || b.name || ""));
}

function normalizeSubjectOption(subject: Subject, subjectNameById: Map<number, string>) {
  const id = Number(subject.id || 0);
  if (!id || Number.isNaN(id) || id <= 0) return null;
  const raw = (subject.subject_name || subject.name || "").trim();
  const fromMap = (subjectNameById.get(id) || "").trim();
  const looksLikeFallback = /^subject\s*\d+$/i.test(raw) || /^\d+$/.test(raw);
  const resolved = looksLikeFallback ? (fromMap || "") : (raw || fromMap);
  if (!resolved) return null;
  return { id, subject_name: resolved, name: resolved } as Subject;
}

function normalizeSubjectOptions(subjects: Subject[], subjectNameById: Map<number, string>) {
  const map = new Map<number, Subject>();
  for (const row of subjects) {
    const normalized = normalizeSubjectOption(row, subjectNameById);
    if (!normalized) continue;
    map.set(normalized.id, normalized);
  }
  return Array.from(map.values()).sort((a, b) => (a.subject_name || a.name || "").localeCompare(b.subject_name || b.name || ""));
}

export default function SubjectAttendancePanel() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));

  const [students, setStudents] = useState<SubjectStudentRow[]>([]);
  const [attendanceTypeBanner, setAttendanceTypeBanner] = useState("");
  const [searchInfo, setSearchInfo] = useState<{ class_name: string; section_name: string; subject_name: string; date: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [error, setError] = useState("");
  const [requiredError, setRequiredError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const sectionRef = useRef<HTMLSelectElement | null>(null);
  const subjectRef = useRef<HTMLSelectElement | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const canSearch = Boolean(classId && sectionId && subjectId && attendanceDate);
  const validClasses = useMemo(() => classes.filter(isClassOptionValid), [classes]);
  const classNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of validClasses) {
      map.set(row.id, normalizeClassLabel(row.class_name || row.name || "", row.id));
    }
    return map;
  }, [validClasses]);
  const subjectNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of allSubjects) {
      const label = (row.subject_name || row.name || "").trim();
      if (row.id > 0 && label) map.set(row.id, label);
    }
    return map;
  }, [allSubjects]);

  const filteredSections = useMemo(() => {
    const id = Number(classId);
    if (!id) return [];
    return sections.filter((s) => Number(s.school_class) === id || !s.school_class);
  }, [classId, sections]);

  useEffect(() => {
    const load = async () => {
      const [classData, subjectsData] = await Promise.all([
        apiGet<{ classes: SchoolClass[] }>("/api/v1/attendance/subject-attendance/index/"),
        apiGet<Subject[] | { results?: Subject[] }>("/api/v1/core/subjects/?page_size=500"),
      ]);
      setClasses(classData.classes || []);
      setAllSubjects(normalizeList(subjectsData));
    };
    void load();
  }, []);

  useEffect(() => {
    if (!classId) {
      setSections([]);
      setSubjects([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setLoadingSections(true);
          setLoadingSubjects(true);
          setError("");

          const [sectionData, assignmentData] = await Promise.all([
            apiGet<Section[] | { results?: Section[] }>(`/api/v1/core/sections/?class=${classId}`),
            apiGet<ClassSubjectAssignmentRow[] | { results?: ClassSubjectAssignmentRow[] }>(`/api/v1/academics/class-subjects/?class_id=${classId}&page_size=500`),
          ]);

          const nextSections = normalizeList(sectionData).filter((item) => Number(item.school_class) === Number(classId));
          const nextSubjects = resolveSubjectsFromAssignments(normalizeList(assignmentData), subjectNameById);

          setSections(nextSections);
          setSubjects(nextSubjects);
        } catch {
          setSections([]);
          setSubjects([]);
          setError("Unable to load sections and subjects");
        } finally {
          setLoadingSections(false);
          setLoadingSubjects(false);
        }
      })();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [classId, subjectNameById]);

  useEffect(() => {
    if (!classId || loadingSections) return;
    sectionRef.current?.focus();
  }, [classId, loadingSections]);

  useEffect(() => {
    if (!sectionId || loadingSubjects) return;
    subjectRef.current?.focus();
  }, [sectionId, loadingSubjects]);

  useEffect(() => {
    if (!classId || !sectionId) {
      setSubjectId("");
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setLoadingSubjects(true);
          const assignmentData = await apiGet<ClassSubjectAssignmentRow[] | { results?: ClassSubjectAssignmentRow[] }>(
            `/api/v1/academics/class-subjects/?class_id=${classId}&section_id=${sectionId}&page_size=500`
          );
          setSubjects(resolveSubjectsFromAssignments(normalizeList(assignmentData), subjectNameById));
        } catch {
          setSubjects([]);
        } finally {
          setLoadingSubjects(false);
        }
      })();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [classId, sectionId, subjectNameById]);

  const search = async (event?: FormEvent) => {
    if (event) event.preventDefault();
    if (!canSearch) {
      setRequiredError("Please select all required fields");
      return;
    }
    if (attendanceDate > today) {
      setError("Attendance date cannot be in the future.");
      return;
    }
    try {
      setHasSearched(true);
      setLoading(true);
      setError("");
      setRequiredError("");
      const data = await apiGet<{
        students: SubjectStudentRow[];
        attendance_type: string;
        subjects: Subject[];
        search_info: { class_name: string; section_name: string; subject_name: string; date: string };
      }>(`/api/v1/attendance/subject-attendance/search/?class_id=${classId}&section_id=${sectionId}&subject_id=${subjectId}&attendance_date=${attendanceDate}`);
      setStudents(data.students || []);
      setAttendanceTypeBanner(data.attendance_type || "");
      setSearchInfo(data.search_info || null);
      setSubjects(normalizeSubjectOptions(data.subjects || [], subjectNameById));
    } catch {
      setError("");
      setStudents([]);
      setSearchInfo(null);
      setAttendanceTypeBanner("");
    } finally {
      setLoading(false);
    }
  };

  const updateType = (recordId: number, type: string) => {
    setStudents((prev) => prev.map((s) => (s.record_id === recordId ? { ...s, attendance_type: type } : s)));
  };

  const updateNote = (recordId: number, note: string) => {
    setStudents((prev) => prev.map((s) => (s.record_id === recordId ? { ...s, note: sanitizeTextInput(note) } : s)));
  };

  const save = async () => {
    if (!classId || !sectionId || !subjectId || !attendanceDate) return;
    try {
      setSaving(true);
      setError("");
      const attendancePayload = Object.fromEntries(
        students.map((s) => [
          String(s.record_id),
          {
            student: s.student,
            class: s.class,
            section: s.section,
            attendance_type: s.attendance_type || "P",
            note: sanitizeTextInput(s.note || ""),
          },
        ])
      );

      await apiPost("/api/v1/attendance/subject-attendance/store/", {
        class: Number(classId),
        section: Number(sectionId),
        subject: Number(subjectId),
        date: attendanceDate,
        attendance_date: attendanceDate,
        attendance: attendancePayload,
      });

      await search();
    } catch {
      setError("Operation Failed");
    } finally {
      setSaving(false);
      setSaveConfirmOpen(false);
    }
  };

  const holiday = async (purpose: "mark" | "unmark") => {
    if (!classId || !sectionId || !subjectId || !attendanceDate) return;
    try {
      await apiPost("/api/v1/attendance/subject-attendance/holiday-store/", {
        purpose,
        class_id: Number(classId),
        section_id: Number(sectionId),
        subject_id: Number(subjectId),
        attendance_date: attendanceDate,
      });
      await search();
    } catch {
      setError("Operation Failed");
    }
  };

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Subject Wise Attendance</h1>
            <div style={{ display: "flex", gap: 8, color: "#666", fontSize: 13 }}>
              <span>Dashboard</span>
              <span>/</span>
              <span>Student Information</span>
              <span>/</span>
              <span>Subject Wise Attendance</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Select Criteria</h3>
            <form onSubmit={(e) => void search(e)} style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(160px, 1fr))", gap: 8, alignItems: "end" }}>
              <div>
                <label htmlFor="subject-attendance-class" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
                  Class
                </label>
                <select
                  id="subject-attendance-class"
                  aria-required="true"
                  value={classId}
                  onChange={(e) => {
                    const nextValue = e.target.value.trim();
                    setClassId(isPositiveInteger(nextValue) ? nextValue : "");
                    setSectionId("");
                    setSubjectId("");
                    setStudents([]);
                    setSearchInfo(null);
                    setAttendanceTypeBanner("");
                    setHasSearched(false);
                    setRequiredError("");
                  }}
                  style={fieldStyle()}
                >
                  <option value="">Select Class</option>
                  {validClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {normalizeClassLabel(c.class_name || c.name || "", c.id)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="subject-attendance-section" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
                  Section
                </label>
                <select
                  id="subject-attendance-section"
                  aria-required="true"
                  ref={sectionRef}
                  value={sectionId}
                  disabled={!classId || loadingSections}
                  onChange={(e) => {
                    const nextValue = e.target.value.trim();
                    setSectionId(isPositiveInteger(nextValue) ? nextValue : "");
                    setSubjectId("");
                    setRequiredError("");
                  }}
                  style={{ ...fieldStyle(), opacity: !classId ? 0.7 : 1 }}
                >
                  <option value="">{!classId ? "Select Class First" : loadingSections ? "Loading..." : "Select Section"}</option>
                  {filteredSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.section_name || s.name || `Section ${s.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="subject-attendance-subject" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
                  Subject
                </label>
                <select
                  id="subject-attendance-subject"
                  aria-required="true"
                  ref={subjectRef}
                  value={subjectId}
                  disabled={!classId || !sectionId || loadingSubjects}
                  onChange={(e) => {
                    const nextValue = e.target.value.trim();
                    setSubjectId(isPositiveInteger(nextValue) ? nextValue : "");
                    setRequiredError("");
                  }}
                  style={{ ...fieldStyle(), opacity: !classId || !sectionId ? 0.7 : 1 }}
                >
                  <option value="">{!classId ? "Select Class First" : !sectionId ? "Select Class First" : loadingSubjects ? "Loading..." : "Select Subject"}</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.subject_name || s.name || `Subject ${s.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="subject-attendance-date" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
                  Attendance Date
                </label>
                <input
                  id="subject-attendance-date"
                  type="date"
                  aria-required="true"
                  max={today}
                  value={attendanceDate}
                  onChange={(e) => {
                    setAttendanceDate(e.target.value);
                    setRequiredError("");
                  }}
                  style={fieldStyle()}
                />
              </div>

              <button type="submit" disabled={!canSearch || loading} style={{ ...buttonStyle(), opacity: !canSearch || loading ? 0.65 : 1 }}>
                {loading ? "Searching..." : "Search"}
              </button>
            </form>
            {requiredError && (
              <div role="alert" style={{ color: "var(--warning)", marginTop: 8 }}>
                {requiredError}
              </div>
            )}
            {error && <div style={{ color: "var(--warning)", marginTop: 8 }}>{error}</div>}
          </div>

          {loading && (
            <div className="white-box" style={boxStyle()} aria-live="polite" aria-busy="true">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>SL</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Admission No</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Student Name</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Roll Number</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Attendance</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, rowIndex) => (
                    <tr key={`subject-skeleton-${rowIndex}`}>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <div style={skeletonCell(18)} />
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <div style={skeletonCell("50%")} />
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <div style={skeletonCell("70%")} />
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <div style={skeletonCell("45%")} />
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <div style={skeletonCell("80%")} />
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <div style={skeletonCell("90%")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !hasSearched && (
            <div className="white-box" style={{ ...boxStyle(), textAlign: "center", color: "var(--text-muted)" }}>
              <div
                aria-hidden="true"
                style={{
                  width: 72,
                  height: 72,
                  margin: "0 auto 10px",
                  borderRadius: "50%",
                  border: "2px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  color: "#64748b",
                }}
              >
                ?
              </div>
              <h4 style={{ margin: "0 0 6px", color: "var(--text)" }}>Search to begin</h4>
              <p style={{ margin: 0 }}>Select class, section, subject and date to load attendance.</p>
            </div>
          )}

          {!loading && hasSearched && students.length === 0 && (
            <div className="white-box" style={{ ...boxStyle(), textAlign: "center", color: "var(--text-muted)" }}>
              <h4 style={{ margin: "0 0 6px", color: "var(--text)" }}>No students assigned to this subject</h4>
              <p style={{ margin: 0 }}>Try another class, section or subject combination.</p>
            </div>
          )}

          {!loading && students.length > 0 && (
            <>
              <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>Class:</strong> {classNameById.get(Number(classId)) || normalizeClassLabel(searchInfo?.class_name || "", Number(classId) || 0)} <strong>Section:</strong> {searchInfo?.section_name} <strong>Subject:</strong> {searchInfo?.subject_name} <strong>Date:</strong> {searchInfo?.date}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {attendanceTypeBanner !== "H" ? (
                      <button type="button" onClick={() => void holiday("mark")} style={buttonStyle("#6b7280")}>
                        Mark Holiday
                      </button>
                    ) : (
                      <button type="button" onClick={() => void holiday("unmark")} style={buttonStyle("#6b7280")}>
                        Unmark Holiday
                      </button>
                    )}
                    <button type="button" onClick={() => setSaveConfirmOpen(true)} style={buttonStyle()}>
                      {saving ? "Saving..." : "Attendance"}
                    </button>
                  </div>
                </div>
                {attendanceTypeBanner === "H" && <div style={{ marginTop: 8, padding: 8, border: "1px solid #fbbf24", background: "#fff8e1", borderRadius: 8 }}>Attendance already submitted as Holiday</div>}
                {attendanceTypeBanner && attendanceTypeBanner !== "H" && <div style={{ marginTop: 8, padding: 8, border: "1px solid #10b981", background: "#ecfdf5", borderRadius: 8 }}>Attendance already submitted</div>}
              </div>

              <div className="white-box" style={boxStyle()}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>SL</th>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Admission No</th>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Student Name</th>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Roll Number</th>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Attendance</th>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, idx) => (
                      <tr key={s.record_id}>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{idx + 1}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{s.admission_no}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                          {s.first_name} {s.last_name}
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{s.roll_no || "-"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            {(["P", "L", "A", "F"] as const).map((type) => (
                              <label key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <input type="radio" name={`att-${s.record_id}`} value={type} checked={(s.attendance_type || "P") === type} onChange={() => updateType(s.record_id, type)} />
                                <span>{type === "P" ? "Present" : type === "L" ? "Late" : type === "A" ? "Absent" : "Half Day"}</span>
                              </label>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                          <textarea
                            value={s.note || ""}
                            onChange={(e) => updateNote(s.record_id, e.target.value)}
                            rows={2}
                            style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <ConfirmationModal
            isOpen={saveConfirmOpen}
            title="Confirm Attendance Save"
            message={`Are you sure you want to save attendance for this subject on ${attendanceDate}?`}
            confirmLabel="Save Attendance"
            cancelLabel="Cancel"
            loadingLabel="Saving..."
            isConfirming={saving}
            onCancel={() => setSaveConfirmOpen(false)}
            onConfirm={() => void save()}
          />
        </div>
      </section>

      <style jsx global>{`
        @keyframes subjectAttendanceShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        #subject-attendance-class:focus,
        #subject-attendance-section:focus,
        #subject-attendance-subject:focus,
        #subject-attendance-date:focus {
          outline: 2px solid rgba(59, 130, 246, 0.5);
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}
