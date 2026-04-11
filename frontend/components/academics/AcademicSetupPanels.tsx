"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { TimeSpinnerPicker } from "@/components/common/TimeSpinnerPicker";
import { sortAcademicsClasses } from "@/lib/classOrdering";

type AcademicYear = { id: number; name: string; is_current: boolean };
type SchoolClass = { id: number; name: string; numeric_order?: number };
type Section = { id: number; school_class: number; name: string };
type Subject = { id: number; name: string; code: string };
type Teacher = { id: number; full_name?: string; username: string };
type ClassPeriod = { id: number; period: string; start_time: string; end_time: string };
type ClassRoom = { id: number; room_no: string; capacity: number | null; active_status: boolean };

type ClassTeacherAssignment = {
  id: number;
  academic_year_id: number | null;
  class_id: number;
  section_id: number | null;
  teacher_id: number;
  active_status: boolean;
  school_class?: number;
  section?: number | null;
  teacher?: number | null;
};

type ClassSubjectAssignment = {
  id: number;
  academic_year_id: number | null;
  class_id: number;
  section_id: number | null;
  subject_id: number;
  teacher_id: number | null;
  is_optional: boolean;
  active_status: boolean;
  school_class?: number;
  section?: number | null;
  subject?: number | null;
  teacher?: number | null;
};

type ClassRoutineSlot = {
  id: number;
  academic_year_id: number | null;
  class_id: number;
  section_id: number | null;
  subject_id: number;
  teacher_id: number | null;
  day: string;
  class_period_id: number | null;
  start_time: string;
  end_time: string;
  room_id: number | null;
  room: string;
  is_break: boolean;
  active_status: boolean;
  school_class?: number;
  section?: number | null;
  subject?: number | null;
  teacher?: number | null;
};

type LookupBundle = {
  years: AcademicYear[];
  classes: SchoolClass[];
  sections: Section[];
  subjects: Subject[];
  teachers: Teacher[];
  periods: ClassPeriod[];
  rooms: ClassRoom[];
};

type ApiList<T> = T[] | { results?: T[] };

type PagedList<T> = ApiList<T> & { next?: string | null };

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
}

function asList<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const merged: T[] = [];
  let nextPath = path;

  for (let index = 0; index < 50 && nextPath; index += 1) {
    const response = await apiFetch<PagedList<T>>(nextPath);
    merged.push(...asList(response));

    const nextRaw = response.next;
    if (!nextRaw) {
      break;
    }

    if (nextRaw.startsWith("http")) {
      try {
        const nextUrl = new URL(nextRaw);
        nextPath = `${nextUrl.pathname}${nextUrl.search}`;
      } catch {
        break;
      }
    } else {
      nextPath = nextRaw;
    }
  }

  return merged;
}

function toId(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function useLookupData() {
  const [data, setData] = useState<LookupBundle>({
    years: [],
    classes: [],
    sections: [],
    subjects: [],
    teachers: [],
    periods: [],
    rooms: [],
  });
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setError("");
      const [years, classes, sections, subjects, teachers, periods, rooms] = await Promise.all([
        fetchAllPages<AcademicYear>("/api/v1/core/academic-years/?page_size=100"),
        fetchAllPages<SchoolClass>("/api/v1/core/classes/?page_size=100"),
        fetchAllPages<Section>("/api/v1/core/sections/?page_size=100"),
        fetchAllPages<Subject>("/api/v1/core/subjects/?page_size=100"),
        apiFetch<Teacher[]>("/api/v1/academics/lesson-planners/teachers/"),
        fetchAllPages<ClassPeriod>("/api/v1/core/class-periods/?period_type=class&page_size=100"),
        fetchAllPages<ClassRoom>("/api/v1/core/class-rooms/?page_size=100"),
      ]);
      setData({
        years: asList(years),
        classes: sortAcademicsClasses(asList(classes)),
        sections: asList(sections),
        subjects: asList(subjects),
        teachers: sortTeachers(teachers),
        periods: asList(periods),
        rooms: sortClassRooms(asList(rooms)),
      });
    } catch {
      setError("Unable to load lookup data.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return { data, error, reload: load };
}

function nameById<T extends { id: number }>(items: T[], id: number | null | undefined, pick: (item: T) => string): string {
  if (!id) return "-";
  return pick(items.find((entry) => entry.id === id) || ({} as T)) || `#${id}`;
}

function sectionOptionsForClass(sections: Section[], classId: string): Section[] {
  if (!classId) return [];
  const cid = Number(classId);
  return sections.filter((section) => section.school_class === cid);
}

function teacherDisplayName(teacher: Teacher): string {
  const fullName = typeof teacher?.full_name === "string" ? teacher.full_name.trim() : "";
  if (fullName) return fullName;

  const username = typeof (teacher as { username?: unknown })?.username === "string"
    ? ((teacher as { username?: string }).username || "").trim()
    : "";
  if (username) return username;

  return teacher?.id ? `Teacher #${teacher.id}` : "Unknown Teacher";
}

function sortTeachers(items: Teacher[]): Teacher[] {
  return [...items].sort((left, right) => teacherDisplayName(left).localeCompare(teacherDisplayName(right), undefined, { numeric: true, sensitivity: "base" }));
}

function sortClassRooms(items: ClassRoom[]): ClassRoom[] {
  const splitRoom = (room: string) => {
    const normalized = room.trim().toUpperCase();
    const match = normalized.match(/^(.*?)(\d+)$/);
    if (!match) return { prefix: normalized, number: Number.NaN };
    return { prefix: match[1].trim(), number: Number(match[2]) };
  };

  return [...items].sort((left, right) => {
    const a = splitRoom(left.room_no || "");
    const b = splitRoom(right.room_no || "");
    const prefixCompare = a.prefix.localeCompare(b.prefix, undefined, { numeric: true, sensitivity: "base" });
    if (prefixCompare !== 0) return prefixCompare;
    if (Number.isFinite(a.number) && Number.isFinite(b.number) && a.number !== b.number) return a.number - b.number;
    return (left.room_no || "").localeCompare(right.room_no || "", undefined, { numeric: true, sensitivity: "base" });
  });
}

function initialYearId(years: AcademicYear[]): string {
  const current = years.find((year) => year.is_current);
  if (current) return String(current.id);
  return years.length ? String(years[0].id) : "";
}

function extractClassTeacherFieldErrors(details: unknown, fallbackMessage: string): { academic_year?: string; class_id?: string; section_id?: string; teacher?: string } {
  const errors: { academic_year?: string; class_id?: string; section_id?: string; teacher?: string } = {};
  if (!details || typeof details !== "object") {
    return errors;
  }

  const payload = details as Record<string, unknown>;
  const rawErrors = payload.errors;
  if (!rawErrors || typeof rawErrors !== "object" || Array.isArray(rawErrors)) {
    return errors;
  }

  const source = rawErrors as Record<string, unknown>;
  const pick = (key: string): string | undefined => {
    const value = source[key];
    if (!value) return undefined;
    if (Array.isArray(value) && value.length) return String(value[0]);
    return typeof value === "string" ? value : undefined;
  };

  errors.academic_year = pick("academic_year") || pick("academic_year_id");
  errors.class_id = pick("school_class") || pick("class_id");
  errors.section_id = pick("section") || pick("section_id");
  errors.teacher = pick("teacher") || pick("teacher_id");

  const topMessage = typeof payload.message === "string" ? payload.message : "";
  if (!errors.teacher && (topMessage.toLowerCase().includes("teacher") || fallbackMessage.toLowerCase().includes("teacher"))) {
    errors.teacher = topMessage || fallbackMessage;
  }
  if (!errors.class_id && topMessage.toLowerCase().includes("class") && !topMessage.toLowerCase().includes("teacher")) {
    errors.class_id = topMessage;
  }
  if (!errors.section_id && topMessage.toLowerCase().includes("section")) {
    errors.section_id = topMessage;
  }
  if (!errors.academic_year && topMessage.toLowerCase().includes("academic year")) {
    errors.academic_year = topMessage;
  }

  return errors;
}

export function AssignClassTeacherPanel() {
  const { data, error: lookupError } = useLookupData();
  const [items, setItems] = useState<ClassTeacherAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ academic_year?: string; class_id?: string; section_id?: string; teacher?: string }>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingRow, setViewingRow] = useState<ClassTeacherAssignment | null>(null);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectAssignment[]>([]);
  const [classSubjectsLoading, setClassSubjectsLoading] = useState(false);
  const [classSubjectsError, setClassSubjectsError] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<ClassTeacherAssignment | null>(null);

  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [filterSectionId, setFilterSectionId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!yearId && data.years.length) {
      setYearId(initialYearId(data.years));
    }
  }, [data.years, yearId]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (filterClassId) params.set("class_id", filterClassId);
      if (filterSectionId) params.set("section_id", filterSectionId);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const response = await apiFetch<ApiList<ClassTeacherAssignment>>(`/api/v1/academics/class-teachers/${suffix}`);
      setItems(asList(response));
      setPage(1);
    } catch {
      setError("Unable to load class teacher assignments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const availableSections = useMemo(() => sectionOptionsForClass(data.sections, classId), [data.sections, classId]);
  const filterSections = useMemo(() => sectionOptionsForClass(data.sections, filterClassId), [data.sections, filterClassId]);
  const hasClassTeacherFieldError = Boolean(fieldErrors.academic_year || fieldErrors.class_id || fieldErrors.section_id || fieldErrors.teacher);
  const isEditMode = editingId !== null;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  // Fetch subjects assigned to the currently selected class/section so the
  // operator can confirm what the incoming class teacher will actually handle.
  useEffect(() => {
    let cancelled = false;
    const targetClassId = classId || (viewingRow ? String(toId(viewingRow.class_id) ?? toId(viewingRow.school_class) ?? "") : "");
    const targetSectionId = sectionId || (viewingRow ? String(toId(viewingRow.section_id) ?? toId(viewingRow.section) ?? "") : "");

    if (!targetClassId) {
      setClassSubjects([]);
      setClassSubjectsError("");
      setClassSubjectsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const run = async () => {
      try {
        setClassSubjectsLoading(true);
        setClassSubjectsError("");
        const params = new URLSearchParams();
        params.set("class_id", targetClassId);
        if (targetSectionId) params.set("section_id", targetSectionId);
        params.set("page_size", "500");
        const response = await apiFetch<ApiList<ClassSubjectAssignment>>(`/api/v1/academics/class-subjects/?${params.toString()}`);
        if (cancelled) return;
        const rows = asList(response).filter((row) => {
          const rowClass = toId(row.class_id) ?? toId(row.school_class);
          if (rowClass !== Number(targetClassId)) return false;
          if (!targetSectionId) return true;
          const rowSection = toId(row.section_id) ?? toId(row.section);
          // Include rows that are section-specific matches as well as class-wide
          // (null section) assignments so nothing gets hidden by filtering.
          return rowSection === Number(targetSectionId) || rowSection == null;
        });
        setClassSubjects(rows);
      } catch {
        if (cancelled) return;
        setClassSubjects([]);
        setClassSubjectsError("Unable to load subjects for this class.");
      } finally {
        if (!cancelled) setClassSubjectsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [classId, sectionId, viewingRow]);

  const resolvedClassSubjects = useMemo(() => {
    const seen = new Set<number>();
    const rows: { id: number; name: string; code: string; teacher: string; optional: boolean }[] = [];
    for (const assignment of classSubjects) {
      const subjectId = toId(assignment.subject_id) ?? toId(assignment.subject);
      if (!subjectId || seen.has(subjectId)) continue;
      seen.add(subjectId);
      const subject = data.subjects.find((entry) => entry.id === subjectId);
      const teacherIdValue = toId(assignment.teacher_id) ?? toId(assignment.teacher);
      const teacher = teacherIdValue ? data.teachers.find((entry) => entry.id === teacherIdValue) : undefined;
      rows.push({
        id: subjectId,
        name: subject?.name || `Subject #${subjectId}`,
        code: subject?.code || "",
        teacher: teacher ? teacherDisplayName(teacher) : "—",
        optional: !!assignment.is_optional,
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    return rows;
  }, [classSubjects, data.subjects, data.teachers]);

  const resetForm = (clearNotice = true) => {
    setEditingId(null);
    setClassId("");
    setSectionId("");
    setTeacherId("");
    setFieldErrors({});
    if (clearNotice) {
      setMessage("");
      setError("");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: { academic_year?: string; class_id?: string; section_id?: string; teacher?: string } = {};
    if (!yearId) nextErrors.academic_year = "Academic year is required";
    if (!classId) nextErrors.class_id = "Class is required";
    if (!sectionId) nextErrors.section_id = "Section is required";
    if (!teacherId) nextErrors.teacher = "Teacher is required";

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError("");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      setFieldErrors({});
      const payload = {
        academic_year_id: yearId ? Number(yearId) : null,
        class_id: Number(classId),
        section_id: sectionId ? Number(sectionId) : null,
        teacher_id: Number(teacherId),
        active_status: true,
      };
      await apiFetch(editingId ? `/api/v1/academics/class-teachers/${editingId}/` : "/api/v1/academics/class-teachers/", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setMessage(editingId ? "Assignment updated." : "Class teacher assigned.");
      resetForm(false);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save class teacher assignment.";
      setError(msg);
      const details = err && typeof err === "object" && "details" in err ? (err as { details?: unknown }).details : undefined;
      const next = extractClassTeacherFieldErrors(details, msg);
      if (!next.academic_year && !next.class_id && !next.section_id && !next.teacher) {
        const lowered = msg.toLowerCase();
        if (lowered.includes("academic year")) next.academic_year = msg;
        if (lowered.includes("class") && !lowered.includes("teacher")) next.class_id = msg;
        if (lowered.includes("section")) next.section_id = msg;
        if (lowered.includes("teacher") || lowered.includes("not a teacher")) next.teacher = msg;
      }
      setFieldErrors(next);
      setError(next.academic_year || next.class_id || next.section_id || next.teacher ? "" : msg);
    } finally {
      setSaving(false);
    }
  };

  const edit = (row: ClassTeacherAssignment) => {
    setEditingId(row.id);
    setYearId(row.academic_year_id ? String(row.academic_year_id) : "");
    const mappedClass = toId(row.class_id) ?? toId(row.school_class);
    const mappedSection = toId(row.section_id) ?? toId(row.section);
    const mappedTeacher = toId(row.teacher_id) ?? toId(row.teacher);
    setClassId(mappedClass ? String(mappedClass) : "");
    setSectionId(mappedSection ? String(mappedSection) : "");
    setTeacherId(mappedTeacher ? String(mappedTeacher) : "");
    setMessage("");
    setError("");
    setFieldErrors({});
  };

  const remove = async (row: ClassTeacherAssignment) => {
    try {
      setError("");
      setMessage("");
      await apiFetch(`/api/v1/academics/class-teachers/${row.id}/`, { method: "DELETE" });
      setMessage("Class teacher assignment deleted successfully.");
      await load();
    } catch {
      setError("Failed to delete class teacher assignment.");
    }
  };

  return (
    <section>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Assign Class Teacher</h1>
      </div>

      <div style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface)", padding: 12, marginBottom: 12 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Select Criteria</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Class</label>
            <select value={filterClassId} onChange={(e) => { setFilterClassId(e.target.value); setFilterSectionId(""); setError(""); }} style={{ marginTop: 4, width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" }}>
              <option value="">All classes</option>
              {data.classes.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Section</label>
            <select value={filterSectionId} onChange={(e) => { setFilterSectionId(e.target.value); setError(""); }} style={{ marginTop: 4, width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" }}>
              <option value="">All sections</option>
              {filterSections.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => void load()} style={{ height: 36, background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer" }}>Search</button>
          <button type="button" onClick={() => { setFilterClassId(""); setFilterSectionId(""); void load(); }} style={{ height: 36, background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer" }}>Reset</button>
        </div>
      </div>

      {isEditMode ? <p style={{ margin: "0 0 10px", color: "#0f766e", fontSize: 13, fontWeight: 600 }}>Edit mode active: update the assignment, or click Cancel to create a new one.</p> : null}
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto auto", gap: 8, marginBottom: 12, alignItems: "start" }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Academic Year</label>
          <select required value={yearId} onChange={(e) => { setYearId(e.target.value); setFieldErrors((prev) => ({ ...prev, academic_year: undefined })); }} style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${fieldErrors.academic_year ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px" }}>
            <option value="">Select year</option>
            {data.years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.academic_year || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Class</label>
          <select required value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); setFieldErrors((prev) => ({ ...prev, class_id: undefined, section_id: undefined })); }} style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${fieldErrors.class_id ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px" }}>
            <option value="">Select class</option>
            {data.classes.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.class_id || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Section</label>
          <select required value={sectionId} onChange={(e) => { setSectionId(e.target.value); setFieldErrors((prev) => ({ ...prev, section_id: undefined })); }} style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${fieldErrors.section_id ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px" }}>
            <option value="">Select section</option>
            {availableSections.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.section_id || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Class Teacher</label>
          <select required value={teacherId} onChange={(e) => { setTeacherId(e.target.value); setFieldErrors((prev) => ({ ...prev, teacher: undefined })); }} style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${fieldErrors.teacher ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px" }}>
            <option value="">Select teacher</option>
            {data.teachers.map((row) => <option key={row.id} value={row.id}>{teacherDisplayName(row)}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.teacher || ""}</span>
        </div>
        <div style={{ alignSelf: "start", marginTop: 22 }}>
          <button type="submit" disabled={saving} style={{ height: 36, background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer" }}>{saving ? "Saving..." : isEditMode ? "Update" : "Assign"}</button>
        </div>
        {isEditMode ? <div style={{ alignSelf: "start", marginTop: 22 }}><button type="button" onClick={() => resetForm()} style={{ height: 36, background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer" }}>Cancel</button></div> : <span />}
      </form>

      {message && (
        <div role="status" aria-live="polite" style={{ margin: "8px 0", padding: "10px 14px", border: "1px solid #86efac", background: "#f0fdf4", color: "#166534", borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden>✓</span>
          <span>{message}</span>
        </div>
      )}
      {(lookupError || (error && !hasClassTeacherFieldError)) && (
        <div role="alert" style={{ margin: "8px 0", padding: "10px 14px", border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b", borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden>!</span>
          <span>{lookupError || error}</span>
        </div>
      )}

      {classId ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface)", padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              Subjects assigned to {nameById(data.classes, Number(classId), (entry) => entry.name)}
              {sectionId ? ` – ${nameById(data.sections, Number(sectionId), (entry) => entry.name)}` : ""}
            </h3>
            {classSubjectsLoading ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</span> : null}
          </div>
          {classSubjectsError ? (
            <p style={{ margin: 0, fontSize: 13, color: "#dc2626" }}>{classSubjectsError}</p>
          ) : classSubjectsLoading ? null : resolvedClassSubjects.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>No subjects assigned to this class</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {resolvedClassSubjects.map((subject) => (
                <li key={subject.id} style={{ padding: "4px 10px", border: "1px solid var(--line)", borderRadius: 999, background: "var(--surface-muted)", fontSize: 12, color: "var(--text)" }}>
                  <strong>{subject.name}</strong>
                  {subject.code ? <span style={{ marginLeft: 6, color: "var(--text-muted)" }}>({subject.code})</span> : null}
                  {subject.teacher && subject.teacher !== "—" ? <span style={{ marginLeft: 6, color: "var(--text-muted)" }}>· {subject.teacher}</span> : null}
                  {subject.optional ? <span style={{ marginLeft: 6, color: "#b45309" }}>· optional</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Class</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Section</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Teacher</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={4} style={{ padding: 12 }}>Loading...</td></tr> : null}
            {!loading && paginatedItems.length === 0 ? <tr><td colSpan={4} style={{ padding: 12, color: "var(--text-muted)" }}>No class teacher assignments found.</td></tr> : null}
            {!loading && paginatedItems.map((row) => {
              const classValue = toId(row.class_id) ?? toId(row.school_class);
              const sectionValue = toId(row.section_id) ?? toId(row.section);
              const teacherValue = toId(row.teacher_id) ?? toId(row.teacher);
              return (
                <tr key={row.id}>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{nameById(data.classes, classValue, (entry) => entry.name)}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{nameById(data.sections, sectionValue, (entry) => entry.name)}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{nameById(data.teachers, teacherValue, teacherDisplayName)}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => setViewingRow(row)} style={{ height: 28, padding: "0 10px", border: "none", borderRadius: 6, background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: 12 }}>View</button>
                    <button type="button" onClick={() => edit(row)} style={{ height: 28, padding: "0 10px", border: "none", borderRadius: 6, background: "#0284c7", color: "#fff", cursor: "pointer", fontSize: 12 }}>Edit</button>
                    <button type="button" onClick={() => setDeleteCandidate(row)} style={{ height: 28, padding: "0 10px", border: "none", borderRadius: 6, background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: 12 }}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 12, borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Rows per page</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ height: 34, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px", background: "var(--surface)" }}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setPage(1)} disabled={page <= 1} style={{ height: 34, padding: "0 12px", border: "1px solid #6b7280", background: "#6b7280", color: "#fff", borderRadius: 8, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.6 : 1 }}>First</button>
              <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} style={{ height: 34, padding: "0 12px", border: "1px solid #6b7280", background: "#6b7280", color: "#fff", borderRadius: 8, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.6 : 1 }}>Previous</button>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Page {page} of {totalPages}</span>
              <button type="button" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} style={{ height: 34, padding: "0 12px", border: "1px solid #6b7280", background: "#6b7280", color: "#fff", borderRadius: 8, cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.6 : 1 }}>Next</button>
              <button type="button" onClick={() => setPage(totalPages)} disabled={page >= totalPages} style={{ height: 34, padding: "0 12px", border: "1px solid #6b7280", background: "#6b7280", color: "#fff", borderRadius: 8, cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.6 : 1 }}>Last</button>
            </div>
          </div>
        ) : null}
      </div>

      {viewingRow && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 10, padding: 20, maxWidth: 500, width: "90%", maxHeight: "80vh", overflow: "auto" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600 }}>Class Teacher Assignment Details</h2>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Academic Year</label>
                <div style={{ fontSize: 14, marginTop: 4 }}>{nameById(data.years, viewingRow.academic_year_id, (entry) => entry.name)}</div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Class</label>
                <div style={{ fontSize: 14, marginTop: 4 }}>{nameById(data.classes, toId(viewingRow.class_id) ?? toId(viewingRow.school_class), (entry) => entry.name)}</div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Section</label>
                <div style={{ fontSize: 14, marginTop: 4 }}>{nameById(data.sections, toId(viewingRow.section_id) ?? toId(viewingRow.section), (entry) => entry.name)}</div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Class Teacher</label>
                <div style={{ fontSize: 14, marginTop: 4 }}>{nameById(data.teachers, toId(viewingRow.teacher_id) ?? toId(viewingRow.teacher), teacherDisplayName)}</div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Status</label>
                <div style={{ fontSize: 14, marginTop: 4, color: viewingRow.active_status ? "#16a34a" : "#dc2626" }}>{viewingRow.active_status ? "Active" : "Inactive"}</div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Assigned Subjects</label>
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  {classSubjectsLoading ? (
                    <span style={{ color: "var(--text-muted)" }}>Loading subjects…</span>
                  ) : classSubjectsError ? (
                    <span style={{ color: "#dc2626" }}>{classSubjectsError}</span>
                  ) : resolvedClassSubjects.length === 0 ? (
                    <span style={{ color: "var(--text-muted)" }}>No subjects assigned to this class</span>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                      {resolvedClassSubjects.map((subject) => (
                        <li key={subject.id} style={{ padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--surface-muted)" }}>
                          <strong>{subject.name}</strong>
                          {subject.code ? <span style={{ marginLeft: 6, color: "var(--text-muted)" }}>({subject.code})</span> : null}
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                            Teacher: {subject.teacher}{subject.optional ? " · Optional" : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setViewingRow(null)} style={{ height: 36, padding: "0 16px", border: "none", borderRadius: 6, background: "#6b7280", color: "#fff", cursor: "pointer", fontSize: 13 }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {deleteCandidate ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ width: "min(480px, calc(100vw - 24px))", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, boxShadow: "0 12px 30px rgba(0,0,0,.18)" }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Delete Assignment</h3>
            <p style={{ marginTop: 10, marginBottom: 14, color: "var(--text-muted)" }}>Are you sure you want to delete this class teacher assignment?</p>
            <div style={{ marginBottom: 14, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface-muted)", fontSize: 13 }}>
              <div><strong>{nameById(data.classes, toId(deleteCandidate.class_id) ?? toId(deleteCandidate.school_class), (entry) => entry.name)}</strong>
                {(() => {
                  const sec = nameById(data.sections, toId(deleteCandidate.section_id) ?? toId(deleteCandidate.section), (entry) => entry.name);
                  return sec && sec !== "-" ? <span style={{ color: "var(--text-muted)" }}> – {sec}</span> : null;
                })()}
              </div>
              <div style={{ color: "var(--text-muted)", marginTop: 4 }}>
                Teacher: {nameById(data.teachers, toId(deleteCandidate.teacher_id) ?? toId(deleteCandidate.teacher), teacherDisplayName)}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setDeleteCandidate(null)} style={{ height: 36, padding: "0 14px", background: "#64748b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
              <button
                type="button"
                onClick={() => {
                  const target = deleteCandidate;
                  setDeleteCandidate(null);
                  if (target) void remove(target);
                }}
                style={{ height: 36, padding: "0 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function extractSubjectFieldErrors(details: unknown, fallbackMessage: string): { academic_year?: string; class_id?: string; section_id?: string; subject_id?: string; teacher_id?: string } {
  const errors: { academic_year?: string; class_id?: string; section_id?: string; subject_id?: string; teacher_id?: string } = {};
  if (!details || typeof details !== "object") {
    return errors;
  }

  const payload = details as Record<string, unknown>;
  const rawErrors = payload.errors;
  if (!rawErrors || typeof rawErrors !== "object" || Array.isArray(rawErrors)) {
    return errors;
  }

  const source = rawErrors as Record<string, unknown>;
  const pick = (key: string): string | undefined => {
    const value = source[key];
    if (!value) return undefined;
    if (Array.isArray(value) && value.length) return String(value[0]);
    return typeof value === "string" ? value : undefined;
  };

  errors.academic_year = pick("academic_year") || pick("academic_year_id");
  errors.class_id = pick("school_class") || pick("class_id");
  errors.section_id = pick("section") || pick("section_id");
  errors.subject_id = pick("subject") || pick("subject_id");
  errors.teacher_id = pick("teacher") || pick("teacher_id");

  const topMessage = typeof payload.message === "string" ? payload.message : "";
  if (!errors.teacher_id && (topMessage.toLowerCase().includes("teacher") || fallbackMessage.toLowerCase().includes("teacher"))) {
    errors.teacher_id = topMessage || fallbackMessage;
  }
  if (!errors.class_id && topMessage.toLowerCase().includes("class") && !topMessage.toLowerCase().includes("teacher")) {
    errors.class_id = topMessage;
  }
  if (!errors.section_id && topMessage.toLowerCase().includes("section")) {
    errors.section_id = topMessage;
  }
  if (!errors.subject_id && topMessage.toLowerCase().includes("subject")) {
    errors.subject_id = topMessage;
  }
  if (!errors.academic_year && topMessage.toLowerCase().includes("academic year")) {
    errors.academic_year = topMessage;
  }

  return errors;
}

function extractClassRoutineFieldErrors(details: unknown, fallbackMessage: string): {
  class_id?: string;
  section_id?: string;
  subject_id?: string;
  teacher_id?: string;
  day?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
} {
  const errors: {
    class_id?: string;
    section_id?: string;
    subject_id?: string;
    teacher_id?: string;
    day?: string;
    start_time?: string;
    end_time?: string;
    room?: string;
  } = {};

  if (!details || typeof details !== "object") {
    return errors;
  }

  const payload = details as Record<string, unknown>;
  const rawErrors = payload.errors;
  if (!rawErrors || typeof rawErrors !== "object" || Array.isArray(rawErrors)) {
    return errors;
  }

  const source = rawErrors as Record<string, unknown>;
  const pick = (key: string): string | undefined => {
    const value = source[key];
    if (!value) return undefined;
    if (Array.isArray(value) && value.length) return String(value[0]);
    return typeof value === "string" ? value : undefined;
  };

  errors.class_id = pick("school_class") || pick("class_id");
  errors.section_id = pick("section") || pick("section_id");
  errors.subject_id = pick("subject") || pick("subject_id");
  errors.teacher_id = pick("teacher") || pick("teacher_id");
  errors.day = pick("day");
  errors.start_time = pick("start_time");
  errors.end_time = pick("end_time");
  errors.room = pick("room");

  const topMessage = typeof payload.message === "string" ? payload.message : fallbackMessage;
  const lowered = topMessage.toLowerCase();
  if (!errors.class_id && lowered.includes("class") && !lowered.includes("teacher")) errors.class_id = topMessage;
  if (!errors.section_id && lowered.includes("section")) errors.section_id = topMessage;
  if (!errors.subject_id && lowered.includes("subject")) errors.subject_id = topMessage;
  if (!errors.teacher_id && (lowered.includes("teacher") || lowered.includes("assigned"))) errors.teacher_id = topMessage;
  if (!errors.start_time && lowered.includes("start time")) errors.start_time = topMessage;
  if (!errors.end_time && lowered.includes("end time")) errors.end_time = topMessage;
  if (!errors.room && lowered.includes("room")) errors.room = topMessage;
  if (!errors.day && lowered.includes("day")) errors.day = topMessage;

  return errors;
}

export function AssignSubjectPanel() {
  const { data, error: lookupError } = useLookupData();
  const [items, setItems] = useState<ClassSubjectAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ academic_year?: string; class_id?: string; section_id?: string; subject_id?: string; teacher_id?: string }>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingRow, setViewingRow] = useState<ClassSubjectAssignment | null>(null);

  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [isOptional, setIsOptional] = useState(false);
  const [filterClassId, setFilterClassId] = useState("");
  const [filterSectionId, setFilterSectionId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const searchWithFilters = async () => {
    if (!filterClassId || !filterSectionId) {
      setError("Please select both class and section before searching.");
      return;
    }
    setPage(1);
    await load();
  };

  useEffect(() => {
    if (!yearId && data.years.length) {
      setYearId(initialYearId(data.years));
    }
  }, [data.years, yearId]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (filterClassId) params.set("class_id", filterClassId);
      if (filterSectionId) params.set("section_id", filterSectionId);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const response = await apiFetch<ApiList<ClassSubjectAssignment>>(`/api/v1/academics/class-subjects/${suffix}`);
      setItems(asList(response));
      setPage(1);
    } catch {
      setError("Unable to load subject assignments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const availableSections = useMemo(() => sectionOptionsForClass(data.sections, classId), [data.sections, classId]);
  const filterSections = useMemo(() => sectionOptionsForClass(data.sections, filterClassId), [data.sections, filterClassId]);
  const hasSubjectFieldError = Boolean(fieldErrors.academic_year || fieldErrors.class_id || fieldErrors.section_id || fieldErrors.subject_id || fieldErrors.teacher_id);
  const isEditMode = editingId !== null;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const resetForm = (clearNotice = true) => {
    setEditingId(null);
    setClassId("");
    setSectionId("");
    setSubjectId("");
    setTeacherId("");
    setIsOptional(false);
    setFieldErrors({});
    if (clearNotice) {
      setMessage("");
      setError("");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: { academic_year?: string; class_id?: string; section_id?: string; subject_id?: string; teacher_id?: string } = {};
    if (!yearId) nextErrors.academic_year = "Academic year is required";
    if (!classId) nextErrors.class_id = "Class is required";
    if (!sectionId) nextErrors.section_id = "Section is required";
    if (!subjectId) nextErrors.subject_id = "Subject is required";
    if (!teacherId) nextErrors.teacher_id = "Teacher is required";

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError("");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      setFieldErrors({});
      const payload = {
        academic_year_id: yearId ? Number(yearId) : null,
        class_id: Number(classId),
        section_id: sectionId ? Number(sectionId) : null,
        subject_id: Number(subjectId),
        teacher_id: Number(teacherId),
        is_optional: isOptional,
        active_status: true,
      };
      await apiFetch(editingId ? `/api/v1/academics/class-subjects/${editingId}/` : "/api/v1/academics/class-subjects/", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setMessage(editingId ? "Assignment updated." : "Subject assigned.");
      resetForm(false);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save subject assignment.";
      setError(msg);
      const details = err && typeof err === "object" && "details" in err ? (err as { details?: unknown }).details : undefined;
      const next = extractSubjectFieldErrors(details, msg);
      if (!next.academic_year && !next.class_id && !next.section_id && !next.subject_id && !next.teacher_id) {
        const lowered = msg.toLowerCase();
        if (lowered.includes("academic year")) next.academic_year = msg;
        if (lowered.includes("class") && !lowered.includes("teacher")) next.class_id = msg;
        if (lowered.includes("section")) next.section_id = msg;
        if (lowered.includes("subject")) next.subject_id = msg;
        if (lowered.includes("teacher") || lowered.includes("not a teacher")) next.teacher_id = msg;
      }
      setFieldErrors(next);
      setError(next.academic_year || next.class_id || next.section_id || next.subject_id || next.teacher_id ? "" : msg);
    } finally {
      setSaving(false);
    }
  };

  const edit = (row: ClassSubjectAssignment) => {
    setEditingId(row.id);
    setYearId(row.academic_year_id ? String(row.academic_year_id) : "");
    const mappedClass = toId(row.class_id) ?? toId(row.school_class);
    const mappedSection = toId(row.section_id) ?? toId(row.section);
    const mappedSubject = toId(row.subject_id) ?? toId(row.subject);
    const mappedTeacher = toId(row.teacher_id) ?? toId(row.teacher);
    setClassId(mappedClass ? String(mappedClass) : "");
    setSectionId(mappedSection ? String(mappedSection) : "");
    setSubjectId(mappedSubject ? String(mappedSubject) : "");
    setTeacherId(mappedTeacher ? String(mappedTeacher) : "");
    setIsOptional(!!row.is_optional);
    setMessage("");
    setError("");
    setFieldErrors({});
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const remove = async (row: ClassSubjectAssignment) => {
    const className = nameById(data.classes, toId(row.class_id) ?? toId(row.school_class), (entry) => entry.name);
    const teacherName = nameById(data.teachers, toId(row.teacher_id) ?? toId(row.teacher), teacherDisplayName);
    if (!window.confirm(`Delete assignment for ${className} - ${teacherName}?`)) return;
    try {
      setError("");
      await apiFetch(`/api/v1/academics/class-subjects/${row.id}/`, { method: "DELETE" });
      await load();
    } catch {
      setError("Failed to delete subject assignment.");
    }
  };

  return (
    <section>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Assign Subject</h1>
      </div>

      <div style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface)", padding: 12, marginBottom: 12 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Select Criteria</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Class</label>
            <select value={filterClassId} onChange={(e) => { setFilterClassId(e.target.value); setFilterSectionId(""); }} style={{ marginTop: 4, width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" }}>
              <option value="">All classes</option>
              {data.classes.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Section</label>
            <select value={filterSectionId} onChange={(e) => setFilterSectionId(e.target.value)} style={{ marginTop: 4, width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" }}>
              <option value="">All sections</option>
              {filterSections.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => void searchWithFilters()} style={{ height: 36, background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer" }}>Search</button>
          <button type="button" onClick={() => { setFilterClassId(""); setFilterSectionId(""); void load(); }} style={{ height: 36, background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer" }}>Reset</button>
        </div>
      </div>

      {isEditMode ? <p style={{ margin: "0 0 10px", color: "#0f766e", fontSize: 13, fontWeight: 600 }}>Edit mode active: update this subject mapping, or click Cancel to add a new mapping.</p> : null}
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto auto", gap: 8, marginBottom: 12, alignItems: "start" }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Academic Year</label>
          <select required value={yearId} onChange={(e) => { setYearId(e.target.value); setFieldErrors((prev) => ({ ...prev, academic_year: undefined })); }} style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${fieldErrors.academic_year ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px" }}>
            <option value="">Select year</option>
            {data.years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.academic_year || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Class</label>
          <select required value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); setFieldErrors((prev) => ({ ...prev, class_id: undefined, section_id: undefined })); }} style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${fieldErrors.class_id ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px" }}>
            <option value="">Select class</option>
            {data.classes.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.class_id || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Section</label>
          <select required value={sectionId} onChange={(e) => { setSectionId(e.target.value); setFieldErrors((prev) => ({ ...prev, section_id: undefined })); }} style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${fieldErrors.section_id ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px" }}>
            <option value="">Select section</option>
            {availableSections.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.section_id || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Subject</label>
          <select required value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setFieldErrors((prev) => ({ ...prev, subject_id: undefined })); }} style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${fieldErrors.subject_id ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px" }}>
            <option value="">Select subject</option>
            {data.subjects.map((row) => <option key={row.id} value={row.id}>{row.name}{row.code ? ` (${row.code})` : ""}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.subject_id || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Teacher</label>
          <select required value={teacherId} onChange={(e) => { setTeacherId(e.target.value); setFieldErrors((prev) => ({ ...prev, teacher_id: undefined })); }} style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${fieldErrors.teacher_id ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px" }}>
            <option value="">Select teacher</option>
            {data.teachers.map((row) => <option key={row.id} value={row.id}>{teacherDisplayName(row)}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.teacher_id || ""}</span>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 22, fontSize: 13 }}><input type="checkbox" checked={isOptional} onChange={(e) => setIsOptional(e.target.checked)} /> Optional</label>
        <button type="submit" disabled={saving} style={{ height: 36, background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", alignSelf: "start", marginTop: 22 }}>{saving ? "Saving..." : isEditMode ? "Update" : "Assign"}</button>
        <button type="button" onClick={() => { resetForm(); setYearId(initialYearId(data.years)); }} style={{ height: 36, background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", alignSelf: "start", marginTop: 22 }}>Reset</button>
        {isEditMode ? <button type="button" onClick={() => resetForm()} style={{ height: 36, background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", alignSelf: "start", marginTop: 22 }}>Cancel</button> : <span />}
      </form>

      {(lookupError || (error && !hasSubjectFieldError)) && <p style={{ color: "var(--warning)", margin: "8px 0" }}>{lookupError || error}</p>}
      {message && <p style={{ color: "#16a34a", margin: "8px 0" }}>{message}</p>}

      <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Class</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Section</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Subject</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Teacher</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Optional</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} style={{ padding: 12 }}>Loading...</td></tr> : null}
            {!loading && paginatedItems.length === 0 ? <tr><td colSpan={6} style={{ padding: 12, color: "var(--text-muted)" }}>No subject assignments found.</td></tr> : null}
            {!loading && paginatedItems.map((row) => {
              const classValue = toId(row.class_id) ?? toId(row.school_class);
              const sectionValue = toId(row.section_id) ?? toId(row.section);
              const subjectValue = toId(row.subject_id) ?? toId(row.subject);
              const teacherValue = toId(row.teacher_id) ?? toId(row.teacher);
              return (
                <tr key={row.id}>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{nameById(data.classes, classValue, (entry) => entry.name)}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{nameById(data.sections, sectionValue, (entry) => entry.name)}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{nameById(data.subjects, subjectValue, (entry) => entry.name)}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{nameById(data.teachers, teacherValue, teacherDisplayName)}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{row.is_optional ? "Yes" : "No"}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => setViewingRow(row)} style={{ height: 28, padding: "0 10px", border: "none", borderRadius: 6, background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: 12 }}>View</button>
                    <button type="button" onClick={() => edit(row)} style={{ height: 28, padding: "0 10px", border: "none", borderRadius: 6, background: "#0284c7", color: "#fff", cursor: "pointer", fontSize: 12 }}>Edit</button>
                    <button type="button" onClick={() => void remove(row)} style={{ height: 28, padding: "0 10px", border: "none", borderRadius: 6, background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: 12 }}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 12, flexWrap: "wrap", borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Rows per page</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ height: 34, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px", background: "var(--surface)" }}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setPage(1)} disabled={page <= 1} style={{ height: 34, padding: "0 12px", border: "1px solid #6b7280", background: "#6b7280", color: "#fff", borderRadius: 8, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.6 : 1 }}>First</button>
              <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} style={{ height: 34, padding: "0 12px", border: "1px solid #6b7280", background: "#6b7280", color: "#fff", borderRadius: 8, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.6 : 1 }}>Previous</button>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Page {page} of {totalPages}</span>
              <button type="button" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} style={{ height: 34, padding: "0 12px", border: "1px solid #6b7280", background: "#6b7280", color: "#fff", borderRadius: 8, cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.6 : 1 }}>Next</button>
              <button type="button" onClick={() => setPage(totalPages)} disabled={page >= totalPages} style={{ height: 34, padding: "0 12px", border: "1px solid #6b7280", background: "#6b7280", color: "#fff", borderRadius: 8, cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.6 : 1 }}>Last</button>
            </div>
          </div>
        )}
      </div>

      {viewingRow && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 10, padding: 20, maxWidth: 500, width: "90%", maxHeight: "80vh", overflow: "auto" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600 }}>Subject Assignment Details</h2>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Academic Year</label>
                <div style={{ fontSize: 14, marginTop: 4 }}>{nameById(data.years, viewingRow.academic_year_id, (entry) => entry.name)}</div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Class</label>
                <div style={{ fontSize: 14, marginTop: 4 }}>{nameById(data.classes, toId(viewingRow.class_id) ?? toId(viewingRow.school_class), (entry) => entry.name)}</div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Section</label>
                <div style={{ fontSize: 14, marginTop: 4 }}>{nameById(data.sections, toId(viewingRow.section_id) ?? toId(viewingRow.section), (entry) => entry.name)}</div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Subject</label>
                <div style={{ fontSize: 14, marginTop: 4 }}>{nameById(data.subjects, toId(viewingRow.subject_id) ?? toId(viewingRow.subject), (entry) => entry.name)}</div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Teacher</label>
                <div style={{ fontSize: 14, marginTop: 4 }}>{nameById(data.teachers, toId(viewingRow.teacher_id) ?? toId(viewingRow.teacher), teacherDisplayName)}</div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Optional</label>
                <div style={{ fontSize: 14, marginTop: 4 }}>{viewingRow.is_optional ? "Yes" : "No"}</div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Status</label>
                <div style={{ fontSize: 14, marginTop: 4, color: viewingRow.active_status ? "#16a34a" : "#dc2626" }}>{viewingRow.active_status ? "Active" : "Inactive"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setViewingRow(null)} style={{ height: 36, padding: "0 16px", border: "none", borderRadius: 6, background: "#6b7280", color: "#fff", cursor: "pointer", fontSize: 13 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function ClassRoomPanel() {
  const [items, setItems] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ room_no?: string; capacity?: string }>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [touched, setTouched] = useState<{ room_no: boolean; capacity: boolean }>({ room_no: false, capacity: false });

  const [roomNo, setRoomNo] = useState("");
  const [capacity, setCapacity] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const sortedItems = useMemo(() => sortClassRooms(items), [items]);
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [page, sortedItems]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetchAllPages<ClassRoom>("/api/v1/core/class-rooms/?page_size=100");
      setItems(sortClassRooms(response));
      setPage(1);
    } catch {
      setError("Unable to load class rooms.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = (clearNotice = true) => {
    setEditingId(null);
    setRoomNo("");
    setCapacity("");
    setFieldErrors({});
    setTouched({ room_no: false, capacity: false });
    if (clearNotice) {
      setMessage("");
      setError("");
    }
  };

  const extractRoomFieldErrors = (details: unknown, fallbackMessage: string): { room_no?: string; capacity?: string } => {
    const next: { room_no?: string; capacity?: string } = {};
    if (!details || typeof details !== "object") return next;

    const payload = details as Record<string, unknown>;
    const rawErrors = payload.errors;
    if (!rawErrors || typeof rawErrors !== "object" || Array.isArray(rawErrors)) {
      return next;
    }

    const source = rawErrors as Record<string, unknown>;
    const pick = (key: string): string | undefined => {
      const value = source[key];
      if (!value) return undefined;
      if (Array.isArray(value) && value.length) return String(value[0]);
      return typeof value === "string" ? value : undefined;
    };

    next.room_no = pick("room_no");
    next.capacity = pick("capacity");

    const message = typeof payload.message === "string" ? payload.message : fallbackMessage;
    const lowered = message.toLowerCase();
    if (!next.room_no && lowered.includes("room")) {
      next.room_no = message;
    }
    if (!next.capacity && lowered.includes("capacity")) {
      next.capacity = message;
    }

    return next;
  };

  const normalizedRoomNo = roomNo.trim().toUpperCase();
  const capacityValue = capacity === "" ? NaN : Number(capacity);
  const isCapacityNumber = Number.isInteger(capacityValue);
  const roomNoClientError = !normalizedRoomNo
    ? "Room no is required"
    : !/^[A-Z0-9][A-Z0-9\- ]{0,49}$/.test(normalizedRoomNo)
      ? "Enter a valid room number."
      : "";
  const capacityClientError = !capacity
    ? "Capacity is required"
    : !isCapacityNumber
      ? "Capacity must be numeric"
      : capacityValue <= 0
        ? "Capacity must be greater than zero"
        : capacityValue > 200
          ? "Capacity must not exceed 200"
          : "";
  const isFormInvalid = Boolean(roomNoClientError || capacityClientError);
  const roomNoInlineError = fieldErrors.room_no || (touched.room_no ? roomNoClientError : "");
  const capacityInlineError = fieldErrors.capacity || (touched.capacity ? capacityClientError : "");
  const hasRoomFieldError = Boolean(roomNoInlineError || capacityInlineError);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: { room_no?: string; capacity?: string } = {};
    if (roomNoClientError) nextErrors.room_no = roomNoClientError;
    if (capacityClientError) nextErrors.capacity = capacityClientError;

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setTouched({ room_no: true, capacity: true });
      setError("");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      setFieldErrors({});
      const payload = {
        room_no: normalizedRoomNo,
        capacity: capacityValue,
        active_status: true,
      };
      await apiFetch(editingId ? `/api/v1/core/class-rooms/${editingId}/` : "/api/v1/core/class-rooms/", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setMessage(editingId ? "Class room updated." : "Class room created.");
      resetForm(false);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save class room.";
      const details = err && typeof err === "object" && "details" in err ? (err as { details?: unknown }).details : undefined;
      const extracted = extractRoomFieldErrors(details, msg);
      setFieldErrors(extracted);
      setError(extracted.room_no || extracted.capacity ? "" : msg);
    } finally {
      setSaving(false);
    }
  };

  const edit = (row: ClassRoom) => {
    setEditingId(row.id);
    setRoomNo(row.room_no || "");
    setCapacity(row.capacity != null ? String(row.capacity) : "");
    setMessage("");
    setError("");
    setFieldErrors({});
    setTouched({ room_no: false, capacity: false });
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this class room?")) return;
    try {
      setError("");
      await apiFetch(`/api/v1/core/class-rooms/${id}/`, { method: "DELETE" });
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete class room.";
      setError(msg);
    }
  };

  return (
    <section>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Class Room</h1>
      </div>

      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 160px auto auto", gap: 8, marginBottom: 12, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Room No</label>
          <input value={roomNo} onChange={(e) => { setRoomNo(e.target.value.toUpperCase()); setFieldErrors((prev) => ({ ...prev, room_no: undefined })); setError(""); }} onBlur={() => setTouched((prev) => ({ ...prev, room_no: true }))} placeholder="Enter room number (e.g. A-101)" style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${roomNoInlineError ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px" }} />
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{roomNoInlineError || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Capacity</label>
          <input type="number" min={1} max={200} value={capacity} onChange={(e) => { setCapacity(e.target.value); setFieldErrors((prev) => ({ ...prev, capacity: undefined })); setError(""); }} onBlur={() => setTouched((prev) => ({ ...prev, capacity: true }))} placeholder="Enter capacity (1-200)" style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${capacityInlineError ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px" }} />
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{capacityInlineError || ""}</span>
        </div>
        <div style={{ alignSelf: "start", marginTop: 22 }}>
          <button type="submit" disabled={saving || isFormInvalid} style={{ height: 36, background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: saving || isFormInvalid ? "not-allowed" : "pointer", opacity: saving || isFormInvalid ? 0.6 : 1 }}>{saving ? "Saving..." : editingId ? "Update" : "Add"}</button>
        </div>
        {editingId ? <div style={{ alignSelf: "start", marginTop: 22 }}><button type="button" onClick={() => resetForm()} style={{ height: 36, background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer" }}>Cancel</button></div> : null}
      </form>

      {error && !hasRoomFieldError && <p style={{ color: "var(--warning)", margin: "8px 0" }}>{error}</p>}
      {message && <p style={{ color: "#16a34a", margin: "8px 0" }}>{message}</p>}

      <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Room No</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Capacity</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={3} style={{ padding: 12 }}>Loading...</td></tr> : null}
            {!loading && pagedItems.length === 0 ? <tr><td colSpan={3} style={{ padding: 12, color: "var(--text-muted)" }}>No class room found.</td></tr> : null}
            {!loading && pagedItems.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{row.room_no}</td>
                <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{row.capacity ?? "-"}</td>
                <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => edit(row)} style={{ height: 28, padding: "0 10px", border: "none", borderRadius: 6, background: "#0284c7", color: "#fff", cursor: "pointer", fontSize: 12 }}>Edit</button>
                  <button type="button" onClick={() => void remove(row.id)} style={{ height: 28, padding: "0 10px", border: "none", borderRadius: 6, background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: 12 }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedItems.length > pageSize ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Showing {sortedItems.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, sortedItems.length)} of {sortedItems.length}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} style={{ height: 32, padding: "0 12px", border: "1px solid var(--line)", borderRadius: 8, background: page <= 1 ? "#e5e7eb" : "#fff", color: "var(--text)", cursor: page <= 1 ? "not-allowed" : "pointer" }}>Previous</button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} style={{ height: 32, padding: "0 12px", border: "1px solid var(--line)", borderRadius: 8, background: page >= totalPages ? "#e5e7eb" : "#fff", color: "var(--text)", cursor: page >= totalPages ? "not-allowed" : "pointer" }}>Next</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ClassRoutinePanel() {
  const { data, error: lookupError } = useLookupData();
  const [items, setItems] = useState<ClassRoutineSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ class_id?: string; section_id?: string; subject_id?: string; teacher_id?: string; day?: string; start_time?: string; end_time?: string; room?: string }>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [day, setDay] = useState("monday");
  const [periodId, setPeriodId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [roomId, setRoomId] = useState("");
  const [roomText, setRoomText] = useState("");
  const [isBreak, setIsBreak] = useState(false);
  const [filterClassId, setFilterClassId] = useState("");
  const [filterSectionId, setFilterSectionId] = useState("");
  const [activeDayTab, setActiveDayTab] = useState("monday");

  useEffect(() => {
    if (!yearId && data.years.length) {
      setYearId(initialYearId(data.years));
    }
  }, [data.years, yearId]);

  useEffect(() => {
    if (!periodId) return;
    const selected = data.periods.find((period) => period.id === Number(periodId));
    if (!selected) return;
    setStartTime(selected.start_time?.slice(0, 5) || "");
    setEndTime(selected.end_time?.slice(0, 5) || "");
  }, [periodId, data.periods]);

  const load = async (overrides?: { classId?: string; sectionId?: string; day?: string }) => {
    try {
      setLoading(true);
      setError("");
      const classFilter = overrides?.classId ?? filterClassId;
      const sectionFilter = overrides?.sectionId ?? filterSectionId;
      const dayFilter = overrides?.day ?? activeDayTab;
      const params = new URLSearchParams();
      if (classFilter) params.set("class_id", classFilter);
      if (sectionFilter) params.set("section_id", sectionFilter);
      if (dayFilter) params.set("day", dayFilter);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const response = await apiFetch<ApiList<ClassRoutineSlot>>(`/api/v1/academics/class-routines/${suffix}`);
      setItems(asList(response));
    } catch {
      setError("Unable to load class routine.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void load();
  }, [activeDayTab]);

  const availableSections = useMemo(() => sectionOptionsForClass(data.sections, classId), [data.sections, classId]);
  const filterSections = useMemo(() => sectionOptionsForClass(data.sections, filterClassId), [data.sections, filterClassId]);
  const hasRoutineFieldError = Boolean(fieldErrors.class_id || fieldErrors.section_id || fieldErrors.subject_id || fieldErrors.teacher_id || fieldErrors.day || fieldErrors.start_time || fieldErrors.end_time || fieldErrors.room);
  const isRoutineFormInvalid = Boolean(
    !classId ||
    !sectionId ||
    !day ||
    !startTime ||
    !endTime ||
    (!isBreak && (!subjectId || !teacherId)) ||
    (isBreak && (subjectId || teacherId))
  );

  const resetForm = (clearNotice = true) => {
    setEditingId(null);
    setClassId("");
    setSectionId("");
    setSubjectId("");
    setTeacherId("");
    setDay("monday");
    setPeriodId("");
    setStartTime("");
    setEndTime("");
    setRoomId("");
    setRoomText("");
    setIsBreak(false);
    setFieldErrors({});
    if (clearNotice) {
      setMessage("");
      setError("");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: { class_id?: string; section_id?: string; subject_id?: string; teacher_id?: string; day?: string; start_time?: string; end_time?: string; room?: string } = {};
    if (!classId) nextErrors.class_id = "Class is required";
    if (!sectionId) nextErrors.section_id = "Section is required";
    if (!day) nextErrors.day = "Day is required";
    if (!startTime) nextErrors.start_time = "Start time is required";
    if (!endTime) nextErrors.end_time = "End time is required";
    if (!isBreak && !subjectId) nextErrors.subject_id = "Subject is required";
    if (!isBreak && !teacherId) nextErrors.teacher_id = "Teacher is required";
    if (isBreak && subjectId) nextErrors.subject_id = "Break should not have a subject";
    if (isBreak && teacherId) nextErrors.teacher_id = "Break should not have a teacher";

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError("");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      setFieldErrors({});
      const roomName = roomText.trim() || nameById(data.rooms, roomId ? Number(roomId) : null, (entry) => entry.room_no);
      const payload = {
        academic_year_id: yearId ? Number(yearId) : null,
        class_id: Number(classId),
        section_id: sectionId ? Number(sectionId) : null,
        subject_id: isBreak ? null : Number(subjectId),
        teacher_id: isBreak ? null : (teacherId ? Number(teacherId) : null),
        day,
        class_period_id: periodId ? Number(periodId) : null,
        start_time: startTime,
        end_time: endTime,
        room_id: roomId ? Number(roomId) : null,
        room: roomName || "",
        is_break: isBreak,
        active_status: true,
      };
      await apiFetch(editingId ? `/api/v1/academics/class-routines/${editingId}/` : "/api/v1/academics/class-routines/", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setMessage(editingId ? "Class routine updated." : "Class routine saved.");
      resetForm(false);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save class routine.";
      const details = err && typeof err === "object" && "details" in err ? (err as { details?: unknown }).details : undefined;
      const extracted = extractClassRoutineFieldErrors(details, msg);
      setFieldErrors(extracted);
      setError(extracted.class_id || extracted.section_id || extracted.subject_id || extracted.teacher_id || extracted.day || extracted.start_time || extracted.end_time || extracted.room ? "" : msg);
    } finally {
      setSaving(false);
    }
  };

  const edit = (row: ClassRoutineSlot) => {
    setEditingId(row.id);
    setYearId(row.academic_year_id ? String(row.academic_year_id) : "");
    const mappedClass = toId(row.class_id) ?? toId(row.school_class);
    const mappedSection = toId(row.section_id) ?? toId(row.section);
    const mappedSubject = toId(row.subject_id) ?? toId(row.subject);
    const mappedTeacher = toId(row.teacher_id) ?? toId(row.teacher);
    setClassId(mappedClass ? String(mappedClass) : "");
    setSectionId(mappedSection ? String(mappedSection) : "");
    setSubjectId(mappedSubject ? String(mappedSubject) : "");
    setTeacherId(mappedTeacher ? String(mappedTeacher) : "");
    setDay(row.day || "monday");
    setPeriodId(row.class_period_id ? String(row.class_period_id) : "");
    setStartTime(row.start_time?.slice(0, 5) || "");
    setEndTime(row.end_time?.slice(0, 5) || "");
    setRoomId(row.room_id ? String(row.room_id) : "");
    setRoomText(row.room || "");
    setIsBreak(!!row.is_break);
    setActiveDayTab(row.day || "monday");
    setMessage("");
    setError("");
    setFieldErrors({});
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this class routine slot?")) return;
    try {
      setError("");
      await apiFetch(`/api/v1/academics/class-routines/${id}/`, { method: "DELETE" });
      await load();
    } catch {
      setError("Failed to delete class routine slot.");
    }
  };

  const dayOptions = [
    { value: "monday", label: "Monday" },
    { value: "tuesday", label: "Tuesday" },
    { value: "wednesday", label: "Wednesday" },
    { value: "thursday", label: "Thursday" },
    { value: "friday", label: "Friday" },
    { value: "saturday", label: "Saturday" },
    { value: "sunday", label: "Sunday" },
  ];

  return (
    <section>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Class Routine</h1>
      </div>

      <div style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface)", padding: 12, marginBottom: 12 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Select Criteria</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Class</label>
            <select value={filterClassId} onChange={(e) => { setFilterClassId(e.target.value); setFilterSectionId(""); }} style={{ marginTop: 4, width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" }}>
              <option value="">All classes</option>
              {data.classes.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Section</label>
            <select value={filterSectionId} onChange={(e) => setFilterSectionId(e.target.value)} style={{ marginTop: 4, width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" }}>
              <option value="">All sections</option>
              {filterSections.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => void load()} style={{ height: 36, background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer" }}>Search</button>
          <button type="button" onClick={() => { setFilterClassId(""); setFilterSectionId(""); setActiveDayTab("monday"); void load({ classId: "", sectionId: "", day: "monday" }); }} style={{ height: 36, background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer" }}>Reset</button>
        </div>
      </div>

      <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--text-muted)" }}>* Marked fields are required.</p>
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Academic Year</label>
          <select value={yearId} onChange={(e) => setYearId(e.target.value)} style={{ marginTop: 4, width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" }}>
            <option value="">Select year</option>
            {data.years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Class *</label>
          <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); setFieldErrors((prev) => ({ ...prev, class_id: undefined, section_id: undefined })); }} style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${fieldErrors.class_id ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px" }}>
            <option value="">Select class</option>
            {data.classes.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.class_id || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Section *</label>
          <select value={sectionId} onChange={(e) => { setSectionId(e.target.value); setFieldErrors((prev) => ({ ...prev, section_id: undefined })); }} style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${fieldErrors.section_id ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px" }}>
            <option value="">All sections</option>
            {availableSections.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.section_id || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Subject {isBreak ? "" : "*"}</label>
          <select value={subjectId} disabled={isBreak} onChange={(e) => { setSubjectId(e.target.value); setFieldErrors((prev) => ({ ...prev, subject_id: undefined })); }} style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${fieldErrors.subject_id ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px", opacity: isBreak ? 0.7 : 1 }}>
            <option value="">{isBreak ? "Not required for break" : "Select subject"}</option>
            {data.subjects.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.subject_id || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Teacher {isBreak ? "" : "*"}</label>
          <select value={teacherId} disabled={isBreak} onChange={(e) => { setTeacherId(e.target.value); setFieldErrors((prev) => ({ ...prev, teacher_id: undefined })); }} style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${fieldErrors.teacher_id ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px", opacity: isBreak ? 0.7 : 1 }}>
            <option value="">{isBreak ? "Not required for break" : "Select teacher"}</option>
            {data.teachers.map((row) => <option key={row.id} value={row.id}>{row.full_name || row.username}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.teacher_id || ""}</span>
        </div>

        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Day *</label>
          <select value={day} onChange={(e) => { setDay(e.target.value); setFieldErrors((prev) => ({ ...prev, day: undefined })); }} style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${fieldErrors.day ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px" }}>
            {dayOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.day || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Class Period</label>
          <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} style={{ marginTop: 4, width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" }}>
            <option value="">Custom time</option>
            {data.periods.map((row) => <option key={row.id} value={row.id}>{row.period}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: 'block', marginBottom: 6, fontWeight: 600 }}>Start *</label>
            <TimeSpinnerPicker value={startTime} onChange={(value) => { setStartTime(value); setFieldErrors((prev) => ({ ...prev, start_time: undefined })); }} />
            <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.start_time || ""}</span>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: 'block', marginBottom: 6, fontWeight: 600 }}>End *</label>
            <TimeSpinnerPicker value={endTime} onChange={(value) => { setEndTime(value); setFieldErrors((prev) => ({ ...prev, end_time: undefined })); }} />
            <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.end_time || ""}</span>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Room</label>
          <select value={roomId} onChange={(e) => { setRoomId(e.target.value); setRoomText(""); setFieldErrors((prev) => ({ ...prev, room: undefined })); }} style={{ marginTop: 4, width: "100%", height: 36, border: `1px solid ${fieldErrors.room ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px" }}>
            <option value="">Select room</option>
            {data.rooms.filter((room) => room.active_status).map((row) => <option key={row.id} value={row.id}>{row.room_no}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.room || ""}</span>
        </div>

        <div style={{ gridColumn: "1 / span 2" }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Room Text (optional)</label>
          <input value={roomText} onChange={(e) => setRoomText(e.target.value)} placeholder="Override room label" style={{ marginTop: 4, width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 24, fontSize: 13 }}><input type="checkbox" checked={isBreak} onChange={(e) => { const checked = e.target.checked; setIsBreak(checked); if (checked) { setSubjectId(""); setTeacherId(""); setFieldErrors((prev) => ({ ...prev, subject_id: undefined, teacher_id: undefined })); } }} /> Break</label>
        <button type="submit" disabled={saving || isRoutineFormInvalid} style={{ height: 36, background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: saving || isRoutineFormInvalid ? "not-allowed" : "pointer", marginTop: 24, opacity: saving || isRoutineFormInvalid ? 0.6 : 1 }}>{saving ? "Saving..." : editingId ? "Update" : "Save"}</button>
        {editingId ? <button type="button" onClick={() => resetForm()} style={{ height: 36, background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", marginTop: 24 }}>Cancel</button> : null}
      </form>

      {(lookupError || (error && !hasRoutineFieldError)) && <p style={{ color: "var(--warning)", margin: "8px 0" }}>{lookupError || error}</p>}
      {message && <p style={{ color: "#16a34a", margin: "8px 0" }}>{message}</p>}

      <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--line)", marginBottom: 10, overflowX: "auto" }}>
        {dayOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setActiveDayTab(option.value)}
            style={{
              height: 34,
              padding: "0 12px",
              border: "none",
              borderBottom: activeDayTab === option.value ? "2px solid var(--primary)" : "2px solid transparent",
              background: "transparent",
              color: activeDayTab === option.value ? "var(--primary)" : "var(--text-muted)",
              fontWeight: activeDayTab === option.value ? 600 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Class</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Section</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Time</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Subject</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Teacher</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Room</th>
              <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{ padding: 12 }}>Loading...</td></tr> : null}
            {!loading && items.length === 0 ? <tr><td colSpan={7} style={{ padding: 12, color: "var(--text-muted)" }}>No class routine slots found for {dayOptions.find((d) => d.value === activeDayTab)?.label}.</td></tr> : null}
            {!loading && items.map((row) => {
              const classValue = toId(row.class_id) ?? toId(row.school_class);
              const sectionValue = toId(row.section_id) ?? toId(row.section);
              const subjectValue = toId(row.subject_id) ?? toId(row.subject);
              const teacherValue = toId(row.teacher_id) ?? toId(row.teacher);
              const roomLabel = row.room || nameById(data.rooms, row.room_id, (entry) => entry.room_no);
              return (
                <tr key={row.id}>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{nameById(data.classes, classValue, (entry) => entry.name)}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{nameById(data.sections, sectionValue, (entry) => entry.name)}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{row.start_time?.slice(0, 5)} - {row.end_time?.slice(0, 5)}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{nameById(data.subjects, subjectValue, (entry) => entry.name)}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{nameById(data.teachers, teacherValue, teacherDisplayName)}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{roomLabel || "-"}</td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => edit(row)} style={{ height: 28, padding: "0 10px", border: "none", borderRadius: 6, background: "#0284c7", color: "#fff", cursor: "pointer", fontSize: 12 }}>Edit</button>
                    <button type="button" onClick={() => void remove(row.id)} style={{ height: 28, padding: "0 10px", border: "none", borderRadius: 6, background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: 12 }}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
