"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type StudentGroup = {
  id: number;
  name: string;
  description: string;
  students_count?: number;
};

type ApiList<T> =
  | T[]
  | {
      count?: number;
      next?: string | null;
      previous?: string | null;
      results?: T[];
    };

type ApiError = Error & {
  details?: {
    message?: string;
    field_errors?: Record<string, string | string[]>;
  };
};

type ToastConfig = {
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
};

function listData<T>(value: ApiList<T>): T[] {
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

async function apiDelete(path: string): Promise<void> {
  await apiRequestWithRefresh<void>(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
}

function fieldStyle(hasError = false) {
  return {
    width: "100%",
    height: 36,
    border: `1px solid ${hasError ? "#dc2626" : "var(--line)"}`,
    borderRadius: 8,
    padding: "0 10px",
    backgroundColor: hasError ? "#fef2f2" : "transparent",
    fontFamily: "inherit",
    fontSize: 13,
  } as const;
}

function textareaStyle(hasError = false) {
  return {
    width: "100%",
    minHeight: 80,
    border: `1px solid ${hasError ? "#dc2626" : "var(--line)"}`,
    borderRadius: 8,
    padding: 10,
    backgroundColor: hasError ? "#fef2f2" : "transparent",
    fontFamily: "inherit",
    fontSize: 13,
    resize: "none",
  } as const;
}

function btnStyle(color = "var(--primary)", disabled = false) {
  return {
    height: 36,
    padding: "0 14px",
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    opacity: disabled ? 0.6 : 1,
    fontFamily: "inherit",
    fontWeight: 500,
  } as const;
}

function secondaryBtnStyle(disabled = false) {
  return {
    height: 32,
    padding: "0 10px",
    border: "1px solid var(--line)",
    background: "transparent",
    color: "var(--primary)",
    borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
    opacity: disabled ? 0.6 : 1,
    fontFamily: "inherit",
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

function errorBoxStyle() {
  return {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "var(--radius)",
    padding: 12,
    marginBottom: 12,
    color: "#dc2626",
    fontSize: 13,
  } as const;
}

function successBoxStyle() {
  return {
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    borderRadius: "var(--radius)",
    padding: 12,
    marginBottom: 12,
    color: "#059669",
    fontSize: 13,
  } as const;
}

export function StudentGroupPanel() {
  const [rows, setRows] = useState<StudentGroup[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [toast, setToast] = useState<ToastConfig | null>(null);

  // Form validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Search and sorting
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "count">("name");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Delete confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<StudentGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  const clearFieldError = (field: "name" | "description") => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const allRows: StudentGroup[] = [];
      const fetchPageSize = 100;
      let page = 1;

      while (page <= 100) {
        const data = await apiGet<ApiList<StudentGroup>>(
          `/api/v1/students/groups/?page=${page}&page_size=${fetchPageSize}`,
        );
        const pageRows = listData(data);

        if (!pageRows.length) break;
        allRows.push(...pageRows);

        if (Array.isArray(data)) break;
        if (typeof data.count === "number" && allRows.length >= data.count) break;
        if (pageRows.length < fetchPageSize) break;

        page += 1;
      }

      setRows(allRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load groups";
      setError(message && message !== "401" ? message : "Unable to load student groups.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Show toast notification
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), toast.duration || 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Validate form fields
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = "Group name is required";
    } else if (name.trim().length < 3) {
      errors.name = "Minimum 3 characters required";
    } else {
      // Check for duplicate (exclude current editing group)
      const isDuplicate = rows.some(
        (row) => row.name.toLowerCase() === name.trim().toLowerCase() && row.id !== editingId,
      );
      if (isDuplicate) {
        errors.name = "Group already exists";
      }
    }

    if (description.trim().length > 255) {
      errors.description = "Maximum 255 characters allowed";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const reset = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setFieldErrors({});
    setError("");
    setSuccess("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = { name: name.trim(), description: description.trim() };
      const isEdit = !!editingId;

      if (isEdit) {
        await apiPatch(`/api/v1/students/groups/${editingId}/`, payload);
      } else {
        await apiPost("/api/v1/students/groups/", payload);
      }

      setToast({
        message: isEdit ? "✓ Group updated successfully" : "✓ Group created successfully",
        type: "success",
      });
      reset();
      await load();
      setCurrentPage(1);
    } catch (err) {
      const err_ = err as ApiError;
      const message = err_.details?.message || err_.message || "Unable to save group";
      setError(message && message !== "401" ? message : "Unable to save student group.");
      setToast({ message: "✗ Failed to save group", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (row: StudentGroup) => {
    setEditingId(row.id);
    setName(row.name);
    setDescription(row.description || "");
    setFieldErrors({});
    setError("");
    setSuccess("");
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDeleteClick = (row: StudentGroup) => {
    setDeleteConfirm(row);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      setDeleting(true);
      setError("");
      await apiDelete(`/api/v1/students/groups/${deleteConfirm.id}/`);

      setToast({
        message: "✓ Group deleted successfully",
        type: "success",
      });

      if (editingId === deleteConfirm.id) {
        reset();
      }
      setDeleteConfirm(null);
      await load();
      setCurrentPage(1);
    } catch (err) {
      const err_ = err as ApiError;
      const message = err_.details?.message || err_.message;
      if (message && message.toLowerCase().includes("students")) {
        setError("Cannot delete group with assigned students");
        setToast({ message: "Cannot delete group with assigned students", type: "error" });
      } else {
        setError("Unable to delete student group.");
        setToast({ message: "✗ Failed to delete group", type: "error" });
      }
    } finally {
      setDeleting(false);
    }
  };

  // Filter and sort
  const filteredRows = useMemo(() => {
    let result = rows.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()));

    if (sortBy === "count") {
      result.sort((a, b) => (b.students_count ?? 0) - (a.students_count ?? 0));
    } else {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [rows, search, sortBy]);

  // Paginate
  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  useEffect(() => {
    if (totalPages === 0) {
      if (currentPage !== 1) setCurrentPage(1);
      return;
    }
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const hasFieldErrors = Object.values(fieldErrors).some((value) => Boolean(value));
  const isFormValid = name.trim().length >= 3 && description.trim().length <= 255 && !hasFieldErrors;

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>👥 Student Group</h1>
            <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
              <span>Dashboard</span>
              <span>/</span>
              <span>Student Information</span>
              <span>/</span>
              <span>Student Group</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0" style={{ display: "grid", gap: 16 }}>
          {/* Toast Notification */}
          {toast && (
            <div style={toast.type === "success" ? successBoxStyle() : errorBoxStyle()}>
              {toast.message}
            </div>
          )}

          {/* Form Section */}
          <div style={boxStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{editingId ? "✏️ Edit Student Group" : "➕ Add Student Group"}</h3>
              {editingId && (
                <button type="button" onClick={reset} style={secondaryBtnStyle(false)}>
                  ✕ Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                    Group Name <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      clearFieldError("name");
                    }}
                    placeholder="Enter group name"
                    style={fieldStyle(!!fieldErrors.name)}
                    disabled={saving}
                  />
                  {fieldErrors.name && <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0 0 0" }}>{fieldErrors.name}</p>}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                    Description <span style={{ fontSize: 11, color: "var(--text-muted)" }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      clearFieldError("description");
                    }}
                    placeholder="Enter description (max 255 characters)"
                    maxLength={255}
                    style={fieldStyle(!!fieldErrors.description)}
                    disabled={saving}
                  />
                  <p style={{ fontSize: 11, margin: "4px 0 0 0", color: "var(--text-muted)" }}>
                    {description.length}/255
                  </p>
                  {fieldErrors.description && (
                    <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0 0 0" }}>{fieldErrors.description}</p>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                {editingId && (
                  <button type="button" onClick={reset} style={secondaryBtnStyle(saving)}>
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving || !isFormValid}
                  style={btnStyle("var(--primary)", saving || !isFormValid)}
                >
                  {saving ? "💾 Saving..." : editingId ? "📝 Update Group" : "➕ Save Group"}
                </button>
              </div>

              {error && <div style={errorBoxStyle()}>{error}</div>}
            </form>
          </div>

          {/* List Section */}
          <div style={boxStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>📋 Student Group List</h3>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Total: {filteredRows.length}</span>
            </div>

            {/* Search and Sort */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 12, marginBottom: 16 }}>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="🔍 Search by group name..."
                style={fieldStyle()}
              />

              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "name" | "count")} style={fieldStyle()}>
                <option value="name">Sort: Name (A-Z)</option>
                <option value="count">Sort: Students Count</option>
              </select>

              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={fieldStyle()}>
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>

            {/* Table */}
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                <div style={{ fontSize: 18, marginBottom: 8 }}>⏳</div>
                <div>Loading groups...</div>
              </div>
            ) : paginatedRows.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  {filteredRows.length === 0 ? "No student groups found" : "No results"}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {filteredRows.length === 0 ? "Create one to get started." : "Try adjusting your search or filters."}
                </div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-muted)" }}>
                      <th style={{ padding: 12, borderBottom: "2px solid var(--line)", textAlign: "left", fontWeight: 600 }}>
                        Group Name
                      </th>
                      <th style={{ padding: 12, borderBottom: "2px solid var(--line)", textAlign: "center", fontWeight: 600 }}>
                        Students
                      </th>
                      <th style={{ padding: 12, borderBottom: "2px solid var(--line)", textAlign: "center", fontWeight: 600 }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: 12, fontWeight: 500 }}>{row.name}</td>
                        <td style={{ padding: 12, textAlign: "center" }}>
                          <span
                            style={{
                              background: "#dbeafe",
                              color: "#1e40af",
                              padding: "4px 8px",
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {row.students_count ?? 0}
                          </span>
                        </td>
                        <td style={{ padding: 12, textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            <button
                              type="button"
                              onClick={() => onEdit(row)}
                              style={secondaryBtnStyle(false)}
                              title="Edit group"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteClick(row)}
                              style={{
                                ...secondaryBtnStyle(false),
                                borderColor: "#fee2e2",
                                color: "#dc2626",
                              }}
                              title="Delete group"
                            >
                              🗑 Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", marginTop: 16 }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  style={secondaryBtnStyle(currentPage === 1)}
                >
                  ← Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      ...secondaryBtnStyle(false),
                      background: currentPage === page ? "var(--primary)" : "transparent",
                      color: currentPage === page ? "#fff" : "var(--primary)",
                      fontWeight: currentPage === page ? 600 : 400,
                    }}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  style={secondaryBtnStyle(currentPage === totalPages)}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "var(--radius)",
              padding: 24,
              maxWidth: 400,
              boxShadow: "0 10px 15px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 600 }}>⚠️ Delete Group</h3>
            <p style={{ margin: "0 0 20px 0", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Are you sure you want to delete the group <strong>&quot;{deleteConfirm.name}&quot;</strong>?
              {deleteConfirm.students_count ? (
                <span style={{ display: "block", marginTop: 8, color: "#dc2626", fontSize: 12 }}>
                  This group has {deleteConfirm.students_count} assigned student{deleteConfirm.students_count !== 1 ? "s" : ""}.
                  If you delete it, please ensure students are reassigned.
                </span>
              ) : null}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                style={secondaryBtnStyle(deleting)}
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDelete()}
                disabled={deleting}
                style={btnStyle("#dc2626", deleting)}
              >
                {deleting ? "Deleting..." : "🗑 Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
