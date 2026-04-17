"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/common/Spinner";
import { TopToast } from "@/components/common/TopToast";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import styles from "./StudentMultiClassPanel.module.css";

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
          <div className={styles.headerRow}>
            <h1 className={styles.headerTitle}>Multi Subject Assignment</h1>
            <div className={styles.headerMetaWrap}>
              <div className={styles.actionRow}>
                <Link href="/students/add" className={`${styles.btn} ${styles.btnGreen} ${styles.linkBtn}`}>
                  Add Student
                </Link>
                <Link href="/students/list" className={`${styles.btn} ${styles.btnSky} ${styles.linkBtn}`}>
                  Student List
                </Link>
              </div>
              <div className={styles.crumbRow}>
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
        <div className={`container-fluid p-0 ${styles.pageGrid}`}>
          <div className={`white-box ${styles.box}`}>
            <h3 className={styles.sectionTitle}>Select Criteria</h3>
            <div className={styles.criteriaGrid}>
              <div>
                <label className={styles.fieldLabel}>Academic Year *</label>
                <select
                  title="Academic Year"
                  value={academicYearId}
                  onChange={(event) => {
                    setAcademicYearId(event.target.value);
                    setSelectedStudentIds([]);
                    setAssignmentMap({});
                    setCurrentPage(1);
                  }}
                  className={styles.field}
                >
                  <option value="">Select Year</option>
                  {academicYears.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.academic_year && <p className={styles.fieldError}>{fieldErrors.academic_year}</p>}
              </div>

              <div>
                <label className={styles.fieldLabel}>Class *</label>
                <select
                  title="Class"
                  value={classId}
                  onChange={(event) => {
                    setClassId(event.target.value);
                    setSectionId("");
                    setSelectedStudentIds([]);
                    setAssignmentMap({});
                    setCurrentPage(1);
                  }}
                  className={styles.field}
                >
                  <option value="">Select Class</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.class && <p className={styles.fieldError}>{fieldErrors.class}</p>}
              </div>

              <div>
                <label className={styles.fieldLabel}>Section *</label>
                <select
                  title="Section"
                  value={sectionId}
                  onChange={(event) => {
                    setSectionId(event.target.value);
                    setSelectedStudentIds([]);
                    setAssignmentMap({});
                    setCurrentPage(1);
                  }}
                  className={styles.field}
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
                  <p className={`${styles.mutedNote} ${styles.inlineLoading}`}>
                    <Spinner size={12} color="var(--primary)" /> Loading sections...
                  </p>
                ) : null}
                {fieldErrors.section && <p className={styles.fieldError}>{fieldErrors.section}</p>}
              </div>

              <div>
                <label className={styles.fieldLabel}>Search Student</label>
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Name / Admission / Roll"
                  className={styles.field}
                />
              </div>

              <div>
                <label className={styles.fieldLabel}>Optional Subject</label>
                <label className={styles.optionalLabel}>
                  <input type="checkbox" checked={isOptional} onChange={(event) => setIsOptional(event.target.checked)} />
                  Mark as optional
                </label>
              </div>
            </div>

            <div className={styles.subjectWrap} ref={subjectDropdownRef}>
              <label className={styles.fieldLabel}>Subjects * (Multi Select)</label>
              <div className={styles.relative}>
                <button
                  type="button"
                  onClick={() => setSubjectDropdownOpen((prev) => !prev)}
                  className={`${styles.field} ${styles.fieldButton}`}
                >
                  <span className={styles.ellipsis}>{subjectSummary}</span>
                  <span className={styles.dropdownArrow}>▾</span>
                </button>

                {subjectDropdownOpen ? (
                  <div className={styles.dropdown}>
                    <div className={styles.dropdownList}>
                      {subjects.map((item) => {
                        const checked = selectedSubjectIds.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className={`${styles.subjectItem} ${checked ? styles.subjectItemChecked : ""}`}
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
                            <span className={styles.subjectName}>{item.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className={styles.dropdownFooter}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSlate}`}
                        disabled={selectedSubjectIds.length === 0}
                        onClick={() => setSelectedSubjectIds([])}
                      >
                        Clear
                      </button>
                      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setSubjectDropdownOpen(false)}>
                        Done
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className={styles.chipRow}>
                {selectedSubjects.slice(0, 3).map((item) => (
                  <span key={item.id} className={styles.chip}>
                    {item.name}
                  </span>
                ))}
                {selectedSubjects.length > 3 ? (
                  <span className={`${styles.chip} ${styles.chipMuted}`}>
                    +{selectedSubjects.length - 3} more
                  </span>
                ) : null}
              </div>
              {fieldErrors.subject_ids && <p className={styles.fieldError}>{fieldErrors.subject_ids}</p>}
            </div>

            <div className={styles.assignRow}>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!isAssignEnabled} onClick={() => void assignSubjects()}>
                {assigning ? (
                  <span className={styles.inlineSpinner}>
                    <Spinner size={14} />
                    Assigning...
                  </span>
                ) : (
                  "Assign Subjects to Selected Students"
                )}
              </button>
              <span className={styles.smallMuted}>
                {selectedStudentIds.length} selected
              </span>
            </div>
          </div>

          <div className={`white-box ${styles.box}`}>
            <h3 className={styles.sectionTitle}>Student List</h3>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>
                      <input
                        type="checkbox"
                        title="Select all visible students"
                        checked={students.length > 0 && students.every((item) => selectedStudentIds.includes(item.id))}
                        onChange={toggleAllVisibleStudents}
                      />
                    </th>
                    <th className={styles.th}>Admission No</th>
                    <th className={styles.th}>Roll No</th>
                    <th className={styles.th}>Student Name</th>
                    <th className={styles.th}>Current Subjects</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingStudents ? (
                    <tr>
                      <td colSpan={5} className={styles.tableState}>
                        Loading students...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.tableState}>
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr key={student.id}>
                        <td className={styles.td}>
                          <input
                            type="checkbox"
                            title={`Select ${studentLabel(student)}`}
                            checked={selectedStudentIds.includes(student.id)}
                            onChange={() => toggleStudentSelection(student.id)}
                          />
                        </td>
                        <td className={styles.td}>{student.admission_no || "-"}</td>
                        <td className={styles.td}>{student.roll_no || "-"}</td>
                        <td className={styles.td}>{studentLabel(student)}</td>
                        <td className={styles.td}>
                          <div className={styles.chipRow}>
                            {(assignmentMap[student.id] || []).length > 0 ? (
                              <>
                                {(assignmentMap[student.id] || []).slice(0, 3).map((subjectName) => (
                                  <span key={subjectName} className={styles.chip}>{subjectName}</span>
                                ))}
                                {(assignmentMap[student.id] || []).length > 3 ? (
                                  <span className={`${styles.chip} ${styles.chipMuted}`}>
                                    +{(assignmentMap[student.id] || []).length - 3} more
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span className={styles.mutedNote}>Not assigned</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.paginationRow}>
              <div className={styles.smallMuted}>
                Showing {displayFrom}-{displayTo} of {totalStudents} students | Page {currentPage} of {totalPages}
              </div>
              <div className={styles.paginationActions}>
                <label className={styles.pageSizeLabel}>
                  Page size
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setCurrentPage(1);
                      setSelectedStudentIds([]);
                    }}
                    className={`${styles.field} ${styles.pageSizeSelect}`}
                  >
                    {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSlate}`}
                  disabled={currentPage <= 1 || loadingStudents}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSlate}`}
                  disabled={currentPage >= totalPages || loadingStudents}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {loadingMeta && <p className={styles.loadingLine}>Loading data...</p>}
          {loadingSections && <p className={styles.loadingLineWithSpinner}><Spinner size={14} color="var(--primary)" /> Loading sections for selected class...</p>}
          {loadingAssignments && <p className={styles.loadingLineWithSpinner}><Spinner size={14} color="var(--primary)" /> Loading current subject assignments...</p>}
        </div>
      </section>
    </div>
  );
}
