"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { ToastContainer, toast } from "react-toastify";

type ApiList<T> = T[] | { results?: T[]; count?: number; next?: string | null; previous?: string | null };

type AdminSetupRow = { id: number; type: "1" | "2" | "3" | "4"; name: string };
type SelectOption = { value: string; label: string };
type VisitorRow = {
  id: number;
  purpose: string;
  name: string;
  phone?: string;
  visitor_id: string;
  no_of_person: number;
  date: string;
  in_time: string;
  out_time: string;
  file_url?: string;
  created_by_name?: string | null;
};

type SortKey = "name" | "date" | "in_time" | "out_time";
type SortDir = "asc" | "desc";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message && message !== "[object Object]") return message;
  }
  return fallback;
}

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

function getTotalCount<T>(value: ApiList<T>): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value.count === "number") return value.count;
  return (value.results || []).length;
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

async function apiForm<T>(path: string, method: "POST" | "PATCH", formData: FormData): Promise<T> {
  return apiRequestWithRefresh<T>(path, { method, body: formData });
}

async function apiDelete(path: string): Promise<void> {
  await apiRequestWithRefresh<void>(path, { method: "DELETE", headers: { "Content-Type": "application/json" } });
}

function boxStyle() {
  return { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 } as const;
}

function fieldStyle() {
  return { width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" } as const;
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

function displayValue(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return <span style={{ color: "#94a3b8", fontStyle: "italic" }}>N/A</span>;
  return text;
}

function parseTimeToMinutes(value: string) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function VisitorBookPanel() {
  const [items, setItems] = useState<VisitorRow[]>([]);
  const [purposeOptions, setPurposeOptions] = useState<SelectOption[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formBanner, setFormBanner] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [purpose, setPurpose] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [noOfPerson, setNoOfPerson] = useState("1");
  const [date, setDate] = useState("");
  const [inTime, setInTime] = useState("");
  const [outTime, setOutTime] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [tableBusy, setTableBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [deleteTarget, setDeleteTarget] = useState<VisitorRow | null>(null);

  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const load = async (targetPage = page, targetPageSize = pageSize) => {
    try {
      setLoading(true);
      setError("");
      const [visitorData, setupData] = await Promise.all([
        apiGet<ApiList<VisitorRow>>(`/api/v1/admissions/visitors/?page=${targetPage}&page_size=${targetPageSize}`),
        apiGet<ApiList<AdminSetupRow>>("/api/v1/admissions/admin-setups/"),
      ]);
      const rows = listData(visitorData);
      const count = getTotalCount(visitorData);
      setItems(rows);
      setTotalRecords(count);
      setTotalPages(Math.max(1, Math.ceil(count / targetPageSize)));
      const setups = listData(setupData);
      setPurposeOptions(setups.filter((entry) => entry.type === "1").map((entry) => ({ value: String(entry.id), label: entry.name })));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to load visitor book records."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDate(todayDate);
  }, [todayDate]);

  useEffect(() => {
    void load(page, pageSize);
  }, [page, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!formBanner) return;
    const timer = window.setTimeout(() => setFormBanner(""), 5000);
    return () => window.clearTimeout(timer);
  }, [formBanner]);

  useEffect(() => {
    if (loading) {
      setTableBusy(true);
      return;
    }
    setTableBusy(true);
    const timer = window.setTimeout(() => setTableBusy(false), 250);
    return () => window.clearTimeout(timer);
  }, [loading, search, items, sortKey, sortDir, page, pageSize]);

  const resetForm = () => {
    setEditingId(null);
    setPurpose("");
    setName("");
    setPhone("");
    setNoOfPerson("1");
    setDate(todayDate);
    setInTime("");
    setOutTime("");
    setFileUrl("");
    setFileUpload(null);
    setFieldErrors({});
    setFormBanner("");
  };

  const editRow = (row: VisitorRow) => {
    const matchedPurpose = purposeOptions.find((option) => option.value === row.purpose || option.label === row.purpose);
    setEditingId(row.id);
    setPurpose(matchedPurpose?.value || row.purpose || "");
    setName(row.name || "");
    setPhone(row.phone || "");
    setNoOfPerson(String(row.no_of_person || 1));
    setDate(row.date || "");
    setInTime(row.in_time || "");
    setOutTime(row.out_time || "");
    setFileUrl(row.file_url || "");
    setFieldErrors({});
    setFormBanner("");
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!purpose.trim()) nextErrors.purpose = "Purpose is required.";
    if (!name.trim()) nextErrors.name = "Name is required.";
    if (name.trim() && !/^[A-Za-z\s\-']+$/.test(name.trim())) nextErrors.name = "Name must contain only letters, spaces, and hyphens";
    if (!date) nextErrors.date = "Date is required.";
    if (!inTime.trim()) nextErrors.inTime = "In time is required.";
    if (!outTime.trim()) nextErrors.outTime = "Out time is required.";
    if (phone.trim() && !/^\+?\d{10,12}$/.test(phone.trim())) nextErrors.phone = "Phone number must be 10-12 digits";

    const personCount = Number(noOfPerson);
    if (!noOfPerson.trim() || !Number.isInteger(personCount) || personCount < 1 || personCount > 99) nextErrors.noOfPerson = "Enter a valid number of persons";
    const inMinutes = parseTimeToMinutes(inTime);
    const outMinutes = parseTimeToMinutes(outTime);
    if (inMinutes !== null && outMinutes !== null && outMinutes <= inMinutes) nextErrors.outTime = "Out time must be after in time.";
    if (fileUpload && fileUpload.size > 5 * 1024 * 1024) nextErrors.attachment = "Attachment must be 5MB or smaller.";

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setFormBanner("Please fix the errors below before submitting.");
      setError("Please fix the errors below before submitting.");
      toast.error("Please fix the errors below before submitting.", { autoClose: 5000 });
      return;
    }

    const formData = new FormData();
    formData.append("purpose", purpose.trim());
    formData.append("name", name.trim());
    formData.append("phone", phone.trim());
    formData.append("no_of_person", String(personCount));
    formData.append("date", date);
    formData.append("in_time", inTime.trim());
    formData.append("out_time", outTime.trim());
    if (fileUpload) formData.append("file_upload", fileUpload);

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setFieldErrors({});
      setFormBanner("");
      if (editingId) {
        await apiForm(`/api/v1/admissions/visitors/${editingId}/`, "PATCH", formData);
        setSuccess("Record updated successfully.");
        toast.success("Record updated successfully.", { autoClose: 4000 });
      } else {
        await apiForm("/api/v1/admissions/visitors/", "POST", formData);
        setSuccess("Record created successfully.");
        toast.success("Record created successfully.", { autoClose: 4000 });
      }
      resetForm();
      await load();
    } catch (err: unknown) {
      const message = getErrorMessage(err, editingId ? "Unable to update visitor." : "Unable to add visitor.");
      setError(message);
      toast.error(message, { autoClose: 6000 });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      setBusyId(id);
      setError("");
      setSuccess("");
      await apiDelete(`/api/v1/admissions/visitors/${id}/`);
      setSuccess("Record deleted successfully.");
      toast.success("Record deleted successfully.", { autoClose: 4000 });
      const nextPage = page > 1 && items.length === 1 ? page - 1 : page;
      if (nextPage !== page) {
        setPage(nextPage);
      } else {
        await load(nextPage, pageSize);
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Unable to delete visitor record.");
      setError(message);
      toast.error(message, { autoClose: 6000 });
    } finally {
      setBusyId(null);
    }
  };

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = !q ? items : items.filter((row) => [row.name, row.purpose, row.phone || "", row.visitor_id].join(" ").toLowerCase().includes(q));
    const next = [...filtered];
    next.sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * mult;
      if (sortKey === "date") return a.date.localeCompare(b.date) * mult;
      if (sortKey === "in_time") return a.in_time.localeCompare(b.in_time) * mult;
      return a.out_time.localeCompare(b.out_time) * mult;
    });
    return next;
  }, [items, search, sortKey, sortDir]);

  return (
    <div className="legacy-panel">
      <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnHover />
      <section className="admin-visitor-area up_admin_visitor">
        <div className="container-fluid p-0">
          <div className="visitor-grid-container" style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(400px, 2fr)", gap: 12, alignItems: "start", width: "100%", maxWidth: "100%" }}>
            <div className="white-box" style={{ ...boxStyle(), height: "auto" }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Visitor" : "Add Visitor"}</h3>
              <p style={{ marginTop: 0, marginBottom: 10, color: "#64748b", fontSize: 12 }}>Fields marked with * are mandatory.</p>
              {formBanner ? <div style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#b91c1c", padding: "10px 12px", borderRadius: 8, marginBottom: 10, fontSize: 13 }}>{formBanner}</div> : null}
              <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
                <label htmlFor="vb-purpose" style={{ fontSize: 12, fontWeight: 600 }}>Purpose *</label>
                <select id="vb-purpose" required value={purpose} onChange={(e) => setPurpose(e.target.value)} style={fieldStyle()}>
                  <option value="" disabled hidden>Select Purpose *</option>
                  {purposeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <label htmlFor="vb-name" style={{ fontSize: 12, fontWeight: 600 }}>Name *</label>
                <input id="vb-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle()} />
                <label htmlFor="vb-phone" style={{ fontSize: 12, fontWeight: 600 }}>Phone</label>
                <input id="vb-phone" type="tel" inputMode="tel" maxLength={13} pattern="\+?\d{10,12}" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "").slice(0, 13))} style={fieldStyle()} />
                <label htmlFor="vb-no-of-person" style={{ fontSize: 12, fontWeight: 600 }}>Number of Persons *</label>
                <input id="vb-no-of-person" type="number" min={1} max={99} value={noOfPerson} onChange={(e) => setNoOfPerson(e.target.value)} style={fieldStyle()} />
                <label htmlFor="vb-date" style={{ fontSize: 12, fontWeight: 600 }}>Date *</label>
                <input id="vb-date" type="date" max={todayDate} value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle()} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <label htmlFor="vb-in-time" style={{ fontSize: 12, fontWeight: 600 }}>In Time *</label>
                    <input id="vb-in-time" type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} style={fieldStyle()} />
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <label htmlFor="vb-out-time" style={{ fontSize: 12, fontWeight: 600 }}>Out Time *</label>
                    <input id="vb-out-time" type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} style={fieldStyle()} />
                  </div>
                </div>
                <input id="vb-attachment" type="file" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx" onChange={(e) => setFileUpload(e.target.files?.[0] ?? null)} style={{ ...fieldStyle(), padding: 6 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={saving} style={buttonStyle()}>{saving ? "Saving..." : editingId ? "Update" : "Save"}</button>
                  {editingId ? <button type="button" onClick={resetForm} style={buttonStyle("#6b7280")}>Cancel</button> : null}
                </div>
              </form>
            </div>
            <div className="white-box" style={boxStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ margin: 0 }}>Visitor List</h3>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Quick search" style={{ ...fieldStyle(), width: 240 }} />
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 800, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>SL</th>
                      <th onClick={() => toggleSort("name")} style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer" }}>Name</th>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Phone</th>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Purpose</th>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Date</th>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && filteredSorted.length === 0 ? <tr><td colSpan={6} style={{ padding: 12, color: "var(--text-muted)" }}>No visitor records found.</td></tr> : null}
                    {filteredSorted.map((row, index) => (
                      <tr key={row.id}>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{(page - 1) * pageSize + index + 1}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.name}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(row.phone)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(row.purpose)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.date}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                          <button type="button" onClick={() => editRow(row)} style={buttonStyle("#0ea5e9")}>Edit</button>
                          <button type="button" onClick={() => setDeleteTarget(row)} style={{ ...buttonStyle("#dc2626"), marginLeft: 6 }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tableBusy ? <p style={{ marginTop: 10, color: "var(--text-muted)" }}>Loading records...</p> : null}
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#64748b", fontSize: 12 }}>Showing page {page} of {totalPages} ({totalRecords} total records)</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label htmlFor="vb-page-size" style={{ fontSize: 12, color: "#475569" }}>Page size</label>
                  <select
                    id="vb-page-size"
                    value={pageSize}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setPage(1);
                      setPageSize(next);
                    }}
                    style={{ ...fieldStyle(), width: 96 }}
                  >
                    {[5, 10, 20, 30, 40, 50].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <button type="button" disabled={loading || page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))} style={buttonStyle("#64748b")}>Previous</button>
                  <button type="button" disabled={loading || page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} style={buttonStyle("#0f766e")}>Next</button>
                </div>
              </div>
              {error ? <p style={{ marginTop: 10, color: "var(--warning)" }}>{error}</p> : null}
              {!loading && success ? <p style={{ marginTop: 10, color: "#0f766e" }}>{success}</p> : null}
            </div>
          </div>
        </div>
      </section>
      {deleteTarget ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16 }}>
            <h3 style={{ margin: 0, marginBottom: 8 }}>Confirm Delete</h3>
            <p style={{ marginTop: 0, marginBottom: 16, color: "#475569" }}>Are you sure you want to delete this visitor record? This action cannot be undone.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setDeleteTarget(null)} style={buttonStyle("#94a3b8")}>Cancel</button>
              <button type="button" onClick={async () => { const id = deleteTarget.id; setDeleteTarget(null); await remove(id); }} style={buttonStyle("#dc2626")}>Delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
