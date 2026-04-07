"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { sortAcademicsClasses } from "@/lib/classOrdering";

type AcademicYear = { id: number; name: string };
type SchoolClass = { id: number; name: string };
type Section = { id: number; school_class: number; name: string };

type UploadedContent = {
  id: number;
  academic_year_id?: number | null;
  class_id?: number | null;
  section_id?: number | null;
  content_title: string;
  content_type: "as" | "st" | "sy" | "ot";
  available_for_admin: boolean;
  available_for_all_classes: boolean;
  upload_date: string;
  description: string;
  source_url: string;
  upload_file: string;
};

type ContentType = "as" | "st" | "sy" | "ot";

type ApiList<T> = T[] | { results?: T[]; next?: string | null };

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const merged: T[] = [];
  let nextPath = path;

  for (let index = 0; index < 50 && nextPath; index += 1) {
    const response = await apiGet<ApiList<T>>(nextPath);
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
  const classOrder = new Map(sortAcademicsClasses(classes).map((row, index) => [row.id, index]));
  return [...items].sort((a, b) => {
    const orderA = classOrder.get(a.school_class) ?? Number.MAX_SAFE_INTEGER;
    const orderB = classOrder.get(b.school_class) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
  });
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
  return { height: 36, padding: "0 12px", border: `1px solid ${color}`, background: color, color: "#fff", borderRadius: 8, cursor: "pointer" } as const;
}

function LegacyBreadcrumb({ title }: { title: string }) {
  return (
    <section className="sms-breadcrumb mb-20">
      <div className="container-fluid">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>
          <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
            <span>Dashboard</span><span>/</span><span>Study Material</span><span>/</span><span>{title}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function useLookups() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    const load = async () => {
      const [yearData, classData, sectionData] = await Promise.all([
        fetchAllPages<AcademicYear>("/api/v1/core/academic-years/?page_size=100"),
        fetchAllPages<SchoolClass>("/api/v1/core/classes/?page_size=100"),
        fetchAllPages<Section>("/api/v1/core/sections/?page_size=100"),
      ]);
      const orderedClasses = sortAcademicsClasses(classData);
      setYears(yearData);
      setClasses(orderedClasses);
      setSections(sortSectionsByClassAndName(sectionData, orderedClasses));
    };
    void load();
  }, []);

  return { years, classes, sections };
}

const CONTENT_OPTIONS = [
  { value: "as", label: "Assignment" },
  { value: "st", label: "Study Material" },
  { value: "sy", label: "Syllabus" },
  { value: "ot", label: "Other Downloads" },
] as const;

function contentLabel(value: string) {
  return CONTENT_OPTIONS.find((item) => item.value === value)?.label || value;
}

const ALLOWED_UPLOAD_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip", "jpg", "jpeg", "png", "mp4", "mp3"]);

function fileExtension(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function fileNameFromPath(value: string) {
  const normalized = (value || "").replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments.length ? segments[segments.length - 1] : value;
}

function errorDetails(error: unknown): unknown {
  if (error && typeof error === "object" && "details" in error) {
    return (error as { details?: unknown }).details;
  }
  return undefined;
}

export function UploadContentPagePanel() {
  const { years, classes, sections } = useLookups();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [academicYearId, setAcademicYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [contentTitle, setContentTitle] = useState("");
  const [contentType, setContentType] = useState<ContentType>("as");
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [forAdmin, setForAdmin] = useState(false);
  const [forAllClasses, setForAllClasses] = useState(false);

  const filteredSections = useMemo(() => {
    if (!classId) return [];
    return sections.filter((section) => section.school_class === Number(classId));
  }, [classId, sections]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const missingMandatory = !contentTitle.trim() || !contentType || !uploadDate || (!forAllClasses && !classId);
    if (missingMandatory) {
      setError("Please fill in all mandatory fields.");
      return;
    }
    if (!uploadFile) {
      setError("Please select a file to upload.");
      return;
    }
    if (!ALLOWED_UPLOAD_EXTENSIONS.has(fileExtension(uploadFile.name))) {
      setError("Invalid file format.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const formData = new FormData();
      if (academicYearId) formData.append("academic_year_id", academicYearId);
      formData.append("class_id", forAllClasses ? "" : classId);
      if (sectionId && !forAllClasses) formData.append("section_id", sectionId);
      formData.append("content_title", contentTitle.trim());
      formData.append("content_type", contentType);
      formData.append("available_for_admin", forAdmin ? "true" : "false");
      formData.append("available_for_all_classes", forAllClasses ? "true" : "false");
      formData.append("upload_date", uploadDate);
      formData.append("description", description.trim());
      formData.append("source_url", sourceUrl.trim());
      formData.append("file_upload", uploadFile);

      await apiRequestWithRefresh("/api/v1/academics/upload-contents/", {
        method: "POST",
        body: formData,
      });
      setSuccess("Content uploaded successfully.");
      setContentTitle("");
      setDescription("");
      setSourceUrl("");
      setUploadFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const details = errorDetails(err);
      const detailsMessage = details && typeof details === "object" && "message" in (details as Record<string, unknown>)
        ? String((details as Record<string, unknown>).message || "")
        : "";
      const lowered = `${message} ${detailsMessage}`.toLowerCase();

      if (lowered.includes("invalid file format")) {
        setError("Invalid file format.");
      } else if (lowered.includes("please select a file to upload")) {
        setError("Please select a file to upload.");
      } else if (lowered.includes("please fill in all mandatory fields")) {
        setError("Please fill in all mandatory fields.");
      } else {
        setError("File upload failed. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="legacy-panel">
      <LegacyBreadcrumb title="Upload Content" />
      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <form onSubmit={submit} className="white-box" style={boxStyle()}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Academic Year</label>
                <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} style={fieldStyle()}>
                  <option value="">Select academic year</option>
                  {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Content Type *</label>
                <select value={contentType} onChange={(e) => setContentType(e.target.value as "as" | "st" | "sy" | "ot")} style={fieldStyle()}>
                  {CONTENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Content Title *</label>
                <input value={contentTitle} onChange={(e) => setContentTitle(e.target.value)} placeholder="Enter content title" style={fieldStyle()} />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Class {forAllClasses ? "" : "*"}</label>
                <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }} style={fieldStyle()} disabled={forAllClasses}>
                  <option value="">Select class</option>
                  {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Section</label>
                <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={fieldStyle()} disabled={forAllClasses || !classId}>
                  <option value="">Select section</option>
                  {filteredSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Upload Date *</label>
                <input type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} style={fieldStyle()} />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Source URL</label>
                <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Source URL" style={fieldStyle()} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Upload File *</label>
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.jpg,.jpeg,.png,.mp4,.mp3" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} style={{ ...fieldStyle(), paddingTop: 6 }} />
                <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>{uploadFile?.name || "No file selected"}</span>
              </div>
            </div>

            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" style={{ width: "100%", minHeight: 100, border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginTop: 10 }} />

            <div style={{ marginTop: 10, display: "flex", gap: 20 }}>
              <label><input type="checkbox" checked={forAdmin} onChange={(e) => setForAdmin(e.target.checked)} /> Available For Admin</label>
              <label><input type="checkbox" checked={forAllClasses} onChange={(e) => setForAllClasses(e.target.checked)} /> Available For All Classes</label>
            </div>

            {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
            {success && <p style={{ color: "#059669", marginTop: 8 }}>{success}</p>}

            <div style={{ marginTop: 12 }}>
              <button type="submit" disabled={saving} style={buttonStyle()}>{saving ? "Saving..." : "Save Content"}</button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function ContentListPagePanel({ title, type, lockType }: { title: string; type: ContentType; lockType: boolean }) {
  const { classes, sections } = useLookups();
  const [items, setItems] = useState<UploadedContent[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<UploadedContent | null>(null);
  const [editingUploadFile, setEditingUploadFile] = useState<File | null>(null);
  const [removeExistingUploadFile, setRemoveExistingUploadFile] = useState(false);
  const [showEditFilePicker, setShowEditFilePicker] = useState(false);
  const [editFileInputKey, setEditFileInputKey] = useState(0);
  const [viewing, setViewing] = useState<UploadedContent | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [contentType, setContentType] = useState<"" | ContentType>(type);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const messageMap: Record<ContentType, {
    noCriteria: string;
    noRecords: string;
    viewFail: string;
    editFail: string;
    downloadFail: string;
    deleteFail: string;
    deleteConfirm: string;
    serverFail: string;
  }> = {
    as: {
      noCriteria: "Please select search criteria.",
      noRecords: "No assignment records found.",
      viewFail: "Unable to load assignment details.",
      editFail: "Unable to edit assignment. Please try again.",
      downloadFail: "Unable to download file.",
      deleteFail: "Unable to delete record.",
      deleteConfirm: "Are you sure you want to delete this record?",
      serverFail: "Something went wrong. Please try again later.",
    },
    st: {
      noCriteria: "Please select search criteria.",
      noRecords: "No study material records found.",
      viewFail: "Unable to load study material details.",
      editFail: "Unable to edit study material.",
      downloadFail: "Unable to download file.",
      deleteFail: "Unable to delete record.",
      deleteConfirm: "Are you sure you want to delete this record?",
      serverFail: "Something went wrong. Please try again later.",
    },
    sy: {
      noCriteria: "Please select search criteria.",
      noRecords: "No syllabus records found.",
      viewFail: "Unable to load syllabus details.",
      editFail: "Unable to edit syllabus.",
      downloadFail: "Unable to download syllabus file.",
      deleteFail: "Unable to delete syllabus record.",
      deleteConfirm: "Are you sure you want to delete this syllabus?",
      serverFail: "Something went wrong. Please try again later.",
    },
    ot: {
      noCriteria: "Please select search criteria before searching.",
      noRecords: "No download records found.",
      viewFail: "Unable to load download details.",
      editFail: "Unable to edit record.",
      downloadFail: "Unable to download file.",
      deleteFail: "Unable to delete record.",
      deleteConfirm: "Are you sure you want to delete this file?",
      serverFail: "Something went wrong. Please try again later.",
    },
  };

  const messages = messageMap[type];

  const filteredSections = useMemo(() => {
    if (!classId) return sections;
    return sections.filter((section) => section.school_class === Number(classId));
  }, [classId, sections]);

  const resolveUrl = (value: string) => {
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    const normalized = value.startsWith("/") ? value.slice(1) : value;
    return `${API_BASE_URL}/media/${normalized}`;
  };

  const loadItems = async () => {
    const requireCriteria = type === "as" || type === "ot";
    if (requireCriteria && !classId && !sectionId) {
      setError(messages.noCriteria);
      setItems([]);
      setHasSearched(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (classId) params.set("class_id", classId);
      if (sectionId) params.set("section_id", sectionId);
      if (lockType) {
        params.set("content_type", type);
      } else if (contentType) {
        params.set("content_type", contentType);
      }
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const data = await apiGet<ApiList<UploadedContent>>(`/api/v1/academics/upload-contents/${suffix}`);
      setItems(listData(data));
      setHasSearched(true);
    } catch {
      setItems([]);
      setHasSearched(true);
      setError(messages.serverFail);
    } finally {
      setLoading(false);
    }
  };

  const viewItem = async (id: number) => {
    try {
      setError("");
      const row = await apiGet<UploadedContent>(`/api/v1/academics/upload-contents/${id}/`);
      const fileUrl = resolveUrl(row.upload_file || row.source_url);
      if (fileUrl) {
        window.open(fileUrl, "_blank", "noopener,noreferrer");
        return;
      }
      setViewing(row);
    } catch {
      setError(messages.viewFail);
    }
  };

  const editItem = async (id: number) => {
    try {
      setError("");
      const row = await apiGet<UploadedContent>(`/api/v1/academics/upload-contents/${id}/`);
      setEditing(row);
      setEditingUploadFile(null);
      setRemoveExistingUploadFile(false);
      setShowEditFilePicker(false);
      setEditFileInputKey((prev) => prev + 1);
    } catch {
      setError(messages.editFail);
    }
  };

  const clearEditFilePicker = () => {
    if (editFileInputRef.current) {
      editFileInputRef.current.value = "";
    }
    setEditFileInputKey((prev) => prev + 1);
  };

  const onEditFileSelected = (nextFile: File | null) => {
    if (!nextFile) {
      setEditingUploadFile(null);
      return;
    }
    if (!ALLOWED_UPLOAD_EXTENSIONS.has(fileExtension(nextFile.name))) {
      setError("Invalid file format.");
      clearEditFilePicker();
      setEditingUploadFile(null);
      return;
    }
    setError("");
    setEditingUploadFile(nextFile);
    setRemoveExistingUploadFile(false);
    setShowEditFilePicker(false);
  };

  const startReplaceFileInEdit = () => {
    if (!editing) return;
    setError("");
    setRemoveExistingUploadFile(false);
    setShowEditFilePicker(true);
    clearEditFilePicker();
  };

  const removeExistingFileInEdit = () => {
    if (!editing) return;
    setEditingUploadFile(null);
    setRemoveExistingUploadFile(true);
    setShowEditFilePicker(false);
    setEditing({ ...editing, upload_file: "" });
    clearEditFilePicker();
  };

  const downloadItem = (item: UploadedContent) => {
    try {
      const fileUrl = resolveUrl(item.upload_file || item.source_url);
      if (!fileUrl) throw new Error("download-missing");
      const anchor = document.createElement("a");
      anchor.href = fileUrl;
      anchor.download = fileNameFromPath(item.upload_file || item.source_url || item.content_title || "download");
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      setError(messages.downloadFail);
    }
  };

  const removeItem = async (item: UploadedContent) => {
    const label = (item.content_title || item.upload_file || item.source_url || `#${item.id}`).trim();
    const confirmed = window.confirm(`${messages.deleteConfirm} (${label})`);
    if (!confirmed) return;
    try {
      setError("");
      await apiDelete(`/api/v1/academics/upload-contents/${item.id}/`);
      if (hasSearched) {
        await loadItems();
      }
    } catch {
      setError(messages.deleteFail);
    }
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const hasAnyFileAfterEdit = Boolean(editingUploadFile) || (Boolean(editing.upload_file) && !removeExistingUploadFile);
    if (!hasAnyFileAfterEdit) {
      setError("Please select a file to upload.");
      return;
    }
    try {
      setSavingEdit(true);
      setError("");
      const formData = new FormData();
      formData.append("content_title", editing.content_title || "");
      formData.append("content_type", editing.content_type || type);
      formData.append("upload_date", editing.upload_date || "");
      formData.append("description", editing.description || "");
      formData.append("source_url", editing.source_url || "");
      formData.append("available_for_admin", editing.available_for_admin ? "true" : "false");
      formData.append("available_for_all_classes", editing.available_for_all_classes ? "true" : "false");

      if (editing.academic_year_id) {
        formData.append("academic_year_id", String(editing.academic_year_id));
      }
      if (editing.available_for_all_classes) {
        formData.append("class_id", "");
        formData.append("section_id", "");
      } else {
        formData.append("class_id", editing.class_id ? String(editing.class_id) : "");
        formData.append("section_id", editing.section_id ? String(editing.section_id) : "");
      }

      if (editingUploadFile) {
        formData.append("file_upload", editingUploadFile);
      }
      if (removeExistingUploadFile && !editingUploadFile) {
        formData.append("remove_upload_file", "true");
      }

      await apiRequestWithRefresh(`/api/v1/academics/upload-contents/${editing.id}/`, {
        method: "PATCH",
        body: formData,
      });
      setEditing(null);
      setEditingUploadFile(null);
      setRemoveExistingUploadFile(false);
      setShowEditFilePicker(false);
      clearEditFilePicker();
      await loadItems();
    } catch {
      setError(messages.editFail);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="legacy-panel">
      <LegacyBreadcrumb title={title} />
      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Search Criteria</h3>
            <div style={{ display: "grid", gridTemplateColumns: lockType ? "repeat(2, minmax(0, 1fr)) auto" : "repeat(4, minmax(0, 1fr)) auto", gap: 8, alignItems: "end" }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Class</label>
                <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }} style={fieldStyle()}>
                  <option value="">All Classes</option>
                  {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Section</label>
                <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={fieldStyle()}>
                  <option value="">All Sections</option>
                  {filteredSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                </select>
              </div>
              {!lockType && (
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Content Type</label>
                  <select value={contentType} onChange={(e) => setContentType(e.target.value as "" | ContentType)} style={fieldStyle()}>
                    <option value="">All Types</option>
                    {CONTENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600, opacity: 0 }}>Action</label>
                <button type="button" onClick={() => void loadItems()} style={buttonStyle()}>Search</button>
              </div>
            </div>
            {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          </div>

          <div className="white-box" style={boxStyle()}>
            {!hasSearched ? <div style={{ padding: 10, color: "var(--text-muted)" }}>Use search criteria and click Search to load records.</div> : null}
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Class</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Section</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Title</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Type</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Upload Date</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Source</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>File</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={8} style={{ padding: 10 }}>Loading...</td></tr> : null}
                {!loading && hasSearched && items.length === 0 ? <tr><td colSpan={8} style={{ padding: 10, color: "var(--text-muted)" }}>{messages.noRecords}</td></tr> : null}
                {!loading && items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{classes.find((row) => row.id === item.class_id)?.name || "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{sections.find((row) => row.id === item.section_id)?.name || "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.content_title}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{contentLabel(item.content_type)}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.upload_date}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.source_url || "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.upload_file || "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => void viewItem(item.id)} style={buttonStyle("#2563eb")}>View</button>
                        <button type="button" onClick={() => void editItem(item.id)} style={buttonStyle("#0ea5e9")}>Edit</button>
                        <button type="button" onClick={() => downloadItem(item)} style={buttonStyle("#475569")}>Download</button>
                        <button type="button" onClick={() => void removeItem(item)} style={buttonStyle("#dc2626")}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {viewing && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", zIndex: 50 }}>
              <div className="white-box" style={{ ...boxStyle(), width: "min(720px, 92vw)" }}>
                <h3 style={{ marginTop: 0 }}>Content Details</h3>
                <p><strong>Title:</strong> {viewing.content_title}</p>
                <p><strong>Type:</strong> {contentLabel(viewing.content_type)}</p>
                <p><strong>Upload Date:</strong> {viewing.upload_date}</p>
                <p><strong>Description:</strong> {viewing.description || "-"}</p>
                <p><strong>Source:</strong> {viewing.source_url || "-"}</p>
                <p>
                  <strong>File:</strong>{" "}
                  {viewing.upload_file ? (
                    <a href={resolveUrl(viewing.upload_file)} target="_blank" rel="noopener noreferrer">
                      {fileNameFromPath(viewing.upload_file)}
                    </a>
                  ) : "-"}
                </p>
                <button type="button" onClick={() => setViewing(null)} style={buttonStyle("#6b7280")}>Close</button>
              </div>
            </div>
          )}

          {editing && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", zIndex: 50 }}>
              <form onSubmit={saveEdit} className="white-box" style={{ ...boxStyle(), width: "min(860px, 94vw)" }}>
                <h3 style={{ marginTop: 0 }}>Edit Content</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Content Title</label>
                    <input value={editing.content_title} onChange={(e) => setEditing({ ...editing, content_title: e.target.value })} style={fieldStyle()} />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Content Type</label>
                    <select value={editing.content_type} onChange={(e) => setEditing({ ...editing, content_type: e.target.value as "as" | "st" | "sy" | "ot" })} style={fieldStyle()}>
                      {CONTENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Upload Date</label>
                    <input type="date" value={editing.upload_date} onChange={(e) => setEditing({ ...editing, upload_date: e.target.value })} style={fieldStyle()} />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Source URL</label>
                    <input value={editing.source_url || ""} onChange={(e) => setEditing({ ...editing, source_url: e.target.value })} style={fieldStyle()} placeholder="Source URL" />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Upload File *</label>
                    {(editing.upload_file && !removeExistingUploadFile && !editingUploadFile && !showEditFilePicker) ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" }}>
                        <a href={resolveUrl(editing.upload_file)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, textDecoration: "underline" }}>
                          {fileNameFromPath(editing.upload_file)}
                        </a>
                        <button type="button" onClick={startReplaceFileInEdit} style={{ ...buttonStyle("#2563eb"), height: 28, padding: "0 8px", marginLeft: "auto" }} title="Replace file">
                          Replace
                        </button>
                        <button type="button" onClick={removeExistingFileInEdit} style={{ ...buttonStyle("#dc2626"), height: 28, padding: "0 8px" }} title="Remove file">
                          ❌
                        </button>
                      </div>
                    ) : (
                      <input
                        key={editFileInputKey}
                        ref={editFileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.jpg,.jpeg,.png,.mp4,.mp3"
                        onChange={(e) => onEditFileSelected(e.target.files?.[0] || null)}
                        style={{ ...fieldStyle(), paddingTop: 6 }}
                      />
                    )}
                    {(editingUploadFile || removeExistingUploadFile) && (
                      <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
                        {editingUploadFile ? `Selected: ${editingUploadFile.name}` : "Existing file marked for deletion"}
                      </span>
                    )}
                  </div>
                </div>
                <textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} style={{ width: "100%", minHeight: 90, border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginTop: 10 }} />
                <div style={{ marginTop: 10, display: "flex", gap: 20 }}>
                  <label><input type="checkbox" checked={editing.available_for_admin} onChange={(e) => setEditing({ ...editing, available_for_admin: e.target.checked })} /> Available For Admin</label>
                  <label><input type="checkbox" checked={editing.available_for_all_classes} onChange={(e) => setEditing({ ...editing, available_for_all_classes: e.target.checked })} /> Available For All Classes</label>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button type="submit" disabled={savingEdit} style={buttonStyle()}>{savingEdit ? "Saving..." : "Update"}</button>
                  <button type="button" onClick={() => setEditing(null)} style={{ ...buttonStyle("#6b7280"), marginLeft: 6 }}>Cancel</button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function AssignmentListPagePanel() {
  return <ContentListPagePanel title="Assignment List" type="as" lockType={true} />;
}

export function StudyMaterialListPagePanel() {
  return <ContentListPagePanel title="Study Material List" type="st" lockType={true} />;
}

export function SyllabusListPagePanel() {
  return <ContentListPagePanel title="Syllabus List" type="sy" lockType={true} />;
}

export function OtherDownloadsListPagePanel() {
  return <ContentListPagePanel title="Other Downloads List" type="ot" lockType={true} />;
}
