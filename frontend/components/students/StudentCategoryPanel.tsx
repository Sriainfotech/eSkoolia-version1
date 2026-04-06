"use client";

import { FormEvent, useEffect, useState } from "react";
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
  };
};

type CategoryMutationResponse = {
  success?: boolean;
  message?: string;
  data?: StudentCategory;
};

type ApiList<T> = T[] | { results?: T[] };

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

async function apiDelete<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setError("");
      setSuccess("");
      const data = await apiGet<ApiList<StudentCategory>>("/api/v1/students/categories/");
      setRows(listData(data));
    } catch {
      setError("Unable to load student categories.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setCode("");
    setStatusValue("active");
    setFieldErrors({});
  };

  const setToastMessage = (message: string, isError = false) => {
    if (isError) {
      setError(message);
      setSuccess("");
      return;
    }
    setSuccess(message);
    setError("");
  };

  const clientValidationErrors = () => {
    const nextErrors: Record<string, string> = {};
    const trimmedName = name.trim();
    if (!trimmedName) {
      nextErrors.name = "Category name is required.";
    } else if (trimmedName.length < 2) {
      nextErrors.name = "Category name must be at least 2 characters.";
    } else if (trimmedName.length > 100) {
      nextErrors.name = "Category name must not exceed 100 characters.";
    }

    if (description.trim().length > 500) {
      nextErrors.description = "Description must not exceed 500 characters.";
    }

    if (code.trim().length > 30) {
      nextErrors.code = "Code must not exceed 30 characters.";
    }
    return nextErrors;
  };

  const isFormValid = Object.keys(clientValidationErrors()).length === 0;

  const applyApiFieldErrors = (apiError: ApiError, fallbackMessage: string) => {
    const details = apiError.details;
    const apiFieldErrors = details?.field_errors || {};
    const mapped: Record<string, string> = {};
    for (const [field, messages] of Object.entries(apiFieldErrors)) {
      mapped[field] = Array.isArray(messages) ? String(messages[0] || "") : String(messages || "");
    }
    setFieldErrors(mapped);
    setToastMessage(details?.message || apiError.message || fallbackMessage, true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = clientValidationErrors();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setToastMessage("Please correct the highlighted errors.", true);
      return;
    }
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const payload = {
        name: name.trim(),
        description: description.trim(),
        code: code.trim(),
        status: statusValue,
      };
      if (editingId) {
        const response = await apiPatch<CategoryMutationResponse>(`/api/v1/students/categories/${editingId}/`, payload);
        setToastMessage(response?.message || "Student category updated successfully.");
      } else {
        const response = await apiPost<CategoryMutationResponse>("/api/v1/students/categories/", payload);
        setToastMessage(response?.message || "Student category created successfully.");
      }
      resetForm();
      await load();
    } catch (err) {
      applyApiFieldErrors(err as ApiError, "Unable to save category.");
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (row: StudentCategory) => {
    setEditingId(row.id);
    setName(row.name);
    setDescription(row.description || "");
    setCode(row.code || "");
    setStatusValue(row.status || "active");
    setFieldErrors({});
    setError("");
    setSuccess("");
  };

  const onDelete = async (row: StudentCategory) => {
    const yes = window.confirm(`Delete category \"${row.name}\"?`);
    if (!yes) {
      return;
    }
    try {
      setError("");
      setSuccess("");
      const response = await apiDelete<CategoryMutationResponse>(`/api/v1/students/categories/${row.id}/`);
      if (editingId === row.id) {
        resetForm();
      }
      await load();
      setToastMessage(response?.message || "Student category deleted successfully.");
    } catch (err) {
      applyApiFieldErrors(err as ApiError, "Unable to delete category.");
    }
  };

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div className="student-maint-header">
            <h1 className="student-maint-title">Student Category</h1>
            <div className="student-maint-crumbs">
              <span>Dashboard</span>
              <span>/</span>
              <span>Student Information</span>
              <span>/</span>
              <span>Student Category</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          {editingId && (
            <div className="row student-maint-add-row">
              <div className="student-maint-add-wrap">
                <button type="button" className="student-btn student-btn-primary" onClick={resetForm}>
                  + Add
                </button>
              </div>
            </div>
          )}

          <div className="student-maint-layout">
            <div>
              <div className="white-box student-maint-form">
                <h3>{editingId ? "Edit Student Category" : "Add Student Category"}</h3>
                <form onSubmit={submit} className="student-maint-grid">
                  <div>
                    <label className="student-maint-label" htmlFor="student-category-name">Type *</label>
                    <input
                      id="student-category-name"
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setFieldErrors((prev) => ({ ...prev, name: "" }));
                      }}
                      placeholder="Category"
                      className="student-maint-input"
                    />
                    {fieldErrors.name && <p className="student-maint-error">{fieldErrors.name}</p>}
                  </div>

                  <div>
                    <label className="student-maint-label" htmlFor="student-category-code">Code</label>
                    <input
                      id="student-category-code"
                      value={code}
                      onChange={(event) => {
                        setCode(event.target.value);
                        setFieldErrors((prev) => ({ ...prev, code: "" }));
                      }}
                      placeholder="Optional code"
                      className="student-maint-input"
                    />
                    {fieldErrors.code && <p className="student-maint-error">{fieldErrors.code}</p>}
                  </div>

                  <div>
                    <label className="student-maint-label" htmlFor="student-category-status">Status</label>
                    <select
                      id="student-category-status"
                      value={statusValue}
                      onChange={(event) => setStatusValue(event.target.value as "active" | "inactive")}
                      className="student-maint-input"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label className="student-maint-label" htmlFor="student-category-description">Description</label>
                    <textarea
                      id="student-category-description"
                      value={description}
                      onChange={(event) => {
                        setDescription(event.target.value);
                        setFieldErrors((prev) => ({ ...prev, description: "" }));
                      }}
                      placeholder="Optional description"
                      className="student-maint-textarea"
                    />
                    {fieldErrors.description && <p className="student-maint-error">{fieldErrors.description}</p>}
                  </div>

                  <div className="student-maint-actions">
                    <button type="submit" disabled={saving || !isFormValid} className="student-btn student-btn-primary">
                      {saving ? "Saving..." : editingId ? "Update Category" : "Save Category"}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div>
              <div className="white-box student-maint-list">
                <h3>Student Category List</h3>
                <div className="student-maint-table-wrap">
                  <table className="student-maint-table">
                    <thead>
                      <tr>
                        <th>SL</th>
                        <th>Category</th>
                        <th>Code</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="student-maint-empty">
                            No categories found.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, index) => (
                          <tr key={row.id}>
                            <td>{index + 1}</td>
                            <td>{row.name}</td>
                            <td>{row.code || "-"}</td>
                            <td>{row.status === "inactive" ? "Inactive" : "Active"}</td>
                            <td>
                              <div className="student-maint-row-actions">
                                <button type="button" className="student-btn student-btn-info" onClick={() => onEdit(row)}>
                                  Edit
                                </button>
                                <button type="button" className="student-btn student-btn-danger" onClick={() => void onDelete(row)}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {error && <p className="student-maint-error">{error}</p>}
                {success && <p className="text-success">{success}</p>}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
