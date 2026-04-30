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
  students_count?: number;
  created_at?: string;
};

type CategorySummary = {
  total_count: number;
  active_count: number;
  inactive_count: number;
  attention_count: number;
  top_total_students: number;
  top_categories: Array<{ id: number; name: string; students_count: number }>;
  recent_activity: Array<{
    id: number;
    name: string;
    action: string;
    status: "active" | "inactive";
    created_at: string;
  }>;
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

function meaningfulText(value: string) {
  const stripped = value.replace(/\s+/g, "");
  return /[A-Za-z0-9]/.test(stripped) && !/^(.)\1+$/.test(stripped) && !/^[^A-Za-z0-9]+$/.test(stripped);
}

function validateCategoryName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Category name is required";
  if (trimmed.length < 2) return "Category name must be at least 2 characters";
  if (trimmed.length > 100) return "Category name must not exceed 100 characters";
  if (!/^[A-Za-z0-9 ]+$/.test(trimmed)) return "Category name may contain only letters, numbers, and spaces";
  if (!meaningfulText(trimmed)) return "Category name must be meaningful";
  return "";
}

function validateDescription(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length > 500) return "Description must not exceed 500 characters";
  return "";
}

function formatRelativeDate(value?: string) {
  if (!value) return "";
  const now = Date.now();
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.floor((now - then) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function parseErrorMessage(error: unknown, fallback: string) {
  const err = error as ApiError;
  const details = err?.details;
  const firstField = details?.field_errors ? Object.values(details.field_errors)[0] : null;
  const fieldMessage = Array.isArray(firstField) ? String(firstField[0] || "") : String(firstField || "");
  return details?.message || fieldMessage || err?.message || fallback;
}

function barWidthClass(studentsCount: number, topMax: number) {
  const ratio = topMax > 0 ? studentsCount / topMax : 0;
  const normalized = Math.max(0.08, Math.min(1, ratio));
  const bucket = Math.max(1, Math.min(24, Math.ceil(normalized * 24)));
  return `bin-${bucket}`;
}

const EMPTY_SUMMARY: CategorySummary = {
  total_count: 0,
  active_count: 0,
  inactive_count: 0,
  attention_count: 0,
  top_total_students: 0,
  top_categories: [],
  recent_activity: [],
};

export function StudentCategoryPanel() {
  const [rows, setRows] = useState<StudentCategory[]>([]);
  const [summary, setSummary] = useState<CategorySummary>(EMPTY_SUMMARY);
  const [loadingRows, setLoadingRows] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25>(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "attention">("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [statusValue, setStatusValue] = useState<"active" | "inactive">("active");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [duplicateChecking, setDuplicateChecking] = useState(false);

  const [confirmMode, setConfirmMode] = useState<"none" | "single-delete" | "bulk-delete">("none");
  const [deleteIds, setDeleteIds] = useState<number[]>([]);

  const nameCheckId = useRef(0);
  const listRequestId = useRef(0);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [pageSize, totalCount]);
  const selectedAllOnPage = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  const canSubmit = useMemo(() => {
    return !validateCategoryName(name) && !validateDescription(description) && !saving;
  }, [description, name, saving]);

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

  const loadRows = async (
    nextPage = currentPage,
    nextPageSize = pageSize,
    nextSearch = search,
    nextStatus = statusFilter,
  ) => {
    const requestId = ++listRequestId.current;
    try {
      setLoadingRows(true);
      setError("");

      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("page_size", String(nextPageSize));
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      if (nextStatus === "active" || nextStatus === "inactive") params.set("status", nextStatus);
      if (nextStatus === "attention") params.set("attention", "1");

      const data = await apiGet<PageResponse<StudentCategory>>(`/api/v1/students/categories/?${params.toString()}`);
      if (requestId !== listRequestId.current) return;

      setRows(listData(data));
      setTotalCount(Number(data.count || 0));
      setSelectedIds([]);
    } catch {
      if (requestId === listRequestId.current) {
        setRows([]);
        setTotalCount(0);
        setError("Unable to load student categories.");
      }
    } finally {
      if (requestId === listRequestId.current) {
        setLoadingRows(false);
      }
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
    if (!drawerOpen) return;

    const timer = window.setTimeout(async () => {
      const nameError = validateCategoryName(name);
      if (!name.trim() || nameError) return;

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
        }
      } catch {
        // Ignore duplicate check failures to avoid blocking edits.
      } finally {
        if (checkId === nameCheckId.current) setDuplicateChecking(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [drawerOpen, editingId, name]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setCode("");
    setDescription("");
    setStatusValue("active");
    setFieldErrors({});
  };

  const openCreateDrawer = () => {
    resetForm();
    setDrawerOpen(true);
    setError("");
  };

  const openEditDrawer = (row: StudentCategory) => {
    setEditingId(row.id);
    setName(row.name || "");
    setCode(row.code || "");
    setDescription(row.description || "");
    setStatusValue(row.status || "active");
    setFieldErrors({});
    setDrawerOpen(true);
    setError("");
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
      setError("Please correct the highlighted fields.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        name: sanitizeText(name),
        code: sanitizeText(code),
        description: sanitizeText(description),
        status: statusValue,
      };

      const response = editingId
        ? await apiPatch<CategoryMutationResponse>(`/api/v1/students/categories/${editingId}/`, payload)
        : await apiPost<CategoryMutationResponse>("/api/v1/students/categories/", payload);

      setSuccess(response?.message || (editingId ? "Category updated." : "Category created."));
      setDrawerOpen(false);
      resetForm();
      await loadRows(1, pageSize, search, statusFilter);
      await loadSummary(search);
      setCurrentPage(1);
    } catch (err) {
      setError(parseErrorMessage(err, "Unable to save category."));
    } finally {
      setSaving(false);
    }
  };

  const updateSingleStatus = async (row: StudentCategory, nextStatus: "active" | "inactive") => {
    try {
      setSaving(true);
      setError("");
      await apiPatch<CategoryMutationResponse>(`/api/v1/students/categories/${row.id}/`, { status: nextStatus });
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, status: nextStatus } : item)));
      setSuccess(nextStatus === "active" ? "Category activated." : "Category deactivated.");
      await loadSummary(search);
    } catch (err) {
      setError(parseErrorMessage(err, "Unable to update status."));
    } finally {
      setSaving(false);
    }
  };

  const bulkStatusChange = async (nextStatus: "active" | "inactive") => {
    if (!selectedIds.length) return;
    try {
      setSaving(true);
      setError("");
      const response = await apiPatch<CategoryMutationResponse>("/api/v1/students/categories/bulk-status/", {
        ids: selectedIds,
        status: nextStatus,
      });
      setSuccess(response?.message || "Categories updated.");
      setSelectedIds([]);
      await loadRows(currentPage, pageSize, search, statusFilter);
      await loadSummary(search);
    } catch (err) {
      setError(parseErrorMessage(err, "Unable to update selected categories."));
    } finally {
      setSaving(false);
    }
  };

  const requestSingleDelete = (id: number) => {
    setConfirmMode("single-delete");
    setDeleteIds([id]);
  };

  const requestBulkDelete = () => {
    if (!selectedIds.length) return;
    setConfirmMode("bulk-delete");
    setDeleteIds([...selectedIds]);
  };

  const confirmDelete = async () => {
    if (!deleteIds.length) return;
    try {
      setSaving(true);
      setError("");

      if (confirmMode === "single-delete") {
        await apiDelete<CategoryMutationResponse>(`/api/v1/students/categories/${deleteIds[0]}/`);
      } else {
        await apiDelete<CategoryMutationResponse>("/api/v1/students/categories/bulk-delete/", { ids: deleteIds });
      }

      setSuccess(confirmMode === "single-delete" ? "Category deleted." : "Selected categories deleted.");
      setConfirmMode("none");
      setDeleteIds([]);
      setSelectedIds([]);
      await loadRows(currentPage, pageSize, search, statusFilter);
      await loadSummary(search);
    } catch (err) {
      setError(parseErrorMessage(err, "Unable to delete category."));
      setConfirmMode("none");
      setDeleteIds([]);
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectAllOnPage = (checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...rows.map((row) => row.id)])));
    } else {
      setSelectedIds((prev) => prev.filter((id) => !rows.some((row) => row.id === id)));
    }
  };

  const exportVisibleRows = async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter === "active" || statusFilter === "inactive") params.set("status", statusFilter);
      if (statusFilter === "attention") params.set("attention", "1");

      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
      const response = await fetch(`/api/v1/students/categories/export/?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `student_categories_${Date.now()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      setSuccess("Export completed.");
    } catch {
      setError("Unable to export categories.");
    }
  };

  const topMax = useMemo(() => {
    return Math.max(1, ...summary.top_categories.map((item) => Number(item.students_count || 0)));
  }, [summary.top_categories]);

  return (
    <div className="legacy-panel category-manager-page">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div className="crumb-row">
            <div className="crumb-links">
              <Link href="/dashboard">Dashboard</Link>
              <span>/</span>
              <Link href="/students">Student Info</Link>
              <span>/</span>
              <span>Categories</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="hero-head">
            <div>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-playfair), Georgia, "Times New Roman", serif', fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, color: '#0f172a' }}>
                Student <span style={{ fontFamily: 'var(--font-playfair), Georgia, "Times New Roman", serif', fontStyle: 'italic', fontSize: '32px', fontWeight: 400, color: '#6c3ce1' }}>Categories</span>
              </h1>
              <p>Classification tags used across admissions, fee rules, and reporting.</p>
            </div>
            <button type="button" className="btn-primary" onClick={openCreateDrawer}>
              + New Category
            </button>
          </div>

          <div className="summary-grid">
            <article className="summary-card">
              <p className="summary-label">Total Categories</p>
              <p className="summary-value">{summary.total_count}</p>
              <p className="summary-meta">
                <strong>{summary.active_count} active</strong> · {summary.attention_count} needs attention
              </p>
            </article>

            <article className="summary-card">
              <p className="summary-label">Students by Category</p>
              <div className="mini-bars">
                {summary.top_categories.length ? (
                  summary.top_categories.map((item) => (
                    <span
                      key={item.id}
                      className={`bar ${barWidthClass(Number(item.students_count || 0), topMax)}`}
                      title={`${item.name}: ${item.students_count}`}
                    />
                  ))
                ) : (
                  <span className="summary-empty">No data</span>
                )}
              </div>
              <p className="summary-meta">Top total: {summary.top_total_students} students</p>
            </article>

            <article className="summary-card">
              <p className="summary-label">Recent Activity</p>
              <ul className="activity-list">
                {loadingSummary ? (
                  <li>Loading activity...</li>
                ) : summary.recent_activity.length ? (
                  summary.recent_activity.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <span className="dot" />
                      <div>
                        <p>
                          <strong>{item.name}</strong> {item.action}
                        </p>
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
            <div className="filters-row">
              <div className="search-wrap">
                <span>🔍</span>
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search categories or codes..."
                  aria-label="Search categories"
                />
              </div>

              <div className="chip-group">
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
                  Attention <span>{summary.attention_count}</span>
                </button>
              </div>

              <button type="button" className="btn-export" onClick={() => void exportVisibleRows()}>
                Export
              </button>
            </div>

            {selectedIds.length ? (
              <div className="bulk-bar">
                <span>{selectedIds.length} selected</span>
                <div className="bulk-actions">
                  <button type="button" onClick={() => void bulkStatusChange("active")} disabled={saving}>Activate</button>
                  <button type="button" onClick={() => void bulkStatusChange("inactive")} disabled={saving}>Deactivate</button>
                  <button type="button" className="danger" onClick={requestBulkDelete} disabled={saving}>Delete</button>
                  <button type="button" className="ghost" onClick={() => setSelectedIds([])} disabled={saving}>Clear</button>
                </div>
              </div>
            ) : null}

            <div className="table-wrap">
              <table className="category-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        title="Select all visible categories"
                        checked={selectedAllOnPage}
                        onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                      />
                    </th>
                    <th>Category</th>
                    <th>Code</th>
                    <th>Students</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!loadingRows && rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty">No categories found.</td>
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
                                if (e.target.checked) setSelectedIds((prev) => [...prev, row.id]);
                                else setSelectedIds((prev) => prev.filter((id) => id !== row.id));
                              }}
                            />
                          </td>
                          <td>
                            <strong>{row.name}</strong>
                          </td>
                          <td>{row.code || "-"}</td>
                          <td>{row.students_count || 0}</td>
                          <td>
                            <button
                              type="button"
                              className={row.status === "active" ? "status-pill active" : "status-pill inactive"}
                              onClick={() => void updateSingleStatus(row, row.status === "active" ? "inactive" : "active")}
                              disabled={saving}
                              title={row.status === "active" ? "Set inactive" : "Set active"}
                            >
                              {row.status === "active" ? "Active" : "Inactive"}
                            </button>
                          </td>
                          <td className="description">{row.description || <span className="muted">No description</span>}</td>
                          <td>
                            <div className="row-actions">
                              <button type="button" title="Edit" onClick={() => openEditDrawer(row)}>✎</button>
                              <button type="button" title="Delete" onClick={() => requestSingleDelete(row.id)}>🗑</button>
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
              <p>
                Showing {rows.length ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount}
              </p>
              <div>
                <label>
                  Page size
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value) as 10 | 25);
                      setCurrentPage(1);
                    }}
                    title="Page size"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                  </select>
                </label>
                <button type="button" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage <= 1 || loadingRows}>Previous</button>
                <button type="button" onClick={() => setCurrentPage((prev) => Math.min(pageCount, prev + 1))} disabled={currentPage >= pageCount || loadingRows}>Next</button>
              </div>
            </div>
          </div>

          {error ? <p className="status-msg error">{error}</p> : null}
          {success ? <p className="status-msg success">{success}</p> : null}
        </div>
      </section>

      {drawerOpen ? (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <aside className="drawer" onClick={(event) => event.stopPropagation()}>
            <header>
              <h3>
                {editingId ? "Edit" : "New"} <span>category</span>
              </h3>
              <p>Create a classification tag</p>
              <button type="button" className="close-btn" onClick={() => setDrawerOpen(false)}>×</button>
            </header>

            <form onSubmit={submit} className="drawer-form" noValidate>
              <div className="field-group">
                <label htmlFor="cat-name">Category name *</label>
                <input
                  id="cat-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) {
                      setFieldErrors((prev) => ({ ...prev, name: validateCategoryName(e.target.value) }));
                    }
                  }}
                  maxLength={100}
                />
                <small>Letters, numbers and spaces.</small>
                {fieldErrors.name ? <p className="field-error">{fieldErrors.name}</p> : null}
                {duplicateChecking ? <p className="field-hint">Checking duplicates...</p> : null}
              </div>

              <div className="field-group">
                <label htmlFor="cat-code">Short code</label>
                <input
                  id="cat-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={30}
                />
                <small>Used in reports.</small>
              </div>

              <div className="field-group">
                <label>Status</label>
                <div className="status-row">
                  <button
                    type="button"
                    className={`status-switch ${statusValue === "active" ? "on" : "off"}`}
                    onClick={() => setStatusValue((prev) => (prev === "active" ? "inactive" : "active"))}
                    title={statusValue === "active" ? "Set inactive" : "Set active"}
                  >
                    <span className="status-thumb" />
                  </button>
                  <span className={`status-label ${statusValue}`}>{statusValue === "active" ? "Active" : "Inactive"}</span>
                </div>
                <small>Toggle category availability for admissions and reports.</small>
              </div>

              <div className="field-group">
                <label htmlFor="cat-desc">Description</label>
                <textarea
                  id="cat-desc"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (fieldErrors.description) {
                      setFieldErrors((prev) => ({ ...prev, description: validateDescription(e.target.value) }));
                    }
                  }}
                  maxLength={500}
                />
                <div className="desc-meta">
                  <small>Visible on admission forms.</small>
                  <small>{description.length}/500</small>
                </div>
                {fieldErrors.description ? <p className="field-error">{fieldErrors.description}</p> : null}
              </div>

              <footer>
                {editingId ? (
                  <button
                    type="button"
                    className="btn-link-danger"
                    onClick={() => requestSingleDelete(editingId)}
                    disabled={saving}
                  >
                    Delete
                  </button>
                ) : (
                  <span />
                )}
                <div className="form-actions">
                  <button type="button" className="btn-ghost" onClick={() => setDrawerOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={!canSubmit || saving}>
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </footer>
            </form>
          </aside>
        </div>
      ) : null}

      {confirmMode !== "none" ? (
        <div className="confirm-backdrop" onClick={() => setConfirmMode("none")}>
          <div className="confirm-card" onClick={(event) => event.stopPropagation()}>
            <h4>Delete Category</h4>
            <p>
              {confirmMode === "single-delete"
                ? "Are you sure you want to delete this category?"
                : `Are you sure you want to delete ${deleteIds.length} selected categories?`}
            </p>
            <div>
              <button type="button" className="btn-ghost" onClick={() => setConfirmMode("none")}>Cancel</button>
              <button type="button" className="btn-danger" onClick={() => void confirmDelete()} disabled={saving}>Delete</button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .category-manager-page {
          padding-bottom: 24px;
          color: #0f172a;
        }
        .crumb-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .crumb-links {
          display: flex;
          gap: 8px;
          color: #64748b;
          font-size: 14px;
        }
        .crumb-links a {
          color: #64748b;
          text-decoration: none;
        }
        .hero-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }
        .hero-head h1 {
          margin: 0;
          font-size: 32px;
          line-height: 1.15;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .hero-head h1 span {
          color: #4f46e5;
          font-family: "Playfair Display", Georgia, serif;
          font-style: italic;
          font-weight: 500;
        }
        .hero-head p {
          margin: 10px 0 0;
          color: #64748b;
          font-size: 15px;
          max-width: 560px;
        }
        .btn-primary {
          border: none;
          background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
          color: #fff;
          border-radius: 12px;
          padding: 12px 18px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .summary-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px;
          min-height: 144px;
        }
        .summary-label {
          margin: 0;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          font-weight: 700;
        }
        .summary-value {
          margin: 14px 0 6px;
          font-size: 50px;
          line-height: 1;
          font-family: "Playfair Display", Georgia, serif;
        }
        .summary-meta {
          margin: 0;
          color: #64748b;
          font-size: 13px;
        }
        .mini-bars {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          height: 46px;
          margin: 14px 0 10px;
        }
        .bar {
          display: block;
          height: 100%;
          min-width: 10px;
          border-radius: 6px;
          background: linear-gradient(180deg, #4f46e5 0%, #818cf8 100%);
          opacity: 0.95;
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
        .summary-empty {
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
          color: #334155;
          font-size: 13px;
          align-items: flex-start;
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
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
        }
        .filters-row {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) auto auto;
          gap: 10px;
          align-items: center;
          padding: 14px;
          border-bottom: 1px solid #e2e8f0;
        }
        .search-wrap {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          min-height: 40px;
        }
        .search-wrap input {
          border: none;
          outline: none;
          width: 100%;
          font-size: 14px;
        }
        .chip-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .chip {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #475569;
          border-radius: 10px;
          padding: 7px 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          gap: 6px;
          align-items: center;
        }
        .chip span {
          background: #e2e8f0;
          color: #475569;
          border-radius: 999px;
          padding: 1px 6px;
          font-size: 11px;
        }
        .chip.active {
          background: #ede9fe;
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
          color: #334155;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .bulk-bar {
          background: #020617;
          color: #fff;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          padding: 10px 14px;
        }
        .bulk-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .bulk-actions button {
          border: 1px solid #374151;
          background: #111827;
          color: #fff;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .bulk-actions .danger {
          background: #be123c;
          border-color: #be123c;
        }
        .bulk-actions .ghost {
          background: #1f2937;
        }
        .table-wrap {
          overflow-x: auto;
        }
        .category-table {
          width: 100%;
          border-collapse: collapse;
        }
        .category-table thead th {
          text-align: left;
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 12px 14px;
          border-bottom: 1px solid #e2e8f0;
        }
        .category-table tbody td {
          padding: 14px;
          border-bottom: 1px solid #eef2f7;
          color: #0f172a;
          font-size: 15px;
          vertical-align: top;
        }
        .category-table tbody tr.selected td {
          background: #f5f3ff;
        }
        .status-pill {
          border: none;
          border-radius: 999px;
          padding: 5px 11px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .status-pill.active {
          background: #dcfce7;
          color: #166534;
        }
        .status-pill.inactive {
          background: #fee2e2;
          color: #991b1b;
        }
        .description {
          color: #475569;
          max-width: 420px;
        }
        .muted {
          color: #94a3b8;
          font-style: italic;
        }
        .row-actions {
          display: flex;
          gap: 8px;
        }
        .row-actions button {
          border: none;
          background: #f8fafc;
          border-radius: 9px;
          width: 30px;
          height: 30px;
          cursor: pointer;
        }
        .empty {
          text-align: center;
          color: #64748b;
          padding: 22px 10px !important;
        }
        .pagination-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 13px;
        }
        .pagination-row p {
          margin: 0;
        }
        .pagination-row div {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .pagination-row button,
        .pagination-row select {
          border: 1px solid #d1d5db;
          background: #fff;
          border-radius: 10px;
          padding: 7px 10px;
          font-size: 12px;
          color: #334155;
        }
        .status-msg {
          margin: 12px 0 0;
          font-size: 13px;
        }
        .status-msg.error {
          color: #b91c1c;
        }
        .status-msg.success {
          color: #166534;
        }
        .drawer-backdrop {
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
          overflow: hidden;
          box-shadow: 0 24px 54px rgba(15, 23, 42, 0.22);
          animation: drawer-slide-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .drawer header {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: start;
          gap: 2px 8px;
          padding: 10px 14px 8px;
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 3;
          background: #fff;
        }
        .drawer h3 {
          margin: 0;
          font-size: 36px;
          font-weight: 500;
          line-height: 0.9;
          font-family: "Playfair Display", Georgia, serif;
        }
        .drawer h3 span {
          color: #5b3df5;
          font-family: "Playfair Display", Georgia, serif;
          font-style: italic;
          font-weight: 500;
        }
        .drawer header p {
          margin: -2px 0 0;
          color: #94a3b8;
          font-size: 13px;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
          font-weight: 500;
          grid-column: 1;
        }
        .close-btn {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 12px;
          width: 32px;
          height: 32px;
          font-size: 20px;
          color: #475569;
          cursor: pointer;
          grid-column: 2;
          grid-row: 1 / span 2;
        }
        .drawer-form {
          padding: 12px 14px 12px;
          overflow-y: auto;
          display: grid;
          gap: 12px;
        }
        .field-group {
          display: grid;
          gap: 6px;
        }
        .drawer-form label {
          font-size: 14px;
          color: #1e293b;
          font-weight: 700;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .drawer-form input,
        .drawer-form textarea {
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 0 12px;
          font-size: 14px;
          color: #0f172a;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
          min-height: 42px;
          background: #fff;
          transition: border-color 140ms ease, box-shadow 140ms ease;
        }
        .drawer-form input:focus,
        .drawer-form textarea:focus {
          outline: none;
          border-color: #7c6bff;
          box-shadow: 0 0 0 3px rgba(91, 61, 245, 0.14);
        }
        .drawer-form textarea {
          min-height: 96px;
          padding: 10px 12px;
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
        .status-row {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .status-switch {
          width: 54px;
          height: 30px;
          border-radius: 999px;
          border: 1px solid #d1d5db;
          padding: 3px;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
          transition: background 180ms ease, border-color 180ms ease;
          background: #e2e8f0;
        }
        .status-thumb {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: #fff;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18);
          transform: translateX(0);
          transition: transform 180ms ease;
        }
        .status-switch.on {
          background: linear-gradient(135deg, #6a5aff 0%, #5b3df5 100%);
          border-color: #8f8bff;
        }
        .status-switch.on .status-thumb {
          transform: translateX(24px);
        }
        .status-label {
          display: inline-flex;
          align-items: center;
          font-size: 13px;
          font-weight: 700;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .status-label.active {
          color: #15803d;
        }
        .status-label.inactive {
          color: #b91c1c;
        }
        .desc-meta {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-top: 2px;
        }
        .drawer-form footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          border-top: 1px solid #e2e8f0;
          padding-top: 8px;
          margin-top: 0;
          position: sticky;
          bottom: 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, #ffffff 100%);
          backdrop-filter: blur(8px);
        }
        .form-actions {
          display: flex;
          gap: 8px;
        }
        .btn-ghost,
        .btn-danger,
        .btn-link-danger {
          border-radius: 12px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          min-height: 40px;
          font-family: "Inter", "Poppins", "Segoe UI", Arial, sans-serif;
        }
        .btn-ghost {
          border: 1px solid #d6deea;
          background: #e2e8f0;
          color: #0f172a;
        }
        .btn-danger {
          border: 1px solid #be123c;
          background: #be123c;
          color: #fff;
        }
        .btn-link-danger {
          border: 1px solid #fecdd3;
          background: #fff;
          color: #be123c;
        }
        .drawer-form footer .btn-primary {
          border: none;
          border-radius: 12px;
          padding: 8px 14px;
          min-height: 40px;
          background: linear-gradient(135deg, #6a5aff 0%, #5b3df5 52%, #4b35d6 100%);
          color: #fff;
          box-shadow: 0 10px 20px rgba(91, 61, 245, 0.24);
        }
        .drawer-form footer .btn-primary:disabled {
          opacity: 0.72;
          box-shadow: none;
        }
        .drawer-form footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          border-top: 1px solid #e2e8f0;
          padding-top: 8px;
        }
        .confirm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.42);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1300;
          padding: 16px;
        }
        .confirm-card {
          width: min(430px, 100%);
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
        @media (max-width: 1100px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }
          .filters-row {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 760px) {
          .hero-head {
            flex-direction: column;
            align-items: stretch;
          }
          .hero-head h1 {
            font-size: 28px;
          }
          .bulk-bar,
          .pagination-row {
            flex-direction: column;
            align-items: stretch;
          }
          .drawer h3 {
            font-size: 34px;
          }
          .drawer {
            width: 100%;
            height: 100%;
            margin: 0;
            border-radius: 0;
            border-left: none;
            min-width: 0;
          }
          .drawer-backdrop {
            left: 0;
          }
        }
        @media (max-width: 1100px) {
          .drawer-backdrop {
            left: 0;
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
      `}</style>
    </div>
  );
}
