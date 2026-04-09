"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { Spinner } from "@/components/common/Spinner";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type ApiList<T> = T[] | { results?: T[] };

type StudentRow = {
  id: number;
  admission_no: string;
  roll_no?: string;
  first_name: string;
  last_name?: string;
  gender?: "male" | "female" | "other";
  date_of_birth?: string | null;
  current_class?: number | null;
  current_section?: number | null;
  is_disabled: boolean;
  is_active: boolean;
};

type SchoolClass = { id: number; name?: string; class_name?: string };
type Section = { id: number; school_class: number; name?: string; section_name?: string };
type PaginatedResponse<T> = { results: T[]; next: string | null; previous?: string | null };
type ExportFormat = "csv" | "pdf";

type ColumnKey =
  | "sl"
  | "admission_no"
  | "roll_no"
  | "name"
  | "class_section"
  | "gender"
  | "date_of_birth"
  | "status";

type ColumnDefinition = { key: ColumnKey; label: string; defaultChecked: boolean };
type ExportRow = Record<ColumnKey, string>;

const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  { key: "sl", label: "SL", defaultChecked: true },
  { key: "admission_no", label: "ID", defaultChecked: true },
  { key: "roll_no", label: "Roll No", defaultChecked: true },
  { key: "name", label: "Name", defaultChecked: true },
  { key: "class_section", label: "Class (Section)", defaultChecked: true },
  { key: "gender", label: "Gender", defaultChecked: true },
  { key: "date_of_birth", label: "Date Of Birth", defaultChecked: false },
  { key: "status", label: "Status", defaultChecked: true },
];

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

function toRelativeApiPath(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function isPaginatedResponse<T>(value: unknown): value is PaginatedResponse<T> {
  return !!value && typeof value === "object" && "results" in value && "next" in value;
}

function sanitizeIdInput(value: string) {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) && Number(trimmed) > 0 ? trimmed : "";
}

function normalizeClassLabel(label: string, id: number) {
  const trimmed = label.trim();
  if (!trimmed) return String(id);
  if (/^\d+$/.test(trimmed)) return trimmed;
  if (/^class\s*\d+$/i.test(trimmed)) return trimmed.replace(/[^\d]/g, "");
  return trimmed;
}

function isClassOptionValid(row: SchoolClass) {
  if (!Number.isInteger(row.id) || row.id <= 0) return false;
  const label = String(row.class_name || row.name || "").trim();
  if (!label) return false;
  if (/[<>]/.test(label)) return false;
  if (/^(adc|undefined|null|nan)$/i.test(label)) return false;
  return true;
}

async function fetchAllStudents(filters: { classId?: string; sectionId?: string; status?: "active" | "inactive" | "all" }): Promise<StudentRow[]> {
  const aggregated: StudentRow[] = [];
  const params = new URLSearchParams({ page: "1", page_size: "200" });
  if (filters.classId) params.set("class", filters.classId);
  if (filters.sectionId) params.set("section", filters.sectionId);
  if (filters.status === "active") params.set("is_active", "true");
  if (filters.status === "inactive") params.set("is_active", "false");

  let nextPath: string | null = `/api/v1/students/students/?${params.toString()}`;

  while (nextPath) {
    const payload: ApiList<StudentRow> | PaginatedResponse<StudentRow> =
      await apiGet<ApiList<StudentRow> | PaginatedResponse<StudentRow>>(nextPath);
    if (isPaginatedResponse<StudentRow>(payload)) {
      aggregated.push(...(payload.results || []));
      nextPath = payload.next ? toRelativeApiPath(payload.next) : null;
      continue;
    }

    return listData(payload);
  }

  return aggregated;
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
    height: 40,
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "0 10px",
    background: "var(--surface)",
  } as const;
}

function buttonStyle(color = "#16a34a") {
  return {
    minWidth: 140,
    height: 40,
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 8,
    padding: "0 14px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  } as const;
}

function badgeStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 600,
  } as const;
}

function fullName(row: StudentRow) {
  return `${row.first_name || ""} ${row.last_name || ""}`.trim() || "-";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function escapeCsvValue(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function StudentExportPanel() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [filteredSections, setFilteredSections] = useState<Section[]>([]);

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [loading, setLoading] = useState(true);
  const [refreshingCount, setRefreshingCount] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [generatingFormat, setGeneratingFormat] = useState<ExportFormat | null>(null);
  const [confirmFormat, setConfirmFormat] = useState<ExportFormat | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [openFilters, setOpenFilters] = useState(true);

  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(
    COLUMN_DEFINITIONS.filter((column) => column.defaultChecked).map((column) => column.key),
  );

  const validClasses = useMemo(() => classes.filter(isClassOptionValid), [classes]);
  const classMap = useMemo(
    () => new Map(validClasses.map((item) => [item.id, normalizeClassLabel(String(item.name || item.class_name || ""), item.id)])),
    [validClasses],
  );
  const sectionMap = useMemo(
    () => new Map(sections.map((item) => [item.id, String(item.name || item.section_name || "").trim() || `Section ${item.id}`])),
    [sections],
  );

  const selectedColumnDefs = useMemo(
    () => COLUMN_DEFINITIONS.filter((column) => selectedColumns.includes(column.key)),
    [selectedColumns],
  );

  const exportRows = useMemo<ExportRow[]>(() => {
    return students.map((row, index) => {
      const className = classMap.get(row.current_class || 0) || "-";
      const sectionName = sectionMap.get(row.current_section || 0) || "-";
      return {
        sl: String(index + 1),
        admission_no: row.admission_no || "-",
        roll_no: row.roll_no || "-",
        name: fullName(row),
        class_section: `${className} (${sectionName})`,
        gender: row.gender || "-",
        date_of_birth: formatDate(row.date_of_birth) || "-",
        status: row.is_active ? (row.is_disabled ? "Disabled" : "Active") : "Inactive",
      };
    });
  }, [students, classMap, sectionMap]);

  const readyCount = exportRows.length;

  const loadBaseMeta = async () => {
    const [classData, sectionData] = await Promise.all([
      apiGet<ApiList<SchoolClass>>("/api/v1/core/classes/"),
      apiGet<ApiList<Section>>("/api/v1/core/sections/"),
    ]);
    setClasses(listData(classData));
    const allSections = listData(sectionData);
    setSections(allSections);
    setFilteredSections(
      classId
        ? allSections.filter((item) => Number(item.school_class) === Number(classId))
        : allSections,
    );
  };

  const refreshStudents = async ({ withLoading = false }: { withLoading?: boolean } = {}) => {
    try {
      if (withLoading) setLoading(true);
      setRefreshingCount(!withLoading);
      setError("");

      const data = await fetchAllStudents({
        classId: classId || undefined,
        sectionId: sectionId || undefined,
        status: statusFilter,
      });
      setStudents(data);
      setSuccess("Student count updated successfully.");
    } catch {
      setError("Unable to load students for export.");
      setSuccess("");
    } finally {
      setLoading(false);
      setRefreshingCount(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        setSuccess("");
        await Promise.all([loadBaseMeta(), refreshStudents()]);
      } catch {
        setError("Unable to load students for export.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (!classId) {
      setFilteredSections(sections);
      setSectionId("");
      return;
    }

    const timer = window.setTimeout(() => {
      setLoadingSections(true);
      const next = sections.filter((item) => Number(item.school_class) === Number(classId));
      setFilteredSections(next);
      if (sectionId && !next.some((item) => String(item.id) === sectionId)) {
        setSectionId("");
      }
      setLoadingSections(false);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [classId, sectionId, sections]);

  const toggleColumn = (key: ColumnKey) => {
    setSelectedColumns((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== key);
      }
      return [...prev, key];
    });
  };

  const buildCsv = () => {
    const header = selectedColumnDefs.map((column) => column.label);
    const lines = [
      header.map(escapeCsvValue).join(","),
      ...exportRows.map((row) => selectedColumnDefs.map((column) => escapeCsvValue(row[column.key])).join(",")),
    ];

    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "all-students-export.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const buildPdf = () => {
    const headingHtml = selectedColumnDefs.map((column) => `<th>${column.label}</th>`).join("");
    const rowsHtml = exportRows
      .map((row) => {
        const cells = selectedColumnDefs.map((column) => `<td>${row[column.key]}</td>`).join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>All Student Export</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h2 { margin: 0 0 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; }
          th { background: #f3f4f6; }
          .notice { margin-bottom: 10px; color: #374151; font-size: 12px; }
        </style>
      </head>
      <body>
        <h2>All Student Export</h2>
        <div class="notice">Export contains sensitive student information.</div>
        <table>
          <thead>
            <tr>${headingHtml}</tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
      </html>
    `;

    const popup = window.open("", "_blank", "width=1200,height=800");
    if (!popup) {
      throw new Error("Popup blocked. Allow popups to export PDF.");
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const executeExport = async (format: ExportFormat) => {
    if (!exportRows.length) {
      setError("No student data available to export.");
      setSuccess("");
      return;
    }

    setGeneratingFormat(format);
    setError("");
    setSuccess("");

    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (format === "csv") {
        buildCsv();
        setSuccess("CSV exported successfully.");
      } else {
        buildPdf();
        setSuccess("PDF export opened. Use Save as PDF in print dialog.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed.";
      setError(message);
    } finally {
      setGeneratingFormat(null);
      setConfirmFormat(null);
    }
  };

  const openConfirm = (format: ExportFormat) => {
    if (!exportRows.length) {
      setError("No student data available to export.");
      setSuccess("");
      return;
    }
    setConfirmFormat(format);
  };

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Student Export</h1>
            <div style={{ display: "flex", gap: 8, color: "#555", fontSize: 13 }}>
              <span>Dashboard</span>
              <span>/</span>
              <span>Student Information</span>
              <span>/</span>
              <span>Student Export</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h3 style={{ marginTop: 0, marginBottom: 0 }}>All Student Export</h3>
              <div aria-live="polite" style={badgeStyle()}>{readyCount} Students Ready</div>
            </div>

            <div style={{ marginTop: 12, padding: 12, border: "1px solid #d1d5db", borderRadius: 10, background: "#fafafa" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <strong>Filter Before Export</strong>
                <button
                  type="button"
                  onClick={() => setOpenFilters((prev) => !prev)}
                  style={{ border: "none", background: "transparent", color: "#2563eb", cursor: "pointer", fontSize: 13 }}
                >
                  {openFilters ? "Collapse" : "Expand"}
                </button>
              </div>

              {openFilters && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 8, alignItems: "end" }}>
                  <div>
                    <label htmlFor="student-export-class" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Class</label>
                    <select
                      id="student-export-class"
                      value={classId}
                      onChange={(e) => {
                        const next = sanitizeIdInput(e.target.value);
                        setClassId(next);
                        setSectionId("");
                      }}
                      style={fieldStyle()}
                    >
                      <option value="">All Classes</option>
                      {validClasses.map((row) => (
                        <option key={row.id} value={row.id}>
                          {normalizeClassLabel(String(row.name || row.class_name || ""), row.id)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="student-export-section" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Section</label>
                    <select
                      id="student-export-section"
                      value={sectionId}
                      onChange={(e) => setSectionId(sanitizeIdInput(e.target.value))}
                      disabled={!classId || loadingSections}
                      style={{ ...fieldStyle(), opacity: !classId ? 0.7 : 1 }}
                    >
                      <option value="">{!classId ? "Select Class First" : loadingSections ? "Loading..." : "All Sections"}</option>
                      {filteredSections.map((row) => (
                        <option key={row.id} value={row.id}>
                          {String(row.name || row.section_name || "").trim() || `Section ${row.id}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="student-export-status" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Status</label>
                    <select
                      id="student-export-status"
                      value={statusFilter}
                      onChange={(e) => {
                        const next = String(e.target.value);
                        if (next === "active" || next === "inactive" || next === "all") {
                          setStatusFilter(next);
                        }
                      }}
                      style={fieldStyle()}
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => void refreshStudents()}
                    disabled={loading || refreshingCount}
                    style={{ ...buttonStyle("#2563eb") }}
                  >
                    {refreshingCount ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Spinner size={14} color="currentColor" />
                        Refreshing...
                      </span>
                    ) : (
                      "Refresh Count"
                    )}
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, padding: 12, border: "1px solid #e5e7eb", borderRadius: 10 }}>
              <strong style={{ display: "block", marginBottom: 8 }}>Select Export Columns</strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 8 }}>
                {COLUMN_DEFINITIONS.map((column) => {
                  const checked = selectedColumns.includes(column.key);
                  return (
                    <label key={column.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleColumn(column.key)}
                        aria-label={`Include ${column.label} column`}
                      />
                      <span>{column.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 14, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 10, fontSize: 13 }}>
              Export contains sensitive student information.
            </div>

            <p style={{ marginTop: 10, marginBottom: 0, color: "var(--text-muted)" }}>
              Large exports may take time. CSV is better for spreadsheet processing.
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <button type="button" onClick={() => openConfirm("csv")} style={buttonStyle("#0f766e")} disabled={loading || generatingFormat !== null} aria-label="Export to CSV">
                {generatingFormat === "csv" ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Spinner size={14} color="currentColor" />
                    Generating...
                  </span>
                ) : (
                  "[CSV] Export to CSV"
                )}
              </button>

              <button type="button" onClick={() => openConfirm("pdf")} style={buttonStyle("#1d4ed8")} disabled={loading || generatingFormat !== null} aria-label="Export to PDF">
                {generatingFormat === "pdf" ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Spinner size={14} color="currentColor" />
                    Generating...
                  </span>
                ) : (
                  "[PDF] Export to PDF"
                )}
              </button>
            </div>

            <p style={{ marginTop: 12, color: "var(--text-muted)" }}>
              {loading ? "Loading student data..." : `Total students ready for export: ${readyCount}`}
            </p>
            {error && <p style={{ marginTop: 8, color: "var(--warning)" }}>{error}</p>}
            {success && <p style={{ marginTop: 8, color: "#0f766e" }}>{success}</p>}
          </div>
        </div>
      </section>

      <ConfirmationModal
        isOpen={confirmFormat !== null}
        title="Confirm Export"
        message={`You are about to export ${readyCount} student records. This may take a moment. Proceed?`}
        confirmLabel="Proceed"
        cancelLabel="Cancel"
        loadingLabel="Generating..."
        isConfirming={generatingFormat !== null}
        onCancel={() => setConfirmFormat(null)}
        onConfirm={() => {
          if (!confirmFormat) return;
          void executeExport(confirmFormat);
        }}
      />
    </div>
  );
}
