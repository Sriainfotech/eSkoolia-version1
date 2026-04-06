"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type ApiList<T> = T[] | { results?: T[]; count?: number; next?: string | null; previous?: string | null };

type Student = {
  id: number;
  admission_no: string;
  roll_no?: string;
  first_name: string;
  last_name?: string;
  current_class?: number | null;
  current_section?: number | null;
};

type SchoolClass = {
  id: number;
  name: string;
};

type Section = {
  id: number;
  school_class: number;
  name: string;
};

type Subject = {
  id: number;
  name: string;
};

type AcademicYear = {
  id: number;
  name: string;
  is_current: boolean;
};

type PaginatedStudents = {
  results: Student[];
  count: number;
};

type ApiError = Error & {
  details?: {
    message?: string;
    field_errors?: Record<string, string | string[]>;
  };
};

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

function paginatedData<T>(value: ApiList<T>): { results: T[]; count: number } {
  if (Array.isArray(value)) {
    return { results: value, count: value.length };
  }
  return {
    results: value.results || [],
    count: value.count || 0,
  };
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

function fieldStyle() {
  return {
    width: "100%",
    height: 36,
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "0 10px",
  } as const;
}

function boxStyle() {
  return {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: 16,
  } as const;
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

function parseError(error: unknown): { message: string; fieldErrors: Record<string, string> } {
  const apiError = error as ApiError;
  const fieldErrorsRaw = apiError?.details?.field_errors || {};
  const fieldErrors: Record<string, string> = {};
  for (const [field, value] of Object.entries(fieldErrorsRaw)) {
    fieldErrors[field] = Array.isArray(value) ? String(value[0] || "") : String(value || "");
  }

  const detailsMessage = apiError?.details?.message;
  if (detailsMessage) {
    return { message: detailsMessage, fieldErrors };
  }

  if (error instanceof Error) {
    if (error.message.includes("401") || error.message.toLowerCase().includes("permission")) {
      return { message: "You do not have permission to perform this action", fieldErrors };
    }
    if (error.message.toLowerCase().includes("failed to fetch")) {
      return { message: "Network error. Please check your connection", fieldErrors };
    }
    return { message: error.message, fieldErrors };
  }

  return { message: "Failed to assign subjects", fieldErrors };
}

function studentLabel(student: Student) {
  return `${student.first_name || ""} ${student.last_name || ""}`.trim() || `Student #${student.id}`;
}

export function StudentMultiClassPanel({ selectedStudentId }: { selectedStudentId?: number } = {}) {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [students, setStudents] = useState<Student[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const [academicYearId, setAcademicYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [isOptional, setIsOptional] = useState(false);

  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>(selectedStudentId ? [selectedStudentId] : []);

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sectionsForClass = useMemo(() => {
    if (!classId) {
      return [];
    }
    return sections.filter((item) => String(item.school_class) === classId);
  }, [sections, classId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
      setCurrentPage(1);
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchText]);

  const loadMeta = async () => {
    try {
      setLoadingMeta(true);
      setError("");
      const [yearData, classData, sectionData, subjectData] = await Promise.all([
        apiGet<ApiList<AcademicYear>>("/api/v1/core/academic-years/"),
        apiGet<ApiList<SchoolClass>>("/api/v1/core/classes/"),
        apiGet<ApiList<Section>>("/api/v1/core/sections/"),
        apiGet<ApiList<Subject>>("/api/v1/core/subjects/"),
      ]);
      setAcademicYears(listData(yearData));
      setClasses(listData(classData));
      setSections(listData(sectionData));
      setSubjects(listData(subjectData));

      const currentYear = listData(yearData).find((item) => item.is_current);
      if (currentYear) {
        setAcademicYearId(String(currentYear.id));
      }
    } catch (err) {
      setError(parseError(err).message);
    } finally {
      setLoadingMeta(false);
    }
  };

  const loadStudents = async () => {
    try {
      setLoadingStudents(true);
      setError("");

      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      if (classId) {
        params.set("class", classId);
      }
      if (sectionId) {
        params.set("section", sectionId);
      }
      if (academicYearId) {
        params.set("academic_year", academicYearId);
      }
      if (debouncedSearchText) {
        params.set("search", debouncedSearchText);
      }

      const data = await apiGet<ApiList<Student>>(`/api/v1/students/students/?${params.toString()}`);
      const parsed = paginatedData(data);
      setStudents(parsed.results);
      setTotalStudents(parsed.count);

      if (selectedStudentId) {
        const exists = parsed.results.some((item) => item.id === selectedStudentId);
        if (exists) {
          setSelectedStudentIds([selectedStudentId]);
        }
      }
    } catch {
      setError("Unable to load students. Please try again");
      setStudents([]);
      setTotalStudents(0);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    void loadMeta();
  }, []);

  useEffect(() => {
    if (!loadingMeta) {
      void loadStudents();
    }
  }, [loadingMeta, currentPage, classId, sectionId, academicYearId, debouncedSearchText]);

  useEffect(() => {
    if (!classId) {
      setSectionId("");
      return;
    }
    if (sectionId && !sectionsForClass.some((item) => String(item.id) === sectionId)) {
      setSectionId("");
    }
  }, [classId, sectionId, sectionsForClass]);

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    if (!classId) {
      nextErrors.class = "Please select a class";
    }
    if (sectionId && classId && !sectionsForClass.some((item) => String(item.id) === sectionId)) {
      nextErrors.section = "Section does not belong to selected class";
    }
    if (selectedSubjectIds.length === 0) {
      nextErrors.subject_ids = "Please select at least one subject";
    }
    return nextErrors;
  };

  const canSubmit = () => {
    return !assigning && Object.keys(validateForm()).length === 0;
  };

  const toggleStudentSelection = (studentId: number) => {
    setSelectedStudentIds((prev) => {
      if (prev.includes(studentId)) {
        return prev.filter((item) => item !== studentId);
      }
      return [...prev, studentId];
    });
  };

  const toggleAllVisibleStudents = () => {
    const allIds = students.map((item) => item.id);
    const allSelected = allIds.every((id) => selectedStudentIds.includes(id));
    if (allSelected) {
      setSelectedStudentIds((prev) => prev.filter((id) => !allIds.includes(id)));
      return;
    }
    setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...allIds])));
  };

  const assignSubjects = async (mode: "individual" | "selected" | "class_section", studentId?: number) => {
    const nextErrors = validateForm();
    if (mode !== "class_section" && !sectionId) {
      nextErrors.section = "Section does not belong to selected class";
    }
    if (mode === "individual" && !studentId) {
      nextErrors.student_id = "Unable to load students. Please try again";
    }
    if (mode === "selected" && selectedStudentIds.length === 0) {
      nextErrors.student_ids = "Please select at least one student";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("Validation failed");
      return;
    }

    try {
      setAssigning(true);
      setError("");
      setSuccess("");

      const payload = {
        academic_year: Number(academicYearId),
        school_class: Number(classId),
        section: Number(sectionId),
        subject_ids: selectedSubjectIds,
        is_optional: isOptional,
      };

      if (mode === "individual") {
        await apiPost("/api/v1/students/subject-assignments/assign-individual/", {
          ...payload,
          student_id: studentId,
        });
      } else if (mode === "selected") {
        await apiPost("/api/v1/students/subject-assignments/assign-bulk/", {
          ...payload,
          student_ids: selectedStudentIds,
        });
      } else {
        await apiPost("/api/v1/students/subject-assignments/assign-bulk/", payload);
      }

      setSuccess("Subjects assigned successfully");
      setSelectedStudentIds([]);
      setFieldErrors({});
    } catch (err) {
      const parsed = parseError(err);
      setError(parsed.message || "Failed to assign subjects");
      setFieldErrors(parsed.fieldErrors);
      if (!parsed.message) {
        setError("Failed to assign subjects");
      }
    } finally {
      setAssigning(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalStudents / 25));

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Student Subject Assignment</h1>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/students/add" style={{ ...buttonStyle("#16a34a"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                  Add Student
                </Link>
                <Link href="/students/list" style={{ ...buttonStyle("#0ea5e9"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                  Student List
                </Link>
              </div>
              <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
                <span>Dashboard</span>
                <span>/</span>
                <span>Student Information</span>
                <span>/</span>
                <span>Student Subject Assignment</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0" style={{ display: "grid", gap: 12 }}>
          <div className="white-box" style={boxStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Select Criteria</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(150px, 1fr))", gap: 8 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Academic Year *</label>
                <select value={academicYearId} onChange={(event) => setAcademicYearId(event.target.value)} style={fieldStyle()}>
                  <option value="">Select Year</option>
                  {academicYears.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.academic_year && <p style={{ margin: "6px 0 0", color: "var(--warning)", fontSize: 12 }}>{fieldErrors.academic_year}</p>}
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Class *</label>
                <select value={classId} onChange={(event) => { setClassId(event.target.value); setCurrentPage(1); }} style={fieldStyle()}>
                  <option value="">Select Class</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.class && <p style={{ margin: "6px 0 0", color: "var(--warning)", fontSize: 12 }}>{fieldErrors.class}</p>}
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Section *</label>
                <select value={sectionId} onChange={(event) => { setSectionId(event.target.value); setCurrentPage(1); }} style={fieldStyle()} disabled={!classId}>
                  <option value="">Select Section</option>
                  {sectionsForClass.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.section && <p style={{ margin: "6px 0 0", color: "var(--warning)", fontSize: 12 }}>{fieldErrors.section}</p>}
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Search Student</label>
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Name / Admission / Roll"
                  style={fieldStyle()}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Optional Subject</label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, height: 36 }}>
                  <input type="checkbox" checked={isOptional} onChange={(event) => setIsOptional(event.target.checked)} />
                  Mark as optional
                </label>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Subjects * (Multi Select)</label>
              <select
                multiple
                value={selectedSubjectIds.map(String)}
                onChange={(event) => {
                  const values = Array.from(event.target.selectedOptions).map((item) => Number(item.value));
                  setSelectedSubjectIds(values);
                }}
                style={{ ...fieldStyle(), height: 120, padding: 8 }}
              >
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {fieldErrors.subject_ids && <p style={{ margin: "6px 0 0", color: "var(--warning)", fontSize: 12 }}>{fieldErrors.subject_ids}</p>}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button type="button" style={buttonStyle()} disabled={!canSubmit()} onClick={() => void assignSubjects("selected")}>
                {assigning ? "Assigning..." : "Assign to Selected Students"}
              </button>
              <button type="button" style={buttonStyle("#0ea5e9")} disabled={!canSubmit()} onClick={() => void assignSubjects("class_section")}>
                {assigning ? "Assigning..." : "Assign to Entire Class/Section"}
              </button>
            </div>
          </div>

          <div className="white-box" style={boxStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Student List</h3>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>
                      <input
                        type="checkbox"
                        checked={students.length > 0 && students.every((item) => selectedStudentIds.includes(item.id))}
                        onChange={toggleAllVisibleStudents}
                      />
                    </th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>Admission No</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>Roll No</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>Student Name</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingStudents ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 12, color: "var(--text-muted)" }}>
                        Loading students...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 12, color: "var(--text-muted)" }}>
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr key={student.id}>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid #eef2f7" }}>
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.includes(student.id)}
                            onChange={() => toggleStudentSelection(student.id)}
                          />
                        </td>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid #eef2f7" }}>{student.admission_no || "-"}</td>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid #eef2f7" }}>{student.roll_no || "-"}</td>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid #eef2f7" }}>{studentLabel(student)}</td>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid #eef2f7" }}>
                          <button
                            type="button"
                            style={buttonStyle("#16a34a")}
                            disabled={!canSubmit()}
                            onClick={() => void assignSubjects("individual", student.id)}
                          >
                            Assign
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Total: {totalStudents} students | Page {currentPage} of {totalPages}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  style={buttonStyle("#64748b")}
                  disabled={currentPage <= 1 || loadingStudents}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  style={buttonStyle("#64748b")}
                  disabled={currentPage >= totalPages || loadingStudents}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {loadingMeta && <p style={{ margin: 0, color: "var(--text-muted)" }}>Loading data...</p>}
          {error && <p style={{ margin: 0, color: "var(--warning)" }}>{error}</p>}
          {success && <p style={{ margin: 0, color: "#0f766e" }}>{success}</p>}
        </div>
      </section>
    </div>
  );
}
