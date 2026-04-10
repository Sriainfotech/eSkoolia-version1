"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { buildPaginationQuery, extractListData, extractPaginationMeta, type ListApiResponse } from "@/lib/pagination";
import { PaginationControls } from "@/components/common/PaginationControls";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { usePersistentPagination } from "@/hooks/usePersistentPagination";

type ApiList<T> = T[] | { results?: T[] };

type SchoolRow = {
  id: number;
  name: string;
  code: string;
  subdomain?: string;
  is_active: boolean;
  created_at?: string;
};

type MePayload = {
  is_superuser: boolean;
  is_school_admin: boolean;
  school_id: number | null;
};

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message && message !== "[object Object]") {
      return message;
    }
  }
  return fallback;
}

function boxStyle() {
  return {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: 16,
  } as const;
}

function fieldStyle() {
  return {
    width: "100%",
    height: 36,
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
  } as const;
}

export function SchoolManagementPanel() {
  const { page, pageSize, setPage, setPageSize } = usePersistentPagination("schools.list", 1, 10);
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [me, setMe] = useState<MePayload | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<SchoolRow | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [isActive, setIsActive] = useState(true);

  const isSuperuser = !!me?.is_superuser;

  const load = async (targetPage = page, targetPageSize = pageSize) => {
    try {
      setLoading(true);
      setError("");
      const [meData, schoolsData] = await Promise.all([
        apiRequestWithRefresh<MePayload>("/api/v1/auth/me/"),
        apiRequestWithRefresh<ListApiResponse<SchoolRow>>(`/api/v1/tenancy/schools/?${buildPaginationQuery(targetPage, targetPageSize)}`),
      ]);
      setMe(meData);
      const items = extractListData(schoolsData);
      const meta = extractPaginationMeta(schoolsData);
      setRows(items);
      setTotalCount(meta?.count ?? items.length);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load schools."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(page, pageSize);
  }, [page, pageSize]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setCode("");
    setSubdomain("");
    setIsActive(true);
  };

  const canSave = useMemo(() => {
    if (editingId !== null) {
      return true;
    }
    return isSuperuser;
  }, [editingId, isSuperuser]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim() || !code.trim()) {
      setError("School name and code are required.");
      setSuccess("");
      return;
    }

    if (!canSave) {
      setError("Only superusers can add new schools.");
      return;
    }

    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      subdomain: subdomain.trim(),
      is_active: isActive,
    };

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (editingId) {
        await apiRequestWithRefresh(`/api/v1/tenancy/schools/${editingId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSuccess("School updated successfully.");
      } else {
        await apiRequestWithRefresh("/api/v1/tenancy/schools/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSuccess("School added successfully.");
      }

      resetForm();
      await load(page, pageSize);
    } catch (err) {
      setError(getErrorMessage(err, editingId ? "Unable to update school." : "Unable to add school."));
      setSuccess("");
    } finally {
      setSaving(false);
    }
  };

  const edit = (row: SchoolRow) => {
    setEditingId(row.id);
    setName(row.name || "");
    setCode(row.code || "");
    setSubdomain(row.subdomain || "");
    setIsActive(!!row.is_active);
    setError("");
    setSuccess("");
  };

  const remove = async (id: number) => {
    if (!isSuperuser) {
      setError("Only superusers can delete schools.");
      return;
    }

    try {
      setBusyId(id);
      setError("");
      setSuccess("");
      await apiRequestWithRefresh(`/api/v1/tenancy/schools/${id}/`, { method: "DELETE" });
      const remaining = rows.filter((row) => row.id !== id);
      if (editingId === id) {
        resetForm();
      }
      setSuccess("School deleted successfully.");
      if (remaining.length === 0 && page > 1) {
        setPage(page - 1);
      }
      await load(remaining.length === 0 && page > 1 ? page - 1 : page, pageSize);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to delete school."));
    } finally {
      setBusyId(null);
      setDeleteCandidate(null);
    }
  };

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>School Setup</h1>
            <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
              <span>Dashboard</span>
              <span>/</span>
              <span>Settings</span>
              <span>/</span>
              <span>Schools</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_admin_visitor">
        <div className="container-fluid p-0">
          {error ? <div style={{ color: "var(--warning)", marginBottom: 10 }}>{error}</div> : null}
          {success ? <div style={{ color: "#16a34a", marginBottom: 10 }}>{success}</div> : null}

          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 12 }}>
            <div className="white-box" style={boxStyle()}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit School" : "Add School"}</h3>
              {!isSuperuser && editingId === null ? (
                <p style={{ marginTop: 0, color: "var(--text-muted)", fontSize: 13 }}>
                  Only superusers can add new schools. You can still update your assigned school.
                </p>
              ) : null}

              <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>SCHOOL NAME *</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle()} />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>SCHOOL CODE *</span>
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} style={fieldStyle()} />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>SUBDOMAIN</span>
                  <input value={subdomain} onChange={(e) => setSubdomain(e.target.value)} style={fieldStyle()} />
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  Active
                </label>

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={saving || !canSave} style={buttonStyle()}>
                    {saving ? "Saving..." : editingId ? "Update" : "Save"}
                  </button>
                  {editingId ? (
                    <button type="button" onClick={resetForm} style={buttonStyle("#6b7280")}>Cancel</button>
                  ) : null}
                </div>
              </form>
            </div>

            <div className="white-box" style={boxStyle()}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>School List</h3>
              {loading ? (
                <p style={{ margin: 0, color: "var(--text-muted)" }}>Loading schools...</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Name</th>
                        <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Code</th>
                        <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Subdomain</th>
                        <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Status</th>
                        <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: "10px", color: "var(--text-muted)" }}>No Data Available.</td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <tr key={row.id}>
                            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{row.name}</td>
                            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{row.code}</td>
                            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{row.subdomain || "-"}</td>
                            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>
                              {row.is_active ? "Active" : "Inactive"}
                            </td>
                            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", display: "flex", gap: 8 }}>
                              <button type="button" onClick={() => edit(row)} style={buttonStyle("#0ea5e9")}>Edit</button>
                              {isSuperuser ? (
                                <button
                                  type="button"
                                  onClick={() => setDeleteCandidate(row)}
                                  disabled={busyId === row.id}
                                  style={buttonStyle("#dc2626")}
                                >
                                  {busyId === row.id ? "Deleting..." : "Delete"}
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <PaginationControls
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
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
        </div>
      </section>

      <ConfirmationModal
        isOpen={deleteCandidate !== null}
        title="Delete School"
        message="Are you sure you want to delete this record?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isConfirming={busyId !== null}
        onConfirm={() => deleteCandidate ? void remove(deleteCandidate.id) : undefined}
        onCancel={() => setDeleteCandidate(null)}
      />
    </div>
  );
}
