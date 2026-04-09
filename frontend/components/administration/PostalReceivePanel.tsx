"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";

type ApiList<T> = T[] | { results?: T[] };

type PostalReceiveRow = {
  id: number;
  from_title: string;
  reference_no: string;
  address: string;
  note?: string;
  to_title: string;
  date?: string;
  file_url?: string;
};

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

async function apiDelete(path: string): Promise<void> {
  await apiRequestWithRefresh<void>(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
}

async function apiForm<T>(path: string, method: "POST" | "PATCH", formData: FormData): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method,
    body: formData,
  });
}

function boxStyle() {
  return {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: 16,
  } as const;
}

function fieldStyle(hasError = false) {
  return {
    width: "100%",
    minHeight: 36,
    border: `1px solid ${hasError ? "#dc3545" : "#ced4da"}`,
    borderRadius: 8,
    padding: "0 10px",
  } as const;
}

function textAreaStyle(hasError = false) {
  return {
    width: "100%",
    minHeight: 76,
    border: `1px solid ${hasError ? "#dc3545" : "#ced4da"}`,
    borderRadius: 8,
    padding: "8px 10px",
    resize: "vertical" as const,
  };
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

function formatRange(start: number, end: number, total: number) {
  if (total === 0) return "Showing 0-0 of 0 records";
  return `Showing ${start}-${end} of ${total} records`;
}

function sanitizePlain(value: string) {
  return value.replace(/[<>&"']/g, "");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/[<>]/g, "");
}

function safeRender(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>&"']/g, "")
    .trim();
}

export function PostalReceivePanel() {
  const [items, setItems] = useState<PostalReceiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [fromTitle, setFromTitle] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [toTitle, setToTitle] = useState("");
  const [date, setDate] = useState("");
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<PostalReceiveRow | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error) {
      const msg = err.message?.trim();
      if (msg && msg !== "[object Object]") return msg;
    }
    return fallback;
  };

  const readApiFieldErrors = (err: unknown) => {
    const details = (err as { details?: unknown } | null)?.details;
    if (!details || typeof details !== "object") return null;
    const raw = details as Record<string, unknown>;
    const next: Record<string, string> = {};

    const pick = (key: string) => {
      const value = raw[key];
      if (typeof value === "string") return value;
      if (Array.isArray(value) && value.length > 0) return String(value[0]);
      return "";
    };

    const msg = pick("from_title") || pick("reference_no") || pick("address") || pick("to_title") || pick("date");
    if (msg) next.main = msg;
    if (pick("from_title")) next.fromTitle = pick("from_title");
    if (pick("reference_no")) next.referenceNo = pick("reference_no");
    if (pick("address")) next.address = pick("address");
    if (pick("to_title")) next.toTitle = pick("to_title");
    if (pick("date")) next.date = pick("date");
    if (pick("file_upload")) next.file = pick("file_upload");

    return Object.keys(next).length > 0 ? next : null;
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet<ApiList<PostalReceiveRow>>("/api/v1/admissions/postal-receive/");
      setItems(listData(data));
    } catch {
      setError("Unable to load postal receive records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDate(today);
    void load();
  }, [today]);

  const reset = () => {
    setEditingId(null);
    setFromTitle("");
    setReferenceNo("");
    setAddress("");
    setNote("");
    setToTitle("");
    setDate(today);
    setFileUpload(null);
    setFileUrl("");
    setFieldErrors({});
  };

  const setErrorField = (field: string, message: string) => {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  const validateField = (field: string, value?: string) => {
    const v = value ??
      (field === "fromTitle"
        ? fromTitle
        : field === "referenceNo"
          ? referenceNo
          : field === "address"
            ? address
            : field === "toTitle"
              ? toTitle
              : field === "date"
                ? date
                : "");

    if (field === "fromTitle") {
      if (!v.trim()) return "From Title is required.";
      if (v.trim().length < 3) return "From Title must be at least 3 characters.";
      return "";
    }

    if (field === "referenceNo") {
      if (!v.trim()) return "Reference No is required.";
      if (v.trim().length < 3) return "Reference No must be at least 3 characters.";
      if (!/^[A-Za-z0-9\-]+$/.test(v.trim())) return "Reference No can only contain letters, numbers, and hyphens.";
      return "";
    }

    if (field === "address") {
      if (!v.trim()) return "Address is required.";
      if (v.trim().length < 5) return "Address must be at least 5 characters.";
      return "";
    }

    if (field === "toTitle") {
      if (!v.trim()) return "To Title is required.";
      if (v.trim().length < 3) return "To Title must be at least 3 characters.";
      return "";
    }

    if (field === "date") {
      if (!v) return "Date is required.";
      if (v > today) return "Date cannot be in the future.";
      return "";
    }

    if (field === "file") {
      if (!fileUpload) return "";
      const fileName = fileUpload.name.toLowerCase();
      const allowed = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
      const ext = "." + (fileName.includes(".") ? fileName.split(".").pop() : "");
      if (!allowed.includes(ext)) return "Invalid file type. Allowed: PDF, DOC, JPG, PNG.";
      if (fileUpload.size > 5 * 1024 * 1024) return "File size exceeds 5MB limit.";
      return "";
    }

    return "";
  };

  const validateAll = () => {
    const keys = ["fromTitle", "referenceNo", "address", "toTitle", "date", "file"];
    const nextErrors: Record<string, string> = {};
    keys.forEach((key) => {
      const msg = validateField(key);
      if (msg) nextErrors[key] = msg;
    });
    setFieldErrors(nextErrors);
    return nextErrors;
  };

  const edit = (row: PostalReceiveRow) => {
    setEditingId(row.id);
    setFromTitle(sanitizePlain(row.from_title || ""));
    setReferenceNo(sanitizePlain(row.reference_no || ""));
    setAddress(sanitizePlain(row.address || ""));
    setNote(stripHtml(row.note || ""));
    setToTitle(sanitizePlain(row.to_title || ""));
    setDate(row.date || today);
    setFileUpload(null);
    setFileUrl(row.file_url || "");
    setFieldErrors({});
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const errs = validateAll();
    if (Object.keys(errs).length > 0) {
      setError("Please fix the errors below.");
      return;
    }

    const formData = new FormData();
    formData.append("from_title", fromTitle.trim());
    formData.append("reference_no", referenceNo.trim());
    formData.append("address", address.trim());
    formData.append("note", note.trim());
    formData.append("to_title", toTitle.trim());
    if (date) formData.append("date", date);
    if (fileUpload) formData.append("file_upload", fileUpload);

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setFieldErrors({});
      if (editingId) {
        await apiForm(`/api/v1/admissions/postal-receive/${editingId}/`, "PATCH", formData);
        setSuccess("Postal record updated successfully.");
      } else {
        await apiForm("/api/v1/admissions/postal-receive/", "POST", formData);
        setSuccess("Postal record saved successfully.");
      }
      reset();
      await load();
    } catch (err: unknown) {
      const apiFieldErrors = readApiFieldErrors(err);
      if (apiFieldErrors) {
        setFieldErrors(apiFieldErrors);
        setError(apiFieldErrors.main || "Please fix the errors below.");
      } else {
        setError(getErrorMessage(err, editingId ? "Unable to update postal record." : "Unable to save postal record."));
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      setBusyId(id);
      setError("");
      setSuccess("");
      await apiDelete(`/api/v1/admissions/postal-receive/${id}/`);
      setItems((prev) => prev.filter((row) => row.id !== id));
      setSuccess("Postal record deleted.");
    } catch {
      setError("Unable to delete postal record.");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) =>
      [row.from_title, row.reference_no, row.address, row.to_title, row.note || "", row.date || ""].join(" ").toLowerCase().includes(q),
    );
  }, [items, search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const pageRows = filtered.slice(start, end);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const pageText = formatRange(total ? start + 1 : 0, Math.min(end, total), total);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const from = Math.max(1, safePage - 2);
    const to = Math.min(totalPages, safePage + 2);
    for (let i = from; i <= to; i += 1) pages.push(i);
    return pages;
  }, [safePage, totalPages]);

  return (
    <div className="legacy-panel postal-receive-wrap">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Postal Receive</h1>
            <nav aria-label="Breadcrumb">
              <ol style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13, margin: 0, padding: 0, listStyle: "none" }}>
                <li><a href="/dashboard">Dashboard</a></li>
                <li>/</li>
                <li>Admin Section</li>
                <li>/</li>
                <li aria-current="page">Postal Receive</li>
              </ol>
            </nav>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_admin_visitor">
        <div className="container-fluid p-0" style={{ maxWidth: "100%" }}>
          <div className="postal-receive-grid" style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(400px, 2fr)", gap: 12, alignItems: "start", maxWidth: "100%", overflow: "hidden" }}>
            <div className="white-box postal-receive-form-panel" style={{ ...boxStyle(), height: "auto" }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Postal Receive" : "Add Postal Receive"}</h3>
              <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
                <div className="form-group">
                  <label htmlFor="pr-from-title">From Title *</label>
                  <input
                    id="pr-from-title"
                    name="fromTitle"
                    type="text"
                    required
                    minLength={3}
                    maxLength={100}
                    placeholder="e.g. Main Office"
                    value={fromTitle}
                    onInput={(e) => {
                      const cleaned = sanitizePlain(e.currentTarget.value).slice(0, 100);
                      setFromTitle(cleaned);
                      setErrorField("fromTitle", validateField("fromTitle", cleaned));
                    }}
                    onBlur={() => setErrorField("fromTitle", validateField("fromTitle", fromTitle))}
                    style={fieldStyle(Boolean(fieldErrors.fromTitle))}
                  />
                  <small className="form-error text-danger" style={{ display: fieldErrors.fromTitle ? "block" : "none" }}>{fieldErrors.fromTitle || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pr-reference-no">Reference No *</label>
                  <input
                    id="pr-reference-no"
                    name="referenceNo"
                    type="text"
                    required
                    minLength={3}
                    maxLength={50}
                    pattern="[A-Za-z0-9\-]+"
                    placeholder="e.g. PR-2026-001"
                    value={referenceNo}
                    onInput={(e) => {
                      const cleaned = e.currentTarget.value.replace(/[^A-Za-z0-9\-]/g, "").slice(0, 50);
                      setReferenceNo(cleaned);
                      setErrorField("referenceNo", validateField("referenceNo", cleaned));
                    }}
                    onBlur={() => setErrorField("referenceNo", validateField("referenceNo", referenceNo))}
                    style={fieldStyle(Boolean(fieldErrors.referenceNo))}
                  />
                  <small className="form-error text-danger" style={{ display: fieldErrors.referenceNo ? "block" : "none" }}>{fieldErrors.referenceNo || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pr-address">Address *</label>
                  <input
                    id="pr-address"
                    name="address"
                    type="text"
                    required
                    minLength={5}
                    maxLength={255}
                    placeholder="e.g. 123 Main Street, City"
                    value={address}
                    onInput={(e) => {
                      const cleaned = sanitizePlain(e.currentTarget.value).slice(0, 255);
                      setAddress(cleaned);
                      setErrorField("address", validateField("address", cleaned));
                    }}
                    onBlur={() => setErrorField("address", validateField("address", address))}
                    style={fieldStyle(Boolean(fieldErrors.address))}
                  />
                  <small className="form-error text-danger" style={{ display: fieldErrors.address ? "block" : "none" }}>{fieldErrors.address || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pr-note">Note</label>
                  <textarea
                    id="pr-note"
                    name="note"
                    maxLength={500}
                    rows={3}
                    placeholder="Optional notes"
                    value={note}
                    onInput={(e) => {
                      const cleaned = stripHtml(e.currentTarget.value).slice(0, 500);
                      setNote(cleaned);
                    }}
                    style={textAreaStyle(Boolean(fieldErrors.note))}
                  />
                  <small style={{ fontSize: 12, color: "#6b7280" }}>{note.length} / 500 characters</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pr-to-title">To Title *</label>
                  <input
                    id="pr-to-title"
                    name="toTitle"
                    type="text"
                    required
                    minLength={3}
                    maxLength={100}
                    placeholder="e.g. Recipient Name"
                    value={toTitle}
                    onInput={(e) => {
                      const cleaned = sanitizePlain(e.currentTarget.value).slice(0, 100);
                      setToTitle(cleaned);
                      setErrorField("toTitle", validateField("toTitle", cleaned));
                    }}
                    onBlur={() => setErrorField("toTitle", validateField("toTitle", toTitle))}
                    style={fieldStyle(Boolean(fieldErrors.toTitle))}
                  />
                  <small className="form-error text-danger" style={{ display: fieldErrors.toTitle ? "block" : "none" }}>{fieldErrors.toTitle || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pr-date">Date *</label>
                  <input
                    id="pr-date"
                    name="date"
                    type="date"
                    required
                    max={today}
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setErrorField("date", validateField("date", e.target.value));
                    }}
                    onBlur={() => setErrorField("date", validateField("date", date))}
                    style={fieldStyle(Boolean(fieldErrors.date))}
                  />
                  <small className="form-error text-danger" style={{ display: fieldErrors.date ? "block" : "none" }}>{fieldErrors.date || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pr-attachment">Attachment</label>
                  <input
                    id="pr-attachment"
                    name="attachment"
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setFileUpload(file);
                      if (!file) {
                        setErrorField("file", "");
                        return;
                      }
                      const msg = validateField("file");
                      if (msg) {
                        setErrorField("file", msg);
                        setFileUpload(null);
                        e.currentTarget.value = "";
                      } else {
                        setErrorField("file", "");
                      }
                    }}
                    style={{ ...fieldStyle(Boolean(fieldErrors.file)), padding: 6 }}
                  />
                  <small className="form-error text-danger" style={{ display: fieldErrors.file ? "block" : "none" }}>{fieldErrors.file || ""}</small>
                </div>

                {editingId && fileUrl ? <a href={fileUrl} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontSize: 12 }}>View existing file</a> : null}

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={saving} style={buttonStyle()}>{saving ? "Saving..." : editingId ? "Update" : "Save"}</button>
                  {editingId ? <button type="button" onClick={reset} style={buttonStyle("#6b7280")}>Cancel</button> : null}
                </div>
              </form>
            </div>

            <div className="white-box" style={boxStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
                <h3 style={{ margin: 0 }}>Postal Receive List</h3>
                <input
                  id="pr-search"
                  name="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Quick search"
                  aria-label="Search postal records"
                  style={{ ...fieldStyle(), maxWidth: "100%", width: 240 }}
                />
              </div>

              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", position: "relative" }}>
                <table aria-label="Postal Receive List" style={{ width: "100%", minWidth: 800, borderCollapse: "collapse" }}>
                  <caption className="sr-only">Postal Receive List</caption>
                  <thead>
                    <tr>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>From Title</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Reference No</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Address</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>To Title</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Note</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Date</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && pageRows.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: 12, color: "var(--text-muted)" }}>No postal receive records found.</td></tr>
                    ) : (
                      pageRows.map((row, index) => (
                        <tr key={row.id} style={{ background: index % 2 === 1 ? "#f8fafc" : "transparent" }}>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{safeRender(row.from_title)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{safeRender(row.reference_no)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{safeRender(row.address)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{safeRender(row.to_title)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            {row.note ? safeRender(row.note) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                          </td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{safeRender(row.date) || "—"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" aria-label={`Edit ${safeRender(row.reference_no)}`} onClick={() => edit(row)} style={buttonStyle("#0ea5e9")}>
                                Edit
                              </button>
                              <button type="button" aria-label={`Delete ${safeRender(row.reference_no)}`} disabled={busyId === row.id} onClick={() => setDeleteTarget(row)} style={buttonStyle("#dc2626")}>
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

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{pageText}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ ...fieldStyle(), width: 110 }}>
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                  </select>
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} style={buttonStyle("#64748b")}>Previous</button>
                  {pageNumbers.map((n) => (
                    <button key={n} type="button" onClick={() => setPage(n)} style={buttonStyle(n === safePage ? "var(--primary)" : "#94a3b8")}>
                      {n}
                    </button>
                  ))}
                  <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} style={buttonStyle("#64748b")}>Next</button>
                </div>
              </div>

              {loading && <p style={{ marginTop: 10, color: "var(--text-muted)" }}>Loading postal receive records...</p>}
              {error && <p style={{ marginTop: 10, color: "#dc3545" }}>{error}</p>}
              {success && <p style={{ marginTop: 10, color: "#0f766e" }}>{success}</p>}
            </div>
          </div>
        </div>
      </section>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title="Confirm Delete"
        message="Are you sure you want to delete this postal record? This action cannot be undone."
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        isConfirming={Boolean(deleteTarget && busyId === deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          setDeleteTarget(null);
          await remove(id);
        }}
      />

      <style jsx>{`
        .postal-receive-wrap {
          overflow-x: hidden;
        }

        .postal-receive-grid {
          width: 100%;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .form-group label {
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
        }

        .form-error {
          font-size: 12px;
          color: #dc3545;
          margin-top: 2px;
          display: block;
        }

        @media (max-width: 1100px) {
          .postal-receive-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 768px) {
          .postal-receive-form-panel {
            grid-column: 1 / -1;
          }
        }

        :global(body) {
          overflow-x: hidden;
        }

        :global(.dashboard-main),
        :global(.admin-visitor-area),
        :global(.container-fluid) {
          overflow-x: hidden;
          max-width: 100%;
        }
      `}</style>
    </div>
  );
}
