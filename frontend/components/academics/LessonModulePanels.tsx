"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { getAccessToken, getRefreshToken, setAuthTokens, clearAuthTokens } from "@/lib/auth";
import { sortAcademicsClasses } from "@/lib/classOrdering";

type AcademicYear = { id: number; name: string; is_current: boolean };
type SchoolClass = { id: number; name: string; class_name?: string };
type Section = { id: number; school_class: number; name: string; section_name?: string };
type Subject = { id: number; name: string; subject_name?: string };
type ClassPeriod = { id: number; period: string; start_time: string; end_time: string; period_type: string; is_break: boolean };

type Lesson = {
  id: number;
  academic_year_id?: number | null;
  class_id?: number;
  section_id?: number | null;
  subject_id?: number;
  lesson_title: string;
  class_name?: string;
  section_name?: string;
  subject_name?: string;
  lesson_name?: string;
};

type LessonTopicDetail = {
  id: number;
  topic: number;
  lesson: number;
  topic_title: string;
  lesson_name?: string;
};

type LessonTopicGroup = {
  id: number;
  class_id?: number;
  section_id?: number;
  subject_id?: number;
  lesson_id?: number;
  class_name?: string;
  section_name?: string;
  subject_name?: string;
  lesson_name?: string;
  topics?: LessonTopicDetail[];
};

type PlannerTopicRow = { id: number; topic_id: number; sub_topic_title: string };

type PlannerRow = {
  id: number;
  lesson_date: string;
  day: number | null;
  lesson_detail_id: number;
  topic_detail_id: number | null;
  sub_topic: string;
  teacher_id: number | null;
  class_id: number;
  section_id: number | null;
  subject_id: number;
  routine_id: number | null;
  class_period_id?: number | null;
  academic_year_id?: number | null;
  class_name?: string;
  section_name?: string;
  subject_name?: string;
  lesson_name?: string;
  topic_name?: string;
  lesson_detail_name?: string;
  topic_detail_name?: string;
  teacher_name?: string;
  topics: PlannerTopicRow[];
};

type TeacherOption = {
  id: number;
  username: string;
  full_name: string;
};

type LessonGroup = {
  class_id: number;
  section_id: number | null;
  subject_id: number;
  class_name?: string;
  section_name?: string;
  subject_name?: string;
  lesson_name?: string;
  items: Lesson[];
};

type WeeklyPlanner = {
  start_date: string;
  end_date: string;
  days: Record<string, PlannerRow[]>;
};

type ApiList<T> = T[] | { results?: T[] };

type PagedList<T> = ApiList<T> & { next?: string | null };

type ApiErrorPayload = {
  success?: boolean;
  message?: string;
  detail?: string;
  errors?: Record<string, unknown>;
};

class ApiError extends Error {
  status: number;
  payload: ApiErrorPayload;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || payload.detail || `Request failed with status ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

async function readJsonResponse(response: Response): Promise<ApiErrorPayload | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as ApiErrorPayload;
  } catch {
    return { message: text };
  }
}

function toFieldErrors(errors: Record<string, unknown> | undefined): Record<string, string> {
  if (!errors) return {};
  const fieldErrors: Record<string, string> = {};
  for (const [key, value] of Object.entries(errors)) {
    if (Array.isArray(value)) {
      const first = value[0];
      if (typeof first === "string") {
        fieldErrors[key] = first;
      }
    } else if (typeof value === "string") {
      fieldErrors[key] = value;
    }
  }
  return fieldErrors;
}

function getApiError(error: unknown): { message: string; fieldErrors: Record<string, string> } {
  if (error instanceof ApiError) {
    return {
      message: error.payload.message || error.payload.detail || error.message,
      fieldErrors: toFieldErrors(error.payload.errors),
    };
  }
  if (error instanceof Error) {
    return { message: error.message, fieldErrors: {} };
  }
  return { message: "Request failed.", fieldErrors: {} };
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) {
    clearAuthTokens();
    return null;
  }

  const data = (await res.json()) as { access?: string };
  if (!data.access) {
    clearAuthTokens();
    return null;
  }

  setAuthTokens(data.access, refresh);
  return data.access;
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function apiGet<T>(path: string): Promise<T> {
  let response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", headers: authHeaders() });
  
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", headers: authHeaders() });
    }
  }
  
  if (!response.ok) {
    const payload = await readJsonResponse(response);
    throw new ApiError(response.status, payload || {});
  }
  return (await response.json()) as T;
}

async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  let response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
    }
  }
  
  if (!response.ok) {
    const payload = await readJsonResponse(response);
    throw new ApiError(response.status, payload || {});
  }
  return (await response.json()) as T;
}

async function apiPut<T>(path: string, payload: unknown): Promise<T> {
  let response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
    }
  }
  
  if (!response.ok) {
    const payload = await readJsonResponse(response);
    throw new ApiError(response.status, payload || {});
  }
  return (await response.json()) as T;
}

async function apiPatch<T>(path: string, payload: unknown): Promise<T> {
  let response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
    }
  }
  
  if (!response.ok) {
    const payload = await readJsonResponse(response);
    throw new ApiError(response.status, payload || {});
  }
  return (await response.json()) as T;
}

async function apiDelete(path: string): Promise<void> {
  let response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
    }
  }
  
  if (!response.ok) {
    const payload = await readJsonResponse(response);
    throw new ApiError(response.status, payload || {});
  }
}

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const merged: T[] = [];
  let nextPath = path;

  for (let index = 0; index < 50 && nextPath; index += 1) {
    const response = await apiGet<PagedList<T>>(nextPath);
    merged.push(...listData(response));

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

function fallbackLabel(primary: string | undefined, secondary: string | undefined, fallback: string) {
  return primary || secondary || fallback;
}

function useAcademicLookups() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    const load = async () => {
      const [yearData, classData, sectionData, subjectData] = await Promise.all([
        apiGet<ApiList<AcademicYear>>("/api/v1/core/academic-years/"),
        apiGet<ApiList<SchoolClass>>("/api/v1/core/classes/"),
        apiGet<ApiList<Section>>("/api/v1/core/sections/"),
        apiGet<ApiList<Subject>>("/api/v1/core/subjects/"),
      ]);
      setYears(listData(yearData));
      setClasses(sortAcademicsClasses(listData(classData)));
      setSections(listData(sectionData));
      setSubjects(listData(subjectData));
    };
    void load();
  }, []);

  return { years, classes, sections, subjects };
}

function boxStyle() {
  return {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: 16,
  } as const;
}

function fieldStyle() {
  return {
    width: "100%",
    height: 36,
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "0 10px",
  } as const;
}

function buttonStyle() {
  return {
    height: 36,
    padding: "0 12px",
    border: "1px solid var(--primary)",
    background: "var(--primary)",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
  } as const;
}

function LegacyBreadcrumb({ title, moduleLabel, pageLabel }: { title: string; moduleLabel: string; pageLabel: string }) {
  return (
    <section className="sms-breadcrumb mb-20">
      <div className="container-fluid">
        <div className="row justify-content-between" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>
          <div className="bc-pages" style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
            <span>Dashboard</span>
            <span>/</span>
            <span>{moduleLabel}</span>
            <span>/</span>
            <span>{pageLabel}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function LegacyPageFrame({ children }: { children: React.ReactNode }) {
  return (
    <section className="admin-visitor-area up_st_admin_visitor">
      <div className="container-fluid p-0">{children}</div>
    </section>
  );
}

export function LessonPagePanel() {
  const { years, classes, sections, subjects } = useAcademicLookups();
  const [items, setItems] = useState<Lesson[]>([]);
  const [groups, setGroups] = useState<LessonGroup[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groupPage, setGroupPage] = useState(1);
  const [groupPageSize, setGroupPageSize] = useState(10);
  const [lessonPage, setLessonPage] = useState(1);
  const [lessonPageSize, setLessonPageSize] = useState(10);
  const [selectedLessonIds, setSelectedLessonIds] = useState<number[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"selected" | "group" | null>(null);

  const [academicYearId, setAcademicYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [lessonText, setLessonText] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const filteredSections = useMemo(() => {
    const id = Number(classId);
    if (!id) return [];
    return sections.filter((section) => section.school_class === id);
  }, [classId, sections]);

  const classMap = useMemo(() => new Map(classes.map((item) => [item.id, item.name])), [classes]);
  const sectionMap = useMemo(() => new Map(sections.map((item) => [item.id, item.name])), [sections]);
  const subjectMap = useMemo(() => new Map(subjects.map((item) => [item.id, item.name])), [subjects]);
  const lessonMap = useMemo(() => new Map(items.map((item) => [item.id, fallbackLabel(item.lesson_name, undefined, item.lesson_title)])), [items]);

  const loadLessons = async () => {
    const params = new URLSearchParams();
    if (classId) params.set("class_id", classId);
    params.set("page_size", "100");
    const data = await fetchAllPages<Lesson>(`/api/v1/academics/lessons/?${params.toString()}`);
    setItems(data);
  };

  const loadGroups = async () => {
    const data = await fetchAllPages<LessonGroup>("/api/v1/academics/lessons/grouped/?page_size=100");
    setGroups(data);
  };

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadLessons(), loadGroups()]);
      } catch {
        setError("Unable to load lesson data.");
      } finally {
        setLoading(false);
      }
    };
    void loadAll();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const lessonLines = lessonText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!classId || !sectionId || !subjectId || lessonLines.length === 0) {
      setError("Class, section, subject and at least one lesson title are required.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await apiPost("/api/v1/academics/lessons/", {
        academic_year_id: academicYearId ? Number(academicYearId) : undefined,
        class_id: Number(classId),
        section_id: Number(sectionId),
        subject_id: Number(subjectId),
        lesson: lessonLines,
      });
      setLessonText("");
      setSelectedLessonIds([]);
      await Promise.all([loadLessons(), loadGroups()]);
      setSuccess("Lesson added successfully.");
    } catch {
      setError("Unable to save lesson rows.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: Lesson) => {
    setEditingId(item.id);
    setEditingTitle(item.lesson_title);
  };

  const saveEdit = async (item: Lesson) => {
    if (!editingTitle.trim()) return;
    try {
      setSuccess("");
      await apiPut(`/api/v1/academics/lessons/${item.id}/`, {
        academic_year_id: item.academic_year_id,
        class_id: item.class_id,
        section_id: item.section_id,
        subject_id: item.subject_id,
        lesson_title: editingTitle.trim(),
      });
      setEditingId(null);
      setEditingTitle("");
      setSelectedLessonIds([]);
      await Promise.all([loadLessons(), loadGroups()]);
      setSuccess("Lesson row updated successfully.");
    } catch {
      setError("Unable to update lesson row.");
    }
  };

  const deleteLesson = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      setSuccess("");
      await apiDelete(`/api/v1/academics/lessons/${id}/`);
      setSelectedLessonIds([]);
      await Promise.all([loadLessons(), loadGroups()]);
      setSuccess("Lesson row deleted successfully.");
    } catch {
      setError("Unable to delete lesson row.");
    }
  };

  const deleteGroup = async () => {
    if (selectedLessonIds.length > 0) {
      setDeleteMode("selected");
      setDeleteDialogOpen(true);
      return;
    }
    if (!classId || !sectionId || !subjectId) {
      setError("Select class, section and subject before group delete.");
      return;
    }
    setDeleteMode("group");
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      setSuccess("");
      if (deleteMode === "selected") {
        await Promise.all(selectedLessonIds.map((lessonId) => apiDelete(`/api/v1/academics/lessons/${lessonId}/`)));
        setSelectedLessonIds([]);
        setSuccess("Selected lesson rows deleted successfully.");
      } else if (deleteMode === "group") {
        await apiDelete(`/api/v1/academics/lessons/delete-group/?class_id=${classId}&section_id=${sectionId}&subject_id=${subjectId}`);
        setSuccess("Lesson group deleted successfully.");
      }
      await Promise.all([loadLessons(), loadGroups()]);
    } catch {
      setError(deleteMode === "selected" ? "Unable to delete selected lessons." : "Unable to delete lesson group.");
    } finally {
      setDeleteDialogOpen(false);
      setDeleteMode(null);
    }
  };

  const groupRows = useMemo(() => groups, [groups]);
  const totalGroupPages = Math.max(1, Math.ceil(groupRows.length / groupPageSize));
  const paginatedGroups = useMemo(() => {
    const start = (groupPage - 1) * groupPageSize;
    return groupRows.slice(start, start + groupPageSize);
  }, [groupRows, groupPage, groupPageSize]);

  const totalLessonPages = Math.max(1, Math.ceil(items.length / lessonPageSize));
  const paginatedLessons = useMemo(() => {
    const start = (lessonPage - 1) * lessonPageSize;
    return items.slice(start, start + lessonPageSize);
  }, [items, lessonPage, lessonPageSize]);

  useEffect(() => {
    if (groupPage > totalGroupPages) {
      setGroupPage(totalGroupPages);
    }
  }, [groupPage, totalGroupPages]);

  useEffect(() => {
    if (lessonPage > totalLessonPages) {
      setLessonPage(totalLessonPages);
    }
  }, [lessonPage, totalLessonPages]);

  return (
    <div className="legacy-panel">
      <LegacyBreadcrumb title="Add Lesson" moduleLabel="Lesson" pageLabel="Add Lesson" />
      <LegacyPageFrame>
      <div style={{ marginBottom: 14, color: "var(--text-muted)", fontSize: 13 }}>Grouped create, row edit/delete, and group delete flow matching the PHP lesson screen.</div>
      {loading && <div style={{ marginBottom: 12, color: "var(--text-muted)", fontSize: 13 }}>Loading lesson data...</div>}
      {success && <div style={{ marginBottom: 12, color: "#15803d", fontSize: 13 }}>{success}</div>}

      <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
        <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Academic Year</label>
            <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} style={fieldStyle()}>
              <option value="">Academic year (optional)</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Class</label>
            <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }} style={fieldStyle()}>
              <option value="">Class</option>
              {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Section</label>
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={fieldStyle()}>
              <option value="">Section</option>
              {filteredSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Subject</label>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={fieldStyle()}>
              <option value="">Subject</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Lesson Titles</label>
            <textarea
              value={lessonText}
              onChange={(e) => setLessonText(e.target.value)}
              rows={4}
              placeholder="One lesson title per line"
              style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px" }}
            />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between" }}>
            <button type="button" onClick={deleteGroup} style={{ ...buttonStyle(), background: "#dc2626", borderColor: "#dc2626" }}>
              Delete Selected Group
            </button>
            <button type="submit" disabled={saving} style={buttonStyle()}>{saving ? "Saving..." : "Save Lessons"}</button>
          </div>
        </form>
        {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
      </div>

      <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Lesson Rows</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)", width: 42 }}>
                <input
                  type="checkbox"
                  checked={paginatedLessons.length > 0 && paginatedLessons.every((item) => selectedLessonIds.includes(item.id))}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedLessonIds(Array.from(new Set([...selectedLessonIds, ...paginatedLessons.map((item) => item.id)])));
                    } else {
                      setSelectedLessonIds((prev) => prev.filter((lessonId) => !paginatedLessons.some((item) => item.id === lessonId)));
                    }
                  }}
                />
              </th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>ID</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Lesson Title</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLessons.map((item) => (
              <tr key={item.id}>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)", width: 42 }}>
                  <input
                    type="checkbox"
                    checked={selectedLessonIds.includes(item.id)}
                    onChange={(event) => {
                      setSelectedLessonIds((prev) => event.target.checked ? [...prev, item.id] : prev.filter((lessonId) => lessonId !== item.id));
                    }}
                  />
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)", width: 80 }}>{item.id}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                  {editingId === item.id ? (
                    <input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} style={{ ...fieldStyle(), height: 32 }} />
                  ) : (
                    item.lesson_name || item.lesson_title
                  )}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)", width: 220 }}>
                  {editingId === item.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => void saveEdit(item)} style={buttonStyle()}>Save</button>
                      <button type="button" onClick={() => setEditingId(null)} style={{ ...buttonStyle(), background: "#6b7280", borderColor: "#6b7280" }}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => startEdit(item)} style={buttonStyle()}>Edit</button>
                      <button type="button" onClick={() => void deleteLesson(item.id)} style={{ ...buttonStyle(), background: "#dc2626", borderColor: "#dc2626" }}>Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={4} style={{ padding: 8, color: "var(--text-muted)" }}>No lessons yet.</td></tr>
            )}
          </tbody>
        </table>
        {items.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Rows per page</span>
              <select
                value={lessonPageSize}
                onChange={(e) => {
                  setLessonPageSize(Number(e.target.value));
                  setLessonPage(1);
                }}
                style={fieldStyle()}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setLessonPage(1)} disabled={lessonPage <= 1} style={{ ...buttonStyle(), background: "#6b7280", borderColor: "#6b7280", opacity: lessonPage <= 1 ? 0.6 : 1 }}>
                First
              </button>
              <button type="button" onClick={() => setLessonPage(Math.max(1, lessonPage - 1))} disabled={lessonPage <= 1} style={{ ...buttonStyle(), background: "#6b7280", borderColor: "#6b7280", opacity: lessonPage <= 1 ? 0.6 : 1 }}>
                Previous
              </button>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Page {lessonPage} of {totalLessonPages}</span>
              <button type="button" onClick={() => setLessonPage(Math.min(totalLessonPages, lessonPage + 1))} disabled={lessonPage >= totalLessonPages} style={{ ...buttonStyle(), background: "#6b7280", borderColor: "#6b7280", opacity: lessonPage >= totalLessonPages ? 0.6 : 1 }}>
                Next
              </button>
              <button type="button" onClick={() => setLessonPage(totalLessonPages)} disabled={lessonPage >= totalLessonPages} style={{ ...buttonStyle(), background: "#6b7280", borderColor: "#6b7280", opacity: lessonPage >= totalLessonPages ? 0.6 : 1 }}>
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="white-box" style={boxStyle()}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Lesson Group Report</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Class</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Section</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Subject</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Lesson Titles</th>
            </tr>
          </thead>
          <tbody>
            {paginatedGroups.map((group, index) => (
              <tr key={`${group.class_id}-${group.section_id}-${group.subject_id}-${index}`}>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{fallbackLabel(group.class_name, classMap.get(group.class_id), String(group.class_id))}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{group.section_id ? fallbackLabel(group.section_name, sectionMap.get(group.section_id), String(group.section_id)) : "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{fallbackLabel(group.subject_name, subjectMap.get(group.subject_id), String(group.subject_id))}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{group.items.map((row) => row.lesson_name || row.lesson_title).join(", ")}</td>
              </tr>
            ))}
            {groups.length === 0 && !loading && <tr><td colSpan={4} style={{ padding: 8, color: "var(--text-muted)" }}>No grouped lessons.</td></tr>}
          </tbody>
        </table>
        {groups.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Rows per page</span>
              <select value={groupPageSize} onChange={(e) => { setGroupPageSize(Number(e.target.value)); setGroupPage(1); }} style={fieldStyle()}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setGroupPage(1)} disabled={groupPage <= 1} style={{ ...buttonStyle(), background: "#6b7280", borderColor: "#6b7280", opacity: groupPage <= 1 ? 0.6 : 1 }}>
                First
              </button>
              <button type="button" onClick={() => setGroupPage(Math.max(1, groupPage - 1))} disabled={groupPage <= 1} style={{ ...buttonStyle(), background: "#6b7280", borderColor: "#6b7280", opacity: groupPage <= 1 ? 0.6 : 1 }}>
                Previous
              </button>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Page {groupPage} of {totalGroupPages}</span>
              <button type="button" onClick={() => setGroupPage(Math.min(totalGroupPages, groupPage + 1))} disabled={groupPage >= totalGroupPages} style={{ ...buttonStyle(), background: "#6b7280", borderColor: "#6b7280", opacity: groupPage >= totalGroupPages ? 0.6 : 1 }}>
                Next
              </button>
              <button type="button" onClick={() => setGroupPage(totalGroupPages)} disabled={groupPage >= totalGroupPages} style={{ ...buttonStyle(), background: "#6b7280", borderColor: "#6b7280", opacity: groupPage >= totalGroupPages ? 0.6 : 1 }}>
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {deleteDialogOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ width: "min(460px, calc(100vw - 24px))", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, boxShadow: "0 12px 30px rgba(0,0,0,.18)" }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Delete Lessons</h3>
            <p style={{ marginTop: 10, marginBottom: 14, color: "var(--text-muted)" }}>
              {deleteMode === "selected"
                ? `Delete ${selectedLessonIds.length} selected lesson row${selectedLessonIds.length === 1 ? "" : "s"}?`
                : "Delete the selected lesson group?"}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => { setDeleteDialogOpen(false); setDeleteMode(null); }} style={{ height: 36, padding: "0 14px", background: "#64748b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                Cancel
              </button>
              <button type="button" onClick={() => void confirmDelete()} style={{ height: 36, padding: "0 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      </LegacyPageFrame>
    </div>
  );
}

export function TopicPagePanel() {
  const { years, classes, sections, subjects } = useAcademicLookups();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [topicGroups, setTopicGroups] = useState<LessonTopicGroup[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [academicYearId, setAcademicYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [topicText, setTopicText] = useState("");

  const [editingTopicId, setEditingTopicId] = useState<number | null>(null);
  const [editingTopicTitle, setEditingTopicTitle] = useState("");

  const filteredSections = useMemo(() => {
    const id = Number(classId);
    if (!id) return [];
    return sections.filter((section) => section.school_class === id);
  }, [classId, sections]);

  const classMap = useMemo(() => new Map(classes.map((item) => [item.id, fallbackLabel(item.class_name, item.name, `Class ${item.id}`)])), [classes]);
  const sectionMap = useMemo(() => new Map(sections.map((item) => [item.id, fallbackLabel(item.section_name, item.name, `Section ${item.id}`)])), [sections]);
  const subjectMap = useMemo(() => new Map(subjects.map((item) => [item.id, fallbackLabel(item.subject_name, item.name, `Subject ${item.id}`)])), [subjects]);
  const lessonMap = useMemo(() => new Map(lessons.map((item) => [item.id, fallbackLabel(item.lesson_name, item.lesson_title, `Lesson ${item.id}`)])), [lessons]);

  const loadLessons = async () => {
    const data = await fetchAllPages<Lesson>("/api/v1/academics/lessons/?page_size=100");
    setLessons(data);
  };

  const loadTopicGroups = async () => {
    const data = await fetchAllPages<LessonTopicGroup>("/api/v1/academics/lesson-topics/?page_size=100");
    setTopicGroups(data);
  };

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadLessons(), loadTopicGroups()]);
      } catch {
        setError("Unable to load topic data.");
      } finally {
        setLoading(false);
      }
    };
    void loadAll();
  }, []);

  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      if (classId && Number(classId) !== (lesson.class_id || 0)) return false;
      if (sectionId && Number(sectionId) !== (lesson.section_id || 0)) return false;
      if (subjectId && Number(subjectId) !== (lesson.subject_id || 0)) return false;
      return true;
    });
  }, [lessons, classId, sectionId, subjectId]);

  const topicLines = useMemo(
    () => topicText.split("\n").map((line) => line.trim()).filter(Boolean),
    [topicText],
  );

  const isTopicFormValid = Boolean(classId && sectionId && subjectId && lessonId && topicLines.length > 0 && !saving);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFieldErrors({});
    if (!classId || !sectionId || !subjectId || !lessonId || topicLines.length === 0) {
      setError("Class, section, subject, lesson and topics are required.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await apiPost("/api/v1/academics/lesson-topics/", {
        academic_year_id: academicYearId ? Number(academicYearId) : undefined,
        class_id: Number(classId),
        section_id: Number(sectionId),
        subject_id: Number(subjectId),
        lesson_id: Number(lessonId),
        topic: topicLines,
      });
      setTopicText("");
      setFieldErrors({});
      await loadTopicGroups();
      setSuccess("Topic added successfully.");
    } catch (err) {
      const apiError = getApiError(err);
      setError(apiError.message || "Unable to save topics.");
      setFieldErrors(apiError.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  const startEditTopic = (topic: LessonTopicDetail) => {
    setEditingTopicId(topic.id);
    setEditingTopicTitle(topic.topic_title);
  };

  const saveTopicTitle = async () => {
    if (!editingTopicId || !editingTopicTitle.trim()) return;
    try {
      setSuccess("");
      await apiPatch(`/api/v1/academics/lesson-topic-details/${editingTopicId}/`, { topic_title: editingTopicTitle.trim() });
      setEditingTopicId(null);
      setEditingTopicTitle("");
      await loadTopicGroups();
      setSuccess("Topic title updated successfully.");
    } catch {
      setError("Unable to update topic title.");
    }
  };

  const deleteTopicDetail = async (topicId: number) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      setSuccess("");
      await apiDelete(`/api/v1/academics/lesson-topic-details/${topicId}/`);
      await loadTopicGroups();
      setSuccess("Topic deleted successfully.");
    } catch {
      setError("Unable to delete topic detail.");
    }
  };

  const deleteTopicGroup = async (groupId: number) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      setSuccess("");
      await apiDelete(`/api/v1/academics/lesson-topics/delete-group/?id=${groupId}`);
      await loadTopicGroups();
      setSuccess("Topic group deleted successfully.");
    } catch {
      setError("Unable to delete topic group.");
    }
  };

  return (
    <div className="legacy-panel">
      <LegacyBreadcrumb title="Add Topic" moduleLabel="Lesson Plan" pageLabel="Topic" />
      <LegacyPageFrame>
      <div style={{ marginBottom: 14, color: "var(--text-muted)", fontSize: 13 }}>Topic group create, topic-title edit, and group delete flow aligned with PHP behavior.</div>
      {loading && <div style={{ marginBottom: 12, color: "var(--text-muted)", fontSize: 13 }}>Loading topic data...</div>}
      {success && <div style={{ marginBottom: 12, color: "#15803d", fontSize: 13 }}>{success}</div>}

      <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
        <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Academic Year</label>
            <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} style={{ ...fieldStyle(), borderColor: fieldErrors.academic_year_id ? "#dc2626" : undefined }}>
              <option value="">Academic year (optional)</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Class</label>
            <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }} style={{ ...fieldStyle(), borderColor: fieldErrors.class_id ? "#dc2626" : undefined }}>
              <option value="">Class</option>
              {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{fallbackLabel(schoolClass.class_name, schoolClass.name, `Class ${schoolClass.id}`)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Section</label>
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={{ ...fieldStyle(), borderColor: fieldErrors.section_id ? "#dc2626" : undefined }}>
              <option value="">Section</option>
              {filteredSections.map((section) => <option key={section.id} value={section.id}>{fallbackLabel(section.section_name, section.name, `Section ${section.id}`)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Subject</label>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ ...fieldStyle(), borderColor: fieldErrors.subject_id ? "#dc2626" : undefined }}>
              <option value="">Subject</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{fallbackLabel(subject.subject_name, subject.name, `Subject ${subject.id}`)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Lesson</label>
            <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} style={{ ...fieldStyle(), borderColor: fieldErrors.lesson_id ? "#dc2626" : undefined }}>
              <option value="">{filteredLessons.length ? "Lesson" : "No lessons available"}</option>
              {filteredLessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.lesson_name || lesson.lesson_title}</option>)}
            </select>
            {!filteredLessons.length ? <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>No lessons available</span> : null}
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Topics</label>
            <textarea
              value={topicText}
              onChange={(e) => setTopicText(e.target.value)}
              rows={4}
              placeholder="One topic title per line"
              style={{ width: "100%", border: `1px solid ${fieldErrors.topic ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "8px 10px" }}
            />
          </div>
          {fieldErrors.class_id && <div style={{ color: "#dc2626", fontSize: 12 }}>Class: {fieldErrors.class_id}</div>}
          {fieldErrors.section_id && <div style={{ color: "#dc2626", fontSize: 12 }}>Section: {fieldErrors.section_id}</div>}
          {fieldErrors.subject_id && <div style={{ color: "#dc2626", fontSize: 12 }}>Subject: {fieldErrors.subject_id}</div>}
          {fieldErrors.lesson_id && <div style={{ color: "#dc2626", fontSize: 12 }}>Lesson: {fieldErrors.lesson_id}</div>}
          {fieldErrors.topic && <div style={{ color: "#dc2626", fontSize: 12, gridColumn: "1 / -1" }}>Topics: {fieldErrors.topic}</div>}
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" disabled={!isTopicFormValid} style={{ ...buttonStyle(), opacity: isTopicFormValid ? 1 : 0.6, cursor: isTopicFormValid ? "pointer" : "not-allowed" }}>{saving ? "Saving..." : "Save Topics"}</button>
          </div>
        </form>
        {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
      </div>

      <div className="white-box" style={boxStyle()}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Topic Groups</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Class</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Section</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Subject</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Lesson</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Topics</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {topicGroups.map((group) => (
              <tr key={group.id}>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{fallbackLabel(group.class_name, classMap.get(group.class_id || 0), String(group.class_id || group.id))}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{group.section_id ? fallbackLabel(group.section_name, sectionMap.get(group.section_id), String(group.section_id)) : "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{fallbackLabel(group.subject_name, subjectMap.get(group.subject_id || 0), String(group.subject_id || group.id))}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{group.lesson_name || lessonMap.get(group.lesson_id || 0) || (group.lesson_id ? `Lesson #${group.lesson_id}` : "-")}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(group.topics || []).map((topic) => (
                      <div key={topic.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {editingTopicId === topic.id ? (
                          <>
                            <input value={editingTopicTitle} onChange={(e) => setEditingTopicTitle(e.target.value)} style={{ ...fieldStyle(), height: 30 }} />
                            <button type="button" onClick={() => void saveTopicTitle()} style={buttonStyle()}>Save</button>
                            <button type="button" onClick={() => setEditingTopicId(null)} style={{ ...buttonStyle(), background: "#6b7280", borderColor: "#6b7280" }}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <span>{topic.topic_title}</span>
                            <button type="button" onClick={() => startEditTopic(topic)} style={buttonStyle()}>Edit</button>
                            <button type="button" onClick={() => void deleteTopicDetail(topic.id)} style={{ ...buttonStyle(), background: "#dc2626", borderColor: "#dc2626" }}>Delete</button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)", width: 160 }}>
                  <button type="button" onClick={() => void deleteTopicGroup(group.id)} style={{ ...buttonStyle(), background: "#dc2626", borderColor: "#dc2626" }}>
                    Delete Group
                  </button>
                </td>
              </tr>
            ))}
            {topicGroups.length === 0 && !loading && (
              <tr><td colSpan={3} style={{ padding: 8, color: "var(--text-muted)" }}>No topic groups yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </LegacyPageFrame>
    </div>
  );
}

export function LessonPlannerPagePanel() {
  const { years, classes, sections, subjects } = useAcademicLookups();
  const [classPeriods, setClassPeriods] = useState<ClassPeriod[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [topicDetails, setTopicDetails] = useState<LessonTopicDetail[]>([]);
  const [items, setItems] = useState<PlannerRow[]>([]);
  const [overviewItems, setOverviewItems] = useState<PlannerRow[]>([]);
  const [weekly, setWeekly] = useState<WeeklyPlanner | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PlannerRow | null>(null);

  const [academicYearId, setAcademicYearId] = useState("");
  const [day, setDay] = useState("1");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [lessonDate, setLessonDate] = useState("");
  const [classPeriodId, setClassPeriodId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [subTopic, setSubTopic] = useState("");

  const [customizeMode, setCustomizeMode] = useState(false);
  const [customTopicIds, setCustomTopicIds] = useState("");
  const [customSubTopics, setCustomSubTopics] = useState("");

  const [weeklyStartDate, setWeeklyStartDate] = useState("");
  const plannerFormRef = useRef<HTMLFormElement | null>(null);

  const filteredSections = useMemo(() => {
    const id = Number(classId);
    if (!id) return [];
    return sections.filter((section) => section.school_class === id);
  }, [classId, sections]);

  const classMap = useMemo(() => new Map(classes.map((item) => [item.id, fallbackLabel(item.class_name, item.name, `Class ${item.id}`)])), [classes]);
  const sectionMap = useMemo(() => new Map(sections.map((item) => [item.id, fallbackLabel(item.section_name, item.name, `Section ${item.id}`)])), [sections]);
  const subjectMap = useMemo(() => new Map(subjects.map((item) => [item.id, fallbackLabel(item.subject_name, item.name, `Subject ${item.id}`)])), [subjects]);
  const lessonMap = useMemo(() => new Map(lessons.map((item) => [item.id, fallbackLabel(item.lesson_name, item.lesson_title, `Lesson ${item.id}`)])), [lessons]);
  const topicDetailMap = useMemo(() => new Map(topicDetails.map((item) => [item.id, item.topic_title])), [topicDetails]);

  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      if (classId && Number(classId) !== (lesson.class_id || 0)) return false;
      if (sectionId && Number(sectionId) !== (lesson.section_id || 0)) return false;
      if (subjectId && Number(subjectId) !== (lesson.subject_id || 0)) return false;
      return true;
    });
  }, [lessons, classId, sectionId, subjectId]);

  const filteredTopicDetails = useMemo(() => {
    if (!lessonId) return [];
    const selectedLessonId = Number(lessonId);
    return topicDetails.filter((topic) => topic.lesson === selectedLessonId);
  }, [lessonId, topicDetails]);

  const plannerTopicLines = useMemo(() => customTopicIds.split(",").map((value) => value.trim()).filter(Boolean), [customTopicIds]);
  const plannerSubTopicLines = useMemo(() => customSubTopics.split("\n").map((value) => value.trim()), [customSubTopics]);
  const isPlannerFormValid = Boolean(classId && sectionId && subjectId && lessonId && lessonDate && !saving && (customizeMode ? plannerTopicLines.length > 0 : topicId));

  const loadLessons = async () => {
    const data = await apiGet<ApiList<Lesson>>("/api/v1/academics/lessons/");
    setLessons(listData(data));
  };

  const loadTeachers = async () => {
    const data = await apiGet<TeacherOption[]>("/api/v1/academics/lesson-planners/teachers/");
    setTeachers(data);
  };

  const loadClassPeriods = async () => {
    const data = await apiGet<ApiList<ClassPeriod>>("/api/v1/core/class-periods/?period_type=class");
    setClassPeriods(listData(data));
  };

  const loadTopicDetails = async () => {
    const data = await apiGet<ApiList<LessonTopicDetail>>("/api/v1/academics/lesson-topic-details/");
    setTopicDetails(listData(data));
  };

  const loadPlanners = async () => {
    const data = await apiGet<ApiList<PlannerRow>>("/api/v1/academics/lesson-planners/");
    setItems(listData(data));
  };

  const loadOverview = async () => {
    const data = await apiGet<PlannerRow[]>("/api/v1/academics/lesson-planners/overview/");
    setOverviewItems(data);
  };

  const loadWeekly = async () => {
    const query = new URLSearchParams();
    if (teacherId) query.append("teacher_id", teacherId);
    if (weeklyStartDate) query.append("start_date", weeklyStartDate);
    const data = await apiGet<WeeklyPlanner>(`/api/v1/academics/lesson-planners/weekly/?${query.toString()}`);
    setWeekly(data);
  };

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadTeachers(), loadClassPeriods(), loadLessons(), loadTopicDetails(), loadPlanners(), loadOverview(), loadWeekly()]);
      } catch {
        setError("Unable to load lesson planner data.");
      } finally {
        setLoading(false);
      }
    };
    void loadAll();
  }, []);

  const resetPlannerForm = () => {
    setIsEditMode(false);
    setSelectedItem(null);
    setCustomizeMode(false);
    setFieldErrors({});
    setClassPeriodId("");
    setTopicId("");
    setSubTopic("");
    setCustomTopicIds("");
    setCustomSubTopics("");
  };

  const focusPlannerForm = () => {
    window.requestAnimationFrame(() => {
      const formElement = plannerFormRef.current;
      const firstField = formElement?.querySelector<HTMLElement>("select, input, textarea, button");
      firstField?.focus();
      formElement?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const fillPlannerForm = (row: PlannerRow) => {
    setIsEditMode(true);
    setSelectedItem(row);
    setAcademicYearId(row.academic_year_id ? String(row.academic_year_id) : "");
    setDay(row.day ? String(row.day) : "1");
    setClassId(String(row.class_id));
    setSectionId(row.section_id ? String(row.section_id) : "");
    setSubjectId(String(row.subject_id));
    setLessonId(String(row.lesson_detail_id));
    setLessonDate(row.lesson_date);
    setClassPeriodId(row.class_period_id ? String(row.class_period_id) : "");
    setTeacherId(row.teacher_id ? String(row.teacher_id) : "");

    if (row.topics && row.topics.length > 0) {
      setCustomizeMode(true);
      setCustomTopicIds(row.topics.map((topic) => String(topic.topic_id)).join(","));
      setCustomSubTopics(row.topics.map((topic) => topic.sub_topic_title).join("\n"));
      setTopicId("");
      setSubTopic("");
    } else {
      setCustomizeMode(false);
      setTopicId(row.topic_detail_id ? String(row.topic_detail_id) : "");
      setSubTopic(row.sub_topic || "");
      setCustomTopicIds("");
      setCustomSubTopics("");
    }

    focusPlannerForm();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFieldErrors({});
    if (!classId || !sectionId || !subjectId || !lessonId || !lessonDate) {
      setError("Class, section, subject, lesson and lesson date are required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const wasEditMode = isEditMode;

      const payload: Record<string, unknown> = {
        academic_year_id: academicYearId ? Number(academicYearId) : undefined,
        day: Number(day),
        lesson: Number(lessonId),
        teacher_id: teacherId ? Number(teacherId) : undefined,
        subject_id: Number(subjectId),
        class_id: Number(classId),
        section_id: Number(sectionId),
        lesson_date: lessonDate,
        class_period_id: classPeriodId ? Number(classPeriodId) : undefined,
      };

      if (customizeMode) {
        payload.customize = "customize";
        payload.topic = plannerTopicLines.map((value) => Number(value)).filter((value) => !Number.isNaN(value) && value > 0);
        payload.sub_topic = plannerSubTopicLines;
      } else {
        payload.topic = Number(topicId);
        payload.sub_topic = subTopic;
      }

      if (isEditMode && selectedItem) {
        await apiPut(`/api/v1/academics/lesson-planners/${selectedItem.id}/`, payload);
      } else {
        await apiPost("/api/v1/academics/lesson-planners/", payload);
      }

      resetPlannerForm();
      await Promise.all([loadPlanners(), loadOverview(), loadWeekly()]);
      setSuccess(wasEditMode ? "Lesson plan updated successfully." : "Lesson plan created successfully.");
    } catch (err) {
      const apiError = getApiError(err);
      setError(apiError.message || "Unable to save lesson planner row.");
      setFieldErrors(apiError.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  const deletePlanner = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      setSuccess("");
      await apiDelete(`/api/v1/academics/lesson-planners/${id}/`);
      await Promise.all([loadPlanners(), loadOverview(), loadWeekly()]);
      setSuccess("Lesson plan deleted successfully.");
    } catch {
      setError("Unable to delete planner row.");
    }
  };

  const weeklyDays = weekly ? Object.keys(weekly.days).sort() : [];
  const teacherNameById = new Map(teachers.map((teacher) => [teacher.id, teacher.full_name]));
  const periodNameById = new Map(classPeriods.map((period) => [period.id, `${period.period} (${period.start_time}-${period.end_time})`]));
  const weeklyRows = classPeriods.length > 0
    ? classPeriods.map((period) => ({ key: `period-${period.id}`, label: `${period.period} (${period.start_time}-${period.end_time})`, periodId: period.id }))
    : Array.from({ length: Math.max(weeklyDays.reduce((maxRows, dayKey) => Math.max(maxRows, (weekly?.days[dayKey] || []).length), 0), 1) }).map((_, index) => ({
        key: `row-${index}`,
        label: `Row ${index + 1}`,
        periodId: null as number | null,
      }));

  return (
    <div className="legacy-panel">
      <LegacyBreadcrumb title="Lesson Plan Create" moduleLabel="Lesson Plan" pageLabel="Lesson Plan Create" />
      <LegacyPageFrame>
      <div style={{ marginBottom: 14, color: "var(--text-muted)", fontSize: 13 }}>Planner create/update/delete plus weekly and overview reports in the same legacy flow.</div>
      {loading && <div style={{ marginBottom: 12, color: "var(--text-muted)", fontSize: 13 }}>Loading lesson planner data...</div>}
      {success && <div style={{ marginBottom: 12, color: "#15803d", fontSize: 13 }}>{success}</div>}

      <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
        <form ref={plannerFormRef} onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Academic Year</label>
            <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} style={{ ...fieldStyle(), borderColor: fieldErrors.academic_year_id ? "#dc2626" : undefined }}>
              <option value="">Academic year (optional)</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Day</label>
            <input value={day} onChange={(e) => setDay(e.target.value)} type="number" min={1} max={7} placeholder="Day ID" style={{ ...fieldStyle(), borderColor: fieldErrors.day ? "#dc2626" : undefined }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Teacher</label>
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} style={{ ...fieldStyle(), borderColor: fieldErrors.teacher_id ? "#dc2626" : undefined }}>
              <option value="">Select teacher</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name || teacher.username}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Class Period</label>
            <select value={classPeriodId} onChange={(e) => setClassPeriodId(e.target.value)} style={{ ...fieldStyle(), borderColor: fieldErrors.class_period_id ? "#dc2626" : undefined }}>
              <option value="">Select period</option>
              {classPeriods.map((period) => <option key={period.id} value={period.id}>{period.period} ({period.start_time} - {period.end_time})</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Class</label>
            <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }} style={{ ...fieldStyle(), borderColor: fieldErrors.class_id ? "#dc2626" : undefined }}>
              <option value="">Class</option>
              {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{fallbackLabel(schoolClass.class_name, schoolClass.name, `Class ${schoolClass.id}`)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Section</label>
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={{ ...fieldStyle(), borderColor: fieldErrors.section_id ? "#dc2626" : undefined }}>
              <option value="">Section</option>
              {filteredSections.map((section) => <option key={section.id} value={section.id}>{fallbackLabel(section.section_name, section.name, `Section ${section.id}`)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Subject</label>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ ...fieldStyle(), borderColor: fieldErrors.subject_id ? "#dc2626" : undefined }}>
              <option value="">Subject</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{fallbackLabel(subject.subject_name, subject.name, `Subject ${subject.id}`)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Lesson</label>
            <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} style={{ ...fieldStyle(), borderColor: fieldErrors.lesson ? "#dc2626" : undefined }}>
              <option value="">Lesson</option>
              {filteredLessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.lesson_name || lesson.lesson_title}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Lesson Date</label>
            <input value={lessonDate} onChange={(e) => setLessonDate(e.target.value)} type="date" style={{ ...fieldStyle(), borderColor: fieldErrors.lesson_date ? "#dc2626" : undefined }} />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={customizeMode} onChange={(e) => setCustomizeMode(e.target.checked)} />
            Customize mode
          </label>

          {!customizeMode && (
            <>
              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Topic Detail</label>
                <select value={topicId} onChange={(e) => setTopicId(e.target.value)} style={{ ...fieldStyle(), borderColor: fieldErrors.topic ? "#dc2626" : undefined }}>
                  <option value="">Topic detail</option>
                  {filteredTopicDetails.map((topic) => <option key={topic.id} value={topic.id}>{topic.topic_title}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Sub Topic</label>
                <input value={subTopic} onChange={(e) => setSubTopic(e.target.value)} placeholder="Sub topic" style={{ ...fieldStyle(), borderColor: fieldErrors.sub_topic ? "#dc2626" : undefined }} />
              </div>
            </>
          )}

          {customizeMode && (
            <>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Topic Detail IDs</label>
                <input
                  value={customTopicIds}
                  onChange={(e) => setCustomTopicIds(e.target.value)}
                  placeholder="Topic detail IDs (comma separated)"
                  style={{ ...fieldStyle(), borderColor: fieldErrors.topic ? "#dc2626" : undefined }}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>Sub Topic Lines</label>
                <textarea
                  value={customSubTopics}
                  onChange={(e) => setCustomSubTopics(e.target.value)}
                  placeholder="Sub topic lines (line 1 = first topic id)"
                  rows={3}
                  style={{ width: "100%", border: `1px solid ${fieldErrors.sub_topic ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "8px 10px" }}
                />
              </div>
            </>
          )}

          {fieldErrors.class_id && <div style={{ color: "#dc2626", fontSize: 12 }}>Class: {fieldErrors.class_id}</div>}
          {fieldErrors.section_id && <div style={{ color: "#dc2626", fontSize: 12 }}>Section: {fieldErrors.section_id}</div>}
          {fieldErrors.subject_id && <div style={{ color: "#dc2626", fontSize: 12 }}>Subject: {fieldErrors.subject_id}</div>}
          {fieldErrors.lesson && <div style={{ color: "#dc2626", fontSize: 12 }}>Lesson: {fieldErrors.lesson}</div>}
          {fieldErrors.lesson_date && <div style={{ color: "#dc2626", fontSize: 12 }}>Date: {fieldErrors.lesson_date}</div>}
          {fieldErrors.topic && <div style={{ color: "#dc2626", fontSize: 12, gridColumn: "1 / -1" }}>Topic: {fieldErrors.topic}</div>}
          {fieldErrors.sub_topic && <div style={{ color: "#dc2626", fontSize: 12, gridColumn: "1 / -1" }}>Sub topic: {fieldErrors.sub_topic}</div>}

          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            {isEditMode && (
              <button type="button" onClick={resetPlannerForm} style={{ ...buttonStyle(), background: "#6b7280", borderColor: "#6b7280" }}>
                Cancel Edit
              </button>
            )}
            <button type="submit" disabled={!isPlannerFormValid} style={{ ...buttonStyle(), opacity: isPlannerFormValid ? 1 : 0.6, cursor: isPlannerFormValid ? "pointer" : "not-allowed" }}>{saving ? "Saving..." : isEditMode ? "Update Lesson Plan" : "Create Lesson Plan"}</button>
          </div>
        </form>
        {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
      </div>

      <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Planner Rows</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>ID</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Date</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Period</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Lesson</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Topic</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Sub Topic</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)", width: 70 }}>{item.id}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.lesson_date}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.class_period_id ? (periodNameById.get(item.class_period_id) || `Period #${item.class_period_id}`) : "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.lesson_detail_name || lessonMap.get(item.lesson_detail_id) || `Lesson #${item.lesson_detail_id}`}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.topic_detail_name || (item.topic_detail_id ? `Topic #${item.topic_detail_id}` : "-")}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.sub_topic || item.topics.map((topic) => topic.sub_topic_title).join(", ") || "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)", width: 180 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => fillPlannerForm(item)} style={buttonStyle()}>Edit</button>
                    <button type="button" onClick={() => void deletePlanner(item.id)} style={{ ...buttonStyle(), background: "#dc2626", borderColor: "#dc2626" }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} style={{ padding: 8, color: "var(--text-muted)" }}>No lesson planner rows yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 600 }}>Weekly Planner Report</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="date" value={weeklyStartDate} onChange={(e) => setWeeklyStartDate(e.target.value)} style={fieldStyle()} />
            <button type="button" onClick={() => void loadWeekly()} style={buttonStyle()}>Load Week</button>
          </div>
        </div>
        {weekly && (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{weekly.start_date} to {weekly.end_date}</div>
            {weeklyDays.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                      {weeklyDays.map((dayKey) => (
                        <th key={dayKey} style={{ padding: 8, borderBottom: "1px solid var(--line)", minWidth: 220 }}>{dayKey}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyRows.map((rowInfo, rowIndex) => (
                      <tr key={rowInfo.key}>
                        {weeklyDays.map((dayKey) => {
                          const row = rowInfo.periodId
                            ? (weekly.days[dayKey] || []).find((item) => item.class_period_id === rowInfo.periodId)
                            : weekly.days[dayKey]?.[rowIndex];
                          return (
                            <td key={`${dayKey}-${rowIndex}`} style={{ padding: 8, borderBottom: "1px solid var(--line)", verticalAlign: "top" }}>
                              {row ? (
                                <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 8, background: "#fff" }}>
                                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{row.class_period_id ? (periodNameById.get(row.class_period_id) || `Period #${row.class_period_id}`) : rowInfo.label}</div>
                                  <div style={{ fontWeight: 600, fontSize: 12 }}>Lesson: {row.lesson_detail_name || lessonMap.get(row.lesson_detail_id) || `Lesson #${row.lesson_detail_id}`}</div>
                                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Topic: {row.topic_detail_name || (row.topic_detail_id ? `Topic #${row.topic_detail_id}` : "-")}</div>
                                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Routine: {row.routine_id || "-"}</div>
                                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Teacher: {row.teacher_id ? (teacherNameById.get(row.teacher_id) || `#${row.teacher_id}`) : "-"}</div>
                                </div>
                              ) : (
                                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{rowInfo.label}</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: "var(--text-muted)" }}>No planner rows for selected week.</div>
            )}
          </div>
        )}
      </div>

      <div className="white-box" style={boxStyle()}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Lesson Planner Overview</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Planner ID</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Date</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Class</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Section</th>
              <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Subject</th>
            </tr>
          </thead>
          <tbody>
            {overviewItems.map((item) => (
              <tr key={item.id}>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.id}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.lesson_date}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.class_name || classMap.get(item.class_id) || item.class_id}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.section_id ? (item.section_name || sectionMap.get(item.section_id) || item.section_id) : "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.subject_name || subjectMap.get(item.subject_id) || item.subject_id}</td>
              </tr>
            ))}
            {overviewItems.length === 0 && <tr><td colSpan={5} style={{ padding: 8, color: "var(--text-muted)" }}>No overview rows.</td></tr>}
          </tbody>
        </table>
      </div>
      </LegacyPageFrame>
    </div>
  );
}
