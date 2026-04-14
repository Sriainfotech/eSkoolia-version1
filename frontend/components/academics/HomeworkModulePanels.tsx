"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { API_BASE_URL } from "@/lib/api";
import { sortAcademicsClasses } from "@/lib/classOrdering";

type AcademicYear = { id: number; name: string; is_current: boolean };
type SchoolClass = { id: number; name: string };
type Section = { id: number; school_class: number; name: string };
type Subject = { id: number; name: string };
type Student = {
  id: number;
  admission_no: string;
  first_name: string;
  last_name: string;
  roll_no: string;
  current_class: number | null;
  current_section: number | null;
};

type Homework = {
  id: number;
  academic_year_id?: number | null;
  class_id: number;
  section_id?: number | null;
  subject_id: number;
  homework_date: string;
  submission_date: string;
  evaluation_date?: string | null;
  marks: string | number;
  description: string;
  file?: string;
};

type HomeworkSubmission = {
  id: number;
  homework_id: number;
  student_id: number;
  marks: string | number;
  complete_status: "C" | "I" | "P";
  note: string;
};

type ApiList<T> = T[] | { results?: T[] };

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type EvalDraft = {
  id?: number;
  marks: string;
  complete_status: "C" | "I" | "P";
  note: string;
};

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

function isPaginated<T>(value: unknown): value is PaginatedResponse<T> {
  return !!value && typeof value === "object" && "results" in value && "count" in value;
}

function constructFileUrl(filePath: string | undefined): string {
  if (!filePath) return "";
  // If already a full URL, return as-is
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }
  // If starts with /, prepend API_BASE_URL
  if (filePath.startsWith("/")) {
    return `${API_BASE_URL}${filePath}`;
  }
  // Otherwise prepend API_BASE_URL/media/ for uploaded files
  return `${API_BASE_URL}/media/${filePath}`;
}

function extractHomeworkFieldErrors(details: unknown, fallbackMessage: string): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!details || typeof details !== "object") return errors;

  const payload = details as Record<string, unknown>;
  const rawErrors = payload.errors;
  if (!rawErrors || typeof rawErrors !== "object" || Array.isArray(rawErrors)) return errors;

  const source = rawErrors as Record<string, unknown>;
  const pick = (key: string): string => {
    const value = source[key];
    if (!value) return "";
    if (Array.isArray(value) && value.length) return String(value[0]);
    return typeof value === "string" ? value : "";
  };

  errors.academic_year_id = pick("academic_year") || pick("academic_year_id");
  errors.class_id = pick("class_id") || pick("class_id_ref") || pick("school_class");
  errors.section_id = pick("section") || pick("section_id") || pick("section_id_ref");
  errors.subject_id = pick("subject") || pick("subject_id") || pick("subject_id_ref");
  errors.homework_date = pick("homework_date");
  errors.submission_date = pick("submission_date");
  errors.description = pick("description");
  errors.file = pick("file") || pick("file_upload");

  const topMessage = typeof payload.message === "string" ? payload.message : fallbackMessage;
  const lowered = topMessage.toLowerCase();
  if (!errors.class_id && lowered.includes("class")) errors.class_id = topMessage;
  if (!errors.section_id && lowered.includes("section")) errors.section_id = topMessage;
  if (!errors.subject_id && lowered.includes("subject")) errors.subject_id = topMessage;
  if (!errors.homework_date && lowered.includes("homework date")) errors.homework_date = topMessage;
  if (!errors.submission_date && lowered.includes("submission date")) errors.submission_date = topMessage;
  if (!errors.description && lowered.includes("description")) errors.description = topMessage;
  if (!errors.file && (lowered.includes("file") || lowered.includes("attachment"))) errors.file = topMessage;

  return errors;
}

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

async function apiPatch<T>(path: string, payload: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function apiDelete(path: string): Promise<void> {
  await apiRequestWithRefresh<void>(path, { method: "DELETE", headers: { "Content-Type": "application/json" } });
}

function boxStyle() {
  return { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 } as const;
}

function fieldStyle() {
  return { width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" } as const;
}

function buttonStyle(color = "var(--primary)") {
  return {
    height: 36,
    padding: "0 12px",
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
  } as const;
}

function LegacyBreadcrumb({ title, pageLabel }: { title: string; pageLabel: string }) {
  return (
    <section className="sms-breadcrumb mb-20">
      <div className="container-fluid">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>
          <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
            <span>Dashboard</span>
            <span>/</span>
            <span>Homework</span>
            <span>/</span>
            <span>{pageLabel}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function useHomeworkLookups() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const load = async () => {
      const [yearData, classData, sectionData, subjectData, studentData] = await Promise.all([
        apiGet<ApiList<AcademicYear>>("/api/v1/core/academic-years/"),
        apiGet<ApiList<SchoolClass>>("/api/v1/core/classes/"),
        apiGet<ApiList<Section>>("/api/v1/core/sections/"),
        apiGet<ApiList<Subject>>("/api/v1/core/subjects/"),
        apiGet<ApiList<Student>>("/api/v1/students/students/"),
      ]);
      setYears(listData(yearData));
      setClasses(sortAcademicsClasses(listData(classData)));
      setSections(listData(sectionData));
      setSubjects(listData(subjectData));
      setStudents(listData(studentData));
    };
    void load();
  }, []);

  return { years, classes, sections, subjects, students };
}

export function HomeworkAddPagePanel() {
  const router = useRouter();
  const { years, classes, sections, subjects } = useHomeworkLookups();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [academicYearId, setAcademicYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [homeworkDate, setHomeworkDate] = useState(new Date().toISOString().slice(0, 10));
  const [submissionDate, setSubmissionDate] = useState(new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState("100");
  const [file, setFile] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const filteredSections = useMemo(() => {
    if (!classId) return [];
    return sections.filter((section) => section.school_class === Number(classId));
  }, [classId, sections]);

  const hasFieldError = Boolean(Object.keys(fieldErrors).length);
  const hasActiveFieldError = Boolean(Object.values(fieldErrors).some((value) => value && value.trim()));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!academicYearId) nextErrors.academic_year_id = "Academic year is required.";
    if (!classId) nextErrors.class_id = "Class is required.";
    if (!sectionId) nextErrors.section_id = "Section is required.";
    if (!subjectId) nextErrors.subject_id = "Subject is required.";
    if (!homeworkDate) nextErrors.homework_date = "Homework date is required.";
    if (!submissionDate) nextErrors.submission_date = "Submission date is required.";
    if (!description.trim()) nextErrors.description = "Description is required.";
    if (homeworkDate && submissionDate && submissionDate < homeworkDate) nextErrors.submission_date = "Submission date must be on or after homework date.";

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError("");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setFieldErrors({});

      if (uploadFile) {
        const formData = new FormData();
        if (academicYearId) formData.append("academic_year_id", academicYearId);
        formData.append("class_id", classId);
        if (sectionId) formData.append("section_id", sectionId);
        formData.append("subject_id", subjectId);
        formData.append("homework_date", homeworkDate);
        formData.append("submission_date", submissionDate);
        formData.append("marks", String(Number(marks || "0")));
        formData.append("description", description.trim());
        formData.append("file_upload", uploadFile);
        if (file.trim()) formData.append("file", file.trim());
        await apiRequestWithRefresh("/api/v1/academics/homeworks/", {
          method: "POST",
          body: formData,
        });
      } else {
        await apiPost("/api/v1/academics/homeworks/", {
          academic_year_id: academicYearId ? Number(academicYearId) : undefined,
          class_id: Number(classId),
          section_id: sectionId ? Number(sectionId) : null,
          subject_id: Number(subjectId),
          homework_date: homeworkDate,
          submission_date: submissionDate,
          marks: Number(marks || "0"),
          description: description.trim(),
          file: file.trim(),
        });
      }
      setSuccess("Homework created successfully.");
      setTimeout(() => {
        router.push("/academics/homework-list");
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to create homework.";
      const details = err && typeof err === "object" && "details" in err ? (err as { details?: unknown }).details : undefined;
      const nextErrors = extractHomeworkFieldErrors(details, msg);
      setFieldErrors(nextErrors);
      setError(nextErrors.academic_year_id || nextErrors.class_id || nextErrors.section_id || nextErrors.subject_id || nextErrors.homework_date || nextErrors.submission_date || nextErrors.description || nextErrors.file ? "" : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="legacy-panel">
      <LegacyBreadcrumb title="Add Homework" pageLabel="Add Homework" />
      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <form onSubmit={submit} className="white-box" style={boxStyle()}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Academic Year *</label>
                <select value={academicYearId} onChange={(e) => { setAcademicYearId(e.target.value); setFieldErrors((prev) => ({ ...prev, academic_year_id: "" })); }} style={fieldStyle()}>
                  <option value="">Select academic year</option>
                {years.map((year) => (
                  <option key={year.id} value={year.id}>{year.name}</option>
                ))}
                </select>
                <span style={{ display: "block", minHeight: 16, color: "#dc2626", fontSize: 12 }}>{fieldErrors.academic_year_id || ""}</span>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Class *</label>
                <select
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setSectionId("");
                    setFieldErrors((prev) => ({ ...prev, class_id: "", section_id: "" }));
                  }}
                  style={fieldStyle()}
                >
                  <option value="">Select class</option>
                  {classes.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
                  ))}
                </select>
                <span style={{ display: "block", minHeight: 16, color: "#dc2626", fontSize: 12 }}>{fieldErrors.class_id || ""}</span>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Section *</label>
                <select value={sectionId} onChange={(e) => { setSectionId(e.target.value); setFieldErrors((prev) => ({ ...prev, section_id: "" })); }} style={fieldStyle()}>
                  <option value="">Select section</option>
                  {filteredSections.map((section) => (
                    <option key={section.id} value={section.id}>{section.name}</option>
                  ))}
                </select>
                <span style={{ display: "block", minHeight: 16, color: "#dc2626", fontSize: 12 }}>{fieldErrors.section_id || ""}</span>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Subject *</label>
                <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setFieldErrors((prev) => ({ ...prev, subject_id: "" })); }} style={fieldStyle()}>
                  <option value="">Select subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
                <span style={{ display: "block", minHeight: 16, color: "#dc2626", fontSize: 12 }}>{fieldErrors.subject_id || ""}</span>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Homework Date *</label>
                <input type="date" value={homeworkDate} onChange={(e) => { setHomeworkDate(e.target.value); setFieldErrors((prev) => ({ ...prev, homework_date: "" })); }} style={fieldStyle()} />
                <span style={{ display: "block", minHeight: 16, color: "#dc2626", fontSize: 12 }}>{fieldErrors.homework_date || ""}</span>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Submission Date *</label>
                <input type="date" value={submissionDate} onChange={(e) => { setSubmissionDate(e.target.value); setFieldErrors((prev) => ({ ...prev, submission_date: "" })); }} style={fieldStyle()} />
                <span style={{ display: "block", minHeight: 16, color: "#dc2626", fontSize: 12 }}>{fieldErrors.submission_date || ""}</span>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Marks</label>
                <input type="number" min="0" value={marks} onChange={(e) => setMarks(e.target.value)} style={fieldStyle()} placeholder="Marks" />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Attachment File</label>
                <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} style={fieldStyle()} />
                <span style={{ display: "block", minHeight: 16, color: "#64748b", fontSize: 12 }}>{uploadFile ? uploadFile.name : "Browse and upload a document or image."}</span>
                <span style={{ display: "block", minHeight: 16, color: "#dc2626", fontSize: 12 }}>{fieldErrors.file || ""}</span>
              </div>
              <div style={{ gridColumn: "1 / span 3" }}>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Attachment URL or file path</label>
                <input value={file} onChange={(e) => { setFile(e.target.value); setFieldErrors((prev) => ({ ...prev, file: "" })); }} style={fieldStyle()} placeholder="Attachment URL or file path" />
              </div>
            </div>

            {hasFieldError ? <p style={{ color: "var(--warning)", margin: "10px 0 0" }}>{error || "Please correct highlighted fields."}</p> : null}
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setFieldErrors((prev) => ({ ...prev, description: "" })); }}
              placeholder="Homework description *"
              style={{ width: "100%", minHeight: 120, border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginTop: 10 }}
            />
            <span style={{ display: "block", minHeight: 16, color: "#dc2626", fontSize: 12 }}>{fieldErrors.description || ""}</span>

            {error && !hasFieldError && <p style={{ color: "var(--warning)", margin: "10px 0 0" }}>{error}</p>}
            {success && <p style={{ color: "#059669", margin: "10px 0 0" }}>{success}</p>}

            <div style={{ marginTop: 12 }}>
              <button type="submit" disabled={saving || hasActiveFieldError} style={buttonStyle()}>
                {saving ? "Saving..." : "Save Homework"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

export function HomeworkListPagePanel() {
  const { classes, sections, subjects, students } = useHomeworkLookups();
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 25;

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);
  const [viewingHomework, setViewingHomework] = useState<Homework | null>(null);
  const [evaluationDate, setEvaluationDate] = useState(new Date().toISOString().slice(0, 10));
  const [drafts, setDrafts] = useState<Record<number, EvalDraft>>({});
  const [savingEval, setSavingEval] = useState(false);

  const filteredSections = useMemo(() => {
    if (!classId) return [];
    return sections.filter((section) => section.school_class === Number(classId));
  }, [classId, sections]);

  const selectedHomeworkStudents = useMemo(() => {
    if (!selectedHomework) return [];
    return students.filter((student) => {
      if (student.current_class !== selectedHomework.class_id) return false;
      if (selectedHomework.section_id) return student.current_section === selectedHomework.section_id;
      return true;
    });
  }, [selectedHomework, students]);

  const loadHomeworks = async (nextPage = page) => {
    const params = new URLSearchParams();
    if (classId) params.set("class_id", classId);
    if (sectionId) params.set("section_id", sectionId);
    if (subjectId) params.set("subject_id", subjectId);
    params.set("page", String(nextPage));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    setLoading(true);
    try {
      const data = await apiGet<ApiList<Homework> | PaginatedResponse<Homework>>(`/api/v1/academics/homeworks/${suffix}`);
      if (isPaginated<Homework>(data)) {
        setHomeworks(data.results || []);
        setTotalPages(Math.max(1, Math.ceil((data.count || 0) / pageSize)));
      } else {
        const list = listData(data);
        setHomeworks(list);
        setTotalPages(1);
      }
      setHasSearched(true);
      setError("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load homework records.";
      setHomeworks([]);
      setTotalPages(1);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async () => {
    if (!classId && !sectionId && !subjectId) {
      setError("Please select search criteria.");
      setHomeworks([]);
      setHasSearched(false);
      return;
    }
    setPage(1);
    await loadHomeworks(1);
  };

  const goToPage = async (nextPage: number) => {
    setPage(nextPage);
    await loadHomeworks(nextPage);
  };

  const openEvaluation = async (homework: Homework) => {
    try {
      setError("");
      setSelectedHomework(homework);
      setEvaluationDate(homework.evaluation_date || new Date().toISOString().slice(0, 10));
      const data = await apiGet<ApiList<HomeworkSubmission>>(`/api/v1/academics/homework-submissions/?homework_id=${homework.id}`);
      const existing = listData(data);
      const map: Record<number, EvalDraft> = {};
      existing.forEach((row) => {
        map[row.student_id] = {
          id: row.id,
          marks: String(row.marks ?? "0"),
          complete_status: row.complete_status || "P",
          note: row.note || "",
        };
      });
      setDrafts(map);
    } catch {
      setSelectedHomework(null);
      setError("Unable to load homework evaluation.");
    }
  };

  const setDraft = (studentId: number, patch: Partial<EvalDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: {
        id: prev[studentId]?.id,
        marks: prev[studentId]?.marks ?? "0",
        complete_status: prev[studentId]?.complete_status ?? "P",
        note: prev[studentId]?.note ?? "",
        ...patch,
      },
    }));
  };

  const saveEvaluation = async () => {
    if (!selectedHomework) return;
    if (evaluationDate && selectedHomework.submission_date && evaluationDate < selectedHomework.submission_date) {
      setError("Evaluation date must be on or after submission date.");
      return;
    }
    try {
      setSavingEval(true);
      setError("");
      for (const student of selectedHomeworkStudents) {
        const draft = drafts[student.id] || { marks: "0", complete_status: "P", note: "" };
        const payload = {
          homework_id: selectedHomework.id,
          student_id: student.id,
          marks: Number(draft.marks || "0"),
          complete_status: draft.complete_status,
          note: draft.note,
        };
        if (draft.id) {
          await apiPatch(`/api/v1/academics/homework-submissions/${draft.id}/`, payload);
        } else {
          await apiPost("/api/v1/academics/homework-submissions/", payload);
        }
      }
      await apiPatch(`/api/v1/academics/homeworks/${selectedHomework.id}/`, { evaluation_date: evaluationDate });
      await loadHomeworks();
      setSelectedHomework(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save evaluation.");
    } finally {
      setSavingEval(false);
    }
  };

  const deleteHomework = async (id: number) => {
    try {
      await apiDelete(`/api/v1/academics/homeworks/${id}/`);
      await loadHomeworks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete homework.");
    }
  };

  const openViewHomework = (homework: Homework) => {
    setViewingHomework(homework);
  };

  return (
    <div className="legacy-panel">
      <LegacyBreadcrumb title="Homework List" pageLabel="Homework List" />
      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Search Criteria</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr)) auto", gap: 8 }}>
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setSectionId("");
                }}
                style={fieldStyle()}
              >
                <option value="">All Classes</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
                ))}
              </select>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={fieldStyle()}>
                <option value="">All Sections</option>
                {filteredSections.map((section) => (
                  <option key={section.id} value={section.id}>{section.name}</option>
                ))}
              </select>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={fieldStyle()}>
                <option value="">All Subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => void runSearch()} style={buttonStyle()}>Search</button>
            </div>
            {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          </div>

          <div className="white-box" style={boxStyle()}>
            {!hasSearched ? (
              <div style={{ padding: 12, color: "var(--text-muted)" }}>Select filters and click Search to load homework records.</div>
            ) : null}
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Homework Date</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Submission Date</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Marks</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Evaluation Date</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Description</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={6} style={{ padding: 12 }}>Loading...</td></tr> : null}
                {!loading && homeworks.length === 0 ? <tr><td colSpan={6} style={{ padding: 12, color: "var(--text-muted)" }}>No homework records found.</td></tr> : null}
                {!loading && homeworks.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.homework_date}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.submission_date}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.marks}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.evaluation_date || "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.description}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                      <button type="button" onClick={() => void openViewHomework(row)} style={buttonStyle("#059669")}>View</button>
                      <button type="button" onClick={() => void openEvaluation(row)} style={{ ...buttonStyle("#2563eb"), marginLeft: 8 }}>Evaluation</button>
                      <button type="button" onClick={() => void deleteHomework(row.id)} style={{ ...buttonStyle("#dc2626"), marginLeft: 8 }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasSearched ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <button type="button" onClick={() => void goToPage(Math.max(1, page - 1))} disabled={loading || page <= 1} style={buttonStyle("#6b7280")}>
                  Previous
                </button>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Page {page} of {totalPages}</span>
                <button type="button" onClick={() => void goToPage(Math.min(totalPages, page + 1))} disabled={loading || page >= totalPages} style={buttonStyle("#6b7280")}>
                  Next
                </button>
              </div>
            ) : null}
          </div>

          {viewingHomework && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0, 0, 0, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setViewingHomework(null);
              }}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: "var(--radius)",
                  padding: 24,
                  maxWidth: 600,
                  maxHeight: "90vh",
                  overflowY: "auto",
                  boxShadow: "0 20px 25px rgba(0, 0, 0, 0.15)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>📚 Homework Details</h3>
                  <button
                    type="button"
                    onClick={() => setViewingHomework(null)}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: 24,
                      cursor: "pointer",
                      padding: 0,
                      color: "var(--text-muted)",
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 500 }}>Homework Date</label>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{viewingHomework.homework_date}</div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 500 }}>Submission Date</label>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{viewingHomework.submission_date}</div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 500 }}>Marks</label>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{viewingHomework.marks}</div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 500 }}>Evaluation Date</label>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{viewingHomework.evaluation_date || "-"}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 500 }}>Description</label>
                  <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#f8fafc", padding: 12, borderRadius: 6, maxHeight: 200, overflowY: "auto" }}>
                    {viewingHomework.description}
                  </div>
                </div>

                {viewingHomework.file && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 500 }}>Attachment</label>
                    <a
                      href={constructFileUrl(viewingHomework.file)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--primary)", textDecoration: "underline", fontSize: 13 }}
                    >
                      📎 {viewingHomework.file}
                    </a>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
                  <button type="button" onClick={() => setViewingHomework(null)} style={buttonStyle("#6b7280")}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedHomework && (
            <div className="white-box" style={{ ...boxStyle(), marginTop: 12 }}>
              <h3 style={{ marginTop: 0 }}>Homework Evaluation</h3>
              <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
                <label style={{ fontSize: 13, color: "var(--text-muted)" }}>Evaluation Date</label>
                <input type="date" value={evaluationDate} onChange={(e) => setEvaluationDate(e.target.value)} style={{ ...fieldStyle(), maxWidth: 180 }} />
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Admission</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Student</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Marks</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedHomeworkStudents.map((student) => {
                    const draft = drafts[student.id] || { marks: "0", complete_status: "P", note: "" };
                    return (
                      <tr key={student.id}>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{student.admission_no}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{student.first_name} {student.last_name}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                          <select value={draft.complete_status} onChange={(e) => setDraft(student.id, { complete_status: e.target.value as "C" | "I" | "P" })} style={fieldStyle()}>
                            <option value="P">Pending</option>
                            <option value="C">Completed</option>
                            <option value="I">Incomplete</option>
                          </select>
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                          <input type="number" min="0" value={draft.marks} onChange={(e) => setDraft(student.id, { marks: e.target.value })} style={fieldStyle()} />
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                          <input value={draft.note} onChange={(e) => setDraft(student.id, { note: e.target.value })} style={fieldStyle()} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={() => void saveEvaluation()} disabled={savingEval} style={buttonStyle()}>
                  {savingEval ? "Saving..." : "Save Evaluation"}
                </button>
                <button type="button" onClick={() => setSelectedHomework(null)} style={{ ...buttonStyle("#6b7280"), marginLeft: 8 }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function HomeworkEvaluationReportPagePanel() {
  const { classes, sections, subjects } = useHomeworkLookups();
  const [rows, setRows] = useState<Array<Homework & { completed: number; incomplete: number; pending: number }>>([]);
  const [error, setError] = useState("");

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const filteredSections = useMemo(() => {
    if (!classId) return [];
    return sections.filter((section) => section.school_class === Number(classId));
  }, [classId, sections]);

  const search = async () => {
    if (!classId && !sectionId && !subjectId) {
      setError("Please select search criteria.");
      setRows([]);
      return;
    }
    try {
      setError("");
      const params = new URLSearchParams();
      if (classId) params.set("class_id", classId);
      if (sectionId) params.set("section_id", sectionId);
      if (subjectId) params.set("subject_id", subjectId);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const homeworksData = await apiGet<ApiList<Homework>>(`/api/v1/academics/homeworks/${suffix}`);
      const homeworks = listData(homeworksData);

      const reportRows: Array<Homework & { completed: number; incomplete: number; pending: number }> = [];
      for (const hw of homeworks) {
        const submissionData = await apiGet<ApiList<HomeworkSubmission>>(`/api/v1/academics/homework-submissions/?homework_id=${hw.id}`);
        const submissions = listData(submissionData);
        reportRows.push({
          ...hw,
          completed: submissions.filter((item) => item.complete_status === "C").length,
          incomplete: submissions.filter((item) => item.complete_status === "I").length,
          pending: submissions.filter((item) => item.complete_status === "P").length,
        });
      }
      setRows(reportRows);
    } catch {
      setRows([]);
      setError("Unable to load homework evaluation report.");
    }
  };

  return (
    <div className="legacy-panel">
      <LegacyBreadcrumb title="Homework Evaluation Report" pageLabel="Homework Evaluation Report" />
      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Search Criteria</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr)) auto", gap: 8 }}>
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setSectionId("");
                }}
                style={fieldStyle()}
              >
                <option value="">All Classes</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
                ))}
              </select>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={fieldStyle()}>
                <option value="">All Sections</option>
                {filteredSections.map((section) => (
                  <option key={section.id} value={section.id}>{section.name}</option>
                ))}
              </select>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={fieldStyle()}>
                <option value="">All Subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => void search()} style={buttonStyle()}>Search</button>
            </div>
            {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          </div>

          <div className="white-box" style={boxStyle()}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Homework Date</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Submission Date</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Evaluation Date</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Marks</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Completed</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Incomplete</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Pending</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.homework_date}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.submission_date}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.evaluation_date || "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.marks}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.completed}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.incomplete}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.pending}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
