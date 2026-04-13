"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { TopToast } from "@/components/common/TopToast";

type ApiList<T> = T[] | { count?: number; next?: string | null; previous?: string | null; results?: T[] };

type CertificateRow = {
  id: number;
  type: "School" | "Lms";
  title: string;
  applicable_role_id?: number | null;
  body: string;
  background_height: string;
  background_width: string;
  padding_top: string;
  padding_right: string;
  padding_bottom: string;
  pading_left: string;
  background_url?: string;
};

type RoleOption = {
  id: number;
  name: string;
};

type FormErrors = Record<string, string>;
type TouchedState = Record<string, boolean>;

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
  return apiRequestWithRefresh<T>(path, { method, body: formData });
}

function isMeaningfulText(value: string, minimumMeaningfulChars: number): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  const noSpaces = trimmed.replace(/\s+/g, "");
  if (/^(.)\1+$/.test(noSpaces)) return false;
  if (/^[^a-zA-Z0-9]+$/.test(noSpaces)) return false;

  const meaningfulChars = trimmed.replace(/[^a-zA-Z0-9]/g, "");
  return meaningfulChars.length >= minimumMeaningfulChars;
}

function sanitizeCertificateBody(value: string): string {
  return value.replace(/<\s*script.*?>.*?<\s*\/\s*script\s*>/gis, "").trim();
}

function secureUploadFileName(file: File): File {
  const ext = file.type === "image/png" ? "png" : "jpg";
  const token = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replaceAll("-", "")
    : `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  return new File([file], `certificate_bg_${token}.${ext}`, { type: file.type });
}

function validateNumberField(value: string, min: number, max: number): string {
  if (!value.trim()) return "This field is required.";
  if (!/^\d+$/.test(value)) return "Only digits are allowed.";
  const n = Number(value);
  if (n < min || n > max) return `Value must be between ${min} and ${max}.`;
  return "";
}

function normalizeIntegerField(value: unknown, fallback: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  if (/^\d+$/.test(raw)) return raw;

  const asNumber = Number(raw);
  if (!Number.isFinite(asNumber)) return fallback;
  const normalized = Math.trunc(asNumber);
  if (normalized < 0) return fallback;
  return String(normalized);
}

function readApiFieldErrors(err: unknown): { main?: string; title?: string } | null {
  const details = (err as { details?: unknown } | null)?.details;
  if (!details || typeof details !== "object") return null;

  const detailsRaw = details as Record<string, unknown>;
  const fieldErrorsRaw =
    detailsRaw.field_errors && typeof detailsRaw.field_errors === "object"
      ? (detailsRaw.field_errors as Record<string, unknown>)
      : {};

  const pick = (key: string) => {
    const value = detailsRaw[key] ?? fieldErrorsRaw[key];
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length > 0) return String(value[0]);
    return "";
  };

  const topMessage = typeof detailsRaw.message === "string" ? detailsRaw.message.trim() : "";
  const nonFieldError = pick("non_field_errors") || pick("detail");
  const titleError = pick("title");
  const main = topMessage || nonFieldError || titleError;

  return main || titleError ? { main, title: titleError || undefined } : null;
}

export function CertificatePanel() {
  const [items, setItems] = useState<CertificateRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [toast, setToast] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [type, setType] = useState<"School" | "Lms">("School");
  const [roleId, setRoleId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [height, setHeight] = useState("144");
  const [width, setWidth] = useState("165");
  const [pt, setPt] = useState("5");
  const [pr, setPr] = useState("5");
  const [pb, setPb] = useState("5");
  const [pl, setPl] = useState("5");
  const [backgroundUpload, setBackgroundUpload] = useState<File | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [previewUploadUrl, setPreviewUploadUrl] = useState("");

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<TouchedState>({});

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [templateData, roleData] = await Promise.all([
        apiGet<ApiList<CertificateRow>>("/api/v1/admissions/certificate-templates/"),
        apiGet<ApiList<RoleOption>>("/api/v1/access-control/roles/"),
      ]);
      setItems(listData(templateData));
      setRoles(listData(roleData));
    } catch {
      setError("Unable to load certificates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim().toLowerCase());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    if (!backgroundUpload) {
      setPreviewUploadUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(backgroundUpload);
    setPreviewUploadUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [backgroundUpload]);

  const roleNameById = useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles]);

  const reset = () => {
    setEditingId(null);
    setType("School");
    setRoleId("");
    setTitle("");
    setBody("");
    setHeight("144");
    setWidth("165");
    setPt("5");
    setPr("5");
    setPb("5");
    setPl("5");
    setBackgroundUpload(null);
    setBackgroundUrl("");
    setErrors({});
    setTouched({});
  };

  const edit = (row: CertificateRow) => {
    setEditingId(row.id);
    setType((row.type || "School") as "School" | "Lms");
    setRoleId(row.applicable_role_id ? String(row.applicable_role_id) : "");
    setTitle(row.title || "");
    setBody(row.body || "");
    setHeight(normalizeIntegerField(row.background_height, "144"));
    setWidth(normalizeIntegerField(row.background_width, "165"));
    setPt(normalizeIntegerField(row.padding_top, "5"));
    setPr(normalizeIntegerField(row.padding_right, "5"));
    setPb(normalizeIntegerField(row.padding_bottom, "5"));
    setPl(normalizeIntegerField(row.pading_left, "5"));
    setBackgroundUpload(null);
    setBackgroundUrl(row.background_url || "");
    setErrors({});
    setTouched({});
  };

  const validateField = (name: string): string => {
    if (name === "title") {
      if (!title.trim()) return "Certificate title is required.";
      if (title.trim().length < 3) return "Title must be at least 3 characters.";
      if (title.trim().length > 150) return "Title must be at most 150 characters.";
      if (!isMeaningfulText(title, 3)) return "Use a meaningful title (not aaa/###/!!!).";
      return "";
    }
    if (name === "body") {
      if (!body.trim()) return "Certificate body is required.";
      if (body.trim().length < 10) return "Body must be at least 10 characters.";
      if (!isMeaningfulText(body, 10)) return "Use meaningful body text.";
      return "";
    }
    if (name === "height") return validateNumberField(height, 50, 500);
    if (name === "width") return validateNumberField(width, 50, 500);
    if (name === "pt") return validateNumberField(pt, 0, 100);
    if (name === "pr") return validateNumberField(pr, 0, 100);
    if (name === "pb") return validateNumberField(pb, 0, 100);
    if (name === "pl") return validateNumberField(pl, 0, 100);
    if (name === "background") {
      if (!backgroundUpload) return "";
      if (!["image/png", "image/jpeg"].includes(backgroundUpload.type)) return "Only PNG/JPG allowed.";
      if (backgroundUpload.size > 2 * 1024 * 1024) return "Max file size is 2MB.";
      return "";
    }
    return "";
  };

  const validateAll = (): FormErrors => {
    const names = ["title", "body", "height", "width", "pt", "pr", "pb", "pl", "background"];
    const next: FormErrors = {};
    names.forEach((name) => {
      const msg = validateField(name);
      if (msg) next[name] = msg;
    });
    return next;
  };

  const setNumberValue = (setter: (value: string) => void, value: string, fieldName: string) => {
    if (!/^\d*$/.test(value)) return;
    setter(value);
    if (touched[fieldName]) {
      setErrors((prev) => ({ ...prev, [fieldName]: validateField(fieldName) }));
    }
  };

  const markTouched = (fieldName: string) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
    setErrors((prev) => ({ ...prev, [fieldName]: validateField(fieldName) }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const nextErrors = validateAll();
    setTouched({ title: true, body: true, height: true, width: true, pt: true, pr: true, pb: true, pl: true, background: true });
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setError("Please fix validation errors before saving.");
      return;
    }

    const formData = new FormData();
    formData.append("type", type);
    formData.append("title", title.trim());
    if (roleId) formData.append("applicable_role_id", roleId);
    formData.append("body", sanitizeCertificateBody(body));
    formData.append("background_height", height);
    formData.append("background_width", width);
    formData.append("padding_top", pt);
    formData.append("padding_right", pr);
    formData.append("padding_bottom", pb);
    formData.append("pading_left", pl);
    if (backgroundUpload) {
      formData.append("background_upload", secureUploadFileName(backgroundUpload));
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      if (editingId) {
        await apiForm(`/api/v1/admissions/certificate-templates/${editingId}/`, "PATCH", formData);
        setSuccess("Record updated successfully.");
        setToast("Record updated successfully.");
      } else {
        await apiForm("/api/v1/admissions/certificate-templates/", "POST", formData);
        setSuccess("Record created successfully.");
        setToast("Record created successfully.");
      }
      reset();
      await load();
    } catch (err: unknown) {
      const apiFieldErrors = readApiFieldErrors(err);
      if (apiFieldErrors) {
        if (apiFieldErrors.title) {
          setErrors((prev) => ({ ...prev, title: apiFieldErrors.title || "" }));
        }
        setError(apiFieldErrors.main || "Please fix validation errors before saving.");
      } else {
        setError(editingId ? "Unable to update certificate." : "Unable to save certificate.");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    const ok = window.confirm("Are you sure to delete this certificate template?");
    if (!ok) return;
    try {
      setBusyId(id);
      setError("");
      setSuccess("");
      await apiDelete(`/api/v1/admissions/certificate-templates/${id}/`);
      setItems((prev) => prev.filter((row) => row.id !== id));
      setSuccess("Record deleted successfully.");
      setToast("Record deleted successfully.");
    } catch {
      setError("Unable to delete certificate.");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return items;
    return items.filter((row) => [row.title, row.type, row.body].join(" ").toLowerCase().includes(search));
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, filtered.length);
  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSize, safePage]);

  const previewBody = sanitizeCertificateBody(body)
    .replaceAll("[student_name]", "John Doe")
    .replaceAll("[class]", "Grade 10")
    .replaceAll("[date]", new Date().toISOString().slice(0, 10));

  const previewBg = previewUploadUrl || backgroundUrl;

  return (
    <div className="legacy-panel certificate-page">
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
          <div className="breadcrumb-row">
            <h1 className="page-title">Certificate</h1>
            <div className="breadcrumb-path" aria-label="Breadcrumb">
              <span>Dashboard</span>
              <span>/</span>
              <span>Admin Section</span>
              <span>/</span>
              <span>Certificate</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_admin_visitor">
        <div className="container-fluid p-0">
          <div className="content-grid">
            <div className="white-box form-panel">
              <h3>📜 Create Certificate</h3>

              <form onSubmit={submit} className="certificate-form" noValidate>
                <div className="row-2">
                  <div className="field-wrap">
                    <label htmlFor="certificateType">Certificate Type *</label>
                    <select id="certificateType" value={type} onChange={(e) => setType(e.target.value as "School" | "Lms")}> 
                      <option value="School">School</option>
                      <option value="Lms">LMS</option>
                    </select>
                    <p className="helper">Select where this certificate will be used.</p>
                    <p className="example"><strong>Example:</strong> School, LMS</p>
                  </div>

                  <div className="field-wrap">
                    <label htmlFor="applicableRole">Applicable Role *</label>
                    <select id="applicableRole" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                      <option value="">All roles</option>
                      {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                    <p className="helper">Choose which role can receive this certificate.</p>
                    <p className="example"><strong>Example:</strong> Admin, Driver, Manager</p>
                  </div>
                </div>

                <div className="field-wrap">
                  <label htmlFor="certificateTitle">Certificate Title *</label>
                  <input
                    id="certificateTitle"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (touched.title) setErrors((prev) => ({ ...prev, title: validateField("title") }));
                    }}
                    onBlur={() => markTouched("title")}
                    placeholder="e.g. Academic Excellence Award"
                    minLength={3}
                    maxLength={150}
                    aria-invalid={!!errors.title}
                    className={errors.title ? "invalid" : ""}
                  />
                  <p className="helper">Enter a meaningful title (3–150 characters).</p>
                  <p className="example"><strong>Example:</strong> Merit Certificate, Best Student Award, Outstanding Performance</p>
                  {errors.title ? <p className="error-text">{errors.title}</p> : null}
                </div>

                <div className="field-wrap">
                  <label htmlFor="certificateBody">Certificate Body *</label>
                  <textarea
                    id="certificateBody"
                    value={body}
                    onChange={(e) => {
                      setBody(e.target.value);
                      if (touched.body) setErrors((prev) => ({ ...prev, body: validateField("body") }));
                    }}
                    onBlur={() => markTouched("body")}
                    placeholder="e.g. This is to certify that [student_name] of class [class] has been awarded..."
                    minLength={10}
                    aria-invalid={!!errors.body}
                    className={errors.body ? "invalid" : ""}
                  />
                  <p className="helper">Write the certificate text. Use placeholders like [student_name], [class], [date] for dynamic content (min 10 chars).</p>
                  <p className="example"><strong>Example:</strong> This is to certify that [student_name] has successfully completed...</p>
                  {errors.body ? <p className="error-text">{errors.body}</p> : null}
                </div>

                <div className="section-head">📐 Page Dimensions</div>
                <div className="row-2">
                  <div className="field-wrap">
                    <label htmlFor="height">Height (mm) *</label>
                    <input
                      id="height"
                      type="number"
                      min={50}
                      max={500}
                      value={height}
                      onChange={(e) => setNumberValue(setHeight, e.target.value, "height")}
                      onBlur={() => markTouched("height")}
                      placeholder="144"
                      aria-invalid={!!errors.height}
                      className={errors.height ? "invalid" : ""}
                    />
                    <p className="helper">Page height in millimeters (50-500).</p>
                    <p className="example"><strong>Example:</strong> 144, 210, 297</p>
                    {errors.height ? <p className="error-text">{errors.height}</p> : null}
                  </div>
                  <div className="field-wrap">
                    <label htmlFor="width">Width (mm) *</label>
                    <input
                      id="width"
                      type="number"
                      min={50}
                      max={500}
                      value={width}
                      onChange={(e) => setNumberValue(setWidth, e.target.value, "width")}
                      onBlur={() => markTouched("width")}
                      placeholder="165"
                      aria-invalid={!!errors.width}
                      className={errors.width ? "invalid" : ""}
                    />
                    <p className="helper">Page width in millimeters (50-500).</p>
                    <p className="example"><strong>Example:</strong> 165, 297, 420</p>
                    {errors.width ? <p className="error-text">{errors.width}</p> : null}
                  </div>
                </div>

                <div className="section-head">📏 Padding (mm)</div>
                <div className="row-2">
                  <div className="field-wrap">
                    <label htmlFor="pt">Top *</label>
                    <input id="pt" type="number" min={0} max={100} value={pt} onChange={(e) => setNumberValue(setPt, e.target.value, "pt")} onBlur={() => markTouched("pt")} placeholder="5" className={errors.pt ? "invalid" : ""} />
                    <p className="helper">Top padding 0-100 mm.</p>
                    <p className="example"><strong>Example:</strong> 5, 10, 15</p>
                    {errors.pt ? <p className="error-text">{errors.pt}</p> : null}
                  </div>
                  <div className="field-wrap">
                    <label htmlFor="pr">Right *</label>
                    <input id="pr" type="number" min={0} max={100} value={pr} onChange={(e) => setNumberValue(setPr, e.target.value, "pr")} onBlur={() => markTouched("pr")} placeholder="5" className={errors.pr ? "invalid" : ""} />
                    <p className="helper">Right padding 0-100 mm.</p>
                    <p className="example"><strong>Example:</strong> 5, 10, 15</p>
                    {errors.pr ? <p className="error-text">{errors.pr}</p> : null}
                  </div>
                </div>

                <div className="row-2">
                  <div className="field-wrap">
                    <label htmlFor="pb">Bottom *</label>
                    <input id="pb" type="number" min={0} max={100} value={pb} onChange={(e) => setNumberValue(setPb, e.target.value, "pb")} onBlur={() => markTouched("pb")} placeholder="5" className={errors.pb ? "invalid" : ""} />
                    <p className="helper">Bottom padding 0-100 mm.</p>
                    <p className="example"><strong>Example:</strong> 5, 10, 15</p>
                    {errors.pb ? <p className="error-text">{errors.pb}</p> : null}
                  </div>
                  <div className="field-wrap">
                    <label htmlFor="pl">Left *</label>
                    <input id="pl" type="number" min={0} max={100} value={pl} onChange={(e) => setNumberValue(setPl, e.target.value, "pl")} onBlur={() => markTouched("pl")} placeholder="5" className={errors.pl ? "invalid" : ""} />
                    <p className="helper">Left padding 0-100 mm.</p>
                    <p className="example"><strong>Example:</strong> 5, 10, 15</p>
                    {errors.pl ? <p className="error-text">{errors.pl}</p> : null}
                  </div>
                </div>

                <div className="section-head">🖼️ Background Image</div>
                <div className="field-wrap">
                  <label htmlFor="backgroundUpload">Certificate Template Image</label>
                  <input
                    ref={fileInputRef}
                    id="backgroundUpload"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => {
                      setBackgroundUpload(e.target.files?.[0] || null);
                      setTouched((prev) => ({ ...prev, background: true }));
                      setErrors((prev) => ({ ...prev, background: validateField("background") }));
                    }}
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    className="upload-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0] || null;
                      setBackgroundUpload(file);
                      setTouched((prev) => ({ ...prev, background: true }));
                      setErrors((prev) => ({ ...prev, background: validateField("background") }));
                    }}
                  >
                    ☁️ Click to upload or drag and drop - PNG, JPG (max 2MB) - Recommended: A4 landscape
                  </button>
                  <p className="helper">Upload a background image for the certificate template.</p>
                  {errors.background ? <p className="error-text">{errors.background}</p> : null}
                  {backgroundUrl ? <a href={backgroundUrl} target="_blank" rel="noreferrer" className="existing-link">View current background image</a> : null}
                </div>

                <button type="submit" disabled={saving} className="save-btn">
                  {saving ? "Saving..." : "💾 Save Certificate"}
                </button>
              </form>
            </div>

            <div className="right-column">
              <div className="white-box preview-panel">
                <h3>🧾 Quick Preview</h3>
                <div className="preview-box" style={{ width: `${Math.max(240, Number(width) || 165)}px`, minHeight: `${Math.max(150, Number(height) || 144)}px`, padding: `${Number(pt) || 0}px ${Number(pr) || 0}px ${Number(pb) || 0}px ${Number(pl) || 0}px`, backgroundImage: previewBg ? `url(${previewBg})` : "none" }}>
                  <h4>{title || "Certificate Title"}</h4>
                  <p>{previewBody || "This is to certify that [student_name]..."}</p>
                </div>
              </div>

              <div className="white-box list-panel">
                <div className="list-head">
                  <h3>📋 Certificate List</h3>
                  <div className="search-box">
                    <span>🔍</span>
                    <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search certificates..." aria-label="Search certificates" />
                  </div>
                </div>
                <div className="list-meta">
                  <p className="summary">Showing {start}-{end} of {filtered.length} certificates · Sorted by role</p>
                  <label className="page-size-control">
                    <span>Rows per page</span>
                    <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>

                <table className="certificate-table">
                  <thead>
                    <tr>
                      <th>TITLE</th>
                      <th>TYPE</th>
                      <th>ROLE</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && pagedItems.length === 0 ? (
                      <tr><td colSpan={4} className="empty">No certificates found.</td></tr>
                    ) : (
                      pagedItems.map((row) => (
                        <tr key={row.id}>
                          <td>{row.title}</td>
                          <td><span className="type-badge">{row.type}</span></td>
                          <td><span className="role-badge">{row.applicable_role_id ? (roleNameById.get(row.applicable_role_id) || `Role ${row.applicable_role_id}`) : "All roles"}</span></td>
                          <td>
                            <div className="actions">
                              <button type="button" onClick={() => edit(row)} className="icon-btn edit" aria-label="Edit certificate">✏️</button>
                              <button type="button" disabled={busyId === row.id} onClick={() => void remove(row.id)} className="icon-btn delete" aria-label="Delete certificate">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <div className="pagination">
                  <button type="button" disabled={safePage <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Previous</button>
                  <span>Page {safePage} of {totalPages}</span>
                  <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>Next</button>
                </div>

                {loading && <p className="status muted">Loading certificates...</p>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .certificate-page {
          padding-bottom: calc(24px + env(safe-area-inset-bottom));
        }
        .breadcrumb-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .page-title {
          margin: 0;
          font-size: 26px;
        }
        .breadcrumb-path {
          display: flex;
          gap: 8px;
          color: #64748b;
          font-size: 14px;
        }
        .content-grid {
          display: grid;
          grid-template-columns: minmax(370px, 470px) 1fr;
          gap: 12px;
          align-items: start;
        }
        .white-box {
          background: #ffffff;
          border: 1px solid #dbe5ef;
          border-radius: 12px;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.05);
          padding: 14px;
        }
        .form-panel h3,
        .list-panel h3,
        .preview-panel h3 {
          margin: 0 0 10px;
          color: #1e293b;
          font-size: 20px;
        }
        .certificate-form {
          display: block;
        }
        .field-wrap {
          margin-bottom: 10px;
        }
        .field-wrap label {
          display: block;
          margin-bottom: 4px;
          font-size: 13px;
          font-weight: 600;
          color: #1f2937;
        }
        .field-wrap input,
        .field-wrap select,
        .field-wrap textarea {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
          color: #0f172a;
          box-sizing: border-box;
          background: #fff;
        }
        .field-wrap textarea {
          min-height: 80px;
          resize: vertical;
        }
        .field-wrap input:focus,
        .field-wrap select:focus,
        .field-wrap textarea:focus {
          outline: none;
          border-color: #0f766e;
          box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.15);
        }
        .field-wrap .invalid {
          border-color: #dc2626;
        }
        .helper {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 11.5px;
          line-height: 1.35;
        }
        .example {
          margin: 2px 0 0;
          color: #475569;
          font-size: 11.5px;
          line-height: 1.35;
        }
        .error-text {
          margin: 2px 0 0;
          color: #dc2626;
          font-size: 11.5px;
        }
        .row-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .section-head {
          margin: 12px 0 8px;
          padding-bottom: 5px;
          border-bottom: 1px solid #dbe5ef;
          color: #0f172a;
          font-size: 14px;
          font-weight: 700;
        }
        .upload-dropzone {
          width: 100%;
          border: 1.5px dashed #94a3b8;
          border-radius: 10px;
          background: #f8fafc;
          color: #334155;
          text-align: center;
          padding: 12px 10px;
          cursor: pointer;
          font-size: 12px;
          line-height: 1.4;
        }
        .upload-dropzone:hover {
          border-color: #0f766e;
          background: #f0fdfa;
        }
        .existing-link {
          color: #0f766e;
          text-decoration: none;
          font-size: 12px;
        }
        .save-btn {
          width: 100%;
          border: none;
          border-radius: 10px;
          padding: 10px 14px;
          background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          margin-top: 6px;
          box-shadow: 0 4px 12px rgba(20, 184, 166, 0.28);
        }
        .save-btn:hover {
          box-shadow: 0 8px 18px rgba(20, 184, 166, 0.36);
        }
        .save-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .right-column {
          display: grid;
          gap: 12px;
        }
        .preview-panel {
          overflow: auto;
        }
        .preview-box {
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          background: #fff;
          background-size: cover;
          background-position: center;
          box-sizing: border-box;
        }
        .preview-box h4 {
          margin: 0 0 6px;
          color: #1e293b;
        }
        .preview-box p {
          margin: 0;
          color: #334155;
          white-space: pre-wrap;
          font-size: 13px;
        }
        .list-panel {
          position: sticky;
          top: 70px;
          max-height: calc(100vh - 90px);
          overflow-y: auto;
        }
        .list-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 6px;
        }
        .search-box {
          display: flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 0 10px;
          background: #fff;
          height: 36px;
          min-width: 230px;
        }
        .search-box input {
          border: none;
          outline: none;
          width: 100%;
          font-size: 12.5px;
        }
        .summary {
          margin: 0 0 8px;
          color: #64748b;
          font-size: 12px;
        }
        .list-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .page-size-control {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #475569;
          font-size: 13px;
        }
        .page-size-control select {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 8px 10px;
          background: #fff;
          color: #0f172a;
        }
        .certificate-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0 8px;
        }
        .certificate-table th {
          text-align: left;
          font-size: 11px;
          color: #64748b;
          letter-spacing: 0.05em;
          padding: 0 10px 2px;
        }
        .certificate-table td {
          background: #ffffff;
          padding: 10px;
          font-size: 12px;
          color: #334155;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
        }
        .certificate-table td:first-child {
          border-left: 3px solid #14b8a6;
          border-top-left-radius: 8px;
          border-bottom-left-radius: 8px;
        }
        .certificate-table td:last-child {
          border-right: 1px solid #e2e8f0;
          border-top-right-radius: 8px;
          border-bottom-right-radius: 8px;
        }
        .type-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 999px;
          background: #dcfce7;
          color: #166534;
          font-weight: 600;
          font-size: 11px;
        }
        .role-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 999px;
          background: #e0e7ff;
          color: #3730a3;
          font-weight: 600;
          font-size: 11px;
        }
        .actions {
          display: flex;
          gap: 6px;
        }
        .icon-btn {
          width: 30px;
          height: 30px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }
        .icon-btn.edit {
          background: #e0f2fe;
        }
        .icon-btn.delete {
          background: #fee2e2;
        }
        .pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 6px;
          color: #475569;
          font-size: 12px;
        }
        .pagination button {
          border: none;
          background: #e2e8f0;
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 12px;
          cursor: pointer;
        }
        .pagination button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .empty {
          color: #64748b;
          text-align: center;
          border-radius: 8px;
        }
        .status {
          margin: 8px 0 0;
          font-size: 12px;
        }
        .status.muted { color: #64748b; }
        .status.error { color: #b91c1c; }
        .status.success { color: #047857; }
        .toast {
          position: fixed;
          right: 18px;
          bottom: calc(16px + env(safe-area-inset-bottom));
          z-index: 1200;
          background: #0f766e;
          color: #fff;
          padding: 9px 12px;
          border-radius: 8px;
          box-shadow: 0 10px 24px rgba(15, 118, 110, 0.28);
          font-size: 12px;
          font-weight: 700;
        }
        @media (max-width: 1200px) {
          .content-grid {
            grid-template-columns: 1fr;
          }
          .list-panel {
            position: static;
            max-height: none;
          }
        }
        @media (max-width: 700px) {
          .row-2 {
            grid-template-columns: 1fr;
          }
          .breadcrumb-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .search-box {
            min-width: 100%;
          }
          .list-head {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  );
}
