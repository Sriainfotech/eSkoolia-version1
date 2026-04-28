"use client";

import Link from "next/link";
import { Manrope, Playfair_Display } from "next/font/google";
import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/common/Spinner";
import { PaginationControls } from "@/components/common/PaginationControls";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { buildPaginationQuery, extractListData, extractPaginationMeta, type ListApiResponse } from "@/lib/pagination";
import { usePersistentPagination } from "@/hooks/usePersistentPagination";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-playfair-display",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
});

type StudentRow = {
  id: number;
  admission_no: string;
  roll_no?: string;
  first_name: string;
  last_name?: string;
  date_of_birth?: string | null;
  phone?: string;
  gender?: "male" | "female" | "other";
  current_class?: number | null;
  current_section?: number | null;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_details?: {
    full_name?: string;
    phone?: string;
  } | null;
  status?: string;
  is_deleted?: boolean;
  is_active: boolean;
  is_disabled: boolean;
};

type StudentDetail = StudentRow & {
  email?: string;
  address_line?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  academic_year_name?: string;
  admission_type?: string;
  guardian_relation?: string;
};

type StudentSummaryResponse = {
  success?: boolean;
  message?: string;
  data?: {
    total_count?: number;
    active_count?: number;
    inactive_count?: number;
    archived_count?: number;
    new_count?: number;
    docs_pending_count?: number;
  };
};

type SchoolClass = { id: number; name?: string; class_name?: string };
type Section = { id: number; school_class: number; name?: string; section_name?: string };
type StatusFilter = "all" | "active" | "inactive" | "archived";

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

async function apiPost<T>(path: string, payload?: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") {
    return fallback;
  }
  const details = (error as { details?: { message?: string } }).details;
  if (details?.message) {
    return details.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function fullName(row: StudentRow) {
  return `${row.first_name || ""} ${row.last_name || ""}`.trim() || "-";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function normalizeLabel(label: string, fallback: number) {
  const text = String(label || "").trim();
  return text || String(fallback);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-IN").format(Math.max(0, value));
}

function formatAgeFromDob(value?: string | null) {
  if (!value) return "-";
  const dob = new Date(value);
  if (Number.isNaN(dob.getTime())) return "-";
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return `${Math.max(0, age)} yrs`;
}

function resolveGuardianName(row: StudentRow) {
  return row.guardian_name || row.guardian_details?.full_name || "Not linked";
}

function resolveGuardianPhone(row: StudentRow) {
  return row.guardian_phone || row.guardian_details?.phone || "-";
}

export function StudentListPanel() {
  const { page, pageSize, setPage, setPageSize } = usePersistentPagination("students.list", 1, 25);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [totalEnrolledCount, setTotalEnrolledCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [docsPendingCount, setDocsPendingCount] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewStudentId, setViewStudentId] = useState<number | null>(null);
  const [viewStudent, setViewStudent] = useState<StudentDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");
  const [viewTogglingStatus, setViewTogglingStatus] = useState(false);

  // Confirmation modal — gates destructive actions (Activate / Deactivate)
  // behind a clear "are you sure?" prompt.
  type PendingConfirm = {
    title: string;
    message: string;
    details?: string;
    confirmLabel: string;
    variant: "danger" | "primary";
    execute: () => Promise<void>;
  };
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [confirming, setConfirming] = useState(false);

  const runPendingConfirm = async () => {
    if (!pendingConfirm) return;
    try {
      setConfirming(true);
      await pendingConfirm.execute();
    } finally {
      setConfirming(false);
      setPendingConfirm(null);
    }
  };

  const filteredSections = useMemo(
    () => sections.filter((item) => !classFilter || String(item.school_class) === classFilter),
    [sections, classFilter],
  );

  const classMap = useMemo(
    () => new Map(classes.map((item) => [item.id, normalizeLabel(String(item.name || item.class_name || ""), item.id)])),
    [classes],
  );
  const sectionMap = useMemo(
    () => new Map(sections.map((item) => [item.id, normalizeLabel(String(item.name || item.section_name || ""), item.id)])),
    [sections],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const flash = window.sessionStorage.getItem("students:list:flash");
    if (flash) {
      setSuccess(flash);
      window.sessionStorage.removeItem("students:list:flash");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (sectionFilter && !filteredSections.some((item) => String(item.id) === sectionFilter)) {
      setSectionFilter("");
    }
  }, [filteredSections, sectionFilter]);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        setLoadingMeta(true);
        const [classResult, sectionResult] = await Promise.allSettled([
          apiGet<ListApiResponse<SchoolClass>>("/api/v1/core/classes/?page_size=200"),
          apiGet<ListApiResponse<Section>>("/api/v1/core/sections/?page_size=500"),
        ]);
        setClasses(classResult.status === "fulfilled" ? extractListData(classResult.value) : []);
        setSections(sectionResult.status === "fulfilled" ? extractListData(sectionResult.value) : []);
      } catch {
        setError("Unable to load lookup data.");
      } finally {
        setLoadingMeta(false);
      }
    };

    void loadMeta();
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoadingStats(true);
        const summaryQuery = buildPaginationQuery(1, 1, {
          search: debouncedSearch || undefined,
          is_active: statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined,
          include_deleted: statusFilter === "archived" ? "true" : undefined,
          deleted_only: statusFilter === "archived" ? "true" : undefined,
          current_class: classFilter || undefined,
          current_section: sectionFilter || undefined,
        });
        const payload = await apiGet<StudentSummaryResponse>(`/api/v1/students/students/summary/?${summaryQuery}`);
        const summary = payload.data || {};
        setTotalEnrolledCount(summary.total_count ?? 0);
        setActiveCount(summary.active_count ?? 0);
        setInactiveCount(summary.inactive_count ?? 0);
        setArchivedCount(summary.archived_count ?? 0);
        setNewCount(summary.new_count ?? 0);
        setDocsPendingCount(summary.docs_pending_count ?? 0);
      } catch {
        setTotalEnrolledCount(totalCount);
        setActiveCount(students.filter((row) => row.is_active && !row.is_disabled).length);
        setInactiveCount(students.filter((row) => !row.is_active).length);
        setArchivedCount(students.filter((row) => row.is_deleted || row.status === "deleted").length);
        setNewCount(students.length);
        setDocsPendingCount(students.filter((row) => !row.phone || !row.date_of_birth || row.is_disabled).length);
      } finally {
        setLoadingStats(false);
      }
    };

    void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, classFilter, sectionFilter, refreshTick]);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        setLoading(true);
        setError("");
        const query = buildPaginationQuery(page, pageSize, {
          search: debouncedSearch || undefined,
          is_active: statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined,
          include_deleted: statusFilter === "archived" ? "true" : undefined,
          deleted_only: statusFilter === "archived" ? "true" : undefined,
          current_class: classFilter || undefined,
          current_section: sectionFilter || undefined,
        });
        const payload = await apiGet<ListApiResponse<StudentRow>>(`/api/v1/students/students/?${query}`);
        const items = extractListData(payload);
        const meta = extractPaginationMeta(payload);
        setStudents(items);
        setTotalCount(meta?.count ?? items.length);
        setSelectedIds([]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (message.includes("401")) {
          setError("Session expired. Please login again.");
        } else if (message.includes("500")) {
          setError("Server error while loading students.");
        } else {
          setError("Failed to load student records.");
        }
        setStudents([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    };

    void loadStudents();
  }, [debouncedSearch, page, pageSize, statusFilter, classFilter, sectionFilter, refreshTick]);

  const selectedRows = useMemo(() => students.filter((row) => selectedIds.includes(row.id)), [students, selectedIds]);

  const allVisibleSelected = students.length > 0 && students.every((row) => selectedIds.includes(row.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !students.some((row) => row.id === id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...students.map((row) => row.id)])));
  };

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]));
  };

  const openViewDrawer = (row: StudentRow) => {
    setViewStudentId(row.id);
    setViewStudent({
      ...row,
      guardian_relation: "Guardian",
      admission_type: row.is_active ? "New admission" : "Inactive profile",
    });
    setViewError("");
    setViewDrawerOpen(true);
  };

  const closeViewDrawer = () => {
    setViewDrawerOpen(false);
    setViewStudentId(null);
    setViewError("");
  };

  const toggleStudentStatus = async () => {
    if (!viewStudentId || !viewStudent || viewTogglingStatus) return;
    try {
      setViewTogglingStatus(true);
      setViewError("");
      const nextActive = !viewStudent.is_active;
      await apiPatch(`/api/v1/students/students/${viewStudentId}/`, {
        is_active: nextActive,
        is_disabled: false,
        status: nextActive ? "active" : "inactive",
      });
      setStudents((prev) =>
        prev.map((row) =>
          row.id === viewStudentId
            ? {
                ...row,
                is_active: nextActive,
                is_disabled: false,
              }
            : row,
        ),
      );
      setSuccess(nextActive ? "Student activated successfully." : "Student deactivated successfully.");
      setError("");
      // Close the profile drawer + clear selected student so the now-stale
      // profile isn't left sitting on the right. Also drops the stuck backdrop.
      setViewDrawerOpen(false);
      setViewStudentId(null);
      setViewStudent(null);
      setViewError("");
      // Trigger a re-fetch (updates Active/Inactive/All counts and filter tabs).
      refreshList();
    } catch {
      setViewError("Unable to change student status.");
    } finally {
      setViewTogglingStatus(false);
    }
  };

  const refreshList = () => {
    setRefreshTick((prev) => prev + 1);
  };

  const handleBulkActiveState = async (nextActive: boolean) => {
    if (selectedIds.length === 0 || bulkBusy) return;

    const selectedOnPage = students.filter((row) => selectedIds.includes(row.id));
    const actionable = selectedOnPage.filter((row) => !(row.is_deleted || row.status === "deleted") && row.is_active !== nextActive);
    const alreadyInState = selectedOnPage.filter((row) => !(row.is_deleted || row.status === "deleted") && row.is_active === nextActive);
    const archivedRows = selectedOnPage.filter((row) => row.is_deleted || row.status === "deleted");

    if (actionable.length === 0) {
      if (archivedRows.length > 0 && alreadyInState.length === 0) {
        setError("Selected records are archived. Please unarchive first.");
      } else {
        setError(`Selected records are already in ${nextActive ? "active" : "inactive"} status.`);
      }
      return;
    }

    try {
      setBulkBusy(true);
      setError("");
      setSuccess("");
      for (const row of actionable) {
        await apiPatch(`/api/v1/students/students/${row.id}/`, {
          is_active: nextActive,
          is_disabled: false,
          status: nextActive ? "active" : "inactive",
        });
      }
      setStudents((prev) =>
        prev.map((row) =>
          actionable.some((item) => item.id === row.id)
            ? {
                ...row,
                is_active: nextActive,
                is_disabled: false,
                status: nextActive ? "active" : "inactive",
              }
            : row,
        ),
      );
      const updatedCount = actionable.length;
      const alreadyCount = alreadyInState.length;
      const archivedCount = archivedRows.length;
      let message = `${updatedCount} student${updatedCount > 1 ? "s" : ""} ${nextActive ? "activated" : "deactivated"} successfully.`;
      if (alreadyCount > 0) {
        message += ` ${alreadyCount} already in ${nextActive ? "active" : "inactive"} status.`;
      }
      if (archivedCount > 0) {
        message += ` ${archivedCount} archived record${archivedCount > 1 ? "s were" : " was"} skipped.`;
      }
      setSuccess(message);
      setSelectedIds([]);
      refreshList();
    } catch (err) {
      setError(getErrorMessage(err, nextActive ? "Unable to activate selected students." : "Unable to deactivate selected students."));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0 || bulkBusy) {
      if (selectedIds.length === 0) {
        setError("Select at least one student to archive.");
      }
      return;
    }

    const selectedOnPage = students.filter((row) => selectedIds.includes(row.id));
    const actionable = selectedOnPage.filter((row) => !(row.is_deleted || row.status === "deleted"));
    const alreadyArchived = selectedOnPage.filter((row) => row.is_deleted || row.status === "deleted");

    if (actionable.length === 0) {
      setError("Selected records are already in archived status.");
      return;
    }

    try {
      setBulkBusy(true);
      setError("");
      setSuccess("");
      for (const row of actionable) {
        await apiPost(`/api/v1/students/students/${row.id}/soft-delete/`);
      }
      setStudents((prev) =>
        prev.map((row) =>
          actionable.some((item) => item.id === row.id)
            ? {
                ...row,
                is_deleted: true,
                is_active: false,
                is_disabled: true,
                status: "deleted",
              }
            : row,
        ),
      );
      const archivedNow = actionable.length;
      const alreadyCount = alreadyArchived.length;
      setSuccess(
        alreadyCount > 0
          ? `${archivedNow} student${archivedNow > 1 ? "s" : ""} archived successfully. ${alreadyCount} already in archived status.`
          : `${archivedNow} student${archivedNow > 1 ? "s" : ""} archived successfully.`,
      );
      setSelectedIds([]);
      refreshList();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to archive selected students."));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkUnarchive = async () => {
    if (selectedIds.length === 0 || bulkBusy) {
      if (selectedIds.length === 0) {
        setError("Select at least one student to unarchive.");
      }
      return;
    }

    const selectedOnPage = students.filter((row) => selectedIds.includes(row.id));
    const actionable = selectedOnPage.filter((row) => row.is_deleted || row.status === "deleted");
    const alreadyActive = selectedOnPage.filter((row) => !(row.is_deleted || row.status === "deleted"));

    if (actionable.length === 0) {
      setError("Selected records are already active (not archived).");
      return;
    }

    try {
      setBulkBusy(true);
      setError("");
      setSuccess("");
      for (const row of actionable) {
        await apiPost(`/api/v1/students/students/${row.id}/restore/`);
      }
      setStudents((prev) =>
        prev.map((row) =>
          actionable.some((item) => item.id === row.id)
            ? {
                ...row,
                is_deleted: false,
                is_active: true,
                is_disabled: false,
                status: "active",
              }
            : row,
        ),
      );
      const restoredCount = actionable.length;
      const alreadyCount = alreadyActive.length;
      setSuccess(
        alreadyCount > 0
          ? `${restoredCount} student${restoredCount > 1 ? "s" : ""} unarchived successfully. ${alreadyCount} already active.`
          : `${restoredCount} student${restoredCount > 1 ? "s" : ""} unarchived successfully.`,
      );
      setSelectedIds([]);
      refreshList();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to unarchive selected students."));
    } finally {
      setBulkBusy(false);
    }
  };

  const buildCsvAndDownload = (rowsToExport: StudentRow[], filePrefix: string) => {
    if (rowsToExport.length === 0) {
      setError("No student records available to export.");
      return;
    }

    const headers = ["Admission No", "Student", "Class", "Section", "Guardian", "Phone", "DOB", "Status"];
    const rows = rowsToExport.map((row) => {
      const status = row.is_deleted || row.status === "deleted" ? "Archived" : row.is_active ? (row.is_disabled ? "Docs pending" : "Active") : "Inactive";
      return [
        row.admission_no || "-",
        fullName(row),
        row.current_class ? String(classMap.get(row.current_class) || row.current_class) : "-",
        row.current_section ? String(sectionMap.get(row.current_section) || row.current_section) : "-",
        resolveGuardianName(row),
        row.phone || "-",
        formatDate(row.date_of_birth),
        status,
      ];
    });

    const csvText = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filePrefix}-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, 0);
  };

  const handleExportSelected = () => {
    if (selectedRows.length === 0) {
      setError("Select at least one student to export.");
      return;
    }
    buildCsvAndDownload(selectedRows, "students-selected");
    setSuccess("Selected students exported to CSV.");
  };

  const handleExportVisible = () => {
    buildCsvAndDownload(students, "students-list");
    setSuccess("Student list exported to CSV.");
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    if (!viewDrawerOpen || !viewStudentId) return;

    const loadStudentDetail = async () => {
      try {
        setViewLoading(true);
        const detail = await apiGet<StudentDetail>(`/api/v1/students/students/${viewStudentId}/`);
        setViewStudent(detail);
        setViewError("");
      } catch {
        setViewError("Unable to load full student profile.");
      } finally {
        setViewLoading(false);
      }
    };

    void loadStudentDetail();
  }, [viewDrawerOpen, viewStudentId]);

  useEffect(() => {
    if (!viewDrawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [viewDrawerOpen]);

  return (
    <div className={`${manrope.variable} ${playfairDisplay.variable} student-list-panel`}>
      <main className="page">
        <div className="page-head">
          <div>
            <h1>
              All <em>students</em>
            </h1>
            <p>Browse, search, and manage every enrolled student. Click any row to see full profile.</p>
          </div>
          <div className="actions">
            <button className="btn btn-ghost" type="button" title="Export student list" onClick={handleExportVisible}>
              Export
            </button>
           <Link href="/students/add">
  <button className="btn btn-primary enroll-btn">
    + Enroll student
  </button>
</Link>
          </div>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <p className="stat-label">Total enrolled</p>
            <p className="stat-value">{loadingStats ? "..." : formatCount(totalEnrolledCount)}</p>
            <p className="stat-hint">+12 since last week</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Active</p>
            <p className="stat-value">{loadingStats ? "..." : formatCount(activeCount)}</p>
            <p className="stat-hint">{totalEnrolledCount > 0 ? `${Math.round((activeCount / totalEnrolledCount) * 100)}% of total` : "No data"}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">New this month</p>
            <p className="stat-value">{formatCount(newCount)}</p>
            <p className="stat-hint">Latest page intake</p>
          </article>
          <article className="stat-card attention">
            <p className="stat-label">Docs pending</p>
            <p className="stat-value">{formatCount(docsPendingCount)}</p>
            <p className="stat-hint">Needs attention</p>
          </article>
        </div>

        {success ? <div className="flash success">{success}</div> : null}
        {error ? <div className="flash error">{error}</div> : null}

        <section className="list-shell">
          <div className="toolbar">
            <div className="search-wrap">
              <input
                className="search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search name, admission no, phone"
                title="Search students"
              />
            </div>
            <div className="chip-row">
              <button
                type="button"
                className={statusFilter === "all" ? "chip active" : "chip"}
                onClick={() => {
                  setStatusFilter("all");
                  setPage(1);
                }}
                title="Show all students"
              >
                All <span>{formatCount(totalCount)}</span>
              </button>
              <button
                type="button"
                className={statusFilter === "active" ? "chip active" : "chip"}
                onClick={() => {
                  setStatusFilter("active");
                  setPage(1);
                }}
                title="Show active students"
              >
                Active <span>{formatCount(activeCount)}</span>
              </button>
              <button
                type="button"
                className={statusFilter === "inactive" ? "chip active" : "chip"}
                onClick={() => {
                  setStatusFilter("inactive");
                  setPage(1);
                }}
                title="Show inactive students"
              >
                Inactive <span>{formatCount(inactiveCount)}</span>
              </button>
              <button
                type="button"
                className={statusFilter === "archived" ? "chip active" : "chip"}
                onClick={() => {
                  setStatusFilter("archived");
                  setPage(1);
                }}
                title="Show archived students"
              >
                Archived <span>{formatCount(archivedCount)}</span>
              </button>
              <span className="chip static">New <span>{formatCount(newCount)}</span></span>
              <span className="chip static">Docs pending <span>{formatCount(docsPendingCount)}</span></span>
            </div>
            <div className="filter-row">
              <select
                className="field"
                value={classFilter}
                onChange={(event) => {
                  setClassFilter(event.target.value);
                  setSectionFilter("");
                  setPage(1);
                }}
                title="Filter by class"
              >
                <option value="">Class</option>
                {classes.map((row) => (
                  <option key={row.id} value={row.id}>
                    {normalizeLabel(String(row.name || row.class_name || ""), row.id)}
                  </option>
                ))}
              </select>
              <select
                className="field"
                value={sectionFilter}
                onChange={(event) => {
                  setSectionFilter(event.target.value);
                  setPage(1);
                }}
                title="Filter by section"
              >
                <option value="">Section</option>
                {filteredSections.map((row) => (
                  <option key={row.id} value={row.id}>
                    {normalizeLabel(String(row.name || row.section_name || ""), row.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bulk-bar">
            <strong>{selectedIds.length} selected</strong>
            <div className="bulk-actions">
              {statusFilter === "archived" ? (
                <button type="button" className="bulk-btn" title="Unarchive selected students" onClick={() => void handleBulkUnarchive()} disabled={selectedIds.length === 0 || bulkBusy}>Unarchive</button>
              ) : (
                <>
                  <button
                    type="button"
                    className="bulk-btn"
                    title="Activate selected students"
                    onClick={() => {
                      if (selectedIds.length === 0 || bulkBusy) return;
                      const n = selectedIds.length;
                      setPendingConfirm({
                        title: "Confirm Activation",
                        message: `Are you sure you want to activate ${n} selected student${n > 1 ? "s" : ""}?`,
                        details: "Activated students will appear in default lists.",
                        confirmLabel: "Activate",
                        variant: "primary",
                        execute: async () => { await handleBulkActiveState(true); },
                      });
                    }}
                    disabled={selectedIds.length === 0 || bulkBusy}
                  >Activate</button>
                  <button
                    type="button"
                    className="bulk-btn"
                    title="Deactivate selected students"
                    onClick={() => {
                      if (selectedIds.length === 0 || bulkBusy) return;
                      const n = selectedIds.length;
                      setPendingConfirm({
                        title: "Confirm Deactivation",
                        message: `Are you sure you want to deactivate ${n} selected student${n > 1 ? "s" : ""}?`,
                        details: "This action can be reversed later by activating again.",
                        confirmLabel: "Deactivate",
                        variant: "danger",
                        execute: async () => { await handleBulkActiveState(false); },
                      });
                    }}
                    disabled={selectedIds.length === 0 || bulkBusy}
                  >Deactivate</button>
                </>
              )}
              <button type="button" className="bulk-btn" title="Message selected guardians (coming soon)" disabled>Message parents</button>
              <button type="button" className="bulk-btn" title="Export selected students" onClick={handleExportSelected} disabled={selectedIds.length === 0 || bulkBusy}>Export selected</button>
              {statusFilter !== "archived" ? (
                <button type="button" className="bulk-btn danger" title="Archive selected students" onClick={() => void handleBulkArchive()} disabled={selectedIds.length === 0 || bulkBusy}>Archive</button>
              ) : null}
              <button type="button" className="bulk-btn" onClick={() => setSelectedIds([])} title="Clear selection" disabled={selectedIds.length === 0 || bulkBusy}>Clear</button>
            </div>
          </div>

          <div className="table-card">
          {loading ? (
            <div className="loading-row">
              <Spinner size={20} color="#4729f4" />
              <span>Loading student records...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="empty-state">
              <p>No students found.</p>
              <Link href="/students/add">Add the first student</Link>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        title="Select all students on this page"
                        aria-label="Select all students on this page"
                      />
                    </th>
                    <th>Student</th>
                    <th>Admission No</th>
                    <th>Class</th>
                    <th>Guardian</th>
                    <th>DOB</th>
                    <th>Roll No</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((row) => (
                    <tr key={row.id} className={selectedIds.includes(row.id) ? "row-selected" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.id)}
                          onChange={() => toggleRow(row.id)}
                          title={`Select ${fullName(row)}`}
                          aria-label={`Select ${fullName(row)}`}
                        />
                      </td>
                      <td>
                        <div className="student-cell">
                          <div className="avatar">{fullName(row).slice(0, 2).toUpperCase()}</div>
                          <div>
                            <p className="primary">{fullName(row)}</p>
                            <p className="secondary">
                              {row.gender ? `${row.gender.charAt(0).toUpperCase()}${row.gender.slice(1)}` : "-"} · Roll {row.roll_no || "-"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>{row.admission_no || "-"}</td>
                      <td>
                        {row.current_class ? classMap.get(row.current_class) || row.current_class : "-"}
                        {row.current_section ? (
                          <span className="tiny-chip">{sectionMap.get(row.current_section) || row.current_section}</span>
                        ) : null}
                      </td>
                      <td>
                        <p className="primary">{resolveGuardianName(row)}</p>
                        <p className="secondary">{resolveGuardianPhone(row)}</p>
                      </td>
                      <td>
                        <p className="primary">{formatDate(row.date_of_birth)}</p>
                        <p className="secondary">{formatAgeFromDob(row.date_of_birth)}</p>
                      </td>
                      <td>{row.roll_no || "-"}</td>
                      <td>
                        <button
                          type="button"
                          className={row.is_deleted || row.status === "deleted" ? "status archived" : row.is_active && !row.is_disabled ? "status active" : row.is_disabled ? "status pending" : "status inactive"}
                          onClick={() => openViewDrawer(row)}
                          title={`View and manage ${fullName(row)}'s status`}
                        >
                          {row.is_deleted || row.status === "deleted" ? "Archived" : row.is_active ? (row.is_disabled ? "Docs pending" : "Active") : "Inactive"}
                        </button>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="icon-action icon-view" title="View student" aria-label={`View ${fullName(row)}`} onClick={() => openViewDrawer(row)}>
                            <span className="icon-glyph" aria-hidden="true">👁</span>
                            <span className="sr-only">View</span>
                          </button>
                          <Link href={`/students/add?mode=edit&id=${row.id}`} title="Edit student" className="icon-action icon-edit" aria-label={`Edit ${fullName(row)}`}>
                            <span className="icon-glyph" aria-hidden="true">✎</span>
                            <span className="sr-only">Edit</span>
                          </Link>
                          <button type="button" className="icon-action icon-message" title="Message parent" aria-label={`Message parent of ${fullName(row)}`} disabled>
                            <span className="icon-glyph" aria-hidden="true">✉</span>
                            <span className="sr-only">Message parent</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>

          <div className="meta-row">{loadingMeta ? "Loading filters..." : `${formatCount(totalCount)} student(s)`}</div>

          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={pageSize}
            loading={loading}
            onPageChange={(nextPage) => setPage(nextPage)}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize);
              setPage(1);
            }}
          />
        </section>
      </main>

      {viewDrawerOpen ? (
        <div className="view-overlay" onClick={closeViewDrawer} role="presentation">
          <aside className="view-drawer" role="dialog" aria-modal="true" aria-label="Student profile preview" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-head">
              <div className="drawer-id">
                <span className="drawer-avatar">{viewStudent ? fullName(viewStudent).slice(0, 2).toUpperCase() : "ST"}</span>
                <div>
                  <h3>{viewStudent ? fullName(viewStudent) : "Loading..."}</h3>
                  <p>{viewStudent?.admission_no || "-"} · {viewStudent?.current_class ? classMap.get(viewStudent.current_class) || viewStudent.current_class : "-"} · {viewStudent?.current_section ? sectionMap.get(viewStudent.current_section) || viewStudent.current_section : "-"}</p>
                </div>
              </div>
              <button type="button" className="drawer-close" onClick={closeViewDrawer} title="Close profile drawer">X</button>
            </div>

            <div className="drawer-tabs">
              <button type="button" className="tab active">Profile</button>
              <button type="button" className="tab" disabled>Academic</button>
              <button type="button" className="tab" disabled>Attendance</button>
              <button type="button" className="tab" disabled>Fees</button>
            </div>

            <div className="drawer-body">
              {viewLoading ? <p className="drawer-note">Loading student profile...</p> : null}
              {viewError ? <p className="drawer-error">{viewError}</p> : null}

              <div className="drawer-section">
                <p className="drawer-section-title">Academic</p>
                <div className="drawer-row"><span>Class & Section</span><strong>{viewStudent?.current_class ? classMap.get(viewStudent.current_class) || viewStudent.current_class : "-"} · {viewStudent?.current_section ? sectionMap.get(viewStudent.current_section) || viewStudent.current_section : "-"}</strong></div>
                <div className="drawer-row"><span>Roll no</span><strong>{viewStudent?.roll_no || "-"}</strong></div>
                <div className="drawer-row"><span>Academic year</span><strong>{viewStudent?.academic_year_name || "2026 - 27"}</strong></div>
                <div className="drawer-row"><span>Admission type</span><strong>{viewStudent?.admission_type || "New admission"}</strong></div>
              </div>

              <div className="drawer-section">
                <p className="drawer-section-title">Contact</p>
                <div className="drawer-row"><span>Guardian</span><strong>{viewStudent ? resolveGuardianName(viewStudent) : "-"}</strong></div>
                <div className="drawer-row"><span>Phone</span><strong>{viewStudent ? resolveGuardianPhone(viewStudent) : "-"}</strong></div>
                <div className="drawer-row"><span>Email</span><strong>{viewStudent?.email || "-"}</strong></div>
                <div className="drawer-row"><span>Address</span><strong>{[viewStudent?.address_line, viewStudent?.city, viewStudent?.district, viewStudent?.state, viewStudent?.pincode].filter(Boolean).join(", ") || "-"}</strong></div>
              </div>
            </div>

            <div className="drawer-footer">
              <button type="button" className="outline-btn" disabled>
                Message parent
              </button>
              <button
                type="button"
                className={viewStudent?.is_active ? "outline-btn" : "solid-btn"}
                onClick={() => {
                  if (!viewStudent) return;
                  const willDeactivate = viewStudent.is_active;
                  setPendingConfirm({
                    title: willDeactivate ? "Confirm Deactivation" : "Confirm Activation",
                    message: willDeactivate
                      ? "Are you sure you want to deactivate this student?"
                      : "Are you sure you want to activate this student?",
                    details: willDeactivate
                      ? "This action can be reversed later by activating again."
                      : "The student will be marked active and visible in default lists.",
                    confirmLabel: willDeactivate ? "Deactivate" : "Activate",
                    variant: willDeactivate ? "danger" : "primary",
                    execute: async () => {
                      await toggleStudentStatus();
                    },
                  });
                }}
                disabled={viewTogglingStatus}
                title={viewStudent?.is_active ? "Deactivate this student" : "Activate this student"}
              >
                {viewTogglingStatus ? "Updating..." : viewStudent?.is_active ? "Deactivate" : "Activate"}
              </button>
              <Link href={viewStudentId ? `/students/add?mode=edit&id=${viewStudentId}` : "/students/add"} >
              <button className="solid-btn drawer-edit-btn">  Edit profile</button>
              
              </Link>
            </div>
          </aside>
        </div>
      ) : null}

      <ConfirmationModal
        isOpen={pendingConfirm !== null}
        title={pendingConfirm?.title ?? ""}
        message={pendingConfirm?.message ?? ""}
        details={pendingConfirm?.details}
        confirmLabel={pendingConfirm?.confirmLabel ?? "Confirm"}
        variant={pendingConfirm?.variant ?? "danger"}
        isConfirming={confirming}
        onConfirm={() => void runPendingConfirm()}
        onCancel={() => { if (!confirming) setPendingConfirm(null); }}
      />

      <style jsx>{`
        .student-list-panel {
          --ink: #0b0b14;
          --muted: #66677b;
          --line: #dfdfea;
          --card: #ffffff;
          --brand: #4f39f6;
          --soft: #f4f5fa;
          font-family: var(--font-manrope), "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #0b0b14;
          padding: 8px;
        }

        .page {
          background: #f8f8fc;
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 18px;
        }

        .page-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 12px;
          flex-wrap: wrap;
        }

        h1 {
          margin: 0;
          font-size: 36px;
          font-weight: 500;
          font-family: var(--font-playfair-display), "Instrument Serif", Georgia, "Times New Roman", serif;
        }

        h1 em {
          color: #4729f4;
          font-style: italic;
        }

        p {
          margin: 8px 0 0;
          color: var(--muted);
        }

        .actions {
          display: flex;
          gap: 8px;
        }

        .btn {
          border-radius: 10px;
          padding: 9px 14px;
          font-size: 13px;
          text-decoration: none;
          border: 1px solid var(--line);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .btn-ghost {
          background: #fff;
          color: #3a3a4a;
        }

        .btn-primary {
          background: #4729f4;
          color: #fff;
          border-color: #4729f4;
        }

        .enroll-btn {
          min-height: 42px;
          padding: 0 18px;
          font-weight: 700;
          border-radius: 12px;
          box-shadow: 0 10px 20px rgba(71, 41, 244, 0.2);
          color: #fff;
        }

        .enroll-btn:hover {
          background: #3f21e0;
          border-color: #3f21e0;
          color: #fff;
        }

        .stats-grid {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .stat-card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 14px 16px;
        }

        .stat-card.attention {
          border-color: #f2d6a6;
          background: #fffdf8;
        }

        .stat-label {
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 11px;
          color: #72758b;
          font-weight: 700;
        }

        .stat-value {
          margin: 10px 0 6px;
          color: #10122b;
          font-size: 44px;
          line-height: 1;
          font-family: var(--font-playfair-display), "Instrument Serif", Georgia, "Times New Roman", serif;
          font-weight: 500;
          letter-spacing: -0.02em;
          font-feature-settings: "lnum" 1, "pnum" 1;
        }

        .stat-hint {
          margin: 0;
          color: #72758b;
          font-size: 13px;
        }

        .flash {
          margin-top: 16px;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 14px;
          font-weight: 600;
        }

        .flash.success {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .flash.error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .list-shell {
          margin-top: 16px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: #fff;
          overflow: hidden;
        }

        .toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          padding: 12px 14px;
          border-bottom: 1px solid #ececf4;
          background: #fbfbff;
        }

        .search-wrap {
          min-width: 250px;
          flex: 1;
        }

        .search {
          width: 100%;
          height: 40px;
          border: 1px solid #dfe0eb;
          border-radius: 10px;
          padding: 0 14px;
          background: #fff;
        }

        .chip-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .chip {
          height: 32px;
          padding: 0 10px;
          border-radius: 9px;
          border: 1px solid #e8e8f0;
          background: #f7f7fb;
          color: #4b4d64;
          font-size: 12px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-weight: 600;
        }

        .chip.active {
          border-color: #d7d3ff;
          background: #f2efff;
          color: #4338ca;
        }

        .chip.static {
          cursor: default;
        }

        .chip span {
          border-radius: 999px;
          padding: 2px 6px;
          background: #ececf6;
          color: #3e4052;
          font-size: 11px;
        }

        .filter-row {
          margin-left: auto;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .field {
          height: 34px;
          border: 1px solid #d8d9e7;
          border-radius: 8px;
          padding: 0 10px;
          background: #fff;
          font-size: 13px;
          color: #42455d;
        }

        .bulk-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          background: #090b1f;
          color: #fff;
          padding: 10px 14px;
          flex-wrap: wrap;
        }

        .bulk-bar strong {
          font-size: 14px;
        }

        .bulk-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .bulk-btn {
          border: 1px solid #252945;
          background: #1a1f38;
          color: #f8f8fe;
          border-radius: 9px;
          padding: 6px 12px;
          font-size: 12px;
          cursor: pointer;
        }

        .bulk-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .bulk-btn.danger {
          border-color: #6f2437;
          background: #b01948;
        }

        .table-card {
          overflow: hidden;
        }

        .loading-row,
        .empty-state {
          min-height: 220px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #6b6b7b;
        }

        .empty-state a {
          color: #4729f4;
          text-decoration: none;
          font-weight: 600;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1200px;
        }

        th,
        td {
          padding: 13px 12px;
          border-bottom: 1px solid #ebebf3;
          text-align: left;
          font-size: 13px;
          vertical-align: middle;
        }

        th {
          background: #fbfbff;
          color: #6d7086;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 700;
        }

        tbody tr:hover {
          background: #faf9ff;
        }

        .student-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #ece8ff;
          color: #4738ca;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .primary {
          margin: 0;
          color: #121529;
          font-size: 14px;
          font-weight: 600;
        }

        .secondary {
          margin: 2px 0 0;
          color: #7a7d94;
          font-size: 12px;
        }

        .tiny-chip {
          margin-left: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          border-radius: 5px;
          background: #ecebff;
          color: #5045cf;
          font-size: 11px;
          padding: 0 6px;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 700;
          border: none;
          background: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .status.active {
          background: #ecfdf3;
          color: #047857;
        }

        .status.active:hover {
          background: #d1fae5;
          color: #065f46;
        }

        .status.inactive {
          background: #f3f4f6;
          color: #4b5563;
        }

        .status.inactive:hover {
          background: #e5e7eb;
          color: #1f2937;
        }

        .status.pending {
          background: #fff7e8;
          color: #a16207;
        }

        .status.pending:hover {
          background: #fef3c7;
          color: #92400e;
        }

        .status.archived {
          background: #fee2e2;
          color: #b91c1c;
        }

        .status.archived:hover {
          background: #fecaca;
          color: #991b1b;
        }

        .row-actions {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
        }

        tbody tr:hover .row-actions,
        .row-selected .row-actions {
          opacity: 1;
          pointer-events: auto;
        }

        .icon-action {
          border: 1px solid #d8daea;
          background: #fff;
          color: #5b5f7a;
          text-decoration: none;
          font-size: 12px;
          font-weight: 600;
          border-radius: 7px;
          padding: 5px 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          padding: 0;
        }

        .icon-glyph {
          font-size: 14px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .icon-action:hover {
          color: var(--brand);
          border-color: #c8cbf2;
        }

        .icon-action:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        
        .row-actions:empty {
          display: none;
        }

        .row-actions a {
          color: #5b5f7a;
          text-decoration: none;
          font-size: 12px;
          font-weight: 600;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .row-actions a:hover {
          color: var(--brand);
        }

        .meta-row {
          padding: 8px 14px 0;
          color: #6f7287;
          font-size: 12px;
        }

        .view-overlay {
          position: fixed;
          inset: 0;
          background: rgba(7, 10, 26, 0.36);
          backdrop-filter: blur(2px);
          z-index: 1100;
          display: flex;
          justify-content: flex-end;
        }

        .view-drawer {
          width: min(420px, 100vw);
          height: 100%;
          background: #ffffff;
          border-left: 1px solid #e5e7f3;
          display: flex;
          flex-direction: column;
        }

        .drawer-head {
          padding: 16px 18px;
          border-bottom: 1px solid #eceef6;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }

        .drawer-id {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .drawer-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #ece8ff;
          color: #4f39f6;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        .drawer-head h3 {
          margin: 0;
          font-size: 20px;
          font-family: var(--font-playfair-display), "Instrument Serif", Georgia, "Times New Roman", serif;
          letter-spacing: -0.01em;
          color: #1a1d33;
        }

        .drawer-head p {
          margin: 4px 0 0;
          font-size: 13px;
          color: #70728a;
        }

        .drawer-close {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          border: 1px solid #dfe2f0;
          background: #f7f8fc;
          cursor: pointer;
        }

        .drawer-tabs {
          padding: 10px 18px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
          border-bottom: 1px solid #eceef6;
        }

        .tab {
          height: 30px;
          border: 1px solid #e1e4f2;
          border-radius: 8px;
          background: #f8f9ff;
          color: #666b84;
          font-size: 12px;
          cursor: pointer;
        }

        .tab.active {
          background: #fff;
          border-color: #d3d7ef;
          color: #1a1e37;
          font-weight: 600;
        }

        .drawer-body {
          flex: 1;
          overflow: auto;
          padding: 14px 18px;
        }

        .drawer-note,
        .drawer-error {
          margin: 0 0 12px;
          font-size: 13px;
        }

        .drawer-error {
          color: #b91c1c;
        }

        .drawer-section {
          border-top: 1px solid #eceef6;
          padding-top: 12px;
          margin-top: 10px;
        }

        .drawer-section-title {
          margin: 0 0 8px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 11px;
          color: #747896;
          font-weight: 700;
        }

        .drawer-row {
          display: grid;
          grid-template-columns: 110px 1fr;
          gap: 10px;
          align-items: start;
          padding: 8px 0;
          border-bottom: 1px dashed #eceef6;
          font-size: 14px;
        }

        .drawer-row span {
          color: #6f7289;
        }

        .drawer-row strong {
          color: #1f2237;
          font-weight: 600;
        }

        .drawer-footer {
          border-top: 1px solid #eceef6;
          padding: 12px 18px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .outline-btn,
        .solid-btn {
          height: 36px;
          border-radius: 10px;
          padding: 0 14px;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
        }

        .outline-btn {
          border: 1px solid #d8daea;
          background: #fff;
          color: #575b76;
        }

        .solid-btn {
          border: 1px solid #4f39f6;
          background: #4f39f6;
          color: #fff;
          font-weight: 600;
          box-shadow: 0 10px 18px rgba(79, 57, 246, 0.18);
        }

        .drawer-edit-btn {
          min-width: 130px;
          color: #fff;
          text-decoration: none;
        }

        .drawer-edit-btn:hover {
          background: #422fe8;
          border-color: #422fe8;
          color: #fff;
        }

        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 860px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .filter-row {
            margin-left: 0;
            width: 100%;
          }

          .field {
            flex: 1;
            min-width: 120px;
          }
        }
      `}</style>
    </div>
  );
}
