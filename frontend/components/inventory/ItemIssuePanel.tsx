"use client";

import { useEffect, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type ItemStore = { id: number; title: string };
type Item = { id: number; name: string; quantity: number };
type ItemIssue = {
  id: number;
  issue_date?: string;
  store_id: number;
  store_title: string;
  item_id: number;
  item_name: string;
  quantity: number;
  subject?: string;
  notes?: string;
  issued_by_name?: string;
  created_at: string;
};

export function ItemIssuePanel() {
  const today = new Date().toISOString().slice(0, 10);
  const [issues, setIssues] = useState<ItemIssue[]>([]);
  const [stores, setStores] = useState<ItemStore[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [formData, setFormData] = useState({
    issue_date: today,
    store: "",
    item: "",
    quantity: 0,
    subject: "",
    notes: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const readApiFieldErrors = (err: unknown) => {
    const details = (err as { details?: unknown } | null)?.details;
    if (!details || typeof details !== "object" || Array.isArray(details)) return null;

    const payload = details as Record<string, unknown>;
    const rawFieldErrors =
      payload.field_errors && typeof payload.field_errors === "object"
        ? (payload.field_errors as Record<string, unknown>)
        : {};

    const pick = (key: string) => {
      const value = payload[key] ?? rawFieldErrors[key];
      if (typeof value === "string") return value;
      if (Array.isArray(value) && value.length > 0) return String(value[0]);
      return "";
    };

    const next: Record<string, string> = {};
    const issueDateError = pick("issue_date");
    const storeError = pick("store");
    const subjectError = pick("subject");
    const notesError = pick("notes");
    const detail = pick("detail") || pick("non_field_errors");
    const topMessage = typeof payload.message === "string" ? payload.message.trim() : "";

    if (issueDateError) next.issue_date = issueDateError;
    if (storeError) next.store = storeError;
    if (subjectError) next.subject = subjectError;
    if (notesError) next.notes = notesError;

    const summary = topMessage || detail || issueDateError || storeError || subjectError || notesError;
    if (summary) next.main = summary;

    return Object.keys(next).length > 0 ? next : null;
  };

  const validateForm = () => {
    const next: Record<string, string> = {};

    if (!formData.issue_date) next.issue_date = "Issue date is required.";
    if (!formData.store) next.store = "Store is required.";
    if (!formData.item) next.item = "Item is required.";
    if (!Number.isFinite(formData.quantity) || formData.quantity <= 0) {
      next.quantity = "Quantity must be greater than 0.";
    }

    setFieldErrors(next);
    if (Object.keys(next).length > 0) {
      const required = [
        next.issue_date ? "Issue Date" : "",
        next.store ? "Store" : "",
        next.item ? "Item" : "",
        next.quantity ? "Quantity" : "",
      ].filter(Boolean);
      setError(`Please correct required fields: ${required.join(", ")}.`);
      return false;
    }
    return true;
  };

  const controlStyle = (key: string): React.CSSProperties => ({
    width: "100%",
    border: `1px solid ${fieldErrors[key] ? "#dc2626" : "var(--line)"}`,
    borderRadius: "6px",
    padding: "8px 12px",
    fontSize: "14px",
    boxSizing: "border-box",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const [issuesData, storesData, itemsData] = await Promise.all([
        apiRequestWithRefresh<any>("/api/v1/core/item-issues/", {
          headers: { "Content-Type": "application/json" },
        }),
        apiRequestWithRefresh<any>("/api/v1/core/item-stores/", {
          headers: { "Content-Type": "application/json" },
        }),
        apiRequestWithRefresh<any>("/api/v1/core/items/", {
          headers: { "Content-Type": "application/json" },
        }),
      ]);
      setIssues(Array.isArray(issuesData) ? issuesData : (issuesData?.results || []));
      setStores(Array.isArray(storesData) ? storesData : (storesData?.results || []));
      setItems(Array.isArray(itemsData) ? itemsData : (itemsData?.results || []));
    } catch (err) {
      setError("Unable to load data. " + (err instanceof Error ? err.message : ""));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setError("");
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `/api/v1/core/item-issues/${editingId}/` : "/api/v1/core/item-issues/";

      await apiRequestWithRefresh(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue_date: formData.issue_date,
          store: parseInt(formData.store),
          item: parseInt(formData.item),
          quantity: parseFloat(formData.quantity as any),
          subject: formData.subject,
          notes: formData.notes,
        }),
      });

      setFormData({
        issue_date: today,
        store: "",
        item: "",
        quantity: 0,
        subject: "",
        notes: "",
      });
      setFieldErrors({});
      setEditingId(null);
      setShowForm(false);
      await loadData();
    } catch (err) {
      const extracted = readApiFieldErrors(err);
      if (extracted) {
        const next = { ...extracted };
        delete next.main;
        setFieldErrors(next);
        setError(extracted.main || "Please correct the highlighted fields.");
      } else {
        setError("Unable to save issue. " + (err instanceof Error ? err.message : ""));
      }
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    try {
      await apiRequestWithRefresh(`/api/v1/core/item-issues/${id}/`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError("Unable to delete issue.");
    }
  };

  const searchTerm = search.toLowerCase();
  const filtered = issues.filter((i) => {
    const itemName = String(i.item_name || "").toLowerCase();
    const storeTitle = String(i.store_title || "").toLowerCase();
    return itemName.includes(searchTerm) || storeTitle.includes(searchTerm);
  });
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) return <div style={{ padding: "16px" }}>Loading...</div>;

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "bold" }}>Item Issues</h1>
        <Button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({
              issue_date: today,
              store: "",
              item: "",
              quantity: 0,
              subject: "",
              notes: "",
            });
            setFieldErrors({});
            setError("");
          }}
        >
          {showForm ? "Cancel" : "Add Issue"}
        </Button>
      </div>

      {error && (
        <div style={{ color: "red", padding: "8px", backgroundColor: "#ffe6e6", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "8px" }}>
                Issue Date *
              </label>
              <Input
                type="date"
                required
                value={formData.issue_date}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setFormData({ ...formData, issue_date: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, issue_date: "" }));
                }}
                style={{ borderColor: fieldErrors.issue_date ? "#dc2626" : undefined }}
              />
              {fieldErrors.issue_date ? <small style={{ color: "#dc2626" }}>{fieldErrors.issue_date}</small> : null}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "8px" }}>
                  Store *
                </label>
                <select
                  required
                  value={formData.store}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setFormData({ ...formData, store: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, store: "" }));
                  }}
                  style={controlStyle("store")}
                >
                  <option value="">Select store</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                {fieldErrors.store ? <small style={{ color: "#dc2626" }}>{fieldErrors.store}</small> : null}
              </div>
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "8px" }}>
                  Item *
                </label>
                <select
                  required
                  value={formData.item}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setFormData({ ...formData, item: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, item: "" }));
                  }}
                  style={controlStyle("item")}
                >
                  <option value="">Select item</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Available: {i.quantity})
                    </option>
                  ))}
                </select>
                {fieldErrors.item ? <small style={{ color: "#dc2626" }}>{fieldErrors.item}</small> : null}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "8px" }}>
                  Quantity *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={formData.quantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 });
                    setFieldErrors((prev) => ({ ...prev, quantity: "" }));
                  }}
                  style={{ borderColor: fieldErrors.quantity ? "#dc2626" : undefined }}
                />
                {fieldErrors.quantity ? <small style={{ color: "#dc2626" }}>{fieldErrors.quantity}</small> : null}
              </div>
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "8px" }}>
                  Subject
                </label>
                <Input
                  value={formData.subject}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setFormData({ ...formData, subject: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, subject: "" }));
                  }}
                  placeholder="e.g. Office Use, Classroom"
                  style={{ borderColor: fieldErrors.subject ? "#dc2626" : undefined }}
                />
                {fieldErrors.subject ? <small style={{ color: "#dc2626" }}>{fieldErrors.subject}</small> : null}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "8px" }}>Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setFormData({ ...formData, notes: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, notes: "" }));
                }}
                placeholder="Additional notes"
                style={{
                  ...controlStyle("notes"),
                  fontFamily: "inherit",
                }}
                rows={3}
              />
              {fieldErrors.notes ? <small style={{ color: "#dc2626" }}>{fieldErrors.notes}</small> : null}
            </div>

            <Button type="submit">{editingId ? "Update" : "Save"}</Button>
          </form>
        </Card>
      )}

      <div>
        <Input
          placeholder="Search by item or store..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          style={{ marginBottom: "16px" }}
        />
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--surface-secondary)" }}>
              <th style={{ border: "1px solid var(--line)", padding: "12px", textAlign: "left", fontWeight: "600" }}>
                Item
              </th>
              <th style={{ border: "1px solid var(--line)", padding: "12px", textAlign: "left", fontWeight: "600" }}>
                Store
              </th>
              <th style={{ border: "1px solid var(--line)", padding: "12px", textAlign: "right", fontWeight: "600" }}>
                Quantity
              </th>
              <th style={{ border: "1px solid var(--line)", padding: "12px", textAlign: "left", fontWeight: "600" }}>
                Subject
              </th>
              <th style={{ border: "1px solid var(--line)", padding: "12px", textAlign: "left", fontWeight: "600" }}>
                Issued By
              </th>
              <th style={{ border: "1px solid var(--line)", padding: "12px", textAlign: "left", fontWeight: "600" }}>
                Date
              </th>
              <th style={{ border: "1px solid var(--line)", padding: "12px", textAlign: "left", fontWeight: "600" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((i) => (
              <tr key={i.id}>
                <td style={{ border: "1px solid var(--line)", padding: "12px" }}>{i.item_name}</td>
                <td style={{ border: "1px solid var(--line)", padding: "12px" }}>{i.store_title}</td>
                <td style={{ border: "1px solid var(--line)", padding: "12px", textAlign: "right" }}>{i.quantity}</td>
                <td style={{ border: "1px solid var(--line)", padding: "12px" }}>{i.subject || "-"}</td>
                <td style={{ border: "1px solid var(--line)", padding: "12px" }}>{i.issued_by_name || "-"}</td>
                <td style={{ border: "1px solid var(--line)", padding: "12px" }}>
                  {new Date(i.created_at).toLocaleDateString()}
                </td>
                <td style={{ border: "1px solid var(--line)", padding: "12px" }}>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(i.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", padding: "12px", backgroundColor: "var(--surface-secondary)", borderRadius: "4px" }}>
          <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            Showing {paginatedData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <select
              value={itemsPerPage}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setItemsPerPage(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                border: "1px solid var(--line)",
                borderRadius: "4px",
                padding: "6px 12px",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span style={{ fontSize: "14px", minWidth: "100px", textAlign: "center" }}>
              Page {totalPages === 0 ? 0 : currentPage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
