"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { buildPaginationQuery, extractListData, extractPaginationMeta, type ListApiResponse } from "@/lib/pagination";
import { PaginationControls } from "@/components/common/PaginationControls";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { usePersistentPagination } from "@/hooks/usePersistentPagination";

type ItemCategory = {
  id: number;
  title: string;
  name?: string;
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

export function ItemCategoryPanel() {
  const { page, pageSize, setPage, setPageSize } = usePersistentPagination("item-categories.list", 1, 10);
  const [itemCategories, setItemCategories] = useState<ItemCategory[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<ItemCategory | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const [formTitle, setFormTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const loadItemCategories = async (targetPage = page, targetPageSize = pageSize) => {
    setLoading(true);
    setError("");
    try {
      const query = buildPaginationQuery(targetPage, targetPageSize, { search: search.trim() || undefined });
      const data = await apiRequestWithRefresh<ListApiResponse<ItemCategory>>(`/api/v1/core/item-categories/?${query}`);
      const items = extractListData(data);
      const meta = extractPaginationMeta(data);
      setItemCategories(items);
      setTotalCount(meta?.count ?? items.length);
    } catch {
      setError("Unable to load item categories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadItemCategories();
    }, 250);
    return () => window.clearTimeout(handle);
  }, [page, pageSize, search]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const validateForm = (): boolean => {
    const trimmedTitle = formTitle.trim();
    if (!trimmedTitle) {
      setFieldError("Item category name is required.");
      return false;
    }
    if (trimmedTitle.length > 100) {
      setFieldError("Item category name must not exceed 100 characters.");
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setEditingId(null);
    setFormTitle("");
    setFieldError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      setError("Please fix the highlighted field.");
      setSuccess("");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setFieldError("");

      const payload = {
        title: formTitle.trim(),
      };

      const isUpdate = editingId !== null;
      await apiRequestWithRefresh(`/api/v1/core/item-categories/${isUpdate ? `${editingId}/` : ""}`, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      resetForm();
      setSuccess(isUpdate ? "Item category updated successfully." : "Item category created successfully.");
      await loadItemCategories(page, pageSize);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save item category.";
      setError(message);
      setSuccess("");
      if (message.toLowerCase().includes("title") || message.toLowerCase().includes("name")) {
        setFieldError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: ItemCategory) => {
    setEditingId(row.id);
    setFormTitle(row.title || row.name || "");
    setFieldError("");
    setSuccess("");
  };

  const remove = async (id: number) => {
    try {
      setDeletingId(id);
      setError("");
      setSuccess("");
      await apiRequestWithRefresh(`/api/v1/core/item-categories/${id}/`, { method: "DELETE" });
      if (editingId === id) resetForm();
      setSuccess("Item category deleted successfully.");
      const nextRows = itemCategories.filter((row) => row.id !== id);
      if (nextRows.length === 0 && page > 1) {
        setPage(page - 1);
      }
      await loadItemCategories(nextRows.length === 0 && page > 1 ? page - 1 : page, pageSize);
    } catch (err) {
      setError("Unable to delete item category.");
    } finally {
      setDeletingId(null);
      setDeleteCandidate(null);
    }
  };

  return (
    <section className="admin-visitor-area up_st_admin_visitor">
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Item Categories Management</h1>
      </div>

      {error && <div style={{ color: "var(--warning)", marginBottom: 10 }}>{error}</div>}
      {success && <div style={{ color: "#16a34a", marginBottom: 10 }}>{success}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "330px 1fr", gap: 12 }}>
        <div style={boxStyle()}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Item Category" : "Add Item Category"}</h3>
          <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>NAME *</span>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => {
                  setFormTitle(e.target.value);
                  if (fieldError) setFieldError("");
                  if (error) setError("");
                }}
                maxLength={100}
                style={{
                  ...inputStyle(!!fieldError),
                }}
              />
              {fieldError ? (
                <span style={{ fontSize: 12, color: "#dc2626" }}>{fieldError}</span>
              ) : null}
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
            <h3 style={{ margin: 0 }}>Item Categories List</h3>
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
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Created</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {itemCategories.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.title || row.name || "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(row.created_at).toLocaleDateString()}
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
                {itemCategories.length === 0 ? (
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
        title="Delete Item Category"
        message="Are you sure you want to delete this item category? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isConfirming={deletingId !== null}
        onConfirm={() => (deleteCandidate ? void remove(deleteCandidate.id) : undefined)}
        onCancel={() => setDeleteCandidate(null)}
      />
    </section>
  );
}
