"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { buildPaginationQuery, extractListData, extractPaginationMeta, type ListApiResponse } from "@/lib/pagination";
import { PaginationControls } from "@/components/common/PaginationControls";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { usePersistentPagination } from "@/hooks/usePersistentPagination";

type RoleItem = {
  id: number;
  name: string;
  is_system: boolean;
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

function inputStyle() {
  return {
    width: "100%",
    height: 40,
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "0 10px",
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

export function RoleManagementPanel() {
  const { page, pageSize, setPage, setPageSize } = usePersistentPagination("roles.list", 1, 10);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<RoleItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [roleName, setRoleName] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const loadRoles = async (targetPage = page, targetPageSize = pageSize) => {
    setLoading(true);
    setError("");
    try {
      const query = buildPaginationQuery(targetPage, targetPageSize, { search: search.trim() || undefined });
      const data = await apiRequestWithRefresh<ListApiResponse<RoleItem>>(`/api/v1/access-control/roles/?${query}`);
      const items = extractListData(data);
      const meta = extractPaginationMeta(data);
      setRoles(items);
      setTotalCount(meta?.count ?? items.length);
    } catch {
      setError("Unable to load role list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadRoles();
    }, 250);
    return () => window.clearTimeout(handle);
  }, [page, pageSize, search]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const resetForm = () => {
    setEditingRoleId(null);
    setRoleName("");
    setFieldError("");
  };

  const isValidRoleName = (value: string) => /^[A-Za-z0-9 ]+$/.test(value);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = roleName.trim();
    if (!normalized) {
      setFieldError("Role name is required.");
      setError("Please fix the highlighted field.");
      setSuccess("");
      return;
    }
    if (!isValidRoleName(normalized)) {
      setFieldError("Role name can contain only letters, numbers, and spaces.");
      setError("Please fix the highlighted field.");
      setSuccess("");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setFieldError("");
      const isUpdate = editingRoleId !== null;
      await apiRequestWithRefresh(`/api/v1/access-control/roles/${isUpdate ? `${editingRoleId}/` : ""}`, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalized }),
      });
      resetForm();
      setSuccess(isUpdate ? "Role updated successfully." : "Role created successfully.");
      await loadRoles(page, pageSize);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save role.";
      setError(message);
      setSuccess("");
      if (message.toLowerCase().includes("name")) {
        setFieldError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: RoleItem) => {
    setEditingRoleId(row.id);
    setRoleName(row.name);
    setFieldError("");
    setSuccess("");
  };

  const remove = async (id: number) => {
    try {
      setDeletingId(id);
      setError("");
      setSuccess("");
      await apiRequestWithRefresh(`/api/v1/access-control/roles/${id}/`, { method: "DELETE" });
      if (editingRoleId === id) resetForm();
      setSuccess("Role deleted successfully.");
      const nextRoles = roles.filter((row) => row.id !== id);
      if (nextRoles.length === 0 && page > 1) {
        setPage(page - 1);
      }
      await loadRoles(nextRoles.length === 0 && page > 1 ? page - 1 : page, pageSize);
    } catch (err) {
      setError("Unable to delete role.");
    } finally {
      setDeletingId(null);
      setDeleteCandidate(null);
    }
  };

  return (
    <section className="admin-visitor-area up_st_admin_visitor">
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Role Permission</h1>
      </div>

      {error && <div style={{ color: "var(--warning)", marginBottom: 10 }}>{error}</div>}
      {success && <div style={{ color: "#16a34a", marginBottom: 10 }}>{success}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "330px 1fr", gap: 12 }}>
        <div style={boxStyle()}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingRoleId ? "Edit Role" : "Add Role"}</h3>
          <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>NAME *</span>
              <input
                value={roleName}
                onChange={(e) => {
                  setRoleName(e.target.value);
                  if (fieldError) setFieldError("");
                  if (error) setError("");
                }}
                style={{
                  ...inputStyle(),
                  borderColor: fieldError ? "#dc2626" : "var(--line)",
                  boxShadow: fieldError ? "0 0 0 2px rgba(220, 38, 38, 0.15)" : "none",
                }}
              />
              {fieldError ? (
                <span id="role-name-error" style={{ fontSize: 12, color: "#dc2626" }}>
                  {fieldError}
                </span>
              ) : null}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={saving} style={buttonStyle()}>
                {saving ? "Saving..." : "Save"}
              </button>
              {editingRoleId ? (
                <button type="button" onClick={resetForm} style={buttonStyle("#6b7280")}>Cancel</button>
              ) : null}
            </div>
          </form>
        </div>

        <div style={boxStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Role List</h3>
            <input
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
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Role</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Type</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.name}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.is_system ? "System" : "Custom"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Link href={`/roles/assign-permission/${row.id}`} style={buttonStyle("#7c3aed")}>Assign Permission</Link>
                        <button type="button" onClick={() => startEdit(row)} style={buttonStyle("#0ea5e9")}>Edit</button>
                        {!row.is_system ? (
                          <button type="button" onClick={() => setDeleteCandidate(row)} style={buttonStyle("#dc2626")}>Delete</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: 12, borderBottom: "1px solid var(--line)", color: "var(--text-muted)" }}>
                      No Data Available.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
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
        title="Delete Role"
        message="Are you sure you want to delete this record?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isConfirming={deletingId !== null}
        onConfirm={() => deleteCandidate ? void remove(deleteCandidate.id) : undefined}
        onCancel={() => setDeleteCandidate(null)}
      />
    </section>
  );
}
