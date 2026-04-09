"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { ToastContainer, toast } from "react-toastify";

type ApiList<T> = T[] | { results?: T[] };

type AdminSetupRow = {
  id: number;
  type: "1" | "2" | "3" | "4";
  name: string;
};

type SelectOption = {
  value: string;
  label: string;
};

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
    if (message && message !== "[object Object]") {
      return message;
    }
  }
  return fallback;
}

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

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

async function apiForm<T>(path: string, method: "POST" | "PATCH", formData: FormData): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method,
    body: formData,
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
  await apiRequestWithRefresh<void>(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
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

function formatRange(start: number, end: number, total: number) {
  if (total === 0) return "Showing 0-0 of 0 records";
  return `Showing ${start}-${end} of ${total} records`;
}

function displayValue(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") {
    return <span style={{ color: "#94a3b8", fontStyle: "italic" }}>N/A</span>;
  }
  return text;
}

function parseTimeToMinutes(value: string) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function VisitorBookPanel() {
  const [items, setItems] = useState<VisitorRow[]>([]);
  const [purposeOptions, setPurposeOptions] = useState<SelectOption[]>([]);
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

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [visitorData, setupData] = await Promise.all([
        apiGet<ApiList<VisitorRow>>("/api/v1/admissions/visitors/"),
        apiGet<ApiList<AdminSetupRow>>("/api/v1/admissions/admin-setups/"),
      ]);

      setItems(listData(visitorData));
      const setups = listData(setupData);
      setPurposeOptions(setups.filter((entry) => entry.type === "1").map((entry) => ({ value: String(entry.id), label: entry.name })));
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Unable to load visitor book records."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDate(todayDate);
    void load();
  }, [todayDate]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Visitor Book - Eskoolia";
    return () => {
      document.title = previousTitle;
    };
  }, []);

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const focusFirstInvalidField = (errors: Record<string, string>) => {
    const order = ["purpose", "name", "phone", "noOfPerson", "date", "inTime", "outTime", "attachment"];
    const idMap: Record<string, string> = {
      purpose: "vb-purpose",
      name: "vb-name",
      phone: "vb-phone",
      noOfPerson: "vb-no-of-person",
      date: "vb-date",
      inTime: "vb-in-time",
      outTime: "vb-out-time",
      attachment: "vb-attachment",
    };
    const first = order.find((key) => errors[key]);
    if (!first) return;
    const node = document.getElementById(idMap[first]);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    if ("focus" in node) {
      (node as HTMLElement).focus();
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    if (!purpose.trim()) nextErrors.purpose = "Purpose is required.";
    if (!name.trim()) nextErrors.name = "Name is required.";
    if (name.trim() && !/^[A-Za-z\s\-']+$/.test(name.trim())) {
      nextErrors.name = "Name must contain only letters, spaces, and hyphens";
    }
    if (!date) nextErrors.date = "Date is required.";
    if (!inTime.trim()) nextErrors.inTime = "In time is required.";
    if (!outTime.trim()) nextErrors.outTime = "Out time is required.";
    if (phone.trim() && !/^\d{10,12}$/.test(phone.trim())) {
      nextErrors.phone = "Phone number must be 10-12 digits";
    }
    const personCount = Number(noOfPerson);
    if (!noOfPerson.trim() || !Number.isInteger(personCount) || personCount < 1 || personCount > 99) {
      nextErrors.noOfPerson = "Enter a valid number of persons";
    }
    const inMinutes = parseTimeToMinutes(inTime);
    const outMinutes = parseTimeToMinutes(outTime);
    if (inMinutes !== null && outMinutes !== null && outMinutes <= inMinutes) {
      nextErrors.outTime = "Out time must be after in time.";
    }
    if (fileUpload && fileUpload.size > 5 * 1024 * 1024) {
      nextErrors.attachment = "Attachment must be 5MB or smaller.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setFormBanner("Please fix the errors below before submitting.");
      setError("Please fix the errors below before submitting.");
      toast.error("Please fix the errors below before submitting.", { autoClose: 5000 });
      focusFirstInvalidField(nextErrors);
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
    if (fileUpload) {
      formData.append("file_upload", fileUpload);
    }

    try {
      setSaving(true);
      setError("");
      setFieldErrors({});
      setFormBanner("");

      if (editingId) {
        await apiForm(`/api/v1/admissions/visitors/${editingId}/`, "PATCH", formData);
        setSuccess("Visitor updated successfully.");
        toast.success("Visitor updated successfully.", { autoClose: 4000 });
      } else {
        await apiForm("/api/v1/admissions/visitors/", "POST", formData);
        setSuccess("Visitor added successfully.");
        toast.success("Visitor added successfully.", { autoClose: 4000 });
      }

      resetForm();
      await load();
    } catch (error: unknown) {
      const message = getErrorMessage(error, editingId ? "Unable to update visitor." : "Unable to add visitor.");
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
      setItems((prev) => prev.filter((row) => row.id !== id));
      setSuccess("Visitor record deleted.");
      toast.success("Visitor record deleted.", { autoClose: 4000 });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Unable to delete visitor record.");
      setError(message);
      toast.error(message, { autoClose: 6000 });
    } finally {
      setBusyId(null);
    }
  };

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = !q
      ? items
      : items.filter((row) =>
      [row.name, row.purpose, row.phone || "", row.visitor_id]
        .join(" ")
        .toLowerCase()
        .includes(q),
      );

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

  const totalRecords = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const paginatedRows = filteredSorted.slice(pageStart, pageEnd);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const pageText = formatRange(totalRecords ? pageStart + 1 : 0, Math.min(pageEnd, totalRecords), totalRecords);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, safePage + 2);
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  }, [safePage, totalPages]);

  return (
    <div className="legacy-panel">
      <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnHover />
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Visitor Book</h1>
            <nav aria-label="Breadcrumb">
              <ol style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13, listStyle: "none", margin: 0, padding: 0 }}>
                <li><a href="/dashboard">Dashboard</a></li>
                <li>/</li>
                <li><a href="/administration">Admin Section</a></li>
                <li>/</li>
                <li aria-current="page">Visitor Book</li>
              </ol>
            </nav>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_admin_visitor">
        <div className="container-fluid p-0">
          <div className="visitor-grid-container" style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(400px, 2fr)", gap: 12, alignItems: "start", width: "100%", maxWidth: "100%" }}>
            <div className="white-box" style={{ ...boxStyle(), height: "auto" }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Visitor" : "Add Visitor"}</h3>
              {formBanner ? (
                <div style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#b91c1c", padding: "10px 12px", borderRadius: 8, marginBottom: 10, fontSize: 13 }} role="alert" aria-live="assertive">
                  {formBanner}
                </div>
              ) : null}
              <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
                <label htmlFor="vb-purpose" className="required-field-label" style={{ fontSize: 12, fontWeight: 600 }}>Purpose</label>
                <select
                  id="vb-purpose"
                  name="purpose"
                  required
                  aria-required="true"
                  aria-label="Purpose"
                  value={purpose}
                  onChange={(e) => {
                    setPurpose(e.target.value);
                    if (fieldErrors.purpose) setFieldErrors((prev) => ({ ...prev, purpose: "" }));
                  }}
                  style={{ ...fieldStyle(), borderColor: fieldErrors.purpose ? "#dc2626" : "var(--line)" }}
                >
                  <option value="" disabled hidden>Select Purpose *</option>
                  {purposeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.purpose ? <span style={{ color: "#dc2626", fontSize: 13, marginTop: 4 }}>{fieldErrors.purpose}</span> : null}

                <label htmlFor="vb-name" className="required-field-label" style={{ fontSize: 12, fontWeight: 600 }}>Name</label>
                <input
                  id="vb-name"
                  name="visitorName"
                  type="text"
                  required
                  aria-required="true"
                  minLength={2}
                  maxLength={100}
                  pattern="[A-Za-z\s\-']+"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  placeholder="Name *"
                  style={{ ...fieldStyle(), borderColor: fieldErrors.name ? "#dc2626" : "var(--line)" }}
                />
                {fieldErrors.name ? <span style={{ color: "#dc2626", fontSize: 13, marginTop: 4 }}>{fieldErrors.name}</span> : null}

                <label htmlFor="vb-phone" style={{ fontSize: 12, fontWeight: 600 }}>Phone</label>
                <input
                  id="vb-phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  minLength={10}
                  maxLength={12}
                  pattern="[0-9]{10,12}"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 12));
                    if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: "" }));
                  }}
                  placeholder="Phone"
                  style={{ ...fieldStyle(), borderColor: fieldErrors.phone ? "#dc2626" : "var(--line)" }}
                />
                {fieldErrors.phone ? <span style={{ color: "#dc2626", fontSize: 13, marginTop: 4 }}>{fieldErrors.phone}</span> : null}

                <label htmlFor="vb-no-of-person" className="required-field-label" style={{ fontSize: 12, fontWeight: 600 }}>Number of Persons</label>
                <input
                  id="vb-no-of-person"
                  name="noOfPerson"
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  required
                  aria-required="true"
                  value={noOfPerson}
                  onKeyDown={(e) => {
                    if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
                  }}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, "");
                    if (!value) {
                      setNoOfPerson("");
                    } else {
                      setNoOfPerson(String(Math.min(99, Math.max(1, Number(value)))));
                    }
                    if (fieldErrors.noOfPerson) setFieldErrors((prev) => ({ ...prev, noOfPerson: "" }));
                  }}
                  placeholder="Number of Persons *"
                  style={{ ...fieldStyle(), borderColor: fieldErrors.noOfPerson ? "#dc2626" : "var(--line)" }}
                />
                {fieldErrors.noOfPerson ? <span style={{ color: "#dc2626", fontSize: 13, marginTop: 4 }}>{fieldErrors.noOfPerson}</span> : null}

                <label htmlFor="vb-date" className="required-field-label" style={{ fontSize: 12, fontWeight: 600 }}>Date</label>
                <input
                  id="vb-date"
                  name="date"
                  type="date"
                  min="2000-01-01"
                  max={todayDate}
                  required
                  aria-required="true"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    if (fieldErrors.date) setFieldErrors((prev) => ({ ...prev, date: "" }));
                  }}
                  style={{ ...fieldStyle(), borderColor: fieldErrors.date ? "#dc2626" : "var(--line)" }}
                />
                {fieldErrors.date ? <span style={{ color: "#dc2626", fontSize: 13, marginTop: 4 }}>{fieldErrors.date}</span> : null}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="vb-in-time" className="required-field-label" style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, display: "block", fontWeight: 600 }}>In Time</label>
                    <input
                      id="vb-in-time"
                      name="inTime"
                      type="time"
                      required
                      aria-required="true"
                      value={inTime}
                      onChange={(e) => {
                        setInTime(e.target.value);
                        if (fieldErrors.inTime) setFieldErrors((prev) => ({ ...prev, inTime: "" }));
                      }}
                      style={{ ...fieldStyle(), borderColor: fieldErrors.inTime ? "#dc2626" : "var(--line)" }}
                    />
                    {fieldErrors.inTime ? <span style={{ color: "#dc2626", fontSize: 13, marginTop: 4 }}>{fieldErrors.inTime}</span> : null}
                  </div>
                  <div>
                    <label htmlFor="vb-out-time" className="required-field-label" style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, display: "block", fontWeight: 600 }}>Out Time</label>
                    <input
                      id="vb-out-time"
                      name="outTime"
                      type="time"
                      required
                      aria-required="true"
                      value={outTime}
                      onChange={(e) => {
                        setOutTime(e.target.value);
                        if (fieldErrors.outTime) setFieldErrors((prev) => ({ ...prev, outTime: "" }));
                      }}
                      style={{ ...fieldStyle(), borderColor: fieldErrors.outTime ? "#dc2626" : "var(--line)" }}
                    />
                    {fieldErrors.outTime ? <span style={{ color: "#dc2626", fontSize: 13, marginTop: 4 }}>{fieldErrors.outTime}</span> : null}
                  </div>
                </div>

                <label htmlFor="vb-attachment" style={{ fontSize: 12, fontWeight: 600 }}>Attachment</label>
                <input
                  id="vb-attachment"
                  name="attachment"
                  type="file"
                  aria-label="Upload visitor attachment"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setFileUpload(file);
                    if (fieldErrors.attachment) setFieldErrors((prev) => ({ ...prev, attachment: "" }));
                  }}
                  style={{ ...fieldStyle(), padding: 6 }}
                />
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted formats: PDF, JPG, PNG, DOC. Max size: 5MB.</span>
                {fieldErrors.attachment ? <span style={{ color: "#dc2626", fontSize: 13, marginTop: 4 }}>{fieldErrors.attachment}</span> : null}
                {editingId && fileUrl ? (
                  <a href={fileUrl} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontSize: 12 }}>
                    View existing file
                  </a>
                ) : null}

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button type="submit" disabled={saving} style={buttonStyle()}>
                    {saving ? "Saving..." : editingId ? "Update" : "Save"}
                  </button>
                  {editingId ? (
                    <button type="button" onClick={resetForm} style={buttonStyle("#6b7280")}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
            </div>

            <div className="white-box" style={boxStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
                <h3 style={{ margin: 0 }}>Visitor List</h3>
                <input
                  value={search}
                  aria-label="Search visitors"
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Quick search"
                  style={{ ...fieldStyle(), maxWidth: "100%", width: 240 }}
                />
              </div>

              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", position: "relative" }}>
                <table style={{ width: "100%", minWidth: 800, borderCollapse: "collapse" }}>
                  <caption className="sr-only">Visitor List</caption>
                  <thead>
                    <tr>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>SL</th>
                      <th scope="col" onClick={() => toggleSort("name")} style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer" }}>Name {sortKey === "name" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Number of Persons</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Phone</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Purpose</th>
                      <th scope="col" onClick={() => toggleSort("date")} style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer" }}>Date {sortKey === "date" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                      <th scope="col" onClick={() => toggleSort("in_time")} style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer" }}>In Time {sortKey === "in_time" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                      <th scope="col" onClick={() => toggleSort("out_time")} style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer" }}>Out Time {sortKey === "out_time" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Created By</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding: 12, color: "var(--text-muted)" }}>
                          No visitor records found.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row, index) => (
                        <tr key={row.id} style={{ background: index % 2 === 1 ? "#f8fafc" : "transparent" }}>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{pageStart + index + 1}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.name}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.no_of_person}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(row.phone)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(row.purpose)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.date}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.in_time}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.out_time}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{displayValue(row.created_by_name)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" aria-label={`Edit ${row.name}`} onClick={() => editRow(row)} style={buttonStyle("#0ea5e9")}>
                                Edit
                              </button>
                              <button type="button" aria-label={`Delete ${row.name}`} disabled={busyId === row.id} onClick={() => setDeleteTarget(row)} style={buttonStyle("#dc2626")}>
                                Delete
                              </button>
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

              {loading && <p style={{ marginTop: 10, color: "var(--text-muted)" }}>Loading visitor records...</p>}
              {error && <p style={{ marginTop: 10, color: "var(--warning)" }}>{error}</p>}
              {!loading && success && <p style={{ marginTop: 10, color: "#0f766e" }}>{success}</p>}
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
              <button
                type="button"
                onClick={async () => {
                  const id = deleteTarget.id;
                  setDeleteTarget(null);
                  await remove(id);
                }}
                style={buttonStyle("#dc2626")}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .visitor-grid-container {
          max-width: 100%;
          align-items: start;
        }

        @media (max-width: 768px) {
          .visitor-grid-container {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
