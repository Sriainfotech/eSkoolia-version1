"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { PaginationControls } from "@/components/common/PaginationControls";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { usePersistentPagination } from "@/hooks/usePersistentPagination";
import { buildPaginationQuery, extractListData, extractPaginationMeta, type ListApiResponse } from "@/lib/pagination";

type ItemCategory = {
  id: number;
  title: string;
  name?: string;
  created_at?: string;
};

type PaginatedResponse<T> = {
  success?: boolean;
  message?: string;
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

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
  await apiRequestWithRefresh<void>(path, { method: "DELETE", headers: { "Content-Type": "application/json" } });
}

function fieldStyle() {
  return { width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" } as const;
}

function buttonStyle(color = "var(--primary)") {
  return { height: 34, border: `1px solid ${color}`, background: color, color: "#fff", borderRadius: 8, padding: "0 10px", cursor: "pointer", fontSize: 13 } as const;
}

function boxStyle() {
  return { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 } as const;
}

export function ItemCategoryPanel() {
  const { page, pageSize, setPage, setPageSize } = usePersistentPagination("inventory.items.categories", 1, 10);
  const [rows, setRows] = useState<ItemCategory[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounce, setSearchDebounce] = useState("");

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<ItemCategory | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 when search changes
  useEffect(() => {
    if (search !== "") {
      setPage(1);
    }
  }, [search, setPage]);

  const loadData = async (pageNum = 1, pageSizeNum = 10) => {
    try {
      setLoading(true);
      const query = buildPaginationQuery(pageNum, pageSizeNum, { search: searchDebounce });
      const response = await apiGet<ListApiResponse<ItemCategory>>(`/api/v1/core/item-categories/?${query}`);
      const listData = extractListData(response);
      const meta = extractPaginationMeta(response);
      setRows(listData);
      if (meta) {
        setTotalCount(meta.count);
        setTotalPages(Math.ceil(meta.count / pageSizeNum));
      }
      setError("");
    } catch {
      setError("Unable to load item categories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(page, pageSize);
  }, [page, pageSize, searchDebounce]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("Category title is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const payload = { title: title.trim() };
      if (editingId) {
        await apiPatch(`/api/v1/core/item-categories/${editingId}/`, payload);
        setToast("Category updated successfully.");
      } else {
        await apiPost("/api/v1/core/item-categories/", payload);
        setToast("Category created successfully.");
      }
      setEditingId(null);
      setTitle("");
      await loadData(1, pageSize);
      setPage(1);
    } catch {
      setError("Unable to save category.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      setDeletingId(id);
      await apiDelete(`/api/v1/core/item-categories/${id}/`);
      const remaining = rows.filter((r) => r.id !== id);
      if (remaining.length === 0 && page > 1) {
        setPage(page - 1);
      } else {
        await loadData(page, pageSize);
      }
      setToast("Category deleted successfully.");
    } catch {
      setError("Unable to delete category.");
    } finally {
      setDeleteCandidate(null);
      setDeletingId(null);
    }
  };

  return (
    <div className="legacy-panel">
      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Item Category" : "Add Item Category"}</h3>
            <form onSubmit={submit} style={{ display: "flex", gap: 8 }}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Category Title *" style={{ ...fieldStyle(), flex: 1 }} disabled={saving} />
              <button type="submit" style={buttonStyle()} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update" : "Save"}
              </button>
            </form>
            {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
            {toast && <p style={{ color: "var(--success)", marginTop: 8 }}>{toast}</p>}
          </div>

          <div className="white-box" style={boxStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Item Categories</h3>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title..." style={{ ...fieldStyle(), maxWidth: 250 }} />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Title</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Created</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={3} style={{ padding: 12, textAlign: "center" }}>Loading...</td></tr>}
                  {!loading && rows.length === 0 && <tr><td colSpan={3} style={{ padding: 12, color: "var(--text-muted)", textAlign: "center" }}>No categories found.</td></tr>}
                  {!loading && rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.title || row.name || "-"}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.created_at ? new Date(row.created_at).toLocaleDateString() : "-"}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" style={buttonStyle("#0ea5e9")} onClick={() => { setEditingId(row.id); setTitle(row.title || row.name || ""); }}>Edit</button>
                          <button type="button" style={buttonStyle("#dc2626")} onClick={() => setDeleteCandidate(row)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls currentPage={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalCount} onPageChange={setPage} onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }} loading={loading} pageSizeOptions={[10, 25, 50]} />
          </div>
        </div>
      </section>
      <ConfirmationModal isOpen={deleteCandidate !== null} title="Delete Item Category?" message={`Are you sure you want to delete "${deleteCandidate?.title || deleteCandidate?.name}"?`} confirmLabel="Delete" cancelLabel="Cancel" onConfirm={() => deleteCandidate ? void remove(deleteCandidate.id) : undefined} onCancel={() => setDeleteCandidate(null)} isConfirming={deletingId !== null} />
    </div>
  );
}
