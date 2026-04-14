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

type StudentOption = {
  id: number;
  admission_no?: string;
  first_name: string;
  last_name?: string;
  student_group?: number | null;
};

type SchoolClassOption = {
  id: number;
  name?: string;
  class_name?: string;
};

type SectionOption = {
  id: number;
  name: string;
  school_class: number;
};

const SEARCH_STATE_KEY = "students.group.uiState";

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

function totalCountFromApi<T>(value: ApiList<T>): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  return typeof value.count === "number" ? value.count : (value.results || []).length;
}

function sanitizePlainText(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
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
    minHeight: 72,
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "count">("name");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Delete confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<StudentGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [assignGroup, setAssignGroup] = useState<StudentGroup | null>(null);
  const [assignStudents, setAssignStudents] = useState<StudentOption[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [assignClasses, setAssignClasses] = useState<SchoolClassOption[]>([]);
  const [assignSections, setAssignSections] = useState<SectionOption[]>([]);
  const [assignClassId, setAssignClassId] = useState("");
  const [assignSectionId, setAssignSectionId] = useState("");

  const clearFieldError = (field: "name" | "description") => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const load = async (targetPage = currentPage, targetPageSize = pageSize, targetSearch = debouncedSearch, targetSort = sortBy) => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("page_size", String(targetPageSize));
      if (targetSearch.trim()) {
        params.set("search", targetSearch.trim());
      }
      params.set("sort_by", targetSort);

      const data = await apiGet<ApiList<StudentGroup>>(`/api/v1/students/groups/?${params.toString()}`);
      setRows(listData(data));
      setTotalCount(totalCountFromApi(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load groups";
      setError(message && message !== "401" ? message : "Unable to load student groups.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(SEARCH_STATE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as {
        search?: string;
        sortBy?: "name" | "count";
        currentPage?: number;
        pageSize?: number;
      };
      if (typeof state.search === "string") setSearch(state.search);
      if (state.sortBy === "name" || state.sortBy === "count") setSortBy(state.sortBy);
      if (typeof state.currentPage === "number" && state.currentPage > 0) setCurrentPage(state.currentPage);
      if (typeof state.pageSize === "number" && [10, 25, 50].includes(state.pageSize)) setPageSize(state.pageSize);
    } catch {
      // Ignore persisted state parse issues and continue with defaults.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void load(currentPage, pageSize, debouncedSearch, sortBy);
  }, [currentPage, pageSize, debouncedSearch, sortBy]);

  useEffect(() => {
    window.sessionStorage.setItem(
      SEARCH_STATE_KEY,
      JSON.stringify({ search, sortBy, currentPage, pageSize }),
    );
  }, [search, sortBy, currentPage, pageSize]);

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
    const normalizedName = sanitizePlainText(name);
    const normalizedDescription = sanitizePlainText(description);

    if (!normalizedName) {
      errors.name = "Group name is required";
    } else if (normalizedName.length < 3) {
      errors.name = "Minimum 3 characters required";
    } else {
      // Check for duplicate (exclude current editing group)
      const isDuplicate = rows.some(
        (row) => row.name.toLowerCase() === normalizedName.toLowerCase() && row.id !== editingId,
      );
      if (isDuplicate) {
        errors.name = "Group name already exists";
      }
    }

    if (normalizedDescription.length > 255) {
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

      const payload = {
        name: sanitizePlainText(name),
        description: sanitizePlainText(description),
      };
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
      await load(1, pageSize, debouncedSearch, sortBy);
      setCurrentPage(1);
    } catch (err) {
      const err_ = err as ApiError;
      const message = err_.details?.message || err_.message || "Unable to save group";
      const fieldNameError = err_.details?.field_errors?.name;
      if (fieldNameError) {
        setFieldErrors((prev) => ({ ...prev, name: Array.isArray(fieldNameError) ? String(fieldNameError[0]) : String(fieldNameError) }));
      }
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

  const openAssignModal = async (row: StudentGroup) => {
    try {
      setAssignLoading(true);
      setAssignGroup(row);
      setAssignSearch("");
      setSelectedStudentIds([]);
      setAssignClassId("");
      setAssignSectionId("");

      const [classData, sectionData, studentData] = await Promise.all([
        apiGet<ApiList<SchoolClassOption>>("/api/v1/core/classes/?page_size=500"),
        apiGet<ApiList<SectionOption>>("/api/v1/core/sections/?page_size=500"),
        apiGet<ApiList<StudentOption>>("/api/v1/students/students/?is_active=true&page_size=500"),
      ]);

      setAssignClasses(listData(classData));
      setAssignSections(listData(sectionData));
      setAssignStudents(listData(studentData));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load students.";
      setError(message && message !== "401" ? message : "Unable to load students for assignment.");
      setAssignGroup(null);
    } finally {
      setAssignLoading(false);
    }
  };

  const loadAssignableStudents = async (classFilter = assignClassId, sectionFilter = assignSectionId) => {
    try {
      setAssignLoading(true);
      const params = new URLSearchParams();
      params.set("is_active", "true");
      params.set("page_size", "500");
      if (classFilter) params.set("class_id", classFilter);
      if (sectionFilter) params.set("section_id", sectionFilter);

      const data = await apiGet<ApiList<StudentOption>>(`/api/v1/students/students/?${params.toString()}`);
      setAssignStudents(listData(data));
      setSelectedStudentIds([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load students.";
      setToast({ message: message || "Unable to load students.", type: "error" });
    } finally {
      setAssignLoading(false);
    }
  };

  const filteredSectionsByClass = useMemo(() => {
    if (!assignClassId) return assignSections;
    const classIdNum = Number(assignClassId);
    return assignSections.filter((section) => Number(section.school_class) === classIdNum);
  }, [assignSections, assignClassId]);

  const submitAssignStudents = async () => {
    if (!assignGroup || selectedStudentIds.length === 0) {
      setToast({ message: "Select at least one student.", type: "error" });
      return;
    }
    try {
      setAssigning(true);
      await apiPost(`/api/v1/students/groups/${assignGroup.id}/assign-students/`, {
        student_ids: selectedStudentIds,
      });
      setAssignGroup(null);
      setSelectedStudentIds([]);
      setAssignSearch("");
      setToast({ message: "✓ Students assigned to group successfully", type: "success" });
      await load(currentPage, pageSize, debouncedSearch, sortBy);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to assign students.";
      setToast({ message: message || "Unable to assign students.", type: "error" });
    } finally {
      setAssigning(false);
    }
  };

  const filteredAssignableStudents = useMemo(() => {
    const query = assignSearch.trim().toLowerCase();
    return assignStudents.filter((student) => {
      if (student.student_group && student.student_group === assignGroup?.id) {
        return false;
      }
      if (!query) {
        return true;
      }
      const name = `${student.first_name || ""} ${student.last_name || ""}`.trim().toLowerCase();
      const admission = String(student.admission_no || "").toLowerCase();
      return name.includes(query) || admission.includes(query);
    });
  }, [assignStudents, assignSearch, assignGroup]);

  const visibleAssignableStudentIds = useMemo(
    () => filteredAssignableStudents.map((student) => student.id),
    [filteredAssignableStudents],
  );

  const allVisibleSelected = useMemo(
    () =>
      visibleAssignableStudentIds.length > 0
      && visibleAssignableStudentIds.every((id) => selectedStudentIds.includes(id)),
    [visibleAssignableStudentIds, selectedStudentIds],
  );

  const toggleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedStudentIds((prev) => {
        const merged = new Set(prev);
        visibleAssignableStudentIds.forEach((id) => merged.add(id));
        return Array.from(merged);
      });
      return;
    }

    setSelectedStudentIds((prev) => prev.filter((id) => !visibleAssignableStudentIds.includes(id)));
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
      await load(currentPage, pageSize, debouncedSearch, sortBy);
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

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

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
  const isFormValid = sanitizePlainText(name).length >= 3 && sanitizePlainText(description).length <= 255 && !hasFieldErrors;

  return (
    <div className="legacy-panel student-group-panel">
      <style>{`
        .student-group-panel button:focus,
        .student-group-panel input:focus,
        .student-group-panel textarea:focus,
        .student-group-panel select:focus {
          outline: 2px solid #5d87ff;
          outline-offset: 2px;
        }

        @media (max-width: 900px) {
          .student-group-panel .group-form-grid {
            grid-template-columns: 1fr;
          }

          .student-group-panel .group-filter-grid {
            grid-template-columns: 1fr;
            align-items: stretch;
          }

          .student-group-panel .group-form-actions {
            width: 100%;
          }

          .student-group-panel .group-form-actions button {
            width: 100%;
          }

          .student-group-panel .group-list-header {
            align-items: flex-start;
            gap: 8px;
          }
        }

        @media (max-width: 640px) {
          .student-group-panel .group-table-actions {
            justify-content: flex-start;
            flex-wrap: wrap;
          }

          .student-group-panel .group-pagination {
            flex-wrap: wrap;
            justify-content: flex-start;
          }
        }
      `}</style>
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
        <div className="container-fluid p-0" style={{ display: "grid", gap: 12 }}>
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

            <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
              <div className="group-form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 12, alignItems: "start" }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                    Group Name <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value.replace(/<[^>]*>/g, ""));
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
                  <textarea
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value.replace(/<[^>]*>/g, ""));
                      clearFieldError("description");
                    }}
                    placeholder="Enter description (max 255 characters)"
                    maxLength={255}
                    rows={3}
                    style={textareaStyle(!!fieldErrors.description)}
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

              <div className="group-form-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-start", flexWrap: "wrap" }}>
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
            <div className="group-list-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>📋 Student Group List</h3>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Total: {totalCount}</span>
            </div>

            {/* Search and Sort */}
            <div className="group-filter-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 12, marginBottom: 16, alignItems: "end" }}>
              <div>
                <label htmlFor="student-group-search" style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>
                  Search Groups
                </label>
                <input
                  id="student-group-search"
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by group name..."
                  style={fieldStyle()}
                />
              </div>

              <div>
                <label htmlFor="student-group-sort" style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>
                  Sort By
                </label>
                <select id="student-group-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as "name" | "count")} style={fieldStyle()}>
                  <option value="name">Name (A-Z)</option>
                  <option value="count">Students Count</option>
                </select>
              </div>

              <div>
                <label htmlFor="student-group-page-size" style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-muted)" }}>
                  Rows
                </label>
                <select id="student-group-page-size" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ ...fieldStyle(), color: "#333" }}>
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                <div style={{ fontSize: 18, marginBottom: 8 }}>⏳</div>
                <div>Loading groups...</div>
              </div>
            ) : rows.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  {search.trim() ? "No groups found matching your search" : "No student groups found"}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {search.trim() ? "Try adjusting your search term." : "Create one to get started."}
                </div>
                {search.trim() ? (
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setCurrentPage(1);
                      }}
                      style={secondaryBtnStyle(false)}
                    >
                      Clear Search
                    </button>
                  </div>
                ) : null}
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
                    {rows.map((row) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td
                          style={{
                            padding: 12,
                            fontWeight: 500,
                            maxWidth: 320,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            wordBreak: "break-word",
                          }}
                          title={row.name}
                        >
                          {row.name}
                        </td>
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
                          <div className="group-table-actions" style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            <button
                              type="button"
                              onClick={() => onEdit(row)}
                              style={secondaryBtnStyle(false)}
                              aria-label={`Edit group ${row.name}`}
                              title="Edit group"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void openAssignModal(row)}
                              style={{
                                ...secondaryBtnStyle(false),
                                borderColor: "#dbeafe",
                                color: "#1d4ed8",
                              }}
                              aria-label={`Assign students to ${row.name}`}
                              title="Assign students"
                            >
                              👥 Assign
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteClick(row)}
                              style={{
                                ...secondaryBtnStyle(false),
                                borderColor: "#fee2e2",
                                color: "#dc2626",
                              }}
                              aria-label={`Delete group ${row.name}`}
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
              <div className="group-pagination" style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", marginTop: 16 }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  style={secondaryBtnStyle(currentPage === 1)}
                >
                  ← Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(Math.max(0, currentPage - 4), Math.max(0, currentPage - 4) + 7)
                  .map((page) => (
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

      {assignGroup && (
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
            padding: 16,
          }}
        >
          <div style={{ background: "#fff", borderRadius: "var(--radius)", padding: 20, maxWidth: 620, width: "100%" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: 18, fontWeight: 600 }}>Assign Students to {assignGroup.name}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <select
                value={assignClassId}
                onChange={(event) => {
                  const nextClassId = event.target.value;
                  setAssignClassId(nextClassId);
                  setAssignSectionId("");
                  void loadAssignableStudents(nextClassId, "");
                }}
                style={fieldStyle(false)}
              >
                <option value="">All classes</option>
                {assignClasses.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.class_name || schoolClass.name || `Class ${schoolClass.id}`}
                  </option>
                ))}
              </select>
              <select
                value={assignSectionId}
                onChange={(event) => {
                  const nextSectionId = event.target.value;
                  setAssignSectionId(nextSectionId);
                  void loadAssignableStudents(assignClassId, nextSectionId);
                }}
                style={fieldStyle(false)}
                disabled={!assignClassId}
              >
                <option value="">{assignClassId ? "All sections" : "Select class first"}</option>
                {filteredSectionsByClass.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={assignSearch}
              onChange={(event) => setAssignSearch(event.target.value)}
              placeholder="Search by name or admission number"
              style={{ ...fieldStyle(false), marginBottom: 10 }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13, color: "var(--text-muted)" }}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(event) => toggleSelectAllVisible(event.target.checked)}
                disabled={assignLoading || visibleAssignableStudentIds.length === 0}
              />
              <span>Select all visible ({visibleAssignableStudentIds.length})</span>
            </label>
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, maxHeight: 280, overflowY: "auto", padding: 8 }}>
              {assignLoading ? (
                <p style={{ margin: 0, color: "var(--text-muted)" }}>Loading students...</p>
              ) : filteredAssignableStudents.length === 0 ? (
                <p style={{ margin: 0, color: "var(--text-muted)" }}>No students available for assignment.</p>
              ) : (
                filteredAssignableStudents.map((student) => {
                  const label = `${student.first_name || ""} ${student.last_name || ""}`.trim() || student.admission_no || "Student";
                  return (
                    <label key={student.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 4px" }}>
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={(event) => {
                          setSelectedStudentIds((prev) => {
                            if (event.target.checked) {
                              return [...prev, student.id];
                            }
                            return prev.filter((id) => id !== student.id);
                          });
                        }}
                      />
                      <span>{label}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>({student.admission_no || "N/A"})</span>
                    </label>
                  );
                })
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{selectedStudentIds.length} selected</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    if (assigning) return;
                    setAssignGroup(null);
                    setSelectedStudentIds([]);
                  }}
                  style={secondaryBtnStyle(assigning)}
                  disabled={assigning}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitAssignStudents()}
                  style={btnStyle("#1d4ed8", assigning || selectedStudentIds.length === 0)}
                  disabled={assigning || selectedStudentIds.length === 0}
                >
                  {assigning ? "Assigning..." : "Assign Selected"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
