"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { TopToast } from "@/components/common/TopToast";

type ApiList<T> = T[] | { results?: T[] };

type PostalDispatchRow = {
  id: number;
  from_title: string;
  reference_no: string;
  address: string;
  note?: string;
  to_title: string;
  date?: string;
  file_url?: string;
};

type SortKey = "to_title" | "reference_no" | "date";
type SortDir = "asc" | "desc";

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

function formatRange(start: number, end: number, total: number) {
  if (total === 0) return "Showing 0-0 of 0 records";
  return `Showing ${start}-${end} of ${total} records`;
}

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) {
    const msg = err.message.trim();
    if (msg && msg !== "[object Object]") return msg;
  }
  return fallback;
}

export function PostalDispatchPanel() {
  const [items, setItems] = useState<PostalDispatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableBusy, setTableBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [toTitle, setToTitle] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [fromTitle, setFromTitle] = useState("");
  const [date, setDate] = useState("");
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PostalDispatchRow | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const minDate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet<ApiList<PostalDispatchRow>>("/api/v1/admissions/postal-dispatch/");
      setItems(listData(data));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to load postal dispatch records."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDate(today);
    void load();
  }, [today]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Postal Dispatch - Eskoolia";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (loading) {
      setTableBusy(true);
      return;
    }
    setTableBusy(true);
    const timer = window.setTimeout(() => setTableBusy(false), 250);
    return () => window.clearTimeout(timer);
  }, [loading, items, search, sortKey, sortDir, page, pageSize]);

  const reset = () => {
    setEditingId(null);
    setToTitle("");
    setReferenceNo("");
    setAddress("");
    setNote("");
    setFromTitle("");
    setDate(today);
    setFileUpload(null);
    setFileUrl("");
    setFieldErrors({});
  };

  const setErrorField = (field: string, message: string) => {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  const readApiFieldErrors = (err: unknown) => {
    const details = (err as { details?: unknown } | null)?.details;
    if (!details || typeof details !== "object") return null;
    const detailsRaw = details as Record<string, unknown>;
    const fieldErrorsRaw =
      detailsRaw.field_errors && typeof detailsRaw.field_errors === "object"
        ? (detailsRaw.field_errors as Record<string, unknown>)
        : {};
    const next: Record<string, string> = {};

    const pick = (key: string) => {
      const value = detailsRaw[key] ?? fieldErrorsRaw[key];
      if (typeof value === "string") return value;
      if (Array.isArray(value) && value.length > 0) return String(value[0]);
      return "";
    };

    const topMessage = typeof detailsRaw.message === "string" ? detailsRaw.message.trim() : "";
    const nonFieldError = pick("non_field_errors") || pick("detail");

    if (pick("to_title")) next.toTitle = pick("to_title");
    if (pick("reference_no")) next.referenceNo = pick("reference_no");
    if (pick("address")) next.address = pick("address");
    if (pick("from_title")) next.fromTitle = pick("from_title");
    if (pick("note")) next.note = pick("note");
    if (pick("date")) next.date = pick("date");
    if (pick("file_upload")) next.file = pick("file_upload");

    const summary =
      topMessage ||
      nonFieldError ||
      pick("to_title") ||
      pick("reference_no") ||
      pick("address") ||
      pick("from_title") ||
      pick("date") ||
      pick("file_upload");
    if (summary) next.main = summary;

    return Object.keys(next).length > 0 ? next : null;
  };

  const validateField = (field: string, value?: string) => {
    const v = value ??
      (field === "toTitle"
        ? toTitle
        : field === "referenceNo"
          ? referenceNo
          : field === "address"
            ? address
            : field === "fromTitle"
              ? fromTitle
              : field === "note"
                ? note
                : field === "date"
                  ? date
                  : "");

    if (field === "toTitle") {
      if (!v.trim()) return "To Title is required.";
      if (v.trim().length < 3) return "To Title must be at least 3 characters.";
      return "";
    }

    if (field === "referenceNo") {
      if (!v.trim()) return "Reference No is required.";
      if (v.trim().length < 3) return "Reference No must be at least 3 characters.";
      if (v.trim().length > 20) return "Reference No must not exceed 20 characters.";
      if (!/^[A-Za-z0-9\-]+$/.test(v.trim())) {
        return "Reference No must be alphanumeric (letters, numbers, hyphens only).";
      }
      return "";
    }

    if (field === "address") {
      if (!v.trim()) return "Address is required.";
      if (v.trim().length < 5) return "Address must be at least 5 characters.";
      return "";
    }

    if (field === "fromTitle") {
      if (!v.trim()) return "From Title is required.";
      if (v.trim().length < 3) return "From Title must be at least 3 characters.";
      return "";
    }

    if (field === "note") {
      if (v.length > 500) return "Note must not exceed 500 characters.";
      return "";
    }

    if (field === "date") {
      if (!v) return "Dispatch Date is required.";
      if (v < minDate) return "Dispatch Date cannot be older than 1 year.";
      if (v > today) return "Dispatch Date cannot be in the future.";
      return "";
    }

    if (field === "file") {
      if (!fileUpload) return "";
      const fileName = fileUpload.name.toLowerCase();
      const allowed = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".xlsx"];
      const ext = "." + (fileName.includes(".") ? fileName.split(".").pop() : "");
      if (!allowed.includes(ext)) return "Invalid file type. Allowed: PDF, DOC, DOCX, JPG, PNG, XLSX.";
      if (fileUpload.size > 5 * 1024 * 1024) return "File size exceeds 5MB limit.";
      return "";
    }

    return "";
  };

  const validateAll = () => {
    const keys = ["toTitle", "referenceNo", "address", "fromTitle", "note", "date", "file"];
    const nextErrors: Record<string, string> = {};
    keys.forEach((key) => {
      const msg = validateField(key);
      if (msg) nextErrors[key] = msg;
    });
    setFieldErrors(nextErrors);
    return nextErrors;
  };

  const edit = (row: PostalDispatchRow) => {
    setEditingId(row.id);
    setToTitle(sanitizePlain(row.to_title || ""));
    setReferenceNo(sanitizePlain(row.reference_no || ""));
    setAddress(sanitizePlain(row.address || ""));
    setNote(stripHtml(row.note || ""));
    setFromTitle(sanitizePlain(row.from_title || ""));
    setDate(row.date || today);
    setFileUpload(null);
    setFileUrl(row.file_url || "");
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const errs = validateAll();
    if (Object.keys(errs).length > 0) {
      setError("Please fix the errors below.");
      return;
    }

    const formData = new FormData();
    formData.append("to_title", toTitle.trim());
    formData.append("reference_no", referenceNo.trim());
    formData.append("address", address.trim());
    formData.append("note", note.trim());
    formData.append("from_title", fromTitle.trim());
    if (date) formData.append("date", date);
    if (fileUpload) formData.append("file_upload", fileUpload);

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setFieldErrors({});
      if (editingId) {
        await apiForm(`/api/v1/admissions/postal-dispatch/${editingId}/`, "PATCH", formData);
        setSuccess("Record updated successfully.");
      } else {
        await apiForm("/api/v1/admissions/postal-dispatch/", "POST", formData);
        setSuccess("Record created successfully.");
      }
      reset();
      await load();
    } catch (err: unknown) {
      const apiFieldErrors = readApiFieldErrors(err);
      if (apiFieldErrors) {
        setFieldErrors(apiFieldErrors);
        setError(apiFieldErrors.main || "Please fix the errors below.");
      } else {
        setError(getErrorMessage(err, editingId ? "Unable to update postal dispatch." : "Unable to save postal dispatch."));
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
      await apiDelete(`/api/v1/admissions/postal-dispatch/${id}/`);
      setItems((prev) => prev.filter((row) => row.id !== id));
      setSuccess("Record deleted successfully.");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to delete postal dispatch record."));
    } finally {
      setBusyId(null);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = !q
      ? items
      : items.filter((row) =>
        [row.to_title, row.reference_no, row.address, row.from_title, row.note || "", row.date || ""]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      if (sortKey === "to_title") return String(a.to_title || "").localeCompare(String(b.to_title || "")) * mult;
      if (sortKey === "reference_no") return String(a.reference_no || "").localeCompare(String(b.reference_no || "")) * mult;
      return String(a.date || "").localeCompare(String(b.date || "")) * mult;
    });

    return sorted;
  }, [items, search, sortKey, sortDir]);

  const totalRecords = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pageRows = filteredSorted.slice(pageStart, pageEnd);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const pageText = formatRange(totalRecords ? pageStart + 1 : 0, Math.min(pageEnd, totalRecords), totalRecords);
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const from = Math.max(1, safePage - 2);
    const to = Math.min(totalPages, safePage + 2);
    for (let i = from; i <= to; i += 1) pages.push(i);
    return pages;
  }, [safePage, totalPages]);

  const exportCsv = () => {
    const header = ["To Title", "Reference No", "Address", "From Title", "Note", "Date"];
    const rows = filteredSorted.map((row) => [
      safeRender(row.to_title),
      safeRender(row.reference_no),
      safeRender(row.address),
      safeRender(row.from_title),
      safeRender(row.note || ""),
      safeRender(row.date || ""),
    ]);
    const csv = [header, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `postal-dispatch-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="legacy-panel postal-dispatch-wrap">
      <TopToast
        message={error || success}
        tone={error ? "error" : "success"}
        onClose={() => {
          setError("");
          setSuccess("");
        }}
      />
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Postal Dispatch</h1>
            <nav aria-label="Breadcrumb">
              <ol style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13, listStyle: "none", margin: 0, padding: 0 }}>
                <li><a href="/dashboard">Dashboard</a></li>
                <li>/</li>
                <li>Admin Section</li>
                <li>/</li>
                <li aria-current="page">Postal Dispatch</li>
              </ol>
            </nav>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_admin_visitor">
        <div className="container-fluid p-0" style={{ maxWidth: "100%" }}>
          <div className="postal-dispatch-grid" style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(400px, 2fr)", gap: 12, alignItems: "start", width: "100%", maxWidth: "100%" }}>
            <div className="white-box postal-dispatch-form-panel" style={{ ...boxStyle(), height: "auto" }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Postal Dispatch" : "Add Postal Dispatch"}</h3>

              <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
                <div className="form-group">
                  <label htmlFor="pd-to-title">To Title *</label>
                  <input
                    id="pd-to-title"
                    name="toTitle"
                    type="text"
                    required
                    minLength={3}
                    maxLength={100}
                    value={toTitle}
                    placeholder="e.g. Recipient Name"
                    onInput={(e) => {
                      const cleaned = sanitizePlain(e.currentTarget.value).slice(0, 100);
                      setToTitle(cleaned);
                      setErrorField("toTitle", validateField("toTitle", cleaned));
                    }}
                    onBlur={() => setErrorField("toTitle", validateField("toTitle", toTitle))}
                    style={fieldStyle(Boolean(fieldErrors.toTitle))}
                  />
                  <small className="form-error" style={{ display: fieldErrors.toTitle ? "block" : "none" }}>{fieldErrors.toTitle || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pd-reference-no">Reference No *</label>
                  <input
                    id="pd-reference-no"
                    name="referenceNo"
                    type="text"
                    required
                    minLength={3}
                    maxLength={20}
                    pattern="[A-Za-z0-9\-]+"
                    value={referenceNo}
                    placeholder="e.g. PD-2026-001"
                    onInput={(e) => {
                      const cleaned = e.currentTarget.value.replace(/[^A-Za-z0-9\-]/g, "").slice(0, 20);
                      setReferenceNo(cleaned);
                      setErrorField("referenceNo", validateField("referenceNo", cleaned));
                    }}
                    onBlur={() => setErrorField("referenceNo", validateField("referenceNo", referenceNo))}
                    style={fieldStyle(Boolean(fieldErrors.referenceNo))}
                  />
                  <small className="form-error" style={{ display: fieldErrors.referenceNo ? "block" : "none" }}>{fieldErrors.referenceNo || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pd-address">Address *</label>
                  <input
                    id="pd-address"
                    name="address"
                    type="text"
                    required
                    maxLength={255}
                    value={address}
                    placeholder="e.g. 123 Main Street, City"
                    onInput={(e) => {
                      const cleaned = sanitizePlain(e.currentTarget.value).slice(0, 255);
                      setAddress(cleaned);
                      setErrorField("address", validateField("address", cleaned));
                    }}
                    onBlur={() => setErrorField("address", validateField("address", address))}
                    style={fieldStyle(Boolean(fieldErrors.address))}
                  />
                  <small className="form-error" style={{ display: fieldErrors.address ? "block" : "none" }}>{fieldErrors.address || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pd-note">Note</label>
                  <textarea
                    id="pd-note"
                    name="note"
                    rows={3}
                    maxLength={500}
                    value={note}
                    placeholder="Optional notes"
                    onInput={(e) => {
                      const cleaned = stripHtml(e.currentTarget.value).slice(0, 500);
                      setNote(cleaned);
                      setErrorField("note", validateField("note", cleaned));
                    }}
                    style={textAreaStyle(Boolean(fieldErrors.note))}
                  />
                  <small style={{ fontSize: 12, color: "#6b7280" }}>{note.length} / 500 characters</small>
                  <small className="form-error" style={{ display: fieldErrors.note ? "block" : "none" }}>{fieldErrors.note || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pd-from-title">From Title *</label>
                  <input
                    id="pd-from-title"
                    name="fromTitle"
                    type="text"
                    required
                    minLength={3}
                    maxLength={100}
                    value={fromTitle}
                    placeholder="e.g. Main Office"
                    onInput={(e) => {
                      const cleaned = sanitizePlain(e.currentTarget.value).slice(0, 100);
                      setFromTitle(cleaned);
                      setErrorField("fromTitle", validateField("fromTitle", cleaned));
                    }}
                    onBlur={() => setErrorField("fromTitle", validateField("fromTitle", fromTitle))}
                    style={fieldStyle(Boolean(fieldErrors.fromTitle))}
                  />
                  <small className="form-error" style={{ display: fieldErrors.fromTitle ? "block" : "none" }}>{fieldErrors.fromTitle || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pd-date">Dispatch Date *</label>
                  <input
                    id="pd-date"
                    name="date"
                    type="date"
                    required
                    min={minDate}
                    max={today}
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setErrorField("date", validateField("date", e.target.value));
                    }}
                    onBlur={() => setErrorField("date", validateField("date", date))}
                    style={fieldStyle(Boolean(fieldErrors.date))}
                  />
                  <small className="form-error" style={{ display: fieldErrors.date ? "block" : "none" }}>{fieldErrors.date || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pd-attachment">Attachment</label>
                  <input
                    id="pd-attachment"
                    name="attachment"
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
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
                  <small style={{ fontSize: 12, color: "#6b7280" }}>Accepted formats: PDF, DOC, DOCX, JPG, PNG, XLSX. Max size: 5MB.</small>
                  <small className="form-error" style={{ display: fieldErrors.file ? "block" : "none" }}>{fieldErrors.file || ""}</small>
                </div>

                {editingId && fileUrl ? <a href={fileUrl} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontSize: 12 }}>View existing file</a> : null}

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button type="submit" disabled={saving} style={buttonStyle()}>{saving ? "Saving..." : editingId ? "Update" : "Save"}</button>
                  <button type="button" onClick={reset} style={buttonStyle("#6b7280")}>Clear Form</button>
                </div>
              </form>
            </div>

            <div className="white-box" style={{ ...boxStyle(), overflowX: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>Postal Dispatch List</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={exportCsv} style={buttonStyle("#0f766e")}>Export</button>
                  <input
                    id="pd-search"
                    name="search"
                    value={search}
                    aria-label="Search postal dispatch records"
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Quick search"
                    style={{ ...fieldStyle(), maxWidth: "100%", width: 240 }}
                  />
                </div>
              </div>

              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", position: "relative" }}>
                <table aria-label="Postal Dispatch List" style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
                  <caption className="sr-only">Postal Dispatch List</caption>
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        onClick={() => toggleSort("to_title")}
                        style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer" }}
                      >
                        To Title {sortKey === "to_title" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                      </th>
                      <th
                        scope="col"
                        onClick={() => toggleSort("reference_no")}
                        style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer" }}
                      >
                        Reference No {sortKey === "reference_no" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                      </th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Address</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>From Title</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Note</th>
                      <th
                        scope="col"
                        onClick={() => toggleSort("date")}
                        style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer" }}
                      >
                        Date {sortKey === "date" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                      </th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 12, color: "var(--text-muted)" }}>
                          No postal dispatch records found.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, index) => (
                        <tr key={row.id} style={{ background: index % 2 === 1 ? "#f8fafc" : "transparent" }}>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{safeRender(row.to_title)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{safeRender(row.reference_no)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{safeRender(row.address)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{safeRender(row.from_title)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{safeRender(row.note) || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{safeRender(row.date) || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" onClick={() => edit(row)} style={buttonStyle("#0ea5e9")}>Edit</button>
                              <button type="button" disabled={busyId === row.id} onClick={() => setDeleteTarget(row)} style={buttonStyle("#dc2626")}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {tableBusy ? (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.68)", display: "grid", placeItems: "center", fontSize: 13, color: "#334155" }}>
                    Loading records...
                  </div>
                ) : null}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{pageText}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ ...fieldStyle(), width: 110 }}>
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                  </select>
                  <button type="button" disabled={safePage === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))} style={buttonStyle("#64748b")}>Previous</button>
                  {pageNumbers.map((n) => (
                    <button key={n} type="button" onClick={() => setPage(n)} style={buttonStyle(n === safePage ? "var(--primary)" : "#94a3b8")}>
                      {n}
                    </button>
                  ))}
                  <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} style={buttonStyle("#64748b")}>Next</button>
                </div>
              </div>

              {loading && <p style={{ marginTop: 10, color: "var(--text-muted)" }}>Loading postal dispatch records...</p>}
            </div>
          </div>
        </div>
      </section>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title="Confirm Delete"
        message="Are you sure you want to delete this postal dispatch record? This action cannot be undone."
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
        .postal-dispatch-wrap {
          overflow-x: hidden;
        }

        .postal-dispatch-grid {
          max-width: 100%;
          align-items: start;
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
          .postal-dispatch-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 768px) {
          .postal-dispatch-form-panel {
            grid-column: 1 / -1;
          }
        }

        :global(body),
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
