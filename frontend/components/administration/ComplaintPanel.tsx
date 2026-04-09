"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { validateMeaningfulText } from "@/lib/meaningfulText";
import { DateConfirmDialog } from "@/components/common/DateConfirmDialog";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";

type ApiList<T> = T[] | { results?: T[] };

type ComplaintRow = {
  id: number;
  complaint_by: string;
  complaint_type: string;
  complaint_source: string;
  phone?: string;
  date?: string;
  action_taken?: string;
  assigned?: string;
  description?: string;
  file_url?: string;
};

type SelectOption = {
  value: string;
  label: string;
};

type AdminSetupRow = {
  id: number;
  type: "1" | "2" | "3" | "4";
  name: string;
};

type DateConfirmState = {
  title: string;
  message: string;
  resolve: (value: boolean) => void;
} | null;

const fallbackComplaintTypeOptions: SelectOption[] = [
  { value: "15", label: "Academic Performance" },
  { value: "16", label: "Discipline Issue" },
  { value: "19", label: "Fee Related" },
  { value: "21", label: "Food/Canteen" },
  { value: "17", label: "Infrastructure" },
  { value: "22", label: "Safety Concern" },
  { value: "20", label: "Staff Behaviour" },
  { value: "18", label: "Transport" },
];

const fallbackComplaintSourceOptions: SelectOption[] = [
  { value: "27", label: "Newspaper Ad" },
  { value: "24", label: "Phone Call" },
  { value: "28", label: "Referral" },
  { value: "29", label: "School Event" },
  { value: "26", label: "Social Media" },
  { value: "23", label: "Walk-in" },
  { value: "25", label: "Website" },
  { value: "in_person", label: "In Person" },
  { value: "online", label: "Online" },
  { value: "written", label: "Written" },
];

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

function getComplaintTypeBadgeClass(label: string) {
  const map: Record<string, string> = {
    "Academic Performance": "badge-academic-performance",
    "Discipline Issue": "badge-discipline-issue",
    "Fee Related": "badge-fee-related",
    "Food/Canteen": "badge-food-canteen",
    Infrastructure: "badge-infrastructure",
    "Safety Concern": "badge-safety-concern",
    "Staff Behaviour": "badge-staff-behaviour",
    Transport: "badge-transport",
  };
  return map[label] || "badge-default";
}

function getSourceBadgeClass(label: string) {
  const map: Record<string, string> = {
    "Walk-in": "source-walk-in",
    "Phone Call": "source-phone-call",
    Phone: "source-phone-call",
    Online: "source-online",
    "In Person": "source-in-person",
    Written: "source-written",
    "Newspaper Ad": "source-newspaper-ad",
    Referral: "source-referral",
    "School Event": "source-school-event",
    "Social Media": "source-social-media",
    Website: "source-website",
  };
  return map[label] || "source-default";
}

export function ComplaintPanel() {
  const [items, setItems] = useState<ComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [editingId, setEditingId] = useState<number | null>(null);
  const [complaintBy, setComplaintBy] = useState("");
  const [complaintType, setComplaintType] = useState("");
  const [complaintSource, setComplaintSource] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [assigned, setAssigned] = useState("");
  const [description, setDescription] = useState("");
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [dateConfirm, setDateConfirm] = useState<DateConfirmState>(null);
  const [deleteTarget, setDeleteTarget] = useState<ComplaintRow | null>(null);
  const [typeOptions, setTypeOptions] = useState<SelectOption[]>([]);
  const [sourceOptions, setSourceOptions] = useState<SelectOption[]>([]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const askDateConfirmation = (title: string, message: string) =>
    new Promise<boolean>((resolve) => {
      setDateConfirm({ title, message, resolve });
    });

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

    const complaintByError = pick("complaint_by");
    const complaintTypeError = pick("complaint_type");
    const complaintSourceError = pick("complaint_source");
    const phoneError = pick("phone");
    const dateError = pick("date");
    const actionTakenError = pick("action_taken");
    const assignedError = pick("assigned");
    const descriptionError = pick("description");
    const attachmentError = pick("file_upload");

    if (complaintByError) next.complaintBy = complaintByError;
    if (complaintTypeError) next.complaintType = complaintTypeError;
    if (complaintSourceError) next.complaintSource = complaintSourceError;
    if (phoneError) next.phone = phoneError;
    if (dateError) next.date = dateError;
    if (actionTakenError) next.actionTaken = actionTakenError;
    if (assignedError) next.assigned = assignedError;
    if (descriptionError) next.description = descriptionError;
    if (attachmentError) next.attachment = attachmentError;

    return Object.keys(next).length > 0 ? next : null;
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [complaintData, setupData] = await Promise.all([
        apiGet<ApiList<ComplaintRow>>("/api/v1/admissions/complaints/"),
        apiGet<ApiList<AdminSetupRow>>("/api/v1/admissions/admin-setups/"),
      ]);

      const setups = listData(setupData);
      const complaintTypes = setups
        .filter((row) => row.type === "2")
        .map((row) => ({ value: String(row.id), label: String(row.name || "").trim() }))
        .filter((row) => row.label)
        .sort((a, b) => a.label.localeCompare(b.label));

      const complaintSources = setups
        .filter((row) => row.type === "3")
        .map((row) => ({ value: String(row.id), label: String(row.name || "").trim() }))
        .filter((row) => row.label)
        .sort((a, b) => a.label.localeCompare(b.label));

      setTypeOptions(complaintTypes);
      setSourceOptions(complaintSources);
      setItems(listData(complaintData));
    } catch {
      setError("Unable to load complaints.");
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
    setComplaintBy("");
    setComplaintType("");
    setComplaintSource("");
    setPhone("");
    setDate(today);
    setActionTaken("");
    setAssigned("");
    setDescription("");
    setFileUpload(null);
    setFileUrl("");
    setFieldErrors({});
  };

  const setErrorField = (field: string, message: string) => {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  const validateMeaningfulField = (value: string, field: string) => {
    if (!value.trim()) return "";
    const check = validateMeaningfulText(value, field);
    return check.valid ? "" : (check.error || "Please enter meaningful text.");
  };

  const validateField = (field: string, value?: string) => {
    const v = value ??
      (field === "complaintBy"
        ? complaintBy
        : field === "complaintType"
          ? complaintType
          : field === "complaintSource"
            ? complaintSource
            : field === "phone"
              ? phone
              : field === "date"
                ? date
                : field === "actionTaken"
                  ? actionTaken
                  : field === "assigned"
                    ? assigned
                    : field === "description"
                      ? description
                      : "");

    if (field === "complaintBy") {
      if (!v.trim()) return "Complaint By is required.";
      if (v.trim().length < 2) return "Minimum 2 characters required.";
      if (!/^[A-Za-z\s\-']+$/.test(v.trim())) return "Only letters, spaces, hyphens, apostrophes allowed.";
      const check = validateMeaningfulText(v, "Complaint By");
      if (!check.valid) return "Only letters, spaces, hyphens, apostrophes allowed.";
      return "";
    }

    if (field === "complaintType") {
      if (!complaintType) return "Please select a complaint type.";
      return "";
    }

    if (field === "complaintSource") {
      if (!complaintSource) return "Please select a complaint source.";
      return "";
    }

    if (field === "phone") {
      if (!phone.trim()) return "";
      if (!/^\d+$/.test(phone)) return "Only digits (0-9) are allowed.";
      if (phone.length < 10) return "Phone must be at least 10 digits.";
      if (phone.length > 12) return "Phone must not exceed 12 digits.";
      return "";
    }

    if (field === "date") {
      if (!date) return "Please select a date.";
      if (date > today) return "Date cannot be in the future.";
      return "";
    }

    if (field === "actionTaken") {
      if (!actionTaken.trim()) return "";
      const message = validateMeaningfulField(actionTaken, "Action Taken");
      return message ? "Please enter meaningful text." : "";
    }

    if (field === "assigned") {
      if (!assigned.trim()) return "";
      const message = validateMeaningfulField(assigned, "Assigned");
      return message ? "Please enter a valid name." : "";
    }

    if (field === "description") {
      if (!description.trim()) return "";
      if (description.trim().length < 10) return "Description must be at least 10 characters.";
      const message = validateMeaningfulField(description, "Description");
      return message ? "Please enter meaningful text." : "";
    }

    if (field === "attachment") {
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
    const keys = ["complaintBy", "complaintType", "complaintSource", "phone", "date", "actionTaken", "assigned", "description", "attachment"];
    const nextErrors: Record<string, string> = {};
    keys.forEach((key) => {
      const msg = validateField(key);
      if (msg) nextErrors[key] = msg;
    });
    setFieldErrors(nextErrors);
    return nextErrors;
  };

  const edit = (row: ComplaintRow) => {
    const availableTypes = typeOptions.length > 0 ? typeOptions : fallbackComplaintTypeOptions;
    const availableSources = sourceOptions.length > 0 ? sourceOptions : fallbackComplaintSourceOptions;
    const matchedType = availableTypes.find((option) => option.value === row.complaint_type || option.label === row.complaint_type);
    const matchedSource = availableSources.find((option) => option.value === row.complaint_source || option.label === row.complaint_source);

    setEditingId(row.id);
    setComplaintBy(sanitizePlain(row.complaint_by || ""));
    setComplaintType(matchedType?.value || "");
    setComplaintSource(matchedSource?.value || "");
    setPhone((row.phone || "").replace(/\D/g, "").slice(0, 12));
    setDate(row.date || today);
    setActionTaken(stripHtml(row.action_taken || ""));
    setAssigned(stripHtml(row.assigned || ""));
    setDescription(stripHtml(row.description || ""));
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
    formData.append("complaint_by", complaintBy.trim());
    formData.append("complaint_type", complaintType.trim());
    formData.append("complaint_source", complaintSource.trim());
    formData.append("phone", phone.trim());
    if (date) formData.append("date", date);
    formData.append("action_taken", actionTaken.trim());
    formData.append("assigned", assigned.trim());
    formData.append("description", description.trim());
    if (fileUpload) formData.append("file_upload", fileUpload);

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setFieldErrors({});
      if (editingId) {
        await apiForm(`/api/v1/admissions/complaints/${editingId}/`, "PATCH", formData);
        setSuccess("Complaint updated successfully.");
      } else {
        await apiForm("/api/v1/admissions/complaints/", "POST", formData);
        setSuccess("Complaint added successfully.");
      }
      reset();
      await load();
    } catch (err: unknown) {
      const apiFieldErrors = readApiFieldErrors(err);
      if (apiFieldErrors) {
        setFieldErrors(apiFieldErrors);
        setError("Please fix the errors below.");
      } else {
        setError(getErrorMessage(err, editingId ? "Unable to update complaint." : "Unable to add complaint."));
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
      await apiDelete(`/api/v1/admissions/complaints/${id}/`);
      setItems((prev) => prev.filter((row) => row.id !== id));
      setSuccess("Complaint deleted.");
    } catch {
      setError("Unable to delete complaint.");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) =>
      [row.complaint_by, row.complaint_type, row.complaint_source, row.phone || ""].join(" ").toLowerCase().includes(q),
    );
  }, [items, search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const handleDateChange = async (value: string) => {
    if (!value) {
      setDate("");
      setErrorField("date", "Please select a date.");
      return;
    }

    if (value > today) {
      setDate("");
      setErrorField("date", "Date cannot be in the future.");
      return;
    }

    const oldLimit = new Date(today);
    oldLimit.setDate(oldLimit.getDate() - 7);
    const selected = new Date(`${value}T00:00:00`);

    if (selected < oldLimit) {
      const keep = await askDateConfirmation("Complaint Date Warning", "This date is more than 7 days old. Are you sure?");
      if (!keep) {
        setDate("");
        setErrorField("date", "Please select a date.");
        document.getElementById("c-date")?.focus();
        return;
      }
    }

    setDate(value);
    setErrorField("date", "");
  };

  return (
    <div className="legacy-panel complaint-panel-wrap">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />

      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Complaint</h1>
            <nav aria-label="Breadcrumb">
              <ol style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13, margin: 0, padding: 0, listStyle: "none" }}>
                <li><a href="/dashboard">Dashboard</a></li>
                <li>/</li>
                <li>Admin Section</li>
                <li>/</li>
                <li aria-current="page">Complaint</li>
              </ol>
            </nav>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_admin_visitor">
        <div className="container-fluid p-0" style={{ maxWidth: "100%" }}>
          <div className="complaint-grid" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12, alignItems: "start", maxWidth: "100%" }}>
            <div className="white-box complaint-form-panel" style={{ ...boxStyle(), alignSelf: "start", height: "auto" }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Complaint" : "Add Complaint"}</h3>
              <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
                <div className="form-group">
                  <label htmlFor="c-complaint-by">Complaint By *</label>
                  <input
                    id="c-complaint-by"
                    name="complaint_by"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="e.g. Parent of Rahul"
                    value={complaintBy}
                    onInput={(e) => {
                      const target = e.currentTarget;
                      const cleaned = sanitizePlain(target.value).replace(/[^A-Za-z\s\-']/g, "").slice(0, 100);
                      setComplaintBy(cleaned);
                      setErrorField("complaintBy", validateField("complaintBy", cleaned));
                    }}
                    onBlur={() => setErrorField("complaintBy", validateField("complaintBy", complaintBy))}
                    style={fieldStyle(Boolean(fieldErrors.complaintBy))}
                  />
                  <small className="form-error text-danger" style={{ display: fieldErrors.complaintBy ? "block" : "none" }}>{fieldErrors.complaintBy || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="c-complaint-type">Complaint Type *</label>
                  {(() => {
                    const options = typeOptions.length > 0 ? typeOptions : fallbackComplaintTypeOptions;
                    return (
                  <select
                    id="c-complaint-type"
                    name="complaint_type"
                    required
                    value={complaintType}
                    onChange={(e) => {
                      setComplaintType(e.target.value);
                      setErrorField("complaintType", validateField("complaintType"));
                    }}
                    onBlur={() => setErrorField("complaintType", validateField("complaintType"))}
                    style={fieldStyle(Boolean(fieldErrors.complaintType))}
                  >
                    <option value="" disabled>Select Complaint Type</option>
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                    );
                  })()}
                  <small className="form-error text-danger" style={{ display: fieldErrors.complaintType ? "block" : "none" }}>{fieldErrors.complaintType || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="c-source">Complaint Source *</label>
                  {(() => {
                    const options = sourceOptions.length > 0 ? sourceOptions : fallbackComplaintSourceOptions;
                    return (
                  <select
                    id="c-source"
                    name="complaint_source"
                    required
                    value={complaintSource}
                    onChange={(e) => {
                      setComplaintSource(e.target.value);
                      setErrorField("complaintSource", validateField("complaintSource"));
                    }}
                    onBlur={() => setErrorField("complaintSource", validateField("complaintSource"))}
                    style={fieldStyle(Boolean(fieldErrors.complaintSource))}
                  >
                    <option value="" disabled>Select Complaint Source</option>
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                    );
                  })()}
                  <small className="form-error text-danger" style={{ display: fieldErrors.complaintSource ? "block" : "none" }}>{fieldErrors.complaintSource || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="c-phone">Phone</label>
                  <input
                    id="c-phone"
                    name="phone"
                    type="text"
                    inputMode="numeric"
                    minLength={10}
                    maxLength={12}
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onKeyDown={(e) => {
                      if (!["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight"].includes(e.key) && !/^[0-9]$/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onInput={(e) => {
                      const cleaned = e.currentTarget.value.replace(/\D/g, "").slice(0, 12);
                      setPhone(cleaned);
                      setErrorField("phone", validateField("phone"));
                    }}
                    onBlur={() => setErrorField("phone", validateField("phone"))}
                    style={fieldStyle(Boolean(fieldErrors.phone))}
                  />
                  <small className="form-error text-danger" style={{ display: fieldErrors.phone ? "block" : "none" }}>{fieldErrors.phone || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="c-date">Date</label>
                  <input
                    id="c-date"
                    name="complaint_date"
                    type="date"
                    required
                    max={today}
                    value={date}
                    onChange={(e) => void handleDateChange(e.target.value)}
                    onBlur={() => setErrorField("date", validateField("date"))}
                    style={fieldStyle(Boolean(fieldErrors.date))}
                  />
                  <small className="form-error text-danger" style={{ display: fieldErrors.date ? "block" : "none" }}>{fieldErrors.date || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="c-action-taken">Action Taken</label>
                  <input
                    id="c-action-taken"
                    name="action_taken"
                    type="text"
                    maxLength={500}
                    placeholder="e.g. Called parent for discussion"
                    value={actionTaken}
                    onInput={(e) => {
                      const cleaned = stripHtml(e.currentTarget.value).slice(0, 500);
                      setActionTaken(cleaned);
                      setErrorField("actionTaken", validateField("actionTaken"));
                    }}
                    onBlur={() => setErrorField("actionTaken", validateField("actionTaken"))}
                    style={fieldStyle(Boolean(fieldErrors.actionTaken))}
                  />
                  <small className="form-error text-danger" style={{ display: fieldErrors.actionTaken ? "block" : "none" }}>{fieldErrors.actionTaken || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="c-assigned">Assigned</label>
                  <input
                    id="c-assigned"
                    name="assigned"
                    type="text"
                    maxLength={100}
                    minLength={2}
                    placeholder="e.g. Mr. Sharma"
                    value={assigned}
                    onInput={(e) => {
                      const cleaned = stripHtml(e.currentTarget.value).slice(0, 100);
                      setAssigned(cleaned);
                      setErrorField("assigned", validateField("assigned"));
                    }}
                    onBlur={() => setErrorField("assigned", validateField("assigned"))}
                    style={fieldStyle(Boolean(fieldErrors.assigned))}
                  />
                  <small className="form-error text-danger" style={{ display: fieldErrors.assigned ? "block" : "none" }}>{fieldErrors.assigned || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="c-description">Description</label>
                  <textarea
                    id="c-description"
                    name="description"
                    maxLength={2000}
                    minLength={10}
                    rows={3}
                    placeholder="e.g. Parent reported broken fence near playground"
                    value={description}
                    onInput={(e) => {
                      const cleaned = stripHtml(e.currentTarget.value).slice(0, 2000);
                      setDescription(cleaned);
                      setErrorField("description", validateField("description"));
                    }}
                    onBlur={() => setErrorField("description", validateField("description"))}
                    style={textAreaStyle(Boolean(fieldErrors.description))}
                  />
                  <small className="form-error text-danger" style={{ display: fieldErrors.description ? "block" : "none" }}>{fieldErrors.description || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="c-attachment">Attachment</label>
                  <input
                    id="c-attachment"
                    name="attachment"
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setFileUpload(file);
                      if (!file) {
                        setErrorField("attachment", "");
                        return;
                      }
                      const fileName = file.name.toLowerCase();
                      const ext = "." + (fileName.includes(".") ? fileName.split(".").pop() : "");
                      const allowed = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
                      if (!allowed.includes(ext)) {
                        setErrorField("attachment", "Invalid file type. Allowed: PDF, DOC, JPG, PNG.");
                        setFileUpload(null);
                        e.currentTarget.value = "";
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        setErrorField("attachment", "File size exceeds 5MB limit.");
                        setFileUpload(null);
                        e.currentTarget.value = "";
                        return;
                      }
                      setErrorField("attachment", "");
                    }}
                    style={{ ...fieldStyle(Boolean(fieldErrors.attachment)), padding: 6 }}
                  />
                  <small className="form-error text-danger" style={{ display: fieldErrors.attachment ? "block" : "none" }}>{fieldErrors.attachment || ""}</small>
                </div>

                {editingId && fileUrl ? <a href={fileUrl} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontSize: 12 }}>View existing file</a> : null}

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={saving} style={buttonStyle()}>{saving ? "Saving..." : editingId ? "Update" : "Save"}</button>
                  {editingId ? <button type="button" onClick={reset} style={buttonStyle("#6b7280")}>Cancel</button> : null}
                </div>
              </form>
            </div>

            <div className="white-box" style={{ ...boxStyle(), maxWidth: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>Complaint List</h3>
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Quick search" style={{ ...fieldStyle(), maxWidth: 240 }} />
              </div>

              <div style={{ overflowX: "auto" }}>
                <table aria-label="Complaint list table" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 900 }}>
                  <caption>List of all complaints</caption>
                  <thead>
                    <tr>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", whiteSpace: "nowrap", width: 50 }}>SL</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", whiteSpace: "nowrap", width: 180 }}>Complaint By</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", whiteSpace: "nowrap", width: 180 }}>Complaint Type</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", whiteSpace: "nowrap", width: 140 }}>Source</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", whiteSpace: "nowrap", width: 120 }}>Phone</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", whiteSpace: "nowrap", width: 130 }}>Date</th>
                      <th scope="col" style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left", whiteSpace: "nowrap", width: 100 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && pageRows.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: 12, color: "var(--text-muted)" }}>No complaints found.</td></tr>
                    ) : (
                      pageRows.map((row, index) => (
                        <tr key={row.id}>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{start + index + 1}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)", overflow: "hidden", textOverflow: "ellipsis" }}>{safeRender(row.complaint_by)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            <span className={`complaint-type-badge ${getComplaintTypeBadgeClass(safeRender(row.complaint_type))}`}>{safeRender(row.complaint_type) || "N/A"}</span>
                          </td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            <span className={`source-badge ${getSourceBadgeClass(safeRender(row.complaint_source))}`}>{safeRender(row.complaint_source) || "N/A"}</span>
                          </td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{safeRender(row.phone) || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{safeRender(row.date) || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            <button type="button" className="action-btn action-btn-edit" title="Edit Complaint" onClick={() => edit(row)}>
                              <i className="fas fa-pencil-alt" />
                            </button>
                            <button type="button" className="action-btn action-btn-delete" title="Delete Complaint" disabled={busyId === row.id} onClick={() => setDeleteTarget(row)}>
                              <i className="fas fa-trash-alt" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Showing {total === 0 ? 0 : start + 1}-{Math.min(start + pageSize, total)} of {total} records</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ ...fieldStyle(), width: 96 }}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} style={buttonStyle("#64748b")}>Previous</button>
                  <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} style={buttonStyle("#64748b")}>Next</button>
                </div>
              </div>

              {loading && <p style={{ marginTop: 10, color: "var(--text-muted)" }}>Loading complaints...</p>}
              {error && <p style={{ marginTop: 10, color: "var(--warning)" }}>{error}</p>}
              {success && <p style={{ marginTop: 10, color: "#0f766e" }}>{success}</p>}
            </div>
          </div>
        </div>
      </section>

      <DateConfirmDialog
        open={Boolean(dateConfirm)}
        title={dateConfirm?.title || ""}
        message={dateConfirm?.message || ""}
        onAccept={() => {
          if (!dateConfirm) return;
          dateConfirm.resolve(true);
          setDateConfirm(null);
          setErrorField("date", "");
        }}
        onCancel={() => {
          if (!dateConfirm) return;
          dateConfirm.resolve(false);
          setDateConfirm(null);
          setDate("");
          setErrorField("date", "Please select a date.");
        }}
      />

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title="Confirm Delete"
        message="Are you sure you want to delete this complaint? This action cannot be undone."
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
        .complaint-grid {
          width: 100%;
        }

        .form-helper {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }

        .form-error {
          font-size: 12px;
          color: #dc3545;
          margin-top: 2px;
        }

        .complaint-type-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.3px;
          white-space: nowrap;
          text-align: center;
        }

        .badge-academic-performance { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
        .badge-discipline-issue { background: #fff3e0; color: #e65100; border: 1px solid #ffcc80; }
        .badge-fee-related { background: #e3f2fd; color: #1565c0; border: 1px solid #90caf9; }
        .badge-food-canteen { background: #fff8e1; color: #f9a825; border: 1px solid #ffe082; }
        .badge-infrastructure { background: #f3e5f5; color: #7b1fa2; border: 1px solid #ce93d8; }
        .badge-safety-concern { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }
        .badge-staff-behaviour { background: #e0f7fa; color: #00838f; border: 1px solid #80deea; }
        .badge-transport { background: #eceff1; color: #37474f; border: 1px solid #b0bec5; }
        .badge-default { background: #eef2ff; color: #1f2937; border: 1px solid #c7d2fe; }

        .source-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .source-walk-in { background: #e8eaf6; color: #283593; }
        .source-phone-call { background: #fce4ec; color: #ad1457; }
        .source-online { background: #e0f2f1; color: #00695c; }
        .source-in-person { background: #fff3e0; color: #e65100; }
        .source-written { background: #f3e5f5; color: #6a1b9a; }
        .source-newspaper-ad { background: #fffde7; color: #f57f17; }
        .source-referral { background: #e1f5fe; color: #0277bd; }
        .source-school-event { background: #e8f5e9; color: #2e7d32; }
        .source-social-media { background: #fbe9e7; color: #bf360c; }
        .source-website { background: #eceff1; color: #37474f; }
        .source-default { background: #edf2f7; color: #334155; }

        .action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
          margin: 0 3px;
        }

        .action-btn-edit {
          background: #e3f2fd;
          color: #1565c0;
        }

        .action-btn-edit:hover {
          background: #1565c0;
          color: #fff;
          transform: scale(1.1);
          box-shadow: 0 2px 8px rgba(21, 101, 192, 0.3);
        }

        .action-btn-delete {
          background: #ffebee;
          color: #c62828;
        }

        .action-btn-delete:hover {
          background: #c62828;
          color: #fff;
          transform: scale(1.1);
          box-shadow: 0 2px 8px rgba(198, 40, 40, 0.3);
        }

        @media (max-width: 768px) {
          .complaint-grid {
            grid-template-columns: 1fr !important;
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
