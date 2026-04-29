"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  LayoutGrid,
  Loader2,
  PencilLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { apiRequestWithRefresh, apiRequestWithRefreshResponse } from "@/lib/api-auth";
import { DeleteCategoryModal } from "./DeleteCategoryModal";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { ToastContainer, toast } from "react-toastify";

type StudentCategory = {
  id: number;
  name: string;
  description: string;
  code?: string | null;
  status: "active" | "inactive";
  students_count?: number;
  created_at?: string | null;
  updated_by?: string | null;
};

type EditedCategory = StudentCategory & {
  students_count?: number;
};

type CategorySummary = {
  success?: boolean;
  total_count: number;
  active_count: number;
  inactive_count: number;
  attention_count: number;
  top_total_students: number;
  top_categories: Array<{ id: number; name: string; students_count: number }>;
  recent_activity: Array<{ id: number; name: string; action: string; created_at: string }>;
};

type ApiError = Error & {
  details?: {
    message?: string;
    field_errors?: Record<string, string[] | string>;
    error_code?: string;
  };
};

type MutationResponse = {
  success?: boolean;
  message?: string;
  data?: StudentCategory;
  code?: string;
  details?: string;
  student_count?: number;
  suggested_action?: string;
};

type DeleteConflictResponse = MutationResponse & {
  code?: 'CATEGORY_IN_USE';
  student_count?: number;
  details?: string;
};

type CategoryDescriptionSuggestionResponse = {
  success?: boolean;
  suggestion?: string;
  source?: "ai" | "fallback";
  message?: string;
};

type PageResponse<T> = {
  count?: number;
  results?: T[];
};

const EMPTY_SUMMARY: CategorySummary = {
  total_count: 0,
  active_count: 0,
  inactive_count: 0,
  attention_count: 0,
  top_total_students: 0,
  top_categories: [],
  recent_activity: [],
};

function listData<T>(value: PageResponse<T> | T[]): T[] {
  return Array.isArray(value) ? value : value.results || [];
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

async function apiDelete<T>(path: string, payload?: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

function sanitizeText(value: string) {
  return value.replace(/<\s*script.*?>.*?<\s*\/\s*script\s*>/gis, "").trim();
}

function validateName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Category name is required";
  if (trimmed.length < 2) return "Category name must be at least 2 characters";
  if (trimmed.length > 100) return "Category name must not exceed 100 characters";
  if (!/^[A-Za-z0-9 ]+$/.test(trimmed)) return "Use letters, numbers, and spaces only";
  return "";
}

function validateDescription(value: string): string {
  if (value.trim().length > 500) return "Description must not exceed 500 characters";
  return "";
}

function formatRelativeDate(value?: string) {
  if (!value) return "";
  const now = Date.now();
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.floor((now - then) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function formatDateDisplay(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function errorMessage(err: unknown, fallback: string) {
  const apiError = err as ApiError;
  const details = apiError?.details;
  const firstField = details?.field_errors ? Object.values(details.field_errors)[0] : null;
  const fieldMessage = Array.isArray(firstField) ? String(firstField[0] || "") : String(firstField || "");
  return details?.message || fieldMessage || apiError?.message || fallback;
}

function barWidthClass(studentsCount: number, topMax: number) {
  const ratio = topMax > 0 ? studentsCount / topMax : 0;
  const normalized = Math.max(0.08, Math.min(1, ratio));
  const bucket = Math.max(1, Math.min(24, Math.ceil(normalized * 24)));
  return `bin-${bucket}`;
}

function barsTrackWidthPercent(categoryCount: number): number {
  if (categoryCount <= 2) return 44;
  if (categoryCount <= 4) return 56;
  if (categoryCount <= 6) return 66;
  if (categoryCount <= 8) return 76;
  return 88;
}

function barsTrackClass(categoryCount: number): string {
  if (categoryCount <= 2) return "track-44";
  if (categoryCount <= 4) return "track-56";
  if (categoryCount <= 6) return "track-66";
  if (categoryCount <= 8) return "track-76";
  return "track-88";
}

function generateDescriptionSuggestion(category: EditedCategory | null): string {
  if (!category) return "";
  const name = category.name.trim();
  const code = category.code?.trim();
  const studentsCount = Number(category.students_count || 0);
  const categoryLabel = name || "this category";
  const usageLine = studentsCount > 0 ? `It currently groups ${studentsCount} enrolled student${studentsCount === 1 ? "" : "s"}.` : "It can be used to group students consistently across the school workflow.";
  const codeLine = code ? ` Code: ${code}.` : "";
  return `Category for ${categoryLabel.toLowerCase()} used in admissions, fees, and reporting.${codeLine} ${usageLine}`.trim();
}

export function StudentCategoryManagerPanel() {
  const [rows, setRows] = useState<StudentCategory[]>([]);
  const [summary, setSummary] = useState<CategorySummary>(EMPTY_SUMMARY);
  const [loadingRows, setLoadingRows] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "attention">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25>(10);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<EditedCategory | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [statusValue, setStatusValue] = useState<"active" | "inactive">("active");
  const [description, setDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  const [codeDuplicateChecking, setCodeDuplicateChecking] = useState(false);
  const [aiSuggestionDismissed, setAiSuggestionDismissed] = useState(false);
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState(false);
  const [aiSuggestionText, setAiSuggestionText] = useState("");
  const [aiSuggestionSource, setAiSuggestionSource] = useState<"ai" | "fallback" | "">("");
  const [aiSuggestionError, setAiSuggestionError] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmIds, setConfirmIds] = useState<number[]>([]);
  const [confirmMode, setConfirmMode] = useState<"single" | "bulk">("single");

  const [openViewId, setOpenViewId] = useState<number | null>(null);
  const [statusDrawerId, setStatusDrawerId] = useState<number | null>(null);

  // Delete/Deactivate Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteModalMode, setDeleteModalMode] = useState<"safe-delete" | "conflict">("safe-delete");
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [deletingCategoryName, setDeletingCategoryName] = useState("");
  const [deletingCategoryStudentCount, setDeletingCategoryStudentCount] = useState(0);
  const [deleteConflictMessage, setDeleteConflictMessage] = useState("");
  const [deleteModalLoading, setDeleteModalLoading] = useState(false);
  const [deactivateModalLoading, setDeactivateModalLoading] = useState(false);

  // Confirmation modal for Activate / Deactivate actions.
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

  const successToast = (message: string) => toast.success(message);
  const errorToast = (message: string) => toast.error(message);
  const infoToast = (message: string) => toast.info(message);

  const reqId = useRef(0);
  const checkId = useRef(0);
  const viewPopoverRef = useRef<HTMLDivElement | null>(null);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount, pageSize]);
  const selectedAllOnPage = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const statusDrawerCategory = useMemo(() => rows.find((row) => row.id === statusDrawerId) || null, [rows, statusDrawerId]);

  const topMax = useMemo(() => Math.max(1, ...summary.top_categories.map((item) => Number(item.students_count || 0))), [summary.top_categories]);
  const topCategory = useMemo(() => summary.top_categories[0] || null, [summary.top_categories]);
  const aiDescriptionSuggestion = useMemo(() => generateDescriptionSuggestion(editingRow), [editingRow]);
  const barsTrackWidth = useMemo(() => barsTrackWidthPercent(summary.top_categories.length), [summary.top_categories.length]);
  const barsTrackClassName = useMemo(() => barsTrackClass(summary.top_categories.length), [summary.top_categories.length]);
  const totalStudents = useMemo(() => {
    const summaryTotal = Number(summary.top_total_students || 0);
    if (summaryTotal > 0) return summaryTotal;
    return rows.reduce((acc, row) => acc + Number(row.students_count || 0), 0);
  }, [summary.top_total_students, rows]);

  const canSubmit = useMemo(() => !validateName(name) && !validateDescription(description) && !saving, [name, description, saving]);

  const pushFeedback = (type: "success" | "error" | "info", message: string) => {
    if (!message) return;
    if (type === "success") {
      successToast(message);
      return;
    }
    if (type === "error") {
      errorToast(message);
      return;
    }
    infoToast(message);
  };

  const loadSummary = async (nextSearch = search) => {
    try {
      setLoadingSummary(true);
      const params = new URLSearchParams();
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      const data = await apiGet<CategorySummary>(`/api/v1/students/categories/summary/?${params.toString()}`);
      setSummary(data);
    } catch {
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadRows = async (nextPage = currentPage, nextSize = pageSize, nextSearch = search, nextStatus = statusFilter) => {
    const currentReq = ++reqId.current;
    try {
      setLoadingRows(true);

      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("page_size", String(nextSize));
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      if (nextStatus === "active" || nextStatus === "inactive") params.set("status", nextStatus);
      if (nextStatus === "attention") params.set("attention", "1");

      const response = await apiGet<PageResponse<StudentCategory>>(`/api/v1/students/categories/?${params.toString()}`);
      if (currentReq !== reqId.current) return;
      setRows(listData(response));
      setTotalCount(Number(response.count || 0));
      setSelectedIds([]);
    } catch {
      if (currentReq === reqId.current) {
        setRows([]);
        setTotalCount(0);
        pushFeedback("error", "Unable to load categories.");
      }
    } finally {
      if (currentReq === reqId.current) setLoadingRows(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void loadRows(currentPage, pageSize, search, statusFilter);
    void loadSummary(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, search, statusFilter]);

  useEffect(() => {
    if (!drawerOpen || !name.trim() || validateName(name)) return;

    const timer = window.setTimeout(async () => {
      const id = ++checkId.current;
      setDuplicateChecking(true);
      try {
        const params = new URLSearchParams();
        params.set("name", name.trim());
        if (editingId) params.set("exclude_id", String(editingId));
        const result = await apiGet<{ exists?: boolean }>(`/api/v1/students/categories/check-name/?${params.toString()}`);
        if (id !== checkId.current) return;
        if (result.exists) {
          setFieldErrors((prev) => ({ ...prev, name: "Category already exists" }));
        } else {
          setFieldErrors((prev) => {
            if (prev.name !== "Category already exists") return prev;
            const next = { ...prev };
            delete next.name;
            return next;
          });
        }
      } catch {
        // Ignore duplicate check failures.
      } finally {
        if (id === checkId.current) setDuplicateChecking(false);
      }
    }, 330);

    return () => window.clearTimeout(timer);
  }, [drawerOpen, editingId, name]);

  useEffect(() => {
    if (!drawerOpen || !code.trim() || code.trim().length > 30) return;

    const timer = window.setTimeout(async () => {
      const id = ++checkId.current;
      setCodeDuplicateChecking(true);
      try {
        const params = new URLSearchParams();
        params.set("code", code.trim());
        if (editingId) params.set("exclude_id", String(editingId));
        const result = await apiGet<{ exists?: boolean }>(`/api/v1/students/categories/check-code/?${params.toString()}`);
        if (id !== checkId.current) return;
        if (result.exists) {
          setFieldErrors((prev) => ({ ...prev, code: "Category code already exists" }));
        } else {
          setFieldErrors((prev) => {
            if (prev.code !== "Category code already exists") return prev;
            const next = { ...prev };
            delete next.code;
            return next;
          });
        }
      } catch {
        // Ignore duplicate check failures.
      } finally {
        if (id === checkId.current) setCodeDuplicateChecking(false);
      }
    }, 330);

    return () => window.clearTimeout(timer);
  }, [drawerOpen, editingId, code]);

  const resetForm = () => {
    setEditingId(null);
    setEditingRow(null);
    setName("");
    setCode("");
    setStatusValue("active");
    setDescription("");
    setFieldErrors({});
    setAiSuggestionDismissed(false);
    setAiSuggestionLoading(false);
    setAiSuggestionText("");
    setAiSuggestionSource("");
    setAiSuggestionError("");
  };

  const openCreateDrawer = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEditDrawer = (row: StudentCategory) => {
    setEditingId(row.id);
    setEditingRow(row);
    setName(row.name || "");
    setCode(row.code || "");
    setStatusValue(row.status || "active");
    setDescription(row.description || "");
    setFieldErrors({});
    setAiSuggestionDismissed(false);
    setAiSuggestionLoading(false);
    setAiSuggestionText("");
    setAiSuggestionSource("");
    setAiSuggestionError("");
    setDrawerOpen(true);
  };

  const requestAiDescriptionSuggestion = async (row: EditedCategory) => {
    try {
      setAiSuggestionLoading(true);
      setAiSuggestionError("");
      const response = await apiPost<CategoryDescriptionSuggestionResponse>(
        "/api/v1/students/categories/ai-description-suggestion/",
        {
          name: row.name,
          code: row.code || "",
          students_count: row.students_count || 0,
        },
      );

      const suggestion = (response?.suggestion || "").trim();
      if (!suggestion) {
        setAiSuggestionError("Suggestion is not available right now.");
        return;
      }

      setAiSuggestionText(suggestion);
      setAiSuggestionSource(response?.source || "fallback");
    } catch {
      setAiSuggestionError("Unable to load AI suggestion. Please try again.");
    } finally {
      setAiSuggestionLoading(false);
    }
  };

  useEffect(() => {
    if (!drawerOpen || !editingId || aiSuggestionDismissed) return;
    if (description.trim()) return;
    if (!editingRow) return;
    if (aiSuggestionLoading || aiSuggestionText) return;

    void requestAiDescriptionSuggestion(editingRow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, editingId, description, editingRow, aiSuggestionDismissed]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!openViewId) return;
      if (viewPopoverRef.current?.contains(event.target as Node)) return;
      setOpenViewId(null);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenViewId(null);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [openViewId]);

  useEffect(() => {
    if (statusDrawerId && !statusDrawerCategory) {
      setStatusDrawerId(null);
    }
  }, [statusDrawerId, statusDrawerCategory]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const errors: Record<string, string> = {
      name: validateName(name),
      description: validateDescription(description),
    };
    if (code.trim().length > 30) {
      errors.code = "Code must not exceed 30 characters";
    }
    if (!errors.code && fieldErrors.code === "Category code already exists") {
      errors.code = "Category code already exists";
    }
    if (errors.name || errors.description || errors.code) {
      setFieldErrors(errors);
      pushFeedback("error", "Please fix the highlighted fields.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: sanitizeText(name),
        code: sanitizeText(code),
        status: statusValue,
        description: sanitizeText(description),
      };

      const normalizedName = payload.name.trim().toLowerCase();
      const normalizedCode = payload.code.trim().toLowerCase();
      const existing = rows.find((row) => row.id !== editingId && row.name.trim().toLowerCase() === normalizedName);
      const existingCode = normalizedCode ? rows.find((row) => row.id !== editingId && (row.code || "").trim().toLowerCase() === normalizedCode) : undefined;

      if (existing) {
        setFieldErrors((prev) => ({ ...prev, name: "Category already exists" }));
        pushFeedback("error", "Category already exists.");
        return;
      }
      if (existingCode) {
        setFieldErrors((prev) => ({ ...prev, code: "Category code already exists" }));
        pushFeedback("error", "Category code already exists.");
        return;
      }

      const response = editingId
        ? await apiPatch<MutationResponse>(`/api/v1/students/categories/${editingId}/`, payload)
        : await apiPost<MutationResponse>("/api/v1/students/categories/", payload);

      pushFeedback("success", response?.message || (editingId ? "Category updated." : "Category created."));
      setDrawerOpen(false);
      resetForm();
      setCurrentPage(1);
      await loadRows(1, pageSize, search, statusFilter);
      await loadSummary(search);
    } catch (err) {
      pushFeedback("error", errorMessage(err, "Unable to save category."));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (row: StudentCategory, nextStatus: "active" | "inactive") => {
    if (row.status === nextStatus) {
      pushFeedback("info", `Category is already ${nextStatus} status.`);
      return;
    }
    try {
      setSaving(true);
      const response = await apiPatch<MutationResponse>(`/api/v1/students/categories/${row.id}/`, { status: nextStatus });
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, status: nextStatus } : item)));
      pushFeedback("success", response?.message || (nextStatus === "active" ? "Category activated." : "Category deactivated."));
      // Close the status drawer so the now-stale profile isn't left visible.
      setStatusDrawerId(null);
      await loadSummary(search);
    } catch (err) {
      pushFeedback("error", errorMessage(err, "Unable to change status."));
    } finally {
      setSaving(false);
    }
  };

  const bulkStatus = async (nextStatus: "active" | "inactive") => {
    if (!selectedIds.length) return;
    const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
    const rowsToUpdate = selectedRows.filter((row) => row.status !== nextStatus);
    const alreadyCount = selectedRows.length - rowsToUpdate.length;

    if (!rowsToUpdate.length) {
      pushFeedback("info", `Selected categories are already ${nextStatus} status.`);
      return;
    }

    try {
      setSaving(true);
      const response = await apiPatch<MutationResponse>("/api/v1/students/categories/bulk-status/", {
        ids: rowsToUpdate.map((row) => row.id),
        status: nextStatus,
      });
      setSelectedIds([]);
      await loadRows(currentPage, pageSize, search, statusFilter);
      await loadSummary(search);
      const baseMessage = response?.message || (nextStatus === "active" ? "Selected categories activated." : "Selected categories deactivated.");
      pushFeedback(
        "success",
        alreadyCount > 0
          ? `${baseMessage} ${alreadyCount} selected categor${alreadyCount === 1 ? "y was" : "ies were"} already ${nextStatus}.`
          : baseMessage
      );
    } catch (err) {
      pushFeedback("error", errorMessage(err, "Unable to update selected categories."));
    } finally {
      setSaving(false);
    }
  };

  const requestSingleDelete = (id: number) => {
    const category = rows.find((r) => r.id === id);
    if (!category) return;

    setDeletingCategoryId(id);
    setDeletingCategoryName(category.name);
    setDeletingCategoryStudentCount(Number(category.students_count || 0));
    setDeleteConflictMessage("");
    setDeleteModalMode("safe-delete");
    setDeleteModalOpen(true);
  };

  const handleDeactivate = async () => {
    if (!deletingCategoryId) return;

    setDeactivateModalLoading(true);
    try {
      await apiPatch<MutationResponse>(`/api/v1/students/categories/${deletingCategoryId}/deactivate/`, {});
      setDeleteModalOpen(false);
      successToast("Category deactivated successfully.");
      setSelectedIds([]);
      await loadRows(currentPage, pageSize, search, statusFilter);
      await loadSummary(search);
    } catch (err) {
      const apiErr = err as ApiError & { status?: number };
      const statusCode = Number((apiErr as { status?: number })?.status || 0);
      if (statusCode === 404) {
        errorToast("Category no longer exists.");
        return;
      }
      errorToast(errorMessage(err, "Something went wrong. Please try again later."));
    } finally {
      setDeactivateModalLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCategoryId || deleteModalMode !== "safe-delete") return;

    setDeleteModalLoading(true);
    try {
      await apiDelete<MutationResponse>(`/api/v1/students/categories/${deletingCategoryId}/`);
      setDeleteModalOpen(false);
      successToast("Category deleted successfully.");
      setSelectedIds([]);
      await loadRows(currentPage, pageSize, search, statusFilter);
      await loadSummary(search);
    } catch (err) {
      const apiErr = err as ApiError & { status?: number };
      const statusCode = Number((apiErr as { status?: number })?.status || 0);
      const details = (apiErr?.details || {}) as DeleteConflictResponse;

      if (statusCode === 409) {
        const count = Number(details?.student_count ?? 0);
        const conflictMessage =
          details?.message ||
          details?.details ||
          `This category is currently assigned to ${count} ${count === 1 ? "student" : "students"}.`;
        setDeletingCategoryStudentCount(count);
        setDeleteConflictMessage(
          details?.details || `This category is currently assigned to ${count} ${count === 1 ? "student" : "students"}.`
        );
        errorToast(conflictMessage);
        setDeleteModalMode("conflict");
        setDeleteModalOpen(true);
        return;
      }

      if (statusCode === 404) {
        errorToast("Category no longer exists.");
        return;
      }

      errorToast(errorMessage(err, "Something went wrong. Please try again later."));
    } finally {
      setDeleteModalLoading(false);
    }
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeletingCategoryId(null);
    setDeletingCategoryName("");
    setDeletingCategoryStudentCount(0);
    setDeleteConflictMessage("");
    setDeleteModalMode("safe-delete");
  };

  const requestBulkDelete = () => {
    if (!selectedIds.length) return;
    setConfirmIds([...selectedIds]);
    setConfirmMode("bulk");
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!confirmIds.length) return;
    try {
      setSaving(true);
      if (confirmMode === "single") {
        const response = await apiDelete<MutationResponse>(`/api/v1/students/categories/${confirmIds[0]}/`);
        pushFeedback("success", response?.message || "Category deleted.");
      } else {
        const response = await apiDelete<MutationResponse>("/api/v1/students/categories/bulk-delete/", { ids: confirmIds });
        pushFeedback("success", response?.message || "Selected categories deleted.");
      }
      setConfirmOpen(false);
      setConfirmIds([]);
      setSelectedIds([]);
      await loadRows(currentPage, pageSize, search, statusFilter);
      await loadSummary(search);
    } catch (err) {
      pushFeedback("error", errorMessage(err, "Unable to delete category."));
    } finally {
      setSaving(false);
    }
  };

  const exportRows = async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter === "active" || statusFilter === "inactive") params.set("status", statusFilter);
      if (statusFilter === "attention") params.set("attention", "1");

      const response = await apiRequestWithRefreshResponse(`/api/v1/students/categories/export/?${params.toString()}`, {
        method: "GET",
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `student_categories_${Date.now()}.csv`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      pushFeedback("success", "Export completed successfully.");
    } catch {
      pushFeedback("error", "Unable to export categories.");
    }
  };

  const rankBySize = (row: StudentCategory) => {
    const ordered = [...rows].sort((a, b) => Number(b.students_count || 0) - Number(a.students_count || 0));
    const index = ordered.findIndex((item) => item.id === row.id);
    return index >= 0 ? `${index + 1} of ${ordered.length}` : `-`;
  };

  const shareOfTotal = (row: StudentCategory) => {
    if (!totalStudents) return "0.0%";
    return `${((Number(row.students_count || 0) / totalStudents) * 100).toFixed(1)}%`;
  };

  return (
    <div className="legacy-panel student-category-manager">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div className="crumbs">
            <Link href="/dashboard">Dashboard</Link>
            <span>/</span>
            <Link href="/students">Student Info</Link>
            <span>/</span>
            <span>Categories</span>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="head-row">
            <div>
              <h1>
                Student <span>Categories</span>
              </h1>
              <p>Classification tags used across admissions, fee rules, and reporting.</p>
            </div>
            <button type="button" className="btn-primary" onClick={openCreateDrawer}>
              <Plus size={16} strokeWidth={2} className="btn-icon" aria-hidden="true" />
              <span>New Category</span>
            </button>
          </div>

          <div className="summary-grid">
            <article className="summary-card">
              <div className="summary-head">
                <p className="label">Total Categories</p>
                <span className="summary-icon" aria-hidden="true">
                  <LayoutGrid size={14} strokeWidth={2} />
                </span>
              </div>
              <p className="value">{summary.total_count}</p>
              <p className="meta"><strong>{summary.active_count} active</strong> · {summary.attention_count} needs attention</p>
            </article>

            <article className="summary-card">
              <div className="summary-head">
                <p className="label">Students by Category</p>
                <span className="summary-icon" aria-hidden="true">
                  <BarChart3 size={14} strokeWidth={2} />
                </span>
              </div>
              <div className={`bars ${barsTrackClassName}`} data-bars-track={barsTrackWidth}>
                {summary.top_categories.length ? (
                  summary.top_categories.map((item, index) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`bar ${barWidthClass(Number(item.students_count || 0), topMax)} ${index === 0 ? "is-top" : ""}`}
                      data-tip={`${item.name} · ${item.students_count}`}
                      aria-label={`${item.name} ${item.students_count}`}
                    />
                  ))
                ) : (
                  <span className="empty-inline">No data</span>
                )}
              </div>
              <p className="meta">
                {topCategory ? (
                  <>
                    Top: <strong>{topCategory.name}</strong> · {topCategory.students_count} students
                  </>
                ) : (
                  <>Top total: {summary.top_total_students} students</>
                )}
              </p>
            </article>

            <article className="summary-card">
              <div className="summary-head">
                <p className="label">Recent Activity</p>
                <span className="summary-icon" aria-hidden="true">
                  <Clock3 size={14} strokeWidth={2} />
                </span>
              </div>
              <ul className="activity-list">
                {loadingSummary ? (
                  <li>Loading activity...</li>
                ) : summary.recent_activity.length ? (
                  summary.recent_activity.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <span className="dot" />
                      <div>
                        <p><strong>{item.name}</strong> {item.action}</p>
                        <small>{formatRelativeDate(item.created_at)}</small>
                      </div>
                    </li>
                  ))
                ) : (
                  <li>No recent updates</li>
                )}
              </ul>
            </article>
          </div>

          <div className="list-shell">
            <div className="filter-row">
              <div className="search-box">
                <Search size={14} strokeWidth={2} className="search-icon" aria-hidden="true" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search categories or codes..."
                  aria-label="Search categories"
                />
              </div>

              <div className="chip-row">
                <button type="button" className={statusFilter === "all" ? "chip active" : "chip"} onClick={() => { setStatusFilter("all"); setCurrentPage(1); }}>
                  All <span>{summary.total_count}</span>
                </button>
                <button type="button" className={statusFilter === "active" ? "chip active" : "chip"} onClick={() => { setStatusFilter("active"); setCurrentPage(1); }}>
                  Active <span>{summary.active_count}</span>
                </button>
                <button type="button" className={statusFilter === "inactive" ? "chip active" : "chip"} onClick={() => { setStatusFilter("inactive"); setCurrentPage(1); }}>
                  Inactive <span>{summary.inactive_count}</span>
                </button>
                <button type="button" className={statusFilter === "attention" ? "chip active" : "chip"} onClick={() => { setStatusFilter("attention"); setCurrentPage(1); }}>
                  <Sparkles size={14} strokeWidth={2} className="chip-icon" aria-hidden="true" />
                  AI flagged <span>{summary.attention_count}</span>
                </button>
              </div>

              <button type="button" className="btn-export" onClick={() => void exportRows()}>Export</button>
            </div>

            {selectedIds.length ? (
              <div className="bulk-strip">
                <span>{selectedIds.length} selected</span>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedIds.length || saving) return;
                      const n = selectedIds.length;
                      setPendingConfirm({
                        title: "Confirm Activation",
                        message: `Are you sure you want to activate ${n} selected categor${n === 1 ? "y" : "ies"}?`,
                        details: "Activated categories will be available for selection.",
                        confirmLabel: "Activate",
                        variant: "primary",
                        execute: async () => { await bulkStatus("active"); },
                      });
                    }}
                    disabled={saving}
                  >Activate</button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedIds.length || saving) return;
                      const n = selectedIds.length;
                      setPendingConfirm({
                        title: "Confirm Deactivation",
                        message: `Are you sure you want to deactivate ${n} selected categor${n === 1 ? "y" : "ies"}?`,
                        details: "This action can be reversed later by activating again.",
                        confirmLabel: "Deactivate",
                        variant: "danger",
                        execute: async () => { await bulkStatus("inactive"); },
                      });
                    }}
                    disabled={saving}
                  >Deactivate</button>
                  <button type="button" className="danger" onClick={requestBulkDelete} disabled={saving}>Delete</button>
                  <button type="button" className="ghost" onClick={() => setSelectedIds([])} disabled={saving}>Clear</button>
                </div>
              </div>
            ) : null}

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        title="Select all visible categories"
                        checked={selectedAllOnPage}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds((prev) => Array.from(new Set([...prev, ...rows.map((row) => row.id)])));
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => !rows.some((row) => row.id === id)));
                          }
                        }}
                      />
                    </th>
                    <th className="sortable">Category ↓</th>
                    <th>Code</th>
                    <th>Students</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!loadingRows && rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-row">No categories found.</td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const checked = selectedIds.includes(row.id);
                      return (
                        <tr key={row.id} className={checked ? "selected" : ""}>
                          <td>
                            <input
                              type="checkbox"
                              title={`Select ${row.name}`}
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIds((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
                                } else {
                                  setSelectedIds((prev) => prev.filter((id) => id !== row.id));
                                }
                              }}
                            />
                          </td>
                          <td><strong>{row.name}</strong></td>
                          <td>{row.code || "-"}</td>
                          <td>{row.students_count || 0}</td>
                          <td>
                            <button
                              type="button"
                              className={row.status === "active" ? "status status-interactive active" : "status status-interactive inactive"}
                              onClick={() => setStatusDrawerId(row.id)}
                              title={`Open ${row.name} details`}
                            >
                              {row.status === "active" ? "Active" : "Inactive"}
                            </button>
                          </td>
                          <td className="desc">{row.description || <span className="muted">No description</span>}</td>
                          <td className="action-cell">
                            <div className="actions-wrap" ref={openViewId === row.id ? viewPopoverRef : null}>
                            <div className="actions" aria-label={`Actions for ${row.name}`}>
                              <button
                                type="button"
                                className="action-btn view"
                                title="View"
                                aria-label={`View ${row.name}`}
                                onClick={() => setOpenViewId((prev) => (prev === row.id ? null : row.id))}
                              >
                                <Eye size={18} strokeWidth={2} />
                              </button>
                              <button type="button" className="action-btn edit" title="Edit" onClick={() => openEditDrawer(row)} aria-label={`Edit ${row.name}`}>
                                <PencilLine size={18} strokeWidth={2} />
                              </button>
                              <button type="button" className="action-btn delete" title="Delete" onClick={() => requestSingleDelete(row.id)} aria-label={`Delete ${row.name}`}>
                                <Trash2 size={18} strokeWidth={2} />
                              </button>
                            </div>
                              {openViewId === row.id ? (
                                <div className="view-popover" role="dialog" aria-label={`Summary for ${row.name}`}>
                                  <h5>Agentic Summary</h5>
                                  <small className="view-popover-sub">Quick operational insights</small>
                                  <div className="view-row"><span>Category</span><strong>{row.name}</strong></div>
                                  <div className="view-row"><span>Students enrolled</span><strong>{row.students_count || 0}</strong></div>
                                  <div className="view-row"><span>Share of total</span><strong>{shareOfTotal(row)}</strong></div>
                                  <div className="view-row"><span>Rank by size</span><strong>#{rankBySize(row)}</strong></div>
                                  <div className="view-row"><span>Used in modules</span><strong>Admissions, Fees, Reports</strong></div>
                                  <p>{Number(row.students_count || 0) > 50 ? "High usage. Avoid renaming as it impacts reports." : "Moderate usage. You can edit safely with review."}</p>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="footer-row">
              <p>
                Showing {rows.length ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount}
              </p>
              <div>
                <label>
                  Page size
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value) as 10 | 25); setCurrentPage(1); }} title="Page size">
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                  </select>
                </label>
                <button type="button" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage <= 1 || loadingRows}>Previous</button>
                <button type="button" onClick={() => setCurrentPage((prev) => Math.min(pageCount, prev + 1))} disabled={currentPage >= pageCount || loadingRows}>Next</button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {drawerOpen ? (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <aside className="drawer" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h3>{editingId ? "Edit" : "New"} <span>category</span></h3>
                <p>Create a classification tag</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)}>×</button>
            </header>

            <form onSubmit={handleSubmit} className="drawer-form" noValidate>
              <div className="form-group">
                <label htmlFor="category-name">Category name *</label>
                <input
                  id="category-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: validateName(e.target.value) }));
                  }}
                  maxLength={100}
                />
                <small>Letters, numbers and spaces.</small>
                {fieldErrors.name ? <p className="field-error">{fieldErrors.name}</p> : null}
                {duplicateChecking ? <p className="field-hint">Checking duplicates...</p> : null}
              </div>

              <div className="form-group">
                <label htmlFor="category-code">Short code</label>
                <input
                  id="category-code"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (fieldErrors.code) setFieldErrors((prev) => ({ ...prev, code: e.target.value.trim().length > 30 ? "Code must not exceed 30 characters" : "" }));
                  }}
                  maxLength={30}
                />
                <small>Used in reports.</small>
                {fieldErrors.code ? <p className="field-error">{fieldErrors.code}</p> : null}
                {codeDuplicateChecking ? <p className="field-hint">Checking code duplicates...</p> : null}
              </div>

              <div className="form-group">
                <label htmlFor="category-status-toggle">Status</label>
                <div className="status-control">
                  <button
                    id="category-status-toggle"
                    type="button"
                    aria-label={`Set category ${statusValue === "active" ? "inactive" : "active"}`}
                    className={`status-switch ${statusValue === "active" ? "on" : "off"}`}
                    onClick={() => setStatusValue((prev) => (prev === "active" ? "inactive" : "active"))}
                  >
                    <span className="status-thumb" />
                  </button>
                  <span className={`status-text ${statusValue}`}>
                    {statusValue === "active" ? <CheckCircle2 size={15} strokeWidth={2.2} /> : <XCircle size={15} strokeWidth={2.2} />}
                    {statusValue === "active" ? "Active" : "Inactive"}
                  </span>
                </div>
                <small>Toggle category availability for admissions and reports.</small>
              </div>

              <div className="form-group">
                <label htmlFor="category-description">Description</label>
                <textarea
                  id="category-description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (fieldErrors.description) setFieldErrors((prev) => ({ ...prev, description: validateDescription(e.target.value) }));
                  }}
                  maxLength={500}
                />
                <div className="description-meta">
                  <small>Visible on admission forms.</small>
                  <small>{description.length}/500</small>
                </div>
                {fieldErrors.description ? <p className="field-error">{fieldErrors.description}</p> : null}
                {editingId && !aiSuggestionDismissed && !description.trim() ? (
                  <div className="ai-card">
                    <div className="ai-card-header">
                      <span className="ai-badge">AI</span>
                      <strong>{aiSuggestionSource === "ai" ? "AI suggested description" : "Smart suggested description"}</strong>
                    </div>
                    {aiSuggestionLoading ? (
                      <p>Generating description...</p>
                    ) : aiSuggestionError ? (
                      <p>{aiSuggestionError}</p>
                    ) : (
                      <p>{aiSuggestionText || aiDescriptionSuggestion}</p>
                    )}
                    <div className="ai-actions">
                      <button
                        type="button"
                        className="btn-ai-apply"
                        onClick={() => setDescription((aiSuggestionText || aiDescriptionSuggestion).trim())}
                        disabled={aiSuggestionLoading || (!aiSuggestionText && !aiDescriptionSuggestion)}
                      >
                        Apply suggestion
                      </button>
                      <button
                        type="button"
                        className="btn-ai-retry"
                        onClick={() => editingRow && void requestAiDescriptionSuggestion(editingRow)}
                        disabled={aiSuggestionLoading}
                      >
                        Retry
                      </button>
                      <button type="button" className="btn-ai-dismiss" onClick={() => setAiSuggestionDismissed(true)}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <footer>
                {editingId ? (
                  <button type="button" className="btn-delete" onClick={() => requestSingleDelete(editingId)} disabled={saving}>Delete</button>
                ) : (
                  <span />
                )}
                <div className="form-buttons">
                  <button type="button" className="btn-cancel" onClick={() => setDrawerOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={!canSubmit || saving}>
                    {saving ? <Loader2 size={15} className="spin-icon" aria-hidden="true" /> : null}
                    <span>{saving ? "Saving..." : "Save changes"}</span>
                  </button>
                </div>
              </footer>
            </form>
          </aside>
        </div>
      ) : null}

      {confirmOpen ? (
        <div className="confirm-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="confirm-card" onClick={(event) => event.stopPropagation()}>
            <h4>Delete Category</h4>
            <p>{confirmMode === "single" ? "Are you sure you want to delete this category?" : `Are you sure you want to delete ${confirmIds.length} selected categories?`}</p>
            <div>
              <button type="button" className="btn-cancel" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button type="button" className="btn-confirm-delete" onClick={() => void confirmDelete()} disabled={saving}>Delete</button>
            </div>
          </div>
        </div>
      ) : null}

      <DeleteCategoryModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteConfirm}
        onDeactivate={handleDeactivate}
        categoryName={deletingCategoryName}
        studentCount={deletingCategoryStudentCount}
        mode={deleteModalMode}
        isLoading={deleteModalLoading}
        isDeactivating={deactivateModalLoading}
        conflictMessage={deleteConflictMessage}
      />

      {statusDrawerCategory ? (
        <div className="status-drawer-overlay" onClick={() => setStatusDrawerId(null)}>
          <aside className="status-drawer h-screen flex flex-col w-full md:w-[460px]" onClick={(event) => event.stopPropagation()}>
            <header className="status-drawer-head shrink-0 sticky top-0">
              <div className="status-drawer-title-wrap">
                <div className="status-drawer-title-row">
                  <h4>{statusDrawerCategory.name}</h4>
                  <span className={statusDrawerCategory.status === "active" ? "status-pill active" : "status-pill inactive"}>
                    {statusDrawerCategory.status === "active" ? "Active" : "Inactive"}
                  </span>
                </div>
                <p>Category profile</p>
              </div>
              <button type="button" onClick={() => setStatusDrawerId(null)} aria-label="Close category profile">×</button>
            </header>

            <div className="status-drawer-body flex-1 overflow-y-auto space-y-3 p-4">
              <section className="status-card border rounded-xl">
                <h5>Overview</h5>
                <div className="status-drawer-row"><span>Code</span><strong>{statusDrawerCategory.code || "-"}</strong></div>
                <div className="status-drawer-row"><span>Students</span><strong>{Number(statusDrawerCategory.students_count || 0)}</strong></div>
                <div className="status-drawer-row">
                  <span>Status</span>
                  <strong className={statusDrawerCategory.status === "active" ? "status-value active" : "status-value inactive"}>
                    {statusDrawerCategory.status === "active" ? "Active" : "Inactive"}
                  </strong>
                </div>
                <div className="status-drawer-row"><span>Created on</span><strong>{formatDateDisplay(statusDrawerCategory.created_at)}</strong></div>
                <div className="status-drawer-row"><span>Updated by</span><strong>{statusDrawerCategory.updated_by || "Admin"}</strong></div>
              </section>

              <section className="status-card border rounded-xl">
                <h5>Description</h5>
                <p className={statusDrawerCategory.description ? "description-text" : "description-text empty"}>
                  {statusDrawerCategory.description || "No description added yet."}
                </p>
              </section>

              <section className="status-card border rounded-xl">
                <h5>Usage Summary</h5>
                <div className="status-drawer-row"><span>Linked students</span><strong>{Number(statusDrawerCategory.students_count || 0)}</strong></div>
                <div className="status-drawer-row"><span>Used in admissions</span><strong>Yes</strong></div>
                <div className="status-drawer-row"><span>Available for selection</span><strong>{statusDrawerCategory.status === "active" ? "Yes" : "No"}</strong></div>
              </section>
            </div>

            <footer className="status-drawer-footer shrink-0 sticky bottom-0">
              <button
                type="button"
                className="status-footer-btn secondary"
                onClick={() => {
                  setStatusDrawerId(null);
                  openEditDrawer(statusDrawerCategory);
                }}
              >
                Edit profile
              </button>
              <button
                type="button"
                className="status-footer-btn primary"
                onClick={() => {
                  const willDeactivate = statusDrawerCategory.status === "active";
                  const nextStatus: "active" | "inactive" = willDeactivate ? "inactive" : "active";
                  const target = statusDrawerCategory;
                  setPendingConfirm({
                    title: willDeactivate ? "Confirm Deactivation" : "Confirm Activation",
                    message: willDeactivate
                      ? "Are you sure you want to deactivate this category?"
                      : "Are you sure you want to activate this category?",
                    details: willDeactivate
                      ? "This action can be reversed later by activating again."
                      : "The category will be available for selection again.",
                    confirmLabel: willDeactivate ? "Deactivate" : "Activate",
                    variant: willDeactivate ? "danger" : "primary",
                    execute: async () => { await updateStatus(target, nextStatus); },
                  });
                }}
                disabled={saving}
              >
                {statusDrawerCategory.status === "active" ? "Deactivate" : "Activate"}
              </button>
            </footer>
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

      <ToastContainer
        position="top-right"
        newestOnTop
        closeOnClick
        pauseOnHover
        style={{ zIndex: 3000 }}
      />

      <style jsx>{`
        .student-category-manager {
          padding-bottom: 20px;
          color: #111827;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
          --text-primary: #111827;
          --text-muted: #64748b;
          --brand-primary: #5b3df5;
          --brand-light: #f3eeff;
          --surface-border: #e5e7eb;
          --surface-bg: #ffffff;
        }
        .crumbs {
          display: flex;
          gap: 8px;
          color: var(--text-muted);
          font-size: 14px;
        }
        .crumbs a {
          color: var(--text-muted);
          text-decoration: none;
        }
        .head-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }
        .head-row h1 {
          margin: 0;
          font-size: 50px;
          line-height: 0.95;
          font-family: "Playfair Display", Georgia, serif;
          font-weight: 500;
        }
        .head-row h1 span {
          color: #5b3df5;
          font-family: "Playfair Display", Georgia, serif;
          font-style: italic;
          font-weight: 600;
        }
        .head-row p {
          margin: 10px 0 0;
          color: var(--text-muted);
          font-size: 15px;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .btn-primary {
          border: none;
          background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
          color: #fff;
          border-radius: 12px;
          padding: 11px 18px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          line-height: 1;
        }
        .btn-primary .btn-icon {
          flex: none;
          width: 16px;
          height: 16px;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .summary-card {
          background: var(--surface-bg);
          border: 1px solid var(--surface-border);
          border-radius: 14px;
          padding: 16px;
          min-height: 140px;
        }
        .summary-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .summary-icon {
          width: 30px;
          height: 30px;
          border-radius: 10px;
          background: var(--brand-light);
          color: var(--brand-primary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: none;
        }
        .label {
          margin: 0;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          font-weight: 700;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .value {
          margin: 14px 0 6px;
          font-size: 48px;
          line-height: 1;
          font-family: "Playfair Display", Georgia, serif;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.01em;
          font-weight: 500;
          color: var(--text-primary);
        }
        .meta {
          margin: 0;
          color: var(--text-muted);
          font-size: 13px;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .bars {
          display: flex;
          gap: 6px;
          margin: 14px 0 10px;
          height: 34px;
          align-items: flex-end;
          border-radius: 10px;
          background: #f2f1ff;
          padding: 4px;
          min-width: 220px;
          transition: width 180ms ease;
        }
        .bars.track-44 {
          width: 44%;
        }
        .bars.track-56 {
          width: 56%;
        }
        .bars.track-66 {
          width: 66%;
        }
        .bars.track-76 {
          width: 76%;
        }
        .bars.track-88 {
          width: 88%;
        }
        .bar {
          display: block;
          height: 100%;
          border: none;
          border-radius: 4px;
          background: #d6d0ff;
          min-width: 10px;
          position: relative;
          cursor: pointer;
          transition: all 140ms ease;
        }
        .bar.is-top,
        .bar:hover {
          background: #5b3df5;
        }
        .bar::after {
          content: attr(data-tip);
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          top: -28px;
          background: #0f172a;
          color: #fff;
          font-size: 10px;
          padding: 3px 6px;
          border-radius: 6px;
          opacity: 0;
          pointer-events: none;
          white-space: nowrap;
          transition: opacity 120ms ease;
        }
        .bar:hover::after {
          opacity: 1;
        }
        .bar.bin-1 { width: 8%; }
        .bar.bin-2 { width: 9%; }
        .bar.bin-3 { width: 12%; }
        .bar.bin-4 { width: 16%; }
        .bar.bin-5 { width: 20%; }
        .bar.bin-6 { width: 24%; }
        .bar.bin-7 { width: 28%; }
        .bar.bin-8 { width: 32%; }
        .bar.bin-9 { width: 36%; }
        .bar.bin-10 { width: 40%; }
        .bar.bin-11 { width: 44%; }
        .bar.bin-12 { width: 48%; }
        .bar.bin-13 { width: 52%; }
        .bar.bin-14 { width: 56%; }
        .bar.bin-15 { width: 60%; }
        .bar.bin-16 { width: 64%; }
        .bar.bin-17 { width: 68%; }
        .bar.bin-18 { width: 72%; }
        .bar.bin-19 { width: 76%; }
        .bar.bin-20 { width: 80%; }
        .bar.bin-21 { width: 84%; }
        .bar.bin-22 { width: 88%; }
        .bar.bin-23 { width: 94%; }
        .bar.bin-24 { width: 100%; }
        .empty-inline {
          color: #94a3b8;
          font-size: 12px;
        }
        .activity-list {
          list-style: none;
          margin: 14px 0 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .activity-list li {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          color: #334155;
          font-size: 13px;
        }
        .activity-list p {
          margin: 0;
        }
        .activity-list small {
          color: #94a3b8;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #4f46e5;
          margin-top: 6px;
          flex: none;
        }
        .list-shell {
          background: var(--surface-bg);
          border: 1px solid var(--surface-border);
          border-radius: 16px;
          overflow: hidden;
        }
        .filter-row {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) auto auto;
          gap: 10px;
          align-items: center;
          padding: 12px 14px;
          border-bottom: 1px solid var(--surface-border);
        }
        .search-box {
          border: 1px solid var(--surface-border);
          border-radius: 10px;
          min-height: 40px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 12px;
        }
        .search-icon {
          flex: none;
          color: var(--text-muted);
        }
        .search-box input {
          border: none;
          outline: none;
          width: 100%;
          font-size: 14px;
        }
        .chip-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .chip {
          border: 1px solid var(--surface-border);
          background: #f8fafc;
          color: #475569;
          border-radius: 10px;
          padding: 7px 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          line-height: 1;
        }
        .chip-icon {
          flex: none;
          color: #5b3df5;
        }
        .chip-dot {
          color: #4f46e5;
          font-weight: 800;
          line-height: 1;
          margin-right: -2px;
        }
        .chip span {
          background: #e2e8f0;
          color: #475569;
          border-radius: 999px;
          padding: 1px 6px;
          font-size: 11px;
        }
        .chip.active {
          background: var(--brand-light);
          border-color: #c4b5fd;
          color: #4338ca;
        }
        .chip.active span {
          background: #c7d2fe;
          color: #3730a3;
        }
        .btn-export {
          border: 1px solid #d1d5db;
          background: #fff;
          border-radius: 10px;
          padding: 9px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          color: #334155;
        }
        .bulk-strip {
          background: #020617;
          color: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
        }
        .bulk-strip div {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .bulk-strip button {
          border: 1px solid #374151;
          background: #111827;
          color: #fff;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .bulk-strip button.danger {
          background: #be123c;
          border-color: #be123c;
        }
        .bulk-strip button.ghost {
          background: #1f2937;
        }
        .table-wrap {
          overflow-x: auto;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
        }
        .table thead th {
          text-align: left;
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 12px 14px;
          border-bottom: 1px solid var(--surface-border);
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .table thead th.sortable {
          color: #5b3df5;
        }
        .table tbody td {
          padding: 14px;
          border-bottom: 1px solid var(--surface-border);
          vertical-align: top;
          font-size: 15px;
          color: var(--text-primary);
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .table tbody td strong {
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
          letter-spacing: 0.01em;
          font-weight: 700;
          color: #0f172a;
        }
        .table tbody td:nth-child(3),
        .table tbody td:nth-child(4) {
          font-family: "Roboto Mono", "Consolas", monospace;
          font-variant-numeric: tabular-nums;
          color: #1f2937;
        }
        .table tbody tr.selected td {
          background: #f5f3ff;
        }
        .table tbody tr.selected td:first-child {
          box-shadow: inset 3px 0 0 #4f46e5;
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
          transition: all 0.2s ease;
        }
        .status.status-interactive {
          cursor: pointer;
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
        .action-cell {
          text-align: center;
        }
        .actions-wrap {
          position: relative;
          display: flex;
          justify-content: center;
        }
        .actions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .actions .action-btn {
          border: 1px solid #e5e7eb;
          background: #fff;
          border-radius: 10px;
          width: 32px;
          height: 32px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #475569;
          transition: transform 160ms ease, background 160ms ease, color 160ms ease, border-color 160ms ease;
        }
        .actions .action-btn:hover {
          transform: translateY(-1px);
          background: #f1edff;
          color: #5b3df5;
          border-color: #ddd6fe;
        }
        .actions .action-btn svg {
          width: 18px;
          height: 18px;
        }
        .view-popover {
          position: absolute;
          right: 0;
          top: 36px;
          width: min(320px, 72vw);
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 15px;
          padding: 14px 14px 13px;
          box-shadow: 0 18px 38px rgba(15, 23, 42, 0.16);
          z-index: 10;
        }
        .view-popover h5 {
          margin: 0;
          color: #111827;
          font-size: 18px;
          font-weight: 500;
          line-height: 1.1;
          font-family: "Playfair Display", Georgia, serif;
        }
        .view-popover-sub {
          display: block;
          margin: 3px 0 10px;
          color: #64748b;
          font-size: 11px;
          letter-spacing: 0.02em;
        }
        .view-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 12px;
          color: #475569;
          padding: 5px 0;
          border-bottom: 1px dashed #e5e7eb;
        }
        .view-row:last-of-type {
          border-bottom: none;
        }
        .view-row strong {
          color: #0f172a;
          font-size: 12px;
          text-align: right;
          font-weight: 700;
        }
        .view-popover p {
          margin: 10px 0 0;
          color: #374151;
          font-size: 12px;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
          line-height: 1.45;
        }
        .status-drawer-overlay {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: var(--erp-sidebar-offset, 184px);
          background: rgba(2, 6, 23, 0.35);
          backdrop-filter: blur(2px);
          z-index: 1250;
          display: flex;
          justify-content: flex-end;
          animation: overlay-fade 180ms ease;
        }
        .status-drawer {
          width: 100%;
          max-width: 460px;
          height: 100vh;
          background: var(--surface-bg);
          border-left: 1px solid var(--surface-border);
          border-radius: 18px 0 0 18px;
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.2);
          display: flex;
          flex-direction: column;
          animation: drawer-slide-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .status-drawer-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
          padding: 16px 20px;
          border-bottom: 1px solid var(--surface-border);
          background: var(--surface-bg);
          z-index: 2;
        }
        .status-drawer-title-wrap {
          min-width: 0;
          display: grid;
          gap: 8px;
        }
        .status-drawer-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .status-drawer-head h4 {
          margin: 0;
          font-size: 30px;
          line-height: 1;
          font-family: "Playfair Display", Georgia, serif;
          font-weight: 500;
          color: #111827;
        }
        .status-drawer-head p {
          margin: 0;
          color: var(--text-muted);
          font-size: 13px;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .status-drawer-head button {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 999px;
          width: 34px;
          height: 34px;
          font-size: 20px;
          line-height: 1;
          color: #475569;
          cursor: pointer;
          flex: none;
        }
        .status-drawer-body {
          padding: 16px;
          overflow-y: auto;
          display: grid;
          gap: 12px;
          align-content: start;
        }
        .status-card {
          border: 1px solid var(--surface-border);
          border-radius: 12px;
          padding: 12px;
          background: var(--surface-bg);
        }
        .status-drawer-body h5 {
          margin: 0 0 10px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          font-weight: 700;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .status-drawer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 0;
          border-bottom: 1px dashed var(--surface-border);
          font-size: 14px;
          color: #475569;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .status-drawer-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .status-drawer-row span {
          font-size: 14px;
          color: #475569;
        }
        .status-drawer-row strong {
          color: #111827;
          font-size: 14px;
          font-weight: 600;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .status-value.active {
          color: #047857;
        }
        .status-value.inactive {
          color: #b91c1c;
        }
        .description-text {
          margin: 0;
          color: var(--text-muted);
          font-size: 14px;
          line-height: 1.45;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .description-text.empty {
          min-height: 28px;
          color: #94a3b8;
        }
        .status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 700;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .status-pill.active {
          color: #047857;
          background: #ecfdf3;
        }
        .status-pill.inactive {
          color: #b91c1c;
          background: #fef2f2;
        }
        .status-drawer-footer {
          border-top: 1px solid var(--surface-border);
          padding: 16px 20px;
          display: flex;
          justify-content: stretch;
          align-items: center;
          gap: 8px;
          background: var(--surface-bg);
          z-index: 2;
        }
        .status-footer-btn {
          height: 40px;
          border-radius: 10px;
          border: 1px solid transparent;
          font-size: 13px;
          font-weight: 700;
          padding: 0 14px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 128px;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
          flex: 1;
        }
        .status-footer-btn.secondary {
          background: #fff;
          color: #334155;
          border-color: #d1d5db;
        }
        .status-footer-btn.primary {
          background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
          color: #fff;
          border-color: #4338ca;
        }
        .status-footer-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        @media (max-width: 767px) {
          .status-drawer-overlay {
            left: 0;
          }
          .status-drawer {
            max-width: 100%;
            border-radius: 0;
          }
          .status-drawer-head,
          .status-drawer-footer {
            padding: 14px 16px;
          }
        }
        .empty-row {
          padding: 22px 10px !important;
          text-align: center;
          color: #64748b;
        }
        .footer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 13px;
        }
        .footer-row p {
          margin: 0;
        }
        .footer-row div {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .footer-row button,
        .footer-row select {
          border: 1px solid #d1d5db;
          background: #fff;
          border-radius: 10px;
          padding: 7px 10px;
          font-size: 12px;
          color: #334155;
        }
        .msg {
          margin: 12px 0 0;
          font-size: 13px;
        }
        .msg.error {
          color: #b91c1c;
        }
        .msg.success {
          color: #166534;
        }
        .msg.info {
          color: #475569;
        }
        .drawer-overlay {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: var(--erp-sidebar-offset, 184px);
          background: rgba(2, 6, 23, 0.3);
          backdrop-filter: blur(3px);
          z-index: 1200;
          display: flex;
          justify-content: flex-end;
          animation: overlay-fade 180ms ease;
        }
        .drawer {
          width: min(500px, 96vw);
          min-width: 460px;
          height: 100vh;
          margin: 0;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-right: none;
          border-radius: 18px 0 0 18px;
          display: grid;
          grid-template-rows: auto 1fr;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
          box-shadow: 0 28px 60px rgba(15, 23, 42, 0.22);
          overflow: hidden;
          animation: drawer-slide-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .drawer header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px 8px;
          border-bottom: 1px solid #e2e8f0;
          background: linear-gradient(180deg, #ffffff 0%, #fcfcff 100%);
          position: sticky;
          top: 0;
          z-index: 3;
        }
        .drawer header h3 {
          margin: 0;
          font-size: 38px;
          line-height: 0.92;
          font-family: "Playfair Display", Georgia, serif;
          font-weight: 500;
        }
        .drawer header h3 span {
          color: #5b3df5;
          font-family: "Playfair Display", Georgia, serif;
          font-style: italic;
          font-weight: 600;
        }
        .drawer header button {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 999px;
          width: 34px;
          height: 34px;
          font-size: 20px;
          color: #475569;
          cursor: pointer;
        }
        .drawer header p {
          margin: 2px 0 0;
          color: #94a3b8;
          font-size: 13px;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
          font-weight: 500;
        }
        .drawer-form {
          padding: 12px 14px 12px;
          overflow-y: auto;
          display: grid;
          gap: 12px;
        }
        .form-group {
          display: grid;
          gap: 6px;
        }
        .drawer-form label {
          font-size: 14px;
          color: #1e293b;
          font-weight: 700;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
          letter-spacing: 0.01em;
        }
        .drawer-form input,
        .drawer-form textarea {
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 0 12px;
          font-size: 14px;
          color: #0f172a;
          background: #fff;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
          min-height: 42px;
          transition: border-color 140ms ease, box-shadow 140ms ease;
        }
        .drawer-form input:focus,
        .drawer-form textarea:focus {
          outline: none;
          border-color: #7c6bff;
          box-shadow: 0 0 0 3px rgba(91, 61, 245, 0.14);
        }
        .drawer-form textarea {
          min-height: 94px;
          padding: 9px 12px;
          resize: vertical;
        }
        .drawer-form small {
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.25;
        }
        .field-error {
          margin: 0;
          color: #b91c1c;
          font-size: 12px;
        }
        .field-hint {
          margin: 0;
          color: #6366f1;
          font-size: 12px;
        }
        .status-control {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .status-switch {
          width: 52px;
          height: 30px;
          border-radius: 999px;
          border: 1px solid #d1d5db;
          padding: 3px;
          display: inline-flex;
          align-items: center;
          background: #e2e8f0;
          cursor: pointer;
          transition: all 180ms ease;
        }
        .status-switch .status-thumb {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: #fff;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18);
          transform: translateX(0);
          transition: transform 180ms ease;
        }
        .status-switch.on {
          border-color: #8f8bff;
          background: linear-gradient(135deg, #6f5dff 0%, #5b3df5 100%);
        }
        .status-switch.on .status-thumb {
          transform: translateX(22px);
        }
        .status-switch.off {
          background: #e2e8f0;
        }
        .status-text {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 700;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .status-text.active {
          color: #15803d;
        }
        .status-text.inactive {
          color: #b91c1c;
        }
        .description-meta {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-top: 2px;
        }
        .ai-card {
          margin-top: 2px;
          border: 1px solid #ddd6fe;
          background: linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%);
          border-radius: 12px;
          padding: 9px;
          box-shadow: 0 10px 24px rgba(79, 70, 229, 0.08);
        }
        .ai-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .ai-badge {
          width: 24px;
          height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #4f46e5;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
        }
        .ai-card p {
          margin: 0;
          color: #4338ca;
          font-size: 13px;
          line-height: 1.45;
        }
        .ai-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 6px;
        }
        .btn-ai-apply,
        .btn-ai-retry,
        .btn-ai-dismiss {
          border: none;
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-ai-apply {
          background: #4f46e5;
          color: #fff;
        }
        .btn-ai-dismiss {
          background: #ede9fe;
          color: #4338ca;
        }
        .btn-ai-retry {
          background: #e0e7ff;
          color: #3730a3;
        }
        .drawer-form footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #e2e8f0;
          padding-top: 8px;
          gap: 10px;
          margin-top: 0;
          position: sticky;
          bottom: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.92) 0%, #ffffff 100%);
          backdrop-filter: blur(8px);
        }
        .btn-delete,
        .btn-cancel,
        .btn-confirm-delete {
          border-radius: 12px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          min-height: 40px;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .btn-delete {
          border: 1px solid #fecdd3;
          background: #fff;
          color: #be123c;
        }
        .form-buttons {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .btn-cancel {
          border: 1px solid #d6deea;
          background: #e2e8f0;
          color: #0f172a;
        }
        .drawer-form .btn-primary {
          background: linear-gradient(135deg, #6a5aff 0%, #5b3df5 52%, #4b35d6 100%);
          min-height: 40px;
          border-radius: 12px;
          padding: 8px 14px;
          box-shadow: 0 10px 20px rgba(91, 61, 245, 0.24);
        }
        .drawer-form .btn-primary:disabled {
          opacity: 0.72;
          box-shadow: none;
          cursor: not-allowed;
        }
        .confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.42);
          z-index: 1300;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .confirm-card {
          width: min(420px, 100%);
          background: #fff;
          border: 1px solid #fecaca;
          border-radius: 14px;
          padding: 16px;
        }
        .confirm-card h4 {
          margin: 0 0 8px;
          color: #9f1239;
        }
        .confirm-card p {
          margin: 0 0 14px;
          color: #475569;
          font-size: 14px;
        }
        .confirm-card div {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .btn-confirm-delete {
          background: #be123c;
          color: #fff;
        }
        .spin-icon {
          animation: spin 0.8s linear infinite;
        }
        .actions .action-btn {
          opacity: 0;
          transform: translateY(2px) scale(0.96);
          pointer-events: none;
        }
        .table tbody tr:hover .actions .action-btn,
        .table tbody tr:focus-within .actions .action-btn {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }
        .actions .action-btn.view:hover {
          background: #f1edff;
          color: #5b3df5;
        }
        @media (max-width: 1100px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }
          .filter-row {
            grid-template-columns: 1fr;
          }
          .drawer-overlay {
            left: 0;
          }
        }
        @media (max-width: 760px) {
          .head-row {
            flex-direction: column;
            align-items: stretch;
          }
          .head-row h1 {
            font-size: 40px;
          }
          .bulk-strip,
          .footer-row {
            flex-direction: column;
            align-items: stretch;
          }
          .drawer header h3 {
            font-size: 34px;
          }
          .drawer {
            width: 100%;
            height: 100%;
            min-width: 0;
            max-height: none;
            margin: 0;
            border-radius: 0;
            border-left: none;
            border-right: none;
          }
          .drawer-overlay {
            left: 0;
          }
          .actions .action-btn {
            opacity: 1;
            pointer-events: auto;
          }
        }
        @keyframes drawer-slide-in {
          from {
            transform: translateX(100%);
            opacity: 0.98;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes overlay-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
