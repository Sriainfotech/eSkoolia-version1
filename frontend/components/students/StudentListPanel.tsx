"use client";

import Link from "next/link";
import { Manrope, Playfair_Display } from "next/font/google";
import { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@/components/common/Spinner";
import { PaginationControls } from "@/components/common/PaginationControls";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { buildPaginationQuery, extractListData, extractPaginationMeta, type ListApiResponse } from "@/lib/pagination";
import { usePersistentPagination } from "@/hooks/usePersistentPagination";
import { pluralize } from "@/lib/utils/pluralize";

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
type StatusFilter = "all" | "active" | "inactive" | "archived" | "new" | "docs";

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

/** Prefixes plain section identifiers like "A", "B", "1" with "Section " for display. */
function formatSectionLabel(label: string, fallback: number): string {
  const text = String(label || "").trim() || String(fallback);
  if (/^section\b/i.test(text)) return text;
  return `Section ${text}`;
}

/** Converts class names like "1", "2" → "Grade 1", "Grade 2"; keeps LKG/UKG/etc as-is */
function formatClassLabel(label: string, id: number): string {
  const text = String(label || "").trim();
  if (!text) return `Class ${id}`;
  const num = Number(text);
  if (!isNaN(num) && num > 0 && num <= 12) return `Grade ${num}`;
  return text;
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
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);
  const [browsePanelOpen, setBrowsePanelOpen] = useState(true);
  const [filterApplied, setFilterApplied] = useState(false);
  const [academicYear, setAcademicYear] = useState("2026-27");
  const [specialFilter, setSpecialFilter] = useState<"" | "special" | "allergy" | "meds">("");
  const [openClasses, setOpenClasses] = useState<Set<number>>(new Set());
  const [activeSectionMap, setActiveSectionMap] = useState<Map<number, number>>(new Map());
  const [classSectionStudents, setClassSectionStudents] = useState<Map<string, StudentRow[]>>(new Map());
  const [classSectionLoading, setClassSectionLoading] = useState<Set<string>>(new Set());
  const [showWholeSchool, setShowWholeSchool] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"profile" | "academic" | "attendance" | "fees">("profile");
  const [drawerAttendance, setDrawerAttendance] = useState<Array<{ id: number; attendance_date: string; status?: string; remarks?: string }>>([]);
  const [drawerAttendanceLoading, setDrawerAttendanceLoading] = useState(false);
  const [drawerAttendanceError, setDrawerAttendanceError] = useState("");

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (statusFilter !== "all") n++;
    if (classFilter) n++;
    if (sectionFilter) n++;
    return n;
  }, [statusFilter, classFilter, sectionFilter]);

  const hasAnyFilter = activeFilterCount > 0 || debouncedSearch.length > 0;

  const applyFiltersGuardRef = useRef(false);

  const clearAllFilters = () => {
    setStatusFilter("all");
    setClassFilter("");
    setSectionFilter("");
    setSearch("");
    setPage(1);
    setSpecialFilter("");
    setAcademicYear("2026-27");
    setFilterApplied(false);
    setClassSectionStudents(new Map());
    setOpenClasses(new Set());
    setActiveSectionMap(new Map());
  };

  const applyFilters = () => {
    setPage(1);
    setClassSectionStudents(new Map()); // bust cache so new filter takes effect
    applyFiltersGuardRef.current = true;
    setFilterApplied(true);
    setRefreshTick((n) => n + 1);
  };

  // When any filter input changes, mark filters as dirty so the accordion is
  // hidden until the user clicks Apply again. The guard ref skips the reset on
  // the render cycle immediately following an applyFilters() call so preset
  // clicks (which change a filter input AND apply in one go) still work.
  useEffect(() => {
    if (applyFiltersGuardRef.current) {
      applyFiltersGuardRef.current = false;
      return;
    }
    setFilterApplied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, classFilter, sectionFilter, specialFilter, academicYear]);

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

  // Reason-required confirmation (Deactivate / Archive). Shared by bulk + drawer.
  type PendingReason = {
    title: string;
    message: string;
    details?: string;
    presets: string[];
    confirmLabel: string;
    variant: "danger" | "primary";
    execute: (reason: string) => Promise<void>;
  };
  const DEACTIVATE_REASONS = [
    "Long absence",
    "Medical leave",
    "Disciplinary action",
    "Parent requested",
    "Documents incomplete",
    "Fees pending",
  ];
  const ARCHIVE_REASONS = [
    "Withdrawn permanently",
    "Transferred to another school",
    "Graduated / completed",
    "Duplicate record",
    "Erroneous entry",
    "Long-term inactive",
  ];
  const [pendingReason, setPendingReason] = useState<PendingReason | null>(null);
  const [reasonPick, setReasonPick] = useState<string>("");
  const [reasonText, setReasonText] = useState<string>("");
  const [reasonBusy, setReasonBusy] = useState(false);
  const openReasonModal = (cfg: PendingReason) => {
    setReasonPick("");
    setReasonText("");
    setPendingReason(cfg);
  };
  const finalReason = (reasonPick && reasonText.trim()) ? `${reasonPick} — ${reasonText.trim()}`
    : (reasonPick || reasonText.trim());
  const aiHelpReason = () => {
    if (!reasonPick) {
      setReasonText("Please select a reason chip first so I can draft a concise note for you.");
      return;
    }
    const templates: Record<string, string> = {
      "Long absence": "Marking inactive due to extended unexplained absence beyond the school's allowed limit. Status will be revisited once the student returns and parent communication is restored.",
      "Medical leave": "Inactive on account of medical leave. Documentation has been verified; record will be reactivated upon medical clearance and resumption.",
      "Disciplinary action": "Status changed pursuant to disciplinary committee review. Reactivation conditional on completion of corrective measures and parent meeting.",
      "Parent requested": "Status updated at the explicit request of the parent/guardian. Communication on file; can be reactivated on parent confirmation.",
      "Documents incomplete": "Marking inactive pending submission of mandatory enrollment documents. Account will be reactivated immediately on document verification.",
      "Fees pending": "Inactive due to unresolved outstanding fees beyond the grace window. Will be reactivated on payment confirmation by the accounts team.",
      "Withdrawn permanently": "Student has formally withdrawn from the institution. Record archived for compliance and historical reference.",
      "Transferred to another school": "Student transferred to another institution; transfer certificate issued. Record archived for the academic year.",
      "Graduated / completed": "Student successfully completed the program. Record archived to alumni status for reference and reporting.",
      "Duplicate record": "This entry is a duplicate of an existing student record and is being archived to maintain data integrity. Active record retained.",
      "Erroneous entry": "Record archived as it was created in error. No academic activity recorded against this entry.",
      "Long-term inactive": "Archived after extended period of inactivity with no parent contact or attendance. Eligible for restoration on family re-engagement.",
    };
    setReasonText(templates[reasonPick] ?? `Status update on account of ${reasonPick.toLowerCase()}.`);
  };
  const runPendingReason = async () => {
    if (!pendingReason || !finalReason.trim()) return;
    try {
      setReasonBusy(true);
      await pendingReason.execute(finalReason.trim());
    } finally {
      setReasonBusy(false);
      setPendingReason(null);
      setReasonPick("");
      setReasonText("");
    }
  };

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
    () => new Map(classes.map((item) => [item.id, formatClassLabel(String(item.name || item.class_name || ""), item.id)])),
    [classes],
  );
  const sectionMap = useMemo(
    () => new Map(sections.map((item) => [item.id, formatSectionLabel(String(item.name || item.section_name || ""), item.id)])),
    [sections],
  );

  const classSectionsMap = useMemo(() => {
    const map = new Map<number, Section[]>();
    for (const sec of sections) {
      if (!map.has(sec.school_class)) map.set(sec.school_class, []);
      map.get(sec.school_class)!.push(sec);
    }
    return map;
  }, [sections]);

  const loadClassSection = async (classId: number, sectionId: number) => {
    const key = `${classId}-${sectionId}`;
    if (classSectionStudents.has(key) || classSectionLoading.has(key)) return;
    setClassSectionLoading((prev) => new Set([...prev, key]));
    try {
      // Load the FULL roster for this class+section (across statuses) so the
      // accordion badges (students / active / docs / special) reflect the true
      // class composition. Status / special filters are applied client-side via
      // `matchesFilter` for visibility — they do NOT scope this fetch.
      const query = buildPaginationQuery(1, 200, {
        current_class: String(classId),
        current_section: String(sectionId),
        search: debouncedSearch || undefined,
        include_deleted: "true",
      });
      const payload = await apiGet<ListApiResponse<StudentRow>>(`/api/v1/students/students/?${query}`);
      const items = extractListData(payload);
      setClassSectionStudents((prev) => new Map(prev).set(key, items));
    } catch {
      setClassSectionStudents((prev) => new Map(prev).set(key, []));
    } finally {
      setClassSectionLoading((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const toggleClass = (classId: number) => {
    setOpenClasses((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
        const secs = classSectionsMap.get(classId) || [];
        if (secs.length > 0) {
          setActiveSectionMap((sm) => {
            if (sm.has(classId)) return sm;
            void loadClassSection(classId, secs[0].id);
            return new Map(sm).set(classId, secs[0].id);
          });
        }
      }
      return next;
    });
  };

  const switchSection = (classId: number, sectionId: number) => {
    setActiveSectionMap((prev) => new Map(prev).set(classId, sectionId));
    void loadClassSection(classId, sectionId);
  };

  // When filters are applied, fetch ALL students for the eligible classes/sections
  // in a SINGLE request and group client-side by class-section. This is dramatically
  // faster than firing one request per (class, section) pair (was 30+ requests).
  useEffect(() => {
    if (!filterApplied) return;
    if (classes.length === 0 || sections.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const eligibleClasses = classFilter ? classes.filter((c) => String(c.id) === classFilter) : classes;
        const eligibleSecs = sectionFilter ? sections.filter((s) => String(s.id) === sectionFilter) : sections;
        // Mark all eligible (class, section) keys as loading
        const allKeys = new Set<string>();
        for (const cls of eligibleClasses) {
          const allSecs = classSectionsMap.get(cls.id) || [];
          const secs = sectionFilter ? allSecs.filter((s) => String(s.id) === sectionFilter) : allSecs;
          for (const sec of secs) allKeys.add(`${cls.id}-${sec.id}`);
        }
        setClassSectionLoading(allKeys);

        const params: Record<string, unknown> = {
          search: debouncedSearch || undefined,
          include_deleted: "true",
        };
        if (classFilter) params.current_class = classFilter;
        if (sectionFilter) params.current_section = sectionFilter;

        // Page through results until we have everything (backend caps page_size at 1000)
        const items: StudentRow[] = [];
        let pageNum = 1;
        const pageSizeBulk = 500;
        while (true) {
          const query = buildPaginationQuery(pageNum, pageSizeBulk, params);
          const payload = await apiGet<ListApiResponse<StudentRow>>(`/api/v1/students/students/?${query}`);
          if (cancelled) return;
          const batch = extractListData(payload);
          items.push(...batch);
          const next = (payload as unknown as { next?: string | null })?.next;
          if (!next || batch.length === 0) break;
          pageNum += 1;
          if (pageNum > 20) break; // safety
        }

        // Group by class-section
        const grouped = new Map<string, StudentRow[]>();
        for (const k of allKeys) grouped.set(k, []);
        const validClassIds = new Set(eligibleClasses.map((c) => c.id));
        const validSecIds = new Set(eligibleSecs.map((s) => s.id));
        for (const row of items) {
          const cId = row.current_class;
          const sId = row.current_section;
          if (!cId || !sId) continue;
          if (!validClassIds.has(cId)) continue;
          if (!validSecIds.has(sId)) continue;
          const k = `${cId}-${sId}`;
          if (!grouped.has(k)) grouped.set(k, []);
          grouped.get(k)!.push(row);
        }
        setClassSectionStudents(grouped);
        setClassSectionLoading(new Set());

        // Auto-open + auto-select first section of first eligible class (only first time)
        if (openClasses.size === 0 && eligibleClasses[0]) {
          const firstClass = eligibleClasses[0];
          const allSecs = classSectionsMap.get(firstClass.id) || [];
          const firstSecs = sectionFilter ? allSecs.filter((s) => String(s.id) === sectionFilter) : allSecs;
          if (firstSecs.length > 0) {
            setOpenClasses(new Set([firstClass.id]));
            setActiveSectionMap(new Map([[firstClass.id, firstSecs[0].id]]));
          }
        }
      } catch {
        if (!cancelled) {
          setClassSectionLoading(new Set());
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterApplied, classes, sections, refreshTick]);

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
    if (!filterApplied) return; // Only load when filter is applied
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
  }, [filterApplied, debouncedSearch, page, pageSize, statusFilter, classFilter, sectionFilter, refreshTick]);

  const selectedRows = useMemo(() => students.filter((row) => selectedIds.includes(row.id)), [students, selectedIds]);

  // Bug #2: "Showing X students" must reflect the same data the tree renders.
  // Derive from the per-section maps that drive the accordion view.
  const treeLoadedStudentCount = useMemo(() => {
    let total = 0;
    classSectionStudents.forEach((rows) => { total += rows.length; });
    return total;
  }, [classSectionStudents]);

  // Bug #3: NEW THIS MONTH should reflect the current calendar month, not all-time.
  const currentMonthLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleString("en-US", { month: "long", year: "numeric" });
  }, []);
  const newThisMonthCount = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return students.filter((row) => {
      const raw = (row as { created_at?: string; admission_date?: string }).created_at
        || (row as { created_at?: string; admission_date?: string }).admission_date;
      if (!raw) return false;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return false;
      return d.getMonth() === month && d.getFullYear() === year;
    }).length;
  }, [students]);

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
    setDrawerTab("profile");
    setViewDrawerOpen(true);
  };

  const closeViewDrawer = () => {
    setViewDrawerOpen(false);
    setViewStudentId(null);
    setViewError("");
    setDrawerAttendance([]);
    setDrawerAttendanceError("");
  };

  // Lazily fetch attendance when its tab is opened
  useEffect(() => {
    if (!viewDrawerOpen || drawerTab !== "attendance" || !viewStudentId) return;
    if (drawerAttendance.length > 0 || drawerAttendanceLoading) return;
    let cancelled = false;
    (async () => {
      setDrawerAttendanceLoading(true);
      setDrawerAttendanceError("");
      try {
        const data = await apiGet<unknown>(`/api/v1/attendance/student-attendance/?student_id=${viewStudentId}`);
        if (cancelled) return;
        const list = Array.isArray(data)
          ? data
          : Array.isArray((data as { results?: unknown[] })?.results)
            ? (data as { results: unknown[] }).results
            : Array.isArray((data as { data?: unknown[] })?.data)
              ? (data as { data: unknown[] }).data
              : [];
        setDrawerAttendance(list as Array<{ id: number; attendance_date: string; status?: string; remarks?: string }>);
      } catch {
        if (!cancelled) setDrawerAttendanceError("Could not load attendance for this student.");
      } finally {
        if (!cancelled) setDrawerAttendanceLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDrawerOpen, drawerTab, viewStudentId]);

  const toggleStudentStatus = async (reason: string = "") => {
    if (!viewStudentId || !viewStudent || viewTogglingStatus) return;
    try {
      setViewTogglingStatus(true);
      setViewError("");
      const nextActive = !viewStudent.is_active;
      await apiPost(`/api/v1/students/students/${viewStudentId}/set-status/`, {
        is_active: nextActive,
        reason,
      });
      setViewStudent((prev) => (prev ? { ...prev, is_active: nextActive, is_disabled: false, status: nextActive ? "active" : "inactive" } : prev));
      setStudents((prev) =>
        prev.map((row) =>
          row.id === viewStudentId
            ? {
                ...row,
                is_active: nextActive,
                is_disabled: false,
                status: nextActive ? "active" : "inactive",
              }
            : row,
        ),
      );
      // Keep the row in the class accordion in place — only flip the flags so
      // the row stays visible at the same position with an updated status pill.
      setClassSectionStudents((prev) => {
        const next = new Map(prev);
        for (const [k, list] of next) {
          const idx = list.findIndex((r) => r.id === viewStudentId);
          if (idx !== -1) {
            const copy = list.slice();
            copy[idx] = { ...copy[idx], is_active: nextActive, is_disabled: false, status: nextActive ? "active" : "inactive" };
            next.set(k, copy);
          }
        }
        return next;
      });
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

  const handleBulkActiveState = async (nextActive: boolean, reason: string = "") => {
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
        await apiPost(`/api/v1/students/students/${row.id}/set-status/`, {
          is_active: nextActive,
          reason,
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

  const archiveStudent = async (studentId: number, reason: string) => {
    try {
      setBulkBusy(true);
      await apiPost(`/api/v1/students/students/${studentId}/soft-delete/`, { reason });
      setStudents((prev) =>
        prev.map((row) =>
          row.id === studentId
            ? { ...row, is_deleted: true, is_active: false, is_disabled: true, status: "deleted" }
            : row,
        ),
      );
      setSuccess("Student archived successfully.");
      refreshList();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to archive student."));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkArchive = async (reason: string = "") => {
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
        await apiPost(`/api/v1/students/students/${row.id}/soft-delete/`, { reason });
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
            <h1 style={{ margin: 0, fontFamily: 'var(--font-playfair), Georgia, "Times New Roman", serif', fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, color: '#0f172a' }}>
              Student <em style={{ fontFamily: 'var(--font-playfair), Georgia, "Times New Roman", serif', fontStyle: 'italic', fontSize: '32px', fontWeight: 400, color: '#6c3ce1' }}>List</em>
            </h1>
            <p>Browse, search, and manage every enrolled student · Click any row to see full profile.</p>
          </div>
          <div className="actions">
            <button className="btn btn-ghost" type="button" title="Export student list" onClick={handleExportVisible}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12" aria-hidden="true"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10"/></svg>
              Export
            </button>
           <Link href="/students/add">
  <button className="btn btn-primary enroll-btn">
    Enroll Student
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
            <p className="stat-value">{formatCount(newThisMonthCount)}</p>
            <p className="stat-hint">Enrolled in {currentMonthLabel}</p>
          </article>
          <article className={docsPendingCount > 0 ? "stat-card attention" : "stat-card"}>
            <p className="stat-label">Docs pending</p>
            <p className="stat-value">{formatCount(docsPendingCount)}</p>
            <p className="stat-hint">
              {docsPendingCount === 0
                ? "All documents up to date"
                : `${pluralize(docsPendingCount, "document")} need review`}
            </p>
          </article>
        </div>

        {success ? <div className="flash success">{success}</div> : null}
        {error ? <div className="flash error">{error}</div> : null}

        <section className="list-shell">

          {/* ═══════════════════════════════════════
              Panel 01 — Smart Filters
          ═══════════════════════════════════════ */}
          <div className="sl-panel">
            <div
              className="sl-panel-hd"
              onClick={() => setFilterPanelOpen((v) => !v)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setFilterPanelOpen((v) => !v); }}
              aria-expanded={filterPanelOpen}
            >
              <span className="sl-panel-num">01</span>
              <svg className="sl-panel-icon" viewBox="0 0 16 16" fill="none" stroke="#5b4fcf" strokeWidth="1.5" width="14" height="14" aria-hidden="true">
                <path d="M2 4h12M4 8h8M6 12h4"/>
              </svg>
              <div className="sl-panel-title-block">
                <span className="sl-panel-title">Smart filters</span>
                <span className="sl-panel-desc">Filter by status · academic year · class · section · special needs</span>
              </div>
              <div className="sl-panel-tags">
                {academicYear !== "all" && <span className="sl-atag p-blue">{academicYear}</span>}
                {statusFilter !== "all" && <span className="sl-atag p-purple">{statusFilter}</span>}
                {specialFilter && <span className="sl-atag p-amber">{specialFilter === "special" ? "special needs" : specialFilter === "allergy" ? "has allergy" : "on medication"}</span>}
                {classFilter && <span className="sl-atag p-gray">{classMap.get(Number(classFilter)) || "Class"}</span>}
                {debouncedSearch && <span className="sl-atag p-blue">&ldquo;{debouncedSearch}&rdquo;</span>}
              </div>
              <svg
                className={filterPanelOpen ? "sl-chevron open" : "sl-chevron"}
                viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                width="14" height="14" aria-hidden="true" style={{ marginLeft: "auto", flexShrink: 0 }}
              >
                <path d="M4 6l4 4 4-4"/>
              </svg>
            </div>

            {filterPanelOpen && (
              <div className="sl-panel-body">
                <div className="sl-filter-body">
                  {/* Row 1: Search · Academic Year · Class · Section */}
                  <div className="sl-filter-row1">
                    <div className="sl-fg sl-fg-search">
                      <span className="sl-fg-label">Search</span>
                      <div className="sl-search-wrap">
                        <svg className="sl-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                          <circle cx="6.5" cy="6.5" r="4.5"/>
                          <path d="M10.5 10.5 14 14"/>
                        </svg>
                        <input
                          className="sl-search"
                          type="search"
                          value={search}
                          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                          placeholder="Name, admission no, phone…"
                        />
                      </div>
                    </div>
                    <div className="sl-fg">
                      <span className="sl-fg-label">Academic year</span>
                      <select
                        className="sl-fsel"
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                      >
                        <option value="all">All years</option>
                        <option value="2026-27">2026 – 27</option>
                        <option value="2025-26">2025 – 26</option>
                        <option value="2024-25">2024 – 25</option>
                      </select>
                    </div>
                    <div className="sl-fg">
                      <span className="sl-fg-label">Class</span>
                      <select
                        className="sl-fsel"
                        value={classFilter}
                        onChange={(e) => { setClassFilter(e.target.value); setSectionFilter(""); setPage(1); }}
                      >
                        <option value="">All classes</option>
                        {classes.map((row) => (
                          <option key={row.id} value={row.id}>
                            {formatClassLabel(String(row.name || row.class_name || ""), row.id)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sl-fg">
                      <span className="sl-fg-label">Section</span>
                      <select
                        className="sl-fsel"
                        value={sectionFilter}
                        onChange={(e) => { setSectionFilter(e.target.value); setPage(1); }}
                        disabled={!classFilter || filteredSections.length === 0}
                      >
                        <option value="">{!classFilter ? "Select a class first" : "All sections"}</option>
                        {filteredSections.map((row) => (
                          <option key={row.id} value={row.id}>
                            {formatSectionLabel(String(row.name || row.section_name || ""), row.id)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sl-filter-divider" />

                  {/* Row 2: Status pills (left) + Special & Medical (right) */}
                  <div className="sl-filter-row2">
                    <div className="sl-fg" style={{ flex: 1 }}>
                      <span className="sl-fg-label">Status</span>
                      <div className="sl-pills">
                        {([
                          { v: "all", label: "All", n: totalEnrolledCount },
                          { v: "active", label: "Active", n: activeCount },
                          { v: "inactive", label: "Inactive", n: inactiveCount },
                          { v: "new", label: "New", n: newCount },
                          { v: "docs", label: "Docs pending", n: docsPendingCount },
                          { v: "archived", label: "Archived", n: archivedCount },
                        ] as const).map((p) => (
                          <button
                            key={p.v}
                            type="button"
                            className={statusFilter === p.v ? "sl-pill on" : "sl-pill"}
                            onClick={() => { setStatusFilter(p.v as StatusFilter); setPage(1); }}
                          >
                            {p.label}<span className="sl-pill-ct">{formatCount(p.n)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="sl-fg" style={{ flexShrink: 0 }}>
                      <span className="sl-fg-label">Special &amp; medical</span>
                      <div className="sl-pills">
                        {([
                          { v: "special", label: "Special needs" },
                          { v: "allergy", label: "Has allergy" },
                          { v: "meds", label: "On medication" },
                        ] as const).map((p) => (
                          <button
                            key={p.v}
                            type="button"
                            className={specialFilter === p.v ? "sl-pill on-amber" : "sl-pill"}
                            onClick={() => setSpecialFilter(specialFilter === p.v ? "" : p.v)}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter footer: count + saved presets + reset + apply */}
                <div className="sl-filter-foot">
                  <div className="sl-filter-foot-left">
                    <span className="sl-filter-count">
                      {filterApplied ? (
                        <>Showing <strong>{formatCount(treeLoadedStudentCount)}</strong> {treeLoadedStudentCount === 1 ? "student" : "students"}</>
                      ) : (
                        <em style={{ color: "#9a9db4", fontStyle: "normal" }}>Click <strong style={{ color: "#4f39f6" }}>Apply</strong> to load students</em>
                      )}
                    </span>
                  </div>
                  <div className="sl-presets">
                    <span className="sl-presets-label">Saved presets:</span>
                    <button type="button" className="sl-ptag saved" onClick={() => { clearAllFilters(); setStatusFilter("active"); applyFilters(); }}>All active</button>
                    <button type="button" className="sl-ptag saved" onClick={() => { clearAllFilters(); setSpecialFilter("special"); applyFilters(); }}>Special needs</button>
                    <button type="button" className="sl-ptag saved" onClick={() => { clearAllFilters(); setStatusFilter("docs"); applyFilters(); }}>Docs pending</button>
                    <button type="button" className="sl-ptag" onClick={() => setSuccess("Preset saved!")}>+ Save current</button>
                    <button type="button" className="sl-reset-btn" onClick={clearAllFilters}>Reset all</button>
                    <button type="button" className="sl-apply-btn" onClick={applyFilters}>Apply</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════
              Panel 02 — Browse by Class
          ═══════════════════════════════════════ */}
          <div className="sl-panel">
            <div
              className="sl-panel-hd"
              onClick={() => setBrowsePanelOpen((v) => !v)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setBrowsePanelOpen((v) => !v); }}
              aria-expanded={browsePanelOpen}
            >
              <span className="sl-panel-num">02</span>
              <svg className="sl-panel-icon" viewBox="0 0 16 16" fill="none" stroke="#5b4fcf" strokeWidth="1.5" width="14" height="14" aria-hidden="true">
                <rect x="1" y="1" width="6" height="6" rx="1"/>
                <rect x="9" y="1" width="6" height="6" rx="1"/>
                <rect x="1" y="9" width="6" height="6" rx="1"/>
                <rect x="9" y="9" width="6" height="6" rx="1"/>
              </svg>
              <div className="sl-panel-title-block">
                <span className="sl-panel-title">Browse &amp; edit by class</span>
                <span className="sl-panel-desc">Expand a class → pick section → view &amp; manage students</span>
              </div>
              {!loadingMeta && (
                <div className="sl-panel-tags">
                  <span className="sl-atag p-blue">{classes.length} class{classes.length !== 1 ? "es" : ""}</span>
                  <span className="sl-atag p-gray">{pluralize(sections.length, "section")}</span>
                </div>
              )}
              <svg
                className={browsePanelOpen ? "sl-chevron open" : "sl-chevron"}
                viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                width="14" height="14" aria-hidden="true" style={{ marginLeft: "auto", flexShrink: 0 }}
              >
                <path d="M4 6l4 4 4-4"/>
              </svg>
            </div>

            {browsePanelOpen && (
              <div className="sl-browse-body">
                {!filterApplied ? (
                  <div className="sl-apply-cta">
                    <svg viewBox="0 0 16 16" fill="none" stroke="#5b4fcf" strokeWidth="1.5" width="28" height="28" aria-hidden="true"><path d="M2 3h12l-4.5 6V14L6.5 12V9L2 3z"/></svg>
                    <p className="sl-apply-cta-title">Set your filters and click <strong>Apply</strong></p>
                    <p className="sl-apply-cta-sub">Students will load grouped by class &amp; section once you apply the filter.</p>
                    <button type="button" className="sl-apply-btn" onClick={applyFilters}>Apply filters</button>
                  </div>
                ) : loadingMeta ? (
                  <div className="sl-loading-row">Loading classes…</div>
                ) : classes.length === 0 ? (
                  <div className="sl-empty">No classes configured.</div>
                ) : (() => {
                  // Predicate: does a student row match the currently-applied secondary filter?
                  // (status / special). Class & section filters are already honoured by the
                  // load query; here we narrow per-class visibility further.
                  const matchesFilter = (r: StudentRow): boolean => {
                    if (statusFilter === "active" && !(r.is_active && !r.is_disabled && !(r.is_deleted || r.status === "deleted"))) return false;
                    if (statusFilter === "inactive" && !(!r.is_active && !(r.is_deleted || r.status === "deleted"))) return false;
                    if (statusFilter === "archived" && !(r.is_deleted || r.status === "deleted")) return false;
                    if (statusFilter === "docs" && !r.is_disabled) return false;
                    if (statusFilter === "new") {
                      const created = (r as { created_at?: string }).created_at;
                      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
                      if (!created || new Date(created).getTime() < cutoff) return false;
                    }
                    if (specialFilter === "special" && !(r as { has_special_needs?: boolean }).has_special_needs) return false;
                    if (specialFilter === "allergy" && !(r as { has_allergy?: boolean }).has_allergy) return false;
                    if (specialFilter === "meds" && !(r as { on_medication?: boolean }).on_medication) return false;
                    return true;
                  };

                  const baseClasses = classFilter ? classes.filter((c) => String(c.id) === classFilter) : classes;
                  const hasStudentFilter = statusFilter !== "all" || specialFilter !== "";
                  const classesToRender = (!hasStudentFilter || showWholeSchool)
                    ? baseClasses
                    : baseClasses.filter((cls) => {
                        const secs = classSectionsMap.get(cls.id) || [];
                        return secs.some((s) => (classSectionStudents.get(`${cls.id}-${s.id}`) || []).some(matchesFilter));
                      });
                  const hiddenCount = baseClasses.length - classesToRender.length;
                  return (
                    <>
                      {hasStudentFilter && (
                        <div className="sl-school-toggle">
                          <span>
                            {showWholeSchool
                              ? <>Showing all {baseClasses.length} classes (whole school view)</>
                              : <>Showing only classes with matching students{hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ""}</>}
                          </span>
                          <button type="button" className="sl-school-toggle-btn" onClick={() => setShowWholeSchool((v) => !v)}>
                            {showWholeSchool ? "Hide empty classes" : "View whole school"}
                          </button>
                        </div>
                      )}
                      {classesToRender.length === 0 ? (
                        <div className="sl-empty">No classes have students matching the current filter.</div>
                      ) : classesToRender.map((cls) => {
                    const clsSections = classSectionsMap.get(cls.id) || [];
                    const isOpen = openClasses.has(cls.id);
                    const activeSec = activeSectionMap.get(cls.id);
                    const clsLabel = formatClassLabel(String(cls.name || cls.class_name || ""), cls.id);
                    const clsFullName = String((cls as { full_name?: string }).full_name || "");
                    const allClsStudents = clsSections.flatMap((s) => classSectionStudents.get(`${cls.id}-${s.id}`) || []);
                    const loadedStudentCount = allClsStudents.length;
                    const activeStudentCount = allClsStudents.filter((r) => r.is_active && !(r.is_deleted || r.status === "deleted")).length;
                    const docsPendingClsCount = allClsStudents.filter((r) => r.is_disabled).length;
                    const specialNeedsClsCount = allClsStudents.filter((r) => (r as { has_special_needs?: boolean }).has_special_needs).length;
                    const hasLoadedAny = clsSections.some((s) => classSectionStudents.has(`${cls.id}-${s.id}`));
                    const progressPct = loadedStudentCount > 0 ? Math.round((activeStudentCount / loadedStudentCount) * 100) : 0;
                    return (
                      <div key={cls.id} className={isOpen ? "sl-cls-acc open" : "sl-cls-acc"}>
                        <div className="sl-cls-hd" onClick={() => toggleClass(cls.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") toggleClass(cls.id); }}>
                          <svg
                            className={isOpen ? "sl-cls-chev open" : "sl-cls-chev"}
                            viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                            width="13" height="13" aria-hidden="true"
                          >
                            <path d="M6 4l4 4-4 4"/>
                          </svg>
                          <div className="sl-cls-name-wrap">
                            <span className="sl-cls-name">{clsLabel}</span>
                            {clsFullName && clsFullName !== clsLabel && <span className="sl-cls-full">{clsFullName}</span>}
                          </div>
                          <div className="sl-cls-badges">
                            <span className="sl-badge p-blue">{pluralize(loadedStudentCount, "student")}</span>
                            <span className="sl-badge p-green">{activeStudentCount} active</span>
                            <span className="sl-badge p-amber">{specialNeedsClsCount} special needs</span>
                            <span className="sl-badge p-red">{docsPendingClsCount} docs pending</span>
                            <span className="sl-badge p-gray">{pluralize(clsSections.length, "section")}</span>
                          </div>
                          {hasLoadedAny && loadedStudentCount > 0 && (
                            <div className="sl-cls-progress">
                              <div className="sl-cls-progress-bar">
                                <div className="sl-cls-progress-fill" style={{ width: `${progressPct}%` }} />
                              </div>
                              <span className="sl-cls-progress-pct">{progressPct}%</span>
                            </div>
                          )}
                        </div>

                        {isOpen && (
                          <div className="sl-cls-body">
                            {clsSections.length === 0 ? (
                              <div className="sl-sec-empty">No sections configured for this class.</div>
                            ) : (
                              <>
                                {/* Section tabs */}
                                <div className="sl-sec-tabs">
                                  {clsSections.map((sec) => {
                                    const secLabel = formatSectionLabel(String(sec.name || sec.section_name || ""), sec.id);
                                    const secKey = `${cls.id}-${sec.id}`;
                                    const secCount = classSectionStudents.get(secKey)?.length;
                                    return (
                                      <button
                                        key={sec.id}
                                        type="button"
                                        className={activeSec === sec.id ? "sl-stab active" : "sl-stab"}
                                        onClick={() => switchSection(cls.id, sec.id)}
                                      >
                                        {secLabel}
                                        {secCount !== undefined && (
                                          <span className="sl-stab-ct">{secCount}</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Section panes */}
                                {clsSections.map((sec) => {
                                  if (activeSec !== sec.id) return null;
                                  const secKey = `${cls.id}-${sec.id}`;
                                  const isLoadingSec = classSectionLoading.has(secKey);
                                  const rawSecStudents = classSectionStudents.get(secKey);
                                  // Always show ALL students in the section (active + inactive + archived)
                                  // so editing status doesn't make a row disappear from the list.
                                  const secStudents = rawSecStudents;
                                  const secLabel = formatSectionLabel(String(sec.name || sec.section_name || ""), sec.id);
                                  return (
                                    <div key={sec.id} className="sl-sec-pane">
                                      {isLoadingSec ? (
                                        <div className="sl-loading-row">Loading {clsLabel} — {secLabel}…</div>
                                      ) : !secStudents ? (
                                        <div className="sl-sec-empty">
                                          Click the section tab to load students.
                                        </div>
                                      ) : secStudents.length === 0 ? (
                                        <div className="sl-sec-empty">No matching students in {clsLabel} — {secLabel}</div>
                                      ) : (
                                        <>
                                          {(() => {
                                            const secStudentIds = secStudents.map((r) => r.id);
                                            const secSelectedIds = secStudentIds.filter((id) => selectedIds.includes(id));
                                            const allSecSelected = secStudentIds.length > 0 && secSelectedIds.length === secStudentIds.length;
                                            const someSecSelected = secSelectedIds.length > 0 && !allSecSelected;
                                            const toggleSecAll = () => {
                                              setSelectedIds((prev) => {
                                                if (allSecSelected) return prev.filter((id) => !secStudentIds.includes(id));
                                                const merged = new Set(prev);
                                                secStudentIds.forEach((id) => merged.add(id));
                                                return Array.from(merged);
                                              });
                                            };
                                            return (
                                              <>
                                                {/* Mini bulk bar — selection + count + export */}
                                                <div className="sl-sec-bar">
                                                  <label className="sl-sec-check">
                                                    <input
                                                      type="checkbox"
                                                      checked={allSecSelected}
                                                      ref={(el) => { if (el) el.indeterminate = someSecSelected; }}
                                                      onChange={toggleSecAll}
                                                      aria-label={`Select all students in ${clsLabel} ${secLabel}`}
                                                    />
                                                    <span className="sl-sec-count">
                                                      {secSelectedIds.length > 0 ? (
                                                        <><strong>{secSelectedIds.length}</strong> of {secStudents.length} selected</>
                                                      ) : (
                                                        <><strong>{secStudents.length}</strong> student{secStudents.length !== 1 ? "s" : ""} in {clsLabel} · {secLabel}</>
                                                      )}
                                                    </span>
                                                  </label>
                                                  <button
                                                    type="button"
                                                    className="sl-sec-export"
                                                    onClick={() => buildCsvAndDownload(secStudents, `${clsLabel}-${secLabel}`)}
                                                  >
                                                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12"><path d="M8 3v7M5 7l3 3 3-3M3 13h10"/></svg>
                                                    Export
                                                  </button>
                                                </div>

                                                {/* Bulk actions bar — appears when at least one student in this section is selected */}
                                                {secSelectedIds.length > 0 ? (() => {
                                                  const selectedRowsAll = students.filter((r) => selectedIds.includes(r.id));
                                                  const anyInactive = selectedRowsAll.some((r) => !r.is_active && !(r.is_deleted || r.status === "deleted"));
                                                  const anyActive = selectedRowsAll.some((r) => r.is_active && !(r.is_deleted || r.status === "deleted"));
                                                  return (
                                                  <div className="sl-sec-bulk">
                                                    <strong>{selectedIds.length} selected</strong>
                                                    <div className="sl-sec-bulk-actions">
                                                      {statusFilter === "archived" ? (
                                                        <button type="button" className="bulk-btn" title="Unarchive selected students" onClick={() => void handleBulkUnarchive()} disabled={bulkBusy}>Unarchive</button>
                                                      ) : (
                                                        <>
                                                          {anyInactive ? (
                                                            <button
                                                              type="button"
                                                              className="bulk-btn"
                                                              title="Activate selected students"
                                                              onClick={() => {
                                                                if (bulkBusy) return;
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
                                                              disabled={bulkBusy}
                                                            >Activate</button>
                                                          ) : null}
                                                          {anyActive ? (
                                                            <button
                                                              type="button"
                                                              className="bulk-btn"
                                                              title="Deactivate selected students"
                                                              onClick={() => {
                                                                if (bulkBusy) return;
                                                                const n = selectedIds.length;
                                                                openReasonModal({
                                                                  title: "Deactivate students",
                                                                  message: `You're about to deactivate ${n} selected student${n > 1 ? "s" : ""}. Pick a reason — they can be reactivated later.`,
                                                                  presets: DEACTIVATE_REASONS,
                                                                  confirmLabel: "Deactivate",
                                                                  variant: "danger",
                                                                  execute: async (reason) => { await handleBulkActiveState(false, reason); },
                                                                });
                                                              }}
                                                              disabled={bulkBusy}
                                                            >Deactivate</button>
                                                          ) : null}
                                                        </>
                                                      )}
                                                      <button type="button" className="bulk-btn" title="Message selected guardians (coming soon)" disabled>Message parents</button>
                                                      <button type="button" className="bulk-btn" title="Export selected students" onClick={handleExportSelected} disabled={bulkBusy}>Export selected</button>
                                                      {statusFilter !== "archived" ? (
                                                        <button
                                                          type="button"
                                                          className="bulk-btn danger"
                                                          title="Archive selected students"
                                                          onClick={() => {
                                                            if (bulkBusy) return;
                                                            const n = selectedIds.length;
                                                            openReasonModal({
                                                              title: "Archive students",
                                                              message: `Archiving will remove ${n} student${n > 1 ? "s" : ""} from default lists. Pick a reason for the audit log.`,
                                                              presets: ARCHIVE_REASONS,
                                                              confirmLabel: "Archive",
                                                              variant: "danger",
                                                              execute: async (reason) => { await handleBulkArchive(reason); },
                                                            });
                                                          }}
                                                          disabled={bulkBusy}
                                                        >Archive</button>
                                                      ) : null}
                                                      <button type="button" className="bulk-btn" onClick={() => setSelectedIds([])} title="Clear selection" disabled={bulkBusy}>Clear</button>
                                                    </div>
                                                  </div>
                                                  );
                                                })() : null}
                                              </>
                                            );
                                          })()}

                                          {/* Table */}
                                          <div className="table-wrap">
                                            <table>
                                              <thead>
                                                <tr>
                                                  <th style={{ width: 36 }}>
                                                    <span className="sr-only">Select</span>
                                                  </th>
                                                  <th>Student</th>
                                                  <th>Admission No</th>
                                                  <th>Guardian</th>
                                                  <th>DOB</th>
                                                  <th>Roll No</th>
                                                  <th>Status</th>
                                                  <th style={{ minWidth: 130, textAlign: "right" }}>Actions</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {secStudents.map((row) => {
                                                  const isRowSelected = selectedIds.includes(row.id);
                                                  const isArchived = row.is_deleted || row.status === "deleted";
                                                  const rowCls = [isRowSelected ? "row-selected" : "", isArchived ? "row-archived" : ""].filter(Boolean).join(" ") || undefined;
                                                  return (
                                                  <tr key={row.id} onClick={() => openViewDrawer(row)} style={{ cursor: "pointer" }} className={rowCls}>
                                                    <td onClick={(e) => e.stopPropagation()} style={{ width: 36 }}>
                                                      <input
                                                        type="checkbox"
                                                        checked={isRowSelected}
                                                        onChange={() => {
                                                          setSelectedIds((prev) => prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id]);
                                                        }}
                                                        aria-label={`Select ${fullName(row)}`}
                                                      />
                                                    </td>
                                                    <td>
                                                      <div className="student-cell">
                                                        <div className="avatar">{fullName(row).slice(0, 2).toUpperCase()}</div>
                                                        <div>
                                                          <p className="primary">{fullName(row)}</p>
                                                          <p className="secondary">{row.gender ? row.gender.charAt(0).toUpperCase() + row.gender.slice(1) : "-"} · Roll {row.roll_no || "-"}</p>
                                                        </div>
                                                      </div>
                                                    </td>
                                                    <td>{row.admission_no || "-"}</td>
                                                    <td>
                                                      <p className="primary">{resolveGuardianName(row)}</p>
                                                      <p className="secondary">{resolveGuardianPhone(row)}</p>
                                                    </td>
                                                    <td>
                                                      <p className="primary">{formatDate(row.date_of_birth)}</p>
                                                      <p className="secondary">{formatAgeFromDob(row.date_of_birth)}</p>
                                                    </td>
                                                    <td>{row.roll_no || "-"}</td>
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                      <button
                                                        type="button"
                                                        className={row.is_deleted || row.status === "deleted" ? "status archived" : row.is_active && !row.is_disabled ? "status active" : row.is_disabled ? "status pending" : "status inactive"}
                                                        onClick={() => openViewDrawer(row)}
                                                      >
                                                        {row.is_deleted || row.status === "deleted" ? "Archived" : row.is_active ? (row.is_disabled ? "Docs pending" : "Active") : "Inactive"}
                                                      </button>
                                                    </td>
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                      <div className="row-actions">
                                                        <button type="button" className="icon-action icon-view" title="View student profile" onClick={() => openViewDrawer(row)}>
                                                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><circle cx="8" cy="6" r="3"/><path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5"/></svg>
                                                        </button>
                                                        <Link href={`/students/add?mode=edit&id=${row.id}`} className="icon-action icon-edit" title="Edit student">
                                                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><path d="M11 2l3 3-8 8H3v-3L11 2z"/></svg>
                                                        </Link>
                                                        <button type="button" className="icon-action icon-msg" title="Message parent" onClick={(e) => e.stopPropagation()} disabled>
                                                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><path d="M14 3H2a1 1 0 00-1 1v7a1 1 0 001 1h5l2 2 2-2h3a1 1 0 001-1V4a1 1 0 00-1-1z"/></svg>
                                                        </button>
                                                        {!(row.is_deleted || row.status === "deleted") && (
                                                          <button type="button" className="icon-action icon-archive" title="Archive student" onClick={(e) => {
                                                            e.stopPropagation();
                                                            openReasonModal({
                                                              title: `Archive ${fullName(row)}`,
                                                              message: "Archiving removes this student from default lists. Pick a reason for the audit log.",
                                                              presets: ARCHIVE_REASONS,
                                                              confirmLabel: "Archive",
                                                              variant: "danger",
                                                              execute: async (reason) => { await archiveStudent(row.id, reason); },
                                                            });
                                                          }}>
                                                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><rect x="1" y="3" width="14" height="3" rx="1"/><path d="M2 6v7a1 1 0 001 1h10a1 1 0 001-1V6M6 9h4"/></svg>
                                                          </button>
                                                        )}
                                                      </div>
                                                    </td>
                                                  </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>

                                          {/* Table footer */}
                                          <div className="sl-tbl-foot">
                                            <span>{pluralize(secStudents.length, "student")} in {secLabel}</span>
                                            <Link href="/students/add" className="sl-add-link">+ Add student</Link>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

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
              <button type="button" className={drawerTab === "profile" ? "tab active" : "tab"} onClick={() => setDrawerTab("profile")}>Profile</button>
              <button type="button" className={drawerTab === "academic" ? "tab active" : "tab"} onClick={() => setDrawerTab("academic")}>Academic</button>
              <button type="button" className={drawerTab === "attendance" ? "tab active" : "tab"} onClick={() => setDrawerTab("attendance")}>Attendance</button>
              <button type="button" className={drawerTab === "fees" ? "tab active" : "tab"} onClick={() => setDrawerTab("fees")}>Fees</button>
            </div>

            <div className="drawer-body">
              {viewLoading ? (
                <p className="drawer-note">Loading student profile...</p>
              ) : viewError ? (
                <p className="drawer-error">{viewError}</p>
              ) : !viewStudent ? (
                <p className="drawer-note">No profile data available.</p>
              ) : (
                <>
              {drawerTab === "profile" && (
                <>
                  <div className="drawer-section">
                    <p className="drawer-section-title">Identity</p>
                    <div className="drawer-row"><span>Admission no</span><strong>{viewStudent?.admission_no || "-"}</strong></div>
                    <div className="drawer-row"><span>Date of birth</span><strong>{formatDate(viewStudent?.date_of_birth)}</strong></div>
                    <div className="drawer-row"><span>Gender</span><strong>{viewStudent?.gender ? viewStudent.gender.charAt(0).toUpperCase() + viewStudent.gender.slice(1) : "-"}</strong></div>
                    <div className="drawer-row">
                      <span>Status</span>
                      <span className={
                        viewStudent?.is_deleted || viewStudent?.status === "deleted" ? "status archived" :
                        viewStudent?.is_active && !viewStudent?.is_disabled ? "status active" :
                        viewStudent?.is_disabled ? "status pending" : "status inactive"
                      }>
                        {viewStudent?.is_deleted || viewStudent?.status === "deleted" ? "Archived" :
                         viewStudent?.is_active ? (viewStudent?.is_disabled ? "Docs pending" : "Active") : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="drawer-section">
                    <p className="drawer-section-title">Contact</p>
                    <div className="drawer-row"><span>Guardian</span><strong>{viewStudent ? resolveGuardianName(viewStudent) : "-"}</strong></div>
                    <div className="drawer-row"><span>Phone</span><strong>{viewStudent ? resolveGuardianPhone(viewStudent) : "-"}</strong></div>
                    <div className="drawer-row"><span>Email</span><strong>{viewStudent?.email || "-"}</strong></div>
                    <div className="drawer-row"><span>Address</span><strong>{[viewStudent?.address_line, viewStudent?.city, viewStudent?.district, viewStudent?.state, viewStudent?.pincode].filter(Boolean).join(", ") || "-"}</strong></div>
                  </div>
                </>
              )}

              {drawerTab === "academic" && (
                <div className="drawer-section">
                  <p className="drawer-section-title">Academic</p>
                  <div className="drawer-row"><span>Class &amp; Section</span><strong>{viewStudent?.current_class ? classMap.get(viewStudent.current_class) || viewStudent.current_class : "-"} / {viewStudent?.current_section ? sectionMap.get(viewStudent.current_section) || viewStudent.current_section : "-"}</strong></div>
                  <div className="drawer-row"><span>Roll no</span><strong>{viewStudent?.roll_no || "-"}</strong></div>
                  <div className="drawer-row"><span>Academic year</span><strong>{viewStudent?.academic_year_name || "2026–27"}</strong></div>
                  <div className="drawer-row"><span>Admission type</span><strong>{viewStudent?.admission_type || "New admission"}</strong></div>
                </div>
              )}

              {drawerTab === "attendance" && (
                <div className="drawer-section">
                  <p className="drawer-section-title">Recent attendance</p>
                  {drawerAttendanceLoading ? (
                    <p className="drawer-note">Loading attendance…</p>
                  ) : drawerAttendanceError ? (
                    <p className="drawer-error">{drawerAttendanceError}</p>
                  ) : drawerAttendance.length === 0 ? (
                    <p className="drawer-note">No attendance records found for this student.</p>
                  ) : (
                    <>
                      {(() => {
                        const total = drawerAttendance.length;
                        const present = drawerAttendance.filter((a) => (a.status || "").toLowerCase() === "present").length;
                        const absent = drawerAttendance.filter((a) => (a.status || "").toLowerCase() === "absent").length;
                        const late = drawerAttendance.filter((a) => (a.status || "").toLowerCase() === "late").length;
                        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
                        return (
                          <div className="drawer-row">
                            <span>Summary</span>
                            <strong>{present}/{total} present ({pct}%) · {absent} absent · {late} late</strong>
                          </div>
                        );
                      })()}
                      <div style={{ maxHeight: 240, overflowY: "auto", marginTop: 8 }}>
                        {drawerAttendance.slice(0, 30).map((rec) => {
                          const st = (rec.status || "").toLowerCase();
                          const cls = st === "present" ? "status active" : st === "absent" ? "status inactive" : st === "late" ? "status pending" : "status archived";
                          return (
                            <div key={rec.id} className="drawer-row">
                              <span>{formatDate(rec.attendance_date)}</span>
                              <span className={cls}>{rec.status || "-"}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {drawerTab === "fees" && (
                <div className="drawer-section">
                  <p className="drawer-section-title">Fees</p>
                  <p className="drawer-note">Fee module integration is coming soon.</p>
                </div>
              )}
                </>
              )}
            </div>

            <div className="drawer-footer">
              <button type="button" className="outline-btn drawer-msg-btn" disabled title="Message parent (coming soon)">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13" style={{marginRight:5}}><path d="M14 3H2a1 1 0 00-1 1v7a1 1 0 001 1h5l2 2 2-2h3a1 1 0 001-1V4a1 1 0 00-1-1z"/></svg>
                Message parent
              </button>
              <button
                type="button"
                className={viewStudent?.is_active ? "outline-btn" : "solid-btn"}
                onClick={() => {
                  if (!viewStudent) return;
                  const willDeactivate = viewStudent.is_active;
                  if (willDeactivate) {
                    openReasonModal({
                      title: `Deactivate ${fullName(viewStudent)}`,
                      message: "Pick a reason for deactivating this student. They can be reactivated later.",
                      presets: DEACTIVATE_REASONS,
                      confirmLabel: "Deactivate",
                      variant: "danger",
                      execute: async (reason) => { await toggleStudentStatus(reason); },
                    });
                  } else {
                    setPendingConfirm({
                      title: "Confirm Activation",
                      message: "Are you sure you want to activate this student?",
                      details: "The student will be marked active and visible in default lists.",
                      confirmLabel: "Activate",
                      variant: "primary",
                      execute: async () => { await toggleStudentStatus(); },
                    });
                  }
                }}
                disabled={viewTogglingStatus}
                title={viewStudent?.is_active ? "Deactivate this student" : "Activate this student"}
              >
                {viewTogglingStatus ? "Updating..." : viewStudent?.is_active ? "Deactivate" : "Activate"}
              </button>
              <Link
                href={viewStudentId ? `/students/add?mode=edit&id=${viewStudentId}` : "/students/add"}
                className="solid-btn drawer-edit-btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  height: 36,
                  padding: "0 16px",
                  borderRadius: 10,
                  background: "#4f39f6",
                  border: "1px solid #4f39f6",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  boxShadow: "0 8px 16px rgba(79, 57, 246, 0.18)",
                  whiteSpace: "nowrap",
                }}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M11 2l3 3-8 8H3v-3L11 2z"/></svg>
                Edit profile
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

      {pendingReason !== null && (
        <div className="reason-overlay" role="dialog" aria-modal="true" onClick={() => { if (!reasonBusy) setPendingReason(null); }}>
          <div className="reason-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="reason-head">
              <h3>{pendingReason.title}</h3>
              <button type="button" className="reason-x" aria-label="Close" disabled={reasonBusy} onClick={() => setPendingReason(null)}>×</button>
            </div>
            <p className="reason-msg">{pendingReason.message}</p>
            <div className="reason-chips">
              {pendingReason.presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="reason-chip"
                  data-active={reasonPick === p}
                  onClick={() => setReasonPick(p)}
                  disabled={reasonBusy}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="reason-textarea-row">
              <textarea
                className="reason-textarea"
                placeholder="Add an optional note for the audit log…"
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                rows={3}
                disabled={reasonBusy}
              />
              <button type="button" className="reason-ai-btn" onClick={aiHelpReason} disabled={reasonBusy} title="Draft a suggested note based on the selected reason">
                ✨ Draft with AI
              </button>
            </div>
            <div className="reason-footer">
              <button type="button" className="outline-btn" disabled={reasonBusy} onClick={() => setPendingReason(null)}>Cancel</button>
              <button
                type="button"
                className={pendingReason.variant === "danger" ? "danger-btn" : "solid-btn"}
                disabled={!finalReason.trim() || reasonBusy}
                onClick={() => void runPendingReason()}
                title={!finalReason.trim() ? "Pick or type a reason first" : undefined}
              >
                {reasonBusy ? "Saving…" : pendingReason.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

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
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          padding: 14px 24px;
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
        }

        h1 {
          margin: 0;
          font-size: 32px;
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: #0f172a;
          font-family: var(--font-playfair), Georgia, "Times New Roman", serif;
        }

        h1 em {
          color: #6c3ce1;
          font-family: var(--font-playfair), Georgia, "Times New Roman", serif;
          font-style: italic;
          font-weight: 400;
          font-size: 32px;
        }

        .page-head > div:first-child p {
          margin: 2px 0 0;
          font-size: 11px;
          color: #6B6A65;
        }

        .actions {
          display: flex;
          gap: 8px;
        }

        .btn {
          border-radius: 8px;
          padding: 7px 14px;
          font-size: 12px;
          text-decoration: none;
          border: 1px solid rgba(0, 0, 0, 0.12);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.12s;
          line-height: 1.4;
        }

        .btn-ghost {
          background: #fff;
          color: #181817;
        }
        .btn-ghost:hover {
          background: #F7F7F6;
        }

        .btn-primary {
          background: #5b4fcf;
          color: #fff;
          border-color: #5b4fcf;
        }
        .btn-primary:hover {
          background: #4a3fb8;
          border-color: #4a3fb8;
        }

        .enroll-btn {
          min-height: unset;
          padding: 7px 14px;
          font-weight: 500;
          border-radius: 8px;
          box-shadow: none;
          color: #fff;
        }

        .enroll-btn:hover {
          background: #4a3fb8;
          border-color: #4a3fb8;
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
          background: transparent;
        }

        .sl-panel + .sl-panel {
          margin-top: 14px;
        }

        .toolbar {
          display: none;
        }

        /* ── Smart Filter Panel ── */
        .sf-panel {
          border-bottom: 1px solid #ececf4;
          background: #fbfbff;
        }

        .sf-searchbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          flex-wrap: nowrap;
        }

        .sf-search-wrap {
          position: relative;
          flex: 1;
          min-width: 180px;
        }

        .sf-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #9a9db4;
          pointer-events: none;
          width: 13px;
          height: 13px;
        }

        .sf-search {
          width: 100%;
          height: 36px;
          border: 1px solid #dfe0eb;
          border-radius: 8px;
          padding: 0 12px 0 32px;
          background: #fff;
          font-size: 13px;
          color: #1a1d33;
          transition: border-color 0.15s;
        }

        .sf-search:focus {
          outline: none;
          border-color: #4f39f6;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(79, 57, 246, 0.08);
        }

        .sf-toggle {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0 12px;
          height: 36px;
          border: 1px solid #dfe0eb;
          border-radius: 8px;
          background: #fff;
          font-size: 12px;
          font-weight: 500;
          color: #42455d;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .sf-toggle:hover {
          background: #f4f4fb;
          border-color: #c8cbf2;
        }

        .sf-toggle.open {
          background: #f0eeff;
          border-color: #c8c1f8;
          color: #3d33b2;
        }

        .sf-toggle.has-filters {
          background: #f0eeff;
          border-color: #c8c1f8;
          color: #3d33b2;
        }

        .sf-chevron {
          transition: transform 0.2s;
        }

        .sf-toggle.open .sf-chevron {
          transform: rotate(180deg);
        }

        .sf-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 20px;
          background: #4f39f6;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
        }

        .sf-clear-all {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 0 10px;
          height: 30px;
          border: none;
          background: none;
          font-size: 11px;
          color: #9a9db4;
          cursor: pointer;
          white-space: nowrap;
          border-radius: 6px;
          transition: all 0.12s;
          flex-shrink: 0;
        }

        .sf-clear-all:hover {
          color: #b91c1c;
          background: #fef2f2;
        }

        .sf-body {
          border-top: 1px solid #ececf4;
          padding: 12px 14px 0;
          animation: sf-slide-in 0.15s ease;
        }

        @keyframes sf-slide-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .sf-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .sf-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #747896;
          padding-top: 6px;
          white-space: nowrap;
          min-width: 80px;
          flex-shrink: 0;
        }

        .sf-pills {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          flex: 1;
        }

        .sf-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 30px;
          padding: 0 10px;
          border-radius: 20px;
          border: 1px solid #e8e8f0;
          background: #f7f7fb;
          color: #4b4d64;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.12s;
          white-space: nowrap;
        }

        .sf-pill:hover {
          background: #f0eefd;
          border-color: #c8c1f8;
          color: #3d33b2;
        }

        .sf-pill.on {
          background: #4f39f6;
          border-color: #4f39f6;
          color: #fff;
        }

        .sf-pill.on span {
          background: rgba(255,255,255,0.2);
          color: #fff;
        }

        .sf-pill span {
          font-size: 10px;
          background: #ececf6;
          color: #3e4052;
          border-radius: 20px;
          padding: 1px 6px;
        }

        .sf-pill-info {
          font-size: 11px;
          color: #9a9db4;
          padding: 0 6px;
          border-left: 1px solid #e8e8f0;
          line-height: 30px;
        }

        .sf-pill-info strong {
          color: #4b4d64;
          font-weight: 600;
        }

        .sf-selects {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          flex: 1;
        }

        .sf-select {
          height: 32px;
          border: 1px solid #dfe0eb;
          border-radius: 7px;
          padding: 0 10px;
          background: #fff;
          font-size: 12px;
          color: #42455d;
          min-width: 130px;
          transition: border-color 0.15s;
        }

        .sf-select:focus {
          outline: none;
          border-color: #4f39f6;
        }

        .sf-select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sf-divider {
          height: 1px;
          background: #ececf4;
          margin: 2px 0 10px;
        }

        .sf-foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0 10px;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sf-count {
          font-size: 11px;
          color: #747896;
        }

        .sf-count strong {
          color: #1a1d33;
          font-weight: 600;
        }

        .sf-reset {
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid #dfe0eb;
          background: #fff;
          font-size: 11px;
          color: #6b6e8a;
          cursor: pointer;
          transition: all 0.12s;
        }

        .sf-reset:hover {
          background: #fef2f2;
          color: #b91c1c;
          border-color: #fecaca;
        }

        .sf-active-chips {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          padding: 6px 14px 8px;
          border-top: 1px solid #ececf4;
        }

        .sf-atag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 20px;
          background: #f0eeff;
          border: 1px solid #c8c1f8;
          color: #3d33b2;
          font-size: 11px;
          font-weight: 500;
        }

        .sf-atag button {
          border: none;
          background: none;
          color: #8b87cc;
          cursor: pointer;
          font-size: 10px;
          padding: 0;
          line-height: 1;
          margin-left: 2px;
          transition: color 0.1s;
        }

        .sf-atag button:hover {
          color: #b91c1c;
        }

        .sf-result-count {
          font-size: 11px;
          color: #9a9db4;
          margin-left: auto;
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
          min-width: 880px;
          table-layout: auto;
        }

        th,
        td {
          padding: 10px 10px;
          border-bottom: 1px solid #ebebf3;
          text-align: left;
          font-size: 12.5px;
          vertical-align: middle;
        }

        th:last-child,
        td:last-child {
          text-align: right;
          padding-right: 14px;
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
          gap: 6px;
          opacity: 1;
          pointer-events: auto;
        }

        tbody tr:hover .row-actions,
        .row-selected .row-actions {
          opacity: 1;
          pointer-events: auto;
        }

        .icon-action {
          position: relative;
          border: 1px solid #E5E7F0;
          background: #fff;
          color: #5b5f7a;
          text-decoration: none;
          font-size: 12px;
          font-weight: 600;
          border-radius: 7px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          padding: 0;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
        }

        /* Tooltip — uses native title attribute via ::after for nicer styling */
        .icon-action[title] {
          /* hide default browser title delay by suppressing it; show CSS tip */
        }

        .icon-action::after {
          content: attr(title);
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          background: #1f2330;
          color: #fff;
          font-size: 10.5px;
          font-weight: 500;
          padding: 4px 8px;
          border-radius: 4px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.12s;
          z-index: 50;
        }

        .icon-action:hover::after {
          opacity: 1;
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
          background: #f4f3ff;
        }

        .icon-action.icon-archive:hover {
          color: #dc2626;
          border-color: #fca5a5;
          background: #fff1f1;
        }

        .icon-action.icon-view:hover {
          color: #0891b2;
          border-color: #a5d8e8;
          background: #f0f9ff;
        }

        .icon-action.icon-msg:hover {
          color: #059669;
          border-color: #6ee7b7;
          background: #f0fdf4;
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
          cursor: pointer;
        }

        .outline-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .solid-btn {
          border: 1px solid #4f39f6;
          background: #4f39f6;
          color: #fff;
          font-weight: 600;
          box-shadow: 0 8px 16px rgba(79, 57, 246, 0.18);
          cursor: pointer;
        }

        .drawer-edit-btn {
          min-width: 120px;
          color: #fff !important;
          text-decoration: none;
          gap: 6px;
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          height: 36px;
          padding: 0 14px;
          font-weight: 600;
        }

        .drawer-edit-btn:hover {
          background: #422fe8;
          border-color: #422fe8;
          color: #fff !important;
          text-decoration: none;
        }

        .drawer-deactivate-btn {
          border-color: #fca5a5;
          color: #b91c1c;
        }

        .drawer-deactivate-btn:hover {
          background: #fff1f1;
          border-color: #f87171;
        }

        .drawer-activate-btn {
          border-color: #86efac;
          color: #15803d;
        }

        .drawer-activate-btn:hover {
          background: #f0fdf4;
          border-color: #4ade80;
        }

        .drawer-msg-btn {
          gap: 4px;
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

        /* ═══════════════════════════════════════════
           sl-* — Two-panel accordion layout
        ═══════════════════════════════════════════ */

        .sl-panel {
          border: 1px solid var(--line);
          border-radius: 14px;
          background: #fff;
          overflow: hidden;
        }

        .sl-panel:last-child {
          border-bottom: 1px solid var(--line);
        }

        /* Panel header */
        .sl-panel-hd {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 16px;
          cursor: pointer;
          user-select: none;
          transition: background 0.12s;
        }

        .sl-panel-hd:hover {
          background: #f8f8fc;
        }

        .sl-panel-hd:focus-visible {
          outline: 2px solid #4f39f6;
          outline-offset: -2px;
        }

        /* Numbered badge */
        .sl-panel-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #EEEDFE;
          color: #3C3489;
          font-size: 10px;
          font-weight: 700;
          flex-shrink: 0;
        }

        /* Panel icon */
        .sl-panel-icon {
          flex-shrink: 0;
          opacity: 0.8;
        }

        /* Title block */
        .sl-panel-title-block {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .sl-panel-title {
          font-size: 13px;
          font-weight: 600;
          color: #1a1d33;
          line-height: 1.2;
        }

        .sl-panel-desc {
          font-size: 11px;
          color: #8b8ea8;
          line-height: 1;
        }

        /* Active filter tag row */
        .sl-panel-tags {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
          margin-left: 4px;
        }

        /* Tag pill */
        .sl-atag {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
        }

        .sl-atag.p-purple {
          background: #f0eeff;
          border: 1px solid #c8c1f8;
          color: #3d33b2;
        }

        .sl-atag.p-blue {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
        }

        .sl-atag.p-amber {
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
        }

        .sl-atag.p-gray {
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          color: #374151;
        }

        .sl-atag-count {
          font-size: 11px;
          color: #9a9db4;
          white-space: nowrap;
          padding: 0 4px;
        }

        /* Chevron */
        .sl-chevron {
          transition: transform 0.2s;
          color: #9a9db4;
          flex-shrink: 0;
        }

        .sl-chevron.open {
          transform: rotate(180deg);
        }

        /* Panel body (expanded) */
        .sl-panel-body {
          border-top: 1px solid #ececf4;
          animation: sl-expand 0.15s ease;
        }

        @keyframes sl-expand {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Filter body */
        .sl-filter-body {
          padding: 14px 16px 0;
        }

        /* Row 1: search + selects */
        .sl-filter-row1 {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        /* Row 2: status pills */
        .sl-filter-row2 {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        /* Field group */
        .sl-fg {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sl-fg-search {
          flex: 0 0 220px;
          min-width: 200px;
        }

        .sl-fg-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #747896;
          white-space: nowrap;
        }

        /* Search input */
        .sl-search-wrap {
          position: relative;
        }

        .sl-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #9a9db4;
          pointer-events: none;
          width: 13px;
          height: 13px;
        }

        .sl-search {
          width: 100%;
          height: 36px;
          border: 1px solid #dfe0eb;
          border-radius: 8px;
          padding: 0 12px 0 32px;
          background: #fff;
          font-size: 13px;
          color: #1a1d33;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }

        .sl-search:focus {
          outline: none;
          border-color: #4f39f6;
          box-shadow: 0 0 0 3px rgba(79, 57, 246, 0.08);
        }

        /* Select */
        .sl-fsel {
          height: 36px;
          border: 1px solid #dfe0eb;
          border-radius: 8px;
          padding: 0 10px;
          background: #fff;
          font-size: 12px;
          color: #42455d;
          min-width: 140px;
          transition: border-color 0.15s;
          cursor: pointer;
        }

        .sl-fsel:focus {
          outline: none;
          border-color: #4f39f6;
        }

        .sl-fsel:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Status pills */
        .sl-pills {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }

        .sl-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 30px;
          padding: 0 10px;
          border-radius: 20px;
          border: 1px solid #e8e8f0;
          background: #f7f7fb;
          color: #4b4d64;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.12s;
          white-space: nowrap;
        }

        .sl-pill:hover {
          background: #f0eefd;
          border-color: #c8c1f8;
          color: #3d33b2;
        }

        .sl-pill.on {
          background: #4f39f6;
          border-color: #4f39f6;
          color: #fff;
        }

        .sl-pill.on span {
          background: rgba(255,255,255,0.2);
          color: #fff;
        }

        .sl-pill span {
          font-size: 10px;
          background: #ececf6;
          color: #3e4052;
          border-radius: 20px;
          padding: 1px 6px;
        }

        .sl-pill-sep {
          font-size: 11px;
          color: #9a9db4;
          padding: 0 6px;
          border-left: 1px solid #e8e8f0;
          line-height: 30px;
          white-space: nowrap;
        }

        .sl-pill-sep strong {
          color: #4b4d64;
          font-weight: 600;
        }

        /* Divider between filter rows */
        .sl-filter-divider {
          height: 1px;
          background: #ececf4;
          margin: 0 0 12px;
        }

        /* Filter footer */
        .sl-filter-foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px 12px;
          gap: 8px;
          flex-wrap: wrap;
          border-top: 1px solid #ececf4;
          background: #fafbff;
        }

        .sl-filter-foot-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sl-filter-count {
          font-size: 11px;
          color: #747896;
        }

        .sl-filter-count strong {
          color: #1a1d33;
          font-weight: 600;
        }

        .sl-reset-btn {
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid #dfe0eb;
          background: #fff;
          font-size: 11px;
          color: #6b6e8a;
          cursor: pointer;
          transition: all 0.12s;
        }

        .sl-reset-btn:hover {
          background: #fef2f2;
          color: #b91c1c;
          border-color: #fecaca;
        }

        /* Apply button */
        .sl-apply-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 34px;
          padding: 0 16px;
          border-radius: 8px;
          border: none;
          background: #4f39f6;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.12s;
          box-shadow: 0 4px 12px rgba(79, 57, 246, 0.25);
        }

        .sl-apply-btn:hover {
          background: #3d2ed6;
        }

        /* Pill count badge (e.g., "All 83") */
        .sl-pill-ct {
          display: inline-block;
          margin-left: 5px;
          padding: 1px 6px;
          background: rgba(0, 0, 0, 0.06);
          color: inherit;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 500;
          line-height: 1.4;
        }
        .sl-pill.on .sl-pill-ct {
          background: rgba(255, 255, 255, 0.22);
          color: #fff;
        }
        .sl-pill.on-amber {
          background: #FAEEDA;
          color: #633806;
          border-color: #EF9F27;
        }
        .sl-pill.on-amber .sl-pill-ct {
          background: rgba(99, 56, 6, 0.15);
          color: #633806;
        }

        /* Saved presets footer area */
        .sl-presets {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .sl-presets-label {
          font-size: 10px;
          color: #9a9db4;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-right: 2px;
        }
        .sl-ptag {
          padding: 3px 9px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
          border: 1px solid #dfe0eb;
          background: #fff;
          color: #6b6e8a;
          cursor: pointer;
          transition: all 0.12s;
          white-space: nowrap;
        }
        .sl-ptag:hover {
          background: #f3f4fb;
          color: #1a1d33;
        }
        .sl-ptag.saved {
          background: #EEEDFE;
          color: #3C3489;
          border-color: #AFA9EC;
        }
        .sl-ptag.saved:hover {
          background: #DEDBFE;
        }

        /* Class accordion: full-name and progress */
        .sl-cls-full {
          font-size: 11px;
          color: #747896;
          margin-left: 6px;
          font-weight: 400;
        }
        .sl-cls-progress {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          margin-left: 6px;
        }
        .sl-cls-progress-bar {
          width: 56px;
          height: 4px;
          background: #ececf4;
          border-radius: 4px;
          overflow: hidden;
        }
        .sl-cls-progress-fill {
          height: 100%;
          background: #4f39f6;
          transition: width 0.25s ease;
        }
        .sl-cls-progress-pct {
          font-size: 11px;
          color: #747896;
          min-width: 30px;
          text-align: right;
        }

        .sl-atag.p-green {
          background: #E1F5EE;
          color: #085041;
        }

        .sl-school-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 14px;
          margin: 0 0 10px;
          background: #F5F6FB;
          border: 1px solid #E5E7F0;
          border-radius: 8px;
          font-size: 12px;
          color: #4B4A45;
        }

        .sl-school-toggle-btn {
          appearance: none;
          background: #fff;
          border: 1px solid #D4D6E0;
          color: #5b4fcf;
          font-size: 11.5px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }

        .sl-school-toggle-btn:hover {
          background: #ECEEFE;
          border-color: #5b4fcf;
        }

        .sl-apply-cta {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 40px 16px;
          text-align: center;
          background: linear-gradient(180deg, #fafbff, #f3f4ff);
          border: 1px dashed #c7c4ee;
          border-radius: 12px;
          margin: 8px;
        }
        .sl-apply-cta-title {
          font-size: 14px;
          color: #1a1d33;
          margin: 6px 0 0;
        }
        .sl-apply-cta-title strong {
          color: #4f39f6;
        }
        .sl-apply-cta-sub {
          font-size: 12px;
          color: #747896;
          margin: 0 0 8px;
        }

        /* Bulk bar */
        .sl-bulk-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          background: #090b1f;
          color: #fff;
          padding: 10px 14px;
          flex-wrap: wrap;
        }

        .sl-bulk-bar strong {
          font-size: 13px;
        }

        .sl-bulk-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .sl-bulk-btn {
          border: 1px solid #252945;
          background: #1a1f38;
          color: #f8f8fe;
          border-radius: 8px;
          padding: 5px 11px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.12s;
        }

        .sl-bulk-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sl-bulk-btn.danger {
          border-color: #6f2437;
          background: #b01948;
        }

        /* Table card */
        .sl-table-card {
          overflow: hidden;
        }

        /* Loading / empty */
        .sl-loading-row,
        .sl-empty {
          min-height: 160px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #6b6b7b;
          font-size: 13px;
          padding: 20px;
          text-align: center;
        }

        .sl-empty p {
          margin: 0;
          color: #6b6b7b;
        }

        /* ── Browse by Class panel body ── */
        .sl-browse-body {
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          animation: sl-expand 0.15s ease;
        }

        /* Class accordion item */
        .sl-cls-acc {
          border: 1px solid #E6E8EE;
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        /* Class accordion header */
        .sl-cls-hd {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          cursor: pointer;
          user-select: none;
          background: #FBFCFE;
          border-bottom: 1px solid transparent;
          transition: background 0.12s, border-color 0.12s;
        }

        .sl-cls-hd:hover {
          background: #F4F8FB;
        }

        .sl-cls-acc.open {
          border-color: #D6E8DD;
          box-shadow: 0 4px 14px rgba(16, 132, 96, 0.06);
          border-left: 3px solid #16A37B;
        }

        .sl-cls-acc.open .sl-cls-hd {
          background: linear-gradient(180deg, #F1FAF5 0%, #FBFEFC 100%);
          border-bottom: 1px solid #E5EFE9;
        }

        .sl-cls-hd:focus-visible {
          outline: 2px solid #4f39f6;
          outline-offset: -2px;
        }

        /* Chevron for class */
        .sl-cls-chev {
          flex-shrink: 0;
          color: #b0b3cc;
          transition: transform 0.2s;
        }

        .sl-cls-chev.open {
          transform: rotate(90deg);
          color: #4f39f6;
        }

        .sl-cls-name-wrap {
          flex: 1;
          min-width: 0;
        }

        .sl-cls-name {
          font-size: 14px;
          font-weight: 600;
          color: #1a1d33;
          display: block;
        }

        .sl-cls-subtitle {
          font-size: 11px;
          color: #9a9db4;
          display: block;
          margin-top: 1px;
        }

        .sl-cls-badges {
          display: flex;
          gap: 5px;
          align-items: center;
          flex-wrap: wrap;
        }

        .sl-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          gap: 3px;
        }

        .sl-badge.p-blue {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .sl-badge.p-gray {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .sl-badge.p-green {
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .sl-badge.p-amber {
          background: #fffbeb;
          color: #92400e;
          border: 1px solid #fde68a;
        }

        .sl-badge.p-red {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        /* Class body (sections) */
        .sl-cls-body {
          border-top: 1px solid #f0f0f8;
          background: #fcfcff;
        }

        /* Section tabs */
        .sl-sec-tabs {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 0 14px;
          border-bottom: 1px solid var(--line);
          overflow-x: auto;
          background: #fafbff;
        }

        .sl-stab {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 9px 14px;
          border: none;
          border-bottom: 2px solid transparent;
          background: none;
          color: #6b6e8a;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.12s;
          margin-bottom: -1px;
        }

        .sl-stab:hover {
          color: #4f39f6;
        }

        .sl-stab.active {
          color: #4f39f6;
          border-bottom-color: #4f39f6;
          font-weight: 600;
        }

        .sl-stab-ct {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 4px;
          border-radius: 20px;
          background: #ece8ff;
          color: #4f39f6;
          font-size: 10px;
          font-weight: 700;
        }

        .sl-stab.active .sl-stab-ct {
          background: #4f39f6;
          color: #fff;
        }

        /* Section pane */
        .sl-sec-pane {
          padding: 10px 14px 6px;
        }

        .sl-sec-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          padding: 4px 0 10px;
        }

        .sl-sec-check {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .sl-sec-check input[type="checkbox"] {
          width: 14px;
          height: 14px;
          accent-color: #4f39f6;
          cursor: pointer;
        }

        .sl-sec-bulk {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          padding: 8px 10px;
          margin: 0 0 10px;
          background: linear-gradient(180deg, #f4f1ff 0%, #ecebff 100%);
          border: 1px solid #d6d2ff;
          border-radius: 10px;
          color: #2f2a5a;
          font-size: 12px;
        }

        .sl-sec-bulk strong {
          color: #4f39f6;
          font-weight: 700;
        }

        .sl-sec-bulk-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        tr.row-selected td {
          background: #f4f1ff !important;
        }

        tr.row-archived td {
          box-shadow: inset 0 2px 0 #f97316, inset 0 -2px 0 #f97316;
          background: #fff7ed !important;
        }
        tr.row-archived td:first-child {
          box-shadow: inset 2px 2px 0 #f97316, inset 0 -2px 0 #f97316;
        }
        tr.row-archived td:last-child {
          box-shadow: inset -2px 2px 0 #f97316, inset 0 -2px 0 #f97316;
        }

        /* Reason modal */
        .reason-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 16, 32, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1200;
          padding: 16px;
        }
        .reason-dialog {
          background: #fff;
          border-radius: 14px;
          width: 100%;
          max-width: 520px;
          padding: 20px 22px 18px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.25);
          font-family: var(--font-manrope), -apple-system, "Segoe UI", sans-serif;
        }
        .reason-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .reason-head h3 {
          margin: 0;
          font-size: 17px;
          color: #0b0b14;
          font-weight: 700;
        }
        .reason-x {
          background: transparent;
          border: 0;
          font-size: 24px;
          line-height: 1;
          color: #6f7287;
          cursor: pointer;
          padding: 0 4px;
        }
        .reason-msg {
          color: #555874;
          font-size: 13px;
          margin: 0 0 12px;
        }
        .reason-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 12px;
        }
        .reason-chip {
          padding: 6px 12px;
          border-radius: 20px;
          border: 1px solid #dfe0eb;
          background: #f8f8fc;
          font-size: 12px;
          color: #42455d;
          cursor: pointer;
          transition: all 0.12s;
        }
        .reason-chip:hover {
          border-color: #4f39f6;
          color: #4f39f6;
        }
        .reason-chip[data-active="true"] {
          background: #4f39f6;
          color: #fff;
          border-color: #4f39f6;
        }
        .reason-textarea-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 14px;
        }
        .reason-textarea {
          width: 100%;
          border: 1px solid #dfe0eb;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
          font-family: inherit;
          resize: vertical;
          min-height: 70px;
          color: #0b0b14;
        }
        .reason-textarea:focus {
          outline: none;
          border-color: #4f39f6;
          box-shadow: 0 0 0 3px rgba(79,57,246,0.15);
        }
        .reason-ai-btn {
          align-self: flex-end;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px dashed #4f39f6;
          background: #f4f1ff;
          color: #4f39f6;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .reason-ai-btn:hover {
          background: #ebe7ff;
        }
        .reason-ai-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .reason-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .reason-footer .danger-btn {
          background: #dc2626;
          color: #fff;
          border: 0;
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }
        .reason-footer .danger-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .reason-footer .solid-btn {
          background: #4f39f6;
          color: #fff;
          border: 0;
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }
        .reason-footer .outline-btn {
          background: #fff;
          color: #42455d;
          border: 1px solid #dfe0eb;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 13px;
          cursor: pointer;
        }

        .sl-sec-count {
          font-size: 12px;
          color: #6f7287;
        }

        .sl-sec-export {
          padding: 4px 10px;
          border-radius: 7px;
          border: 1px solid #dfe0eb;
          background: #fff;
          font-size: 11px;
          color: #42455d;
          cursor: pointer;
          transition: all 0.12s;
        }

        .sl-sec-export:hover {
          background: #f4f4fb;
          border-color: #c8cbf2;
          color: #4f39f6;
        }

        .sl-sec-empty {
          padding: 24px 14px;
          text-align: center;
          color: #9a9db4;
          font-size: 13px;
        }

        /* Section table footer */
        .sl-tbl-foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0 4px;
          font-size: 12px;
          color: #9a9db4;
          gap: 12px;
        }

        .sl-add-link {
          color: #4f39f6;
          text-decoration: none;
          font-weight: 600;
          font-size: 12px;
          transition: color 0.12s;
        }

        .sl-add-link:hover {
          color: #3d2ed6;
        }

        @media (max-width: 860px) {
          .sl-filter-row1 {
            flex-direction: column;
          }
          .sl-fg-search {
            min-width: 100%;
          }
          .sl-fsel {
            min-width: 100%;
          }
          .sl-panel-tags {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
