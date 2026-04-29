"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { buildPaginationQuery, extractListData, extractPaginationMeta, type ListApiResponse } from "@/lib/pagination";
import { PaginationControls } from "@/components/common/PaginationControls";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { usePersistentPagination } from "@/hooks/usePersistentPagination";
import { useToast } from "@/components/common/Toast";

type AcademicYear = {
  id: number;
  name: string;
};

type FeesGroup = {
  id: number;
  name: string;
  description?: string;
  academic_year: number;
  is_active: boolean;
  created_at: string;
};

function boxStyle() {
  return {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: 14,
  } as const;
}

function inputStyle(error = false) {
  return {
    width: "100%",
    height: 40,
    border: `1px solid ${error ? "#dc2626" : "var(--line)"}`,
    borderRadius: 8,
    padding: "0 10px",
    boxShadow: error ? "0 0 0 2px rgba(220, 38, 38, 0.15)" : "none",
  } as const;
}

function buttonStyle(color = "var(--primary)") {
  return {
    height: 36,
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 8,
    padding: "0 12px",
    cursor: "pointer",
    fontSize: 13,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  } as const;
}

export function FeesGroupPanel() {
  const { page, pageSize, setPage, setPageSize } = usePersistentPagination("fees-groups.list", 1, 10);
  const toast = useToast();
  const [feesGroups, setFeesGroups] = useState<FeesGroup[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteCandidate, setDeleteCandidate] = useState<FeesGroup | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAcademicYear, setFormAcademicYear] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);

  const loadAcademicYears = async () => {
    try {
      const data = await apiRequestWithRefresh<ListApiResponse<AcademicYear>>("/api/v1/core/academic-years/");
      const items = extractListData(data);
      setAcademicYears(items);
      if (items.length > 0 && !formAcademicYear) {
        setFormAcademicYear(String(items[0].id));
      }
    } catch (err) {
      toast.showApiError(err, "Unable to load academic years");
      console.error("Unable to load academic years");
    }
  };

  const loadFeesGroups = async (targetPage = page, targetPageSize = pageSize) => {
    setLoading(true);
    setError("");
    try {
      const query = buildPaginationQuery(targetPage, targetPageSize, { search: search.trim() || undefined });
      const data = await apiRequestWithRefresh<ListApiResponse<FeesGroup>>(`/api/v1/fees/fees-groups/?${query}`);
      const items = extractListData(data);
      const meta = extractPaginationMeta(data);
      setFeesGroups(items);
      setTotalCount(meta?.count ?? items.length);
    } catch (err) {
      toast.showApiError(err, "Unable to load fees groups.");
      setError("Unable to load fees groups.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAcademicYears();
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadFeesGroups();
    }, 250);
    return () => window.clearTimeout(handle);
  }, [page, pageSize, search]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const trimmedName = formName.trim();
    if (!trimmedName) {
      errors.name = "Fees group name is required.";
    } else if (trimmedName.length > 100) {
      errors.name = "Fees group name must not exceed 100 characters.";
    }

    if (formDescription.length > 500) {
      errors.description = "Description must not exceed 500 characters.";
    }

    if (!formAcademicYear) {
      errors.academicYear = "Academic year is required.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setEditingId(null);
    setFormName("");
    setFormDescription("");
    setFormIsActive(true);
    if (academicYears.length > 0) {
      setFormAcademicYear(String(academicYears[0].id));
    }
    setFieldErrors({});
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      setError("Please fix the highlighted fields.");
      setSuccess("");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setFieldErrors({});

      const payload = {
        name: formName.trim(),
        description: formDescription.trim(),
        academic_year: parseInt(formAcademicYear, 10),
        is_active: formIsActive,
      };

      const isUpdate = editingId !== null;
      await apiRequestWithRefresh(`/api/v1/fees/fees-groups/${isUpdate ? `${editingId}/` : ""}`, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      resetForm();
      setSuccess(isUpdate ? "Fees group updated successfully." : "Fees group created successfully.");
      await loadFeesGroups(page, pageSize);
    } catch (err) {
      toast.showApiError(err, "Unable to save fees group.");
      setError("Unable to save fees group.");
      setSuccess("");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: FeesGroup) => {
    setEditingId(row.id);
    setFormName(row.name);
    setFormDescription(row.description || "");
    setFormAcademicYear(String(row.academic_year));
    setFormIsActive(row.is_active);
    setFieldErrors({});
    setSuccess("");
  };

  const remove = async (id: number) => {
    try {
      setDeletingId(id);
      setError("");
      setSuccess("");
      await apiRequestWithRefresh(`/api/v1/fees/fees-groups/${id}/`, { method: "DELETE" });
      if (editingId === id) resetForm();
      setSuccess("Fees group deleted successfully.");
      const nextRows = feesGroups.filter((row) => row.id !== id);
      if (nextRows.length === 0 && page > 1) {
        setPage(page - 1);
      }
      await loadFeesGroups(nextRows.length === 0 && page > 1 ? page - 1 : page, pageSize);
    } catch (err) {
      toast.showApiError(err, "Unable to delete fees group.");
      setError("Unable to delete fees group.");
    } finally {
      setDeletingId(null);
      setDeleteCandidate(null);
    }
  };

  return (
    <section className="admin-visitor-area up_st_admin_visitor">
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Fees Groups Management</h1>
      </div>

      {error && <div style={{ color: "var(--warning)", marginBottom: 10 }}>{error}</div>}
      {success && <div style={{ color: "#16a34a", marginBottom: 10 }}>{success}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "330px 1fr", gap: 12 }}>
        <div style={boxStyle()}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Fees Group" : "Add Fees Group"}</h3>
          <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>NAME *</span>
              <input
                type="text"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
                  if (error) setError("");
                }}
                maxLength={100}
                style={{
                  ...inputStyle(!!fieldErrors.name),
                }}
              />
              {fieldErrors.name ? (
                <span style={{ fontSize: 12, color: "#dc2626" }}>{fieldErrors.name}</span>
              ) : null}
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>DESCRIPTION</span>
              <textarea
                value={formDescription}
                onChange={(e) => {
                  setFormDescription(e.target.value);
                  if (fieldErrors.description) setFieldErrors((prev) => ({ ...prev, description: "" }));
                  if (error) setError("");
                }}
                maxLength={500}
                rows={4}
                style={{
                  width: "100%",
                  border: `1px solid ${fieldErrors.description ? "#dc2626" : "var(--line)"}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  boxShadow: fieldErrors.description ? "0 0 0 2px rgba(220, 38, 38, 0.15)" : "none",
                  fontFamily: "inherit",
                }}
              />
              {fieldErrors.description ? (
                <span style={{ fontSize: 12, color: "#dc2626" }}>{fieldErrors.description}</span>
              ) : null}
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>ACADEMIC YEAR *</span>
              <select
                value={formAcademicYear}
                onChange={(e) => {
                  setFormAcademicYear(e.target.value);
                  if (fieldErrors.academicYear) setFieldErrors((prev) => ({ ...prev, academicYear: "" }));
                  if (error) setError("");
                }}
                style={{
                  ...inputStyle(!!fieldErrors.academicYear),
                }}
              >
                <option value="">-- Select Academic Year --</option>
                {academicYears.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {fieldErrors.academicYear ? (
                <span style={{ fontSize: 12, color: "#dc2626" }}>{fieldErrors.academicYear}</span>
              ) : null}
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => {
                  setFormIsActive(e.target.checked);
                  if (error) setError("");
                }}
              />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Active</span>
            </label>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={saving} style={buttonStyle()}>
                {saving ? "Saving..." : "Save"}
              </button>
              {editingId ? (
                <button type="button" onClick={resetForm} style={buttonStyle("#6b7280")}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div style={boxStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Fees Groups List</h3>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search"
              style={{ ...inputStyle(), width: 280, height: 36 }}
            />
          </div>

          {loading ? <div style={{ color: "var(--text-muted)" }}>Loading...</div> : null}

          {!loading && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Description</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Academic Year</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {feesGroups.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.name}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.description || "-"}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        {academicYears.find((item) => item.id === row.academic_year)?.name || "-"}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        {row.is_active ? (
                          <span style={{ color: "#16a34a", fontWeight: 600 }}>Active</span>
                        ) : (
                          <span style={{ color: "var(--warning)" }}>Inactive</span>
                        )}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => startEdit(row)} style={buttonStyle("#0ea5e9")}>
                            Edit
                          </button>
                          <button type="button" onClick={() => setDeleteCandidate(row)} style={buttonStyle("#dc2626")}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {feesGroups.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 12, borderBottom: "1px solid var(--line)", color: "var(--text-muted)" }}>
                        No Data Available.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}

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
        </div>
      </div>

      <ConfirmationModal
        isOpen={deleteCandidate !== null}
        title="Delete Fees Group"
        message="Are you sure you want to delete this fees group? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isConfirming={deletingId !== null}
        onConfirm={() => (deleteCandidate ? void remove(deleteCandidate.id) : undefined)}
        onCancel={() => setDeleteCandidate(null)}
      />
    </section>
  );
}
