"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
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
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Form validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Response tracking
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [importResult, setImportResult] = useState<{ imported: number; failed: number } | null>(null);
  const [detailedErrors, setDetailedErrors] = useState<ImportError[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const selectedDate = new Date(attendanceDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate > today) {
        newErrors.attendanceDate = "Cannot import attendance for future dates";
      }
    }
    if (!file) {
      newErrors.file = "Please upload a file";
    } else {
      // File format validation
      const validFormats = [".csv", ".xlsx", ".xls"];
      const hasValidFormat = validFormats.some((fmt) => file.name.toLowerCase().endsWith(fmt));
      if (!hasValidFormat) {
        newErrors.file = "Upload a valid CSV or Excel file (.csv, .xlsx, .xls)";
      }
      // File size validation (5MB max)
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > 5) {
        newErrors.file = `File size exceeds 5MB limit (current: ${fileSizeMB.toFixed(2)}MB)`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Load data
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [classData, sectionData] = await Promise.all([
          apiGet<{ classes: SchoolClass[] }>("/api/v1/attendance/student-attendance/import/"),
          apiGet<Section[] | { results?: Section[] }>("/api/v1/core/sections/"),
        ]);
        setClasses(classData.classes || []);
        setSections(Array.isArray(sectionData) ? sectionData : sectionData.results || []);
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
      const validFormats = [".csv", ".xlsx", ".xls"];
      const isValid = validFormats.some((fmt) => droppedFile.name.toLowerCase().endsWith(fmt));

      if (isValid) {
        setFile(droppedFile);
        setErrors((prev) => ({ ...prev, file: "" }));
      } else {
        setErrors((prev) => ({ ...prev, file: "Invalid file format. Upload CSV or Excel file." }));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setErrors((prev) => ({ ...prev, file: "" }));
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

    try {
      setSaving(true);
      setApiError("");
      setSuccessMessage("");
      setImportResult(null);
      setDetailedErrors([]);

      const formData = new FormData();
      formData.append("class", classId);
      formData.append("section", sectionId);
      formData.append("attendance_date", attendanceDate);
      if (file) {
        formData.append("file", file);
      }

      const response = await apiRequestWithRefresh<ImportResponse>("/api/v1/attendance/student-attendance/bulk-store/", {
        method: "POST",
        headers: {},
        body: formData,
      });

      // Handle different response scenarios
      if (response.data?.failed && response.data.failed > 0) {
        // Partial success
        setImportResult({
          imported: response.data.imported || 0,
          failed: response.data.failed || 0,
        });
        setDetailedErrors(response.data.errors || []);
        setSuccessMessage(`✓ ${response.data.imported || 0} records imported, ${response.data.failed || 0} failed`);
      } else {
        // Full success
        setSuccessMessage("✓ Attendance imported successfully");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setImportResult(null);
      }
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
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = classId && sectionId && attendanceDate && file;

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Student Attendance</h1>
            <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
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
          {/* Header with Download Button */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Import Attendance</h3>
            <button type="button" style={secondaryButtonStyle()} onClick={downloadSampleFile}>
              ⬇ Download Sample File
            </button>
          </div>

          {/* Main Form Box */}
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 16 }}>
            <form onSubmit={submit}>
              {/* Class & Section Fields */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                    Select Class <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    value={classId}
                    onChange={(e) => {
                      setClassId(e.target.value);
                      setSectionId("");
                      setErrors((prev) => ({ ...prev, classId: "" }));
                    }}
                    disabled={loading}
                    style={fieldStyle(!!errors.classId)}
                  >
                    <option value="">Select Class</option>
                    {classes.map((schoolClass) => (
                      <option key={schoolClass.id} value={schoolClass.id}>
                        {schoolClass.class_name || schoolClass.name || `Class ${schoolClass.id}`}
                      </option>
                    ))}
                  </select>
                  {errors.classId && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>📌 {errors.classId}</p>}
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                    Select Section <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    value={sectionId}
                    onChange={(e) => {
                      setSectionId(e.target.value);
                      setErrors((prev) => ({ ...prev, sectionId: "" }));
                    }}
                    disabled={!classId || loading}
                    style={fieldStyle(!!errors.sectionId)}
                  >
                    <option value="">Select Section</option>
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
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                  Attendance Date <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => {
                    setAttendanceDate(e.target.value);
                    setErrors((prev) => ({ ...prev, attendanceDate: "" }));
                  }}
                  disabled={loading}
                  style={fieldStyle(!!errors.attendanceDate)}
                />
                {errors.attendanceDate && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>📌 {errors.attendanceDate}</p>}
              </div>

              {/* Drag & Drop File Upload */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                  Upload File <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: dragActive ? "2px dashed var(--primary)" : `2px dashed var(--line)`,
                    borderRadius: 8,
                    padding: 24,
                    textAlign: "center",
                    cursor: "pointer",
                    backgroundColor: dragActive ? "rgba(59, 130, 246, 0.05)" : "rgba(0,0,0,0.01)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                  <p style={{ margin: "0 0 4px 0", fontSize: 14, fontWeight: 500 }}>
                    {file ? `✓ ${file.name}` : "Drag & drop your file here"}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                    or click to select (CSV or Excel, max 5MB)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                  disabled={loading}
                />
                {errors.file && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>📌 {errors.file}</p>}
              </div>

              {/* Submit Button */}
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
                <button
                  type="submit"
                  disabled={saving || !isFormValid || loading}
                  style={buttonStyle("var(--primary)", saving || !isFormValid || loading)}
                >
                  {saving ? "⏳ Importing..." : "📤 Import Attendance"}
                </button>
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
    </div>
  );
}