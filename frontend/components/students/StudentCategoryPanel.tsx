"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type StudentCategory = {
  id: number;
  name: string;
  description: string;
  code?: string | null;
  status: "active" | "inactive";
};

type ApiError = Error & {
  details?: {
    message?: string;
    field_errors?: Record<string, string[] | string>;
    error_code?: string;
  };
};

type CategoryMutationResponse = {
  success?: boolean;
  message?: string;
  data?: StudentCategory;
  field_errors?: Record<string, string[] | string>;
};

type PageResponse<T> = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
};

type CategoryDeleteResponse = {
  success?: boolean;
  message?: string;
  field_errors?: Record<string, string[] | string>;
};

type ConfirmDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  ids: number[];
  mode: "single-delete" | "bulk-delete";
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeText(value: string) {
  return value.replace(/<\s*script.*?>.*?<\s*\/\s*script\s*>/gis, "").trim();
}

function meaningfulText(value: string) {
  const stripped = value.replace(/\s+/g, "");
  return /[A-Za-z0-9]/.test(stripped) && !/^(.)\1+$/.test(stripped) && !/^[^A-Za-z0-9]+$/.test(stripped);
}

function validateCategoryName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Category Name is required";
  if (trimmed.length < 2) return "Category Name must be at least 2 characters";
  if (trimmed.length > 100) return "Category Name must not exceed 100 characters";
  if (!/^[A-Za-z0-9 ]+$/.test(trimmed)) return "Category Name may contain only letters, numbers, and spaces";
  if (!meaningfulText(trimmed)) return "Category Name must be meaningful";
  return "";
}

function validateDescription(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length > 500) return "Description must not exceed 500 characters";
  return "";
}

function ApiErrorMessage(error: unknown, fallback: string) {
  const err = error as ApiError;
  const details = err?.details;
  const firstField = details?.field_errors ? Object.values(details.field_errors)[0] : null;
  const fieldMessage = Array.isArray(firstField) ? String(firstField[0] || "") : String(firstField || "");
  return details?.message || fieldMessage || err?.message || fallback;
}

export function StudentCategoryPanel() {
  const [rows, setRows] = useState<StudentCategory[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [statusValue, setStatusValue] = useState<"active" | "inactive">("active");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingIds, setDeletingIds] = useState<number[]>([]);
  const [updatingStatusIds, setUpdatingStatusIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25>(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [isReady, setIsReady] = useState(false);

  const nameCheckId = useRef(0);
  const loadId = useRef(0);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [pageSize, totalCount]);
  const canSubmit = useMemo(() => {
    const nameError = validateCategoryName(name);
    const descriptionError = validateDescription(description);
    return !nameError && !descriptionError && !saving;
  }, [description, name, saving]);

  const load = async (nextPage = currentPage, nextSize = pageSize, nextSearch = search, nextStatus = statusFilter) => {
    const requestId = ++loadId.current;
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("page_size", String(nextSize));
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      if (nextStatus !== "all") params.set("status", nextStatus);

      const data = await apiGet<PageResponse<StudentCategory>>(`/api/v1/students/categories/?${params.toString()}`);
      if (requestId !== loadId.current) return;
      setRows(listData(data));
      setTotalCount(Number(data.count || 0));
      setSelectedIds([]);
      if (data.count !== undefined) {
        const safePage = Math.max(1, Math.min(nextPage, Math.max(1, Math.ceil(Number(data.count || 0) / nextSize))));
        if (safePage !== nextPage) setCurrentPage(safePage);
      }
    } catch {
      if (requestId === loadId.current) {
        setError("Unable to load student categories.");
      }
    } finally {
      if (requestId === loadId.current) setLoading(false);
      setIsReady(true);
    }
  };

  useEffect(() => {
    void load(currentPage, pageSize, search, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const validation = validateCategoryName(name);
      if (!validation && name.trim()) {
        const checkId = ++nameCheckId.current;
        setDuplicateChecking(true);
        try {
          const params = new URLSearchParams();
          params.set("name", name.trim());
          if (editingId) params.set("exclude_id", String(editingId));
          const response = await apiGet<{ success?: boolean; exists?: boolean }>(`/api/v1/students/categories/check-name/?${params.toString()}`);
          if (checkId !== nameCheckId.current) return;
          if (response.exists) {
            setFieldErrors((prev) => ({ ...prev, name: "Category already exists" }));
          } else {
            setFieldErrors((prev) => {
              const next = { ...prev };
              if (next.name === "Category already exists") delete next.name;
              return next;
            });
          }
        } catch {
          // Silently ignore duplicate-check failures; submit-time validation still protects the API.
        } finally {
          if (checkId === nameCheckId.current) setDuplicateChecking(false);
        }
      } else {
        setFieldErrors((prev) => {
          const next = { ...prev };
          if (next.name === "Category already exists") delete next.name;
          return next;
        });
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [editingId, name]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setCode("");
    setStatusValue("active");
    setFieldErrors({});
    setTouched({});
    setError("");
    setSuccess("");
  };

  const setToast = (message: string, isError = false) => {
    if (isError) {
      setError(message);
      setSuccess("");
    } else {
      setSuccess(message);
      setError("");
    }
    setToastMessage(message);
  };

  const applyApiFieldErrors = (apiError: ApiError, fallbackMessage: string) => {
    const details = apiError.details;
    const apiFieldErrors = details?.field_errors || {};
    const mapped: Record<string, string> = {};
    for (const [field, messages] of Object.entries(apiFieldErrors)) {
      mapped[field] = Array.isArray(messages) ? String(messages[0] || "") : String(messages || "");
    }
    setFieldErrors((prev) => ({ ...prev, ...mapped }));
    setToast(ApiErrorMessage(apiError, fallbackMessage), true);
  };

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "name") {
      const message = validateCategoryName(name);
      setFieldErrors((prev) => ({ ...prev, name: message }));
    }
    if (field === "description") {
      const message = validateDescription(description);
      setFieldErrors((prev) => ({ ...prev, description: message }));
    }
    if (field === "code" && code.trim().length > 30) {
      setFieldErrors((prev) => ({ ...prev, code: "Code must not exceed 30 characters" }));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {
      name: validateCategoryName(name),
      description: validateDescription(description),
    };

    if (code.trim().length > 30) {
      nextErrors.code = "Code must not exceed 30 characters";
    }

    if (nextErrors.name || nextErrors.description || nextErrors.code) {
      setFieldErrors(nextErrors);
      setTouched({ name: true, description: true, code: true });
      setToast("Please correct the highlighted errors.", true);
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const payload = {
        name: sanitizeText(name),
        description: sanitizeText(description),
        code: sanitizeText(code),
        status: statusValue,
      };

      if (editingId) {
        const response = await apiPatch<CategoryMutationResponse>(`/api/v1/students/categories/${editingId}/`, payload);
        setToast(response?.message || "Student category updated successfully.");
      } else {
        const response = await apiPost<CategoryMutationResponse>("/api/v1/students/categories/", payload);
        setToast(response?.message || "Student category created successfully.");
      }
      resetForm();
      await load(1, pageSize, search, statusFilter);
    } catch (err) {
      applyApiFieldErrors(err as ApiError, "Unable to save category.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: StudentCategory) => {
    setEditingId(row.id);
    setName(row.name || "");
    setDescription(row.description || "");
    setCode(row.code || "");
    setStatusValue(row.status || "active");
    setFieldErrors({});
    setTouched({});
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateSingleStatus = async (row: StudentCategory, nextStatus: "active" | "inactive") => {
    try {
      setUpdatingStatusIds((prev) => [...prev, row.id]);
      await apiPatch<CategoryMutationResponse>(`/api/v1/students/categories/${row.id}/`, {
        name: row.name,
        description: row.description,
        code: row.code,
        status: nextStatus,
      });
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, status: nextStatus } : item)));
      setToast(`Category ${nextStatus === "active" ? "activated" : "deactivated"} successfully.`);
    } catch (err) {
      applyApiFieldErrors(err as ApiError, "Unable to update status.");
    } finally {
      setUpdatingStatusIds((prev) => prev.filter((id) => id !== row.id));
    }
  };

  const openDeleteConfirm = (row: StudentCategory) => {
    setConfirmDialog({
      title: "Delete Category",
      message: `Are you sure you want to delete this category?`,
      confirmLabel: "Delete",
      ids: [row.id],
      mode: "single-delete",
    });
  };

  const openBulkDeleteConfirm = () => {
    if (!selectedIds.length) return;
    setConfirmDialog({
      title: "Bulk Delete Categories",
      message: `Are you sure you want to delete ${selectedIds.length} selected categor${selectedIds.length > 1 ? "ies" : "y"}?`,
      confirmLabel: "Delete Selected",
      ids: [...selectedIds],
      mode: "bulk-delete",
    });
  };

  const confirmDelete = async () => {
    if (!confirmDialog) return;
    const ids = confirmDialog.ids;
    try {
      setDeletingIds(ids);
      setError("");
      setSuccess("");
      if (confirmDialog.mode === "single-delete") {
        const response = await apiDelete<CategoryDeleteResponse>(`/api/v1/students/categories/${ids[0]}/`);
        if (editingId === ids[0]) resetForm();
        setToast(response?.message || "Student category deleted successfully.");
      } else {
        const response = await apiDelete<CategoryDeleteResponse>("/api/v1/students/categories/bulk-delete/", { ids });
        setToast(response?.message || "Selected categories deleted successfully.");
      }
      setConfirmDialog(null);
      await load(currentPage, pageSize, search, statusFilter);
    } catch (err) {
      applyApiFieldErrors(err as ApiError, "Unable to delete category.");
      setConfirmDialog(null);
    } finally {
      setDeletingIds([]);
    }
  };

  const bulkStatusChange = async (nextStatus: "active" | "inactive") => {
    if (!selectedIds.length) return;
    const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
    const toUpdate = selectedRows.filter((row) => row.status !== nextStatus);

    if (selectedRows.length > 0 && toUpdate.length === 0) {
      setToast(nextStatus === "active" ? "Selected categories are already active." : "Selected categories are already inactive.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await apiPatch<CategoryMutationResponse>("/api/v1/students/categories/bulk-status/", {
        ids: toUpdate.length > 0 ? toUpdate.map((row) => row.id) : selectedIds,
        status: nextStatus,
      });
      if (response?.success === false) {
        setToast(response.message || "Unable to update selected categories.", true);
      } else {
        const updatedCount = toUpdate.length > 0 ? toUpdate.length : selectedIds.length;
        setToast(
          nextStatus === "active"
            ? `${updatedCount} categor${updatedCount === 1 ? "y" : "ies"} activated successfully.`
            : `${updatedCount} categor${updatedCount === 1 ? "y" : "ies"} deactivated successfully.`
        );
      }
      setSelectedIds([]);
      await load(currentPage, pageSize, search, statusFilter);
    } catch (err) {
      applyApiFieldErrors(err as ApiError, "Unable to update selected categories.");
    } finally {
      setSaving(false);
    }
  };

  const selectedAllOnPage = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  const toggleSelectAllOnPage = (checked: boolean) => {
    if (checked) {
      const merged = new Set([...selectedIds, ...rows.map((row) => row.id)]);
      setSelectedIds(Array.from(merged));
    } else {
      setSelectedIds((prev) => prev.filter((id) => !rows.some((row) => row.id === id)));
    }
  };

  const toggleSelection = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      return;
    }
    setSelectedIds((prev) => prev.filter((item) => item !== id));
  };

  useEffect(() => {
    if (!isReady) return;
    setSelectedIds([]);
  }, [search, statusFilter, pageSize, currentPage]);

  return (
    <div className="legacy-panel student-category-page">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div className="student-breadcrumb-row">
            <div>
              <h1 className="student-title">Student Category</h1>
              <div className="student-crumbs" aria-label="Breadcrumb">
                <Link href="/dashboard">Dashboard</Link>
                <span>/</span>
                <Link href="/students">Student Info</Link>
                <span>/</span>
                <Link href="/students/category">Category</Link>
              </div>
            </div>
            <div className="student-breadcrumb-meta">Manage categories, visibility, and bulk actions.</div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="student-layout">
            <div className="white-box student-form-card">
              <h3>{editingId ? "Edit Student Category" : "Add Student Category"}</h3>
              <form onSubmit={submit} className="student-form" noValidate>
                <div className="field-group">
                  <label htmlFor="student-category-name">Category Name *</label>
                  <input
                    id="student-category-name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (fieldErrors.name) {
                        setFieldErrors((prev) => ({ ...prev, name: validateCategoryName(event.target.value) }));
                      }
                    }}
                    onBlur={() => markTouched("name")}
                    placeholder="e.g. General"
                    aria-describedby="student-category-name-help"
                    className={fieldErrors.name ? "has-error" : ""}
                    maxLength={100}
                  />
                  <p className="field-help" id="student-category-name-help">Allowed: letters, numbers, and spaces only.</p>
                  <p className="field-example"><strong>Example:</strong> General, Admission, Transport, Alumni</p>
                  {fieldErrors.name ? <p className="field-error">{fieldErrors.name}</p> : null}
                  {duplicateChecking ? <p className="field-hint">Checking for duplicates...</p> : null}
                </div>

                <div className="field-group">
                  <label htmlFor="student-category-code">Code</label>
                  <input
                    id="student-category-code"
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value);
                      if (fieldErrors.code) {
                        setFieldErrors((prev) => ({ ...prev, code: event.target.value.trim().length > 30 ? "Code must not exceed 30 characters" : "" }));
                      }
                    }}
                    onBlur={() => markTouched("code")}
                    placeholder="Optional code"
                    aria-describedby="student-category-code-help"
                    maxLength={30}
                    className={fieldErrors.code ? "has-error" : ""}
                  />
                  <p className="field-help" id="student-category-code-help">Optional short code for reporting or quick selection.</p>
                  {fieldErrors.code ? <p className="field-error">{fieldErrors.code}</p> : null}
                </div>

                <div className="field-group">
                  <label htmlFor="student-category-status">Status</label>
                  <select
                    id="student-category-status"
                    value={statusValue}
                    onChange={(event) => setStatusValue(event.target.value as "active" | "inactive")}
                    aria-label="Student category status"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <p className="field-help">Use Active for visible categories and Inactive to hide from normal flows.</p>
                </div>

                <div className="field-group">
                  <label htmlFor="student-category-description">Description</label>
                  <textarea
                    id="student-category-description"
                    value={description}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      if (fieldErrors.description) {
                        setFieldErrors((prev) => ({ ...prev, description: validateDescription(event.target.value) }));
                      }
                    }}
                    onBlur={() => markTouched("description")}
                    placeholder="Optional description"
                    aria-describedby="student-category-description-help"
                    maxLength={500}
                    className={fieldErrors.description ? "has-error" : ""}
                  />
                  <div className="field-row-between">
                    <p className="field-help" id="student-category-description-help">Keep it concise and readable.</p>
                    <p className="field-counter">{description.length}/500</p>
                  </div>
                  <p className="field-example"><strong>Example:</strong> Category used for general admission students.</p>
                  {fieldErrors.description ? <p className="field-error">{fieldErrors.description}</p> : null}
                </div>

                <div className="form-actions">
                  <button type="submit" disabled={saving || !canSubmit} className="student-btn student-btn-primary action-save">
                    {saving ? "Saving..." : editingId ? "Update Category" : "Save Category"}
                  </button>
                  <button type="button" className="student-btn student-btn-secondary" onClick={resetForm}>
                    Reset
                  </button>
                </div>
              </form>
            </div>

            <div className="white-box student-list-card">
              <div className="list-head">
                <h3>Student Category List</h3>
                <div className="list-tools">
                  <div className="search-box">
                    <span aria-hidden="true">🔍</span>
                    <input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search categories..."
                      aria-label="Search categories"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                    aria-label="Filter categories by status"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <select
                    value={String(pageSize)}
                    onChange={(e) => setPageSize(Number(e.target.value) as 10 | 25)}
                    aria-label="Categories per page"
                  >
                    <option value="10">10 / page</option>
                    <option value="25">25 / page</option>
                  </select>
                </div>
              </div>
              <p className="summary-line">{totalCount} categories · Sorted by name</p>

              <div className="bulk-toolbar">
                <div className="bulk-select">
                  <input
                    id="student-category-select-all"
                    type="checkbox"
                    checked={selectedAllOnPage}
                    onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                    aria-label="Select all categories on current page"
                  />
                  <label htmlFor="student-category-select-all">Select page</label>
                </div>
                <div className="bulk-actions">
                  <button type="button" className="student-btn student-btn-success" disabled={!selectedIds.length || saving} onClick={() => void bulkStatusChange("active")}>
                    Activate Selected
                  </button>
                  <button type="button" className="student-btn student-btn-warning" disabled={!selectedIds.length || saving} onClick={() => void bulkStatusChange("inactive")}>
                    Deactivate Selected
                  </button>
                  <button type="button" className="student-btn student-btn-danger" disabled={!selectedIds.length} onClick={openBulkDeleteConfirm}>
                    Bulk Delete
                  </button>
                </div>
              </div>

              <div className="student-table-wrap">
                <table className="student-table">
                  <thead>
                    <tr>
                      <th scope="col">Select</th>
                      <th scope="col">Category Name</th>
                      <th scope="col">Code</th>
                      <th scope="col">Status</th>
                      <th scope="col">Description</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty-state">No categories found.</td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const rowDeleting = deletingIds.includes(row.id);
                        const rowUpdating = updatingStatusIds.includes(row.id);
                        const checked = selectedIds.includes(row.id);
                        return (
                          <tr key={row.id} className={checked ? "is-selected" : ""}>
                            <td>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleSelection(row.id, e.target.checked)}
                                aria-label={`Select category ${escapeHtml(row.name)}`}
                              />
                            </td>
                            <td>
                              <div className="category-name-cell">
                                <strong>{row.name}</strong>
                                {editingId === row.id ? <span className="editing-pill">Editing</span> : null}
                              </div>
                            </td>
                            <td>{row.code || "-"}</td>
                            <td>
                              <label className="status-switch" aria-label={`Toggle status for ${row.name}`}>
                                <input
                                  type="checkbox"
                                  checked={row.status === "active"}
                                  onChange={(e) => void updateSingleStatus(row, e.target.checked ? "active" : "inactive")}
                                  disabled={rowUpdating}
                                />
                                <span className={`status-track ${row.status === "active" ? "active" : "inactive"}`}>
                                  <span className="status-thumb" />
                                </span>
                                <span className={`status-label ${row.status === "active" ? "active" : "inactive"}`}>
                                  {rowUpdating ? "Updating..." : row.status === "active" ? "Active" : "Inactive"}
                                </span>
                              </label>
                            </td>
                            <td>
                              <div className="table-description">{row.description || "-"}</div>
                            </td>
                            <td>
                              <div className="row-actions">
                                <button type="button" className="icon-btn edit" onClick={() => startEdit(row)} aria-label={`Edit ${row.name}`}>
                                  ✏️
                                </button>
                                <button type="button" className="icon-btn delete" disabled={rowDeleting} onClick={() => openDeleteConfirm(row)} aria-label={`Delete ${row.name}`}>
                                  {rowDeleting ? "..." : "🗑️"}
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

              <div className="pagination-row">
                <div className="pagination-meta">Page {currentPage} of {pageCount}</div>
                <div className="pagination-actions">
                  <button type="button" className="student-btn student-btn-secondary" disabled={currentPage <= 1 || loading} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>
                    Previous
                  </button>
                  <button type="button" className="student-btn student-btn-secondary" disabled={currentPage >= pageCount || loading} onClick={() => setCurrentPage((prev) => Math.min(pageCount, prev + 1))}>
                    Next
                  </button>
                </div>
              </div>

              {loading ? <p className="status-line">Loading student categories...</p> : null}
              {error ? <p className="status-line error">{error}</p> : null}
              {success ? <p className="status-line success">{success}</p> : null}
            </div>
          </div>
        </div>
      </section>

      {confirmDialog ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setConfirmDialog(null)}>
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="confirm-title">{confirmDialog.title}</h3>
            <p id="confirm-message">{confirmDialog.message}</p>
            <div className="modal-actions">
              <button type="button" className="student-btn student-btn-secondary" onClick={() => setConfirmDialog(null)}>
                Cancel
              </button>
              <button type="button" className="student-btn student-btn-danger" onClick={() => void confirmDelete()}>
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? <div className="toast-message" aria-live="polite">{toastMessage}</div> : null}

      <style jsx>{`
        .student-category-page {
          padding-bottom: calc(24px + env(safe-area-inset-bottom));
          color: #1f2937;
        }
        .student-breadcrumb-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .student-title {
          margin: 0;
          font-size: 26px;
          color: #0f172a;
        }
        .student-crumbs {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          color: #64748b;
          font-size: 14px;
        }
        .student-crumbs a {
          color: #475569;
          text-decoration: none;
        }
        .student-breadcrumb-meta {
          color: #64748b;
          font-size: 13px;
          max-width: 280px;
          text-align: right;
        }
        .student-layout {
          display: grid;
          grid-template-columns: minmax(340px, 420px) minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }
        .white-box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 20px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
        }
        .student-form-card h3,
        .student-list-card h3 {
          margin: 0 0 14px;
          font-size: 18px;
          color: #0f172a;
        }
        .student-form {
          display: grid;
          gap: 14px;
        }
        .field-group {
          display: grid;
          gap: 6px;
        }
        .field-group label {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }
        .field-group input,
        .field-group select,
        .field-group textarea {
          width: 100%;
          border: 1.5px solid #cbd5e1;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 14px;
          color: #0f172a;
          background: #fff;
          box-sizing: border-box;
          transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
        }
        .field-group textarea {
          min-height: 110px;
          resize: vertical;
        }
        .field-group input:focus,
        .field-group select:focus,
        .field-group textarea:focus,
        .student-btn:focus,
        .icon-btn:focus,
        .status-switch input:focus + .status-track {
          outline: none;
          border-color: #0f766e;
          box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.14);
        }
        .has-error {
          border-color: #dc2626 !important;
        }
        .field-help,
        .field-example,
        .field-hint,
        .field-counter {
          margin: 0;
          font-size: 11.5px;
          color: #64748b;
          line-height: 1.4;
        }
        .field-example strong,
        .field-row-between strong {
          color: #0f172a;
        }
        .field-row-between {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
        }
        .field-error {
          margin: 0;
          font-size: 12px;
          color: #dc2626;
        }
        .form-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          padding-top: 6px;
        }
        .student-btn {
          border: none;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease, background 180ms ease;
        }
        .student-btn:hover {
          transform: translateY(-1px);
        }
        .student-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
        }
        .student-btn-primary {
          background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
          color: #ffffff;
          box-shadow: 0 10px 18px rgba(20, 184, 166, 0.2);
        }
        .student-btn-secondary {
          background: #e2e8f0;
          color: #0f172a;
        }
        .student-btn-info {
          background: #dbeafe;
          color: #1e3a8a;
        }
        .student-btn-danger {
          background: #fee2e2;
          color: #991b1b;
        }
        .student-btn-success {
          background: #dcfce7;
          color: #166534;
        }
        .student-btn-warning {
          background: #fef3c7;
          color: #92400e;
        }
        .student-btn-primary.action-save {
          min-width: 170px;
        }
        .student-list-card {
          position: sticky;
          top: 70px;
          max-height: calc(100vh - 90px);
          overflow-y: auto;
        }
        .list-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        .list-tools {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #cbd5e1;
          background: #fff;
          border-radius: 10px;
          padding: 0 12px;
          min-height: 40px;
        }
        .search-box input,
        .list-tools select {
          border: none;
          outline: none;
          background: transparent;
          font-size: 13px;
          color: #0f172a;
        }
        .search-box input {
          min-width: 180px;
        }
        .summary-line {
          margin: 0 0 12px;
          color: #64748b;
          font-size: 12px;
        }
        .bulk-toolbar {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          padding: 10px 0 12px;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 14px;
        }
        .bulk-select {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #334155;
        }
        .bulk-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .student-table-wrap {
          overflow-x: auto;
        }
        .student-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0 10px;
        }
        .student-table thead th {
          text-align: left;
          font-size: 11px;
          color: #64748b;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 0 12px 4px;
          border-bottom: 1px solid #e2e8f0;
        }
        .student-table tbody tr {
          background: #fff;
          box-shadow: 0 8px 16px rgba(15, 23, 42, 0.04);
        }
        .student-table tbody td {
          padding: 12px;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          color: #334155;
          vertical-align: top;
        }
        .student-table tbody td:first-child {
          border-left: 4px solid #14b8a6;
          border-top-left-radius: 12px;
          border-bottom-left-radius: 12px;
        }
        .student-table tbody td:last-child {
          border-right: 1px solid #e2e8f0;
          border-top-right-radius: 12px;
          border-bottom-right-radius: 12px;
        }
        .student-table tbody tr.is-selected td {
          background: #f0fdfa;
        }
        .category-name-cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .editing-pill {
          display: inline-flex;
          width: fit-content;
          background: #e0f2fe;
          color: #075985;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
        }
        .status-switch {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          user-select: none;
        }
        .status-switch input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }
        .status-track {
          width: 42px;
          height: 24px;
          border-radius: 999px;
          position: relative;
          border: 1px solid #cbd5e1;
          transition: background 180ms ease, border-color 180ms ease;
        }
        .status-track.active {
          background: #dcfce7;
          border-color: #86efac;
        }
        .status-track.inactive {
          background: #fee2e2;
          border-color: #fca5a5;
        }
        .status-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 2px 4px rgba(15, 23, 42, 0.18);
          transition: transform 180ms ease;
        }
        .status-track.active .status-thumb {
          transform: translateX(18px);
        }
        .status-label {
          font-size: 12px;
          font-weight: 700;
        }
        .status-label.active {
          color: #166534;
        }
        .status-label.inactive {
          color: #991b1b;
        }
        .table-description {
          max-width: 320px;
          color: #475569;
          font-size: 12px;
          line-height: 1.5;
          white-space: normal;
          word-break: break-word;
        }
        .row-actions {
          display: flex;
          gap: 8px;
        }
        .icon-btn {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 14px;
          transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
        }
        .icon-btn:hover {
          transform: translateY(-1px);
        }
        .icon-btn.edit {
          background: #dbeafe;
          color: #1d4ed8;
        }
        .icon-btn.delete {
          background: #fee2e2;
          color: #b91c1c;
        }
        .empty-state {
          padding: 18px 12px !important;
          color: #64748b;
          text-align: center;
        }
        .pagination-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: 12px;
        }
        .pagination-meta {
          color: #64748b;
          font-size: 12px;
        }
        .pagination-actions {
          display: flex;
          gap: 8px;
        }
        .status-line {
          margin: 12px 0 0;
          font-size: 12px;
        }
        .status-line.error {
          color: #b91c1c;
        }
        .status-line.success {
          color: #047857;
        }
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1200;
        }
        .confirm-modal {
          width: min(100%, 420px);
          background: #ffffff;
          border-radius: 16px;
          padding: 20px;
          border: 1px solid #fecaca;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.25);
        }
        .confirm-modal h3 {
          margin: 0 0 10px;
          color: #991b1b;
        }
        .confirm-modal p {
          margin: 0 0 18px;
          color: #475569;
          line-height: 1.5;
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .toast-message {
          position: fixed;
          right: 18px;
          bottom: calc(18px + env(safe-area-inset-bottom));
          background: #0f766e;
          color: #fff;
          border-radius: 12px;
          padding: 10px 14px;
          box-shadow: 0 14px 30px rgba(15, 118, 110, 0.28);
          z-index: 1300;
          font-size: 13px;
          font-weight: 600;
        }
        @media (max-width: 1100px) {
          .student-layout {
            grid-template-columns: 1fr;
          }
          .student-list-card {
            position: static;
            max-height: none;
          }
        }
        @media (max-width: 720px) {
          .student-breadcrumb-row {
            flex-direction: column;
          }
          .student-breadcrumb-meta {
            text-align: left;
            max-width: none;
          }
          .bulk-toolbar,
          .list-head,
          .pagination-row {
            flex-direction: column;
            align-items: stretch;
          }
          .bulk-actions,
          .pagination-actions {
            justify-content: flex-start;
          }
          .row-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
