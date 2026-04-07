"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { compareAcademicsClasses, sortAcademicsClasses } from "@/lib/classOrdering";

type AcademicYear = { id: number; name: string; start_date: string; end_date: string; is_current: boolean };
type SchoolClass = { id: number; name: string; numeric_order: number; sections: Section[] };
type Section = { id: number; school_class: number; name: string; capacity: number };
type Subject = { id: number; name: string; code: string; subject_type: string };

type ApiList<T> = T[] | { results?: T[]; next?: string | null };

type Tab = "years" | "classes" | "sections" | "subjects";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
}

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const merged: T[] = [];
  let nextPath = path;

  for (let index = 0; index < 50 && nextPath; index += 1) {
    const response = await apiFetch<ApiList<T>>(nextPath);
    merged.push(...listData(response));

    if (Array.isArray(response) || !response.next) {
      break;
    }

    if (response.next.startsWith("http")) {
      try {
        const nextUrl = new URL(response.next);
        nextPath = `${nextUrl.pathname}${nextUrl.search}`;
      } catch {
        break;
      }
    } else {
      nextPath = response.next;
    }
  }

  return merged;
}

function sortSectionsByClassAndName(items: Section[], classes: SchoolClass[]): Section[] {
  const classMap = new Map(classes.map((row) => [row.id, row]));
  return [...items].sort((a, b) => {
    const classA = classMap.get(a.school_class);
    const classB = classMap.get(b.school_class);
    const classCompare = classA && classB ? compareAcademicsClasses(classA, classB) : (classA ? -1 : classB ? 1 : 0);
    if (classCompare !== 0) return classCompare;
    return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
  });
}

function parseDisplayDate(value: string): string {
  const trimmed = (value || "").trim();

  const ddmmyyyy = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
      return "";
    }
    return `${year}-${month}-${day}`;
  }

  const yyyymmdd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
      return "";
    }
    return trimmed;
  }

  return "";
}

function formatDisplayDate(value: string): string {
  const match = (value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || "";
  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
}

function academicYearNameFromDates(startDate: string, endDate: string): string {
  const start = parseDisplayDate(startDate);
  const end = parseDisplayDate(endDate);
  if (!start || !end) return "";
  return `${start.slice(0, 4)}-${end.slice(0, 4)}`;
}

function extractAcademicYearFieldErrors(details: unknown): { name?: string; start_date?: string; end_date?: string; date?: string } {
  const next: { name?: string; start_date?: string; end_date?: string; date?: string } = {};
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return next;
  }

  const payload = details as Record<string, unknown>;
  const source = (payload.field_errors && typeof payload.field_errors === "object" ? payload.field_errors : payload.errors) as Record<string, unknown> | undefined;
  if (!source) return next;

  const pick = (key: string): string | undefined => {
    const value = source[key];
    if (!value) return undefined;
    if (Array.isArray(value) && value.length) return String(value[0]);
    return typeof value === "string" ? value : undefined;
  };

  next.name = pick("name") || pick("year_name");
  next.start_date = pick("start_date");
  next.end_date = pick("end_date");
  next.date = pick("date") || pick("non_field_errors");
  return next;
}

// ─── Academic Years ──────────────────────────────────────────────────────────
function AcademicYearsSection() {
  const [items, setItems] = useState<AcademicYear[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; start_date?: string; end_date?: string; date?: string }>({});
  const isEditMode = editingId !== null;

  const load = async () => {
    try {
      type R = { results?: AcademicYear[] };
      const data = await apiFetch<R | AcademicYear[]>("/api/v1/core/academic-years/");
      setItems(Array.isArray(data) ? data : data.results || []);
    } catch { setError("Unable to load academic years."); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!startDate || !endDate) {
      setName("");
      return;
    }
    const normalizedStart = parseDisplayDate(startDate);
    const normalizedEnd = parseDisplayDate(endDate);
    if (normalizedStart && normalizedEnd) {
      setName(academicYearNameFromDates(startDate, endDate));
    }
  }, [startDate, endDate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: { name?: string; start_date?: string; end_date?: string; date?: string } = {};

    if (!startDate) nextErrors.start_date = "Start date is required.";
    if (!endDate) nextErrors.end_date = "End date is required.";

    const normalizedStart = parseDisplayDate(startDate);
    const normalizedEnd = parseDisplayDate(endDate);

    if (startDate && !normalizedStart) nextErrors.start_date = "Select a valid start date.";
    if (endDate && !normalizedEnd) nextErrors.end_date = "Select a valid end date.";

    if (normalizedStart && normalizedEnd) {
      const start = new Date(normalizedStart);
      const end = new Date(normalizedEnd);
      if (!(start < end)) {
        nextErrors.date = "Start date must be before end date.";
      } else {
        const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 270) {
          nextErrors.date = "Academic year must be at least 9 months long.";
        }
        if (end.getFullYear() !== start.getFullYear() + 1) {
          nextErrors.date = "Academic year must span across two consecutive calendar years.";
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError("Please correct highlighted fields.");
      return;
    }

    try {
      setSaving(true); setError(""); setFieldErrors({});
      const payload = { name: academicYearNameFromDates(startDate, endDate), start_date: parseDisplayDate(startDate), end_date: parseDisplayDate(endDate), is_current: isCurrent };
      await apiFetch(
        editingId ? `/api/v1/core/academic-years/${editingId}/` : "/api/v1/core/academic-years/",
        { method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload) }
      );
      setName(""); setStartDate(""); setEndDate(""); setIsCurrent(false);
      setEditingId(null);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save academic year.";
      const details = err && typeof err === "object" ? (err as { details?: unknown }).details : undefined;
      const fieldErrors = extractAcademicYearFieldErrors(details);
      setFieldErrors(fieldErrors);
      setError(fieldErrors.date || fieldErrors.start_date || fieldErrors.end_date || fieldErrors.name || message || (editingId ? "Failed to update academic year." : "Failed to create academic year."));
    } finally { setSaving(false); }
  };

  const edit = (row: AcademicYear) => {
    setEditingId(row.id);
    setName(row.name || "");
    setStartDate(row.start_date || "");
    setEndDate(row.end_date || "");
    setIsCurrent(!!row.is_current);
  };

  const reset = () => {
    setEditingId(null);
    setName("");
    setStartDate("");
    setEndDate("");
    setIsCurrent(false);
    setFieldErrors({});
  };

  const remove = async (row: AcademicYear) => {
    if (!window.confirm(`Delete academic year \"${row.name}\"?`)) return;
    try {
      setError("");
      await apiFetch(`/api/v1/core/academic-years/${row.id}/`, { method: "DELETE" });
      if (editingId === row.id) reset();
      await load();
    } catch {
      setError("Failed to delete academic year.");
    }
  };

  return (
    <div>
      {isEditMode ? <p style={{ margin: "0 0 10px", color: "#0f766e", fontSize: 13, fontWeight: 600 }}>Edit mode active for selected academic year.</p> : null}
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto auto", gap: 8, marginBottom: 14, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Academic Year</label>
          <input value={name} readOnly required placeholder="Auto-generated (e.g. 2025-2026)" style={{ display: "block", width: "100%", height: 36, border: `1px solid ${fieldErrors.name ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px", marginTop: 4, background: "var(--surface-muted)" }} />
          {fieldErrors.name ? <span style={{ fontSize: 12, color: "#dc2626" }}>{fieldErrors.name}</span> : null}
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Start Date</label>
          <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} style={{ display: "block", width: "100%", height: 36, border: `1px solid ${fieldErrors.start_date || fieldErrors.date ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px", marginTop: 4 }} />
          {fieldErrors.start_date ? <span style={{ fontSize: 12, color: "#dc2626" }}>{fieldErrors.start_date}</span> : null}
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>End Date</label>
          <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} style={{ display: "block", width: "100%", height: 36, border: `1px solid ${fieldErrors.end_date || fieldErrors.date ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px", marginTop: 4 }} />
          {fieldErrors.end_date ? <span style={{ fontSize: 12, color: "#dc2626" }}>{fieldErrors.end_date}</span> : null}
          {fieldErrors.date ? <span style={{ display: "block", fontSize: 12, color: "#dc2626" }}>{fieldErrors.date}</span> : null}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", paddingBottom: 4 }}><input type="checkbox" checked={isCurrent} onChange={e => setIsCurrent(e.target.checked)} style={{ accentColor: "var(--primary)" }} /> Current</label>
        <button type="submit" disabled={saving} style={{ height: 36, padding: "0 14px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", opacity: saving ? 0.85 : 1 }}>{saving ? "Saving..." : isEditMode ? "Update" : "Add"}</button>
        {isEditMode ? <button type="button" onClick={reset} style={{ height: 36, padding: "0 14px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Cancel</button> : null}
      </form>
      {error && <p style={{ color: "var(--warning)", fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
          {["Name", "Start", "End", "Current", "Actions"].map(h => <th key={h} style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>{h}</th>)}
        </tr></thead>
        <tbody>{items.map(y => (
          <tr key={y.id}>
            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{y.name}</td>
            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", fontSize: 13, color: "var(--text-muted)" }}>{formatDisplayDate(y.start_date)}</td>
            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", fontSize: 13, color: "var(--text-muted)" }}>{formatDisplayDate(y.end_date)}</td>
            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{y.is_current ? <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}>✓ Active</span> : null}</td>
            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", display: "flex", gap: 6 }}>
              <button type="button" onClick={() => edit(y)} style={{ height: 28, padding: "0 10px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Edit</button>
              <button type="button" onClick={() => void remove(y)} style={{ height: 28, padding: "0 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Delete</button>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ─── Classes ─────────────────────────────────────────────────────────────────
function ClassesSection() {
  const [items, setItems] = useState<SchoolClass[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<SchoolClass | null>(null);
  const [name, setName] = useState("");
  const [order, setOrder] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isEditMode = editingId !== null;

  const classErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error) {
      const message = (err.message || "").trim();
      if (message) {
        if (message.toLowerCase().includes("already exists") || message.toLowerCase().includes("unique")) {
          return "Class name already exists";
        }
        return message;
      }
    }
    return fallback;
  };

  const load = async () => {
    try {
      const data = await fetchAllPages<SchoolClass>("/api/v1/core/classes/?page_size=100");
      setItems(sortAcademicsClasses(data));
    } catch { setError("Unable to load classes."); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Class name is required."); return; }
    const parsedOrder = parseInt(order, 10) || 0;
    if (parsedOrder < 0) { setError("Order must be zero or greater."); return; }
    try {
      setSaving(true); setError(""); setSuccess("");
      const payload = { name: name.trim(), numeric_order: parsedOrder };
      await apiFetch(
        editingId ? `/api/v1/core/classes/${editingId}/` : "/api/v1/core/classes/",
        { method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload) }
      );
      setName(""); setOrder("0"); setEditingId(null);
      setSuccess(editingId ? "Class updated successfully." : "Class added successfully.");
      await load();
    } catch (err) {
      setError(classErrorMessage(err, editingId ? "Failed to update class." : "Failed to create class."));
    } finally { setSaving(false); }
  };

  const edit = (row: SchoolClass) => {
    setEditingId(row.id);
    setName(row.name || "");
    setOrder(String(row.numeric_order || 0));
    setError("");
    setSuccess("");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const reset = () => {
    setEditingId(null);
    setName("");
    setOrder("0");
    setError("");
    setSuccess("");
  };

  const remove = async (id: number) => {
    try {
      setError("");
      await apiFetch(`/api/v1/core/classes/${id}/`, { method: "DELETE" });
      if (editingId === id) reset();
      await load();
    } catch {
      setError("Failed to delete class.");
    }
  };

  return (
    <div>
      {isEditMode ? <p style={{ margin: "0 0 10px", color: "#0f766e", fontSize: 13, fontWeight: 600 }}>Edit mode active for selected class.</p> : null}
      <form onSubmit={submit} style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "end" }}>
        <div style={{ flex: 1 }}><label style={{ fontSize: 12, color: "var(--text-muted)" }}>Class Name</label><input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Grade 1" style={{ display: "block", width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px", marginTop: 4 }} /></div>
        <div style={{ width: 140 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Order</label>
          <input type="number" min={0} value={order} onChange={e => setOrder(e.target.value)} style={{ display: "block", width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px", marginTop: 4 }} />
          <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Order defines display sequence of classes</span>
        </div>
        <button type="submit" disabled={saving} style={{ height: 36, padding: "0 14px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", alignSelf: "flex-end" }}>{saving ? "…" : isEditMode ? "Update" : "Add"}</button>
        {isEditMode ? <button type="button" onClick={reset} style={{ height: 36, padding: "0 14px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", alignSelf: "flex-end" }}>Cancel</button> : null}
      </form>
      {error && <p style={{ color: "var(--warning)", fontSize: 13, marginBottom: 8 }}>{error}</p>}
      {success && <p style={{ color: "#16a34a", fontSize: 13, marginBottom: 8 }}>{success}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
          {["Class", "Sections", "Order", "Actions"].map(h => <th key={h} style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>{h}</th>)}
        </tr></thead>
        <tbody>{items.map(c => (
          <tr key={c.id}>
            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{c.name}</td>
            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", fontSize: 13, color: "var(--text-muted)" }}>{(c.sections || []).map(s => s.name).join(", ") || "—"}</td>
            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", fontSize: 13, color: "var(--text-muted)" }}>{c.numeric_order}</td>
            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", display: "flex", gap: 6 }}>
              <button type="button" onClick={() => edit(c)} style={{ height: 28, padding: "0 10px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Edit</button>
              <button type="button" onClick={() => setDeleteCandidate(c)} style={{ height: 28, padding: "0 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Delete</button>
            </td>
          </tr>
        ))}</tbody>
      </table>

      {deleteCandidate ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "min(480px, calc(100vw - 24px))",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 12px 30px rgba(0,0,0,.18)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18 }}>Delete Class</h3>
            <p style={{ marginTop: 10, marginBottom: 14, color: "var(--text-muted)" }}>
              Delete class "{deleteCandidate.name}"?
            </p>
            <div style={{ marginBottom: 14, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface-muted)" }}>
              <strong>{deleteCandidate.name}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                style={{ height: 36, padding: "0 14px", background: "#64748b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = deleteCandidate;
                  setDeleteCandidate(null);
                  if (target) {
                    void remove(target.id);
                  }
                }}
                style={{ height: 36, padding: "0 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Subjects ─────────────────────────────────────────────────────────────────
function SubjectsSection() {
  const [items, setItems] = useState<Subject[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [subjectType, setSubjectType] = useState("compulsory");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; code?: string; subject_type?: string }>({});
  const isEditMode = editingId !== null;

  const load = async () => {
    try {
      const data = await fetchAllPages<Subject>("/api/v1/core/subjects/?page_size=100");
      setItems([...data].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" })));
    } catch { setError("Unable to load subjects."); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: { name?: string; code?: string; subject_type?: string } = {};

    const cleanedName = name.trim();
    const cleanedCode = code.trim().toUpperCase();
    const normalizedType = (subjectType || "").toLowerCase();

    if (!cleanedName) {
      nextErrors.name = "Subject name is required.";
    } else if (cleanedName.length < 2) {
      nextErrors.name = "Subject name must be at least 2 characters.";
    } else if (!/^[A-Za-z ]+$/.test(cleanedName)) {
      nextErrors.name = "Subject name can contain only letters and spaces.";
    }

    if (!cleanedCode) {
      nextErrors.code = "Subject code is required.";
    } else if (!/^[A-Za-z0-9]+$/.test(cleanedCode)) {
      nextErrors.code = "Subject code must be alphanumeric.";
    } else if (cleanedCode.length < 3 || cleanedCode.length > 10) {
      nextErrors.code = "Subject code length must be between 3 and 10 characters.";
    }

    if (!["compulsory", "optional", "elective"].includes(normalizedType)) {
      nextErrors.subject_type = "Subject type must be Compulsory, Optional, or Elective.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError("Please correct highlighted fields.");
      return;
    }

    try {
      setSaving(true); setError(""); setSuccess(""); setFieldErrors({});
      const payload = { name: cleanedName, code: cleanedCode, subject_type: normalizedType };
      await apiFetch(
        editingId ? `/api/v1/core/subjects/${editingId}/` : "/api/v1/core/subjects/",
        { method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload) }
      );
      setSelectedIds([]);
      setName(""); setCode(""); setSubjectType("compulsory"); setEditingId(null);
      setSuccess(editingId ? "Subject updated successfully" : "Subject added successfully");
      await load();
    } catch (e) {
      const message = e instanceof Error ? (e.message || "").trim() : "";
      if (message) {
        const lowered = message.toLowerCase();
        if (lowered.includes("already exists") || lowered.includes("unique")) {
          setError("Subject already exists.");
        } else {
          setError(message);
        }
        const nextErrors: { name?: string; code?: string; subject_type?: string } = {};
        if (lowered.includes("name")) nextErrors.name = message;
        if (lowered.includes("code")) nextErrors.code = message;
        if (lowered.includes("type")) nextErrors.subject_type = message;
        setFieldErrors(nextErrors);
      } else {
        setError(editingId ? "Failed to update subject." : "Failed to create subject.");
      }
    } finally { setSaving(false); }
  };

  const edit = (row: Subject) => {
    setEditingId(row.id);
    setName(row.name || "");
    setCode(row.code || "");
    const normalizedType = (row.subject_type || "compulsory").toLowerCase();
    setSubjectType(normalizedType === "optional" || normalizedType === "elective" ? normalizedType : "compulsory");
    setFieldErrors({});
    setError("");
    setSuccess("");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const reset = () => {
    setEditingId(null);
    setName("");
    setCode("");
    setSubjectType("compulsory");
    setFieldErrors({});
    setError("");
    setSuccess("");
  };

  const remove = async (row: Subject) => {
    if (!window.confirm(`Delete subject: ${row.name}?`)) return;
    try {
      setError("");
      await apiFetch(`/api/v1/core/subjects/${row.id}/`, { method: "DELETE" });
      setSelectedIds((prev) => prev.filter((entry) => entry !== row.id));
      if (editingId === row.id) reset();
      await load();
    } catch {
      setError("Failed to delete subject.");
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]);
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) {
      setError("Select at least one subject to delete.");
      return;
    }
    if (!window.confirm(`Delete ${selectedIds.length} selected subject(s)?`)) return;
    try {
      setBulkDeleting(true);
      setError("");
      setSuccess("");
      await Promise.all(selectedIds.map((id) => apiFetch(`/api/v1/core/subjects/${id}/`, { method: "DELETE" })));
      setSelectedIds([]);
      if (editingId && selectedIds.includes(editingId)) {
        reset();
      }
      setSuccess("Selected subjects deleted successfully.");
      await load();
    } catch {
      setError("Failed to delete selected subjects.");
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div>
      {isEditMode ? <p style={{ margin: "0 0 10px", color: "#0f766e", fontSize: 13, fontWeight: 600 }}>Edit mode active for selected subject.</p> : null}
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 130px 150px auto auto", gap: 8, marginBottom: 14, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Subject Name</label>
          <input
            required
            value={name}
            onChange={e => {
              setName(e.target.value);
              setFieldErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="e.g. Mathematics"
            style={{ display: "block", width: "100%", height: 36, border: `1px solid ${fieldErrors.name ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px", marginTop: 4 }}
          />
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.name || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Code</label>
          <input
            required
            value={code}
            onChange={e => {
              setCode(e.target.value.toUpperCase());
              setFieldErrors((prev) => ({ ...prev, code: undefined }));
            }}
            placeholder="MATH"
            style={{ display: "block", width: "100%", height: 36, border: `1px solid ${fieldErrors.code ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px", marginTop: 4 }}
          />
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.code || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Type</label>
          <select
            required
            value={subjectType}
            onChange={e => {
              setSubjectType(e.target.value);
              setFieldErrors((prev) => ({ ...prev, subject_type: undefined }));
            }}
            style={{ display: "block", width: "100%", height: 36, border: `1px solid ${fieldErrors.subject_type ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 8px", marginTop: 4 }}
          >
            <option value="compulsory">Compulsory</option>
            <option value="optional">Optional</option>
            <option value="elective">Elective</option>
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.subject_type || ""}</span>
        </div>
        <button type="submit" disabled={saving} style={{ height: 36, padding: "0 14px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", alignSelf: "end", opacity: saving ? 0.85 : 1 }}>{saving ? "Saving..." : isEditMode ? "Update" : "Add"}</button>
        {isEditMode ? <button type="button" onClick={reset} style={{ height: 36, padding: "0 14px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", alignSelf: "end" }}>Cancel</button> : null}
      </form>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button type="button" onClick={() => void deleteSelected()} disabled={!selectedIds.length || bulkDeleting} style={{ height: 32, padding: "0 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: selectedIds.length && !bulkDeleting ? "pointer" : "not-allowed", opacity: selectedIds.length && !bulkDeleting ? 1 : 0.6 }}>
          {bulkDeleting ? "Deleting..." : "Delete Selected"}
        </button>
      </div>
      {error && <p style={{ color: "var(--warning)", fontSize: 13, marginBottom: 8 }}>{error}</p>}
      {success && <p style={{ color: "#16a34a", fontSize: 13, marginBottom: 8 }}>{success}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
          {["Select", "Name", "Code", "Type", "Actions"].map(h => <th key={h} style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>{h}</th>)}
        </tr></thead>
        <tbody>{items.map(s => (
          <tr key={s.id}>
            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", width: 48 }}><input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSelect(s.id)} /></td>
            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{s.name}</td>
            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", fontSize: 13, color: "var(--text-muted)" }}>{s.code || "—"}</td>
            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", fontSize: 13, textTransform: "capitalize" }}>{s.subject_type}</td>
            <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", display: "flex", gap: 6 }}>
              <button type="button" onClick={() => edit(s)} style={{ height: 28, padding: "0 10px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Edit</button>
              <button type="button" onClick={() => void remove(s)} style={{ height: 28, padding: "0 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Delete</button>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────
const SECTION_NAME_REGEX = /^[A-Za-z0-9 ]+$/;
const SECTION_MIN_CAPACITY = 1;
const SECTION_MAX_CAPACITY = 200;
const SECTION_MAX_PER_CLASS = 26;

function SectionsSection() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [items, setItems] = useState<Section[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [schoolClassId, setSchoolClassId] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("40");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ school_class?: string; name?: string; capacity?: string }>({});
  const isEditMode = editingId !== null;

  const classSectionCount = useMemo(() => {
    const targetClassId = Number(schoolClassId);
    if (!targetClassId) return 0;
    return items.filter((row) => row.school_class === targetClassId).length;
  }, [items, schoolClassId]);

  const load = async () => {
    try {
      const [classData, sectionData] = await Promise.all([
        fetchAllPages<SchoolClass>("/api/v1/core/classes/?page_size=100"),
        fetchAllPages<Section>("/api/v1/core/sections/?page_size=100"),
      ]);
      const orderedClasses = sortAcademicsClasses(classData);
      setClasses(orderedClasses);
      setItems(sortSectionsByClassAndName(sectionData, orderedClasses));
    } catch {
      setError("Unable to load sections.");
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: { school_class?: string; name?: string; capacity?: string } = {};
    const names = name.split(",").map((part) => part.trim()).filter(Boolean);
    const capacityValue = Number(capacity);

    if (!schoolClassId) {
      nextErrors.school_class = "Class is required.";
    }
    if (!names.length) {
      nextErrors.name = "Section name is required.";
    } else if (names.some((entry) => !SECTION_NAME_REGEX.test(entry))) {
      nextErrors.name = "Section name can contain only alphanumeric characters.";
    }

    if (!Number.isInteger(capacityValue) || capacityValue < SECTION_MIN_CAPACITY || capacityValue > SECTION_MAX_CAPACITY) {
      nextErrors.capacity = "Enter valid section capacity";
    }

    if (!editingId && schoolClassId && names.length) {
      const uniqueInputCount = new Set(names.map((entry) => entry.toLowerCase())).size;
      if (classSectionCount + uniqueInputCount > SECTION_MAX_PER_CLASS) {
        nextErrors.name = "Section limit reached for this class.";
      }
    }

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setError(nextErrors.school_class || nextErrors.name || nextErrors.capacity || "Please correct highlighted fields.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setFieldErrors({});
      const payload = {
        school_class: Number(schoolClassId),
        name: names.join(","),
        capacity: capacityValue,
      };
      await apiFetch(editingId ? `/api/v1/core/sections/${editingId}/` : "/api/v1/core/sections/", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...payload,
        }),
      });
      setName("");
      if (editingId) {
        setSchoolClassId("");
      }
      setEditingId(null);
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create section.";
      if (message === "401") {
        setError("Session expired. Please log in again.");
      } else if (message && message !== "[object Object]") {
        if (message.toLowerCase().includes("already exist") || message.toLowerCase().includes("unique")) {
          setError("Section name already exists");
          setFieldErrors({ name: "Section name already exists" });
        } else if (message.toLowerCase().includes("capacity")) {
          setError("Enter valid section capacity");
          setFieldErrors({ capacity: "Enter valid section capacity" });
        } else {
          setError(message);
        }
      } else {
        setError(editingId ? "Failed to update section." : "Failed to create section.");
      }
    } finally {
      setSaving(false);
    }
  };

  const edit = (row: Section) => {
    setEditingId(row.id);
    setSchoolClassId(String(row.school_class));
    setName(row.name || "");
    setCapacity(String(row.capacity ?? 40));
    setFieldErrors({});
  };

  const reset = () => {
    setEditingId(null);
    setSchoolClassId("");
    setName("");
    setCapacity("40");
    setFieldErrors({});
  };

  const remove = async (row: Section) => {
    const className = classes.find((entry) => entry.id === row.school_class)?.name || `Class ${row.school_class}`;
    if (!window.confirm(`Delete section \"${row.name}\" from ${className}?`)) return;
    try {
      setError("");
      await apiFetch(`/api/v1/core/sections/${row.id}/`, { method: "DELETE" });
      if (editingId === row.id) reset();
      await load();
    } catch {
      setError("Failed to delete section.");
    }
  };

  return (
    <div>
      {isEditMode ? <p style={{ margin: "0 0 10px", color: "#0f766e", fontSize: 13, fontWeight: 600 }}>Edit mode active for selected section.</p> : null}
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) minmax(220px, 1fr) 120px auto auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Class</label>
          <select required value={schoolClassId} onChange={(e) => { setSchoolClassId(e.target.value); setFieldErrors((prev) => ({ ...prev, school_class: undefined, name: undefined })); }} style={{ display: "block", width: "100%", height: 36, border: `1px solid ${fieldErrors.school_class ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px", marginTop: 4 }}>
            <option value="">Select class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.school_class || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Section Name</label>
          <input required value={name} onChange={e => { setName(e.target.value); setFieldErrors((prev) => ({ ...prev, name: undefined })); }} placeholder="e.g. A or A,B,C" style={{ display: "block", width: "100%", height: 36, border: `1px solid ${fieldErrors.name ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px", marginTop: 4 }} />
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.name || ""}</span>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Capacity</label>
          <input type="number" min={SECTION_MIN_CAPACITY} max={SECTION_MAX_CAPACITY} value={capacity} onChange={e => { setCapacity(e.target.value); setFieldErrors((prev) => ({ ...prev, capacity: undefined })); }} style={{ display: "block", width: "100%", height: 36, border: `1px solid ${fieldErrors.capacity ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: "0 10px", marginTop: 4 }} />
          <span style={{ display: "block", minHeight: 16, fontSize: 12, color: "#dc2626" }}>{fieldErrors.capacity || ""}</span>
        </div>
        <button type="submit" disabled={saving} style={{ height: 36, padding: "0 14px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", alignSelf: "flex-end" }}>{saving ? "…" : isEditMode ? "Update" : "Add"}</button>
        {isEditMode ? <button type="button" onClick={reset} style={{ height: 36, padding: "0 14px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", alignSelf: "flex-end" }}>Cancel</button> : <span />}
      </form>
      <p style={{ marginTop: 0, marginBottom: 10, fontSize: 11, color: "var(--text-muted)" }}>Use comma to add multiple sections in one go. Class and capacity stay selected after save for quick repeat add.</p>
      {error && <p style={{ color: "var(--warning)", fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
          {"Class,Section,Capacity,Actions".split(",").map(h => <th key={h} style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>{h}</th>)}
        </tr></thead>
        <tbody>{items.map(s => {
          const schoolClass = classes.find((c) => c.id === s.school_class);
          return (
            <tr key={s.id}>
              <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{schoolClass?.name || `Class ${s.school_class}`}</td>
              <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{s.name}</td>
              <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", fontSize: 13, color: "var(--text-muted)" }}>{s.capacity ?? 0}</td>
              <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", display: "flex", gap: 6 }}>
                <button type="button" onClick={() => edit(s)} style={{ height: 28, padding: "0 10px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Edit</button>
                <button type="button" onClick={() => void remove(s)} style={{ height: 28, padding: "0 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Delete</button>
              </td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
type CoreSetupPanelProps = {
  initialTab?: Tab;
};

export function CoreSetupPanel({ initialTab = "years" }: CoreSetupPanelProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const tabs: { key: Tab; label: string }[] = [
    { key: "years", label: "Academic Years" },
    { key: "classes", label: "Classes" },
    { key: "sections", label: "Sections" },
    { key: "subjects", label: "Subjects" },
  ];

  return (
    <section>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Core Setup</h1>
        <p style={{ marginTop: 8, color: "var(--text-muted)" }}>Configure academic years, classes, sections, and subjects.</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 16 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px",
              border: "none",
              background: "transparent",
              borderBottom: tab === t.key ? "2px solid var(--primary)" : "2px solid transparent",
              color: tab === t.key ? "var(--primary)" : "var(--text-muted)",
              fontWeight: tab === t.key ? 600 : 400,
              cursor: "pointer",
              fontSize: 14,
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 }}>
        {tab === "years" && <AcademicYearsSection />}
        {tab === "classes" && <ClassesSection />}
        {tab === "sections" && <SectionsSection />}
        {tab === "subjects" && <SubjectsSection />}
      </div>
    </section>
  );
}
