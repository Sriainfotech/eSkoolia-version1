"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { buildPaginationQuery, extractListData, extractPaginationMeta, type ListApiResponse } from "@/lib/pagination";
import { PaginationControls } from "@/components/common/PaginationControls";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { usePersistentPagination } from "@/hooks/usePersistentPagination";

type StudentRow = {
  id: number;
  admission_no: string;
  roll_no?: string;
  first_name: string;
  last_name?: string;
  date_of_birth?: string | null;
  gender?: "male" | "female" | "other";
  category?: number | null;
  guardian?: number | null;
  current_class?: number | null;
  current_section?: number | null;
  is_disabled: boolean;
  is_active: boolean;
};

type SchoolClass = { id: number; name: string };
type Section = { id: number; school_class: number; name: string };
type Guardian = { id: number; full_name: string; phone?: string };
type StudentCategory = { id: number; name: string };
type ApiError = Error & { status?: number; details?: { message?: string; detail?: string } };

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

async function apiPatch<T>(path: string, payload: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function apiDelete(path: string): Promise<void> {
  await apiRequestWithRefresh<void>(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
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

function fullName(student: StudentRow) {
  return `${student.first_name || ""} ${student.last_name || ""}`.trim() || "-";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

export function StudentDisabledPanel() {
  const { page, pageSize, setPage, setPageSize } = usePersistentPagination("students.disabled", 1, 10);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [categories, setCategories] = useState<StudentCategory[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [admissionQuery, setAdmissionQuery] = useState("");
  const [debouncedNameQuery, setDebouncedNameQuery] = useState("");
  const [debouncedAdmissionQuery, setDebouncedAdmissionQuery] = useState("");
  const [filterError, setFilterError] = useState("");

  const [busyId, setBusyId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<StudentRow | null>(null);
  const [enableCandidate, setEnableCandidate] = useState<StudentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null);

  const classMap = useMemo(() => new Map(classes.map((item) => [item.id, item.name])), [classes]);
  const sectionMap = useMemo(() => new Map(sections.map((item) => [item.id, item.name])), [sections]);
  const guardianMap = useMemo(() => new Map(guardians.map((item) => [item.id, item])), [guardians]);
  const categoryMap = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);

  const filteredSections = useMemo(() => {
    if (!classId) {
      return [];
    }
    return sections.filter((item) => String(item.school_class) === classId);
  }, [sections, classId]);

  const mapApiErrorMessage = (err: unknown, fallback: string) => {
    const apiErr = err as ApiError;
    const message = apiErr?.message || apiErr?.details?.message || apiErr?.details?.detail;

    if (!apiErr?.status || String(message).toLowerCase().includes("failed to fetch")) {
      return "Check your internet connection";
    }
    if (apiErr.status >= 500) {
      return "Unable to fetch data. Try again later";
    }
    return message || fallback;
  };

  const loadStudents = async (targetPage = page, targetPageSize = pageSize) => {
    if (sectionId && !classId) {
      setFilterError("Please select class first");
      setSectionId("");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const query = buildPaginationQuery(targetPage, targetPageSize, {
        is_disabled: "true",
        current_class: classId || undefined,
        current_section: sectionId || undefined,
        first_name: debouncedNameQuery.trim() || undefined,
        admission_no: debouncedAdmissionQuery.trim() || undefined,
      });
      const studentData = await apiGet<ListApiResponse<StudentRow>>(`/api/v1/students/students/?${query}`);
      const items = extractListData(studentData);
      const meta = extractPaginationMeta(studentData);
      const safeCount = meta?.count ?? items.length;

      if (targetPage > 1 && items.length === 0 && safeCount > 0) {
        setPage(targetPage - 1);
        return;
      }

      setStudents(items);
      setTotalCount(safeCount);
    } catch (err) {
      const apiErr = err as ApiError;
      const message = mapApiErrorMessage(apiErr, "Unable to load disabled students.");
      if (apiErr?.status === 404 && targetPage !== 1) {
        setPage(1);
        setError("Invalid page. Reset to page 1.");
      } else {
        setError(message);
      }
      setStudents([]);
      setTotalCount(0);
    }
    finally {
      setLoading(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [classData, sectionData, guardianData, categoryData] = await Promise.all([
        apiGet<ListApiResponse<SchoolClass>>("/api/v1/core/classes/"),
        apiGet<ListApiResponse<Section>>("/api/v1/core/sections/"),
        apiGet<ListApiResponse<Guardian>>("/api/v1/students/guardians/"),
        apiGet<ListApiResponse<StudentCategory>>("/api/v1/students/categories/"),
      ]);
      setClasses(extractListData(classData));
      setSections(extractListData(sectionData));
      setGuardians(extractListData(guardianData));
      setCategories(extractListData(categoryData));
    } catch {
      setError("Unable to load filter options.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const nameTimer = window.setTimeout(() => {
      setDebouncedNameQuery(nameQuery);
    }, 400);
    const admissionTimer = window.setTimeout(() => {
      setDebouncedAdmissionQuery(admissionQuery);
    }, 400);

    return () => {
      window.clearTimeout(nameTimer);
      window.clearTimeout(admissionTimer);
    };
  }, [nameQuery, admissionQuery]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadStudents();
    }, 350);
    return () => window.clearTimeout(handle);
  }, [page, pageSize, classId, sectionId, debouncedNameQuery, debouncedAdmissionQuery]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const enableStudent = async (id: number) => {
    try {
      setBusyId(id);
      setError("");
      setSuccess("");
      await apiPatch(`/api/v1/students/students/${id}/`, { is_disabled: false, is_active: true });
      await loadStudents(page, pageSize);
      setSuccess("Student enabled successfully.");
    } catch (err) {
      setError(mapApiErrorMessage(err, "Unable to enable student."));
    } finally {
      setBusyId(null);
      setEnableCandidate(null);
    }
  };

  const remove = async (id: number) => {
    try {
      setDeletingId(id);
      setError("");
      setSuccess("");
      await apiDelete(`/api/v1/students/students/${id}/`);
      setSuccess("Student deleted successfully.");
      const nextStudents = students.filter((row) => row.id !== id);
      if (nextStudents.length === 0 && page > 1) {
        setPage(page - 1);
      } else {
        await loadStudents(nextStudents.length === 0 && page > 1 ? page - 1 : page, pageSize);
      }
    } catch (err) {
      setError(mapApiErrorMessage(err, "Unable to delete student."));
    } finally {
      setDeletingId(null);
      setDeleteCandidate(null);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadStudents(page, pageSize);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Disabled Students</h1>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/students/list" style={{ ...buttonStyle("#0ea5e9"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                  Student List
                </Link>
                <button
                  type="button"
                  onClick={() => void handleRefresh()}
                  disabled={loading || refreshing}
                  style={{ ...buttonStyle(), opacity: loading || refreshing ? 0.7 : 1, cursor: loading || refreshing ? "not-allowed" : "pointer" }}
                >
                  {refreshing ? "Refreshing..." : "🔄 Refresh"}
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
                <span>Dashboard</span>
                <span>/</span>
                <span>Student Information</span>
                <span>/</span>
                <span>Disabled Students</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0" style={{ display: "grid", gap: 12 }}>
          <div className="white-box" style={boxStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Select Criteria</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 8 }}>
              <select 
                value={classId} 
                onChange={(event) => { 
                  setClassId(event.target.value); 
                  setSectionId(""); 
                  setFilterError("");
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
              <select 
                value={sectionId} 
                onChange={(event) => {
                  if (!classId && event.target.value) {
                    setFilterError("Please select class first");
                    setSectionId("");
                    return;
                  }
                  setFilterError("");
                  setSectionId(event.target.value);
                }} 
                onFocus={() => {
                  if (!classId) setFilterError("Please select class first");
                }}
                style={fieldStyle()}
              >
                <option value="">Select Section</option>
                {filteredSections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <div style={{ position: "relative" }}>
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 13,
                    color: "var(--text-muted)",
                  }}
                >
                  🔍
                </span>
                <input 
                  value={nameQuery} 
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (/^[A-Za-z\s]*$/.test(nextValue)) {
                      setNameQuery(nextValue);
                      setFilterError("");
                      return;
                    }
                    setFilterError("Name accepts only letters and spaces");
                  }} 
                  placeholder="Search by name" 
                  style={{ ...fieldStyle(), paddingLeft: 32 }} 
                />
              </div>
              <div style={{ position: "relative" }}>
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 13,
                    color: "var(--text-muted)",
                  }}
                >
                  🔍
                </span>
                <input 
                  value={admissionQuery} 
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (/^[A-Za-z0-9]*$/.test(nextValue)) {
                      setAdmissionQuery(nextValue);
                      setFilterError("");
                      return;
                    }
                    setFilterError("Admission No accepts only letters and numbers");
                  }} 
                  placeholder="Search by admission no" 
                  style={{ ...fieldStyle(), paddingLeft: 32 }} 
                />
              </div>
            </div>
            {filterError ? <p style={{ color: "#dc2626", margin: "8px 0 0" }}>{filterError}</p> : null}
          </div>

          <div className="white-box" style={boxStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Disabled Students</h3>
            {error && <p style={{ color: "var(--warning)", marginBottom: 10 }}>{error}</p>}
            {success && <p style={{ color: "#0f766e", marginBottom: 10 }}>{success}</p>}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Admission No</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Roll No</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Class</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Father/Guardian</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Date Of Birth</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Gender</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Type</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Phone</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} style={{ padding: 12, color: "var(--text-muted)", textAlign: "center" }}>
                        Loading disabled students...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: 24, textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No disabled students found</div>
                        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Try adjusting filters or search criteria</div>
                      </td>
                    </tr>
                  ) : (
                    students.map((row) => {
                      const className = classMap.get(row.current_class || 0) || "-";
                      const sectionName = sectionMap.get(row.current_section || 0);
                      const guardian = row.guardian ? guardianMap.get(row.guardian) : undefined;
                      const categoryName = row.category ? categoryMap.get(row.category) : undefined;

                      return (
                        <tr
                          key={row.id}
                          onMouseEnter={() => setHoveredRowId(row.id)}
                          onMouseLeave={() => setHoveredRowId(null)}
                          style={{ background: hoveredRowId === row.id ? "#f8fafc" : "transparent" }}
                        >
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.admission_no || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.roll_no || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{fullName(row)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            {className}{sectionName ? ` (${sectionName})` : ""}
                          </td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{guardian?.full_name || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{formatDate(row.date_of_birth)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)", textTransform: "capitalize" }}>{row.gender || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{categoryName || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{guardian?.phone || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                style={buttonStyle("#0284c7")}
                                onClick={() => setEnableCandidate(row)}
                              >
                                Enable
                              </button>
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                style={buttonStyle("#dc2626")}
                                onClick={() => setDeleteCandidate(row)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalCount}
              pageSize={pageSize}
              loading={loading}
              onPageChange={(nextPage) => setPage(nextPage)}
              onPageSizeChange={(nextSize) => {
                setPageSize(nextSize);
              }}
            />
          </div>
        </div>
      </section>

      <ConfirmationModal
        isOpen={enableCandidate !== null}
        title="Enable Student"
        message={`Are you sure you want to enable ${enableCandidate ? fullName(enableCandidate) : "this student"}?`}
        confirmLabel="Enable"
        cancelLabel="Cancel"
        isConfirming={busyId !== null}
        onConfirm={() => (enableCandidate ? void enableStudent(enableCandidate.id) : undefined)}
        onCancel={() => setEnableCandidate(null)}
      />

      <ConfirmationModal
        isOpen={deleteCandidate !== null}
        title="Delete Student"
        message={`Are you sure you want to delete ${deleteCandidate ? fullName(deleteCandidate) : "this student"}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isConfirming={deletingId !== null}
        onConfirm={() => deleteCandidate ? void remove(deleteCandidate.id) : undefined}
        onCancel={() => setDeleteCandidate(null)}
      />
    </div>
  );
}
