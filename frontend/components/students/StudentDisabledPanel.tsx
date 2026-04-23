"use client";

/* eslint-disable */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { buildPaginationQuery, extractListData, extractPaginationMeta, type ListApiResponse } from "@/lib/pagination";
import { PaginationControls } from "@/components/common/PaginationControls";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { usePersistentPagination } from "@/hooks/usePersistentPagination";
import { studentThemeClassName } from "./studentTheme";

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
type MePayload = { id: number; is_superuser: boolean; is_school_admin?: boolean };
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
  return `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Data Not Available";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Data Not Available";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Data Not Available";
  }
  return date.toLocaleDateString();
}

function displayValue(value?: string | null) {
  const text = String(value || "").trim();
  return text || "Data Not Available";
}

const ADMISSION_PATTERN = /^ADM\d{4}$/i;

export function StudentDisabledPanel() {
  const { page, pageSize, setPage, setPageSize } = usePersistentPagination("students.disabled", 1, 10);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionOptions, setSectionOptions] = useState<Section[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [categories, setCategories] = useState<StudentCategory[]>([]);
  const [currentUser, setCurrentUser] = useState<MePayload | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [admissionQuery, setAdmissionQuery] = useState("");
  const [debouncedNameQuery, setDebouncedNameQuery] = useState("");
  const [debouncedAdmissionQuery, setDebouncedAdmissionQuery] = useState("");
  const [filterError, setFilterError] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [busyId, setBusyId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<StudentRow | null>(null);
  const [enableCandidate, setEnableCandidate] = useState<StudentRow | null>(null);
  const [bulkEnableConfirmOpen, setBulkEnableConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingSections, setLoadingSections] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null);
  const [hydratedFromUrl, setHydratedFromUrl] = useState(false);

  const validClasses = useMemo(
    () => classes.filter((item) => Number.isInteger(item.id) && item.id > 0),
    [classes],
  );
  const classMap = useMemo(() => new Map(validClasses.map((item) => [item.id, item.name])), [validClasses]);
  const sectionMap = useMemo(() => new Map(sections.map((item) => [item.id, item.name])), [sections]);
  const guardianMap = useMemo(() => new Map(guardians.map((item) => [item.id, item])), [guardians]);
  const categoryMap = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const canViewPhone = !!(currentUser?.is_superuser || currentUser?.is_school_admin);

  const allVisibleSelected = useMemo(
    () => students.length > 0 && students.every((row) => selectedIds.includes(row.id)),
    [students, selectedIds],
  );

  const selectedStudentsCount = selectedIds.length;

  const isClassIdValid = !classId || /^\d+$/.test(classId);
  const isSectionIdValid = !sectionId || /^\d+$/.test(sectionId);
  const isAdmissionQueryValid = !admissionQuery.trim() || ADMISSION_PATTERN.test(admissionQuery.trim());

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

  const syncUrl = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (nameQuery.trim()) params.set("name", nameQuery.trim()); else params.delete("name");
    if (admissionQuery.trim()) params.set("admission", admissionQuery.trim()); else params.delete("admission");
    if (classId) params.set("class", classId); else params.delete("class");
    if (sectionId) params.set("section", sectionId); else params.delete("section");
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const loadStudents = async (targetPage = page, targetPageSize = pageSize) => {
    if (sectionId && !classId) {
      setFilterError("Please select class first");
      setSectionId("");
      return;
    }

    if (!isClassIdValid || !isSectionIdValid) {
      setFilterError("Please select valid class and section");
      return;
    }

    if (!isAdmissionQueryValid) {
      setFilterError("Admission Number must follow ADM#### format");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setFilterError("");
      const query = buildPaginationQuery(targetPage, targetPageSize, {
        is_disabled: "true",
        current_class: classId || undefined,
        current_section: sectionId || undefined,
        first_name: debouncedNameQuery.trim() || undefined,
        admission_no: isAdmissionQueryValid ? (debouncedAdmissionQuery.trim() || undefined) : undefined,
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
      setSelectedIds((prev) => prev.filter((id) => items.some((row) => row.id === id)));
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
      const [classData, sectionData, guardianData, categoryData, meData] = await Promise.all([
        apiGet<ListApiResponse<SchoolClass>>("/api/v1/core/classes/"),
        apiGet<ListApiResponse<Section>>("/api/v1/core/sections/"),
        apiGet<ListApiResponse<Guardian>>("/api/v1/students/guardians/"),
        apiGet<ListApiResponse<StudentCategory>>("/api/v1/students/categories/"),
        apiGet<MePayload>("/api/v1/auth/me/"),
      ]);
      setClasses(extractListData(classData));
      setSections(extractListData(sectionData));
      setGuardians(extractListData(guardianData));
      setCategories(extractListData(categoryData));
      setCurrentUser(meData);
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
    if (hydratedFromUrl) {
      return;
    }
    const pageParam = searchParams.get("page");
    const sizeParam = searchParams.get("page_size");
    const classParam = searchParams.get("class");
    const sectionParam = searchParams.get("section");
    const nameParam = searchParams.get("name");
    const admissionParam = searchParams.get("admission");

    if (pageParam && /^\d+$/.test(pageParam)) setPage(Number(pageParam));
    if (sizeParam && /^\d+$/.test(sizeParam)) setPageSize(Number(sizeParam));
    if (classParam && /^\d+$/.test(classParam)) setClassId(classParam);
    if (sectionParam && /^\d+$/.test(sectionParam)) setSectionId(sectionParam);
    if (nameParam) setNameQuery(nameParam);
    if (admissionParam) setAdmissionQuery(admissionParam.toUpperCase());

    setHydratedFromUrl(true);
  }, [hydratedFromUrl, searchParams, setPage, setPageSize]);

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
    if (!hydratedFromUrl) {
      return;
    }
    const handle = window.setTimeout(() => {
      void loadStudents();
    }, 350);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydratedFromUrl, page, pageSize, classId, sectionId, debouncedNameQuery, debouncedAdmissionQuery]);

  useEffect(() => {
    if (!hydratedFromUrl) {
      return;
    }
    syncUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydratedFromUrl, nameQuery, admissionQuery, classId, sectionId, page, pageSize]);

  useEffect(() => {
    if (!classId || !/^\d+$/.test(classId)) {
      setSectionId("");
      setSectionOptions([]);
      return;
    }

    const timer = window.setTimeout(() => {
      const fetchSections = async () => {
        try {
          setLoadingSections(true);
          const payload = await apiGet<ListApiResponse<Section>>(`/api/v1/core/sections/?school_class=${classId}`);
          setSectionOptions(extractListData(payload));
        } catch {
          setSectionOptions(sections.filter((item) => String(item.school_class) === classId));
        } finally {
          setLoadingSections(false);
        }
      };
      void fetchSections();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [classId, sections]);

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

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !students.some((row) => row.id === id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...students.map((row) => row.id)])));
  };

  const toggleRowSelection = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const bulkEnableStudents = async () => {
    if (selectedIds.length === 0) {
      setBulkEnableConfirmOpen(false);
      return;
    }
    try {
      setBulkBusy(true);
      setError("");
      setSuccess("");

      const results = await Promise.allSettled(
        selectedIds.map((id) => apiPatch(`/api/v1/students/students/${id}/`, { is_disabled: false, is_active: true })),
      );
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - successCount;

      await loadStudents(page, pageSize);
      setSelectedIds([]);

      if (failedCount > 0) {
        setError(`${failedCount} student(s) could not be enabled.`);
      }
      if (successCount > 0) {
        setSuccess(`${successCount} student(s) enabled successfully.`);
      }
    } catch (err) {
      setError(mapApiErrorMessage(err, "Unable to bulk enable students."));
    } finally {
      setBulkBusy(false);
      setBulkEnableConfirmOpen(false);
    }
  };

  return (
    <div className={`${studentThemeClassName} legacy-panel student-disabled-panel`}>
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div className="student-page-header student-page-header-actions">
            <h1 className="student-page-title">Disabled Students</h1>
            <div className="student-page-side">
              <div className="student-page-links-row">
                <Link href="/students/list" style={{ ...buttonStyle("#0ea5e9"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                  Student List
                </Link>
                <button
                  type="button"
                  onClick={() => void handleRefresh()}
                  disabled={loading || refreshing}
                  aria-label="Refresh List"
                  style={{ ...buttonStyle(), opacity: loading || refreshing ? 0.7 : 1, cursor: loading || refreshing ? "not-allowed" : "pointer" }}
                >
                  {refreshing ? "Refreshing..." : "🔄 Refresh"}
                </button>
              </div>
              <div className="student-page-crumbs">
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
                  setPage(1);
                }} 
                aria-label="Filter by class"
                style={fieldStyle()}
              >
                <option value="">Select Class</option>
                {validClasses.map((item) => (
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
                  setPage(1);
                }} 
                onFocus={() => {
                  if (!classId) setFilterError("Please select class first");
                }}
                disabled={!classId || loadingSections}
                aria-label="Filter by section"
                style={fieldStyle()}
              >
                <option value="">{loadingSections ? "Loading sections..." : classId ? "Select Section" : "Select Class First"}</option>
                {sectionOptions.map((item) => (
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
                      setPage(1);
                      return;
                    }
                    setFilterError("Name accepts only letters and spaces");
                  }} 
                  aria-label="Search by student name"
                  placeholder="Search by name" 
                  style={{ ...fieldStyle(), paddingLeft: 32, paddingRight: 34 }} 
                />
                {nameQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNameQuery("");
                      setFilterError("");
                      setPage(1);
                    }}
                    aria-label="Clear name search"
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      color: "#64748b",
                      cursor: "pointer",
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                ) : null}
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
                    const nextValue = event.target.value.toUpperCase();
                    if (/^[A-Za-z0-9]*$/.test(nextValue) && nextValue.length <= 7) {
                      setAdmissionQuery(nextValue);
                      if (!nextValue || ADMISSION_PATTERN.test(nextValue)) {
                        setFilterError("");
                      } else {
                        setFilterError("Admission Number must follow ADM#### format");
                      }
                      setPage(1);
                      return;
                    }
                    if (!nextValue) {
                      setAdmissionQuery("");
                      setFilterError("");
                      return;
                    }
                    setFilterError("Use format like ADM1234");
                  }} 
                  aria-label="Search by admission number"
                  placeholder="Search by admission no" 
                  style={{ ...fieldStyle(), paddingLeft: 32, paddingRight: 34 }} 
                />
                {admissionQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAdmissionQuery("");
                      setFilterError("");
                      setPage(1);
                    }}
                    aria-label="Clear admission number search"
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      color: "#64748b",
                      cursor: "pointer",
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
            {filterError ? <p style={{ color: "#dc2626", margin: "8px 0 0" }}>{filterError}</p> : null}
          </div>

          <div className="white-box" style={boxStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Disabled Students</h3>
              <button
                type="button"
                style={{ ...buttonStyle("#0284c7"), opacity: selectedStudentsCount === 0 || bulkBusy ? 0.7 : 1, minWidth: 130 }}
                disabled={selectedStudentsCount === 0 || bulkBusy}
                onClick={() => setBulkEnableConfirmOpen(true)}
                aria-label="Bulk enable selected students"
                title="Enable selected students"
              >
                {bulkBusy ? "Enabling..." : `Bulk Enable (${selectedStudentsCount})`}
              </button>
            </div>
            {error && <p style={{ color: "var(--warning)", marginBottom: 10 }}>{error}</p>}
            {success && <p style={{ color: "#0f766e", marginBottom: 10 }}>{success}</p>}
            <div style={{ overflowX: "auto" }}>
              <table aria-label="Disabled students table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", width: 48 }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        aria-label="Select all students on current page"
                      />
                    </th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Admission No</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Roll No</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Class</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Father/Guardian</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Date Of Birth</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Gender</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Type</th>
                    {canViewPhone ? <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Phone</th> : null}
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", position: "sticky", right: 0, background: "var(--surface)", zIndex: 2 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={canViewPhone ? 11 : 10} style={{ padding: 12, color: "var(--text-muted)", textAlign: "center" }}>
                        Loading disabled students...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={canViewPhone ? 11 : 10} style={{ padding: 24, textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No Disabled Students Found</div>
                        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Try adjusting filters or search criteria</div>
                      </td>
                    </tr>
                  ) : (
                    students.map((row) => {
                      const className = classMap.get(row.current_class || 0) || "Data Not Available";
                      const sectionName = sectionMap.get(row.current_section || 0);
                      const guardian = row.guardian ? guardianMap.get(row.guardian) : undefined;
                      const categoryName = row.category ? categoryMap.get(row.category) : undefined;

                      return (
                        <tr
                          key={row.id}
                          onMouseEnter={() => setHoveredRowId(row.id)}
                          onMouseLeave={() => setHoveredRowId(null)}
                          tabIndex={0}
                          style={{ background: hoveredRowId === row.id ? "#f8fafc" : "transparent" }}
                        >
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(row.id)}
                              onChange={() => toggleRowSelection(row.id)}
                              aria-label={`Select ${fullName(row)}`}
                            />
                          </td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(row.admission_no)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(row.roll_no)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{fullName(row)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            {className}{sectionName ? ` (${sectionName})` : ""}
                          </td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(guardian?.full_name)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{formatDate(row.date_of_birth)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)", textTransform: "capitalize" }}>{displayValue(row.gender)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(categoryName)}</td>
                          {canViewPhone ? <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(guardian?.phone)}</td> : null}
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)", position: "sticky", right: 0, background: "var(--surface)" }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                disabled={busyId === row.id || bulkBusy}
                                style={{ ...buttonStyle("#0284c7"), minWidth: 90 }}
                                onClick={() => setEnableCandidate(row)}
                                aria-label={`Enable ${fullName(row)}`}
                                title="Enable student"
                              >
                                Enable
                              </button>
                              <button
                                type="button"
                                disabled={busyId === row.id || bulkBusy}
                                style={{ ...buttonStyle("#dc2626"), minWidth: 90 }}
                                onClick={() => setDeleteCandidate(row)}
                                aria-label={`Delete ${fullName(row)}`}
                                title="Delete student"
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
        message={`Are you sure you want to permanently delete ${deleteCandidate ? fullName(deleteCandidate) : "this student"}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isConfirming={deletingId !== null}
        onConfirm={() => deleteCandidate ? void remove(deleteCandidate.id) : undefined}
        onCancel={() => setDeleteCandidate(null)}
      />

      <ConfirmationModal
        isOpen={bulkEnableConfirmOpen}
        title="Bulk Enable Students"
        message={`Enable ${selectedStudentsCount} selected student(s)?`}
        confirmLabel="Enable"
        cancelLabel="Cancel"
        isConfirming={bulkBusy}
        onConfirm={() => void bulkEnableStudents()}
        onCancel={() => setBulkEnableConfirmOpen(false)}
      />

      <style jsx>{`
        :global(.legacy-panel input:focus),
        :global(.legacy-panel select:focus),
        :global(.legacy-panel button:focus),
        :global(.legacy-panel a:focus),
        :global(.legacy-panel tr:focus) {
          outline: 2px solid #000;
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}
