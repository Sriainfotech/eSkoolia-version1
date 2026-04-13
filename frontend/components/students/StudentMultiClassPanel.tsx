"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/common/Spinner";
import { TopToast } from "@/components/common/TopToast";
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

type StudentSubjectAssignment = {
  student: number;
  subject_name: string;
  subject?: number;
  academic_year?: number;
  section?: number;
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

function chipStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
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

function getBestValidationMessage(message: string, fieldErrors: Record<string, string>) {
  const fallback = message || "Validation failed";
  const lower = fallback.toLowerCase();
  if (lower === "validation failed" || lower.includes("validation failed")) {
    return (
      fieldErrors.subject_ids ||
      fieldErrors.student_ids ||
      fieldErrors.section ||
      fieldErrors.class ||
      fieldErrors.academic_year ||
      Object.values(fieldErrors)[0] ||
      fallback
    );
  }
  return fallback;
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
  const [pageSize, setPageSize] = useState(25);

  const [academicYearId, setAcademicYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [isOptional, setIsOptional] = useState(false);
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);

  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>(selectedStudentId ? [selectedStudentId] : []);

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [assignmentMap, setAssignmentMap] = useState<Record<number, string[]>>({});
  const subjectDropdownRef = useRef<HTMLDivElement | null>(null);

  const sectionsForClass = useMemo(() => {
    if (!classId) {
      return [];
    }
    return sections.filter((item) => String(item.school_class) === classId);
  }, [sections, classId]);

  const selectedSubjects = useMemo(
    () => subjects.filter((item) => selectedSubjectIds.includes(item.id)),
    [subjects, selectedSubjectIds],
  );

  const subjectSummary = useMemo(() => {
    if (selectedSubjects.length === 0) {
      return "Select Subjects";
    }
    const labels = selectedSubjects.slice(0, 2).map((item) => item.name);
    if (selectedSubjects.length > 2) {
      labels.push(`+${selectedSubjects.length - 2} more`);
    }
    return labels.join(", ");
  }, [selectedSubjects]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
      setCurrentPage(1);
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchText]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (subjectDropdownRef.current && !subjectDropdownRef.current.contains(event.target as Node)) {
        setSubjectDropdownOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSubjectDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const loadMeta = async () => {
    try {
      setLoadingMeta(true);
      setError("");
      const [yearData, classData, subjectData] = await Promise.all([
        apiGet<ApiList<AcademicYear>>("/api/v1/core/academic-years/"),
        apiGet<ApiList<SchoolClass>>("/api/v1/core/classes/"),
        apiGet<ApiList<Subject>>("/api/v1/core/subjects/"),
      ]);
      setAcademicYears(listData(yearData));
      setClasses(listData(classData));
      setSections([]);
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

  const loadSectionsForClass = async (targetClassId: string) => {
    if (!targetClassId) {
      setSections([]);
      setSectionId("");
      return;
    }

    try {
      setLoadingSections(true);
      setSections([]);
      setSectionId("");
      const data = await apiGet<ApiList<Section>>(`/api/v1/core/sections/?class=${encodeURIComponent(targetClassId)}&page_size=200`);
      setSections(listData(data));
    } catch {
      setError("Unable to load sections for selected class.");
    } finally {
      setLoadingSections(false);
    }
  };

  const loadStudents = async () => {
    try {
      setLoadingStudents(true);
      setError("");

      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("page_size", String(pageSize));
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

  const loadAssignments = async () => {
    if (!academicYearId || !classId || !sectionId) {
      setAssignmentMap({});
      return;
    }

    try {
      setLoadingAssignments(true);
      const params = new URLSearchParams();
      params.set("academic_year", academicYearId);
      params.set("class", classId);
      params.set("section", sectionId);
      params.set("page_size", "500");
      const data = await apiGet<ApiList<StudentSubjectAssignment>>(`/api/v1/students/subject-assignments/?${params.toString()}`);
      const assignments = listData(data);
      const nextMap: Record<number, string[]> = {};
      for (const item of assignments) {
        if (!nextMap[item.student]) {
          nextMap[item.student] = [];
        }
        if (item.subject_name && !nextMap[item.student].includes(item.subject_name)) {
          nextMap[item.student].push(item.subject_name);
        }
      }
      setAssignmentMap(nextMap);
    } catch {
      setAssignmentMap({});
    } finally {
      setLoadingAssignments(false);
    }
  };

  useEffect(() => {
    void loadMeta();
  }, []);

  useEffect(() => {
    if (!loadingMeta) {
      void loadStudents();
    }
  }, [loadingMeta, currentPage, pageSize, classId, sectionId, academicYearId, debouncedSearchText]);

  useEffect(() => {
    if (!loadingMeta && classId) {
      void loadSectionsForClass(classId);
    }
  }, [loadingMeta, classId]);

  useEffect(() => {
    if (!loadingMeta) {
      void loadAssignments();
    }
  }, [loadingMeta, academicYearId, classId, sectionId]);

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
    if (!academicYearId) {
      nextErrors.academic_year = "Please select an academic year";
    }
    if (!classId) {
      nextErrors.class = "Please select a class";
    }
    if (!sectionId) {
      nextErrors.section = "Please select a section";
    } else if (classId && !sectionsForClass.some((item) => String(item.id) === sectionId)) {
      nextErrors.section = "Section does not belong to selected class";
    }
    if (selectedSubjectIds.length === 0) {
      nextErrors.subject_ids = "Please select at least one subject";
    }
    return nextErrors;
  };

  const isAssignEnabled = Boolean(
    academicYearId &&
      classId &&
      sectionId &&
      selectedSubjectIds.length > 0 &&
      selectedStudentIds.length > 0 &&
      !assigning &&
      !loadingSections,
  );

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

  const assignSubjects = async () => {
    const nextErrors = validateForm();
    if (selectedStudentIds.length === 0) {
      nextErrors.student_ids = "Please select at least one student";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError(getBestValidationMessage("Validation failed", nextErrors));
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
        student_ids: selectedStudentIds,
      };

      await apiPost("/api/v1/students/subject-assignments/assign-bulk/", payload);

      setSuccess("Subjects assigned successfully");
      setSelectedStudentIds([]);
      setFieldErrors({});
      await loadAssignments();
    } catch (err) {
      const parsed = parseError(err);
      setFieldErrors(parsed.fieldErrors);
      setError(getBestValidationMessage(parsed.message || "Failed to assign subjects", parsed.fieldErrors));
    } finally {
      setAssigning(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalStudents / pageSize));
  const displayFrom = totalStudents === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const displayTo = Math.min(currentPage * pageSize, totalStudents);

  return (
    <div className="legacy-panel">
      <TopToast
        message={error || success}
        tone={error ? "error" : "success"}
        onClose={() => {
          setError("");
          setSuccess("");
        }}
      />
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Multi Subject Assignment</h1>
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
                <span>Multi Subject Assignment</span>
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
                <select
                  value={academicYearId}
                  onChange={(event) => {
                    setAcademicYearId(event.target.value);
                    setSelectedStudentIds([]);
                    setAssignmentMap({});
                    setCurrentPage(1);
                  }}
                  style={fieldStyle()}
                >
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
                <select
                  value={classId}
                  onChange={(event) => {
                    setClassId(event.target.value);
                    setSectionId("");
                    setSelectedStudentIds([]);
                    setAssignmentMap({});
                    setCurrentPage(1);
                  }}
                  style={fieldStyle()}
                >
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
                <select
                  value={sectionId}
                  onChange={(event) => {
                    setSectionId(event.target.value);
                    setSelectedStudentIds([]);
                    setAssignmentMap({});
                    setCurrentPage(1);
                  }}
                  style={fieldStyle()}
                  disabled={!classId || loadingSections}
                >
                  <option value="">{loadingSections ? "Loading sections..." : classId ? "Select Section" : "Select class first"}</option>
                  {sectionsForClass.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {loadingSections ? (
                  <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Spinner size={12} color="var(--primary)" /> Loading sections...
                  </p>
                ) : null}
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

            <div style={{ marginTop: 12 }} ref={subjectDropdownRef}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Subjects * (Multi Select)</label>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setSubjectDropdownOpen((prev) => !prev)}
                  style={{
                    ...fieldStyle(),
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subjectSummary}</span>
                  <span style={{ marginLeft: 10, color: "#64748b" }}>▾</span>
                </button>

                {subjectDropdownOpen ? (
                  <div
                    style={{
                      position: "absolute",
                      zIndex: 20,
                      top: "calc(100% + 6px)",
                      left: 0,
                      right: 0,
                      background: "#fff",
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ maxHeight: 220, overflowY: "auto", padding: 8 }}>
                      {subjects.map((item) => {
                        const checked = selectedSubjectIds.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 12px",
                              borderRadius: 10,
                              cursor: "pointer",
                              background: checked ? "#eff6ff" : "transparent",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedSubjectIds((prev) =>
                                  prev.includes(item.id) ? prev.filter((subjectId) => subjectId !== item.id) : [...prev, item.id],
                                );
                              }}
                            />
                            <span style={{ fontSize: 14, color: "#334155" }}>{item.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: 10, borderTop: "1px solid var(--line)", background: "#f8fafc" }}>
                      <button type="button" style={buttonStyle("#64748b")} disabled={selectedSubjectIds.length === 0} onClick={() => setSelectedSubjectIds([])}>
                        Clear
                      </button>
                      <button type="button" style={buttonStyle()} onClick={() => setSubjectDropdownOpen(false)}>
                        Done
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {selectedSubjects.slice(0, 3).map((item) => (
                  <span key={item.id} style={chipStyle()}>
                    {item.name}
                  </span>
                ))}
                {selectedSubjects.length > 3 ? (
                  <span style={{ ...chipStyle(), background: "#f8fafc", color: "#475569", borderColor: "#cbd5e1" }}>
                    +{selectedSubjects.length - 3} more
                  </span>
                ) : null}
              </div>
              {fieldErrors.subject_ids && <p style={{ margin: "6px 0 0", color: "var(--warning)", fontSize: 12 }}>{fieldErrors.subject_ids}</p>}
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" style={buttonStyle()} disabled={!isAssignEnabled} onClick={() => void assignSubjects()}>
                {assigning ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Spinner size={14} />
                    Assigning...
                  </span>
                ) : (
                  "Assign Subjects to Selected Students"
                )}
              </button>
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                {selectedStudentIds.length} selected
              </span>
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
                    <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "8px 6px" }}>Current Subjects</th>
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
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(assignmentMap[student.id] || []).length > 0 ? (
                              <>
                                {(assignmentMap[student.id] || []).slice(0, 3).map((subjectName) => (
                                  <span key={subjectName} style={chipStyle()}>{subjectName}</span>
                                ))}
                                {(assignmentMap[student.id] || []).length > 3 ? (
                                  <span style={{ ...chipStyle(), background: "#f8fafc", color: "#475569", borderColor: "#cbd5e1" }}>
                                    +{(assignmentMap[student.id] || []).length - 3} more
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Not assigned</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Showing {displayFrom}-{displayTo} of {totalStudents} students | Page {currentPage} of {totalPages}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
                  Page size
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setCurrentPage(1);
                      setSelectedStudentIds([]);
                    }}
                    style={{ ...fieldStyle(), width: 88 }}
                  >
                    {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </label>
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
          {loadingSections && <p style={{ margin: 0, color: "var(--text-muted)" }}><Spinner size={14} color="var(--primary)" /> Loading sections for selected class...</p>}
          {loadingAssignments && <p style={{ margin: 0, color: "var(--text-muted)" }}><Spinner size={14} color="var(--primary)" /> Loading current subject assignments...</p>}
        </div>
      </section>
    </div>
  );
}
