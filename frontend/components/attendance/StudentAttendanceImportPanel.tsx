"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { Spinner } from "@/components/common/Spinner";
import { TopToast } from "@/components/common/TopToast";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { getAccessToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";

type SchoolClass = { id: number; class_name?: string; name?: string };
type Section = { id: number; school_class: number; name: string };
type ImportError = { row?: number; field?: string; message: string };
type ImportResponse = {
  success?: boolean;
  detail?: string;
  message?: string;
  data?: { imported: number; failed: number; errors: ImportError[] };
  imported_count?: number;
  failed_count?: number;
  error_details?: ImportError[];
};

function extractImportFailure(response: ImportResponse | null | undefined) {
  if (!response) return null;

  const imported = Number(response.data?.imported ?? response.imported_count ?? 0);
  const failed = Number(response.data?.failed ?? response.failed_count ?? 0);
  const errors = response.data?.errors || response.error_details || [];

  if (response.success !== false && failed <= 0) {
    return null;
  }

  const message =
    response.message ||
    response.detail ||
    (imported <= 0
      ? `Failed to import any records. ${failed} errors found.`
      : `${imported} records imported, ${failed} failed.`);

  return {
    imported,
    failed,
    errors,
    message,
  };
}

function buildRequestFailedMessage(message: string, errors: ImportError[] = []) {
  const trimmed = (message || "").trim();
  const countMatch = trimmed.match(/(\d+)\s+errors?\s+found/i);
  const errorCount = countMatch ? Number(countMatch[1]) : errors.length;

  const shortBase = trimmed
    .replace(/^request failed:\s*/i, "")
    .replace(/^failed to import any records\.\s*/i, "")
    .replace(/\s*errors?\s+found\.?/i, "")
    .trim();

  const base = shortBase
    ? `Request failed: ${shortBase}`
    : "Request failed: Could not import attendance.";

  const firstError = errors[0];
  if (!firstError?.message) return base;

  const normalizeErrorDetail = (value: string) => {
    const text = (value || "").trim();
    if (!text) return "Unknown error.";

    if (/invalid attendance type/i.test(text) && /use one of/i.test(text)) {
      return "Invalid attendance type. Use P, A, L, F, or H.";
    }

    if (/does not belong to the selected class\/section/i.test(text)) {
      const admissionMatch = text.match(/'([^']+)'/);
      const admissionNo = admissionMatch?.[1] || "this admission number";
      return `${admissionNo} is not in the selected class/section.`;
    }

    return text;
  };

  const shorten = (value: string, maxLen = 100) => {
    if (value.length <= maxLen) return value;
    return `${value.slice(0, maxLen - 1)}...`;
  };

  const rowPart = firstError.row ? `Row ${firstError.row}` : "Row N/A";
  const fieldPart = firstError.field ? ` ${firstError.field}` : "";
  const detail = shorten(normalizeErrorDetail(firstError.message));
  const countPart = errorCount > 1 ? ` (${errorCount} rows)` : "";
  return `${base}${countPart}. ${rowPart}${fieldPart}: ${detail}`;
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

function listData<T>(value: T[] | { results?: T[] } | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value?.results || [];
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(value: string) {
  if (!value) return "-";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileValidationError(file: File | null) {
  if (!file) return "Please upload a file";
  const isValidType = ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(file.type)
    || /\.(csv|xlsx)$/i.test(file.name);
  if (!isValidType) return "Upload a valid CSV or Excel file (.csv, .xlsx)";
  const maxSizeBytes = 5 * 1024 * 1024;
  if (file.size > maxSizeBytes) return "File size exceeds 5MB limit";
  return "";
}

function getReadableClassName(schoolClass: SchoolClass) {
  return schoolClass.class_name || schoolClass.name || `Class ${schoolClass.id}`;
}

function fieldStyle(hasError = false) {
  return {
    width: "100%",
    height: 36,
    border: `1px solid ${hasError ? "#dc2626" : "var(--line)"}`,
    borderRadius: 8,
    padding: "0 10px",
    backgroundColor: hasError ? "#fef2f2" : "transparent",
  } as const;
}

function buttonStyle(color = "var(--primary)", disabled = false) {
  return {
    height: 36,
    padding: "0 14px",
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  } as const;
}

function boxStyle() {
  return { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 } as const;
}

function secondaryButtonStyle(disabled = false) {
  return {
    height: 36,
    padding: "0 14px",
    border: "1px solid var(--line)",
    background: "transparent",
    color: "var(--primary)",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    gap: 6,
    opacity: disabled ? 0.6 : 1,
  } as const;
}

export default function StudentAttendanceImportPanel() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(todayIsoDate());
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [queuedSubmit, setQueuedSubmit] = useState<{ classId: string; sectionId: string; attendanceDate: string; file: File } | null>(null);
  const [fileDragFocus, setFileDragFocus] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Response tracking
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number } | null>(null);
  const [detailedErrors, setDetailedErrors] = useState<ImportError[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = useMemo(() => todayIsoDate(), []);

  // HELPER: Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!classId) {
      newErrors.classId = "Please select a class";
    }
    if (!sectionId) {
      newErrors.sectionId = "Please select a section";
    }
    if (!attendanceDate) {
      newErrors.attendanceDate = "Please select an attendance date";
    } else {
      if (attendanceDate > today) {
        newErrors.attendanceDate = "Cannot import attendance for future dates";
      }
    }
    const fileError = getFileValidationError(file);
    if (fileError) {
      newErrors.file = fileError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const loadSectionsForClass = async (targetClassId: string) => {
    if (!targetClassId) {
      setSections([]);
      setSectionId("");
      return;
    }

    try {
      setSectionLoading(true);
      setSections([]);
      setSectionId("");
      try {
        const data = await apiGet<Section[] | { results?: Section[] }>(`/api/v1/core/sections/?class=${encodeURIComponent(targetClassId)}&page_size=200`);
        setSections(listData(data));
      } catch {
        const fallback = await apiGet<Section[] | { results?: Section[] }>(`/api/v1/core/sections/?school_class=${encodeURIComponent(targetClassId)}&page_size=200`);
        setSections(listData(fallback));
      }
      setApiError("");
    } catch {
      setApiError("Failed to load sections for selected class.");
      setSections([]);
    } finally {
      setSectionLoading(false);
    }
  };

  // Load data
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const classData = await apiGet<{ classes: SchoolClass[] }>("/api/v1/attendance/student-attendance/import/");
        setClasses(classData.classes || []);
        setSections([]);
        setApiError("");
      } catch {
        setApiError("Failed to load form data. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filteredSections = useMemo(() => {
    const id = Number(classId);
    if (!id) return [];
    return sections.filter((s) => s.school_class === id);
  }, [classId, sections]);

  const selectedClass = useMemo(() => classes.find((item) => String(item.id) === classId), [classes, classId]);
  const selectedSection = useMemo(() => filteredSections.find((item) => String(item.id) === sectionId), [filteredSections, sectionId]);
  const selectedFileError = useMemo(() => getFileValidationError(file), [file]);
  const canSubmit = Boolean(classId && sectionId && attendanceDate && file && !selectedFileError && !saving && !loading && !sectionLoading);

  useEffect(() => {
    if (apiError) {
      setToast({ message: apiError, tone: "error" });
    }
  }, [apiError]);

  useEffect(() => {
    if (successMessage) {
      setToast({ message: successMessage, tone: "success" });
    }
  }, [successMessage]);

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles?.[0]) {
      const droppedFile = droppedFiles[0];
      const fileError = getFileValidationError(droppedFile);

      if (!fileError) {
        setFile(droppedFile);
        setErrors((prev) => ({ ...prev, file: "" }));
      } else {
        setFile(null);
        setErrors((prev) => ({ ...prev, file: fileError }));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const fileError = getFileValidationError(selectedFile);
      setFile(fileError ? null : selectedFile);
      setErrors((prev) => ({ ...prev, file: fileError }));
    }
  };

  const clearSelectedFile = () => {
    setFile(null);
    setErrors((prev) => ({ ...prev, file: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Download sample file with authentication
  const downloadSampleFile = async () => {
    try {
      const token = getAccessToken();

      if (!token) {
        setApiError("Authentication required. Please login again.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/attendance/student-attendance/download-sample/`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        let errorMessage = `Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
        }
        throw new Error(errorMessage);
      }

      // Create blob from response and download
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "student_attendance_sheet.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      // Clear any previous errors on success
      setApiError("");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to download sample file";
      setApiError(errorMsg || "Could not download sample file. Please try again.");
    }
  };

  // Download error report
  const downloadErrorReport = () => {
    if (detailedErrors.length === 0) return;

    const header = "Row,Field,Error\n";
    const rows = detailedErrors
      .map((err) => `${err.row || "N/A"},"${err.field || "N/A"}","${(err.message || "").replace(/"/g, '""')}"`)
      .join("\n");
    const csv = header + rows;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_import_errors_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Main submit handler
  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      setApiError("Please fix the errors above before importing.");
      return;
    }

    if (!file) {
      setApiError("Please upload a file before importing.");
      return;
    }

    try {
      setApiError("");
      setSuccessMessage("");
      setImportResult(null);
      setDetailedErrors([]);

      setQueuedSubmit({ classId, sectionId, attendanceDate, file });
      setConfirmOpen(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Operation failed";

      if (errorMsg === "401") {
        setApiError("Session expired. Please log in again.");
      } else if (errorMsg.includes("network") || errorMsg.includes("fetch")) {
        setApiError("Network error. Check your internet connection.");
      } else {
        setApiError(errorMsg || "Something went wrong. Please try again.");
      }

      setImportResult(null);
      setDetailedErrors([]);
    }
  };

  const confirmImport = async () => {
    if (!queuedSubmit) return;

    try {
      setSaving(true);
      setConfirmOpen(false);
      setApiError("");
      setSuccessMessage("");
      setImportResult(null);
      setDetailedErrors([]);
      setUploadProgress(20);

      const formData = new FormData();
      formData.append("class", queuedSubmit.classId);
      formData.append("section", queuedSubmit.sectionId);
      formData.append("attendance_date", queuedSubmit.attendanceDate);
      formData.append("file", queuedSubmit.file);

      setUploadProgress(55);

      const response = await apiRequestWithRefresh<ImportResponse>("/api/v1/attendance/student-attendance/bulk-store/", {
        method: "POST",
        headers: {},
        body: formData,
      });

      setUploadProgress(85);

      const failure = extractImportFailure(response);
      if (failure) {
        setImportResult({
          imported: failure.imported,
          failed: failure.failed,
        });
        setDetailedErrors(failure.errors);
        const failedMessage = buildRequestFailedMessage(failure.message, failure.errors);

        if (failure.imported <= 0) {
          setSuccessMessage("");
          setApiError(failedMessage);
        } else {
          setApiError("");
          setSuccessMessage(`✓ ${failure.imported} records imported, ${failure.failed} failed`);
        }
      } else {
        // Full success
        setApiError("");
        setSuccessMessage("✓ Attendance imported successfully");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setImportResult(null);
        setDetailedErrors([]);
      }
      setUploadProgress(100);
      window.setTimeout(() => setUploadProgress(0), 500);
      setQueuedSubmit(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Operation failed";
      const errorDetails = (err as { details?: unknown } | null)?.details;

      const failure =
        errorDetails && typeof errorDetails === "object"
          ? extractImportFailure(errorDetails as ImportResponse)
          : null;

      if (errorMsg === "401") {
        setApiError("Request failed: Session expired. Please log in again.");
        setImportResult(null);
        setDetailedErrors([]);
      } else if (errorMsg.includes("network") || errorMsg.includes("fetch")) {
        setApiError("Request failed: Network error. Check your internet connection.");
        setImportResult(null);
        setDetailedErrors([]);
      } else if (failure) {
        setImportResult({ imported: failure.imported, failed: failure.failed });
        setDetailedErrors(failure.errors);
        setApiError(buildRequestFailedMessage(failure.message || errorMsg || "Something went wrong. Please try again.", failure.errors));
      } else {
        setApiError(buildRequestFailedMessage(errorMsg || "Something went wrong. Please try again."));
        setImportResult(null);
        setDetailedErrors([]);
      }
      setUploadProgress(0);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="legacy-panel">
      {toast ? (
        <TopToast
          message={toast.message}
          tone={toast.tone}
          autoCloseMs={toast.tone === "error" ? 9000 : 3500}
          onClose={() => setToast(null)}
        />
      ) : null}
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Student Attendance</h1>
            <div style={{ display: "flex", gap: 8, color: "#475569", fontSize: 13, fontWeight: 500 }}>
              <span>Dashboard</span>
              <span>/</span>
              <span>Student Attendance</span>
              <span>/</span>
              <span>Student Attendance Import</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <h3 style={{ margin: 0 }}>Import Attendance</h3>
          </div>

          {/* Main Form Box */}
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 16 }}>
            <form onSubmit={submit}>
              {/* Class & Section Fields */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
                <div>
                  <label htmlFor="attendance-class" style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                    Select Class <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    id="attendance-class"
                    value={classId}
                    onChange={(e) => {
                      const nextClassId = e.target.value;
                      setClassId(nextClassId);
                      setSectionId("");
                      setErrors((prev) => ({ ...prev, classId: "" }));
                      void loadSectionsForClass(nextClassId);
                    }}
                    disabled={loading}
                    aria-label="Select class"
                    style={fieldStyle(!!errors.classId)}
                  >
                    <option value="">Select Class</option>
                    {classes.map((schoolClass) => (
                      <option key={schoolClass.id} value={schoolClass.id}>
                        {getReadableClassName(schoolClass)}
                      </option>
                    ))}
                  </select>
                  {errors.classId && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>📌 {errors.classId}</p>}
                </div>

                <div>
                  <label htmlFor="attendance-section" style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                    Select Section <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    id="attendance-section"
                    value={sectionId}
                    onChange={(e) => {
                      setSectionId(e.target.value);
                      setErrors((prev) => ({ ...prev, sectionId: "" }));
                    }}
                    disabled={!classId || loading || sectionLoading}
                    aria-label="Select section"
                    style={fieldStyle(!!errors.sectionId)}
                  >
                    <option value="">{sectionLoading ? "Loading sections..." : classId ? "Select Section" : "Select class first"}</option>
                    {filteredSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                  {errors.sectionId && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>📌 {errors.sectionId}</p>}
                </div>
              </div>

              {/* Date Field */}
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="attendance-date" style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                  Attendance Date <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  id="attendance-date"
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => {
                    setAttendanceDate(e.target.value);
                    setErrors((prev) => ({ ...prev, attendanceDate: "" }));
                  }}
                  disabled={loading}
                  max={today}
                  aria-label="Attendance date"
                  style={fieldStyle(!!errors.attendanceDate)}
                />
                <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 12 }}>Format: DD-MM-YYYY</p>
                {errors.attendanceDate && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>📌 {errors.attendanceDate}</p>}
              </div>

              {/* Drag & Drop File Upload */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
                  Upload File <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <button type="button" style={secondaryButtonStyle()} onClick={downloadSampleFile} aria-label="Download sample file">
                    ⬇ Download Sample File
                  </button>
                </div>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  onFocus={() => setFileDragFocus(true)}
                  onBlur={() => setFileDragFocus(false)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload attendance file. Press Enter or Space to open file picker."
                  style={{
                    border: dragActive || fileDragFocus ? "2px dashed var(--primary)" : `2px dashed var(--line)`,
                    borderRadius: 12,
                    padding: 24,
                    textAlign: "center",
                    cursor: "pointer",
                    backgroundColor: dragActive || fileDragFocus ? "rgba(59, 130, 246, 0.06)" : "rgba(0,0,0,0.01)",
                    transition: "all 0.2s ease",
                    outline: "none",
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                  <p style={{ margin: "0 0 4px 0", fontSize: 14, fontWeight: 600 }}>
                    {file ? file.name : "Drag & drop your file here"}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                    {file ? `${formatFileSize(file.size)} • CSV or Excel file` : "or click to select (.csv, .xlsx, max 5MB)"}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                  disabled={loading || saving}
                  aria-label="Attendance file input"
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {file ? (
                      <button type="button" style={secondaryButtonStyle()} onClick={clearSelectedFile} aria-label="Remove selected file">
                        Remove File
                      </button>
                    ) : null}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Allowed: CSV or XLSX only. Max size: 5MB.</p>
                </div>
                {errors.file && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>📌 {errors.file}</p>}
              </div>

              {/* Submit Button */}
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 28 }}>
                <button
                  type="submit"
                  disabled={saving || !canSubmit || loading}
                  style={buttonStyle("var(--primary)", saving || !canSubmit || loading)}
                  aria-label="Import attendance"
                >
                  {saving ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Spinner size={14} />
                      Importing...
                    </span>
                  ) : (
                    "📤 Import Attendance"
                  )}
                </button>
              </div>

              <div aria-live="polite" style={{ minHeight: 18, marginTop: 12 }}>
                {saving ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ height: 6, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${uploadProgress}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, var(--primary), #38bdf8)",
                          transition: "width 0.2s ease",
                        }}
                      />
                    </div>
                    <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12 }}>Preparing import...</p>
                  </div>
                ) : null}
              </div>
            </form>

            {/* Error Messages */}
            {apiError && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  color: "#dc2626",
                  fontSize: 13,
                }}
              >
                ⚠️ {apiError}
              </div>
            )}

            {/* Success Messages */}
            {successMessage && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 8,
                  color: "#16a34a",
                  fontSize: 13,
                }}
              >
                {successMessage}
              </div>
            )}
          </div>

          {/* Detailed Errors Section */}
          {detailedErrors.length > 0 && (
            <div className="white-box" style={boxStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ margin: 0 }}>Import Errors ({detailedErrors.length} issues)</h4>
                <button type="button" style={secondaryButtonStyle()} onClick={downloadErrorReport}>
                  ⬇ Download Error Report
                </button>
              </div>

              <div style={{ overflowX: "auto", marginTop: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f3f4f6" }}>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: "1px solid var(--line)" }}>Row</th>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: "1px solid var(--line)" }}>Field</th>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: "1px solid var(--line)" }}>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedErrors.slice(0, 10).map((err, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{err.row || "N/A"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{err.field || "N/A"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)", color: "#dc2626" }}>{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detailedErrors.length > 10 && (
                  <p style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 12 }}>
                    ... and {detailedErrors.length - 10} more errors (see error report)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Import Summary */}
          {importResult && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                backgroundColor: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <p style={{ margin: 0, fontWeight: 500 }}>
                📊 Import Summary: <strong>{importResult.imported} successful</strong>, <strong style={{ color: "#dc2626" }}>{importResult.failed} failed</strong>
              </p>
              <p style={{ margin: "4px 0 0 0", color: "var(--text-muted)", fontSize: 12 }}>
                Review the errors below and fix them in your file for another attempt.
              </p>
            </div>
          )}
        </div>
      </section>

      <ConfirmationModal
        isOpen={confirmOpen}
        title="Confirm Attendance Import"
        message={`Are you sure you want to import attendance for ${selectedClass ? getReadableClassName(selectedClass) : classId} - ${selectedSection?.name || sectionId} on ${formatDisplayDate(attendanceDate)}?`}
        confirmLabel="Confirm Import"
        cancelLabel="Cancel"
        details={(
          <div style={{ display: "grid", gap: 8, background: "#f8fafc", border: "1px solid var(--line)", borderRadius: 12, padding: 12, fontSize: 13 }}>
            <div><strong>Class:</strong> {selectedClass ? getReadableClassName(selectedClass) : classId || "-"}</div>
            <div><strong>Section:</strong> {selectedSection?.name || sectionId || "-"}</div>
            <div><strong>Date:</strong> {formatDisplayDate(attendanceDate)}</div>
            <div><strong>File:</strong> {file ? `${file.name} (${formatFileSize(file.size)})` : "-"}</div>
          </div>
        )}
        onCancel={() => {
          setConfirmOpen(false);
          setQueuedSubmit(null);
        }}
        onConfirm={confirmImport}
        isConfirming={saving}
        loadingLabel="Importing..."
      />
    </div>
  );
}