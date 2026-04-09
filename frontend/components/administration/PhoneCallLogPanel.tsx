"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { ToastContainer, toast } from "react-toastify";

type ApiList<T> = T[] | { results?: T[] };

type PhoneCallRow = {
  id: number;
  name?: string;
  phone: string;
  date?: string;
  next_follow_up_date?: string;
  call_duration?: string;
  description?: string;
  call_type: "I" | "O";
};

type SortKey = "name" | "phone" | "date" | "next_follow_up_date" | "call_duration" | "call_type";
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

async function apiMutate<T>(path: string, method: "POST" | "PATCH", payload: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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
  return value.replace(/<[^>]*>/g, "").replace(/[<>&"']/g, "");
}

function formatCallDuration(duration: string): string {
  const text = String(duration || "").trim();
  if (!text) return "";
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(text)) return text;
  const minMatch = text.match(/^(\d{1,4})\s*min(?:ute)?s?$/i);
  if (minMatch) {
    const mins = Number(minMatch[1]);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  }
  if (/^\d+$/.test(text)) {
    const mins = Number(text);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  }
  return text;
}

function displayValue(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") {
    return <span style={{ color: "#94a3b8", fontStyle: "italic" }}>N/A</span>;
  }
  return text;
}

function formatRange(start: number, end: number, total: number) {
  if (total === 0) return "Showing 0-0 of 0 records";
  return `Showing ${start}-${end} of ${total} records`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message && message !== "[object Object]") return message;
  }
  return fallback;
}

export function PhoneCallLogPanel() {
  const [items, setItems] = useState<PhoneCallRow[]>([]);
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
  const [deleteTarget, setDeleteTarget] = useState<PhoneCallRow | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [description, setDescription] = useState("");
  const [callType, setCallType] = useState<"I" | "O">("I");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet<ApiList<PhoneCallRow>>("/api/v1/admissions/phone-call-logs/");
      setItems(listData(data));
    } catch {
      const message = "Unable to load phone call logs.";
      setError(message);
      toast.error(message, { autoClose: 5000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDate(today);
    setFollowUpDate(today);
    void load();
  }, [today]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Phone Call Log - Eskoolia";
    return () => {
      document.title = previousTitle;
    };
  }, []);

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
    setName("");
    setPhone("");
    setDate(today);
    setFollowUpDate(today);
    setCallDuration("");
    setDescription("");
    setCallType("I");
    setFieldErrors({});
  };

  const edit = (row: PhoneCallRow) => {
    setEditingId(row.id);
    setName(row.name || "");
    setPhone(row.phone || "");
    setDate(row.date || today);
    setFollowUpDate(row.next_follow_up_date || "");
    setCallDuration(formatCallDuration(row.call_duration || ""));
    setDescription(sanitizePlain(row.description || ""));
    setCallType((row.call_type || "I") as "I" | "O");
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setErrorField = (field: string, message: string) => {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
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

    if (pick("name")) next.name = pick("name");
    if (pick("phone")) next.phone = pick("phone");
    if (pick("date")) next.date = pick("date");
    if (pick("next_follow_up_date")) next.followUpDate = pick("next_follow_up_date");
    if (pick("call_duration")) next.callDuration = pick("call_duration");
    if (pick("description")) next.description = pick("description");
    if (pick("call_type")) next.callType = pick("call_type");
    next.main =
      pick("name") ||
      pick("phone") ||
      pick("date") ||
      pick("next_follow_up_date") ||
      pick("call_duration") ||
      pick("description") ||
      pick("call_type");

    return Object.keys(next).length > 0 ? next : null;
  };

  const validateField = (field: string, value?: string) => {
    const v = value ??
      (field === "name"
        ? name
        : field === "phone"
          ? phone
          : field === "date"
            ? date
            : field === "followUpDate"
              ? followUpDate
              : field === "callDuration"
                ? callDuration
                : field === "description"
                  ? description
                  : field === "callType"
                    ? callType
                    : "");

    if (field === "name") {
      if (!v.trim()) return "Name is required.";
      if (v.trim().length < 2) return "Name must be at least 2 characters.";
      if (v.trim().length > 100) return "Name must not exceed 100 characters.";
      if (!/^[A-Za-z0-9\s\-'.,()]+$/.test(v.trim())) return "Invalid characters in Name.";
      return "";
    }

    if (field === "phone") {
      if (!v.trim()) return "Phone is required.";
      if (!/^\d{10,12}$/.test(v.trim())) return "Phone number must be 10-12 digits.";
      return "";
    }

    if (field === "date") {
      if (!v) return "From Date is required.";
      if (v > today) return "From Date cannot be in the future.";
      return "";
    }

    if (field === "followUpDate") {
      if (!v) return "";
      if (date && v < date) return "To Date cannot be before From Date.";
      if (v > today) return "To Date cannot be in the future.";
      return "";
    }

    if (field === "callDuration") {
      if (!v.trim()) return "Call Duration is required.";
      if (!/^([0-9]{1,2}):([0-5][0-9]):([0-5][0-9])$/.test(v.trim())) {
        return "Enter duration in HH:MM:SS format (e.g., 00:10:00).";
      }
      return "";
    }

    if (field === "description") {
      if (v.length > 500) return "Description must not exceed 500 characters.";
      return "";
    }

    if (field === "callType") {
      if (v !== "I" && v !== "O") return "Call Type is invalid.";
      return "";
    }

    return "";
  };

  const validateAll = () => {
    const keys = ["name", "phone", "date", "followUpDate", "callDuration", "description", "callType"];
    const nextErrors: Record<string, string> = {};
    keys.forEach((key) => {
      const msg = validateField(key);
      if (msg) nextErrors[key] = msg;
    });
    setFieldErrors(nextErrors);
    return nextErrors;
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const nextErrors = validateAll();
    if (Object.keys(nextErrors).length > 0) {
      const message = "Please fix the errors below.";
      setError(message);
      toast.error(message, { autoClose: 5000 });
      return;
    }

    const payload = {
      name: sanitizePlain(name).trim(),
      phone: phone.trim(),
      date: date || null,
      next_follow_up_date: followUpDate || null,
      call_duration: callDuration.trim(),
      description: sanitizePlain(description).trim(),
      call_type: callType,
    };

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setFieldErrors({});
      if (editingId) {
        await apiMutate(`/api/v1/admissions/phone-call-logs/${editingId}/`, "PATCH", payload);
        setSuccess("Phone call log updated successfully.");
        toast.success("Phone call log updated successfully", { autoClose: 5000 });
      } else {
        await apiMutate("/api/v1/admissions/phone-call-logs/", "POST", payload);
        setSuccess("Phone call log added successfully.");
        toast.success("Phone call log added successfully", { autoClose: 5000 });
      }
      reset();
      await load();
    } catch (err: unknown) {
      const apiFieldErrors = readApiFieldErrors(err);
      if (apiFieldErrors) {
        setFieldErrors(apiFieldErrors);
        const message = apiFieldErrors.main || "Please fix the errors below.";
        setError(message);
        toast.error(message, { autoClose: 5000 });
      } else {
        const message = getErrorMessage(err, editingId ? "Unable to update phone call." : "Unable to save phone call.");
        setError(message);
        toast.error(message, { autoClose: 5000 });
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
      await apiDelete(`/api/v1/admissions/phone-call-logs/${id}/`);
      setItems((prev) => prev.filter((row) => row.id !== id));
      setSuccess("Phone call log deleted successfully.");
      toast.success("Phone call log deleted successfully", { autoClose: 5000 });
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Unable to delete phone call log.");
      setError(message);
      toast.error(message, { autoClose: 5000 });
    } finally {
      setBusyId(null);
    }
  };

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = !q
      ? items
      : items.filter((row) =>
        [
          row.name || "",
          row.phone || "",
          row.call_duration || "",
          row.description || "",
          row.call_type === "I" ? "incoming" : "outgoing",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return String(a.name || "").localeCompare(String(b.name || "")) * mult;
      if (sortKey === "phone") return String(a.phone || "").localeCompare(String(b.phone || "")) * mult;
      if (sortKey === "date") return String(a.date || "").localeCompare(String(b.date || "")) * mult;
      if (sortKey === "next_follow_up_date") return String(a.next_follow_up_date || "").localeCompare(String(b.next_follow_up_date || "")) * mult;
      if (sortKey === "call_duration") return formatCallDuration(String(a.call_duration || "")).localeCompare(formatCallDuration(String(b.call_duration || ""))) * mult;
      return String(a.call_type || "").localeCompare(String(b.call_type || "")) * mult;
    });

    return sorted;
  }, [items, search, sortKey, sortDir]);

  const totalRecords = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pageRows = filteredSorted.slice(pageStart, pageEnd);
  const pageText = formatRange(totalRecords ? pageStart + 1 : 0, Math.min(pageEnd, totalRecords), totalRecords);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const from = Math.max(1, safePage - 2);
    const to = Math.min(totalPages, safePage + 2);
    for (let i = from; i <= to; i += 1) pages.push(i);
    return pages;
  }, [safePage, totalPages]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="legacy-panel phone-call-log-wrap">
        <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnHover />
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Phone Call Log</h1>
            <nav aria-label="Breadcrumb">
              <ol style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13, listStyle: "none", margin: 0, padding: 0 }}>
                <li><a href="/dashboard">Dashboard</a></li>
                <li>/</li>
                <li><a href="/administration">Admin Section</a></li>
                <li>/</li>
                <li aria-current="page">Phone Call Log</li>
              </ol>
            </nav>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_admin_visitor">
        <div className="container-fluid p-0" style={{ maxWidth: "100%" }}>
          <div className="phone-call-grid" style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(400px, 2fr)", gap: 12, alignItems: "start", width: "100%", maxWidth: "100%" }}>
            <div className="white-box phone-call-form-panel" style={{ ...boxStyle(), height: "auto" }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Phone Call" : "Add Phone Call"}</h3>
              <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
                <div className="form-group">
                  <label htmlFor="pcl-name">Name *</label>
                  <input
                    id="pcl-name"
                    name="callerName"
                    type="text"
                    required
                    aria-required="true"
                    aria-label="Caller Name"
                    minLength={2}
                    maxLength={100}
                    pattern="[A-Za-z0-9\s\-'.,()]+"
                    value={name}
                    onInput={(e) => {
                      const cleaned = sanitizePlain(e.currentTarget.value).slice(0, 100);
                      setName(cleaned);
                      setErrorField("name", validateField("name", cleaned));
                    }}
                    onBlur={() => setErrorField("name", validateField("name", name))}
                    placeholder="Name *"
                    style={fieldStyle(Boolean(fieldErrors.name))}
                  />
                  <small className="form-error" style={{ display: fieldErrors.name ? "block" : "none" }}>{fieldErrors.name || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pcl-phone">Phone *</label>
                <input
                  id="pcl-phone"
                  name="phone"
                  type="tel"
                  required
                  aria-required="true"
                  aria-label="Phone Number"
                  minLength={10}
                  maxLength={12}
                  inputMode="numeric"
                  pattern="[0-9]{10,12}"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 12));
                    setErrorField("phone", "");
                  }}
                  onBlur={() => setErrorField("phone", validateField("phone", phone))}
                  placeholder="Phone *"
                  style={fieldStyle(Boolean(fieldErrors.phone))}
                />
                  <small className="form-error" style={{ display: fieldErrors.phone ? "block" : "none" }}>{fieldErrors.phone || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pcl-from-date">From Date</label>
                  <input
                    id="pcl-from-date"
                    name="fromDate"
                    type="date"
                    required
                    max={today}
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      if (followUpDate && e.target.value && followUpDate < e.target.value) {
                        setFollowUpDate(e.target.value);
                      }
                      setErrorField("date", validateField("date", e.target.value));
                    }}
                    style={fieldStyle(Boolean(fieldErrors.date))}
                  />
                  <small className="form-error" style={{ display: fieldErrors.date ? "block" : "none" }}>{fieldErrors.date || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pcl-to-date">To Date</label>
                  <input
                    id="pcl-to-date"
                    name="toDate"
                    type="date"
                    min={date || undefined}
                    max={today}
                    value={followUpDate}
                    onChange={(e) => {
                      setFollowUpDate(e.target.value);
                      setErrorField("followUpDate", validateField("followUpDate", e.target.value));
                    }}
                    style={fieldStyle(Boolean(fieldErrors.followUpDate))}
                  />
                  <small className="form-error" style={{ display: fieldErrors.followUpDate ? "block" : "none" }}>{fieldErrors.followUpDate || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pcl-duration">Call Duration (HH:MM:SS)</label>
                  <input
                    id="pcl-duration"
                    name="callDuration"
                    type="text"
                    maxLength={8}
                    pattern="^([0-9]{1,2}):([0-5][0-9]):([0-5][0-9])$"
                    placeholder="HH:MM:SS"
                    value={callDuration}
                    onChange={(e) => {
                      const cleaned = sanitizePlain(e.target.value).slice(0, 8);
                      setCallDuration(cleaned);
                      setErrorField("callDuration", validateField("callDuration", cleaned));
                    }}
                    style={fieldStyle(Boolean(fieldErrors.callDuration))}
                  />
                  <small className="form-error" style={{ display: fieldErrors.callDuration ? "block" : "none" }}>{fieldErrors.callDuration || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="pcl-description">Description</label>
                  <textarea
                    id="pcl-description"
                    name="description"
                    rows={3}
                    maxLength={500}
                    value={description}
                    onChange={(e) => {
                      const cleaned = sanitizePlain(e.target.value).slice(0, 500);
                      setDescription(cleaned);
                      setErrorField("description", validateField("description", cleaned));
                    }}
                    placeholder="Description"
                    style={{ ...fieldStyle(Boolean(fieldErrors.description)), minHeight: 80, padding: "8px 10px" }}
                  />
                  <small style={{ fontSize: 12, color: "#6b7280" }}>{description.length} / 500 characters</small>
                </div>

                <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 13 }}>
                  <label htmlFor="pcl-incoming" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input id="pcl-incoming" name="callType" type="radio" value="I" checked={callType === "I"} aria-label="Incoming call" onChange={() => setCallType("I")} />
                    Incoming
                  </label>
                  <label htmlFor="pcl-outgoing" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input id="pcl-outgoing" name="callType" type="radio" value="O" checked={callType === "O"} aria-label="Outgoing call" onChange={() => setCallType("O")} />
                    Outgoing
                  </label>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={saving} style={buttonStyle()}>{saving ? "Saving..." : editingId ? "Update" : "Save"}</button>
                  {editingId ? <button type="button" onClick={reset} style={buttonStyle("#6b7280")}>Cancel</button> : null}
                </div>
              </form>
            </div>

            <div className="white-box" style={{ ...boxStyle(), overflowX: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>Phone Call List</h3>
                <input
                  id="pcl-search"
                  name="search"
                  type="search"
                  aria-label="Search phone call logs"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Quick search"
                  style={{ ...fieldStyle(), maxWidth: 250, width: "100%" }}
                />
              </div>

              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", position: "relative" }}>
                <table aria-label="Phone Call List" style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
                  <caption className="sr-only">Phone Call List</caption>
                  <thead>
                    <tr>
                      <th scope="col" onClick={() => toggleSort("name")} style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer" }}>Name {sortKey === "name" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                      <th scope="col" onClick={() => toggleSort("phone")} style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer" }}>Phone {sortKey === "phone" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                      <th scope="col" onClick={() => toggleSort("date")} style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer" }}>From Date {sortKey === "date" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                      <th scope="col" onClick={() => toggleSort("next_follow_up_date")} style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer" }}>To Date {sortKey === "next_follow_up_date" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                      <th scope="col" onClick={() => toggleSort("call_duration")} style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer" }}>Call Duration {sortKey === "call_duration" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Description</th>
                      <th scope="col" onClick={() => toggleSort("call_type")} style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer" }}>Call Type {sortKey === "call_type" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && pageRows.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: 12, color: "var(--text-muted)" }}>No phone calls found.</td></tr>
                    ) : (
                      pageRows.map((row, index) => (
                        <tr key={row.id} style={{ background: index % 2 === 1 ? "#f8fafc" : "transparent" }}>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(row.name)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(row.phone)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(row.date)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(row.next_follow_up_date)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(formatCallDuration(row.call_duration || ""))}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(row.description)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.call_type === "I" ? "Incoming" : "Outgoing"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" aria-label={`Edit phone call log for ${String(row.name || "Unknown")}`} onClick={() => edit(row)} style={buttonStyle("#0ea5e9")}>Edit</button>
                              <button type="button" aria-label={`Delete phone call log for ${String(row.name || "Unknown")}`} disabled={busyId === row.id} onClick={() => setDeleteTarget(row)} style={buttonStyle("#dc2626")}>Delete</button>
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

              {loading && <p style={{ marginTop: 10, color: "var(--text-muted)" }}>Loading phone calls...</p>}
              {error && <p style={{ marginTop: 10, color: "#dc3545" }}>{error}</p>}
              {success && <p style={{ marginTop: 10, color: "#0f766e" }}>{success}</p>}
            </div>
          </div>
        </div>
      </section>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title="Confirm Delete"
        message="Are you sure you want to delete this phone call log? This action cannot be undone."
        confirmLabel="Delete"
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
        .phone-call-log-wrap {
          overflow-x: hidden;
        }

        .phone-call-grid {
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
        }

        .skip-link {
          position: absolute;
          left: -9999px;
          top: 8px;
          z-index: 999;
          background: #0f172a;
          color: #fff;
          border-radius: 8px;
          padding: 8px 12px;
        }

        .skip-link:focus {
          left: 12px;
        }

        @media (max-width: 768px) {
          .phone-call-grid {
            grid-template-columns: 1fr !important;
          }

          .phone-call-form-panel {
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
    </>
  );
}
