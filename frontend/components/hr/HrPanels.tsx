"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequestWithRefresh } from "@/lib/api-auth";

let _xlsxCache: typeof import("xlsx") | null = null;
async function getXLSX() {
  if (!_xlsxCache) _xlsxCache = await import("xlsx");
  return _xlsxCache;
}

type ApiList<T> = T[] | { count?: number; next?: string | null; previous?: string | null; results?: T[]; data?: T[] };

type PaginationMeta = {
  count: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

type OtherDocumentEntry = {
  id: string;
  name: string;
  file?: File;
};

const STAFF_IMPORT_HEADERS = [
  "Staff No",
  "Role Name",
  "Department Name",
  "Designation Name",
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "Gender",
  "Marital Status",
  "Date Of Birth",
  "Joining Date",
  "Emergency Mobile",
  "Driving License",
  "EPF No",
  "Current Address",
  "Permanent Address",
  "Qualification",
  "Experience",
  "Bank Account Name",
  "Bank Account Number",
  "Bank Name",
  "Bank Branch",
  "IFSC Code",
  "Bank Contact Mobile",
  "Basic Salary",
  "Allowance",
  "Deduction",
  "Contract Type",
  "Location",
  "Facebook URL",
  "Twitter URL",
  "LinkedIn URL",
  "Instagram URL",
  "Show Public",
] as const;

type ImportLookupRow = Record<string, string>;

function normalizeImportKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function downloadBlobFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function buildStaffTemplateWorkbook() {
  const XLSX = await getXLSX();
  const blankRow = Array.from({ length: STAFF_IMPORT_HEADERS.length }, () => "");
  const sheet = XLSX.utils.aoa_to_sheet([Array.from(STAFF_IMPORT_HEADERS), blankRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Staff Import");
  return workbook;
}

async function createStaffImportTemplateBlob() {
  const XLSX = await getXLSX();
  const workbook = await buildStaffTemplateWorkbook();
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function parseSpreadsheetRows(file: File): Promise<ImportLookupRow[]> {
  const XLSX = await getXLSX();
  const workbook = file.name.toLowerCase().endsWith(".csv")
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    return [];
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    blankrows: false,
    defval: "",
    raw: false,
  });

  return rows.map((row: Record<string, unknown>) => {
    const normalizedRow: ImportLookupRow = {};
    Object.entries(row).forEach(([key, value]) => {
      normalizedRow[key] = String(value ?? "").trim();
    });
    return normalizedRow;
  });
}

function normalizeImportRow(row: ImportLookupRow) {
  const normalized = new Map<string, string>();
  Object.entries(row).forEach(([key, value]) => {
    normalized.set(normalizeImportKey(key), value.trim());
  });
  return normalized;
}

function getImportValue(row: Map<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row.get(normalizeImportKey(alias)) || "";
    if (value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function parseImportBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return null;
}

function normalizeImportDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return trimmed;
}

function normalizeImportAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/[,₹\s]/g, "");
}

function incrementStaffNo(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (!match) {
    return trimmed ? `${trimmed}2` : "2";
  }
  const prefix = match[1];
  const nextNumber = String(Number(match[2]) + 1);
  return `${prefix}${nextNumber}`;
}

function isBlankImportRow(row: ImportLookupRow) {
  return Object.values(row).every((value) => !String(value || "").trim());
}

function listData<T>(value: ApiList<T>): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  const payload = value as unknown as { data?: unknown; results?: unknown };
  if (Array.isArray(payload.data)) {
    return payload.data as T[];
  }
  if (payload.data && typeof payload.data === "object") {
    const nested = payload.data as { data?: unknown; results?: unknown };
    if (Array.isArray(nested.data)) {
      return nested.data as T[];
    }
    if (Array.isArray(nested.results)) {
      return nested.results as T[];
    }
  }
  if (Array.isArray(payload.results)) {
    return payload.results as T[];
  }

  return [];
}

function listPaginationMeta<T>(value: ApiList<T>, pageSize: number): PaginationMeta {
  const payload = value as { count?: unknown; next?: unknown; previous?: unknown };
  const fallbackCount = listData(value).length;
  const count = typeof payload.count === "number" ? payload.count : fallbackCount;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  return {
    count,
    totalPages,
    hasNext: Boolean(payload.next),
    hasPrevious: Boolean(payload.previous),
  };
}

function buildPageButtons(currentPage: number, totalPages: number, windowSize = 5): number[] {
  if (totalPages <= windowSize) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, currentPage - half);
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function normalizeNextPath(nextRaw: string): string {
  if (nextRaw.startsWith("http")) {
    try {
      const nextUrl = new URL(nextRaw);
      return `${nextUrl.pathname}${nextUrl.search}`;
    } catch {
      return "";
    }
  }
  return nextRaw;
}

function makeOtherDocumentId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseOtherDocuments(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value !== "string") {
    return [];
  }

  const raw = value.trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0);
    }
  } catch {
    // Keep backward compatibility with legacy single-string values.
  }

  return [raw];
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  const isFormData = payload instanceof FormData;
  return apiRequestWithRefresh<T>(path, {
    method: "POST",
    ...(isFormData
      ? { body: payload }
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
  });
}

async function apiPatch<T>(path: string, payload: unknown): Promise<T> {
  const isFormData = payload instanceof FormData;
  return apiRequestWithRefresh<T>(path, {
    method: "PATCH",
    ...(isFormData
      ? { body: payload }
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
  });
}

async function apiDelete(path: string): Promise<void> {
  await apiRequestWithRefresh<void>(path, { method: "DELETE", headers: { "Content-Type": "application/json" } });
}

async function fetchAllPages<T>(path: string, maxPages = 50): Promise<T[]> {
  const merged: T[] = [];
  let nextPath = path;

  for (let i = 0; i < maxPages && nextPath; i += 1) {
    const data = await apiGet<ApiList<T>>(nextPath);
    merged.push(...listData(data));

    const nextRaw = (data as { next?: string | null }).next;
    nextPath = nextRaw ? normalizeNextPath(nextRaw) : "";
  }

  return merged;
}

function fieldStyle() {
  return { width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" } as const;
}

function buttonStyle(color = "var(--primary)") {
  return { height: 34, border: `1px solid ${color}`, background: color, color: "#fff", borderRadius: 8, padding: "0 10px", cursor: "pointer" } as const;
}

function actionButtonStyle(color: string) {
  return {
    minHeight: 34,
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 999,
    padding: "0 12px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
  } as const;
}

function boxStyle() {
  return { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 } as const;
}

function breadcrumb(title: string) {
  return (
    <section className="sms-breadcrumb mb-20">
      <div className="container-fluid">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>
          <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
            <span>Dashboard</span>
            <span>/</span>
            <span>Human Resource</span>
            <span>/</span>
            <span>{title}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

type Department = {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
};

type Designation = {
  id: number;
  department: number;
  name: string;
  is_active: boolean;
};

type Staff = {
  id: number;
  user?: number | null;
  role: number | null;
  staff_no: string;
  first_name: string;
  last_name: string;
  fathers_name: string;
  mothers_name: string;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | "";
  marital_status: "single" | "married" | "";
  email: string;
  phone: string;
  emergency_mobile: string;
  driving_license: string;
  staff_photo: string;
  current_address: string;
  permanent_address: string;
  qualification: string;
  experience: string;
  epf_no: string;
  bank_account_name: string;
  bank_account_no: string;
  bank_name: string;
  bank_branch: string;
  bank_mobile_no: string;
  contract_type: "permanent" | "contract" | "";
  location: string;
  facebook_url: string;
  twitter_url: string;
  linkedin_url: string;
  instagram_url: string;
  resume: string;
  joining_letter: string;
  tenth_certificate: string;
  eleventh_certificate: string;
  aadhar_card: string;
  driving_license_doc: string;
  other_document: string | string[] | null;
  casual_leave: number;
  medical_leave: number;
  maternity_leave: number;
  show_public: boolean;
  department: number | null;
  designation: number | null;
  join_date: string;
  basic_salary: string;
  custom_field?: Record<string, unknown> | null;
  status: "active" | "inactive" | "terminated";
};

type Student = {
  id: number;
  admission_no: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  current_class?: number | null;
  current_section?: number | null;
};

type SchoolClassOption = {
  id: number;
  name: string;
};

type SectionOption = {
  id: number;
  name: string;
  school_class?: number | null;
};

type LeaveType = {
  id: number;
  name: string;
  max_days_per_year: number;
  is_paid: boolean;
  is_active: boolean;
};

type Role = {
  id: number;
  name: string;
};

type LeaveDefine = {
  id: number;
  role: number | null;
  role_name: string;
  staff: number | null;
  staff_name: string;
  student: number | null;
  student_name: string;
  school_class: number | null;
  class_name: string;
  section: number | null;
  section_name: string;
  leave_type: number;
  leave_type_name: string;
  days: number;
};

type LeaveRequest = {
  id: number;
  staff: number;
  leave_type: number;
  from_date: string;
  to_date: string;
  created_at: string;
  reason: string;
  attachment: string; // This line is unchanged, but included for context
  approval_note: string;
  status: "pending" | "approved" | "rejected";
};
type MePayload = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  is_superuser: boolean;
  is_school_admin: boolean;
  permission_codes: string[];
};

type StaffAttendance = {
  id: number;
  staff: number;
  staff_name: string;
  attendance_date: string;
  attendance_type: "P" | "A" | "L" | "F" | "H";
  note: string;
};

type AttendanceReport = {
  total: number;
  by_type: Record<string, number>;
};

type PayrollRecord = {
  id: number;
  staff: number;
  staff_name?: string;
  staff_no?: string;
  payroll_month: number;
  payroll_year: number;
  basic_salary: string;
  allowance: string;
  allowance_items?: Array<{ label: string; amount: string }>;
  deduction: string;
  deduction_items?: Array<{ label: string; amount: string }>;
  net_salary: string;
  status: "draft" | "processed" | "paid";
  paid_at: string | null;
};

type PayrollComponentItem = {
  label: string;
  amount: string;
};

type PayrollSummary = {
  total_records: number;
  total_basic_salary: string;
  total_allowance: string;
  total_deduction: string;
  total_net_salary: string;
};

type PayrollSettings = {
  id: number;
  school: number;
  school_name: string;
  school_url: string;
  logo_url: string;
  signature_url: string;
  default_allowance_items: PayrollComponentItem[];
  default_deduction_items: PayrollComponentItem[];
  default_allowance: string;
  default_deduction: string;
  updated_at: string;
};

type BulkPayrollResponse = {
  detail: string;
  created_count: number;
  updated_count: number;
  skipped_existing: number;
  skipped_paid: number;
  skipped_invalid: number;
  total_staff: number;
};

export function HrDepartmentsPanel() {
  const [rows, setRows] = useState<Department[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; description?: string }>({});
  const formBoxRef = useRef<HTMLDivElement | null>(null);

  const validateName = (raw: string): string | null => {
    const value = raw.trim();
    if (!value) return "Department name is required.";
    if (value.length < 3 || value.length > 50) return "Department name length must be between 3 and 50 characters.";
    if (!/^[A-Za-z ]+$/.test(value)) return "Department name can contain only letters and spaces.";
    return null;
  };

  const validateDescription = (raw: string): string | null => {
    if (raw.trim().length > 255) return "Description must not exceed 255 characters.";
    return null;
  };

  const applyServerError = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes("department name") || lower.includes("name")) {
      setFieldErrors((prev) => ({ ...prev, name: message }));
      return;
    }
    if (lower.includes("description")) {
      setFieldErrors((prev) => ({ ...prev, description: message }));
      return;
    }
    setError(message);
  };

  const load = async (page = 1) => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      params.set("ordering", "name");
      if (statusFilter === "active") params.set("is_active", "true");
      if (statusFilter === "inactive") params.set("is_active", "false");

      const data = await apiGet<ApiList<Department>>(`/api/v1/hr/departments/?${params.toString()}`);
      setRows(listData(data));
      const meta = listPaginationMeta(data, pageSize);
      setCurrentPage(page);
      setTotalRows(meta.count);
      setTotalPages(meta.totalPages);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load departments.";
      setError(message || "Unable to load departments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
  }, [statusFilter, pageSize]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setToast("");
    setFieldErrors({});

    const nameError = validateName(name);
    const descError = validateDescription(description);
    if (nameError || descError) {
      setFieldErrors({ name: nameError || undefined, description: descError || undefined });
      setError("Please fix the highlighted fields.");
      return;
    }

    try {
      setSaving(true);
      const payload = { name: name.trim(), description: description.trim(), is_active: isActive };
      if (editingId) {
        await apiPatch(`/api/v1/hr/departments/${editingId}/`, payload);
        setToast("Department updated successfully.");
      } else {
        await apiPost("/api/v1/hr/departments/", payload);
        setToast("Department created successfully.");
      }
      setEditingId(null);
      setName("");
      setDescription("");
      setIsActive(true);
      await load(currentPage);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save department.";
      applyServerError(message || "Unable to save department.");
    } finally {
      setSaving(false);
    }
  };

  const removeDepartment = async (id: number) => {
    try {
      setError("");
      setToast("");
      setDeletingId(id);
      await apiDelete(`/api/v1/hr/departments/${id}/`);
      setToast("Department deleted successfully.");
      const targetPage = rows.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      await load(targetPage);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete department.";
      setError(message || "Unable to delete department.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Departments")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div
          ref={formBoxRef}
          className={`white-box ${editingId ? "editing-highlight" : ""}`}
          style={{ ...boxStyle(), marginBottom: 12, scrollMarginTop: 12 }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>{editingId ? "Editing Department" : "Add Department"}</h3>
          {editingId ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
                You are updating the selected department. Use Save changes when you are done.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setName("");
                  setDescription("");
                  setIsActive(true);
                  setError("");
                  setToast("");
                  setFieldErrors({});
                }}
                style={{
                  height: 34,
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: "var(--text)",
                  borderRadius: 999,
                  padding: "0 12px",
                  cursor: "pointer",
                }}
              >
                Cancel edit
              </button>
            </div>
          ) : null}
          <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8 }}>
            <div>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Department name *"
                style={{ ...fieldStyle(), borderColor: fieldErrors.name ? "#dc2626" : "var(--line)" }}
              />
              {fieldErrors.name ? <p style={{ color: "#dc2626", marginTop: 4, marginBottom: 0, fontSize: 12 }}>{fieldErrors.name}</p> : null}
            </div>
            <div>
              <input
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (fieldErrors.description) setFieldErrors((prev) => ({ ...prev, description: undefined }));
                }}
                placeholder="Description"
                style={{ ...fieldStyle(), borderColor: fieldErrors.description ? "#dc2626" : "var(--line)" }}
              />
              {fieldErrors.description ? <p style={{ color: "#dc2626", marginTop: 4, marginBottom: 0, fontSize: 12 }}>{fieldErrors.description}</p> : null}
            </div>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active</label>
              <p style={{ marginTop: 4, marginBottom: 0, fontSize: 12, color: "var(--text-muted)" }}>
                Active departments are available for new assignments; inactive departments stay in history only.
              </p>
            </div>
            <button type="submit" style={buttonStyle()} disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Save"}</button>
          </form>
          {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          {toast ? <p style={{ color: "#16a34a", marginTop: 8 }}>{toast}</p> : null}
        </div>

        <div className="white-box" style={boxStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h4 style={{ margin: 0 }}>Department List</h4>
            <div style={{ display: "grid", gap: 4 }}>
              <label htmlFor="department-status-filter" style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                Status Filter
              </label>
              <select
                id="department-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                style={{ ...fieldStyle(), height: 34, minWidth: 170 }}
              >
                <option value="all">All</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>
          </div>
          {loading ? <p style={{ marginTop: 0, marginBottom: 10, color: "var(--text-muted)" }}>Loading departments...</p> : null}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Description</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.name}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.description || "-"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        color: row.is_active ? "#166534" : "#991b1b",
                        background: row.is_active ? "#dcfce7" : "#fee2e2",
                        border: `1px solid ${row.is_active ? "#86efac" : "#fca5a5"}`,
                      }}
                    >
                      {row.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        title="Edit department details"
                        aria-label="Edit department details"
                        style={actionButtonStyle("#0ea5e9")}
                        onClick={() => {
                          setEditingId(row.id);
                          setName(row.name);
                          setDescription(row.description || "");
                          setIsActive(row.is_active);
                          formBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </span>
                        <span>Edit details</span>
                      </button>
                      <button
                        type="button"
                        title="Delete department"
                        aria-label="Delete department"
                        style={actionButtonStyle("#dc2626")}
                        disabled={deletingId === row.id}
                        onClick={() => void removeDepartment(row.id)}
                      >
                        {deletingId === row.id ? (
                          <span>Deleting...</span>
                        ) : (
                          <>
                            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                              </svg>
                            </span>
                            <span>Delete</span>
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 12, color: "var(--text-muted)", borderBottom: "1px solid var(--line)" }}>
                    No departments found for selected filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 10, flexWrap: "wrap" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Showing {rows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalRows)} of {totalRows}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <select
                aria-label="Items per page"
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ ...fieldStyle(), width: 110, height: 34 }}
              >
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
                <option value="100">100 / page</option>
              </select>
              <button type="button" style={buttonStyle("#334155")} disabled={currentPage <= 1 || loading} onClick={() => void load(currentPage - 1)}>Previous</button>
              {buildPageButtons(currentPage, totalPages).map((page) => (
                <button
                  key={page}
                  type="button"
                  style={buttonStyle(page === currentPage ? "var(--primary)" : "#64748b")}
                  disabled={loading}
                  onClick={() => void load(page)}
                >
                  {page}
                </button>
              ))}
              <button type="button" style={buttonStyle("#334155")} disabled={currentPage >= totalPages || loading} onClick={() => void load(currentPage + 1)}>Next</button>
            </div>
          </div>
        </div>
      </div></section>
    </div>
  );
}

export function HrDesignationsPanel() {
  const [rows, setRows] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [departmentId, setDepartmentId] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ department?: string; name?: string }>({});
  const formBoxRef = useRef<HTMLDivElement | null>(null);

  const validateDepartment = (value: string): string | null => {
    if (!value) return "Department is required.";
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) return "Please select a valid department.";
    if (!departments.some((item) => item.id === id)) return "Please select a valid department from the list.";
    return null;
  };

  const validateName = (raw: string): string | null => {
    const value = raw.trim();
    if (!value) return "Designation name is required.";
    if (value.length < 3 || value.length > 50) return "Designation name length must be between 3 and 50 characters.";
    if (!/^[A-Za-z ]+$/.test(value)) return "Designation name can contain only letters and spaces.";
    return null;
  };

  const applyServerError = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes("department")) {
      setFieldErrors((prev) => ({ ...prev, department: message }));
      return;
    }
    if (lower.includes("designation") || lower.includes("name")) {
      setFieldErrors((prev) => ({ ...prev, name: message }));
      return;
    }
    setError(message);
  };

  const load = async (page = 1) => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      params.set("ordering", "name");
      if (statusFilter === "active") params.set("is_active", "true");
      if (statusFilter === "inactive") params.set("is_active", "false");
      if (departmentFilter !== "all") params.set("department", departmentFilter);

      const [designationData, departmentList] = await Promise.all([
        apiGet<ApiList<Designation>>(`/api/v1/hr/designations/?${params.toString()}`),
        fetchAllPages<Department>("/api/v1/hr/departments/?is_active=true&page_size=100"),
      ]);
      setRows(listData(designationData));
      setDepartments(departmentList);
      const meta = listPaginationMeta(designationData, pageSize);
      setCurrentPage(page);
      setTotalRows(meta.count);
      setTotalPages(meta.totalPages);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load designations.";
      setError(message || "Unable to load designations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
  }, [statusFilter, departmentFilter, pageSize]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    setError("");
    setToast("");
    setFieldErrors({});

    const departmentError = validateDepartment(departmentId);
    const nameError = validateName(name);
    if (departmentError || nameError) {
      setFieldErrors({ department: departmentError || undefined, name: nameError || undefined });
      setError("Please fix the highlighted fields.");
      return;
    }

    try {
      setSaving(true);
      const payload = { department: Number(departmentId), name: name.trim(), is_active: isActive };
      if (editingId) {
        await apiPatch(`/api/v1/hr/designations/${editingId}/`, payload);
        setToast("Designation updated successfully.");
      } else {
        await apiPost("/api/v1/hr/designations/", payload);
        setToast("Designation created successfully.");
      }
      setEditingId(null);
      setDepartmentId("");
      setName("");
      setIsActive(true);
      await load(currentPage);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save designation.";
      applyServerError(message || "Unable to save designation.");
    } finally {
      setSaving(false);
    }
  };

  const removeDesignation = async (id: number) => {
    try {
      setError("");
      setToast("");
      setDeletingId(id);
      await apiDelete(`/api/v1/hr/designations/${id}/`);
      setToast("Designation deleted successfully.");
      const targetPage = rows.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      await load(targetPage);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete designation.";
      setError(message || "Unable to delete designation.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Designations")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div
          ref={formBoxRef}
          className={`white-box ${editingId ? "editing-highlight" : ""}`}
          style={{ ...boxStyle(), marginBottom: 12, scrollMarginTop: 12 }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>{editingId ? "Editing Designation" : "Add Designation"}</h3>
          {editingId ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
                You are updating the selected designation. Use Save changes when you are done.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setDepartmentId("");
                  setName("");
                  setIsActive(true);
                  setError("");
                  setToast("");
                  setFieldErrors({});
                }}
                style={{
                  height: 34,
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: "var(--text)",
                  borderRadius: 999,
                  padding: "0 12px",
                  cursor: "pointer",
                }}
              >
                Cancel edit
              </button>
            </div>
          ) : null}
          <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                Department *
              </label>
              <select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  if (fieldErrors.department) setFieldErrors((prev) => ({ ...prev, department: undefined }));
                }}
                style={{ ...fieldStyle(), borderColor: fieldErrors.department ? "#dc2626" : "var(--line)" }}
              >
                <option value="">Department</option>
                {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {fieldErrors.department ? <p style={{ color: "#dc2626", marginTop: 4, marginBottom: 0, fontSize: 12 }}>{fieldErrors.department}</p> : null}
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                Designation *
              </label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Designation name *"
                style={{ ...fieldStyle(), borderColor: fieldErrors.name ? "#dc2626" : "var(--line)" }}
              />
              {fieldErrors.name ? <p style={{ color: "#dc2626", marginTop: 4, marginBottom: 0, fontSize: 12 }}>{fieldErrors.name}</p> : null}
            </div>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active</label>
              <p style={{ marginTop: 4, marginBottom: 0, fontSize: 12, color: "var(--text-muted)" }}>
                Active designations are available in staff assignment; inactive designations remain for records.
              </p>
            </div>
            <button type="submit" style={buttonStyle()} disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Save"}</button>
          </form>
          {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          {toast ? <p style={{ color: "#16a34a", marginTop: 8 }}>{toast}</p> : null}
        </div>

        <div className="white-box" style={boxStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10 }}>
            <h4 style={{ margin: 0 }}>Designation List</h4>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ display: "grid", gap: 4 }}>
                <label htmlFor="designation-department-filter" style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                  Department Filter
                </label>
                <select
                  id="designation-department-filter"
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  style={{ ...fieldStyle(), height: 34, minWidth: 190 }}
                >
                  <option value="all">All Departments</option>
                  {departments.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                <label htmlFor="designation-status-filter" style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                  Status Filter
                </label>
                <select
                  id="designation-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                  style={{ ...fieldStyle(), height: 34, minWidth: 170 }}
                >
                  <option value="all">All</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
              </div>
            </div>
          </div>
          {loading ? <p style={{ marginTop: 0, marginBottom: 10, color: "var(--text-muted)" }}>Loading designations...</p> : null}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Department</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Designation</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const department = departments.find((item) => item.id === row.department);
                return (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{department?.name || row.department}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.name}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          color: row.is_active ? "#166534" : "#991b1b",
                          background: row.is_active ? "#dcfce7" : "#fee2e2",
                          border: `1px solid ${row.is_active ? "#86efac" : "#fca5a5"}`,
                        }}
                      >
                        {row.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          title="Edit designation details"
                          aria-label="Edit designation details"
                          style={actionButtonStyle("#0ea5e9")}
                          onClick={() => {
                            setEditingId(row.id);
                            setDepartmentId(String(row.department));
                            setName(row.name);
                            setIsActive(row.is_active);
                            formBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                            </svg>
                          </span>
                          <span>Edit details</span>
                        </button>
                        <button
                          type="button"
                          title="Delete designation"
                          aria-label="Delete designation"
                          style={actionButtonStyle("#dc2626")}
                          disabled={deletingId === row.id}
                          onClick={() => void removeDesignation(row.id)}
                        >
                          {deletingId === row.id ? (
                            <span>Deleting...</span>
                          ) : (
                            <>
                              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M3 6h18" />
                                  <path d="M8 6V4h8v2" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                </svg>
                              </span>
                              <span>Delete</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 12, color: "var(--text-muted)", borderBottom: "1px solid var(--line)" }}>
                    No designations found for selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 10, flexWrap: "wrap" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Showing {rows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalRows)} of {totalRows}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <select
                aria-label="Items per page"
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ ...fieldStyle(), width: 110, height: 34 }}
              >
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
                <option value="100">100 / page</option>
              </select>
              <button type="button" style={buttonStyle("#334155")} disabled={currentPage <= 1 || loading} onClick={() => void load(currentPage - 1)}>Previous</button>
              {buildPageButtons(currentPage, totalPages).map((page) => (
                <button
                  key={page}
                  type="button"
                  style={buttonStyle(page === currentPage ? "var(--primary)" : "#64748b")}
                  disabled={loading}
                  onClick={() => void load(page)}
                >
                  {page}
                </button>
              ))}
              <button type="button" style={buttonStyle("#334155")} disabled={currentPage >= totalPages || loading} onClick={() => void load(currentPage + 1)}>Next</button>
            </div>
          </div>
        </div>
      </div></section>
    </div>
  );
}

export function HrStaffPanel() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState("");
  const [dropdownErrors, setDropdownErrors] = useState<{ roles?: string; departments?: string; designations?: string }>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [importingStaff, setImportingStaff] = useState(false);
  const [showImportStaffPopup, setShowImportStaffPopup] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    staff_no?: string;
    role?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    join_date?: string;
    date_of_birth?: string;
    phone?: string;
    emergency_mobile?: string;
    staff_photo?: string;
    current_address?: string;
    permanent_address?: string;
    other_document?: string;
    epf_no?: string;
    basic_salary?: string;
    contract_type?: string;
    bank_account_name?: string;
    bank_account_no?: string;
    bank_mobile_no?: string;
    bank_name?: string;
    bank_branch?: string;
    ifsc_code?: string;
    facebook_url?: string;
    twitter_url?: string;
    linkedin_url?: string;
    instagram_url?: string;
  }>({});
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [editParam] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("edit") || "";
  });
  const [activeTab, setActiveTab] = useState<"basic" | "payroll" | "bank" | "social" | "document">("basic");

  const [staffNo, setStaffNo] = useState("");
  const [roleId, setRoleId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fathersName, setFathersName] = useState("");
  const [mothersName, setMothersName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female" | "other">("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [joinDate, setJoinDate] = useState(new Date().toISOString().slice(0, 10));
  const [phone, setPhone] = useState("");
  const [maritalStatus, setMaritalStatus] = useState<"" | "single" | "married">("");
  const [emergencyMobile, setEmergencyMobile] = useState("");
  const [drivingLicense, setDrivingLicense] = useState("");
  const [staffPhoto, setStaffPhoto] = useState("");
  const [staffPhotoFile, setStaffPhotoFile] = useState<File | null>(null);
  const [showPublic, setShowPublic] = useState(false);
  const [currentAddress, setCurrentAddress] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [qualification, setQualification] = useState("");
  const [experience, setExperience] = useState("");

  const [epfNo, setEpfNo] = useState("");
  const [basicSalary, setBasicSalary] = useState("0.00");
  const [allowance, setAllowance] = useState("0.00");
  const [deduction, setDeduction] = useState("0.00");
  const [staffPayrollDefaults, setStaffPayrollDefaults] = useState<{ allowance_items: PayrollComponentItem[]; deduction_items: PayrollComponentItem[] }>({
    allowance_items: [],
    deduction_items: [],
  });
  const [contractType, setContractType] = useState<"" | "permanent" | "contract">("");
  const [location, setLocation] = useState("");

  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankMobileNo, setBankMobileNo] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [ifscLookupLoading, setIfscLookupLoading] = useState(false);
  const [ifscLookupError, setIfscLookupError] = useState("");
  const [ifscAutoFilled, setIfscAutoFilled] = useState(false);

  const [facebookUrl, setFacebookUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");

  const [resume, setResume] = useState("");
  const [joiningLetter, setJoiningLetter] = useState("");
  const [tenthCertificate, setTenthCertificate] = useState("");
  const [eleventhCertificate, setEleventhCertificate] = useState("");
  const [aadharCard, setAadharCard] = useState("");
  const [drivingLicenseDoc, setDrivingLicenseDoc] = useState("");
  const [otherDocuments, setOtherDocuments] = useState<OtherDocumentEntry[]>([]);

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [joiningLetterFile, setJoiningLetterFile] = useState<File | null>(null);
  const [tenthCertFile, setTenthCertFile] = useState<File | null>(null);
  const [eleventhCertFile, setEleventhCertFile] = useState<File | null>(null);
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [drivingLicenseFile, setDrivingLicenseFile] = useState<File | null>(null);

  const staffPhotoRef = useRef<HTMLInputElement | null>(null);
  const importStaffRef = useRef<HTMLInputElement | null>(null);
  const resumeRef = useRef<HTMLInputElement | null>(null);
  const joiningLetterRef = useRef<HTMLInputElement | null>(null);
  const tenthCertRef = useRef<HTMLInputElement | null>(null);
  const eleventhCertRef = useRef<HTMLInputElement | null>(null);
  const aadharRef = useRef<HTMLInputElement | null>(null);
  const drivingLicenseRef = useRef<HTMLInputElement | null>(null);
  const otherDocRef = useRef<HTMLInputElement | null>(null);
  const ifscLookupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ifscLookupAbortRef = useRef<AbortController | null>(null);
  const [staffPhotoPreview, setStaffPhotoPreview] = useState("");

  const filteredDesignations = useMemo(() => {
    if (!departmentId) return designations;
    return designations.filter((item) => item.department === Number(departmentId));
  }, [departmentId, designations]);

  const roleLookupByName = useMemo(() => {
    const lookup = new Map<string, number>();
    roles.forEach((role) => {
      lookup.set(normalizeImportKey(role.name), role.id);
    });
    return lookup;
  }, [roles]);

  const departmentLookupByName = useMemo(() => {
    const lookup = new Map<string, number>();
    departments.forEach((department) => {
      lookup.set(normalizeImportKey(department.name), department.id);
    });
    return lookup;
  }, [departments]);

  const designationLookupByName = useMemo(() => {
    const lookup = new Map<string, number[]>();
    designations.forEach((designation) => {
      const key = normalizeImportKey(designation.name);
      const existing = lookup.get(key) || [];
      existing.push(designation.id);
      lookup.set(key, existing);
    });
    return lookup;
  }, [designations]);

  const designationLookupByDepartment = useMemo(() => {
    const lookup = new Map<string, number>();
    designations.forEach((designation) => {
      lookup.set(`${designation.department}::${normalizeImportKey(designation.name)}`, designation.id);
    });
    return lookup;
  }, [designations]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (ifscLookupTimeoutRef.current) {
      clearTimeout(ifscLookupTimeoutRef.current);
      ifscLookupTimeoutRef.current = null;
    }
    if (ifscLookupAbortRef.current) {
      ifscLookupAbortRef.current.abort();
      ifscLookupAbortRef.current = null;
    }

    const normalizedIfsc = ifscCode.trim().toUpperCase();
    setIfscLookupError("");

    if (!normalizedIfsc) {
      setIfscLookupLoading(false);
      setIfscAutoFilled(false);
      return;
    }

    if (!/^[A-Z]{4}0\d{6}$/.test(normalizedIfsc)) {
      setIfscLookupLoading(false);
      setIfscAutoFilled(false);
      return;
    }

    ifscLookupTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      ifscLookupAbortRef.current = controller;
      setIfscLookupLoading(true);

      try {
        const response = await fetch(`https://ifsc.razorpay.com/${normalizedIfsc}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(response.status === 404 ? "Invalid IFSC code." : "Unable to fetch bank details.");
        }
        const data = (await response.json()) as { BANK?: string; BRANCH?: string };
        const fetchedBank = String(data.BANK || "").trim();
        const fetchedBranch = String(data.BRANCH || "").trim();

        if (fetchedBank) {
          setBankName(fetchedBank);
          clearFieldError("bank_name");
        }
        if (fetchedBranch) {
          setBankBranch(fetchedBranch);
          clearFieldError("bank_branch");
        }

        setIfscAutoFilled(Boolean(fetchedBank || fetchedBranch));
        if (!fetchedBank && !fetchedBranch) {
          setIfscLookupError("Could not auto-fill bank details for this IFSC.");
        }
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === "AbortError";
        if (!aborted) {
          setIfscLookupError("Could not auto-fill bank details for this IFSC.");
          setIfscAutoFilled(false);
        }
      } finally {
        setIfscLookupLoading(false);
      }
    }, 500);

    return () => {
      if (ifscLookupTimeoutRef.current) {
        clearTimeout(ifscLookupTimeoutRef.current);
        ifscLookupTimeoutRef.current = null;
      }
      if (ifscLookupAbortRef.current) {
        ifscLookupAbortRef.current.abort();
        ifscLookupAbortRef.current = null;
      }
    };
  }, [ifscCode]);

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateMobile = (value: string) => !value.trim() || /^\d{1,12}$/.test(value.trim());
  const validateOptionalUrl = (value: string) => !value.trim() || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value.trim());

  const scrollToField = (field: keyof typeof fieldErrors) => {
    const tabByField: Partial<Record<keyof typeof fieldErrors, typeof activeTab>> = {
      ifsc_code: "bank",
      epf_no: "payroll",
      basic_salary: "payroll",
      contract_type: "payroll",
      bank_account_name: "bank",
      bank_account_no: "bank",
      bank_name: "bank",
      bank_branch: "bank",
      other_document: "document",
      facebook_url: "social",
      twitter_url: "social",
      linkedin_url: "social",
      instagram_url: "social",
    };
    const targetTab = tabByField[field] || "basic";
    setActiveTab(targetTab);
    setTimeout(() => {
      const element = document.getElementById(`staff-field-${String(field)}`);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      if ("focus" in element) {
        (element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).focus();
      }
    }, 50);
  };

  const addYearsSafe = (dateString: string, years: number) => {
    const date = new Date(`${dateString}T00:00:00`);
    const month = date.getMonth();
    date.setFullYear(date.getFullYear() + years);
    // Handle leap-day edge cases by moving to last valid day of previous month.
    if (date.getMonth() !== month) {
      date.setDate(0);
    }
    return date.toISOString().slice(0, 10);
  };

  const salaryNetPreview = useMemo(() => {
    const basic = Number(basicSalary || "0");
    const allow = Number(allowance || "0");
    const deduct = Number(deduction || "0");
    if (!Number.isFinite(basic) || !Number.isFinite(allow) || !Number.isFinite(deduct)) return "0.00";
    return (basic + allow - deduct).toFixed(2);
  }, [basicSalary, allowance, deduction]);

  const getSubmitFieldErrors = () => {
    const nextErrors: typeof fieldErrors = {};
    const minAgeYears = 18;
    const maxAgeYears = 80;

    if (!staffNo.trim()) nextErrors.staff_no = "Staff no is required.";
    if (!roleId) nextErrors.role = "Role is required.";
    if (!firstName.trim()) {
      nextErrors.first_name = "First name is required.";
    } else if (!/^[A-Za-z ]{2,50}$/.test(firstName.trim())) {
      nextErrors.first_name = "First name can contain only letters and spaces.";
    }
    if (lastName.trim() && !/^[A-Za-z ]{2,50}$/.test(lastName.trim())) {
      nextErrors.last_name = "Last name can contain only letters and spaces.";
    }
    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!joinDate) {
      nextErrors.join_date = "Joining date is required.";
    } else if (joinDate > todayStr) {
      nextErrors.join_date = "Joining date cannot be in the future.";
    }
    if (dateOfBirth) {
      if (dateOfBirth > todayStr) {
        nextErrors.date_of_birth = "Date of birth cannot be in the future.";
      }

      const eighteenthBirthday = addYearsSafe(dateOfBirth, minAgeYears);
      if (eighteenthBirthday > todayStr) {
        nextErrors.date_of_birth = `Employee must be at least ${minAgeYears} years old.`;
      }

      const oldestAllowedDob = addYearsSafe(todayStr, -maxAgeYears);
      if (dateOfBirth < oldestAllowedDob) {
        nextErrors.date_of_birth = `Employee age should not exceed ${maxAgeYears} years.`;
      }

      if (joinDate && joinDate < dateOfBirth) {
        nextErrors.join_date = "Joining date cannot be earlier than date of birth.";
      }

      if (joinDate && joinDate < eighteenthBirthday) {
        nextErrors.join_date = `Joining date must be after employee turns ${minAgeYears}.`;
      }
    }
    if (!phone.trim()) {
      nextErrors.phone = "Mobile number is required.";
    } else if (!validateMobile(phone)) {
      nextErrors.phone = phone.trim().length > 12 ? "Mobile number must not exceed 12 digits." : "Mobile number must contain digits only.";
    }
    if (!validateMobile(emergencyMobile)) nextErrors.emergency_mobile = emergencyMobile.trim().length > 12 ? "Mobile number must not exceed 12 digits." : "Mobile number must contain digits only.";

    if (!staffPhoto.trim()) nextErrors.staff_photo = "Staff photo is required.";
    if (!currentAddress.trim()) nextErrors.current_address = "Current address is required.";
    if (!permanentAddress.trim()) nextErrors.permanent_address = "Permanent address is required.";
    if (otherDocuments.length === 0) nextErrors.other_document = "Signature upload is required.";

    if (!bankAccountName.trim()) {
      nextErrors.bank_account_name = "Account holder name is required";
    } else if (!/^[A-Za-z\s\-']{2,120}$/.test(bankAccountName.trim())) {
      nextErrors.bank_account_name = "Account holder name can contain only letters, spaces, hyphens, and apostrophes.";
    }
    if (!bankAccountNo.trim()) {
      nextErrors.bank_account_no = "Enter valid account number";
    } else if (!/^\d+$/.test(bankAccountNo.trim())) {
      nextErrors.bank_account_no = "Only numbers are allowed";
    } else if (bankAccountNo.trim().length < 9 || bankAccountNo.trim().length > 18) {
      nextErrors.bank_account_no = "Account number must be between 9 and 18 digits";
    } else if (/^(\d)\1+$/.test(bankAccountNo.trim())) {
      nextErrors.bank_account_no = "Account number cannot contain all repeated digits.";
    }
    if (!bankName.trim()) nextErrors.bank_name = "Bank name is required";
    if (!bankBranch.trim()) nextErrors.bank_branch = "Branch name is required";
    if (!ifscCode.trim()) {
      nextErrors.ifsc_code = "IFSC code is required.";
    } else if (!/^[A-Z]{4}0\d{6}$/.test(ifscCode.trim().toUpperCase())) {
      nextErrors.ifsc_code = "Enter a valid IFSC code (e.g., HDFC0001234).";
    }

    if (!basicSalary.trim()) {
      nextErrors.basic_salary = "Enter valid salary amount";
    } else {
      const parsedSalary = Number(basicSalary);
      if (!Number.isFinite(parsedSalary) || parsedSalary <= 0) {
        nextErrors.basic_salary = "Enter valid salary amount";
      }
    }
    if (!contractType) nextErrors.contract_type = "Select contract type";

    if (epfNo.trim() && !/^[A-Za-z0-9\-/]{4,30}$/.test(epfNo.trim())) {
      nextErrors.epf_no = "Enter a valid EPF number.";
    }

    if (!validateOptionalUrl(facebookUrl)) nextErrors.facebook_url = "Enter a valid URL";
    if (!validateOptionalUrl(twitterUrl)) nextErrors.twitter_url = "Enter a valid URL";
    if (!validateOptionalUrl(linkedinUrl)) nextErrors.linkedin_url = "Enter a valid URL";
    if (!validateOptionalUrl(instagramUrl)) nextErrors.instagram_url = "Enter a valid URL";

    return nextErrors;
  };

  const applyApiErrorToField = (message: string): keyof typeof fieldErrors | null => {
    const lowered = message.toLowerCase();
    if (lowered.includes("staff number") || lowered.includes("staff no")) {
      setFieldErrors((prev) => ({ ...prev, staff_no: message }));
      return "staff_no";
    }
    if (lowered.includes("role")) {
      setFieldErrors((prev) => ({ ...prev, role: message }));
      return "role";
    }
    if (lowered.includes("email")) {
      setFieldErrors((prev) => ({ ...prev, email: message }));
      return "email";
    }
    if (lowered.includes("joining date") || lowered.includes("join date")) {
      setFieldErrors((prev) => ({ ...prev, join_date: message }));
      return "join_date";
    }
    if (lowered.includes("date of birth")) {
      setFieldErrors((prev) => ({ ...prev, date_of_birth: message }));
      return "date_of_birth";
    }
    if (lowered.includes("mobile") || lowered.includes("phone")) {
      setFieldErrors((prev) => ({ ...prev, phone: message }));
      return "phone";
    }
    if (lowered.includes("last name")) {
      setFieldErrors((prev) => ({ ...prev, last_name: message }));
      return "last_name";
    }
    if (lowered.includes("ifsc")) {
      setFieldErrors((prev) => ({ ...prev, ifsc_code: message }));
      return "ifsc_code";
    }
    if (lowered.includes("current address")) {
      setFieldErrors((prev) => ({ ...prev, current_address: message }));
      return "current_address";
    }
    if (lowered.includes("permanent address")) {
      setFieldErrors((prev) => ({ ...prev, permanent_address: message }));
      return "permanent_address";
    }
    if (lowered.includes("staff photo")) {
      setFieldErrors((prev) => ({ ...prev, staff_photo: message }));
      return "staff_photo";
    }
    if (lowered.includes("signature") || lowered.includes("other document")) {
      setFieldErrors((prev) => ({ ...prev, other_document: message }));
      return "other_document";
    }
    if (lowered.includes("account holder")) {
      setFieldErrors((prev) => ({ ...prev, bank_account_name: message }));
      return "bank_account_name";
    }
    if (lowered.includes("account number") || lowered.includes("bank account")) {
      setFieldErrors((prev) => ({ ...prev, bank_account_no: message }));
      return "bank_account_no";
    }
    if (lowered.includes("bank name")) {
      setFieldErrors((prev) => ({ ...prev, bank_name: message }));
      return "bank_name";
    }
    if (lowered.includes("branch")) {
      setFieldErrors((prev) => ({ ...prev, bank_branch: message }));
      return "bank_branch";
    }
    if (lowered.includes("salary")) {
      setFieldErrors((prev) => ({ ...prev, basic_salary: message }));
      return "basic_salary";
    }
    if (lowered.includes("contract type")) {
      setFieldErrors((prev) => ({ ...prev, contract_type: message }));
      return "contract_type";
    }
    if (lowered.includes("epf")) {
      setFieldErrors((prev) => ({ ...prev, epf_no: message }));
      return "epf_no";
    }
    if (lowered.includes("facebook")) {
      setFieldErrors((prev) => ({ ...prev, facebook_url: message }));
      return "facebook_url";
    }
    if (lowered.includes("twitter")) {
      setFieldErrors((prev) => ({ ...prev, twitter_url: message }));
      return "twitter_url";
    }
    if (lowered.includes("linkedin")) {
      setFieldErrors((prev) => ({ ...prev, linkedin_url: message }));
      return "linkedin_url";
    }
    if (lowered.includes("instagram")) {
      setFieldErrors((prev) => ({ ...prev, instagram_url: message }));
      return "instagram_url";
    }
    return null;
  };

  const applyApiDetailsToField = (details: unknown): keyof typeof fieldErrors | null => {
    const fieldKeyMap: Record<string, keyof typeof fieldErrors> = {
      staff_no: "staff_no",
      role: "role",
      first_name: "first_name",
      last_name: "last_name",
      email: "email",
      join_date: "join_date",
      date_of_birth: "date_of_birth",
      phone: "phone",
      emergency_mobile: "emergency_mobile",
      staff_photo: "staff_photo",
      current_address: "current_address",
      permanent_address: "permanent_address",
      other_document: "other_document",
      epf_no: "epf_no",
      basic_salary: "basic_salary",
      contract_type: "contract_type",
      bank_account_name: "bank_account_name",
      bank_account_no: "bank_account_no",
      bank_mobile_no: "bank_mobile_no",
      bank_name: "bank_name",
      bank_branch: "bank_branch",
      ifsc_code: "ifsc_code",
      facebook_url: "facebook_url",
      twitter_url: "twitter_url",
      linkedin_url: "linkedin_url",
      instagram_url: "instagram_url",
    };

    const pickMessage = (value: unknown): string | null => {
      if (typeof value === "string") {
        return value;
      }
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        return typeof first === "string" ? first : null;
      }
      return null;
    };

    const tryApply = (value: unknown): keyof typeof fieldErrors | null => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
      }

      const record = value as Record<string, unknown>;
      for (const [apiField, apiValue] of Object.entries(record)) {
        const mappedField = fieldKeyMap[apiField];
        if (!mappedField) continue;
        const message = pickMessage(apiValue);
        if (!message) continue;
        setFieldErrors((prev) => ({ ...prev, [mappedField]: message }));
        return mappedField;
      }
      return null;
    };

    if (!details || typeof details !== "object") {
      return null;
    }

    const root = details as Record<string, unknown>;
    return (
      tryApply(root.errors) ||
      tryApply(root.details) ||
      tryApply((root.error as Record<string, unknown> | undefined)?.details) ||
      tryApply(root)
    );
  };

  const resetForm = () => {
    setActiveTab("basic");
    setStaffNo("");
    setRoleId("");
    setDepartmentId("");
    setDesignationId("");
    setFirstName("");
    setLastName("");
    setFathersName("");
    setMothersName("");
    setEmail("");
    setGender("");
    setDateOfBirth("");
    setJoinDate(new Date().toISOString().slice(0, 10));
    setPhone("");
    setMaritalStatus("");
    setEmergencyMobile("");
    setDrivingLicense("");
    setStaffPhoto("");
    setStaffPhotoFile(null);
    setStaffPhotoPreview("");
    setShowPublic(false);
    setCurrentAddress("");
    setPermanentAddress("");
    setQualification("");
    setExperience("");
    setEpfNo("");
    setBasicSalary("0.00");
    setAllowance("0.00");
    setDeduction("0.00");
    setContractType("");
    setLocation("");
    setBankAccountName("");
    setBankAccountNo("");
    setBankName("");
    setBankBranch("");
    setBankMobileNo("");
    setIfscCode("");
    setIfscLookupLoading(false);
    setIfscLookupError("");
    setIfscAutoFilled(false);
    try {
      localStorage.removeItem("hr_staff_form_draft");
    } catch {
      // ignore storage errors
    }
    setFacebookUrl("");
    setTwitterUrl("");
    setLinkedinUrl("");
    setInstagramUrl("");
    setResume("");
    setResumeFile(null);
    setJoiningLetter("");
    setJoiningLetterFile(null);
    setTenthCertificate("");
    setTenthCertFile(null);
    setEleventhCertificate("");
    setEleventhCertFile(null);
    setAadharCard("");
    setAadharFile(null);
    setDrivingLicenseDoc("");
    setDrivingLicenseFile(null);
    setOtherDocuments([]);
  };

  const handleDownloadStaffTemplate = async () => {
    const blob = await createStaffImportTemplateBlob();
    downloadBlobFile("staff-import-template.xlsx", blob);
    setError("");
    setSuccess("Sample Excel template downloaded.");
  };

  const openImportStaffPopup = () => {
    setShowImportStaffPopup(true);
    setError("");
    setSuccess("");
    setToast("");
  };

  const closeImportStaffPopup = () => {
    if (importingStaff) {
      return;
    }
    setShowImportStaffPopup(false);
  };

  useEffect(() => {
    if (editingStaffId) {
      setShowImportStaffPopup(false);
    }
  }, [editingStaffId]);

  const handleImportStaffFile = async (file: File) => {
    try {
      setError("");
      setSuccess("");
      setToast("");
      setImportingStaff(true);

      const rows = (await parseSpreadsheetRows(file)).filter((row) => !isBlankImportRow(row));
      if (rows.length === 0) {
        setError("The selected file does not contain any staff rows.");
        return;
      }

      const needsAutoStaffNo = rows.some((row) => !getImportValue(normalizeImportRow(row), ["Staff No", "Staff Number", "staff_no", "staff number"]));
      let nextGeneratedStaffNo = needsAutoStaffNo ? (await apiGet<{ staff_no: string }>("/api/v1/hr/staff/next-staff-no/")).staff_no || "" : "";
      let importedCount = 0;
      const failures: Array<{ rowNumber: number; message: string }> = [];

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const normalizedRow = normalizeImportRow(row);
        const rowNumber = index + 2;
        const rowPrefix = `Row ${rowNumber}`;

        const staffNoInput = getImportValue(normalizedRow, ["Staff No", "Staff Number", "staff_no", "staff number"]);
        const staffNo = staffNoInput || nextGeneratedStaffNo;
        if (!staffNo) {
          failures.push({ rowNumber, message: `${rowPrefix}: staff number could not be generated.` });
          continue;
        }
        if (!staffNoInput) {
          nextGeneratedStaffNo = incrementStaffNo(nextGeneratedStaffNo || staffNo);
        }

        const roleIdValue = getImportValue(normalizedRow, ["Role Id", "Role ID", "role_id"]);
        const roleNameValue = getImportValue(normalizedRow, ["Role Name", "Role", "role_name"]);
        let resolvedRoleId: number | null = null;
        if (roleIdValue) {
          const parsedRoleId = Number(roleIdValue);
          if (Number.isFinite(parsedRoleId) && parsedRoleId > 0) {
            resolvedRoleId = parsedRoleId;
          } else {
            failures.push({ rowNumber, message: `${rowPrefix}: role id must be numeric.` });
            continue;
          }
        } else if (roleNameValue) {
          resolvedRoleId = roleLookupByName.get(normalizeImportKey(roleNameValue)) || null;
          if (!resolvedRoleId) {
            failures.push({ rowNumber, message: `${rowPrefix}: role \"${roleNameValue}\" was not found.` });
            continue;
          }
        } else {
          failures.push({ rowNumber, message: `${rowPrefix}: role is required.` });
          continue;
        }

        const departmentIdValue = getImportValue(normalizedRow, ["Department Id", "Department ID", "department_id"]);
        const departmentNameValue = getImportValue(normalizedRow, ["Department Name", "Department", "department_name"]);
        let resolvedDepartmentId: number | null = null;
        if (departmentIdValue) {
          const parsedDepartmentId = Number(departmentIdValue);
          if (Number.isFinite(parsedDepartmentId) && parsedDepartmentId > 0) {
            resolvedDepartmentId = parsedDepartmentId;
          } else {
            failures.push({ rowNumber, message: `${rowPrefix}: department id must be numeric.` });
            continue;
          }
        } else if (departmentNameValue) {
          resolvedDepartmentId = departmentLookupByName.get(normalizeImportKey(departmentNameValue)) || null;
          if (!resolvedDepartmentId) {
            failures.push({ rowNumber, message: `${rowPrefix}: department \"${departmentNameValue}\" was not found.` });
            continue;
          }
        }

        const designationIdValue = getImportValue(normalizedRow, ["Designation Id", "Designation ID", "designation_id"]);
        const designationNameValue = getImportValue(normalizedRow, ["Designation Name", "Designation", "designation_name"]);
        let resolvedDesignationId: number | null = null;
        if (designationIdValue) {
          const parsedDesignationId = Number(designationIdValue);
          if (Number.isFinite(parsedDesignationId) && parsedDesignationId > 0) {
            resolvedDesignationId = parsedDesignationId;
          } else {
            failures.push({ rowNumber, message: `${rowPrefix}: designation id must be numeric.` });
            continue;
          }
        } else if (designationNameValue) {
          if (resolvedDepartmentId) {
            const departmentScopedId = designationLookupByDepartment.get(`${resolvedDepartmentId}::${normalizeImportKey(designationNameValue)}`);
            if (departmentScopedId) {
              resolvedDesignationId = departmentScopedId;
            }
          }
          if (!resolvedDesignationId) {
            const matches = designationLookupByName.get(normalizeImportKey(designationNameValue)) || [];
            if (matches.length === 1) {
              resolvedDesignationId = matches[0];
            } else if (matches.length > 1 && !resolvedDepartmentId) {
              failures.push({ rowNumber, message: `${rowPrefix}: designation \"${designationNameValue}\" is ambiguous. Add department name.` });
              continue;
            } else {
              failures.push({ rowNumber, message: `${rowPrefix}: designation \"${designationNameValue}\" was not found.` });
              continue;
            }
          }
        }

        const emailValue = getImportValue(normalizedRow, ["Email", "Email Address", "email"]);
        const firstNameValue = getImportValue(normalizedRow, ["First Name", "first_name"]);
        const lastNameValue = getImportValue(normalizedRow, ["Last Name", "last_name"]);
        const phoneValue = getImportValue(normalizedRow, ["Phone", "Mobile", "phone"]);
        const emergencyMobileValue = getImportValue(normalizedRow, ["Emergency Mobile", "emergency_mobile"]);
        const genderValue = getImportValue(normalizedRow, ["Gender", "gender"]);
        const maritalStatusValue = getImportValue(normalizedRow, ["Marital Status", "marital_status"]);
        const dateOfBirthValue = normalizeImportDate(getImportValue(normalizedRow, ["Date Of Birth", "DOB", "date_of_birth"]));
        const joinDateValue = normalizeImportDate(getImportValue(normalizedRow, ["Joining Date", "Join Date", "join_date"]));
        const drivingLicenseValue = getImportValue(normalizedRow, ["Driving License", "driving_license"]);
        const epfNoValue = getImportValue(normalizedRow, ["EPF No", "epf_no"]);
        const currentAddressValue = getImportValue(normalizedRow, ["Current Address", "current_address"]);
        const permanentAddressValue = getImportValue(normalizedRow, ["Permanent Address", "permanent_address"]);
        const qualificationValue = getImportValue(normalizedRow, ["Qualification", "qualification"]);
        const experienceValue = getImportValue(normalizedRow, ["Experience", "experience"]);
        const bankAccountNameValue = getImportValue(normalizedRow, ["Bank Account Name", "Account Holder Name", "bank_account_name"]);
        const bankAccountNoValue = getImportValue(normalizedRow, ["Bank Account Number", "Account Number", "bank_account_no"]);
        const bankNameValue = getImportValue(normalizedRow, ["Bank Name", "bank_name"]);
        const bankBranchValue = getImportValue(normalizedRow, ["Bank Branch", "Branch Name", "bank_branch"]);
        const ifscCodeValue = getImportValue(normalizedRow, ["IFSC Code", "ifsc_code"]);
        const bankMobileValue = getImportValue(normalizedRow, ["Bank Contact Mobile", "Bank Mobile", "bank_mobile_no"]);
        const basicSalaryValue = normalizeImportAmount(getImportValue(normalizedRow, ["Basic Salary", "basic_salary"]));
        const allowanceValue = normalizeImportAmount(getImportValue(normalizedRow, ["Allowance", "allowance"]));
        const deductionValue = normalizeImportAmount(getImportValue(normalizedRow, ["Deduction", "deduction"]));
        const contractTypeValue = getImportValue(normalizedRow, ["Contract Type", "contract_type"]);
        const locationValue = getImportValue(normalizedRow, ["Location", "location"]);
        const facebookUrlValue = getImportValue(normalizedRow, ["Facebook URL", "facebook_url"]);
        const twitterUrlValue = getImportValue(normalizedRow, ["Twitter URL", "twitter_url"]);
        const linkedinUrlValue = getImportValue(normalizedRow, ["LinkedIn URL", "linkedin_url"]);
        const instagramUrlValue = getImportValue(normalizedRow, ["Instagram URL", "instagram_url"]);
        const showPublicValue = parseImportBoolean(getImportValue(normalizedRow, ["Show Public", "show_public"]));

        const rowErrors: string[] = [];
        if (!firstNameValue) rowErrors.push("first name is required");
        if (!emailValue) rowErrors.push("email is required");
        if (!joinDateValue) rowErrors.push("joining date is required");
        if (!bankAccountNameValue) rowErrors.push("bank account name is required");
        if (!bankAccountNoValue) rowErrors.push("bank account number is required");
        if (!bankNameValue) rowErrors.push("bank name is required");
        if (!bankBranchValue) rowErrors.push("bank branch is required");
        if (!basicSalaryValue) rowErrors.push("basic salary is required");
        if (!contractTypeValue) {
          rowErrors.push("contract type is required");
        } else if (!["permanent", "contract"].includes(contractTypeValue.toLowerCase())) {
          rowErrors.push("contract type must be Permanent or Contract");
        }
        if (bankAccountNoValue && !/^\d+$/.test(bankAccountNoValue)) rowErrors.push("bank account number must contain digits only");
        if (bankAccountNoValue && (bankAccountNoValue.length < 9 || bankAccountNoValue.length > 18)) rowErrors.push("bank account number must contain 9 to 18 digits");
        if (bankAccountNoValue && /^(\d)\1+$/.test(bankAccountNoValue)) rowErrors.push("bank account number cannot contain all repeated digits");
        if (ifscCodeValue && !/^[A-Z]{4}0\d{6}$/.test(ifscCodeValue.toUpperCase())) rowErrors.push("ifsc code must be valid");
        if (basicSalaryValue && (!Number.isFinite(Number(basicSalaryValue)) || Number(basicSalaryValue) <= 0)) rowErrors.push("basic salary must be greater than 0");
        if (phoneValue && !validateMobile(phoneValue)) rowErrors.push("phone number must contain digits only and be at most 12 digits");
        if (emergencyMobileValue && !validateMobile(emergencyMobileValue)) rowErrors.push("emergency mobile must contain digits only and be at most 12 digits");
        if (genderValue && !["male", "female", "other"].includes(genderValue.toLowerCase())) rowErrors.push("gender must be Male, Female, or Other");
        if (maritalStatusValue && !["single", "married"].includes(maritalStatusValue.toLowerCase())) rowErrors.push("marital status must be Single or Married");
        if (facebookUrlValue && !validateOptionalUrl(facebookUrlValue)) rowErrors.push("facebook url must be a valid URL");
        if (twitterUrlValue && !validateOptionalUrl(twitterUrlValue)) rowErrors.push("twitter url must be a valid URL");
        if (linkedinUrlValue && !validateOptionalUrl(linkedinUrlValue)) rowErrors.push("linkedin url must be a valid URL");
        if (instagramUrlValue && !validateOptionalUrl(instagramUrlValue)) rowErrors.push("instagram url must be a valid URL");

        if (rowErrors.length > 0) {
          failures.push({ rowNumber, message: `${rowPrefix}: ${rowErrors.join(", ")}.` });
          continue;
        }

        const payload = {
          staff_no: staffNo,
          role: resolvedRoleId,
          department: resolvedDepartmentId,
          designation: resolvedDesignationId,
          first_name: firstNameValue,
          last_name: lastNameValue,
          fathers_name: getImportValue(normalizedRow, ["Father Name", "Fathers Name", "fathers_name"]),
          mothers_name: getImportValue(normalizedRow, ["Mother Name", "Mothers Name", "mothers_name"]),
          email: emailValue,
          phone: phoneValue,
          emergency_mobile: emergencyMobileValue,
          gender: ["male", "female", "other"].includes(genderValue.toLowerCase()) ? genderValue.toLowerCase() : "",
          marital_status: ["single", "married"].includes(maritalStatusValue.toLowerCase()) ? maritalStatusValue.toLowerCase() : "",
          date_of_birth: dateOfBirthValue || null,
          join_date: joinDateValue,
          driving_license: drivingLicenseValue,
          epf_no: epfNoValue,
          current_address: currentAddressValue,
          permanent_address: permanentAddressValue,
          qualification: qualificationValue,
          experience: experienceValue,
          bank_account_name: bankAccountNameValue,
          bank_account_no: bankAccountNoValue,
          bank_name: bankNameValue,
          bank_branch: bankBranchValue,
          bank_mobile_no: bankMobileValue,
          custom_field: {
            ifsc_code: ifscCodeValue.toUpperCase(),
            allowance: allowanceValue || "0.00",
            deduction: deductionValue || "0.00",
          },
          basic_salary: basicSalaryValue,
          contract_type: contractTypeValue.toLowerCase(),
          location: locationValue,
          facebook_url: facebookUrlValue,
          twitter_url: twitterUrlValue,
          linkedin_url: linkedinUrlValue,
          instagram_url: instagramUrlValue,
          show_public: showPublicValue ?? false,
          status: "active",
          other_document: [],
        };

        try {
          await apiPost("/api/v1/hr/staff/", payload);
          importedCount += 1;
          if (!staffNoInput) {
            nextGeneratedStaffNo = incrementStaffNo(nextGeneratedStaffNo || staffNo);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unable to import staff row.";
          failures.push({ rowNumber, message: `${rowPrefix}: ${message}` });
        }
      }

      if (importedCount === 0) {
        setError(failures[0]?.message || "Unable to import staff file.");
        return;
      }

      if (failures.length > 0) {
        setSuccess(`Imported ${importedCount} staff member${importedCount === 1 ? "" : "s"}.`);
        setError(`${failures.length} row${failures.length === 1 ? "" : "s"} failed. First issue: ${failures[0].message}`);
        return;
      }

      setSuccess(`Imported ${importedCount} staff member${importedCount === 1 ? "" : "s"} successfully.`);
    } finally {
      setImportingStaff(false);
    }
  };

  const load = async () => {
    try {
      setError("");
      setDropdownErrors({});
      setRolesLoading(true);
      setRolesError("");

      const [formOptionsResult, nextStaffNoResult, payrollSettingsResult] = await Promise.allSettled([
        apiGet<{ data?: { roles?: Role[]; departments?: Department[]; designations?: Designation[] } }>("/api/v1/hr/staff/form-options/"),
        apiGet<{ staff_no?: string }>("/api/v1/hr/staff/next-staff-no/"),
        apiGet<PayrollSettings>("/api/v1/hr/payroll/settings/"),
      ]);

      if (formOptionsResult.status === "fulfilled") {
        const options = formOptionsResult.value?.data || {};
        const roleOptions = Array.isArray(options.roles) ? options.roles : [];
        const departmentOptions = Array.isArray(options.departments) ? options.departments : [];
        const designationOptions = Array.isArray(options.designations) ? options.designations : [];
        setRoles(roleOptions.map((role) => ({ id: role.id, name: role.name })));
        setDepartments(departmentOptions);
        setDesignations(designationOptions);
        setRolesError("");
      } else {
        setRoles([]);
        setDepartments([]);
        setDesignations([]);
        setRolesError("Failed to load roles");
        setDropdownErrors((prev) => ({
          ...prev,
          roles: "Failed to load roles",
          departments: "Failed to load departments",
          designations: "Failed to load designations",
        }));
      }
      if (!editParam && nextStaffNoResult.status === "fulfilled") {
        const nextValue = (nextStaffNoResult.value.staff_no || "").trim();
        setStaffNo((prev) => prev || nextValue);
      }
      if (!editParam && payrollSettingsResult.status === "fulfilled") {
        const settings = payrollSettingsResult.value;
        setAllowance((prev) => (prev && Number(prev) > 0 ? prev : String(settings.default_allowance || "0.00")));
        setDeduction((prev) => (prev && Number(prev) > 0 ? prev : String(settings.default_deduction || "0.00")));
        setStaffPayrollDefaults({
          allowance_items: Array.isArray(settings.default_allowance_items) ? settings.default_allowance_items : [],
          deduction_items: Array.isArray(settings.default_deduction_items) ? settings.default_deduction_items : [],
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load staff.";
      setError("Unable to load staff.");
      if (message && message !== "Unable to load staff.") {
        setError(message);
      }
    } finally {
      setRolesLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (editParam) return;
    try {
      const raw = localStorage.getItem("hr_staff_form_draft");
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<Record<string, string | boolean>>;
      setStaffNo(String(draft.staffNo || ""));
      setRoleId(String(draft.roleId || ""));
      setDepartmentId(String(draft.departmentId || ""));
      setDesignationId(String(draft.designationId || ""));
      setFirstName(String(draft.firstName || ""));
      setLastName(String(draft.lastName || ""));
      setEmail(String(draft.email || ""));
      setPhone(String(draft.phone || ""));
      setJoinDate(String(draft.joinDate || joinDate));
      setDateOfBirth(String(draft.dateOfBirth || ""));
      setBasicSalary(String(draft.basicSalary || "0.00"));
      setBankAccountName(String(draft.bankAccountName || ""));
      setBankAccountNo(String(draft.bankAccountNo || ""));
      setBankName(String(draft.bankName || ""));
      setBankBranch(String(draft.bankBranch || ""));
      setIfscCode(String(draft.ifscCode || ""));
      setBankMobileNo(String(draft.bankMobileNo || ""));
      setShowPublic(Boolean(draft.showPublic));
    } catch {
      // ignore malformed draft
    }
  }, [editParam]);

  useEffect(() => {
    if (editParam || editingStaffId) return;
    try {
      localStorage.setItem(
        "hr_staff_form_draft",
        JSON.stringify({
          staffNo,
          roleId,
          departmentId,
          designationId,
          firstName,
          lastName,
          email,
          phone,
          joinDate,
          dateOfBirth,
          basicSalary,
          bankAccountName,
          bankAccountNo,
          bankName,
          bankBranch,
          ifscCode,
          bankMobileNo,
          showPublic,
        })
      );
    } catch {
      // ignore storage errors
    }
  }, [
    editParam,
    editingStaffId,
    staffNo,
    roleId,
    departmentId,
    designationId,
    firstName,
    lastName,
    email,
    phone,
    joinDate,
    dateOfBirth,
    basicSalary,
    bankAccountName,
    bankAccountNo,
    bankName,
    bankBranch,
    ifscCode,
    bankMobileNo,
    showPublic,
  ]);

  useEffect(() => {
    if (!editParam) {
      setEditingStaffId(null);
      return;
    }

    try {
      localStorage.removeItem("hr_staff_form_draft");
    } catch {
      // ignore storage access issues
    }

    const parsedId = Number(editParam);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      setError("Invalid staff id for editing.");
      return;
    }

    const loadEditStaff = async () => {
      try {
        setError("");
        setSuccess("");
        const row = await apiGet<Staff>(`/api/v1/hr/staff/${parsedId}/`);
        setEditingStaffId(row.id);
        setActiveTab("basic");
        setStaffNo(row.staff_no || "");
        setRoleId(row.role ? String(row.role) : "");
        setDepartmentId(row.department ? String(row.department) : "");
        setDesignationId(row.designation ? String(row.designation) : "");
        setFirstName(row.first_name || "");
        setLastName(row.last_name || "");
        setFathersName(row.fathers_name || "");
        setMothersName(row.mothers_name || "");
        setEmail(row.email || "");
        setGender((row.gender || "") as "" | "male" | "female" | "other");
        setDateOfBirth(row.date_of_birth || "");
        setJoinDate(row.join_date || new Date().toISOString().slice(0, 10));
        setPhone(row.phone || "");
        setMaritalStatus((row.marital_status || "") as "" | "single" | "married");
        setEmergencyMobile(row.emergency_mobile || "");
        setDrivingLicense(row.driving_license || "");
        setStaffPhoto(row.staff_photo || "");
        setStaffPhotoFile(null);
        setStaffPhotoPreview(/^https?:\/\//i.test(row.staff_photo || "") ? (row.staff_photo || "") : "");
        setShowPublic(Boolean(row.show_public));
        setCurrentAddress(row.current_address || "");
        setPermanentAddress(row.permanent_address || "");
        setQualification(row.qualification || "");
        setExperience(row.experience || "");
        setEpfNo(row.epf_no || "");
        setBasicSalary(String(row.basic_salary || "0.00"));
        const custom = (row as unknown as {
          custom_field?: {
            allowance?: string | number;
            deduction?: string | number;
            ifsc_code?: string;
            payroll_defaults?: {
              allowance_items?: PayrollComponentItem[];
              deduction_items?: PayrollComponentItem[];
            };
          };
        }).custom_field || {};
        setAllowance(String(custom.allowance || "0.00"));
        setDeduction(String(custom.deduction || "0.00"));
        setStaffPayrollDefaults({
          allowance_items: Array.isArray(custom.payroll_defaults?.allowance_items) ? custom.payroll_defaults?.allowance_items || [] : [],
          deduction_items: Array.isArray(custom.payroll_defaults?.deduction_items) ? custom.payroll_defaults?.deduction_items || [] : [],
        });
        setContractType((row.contract_type || "") as "" | "permanent" | "contract");
        setLocation(row.location || "");
        setBankAccountName(row.bank_account_name || "");
        setBankAccountNo(row.bank_account_no || "");
        setBankName(row.bank_name || "");
        setBankBranch(row.bank_branch || "");
        setBankMobileNo(row.bank_mobile_no || "");
        setIfscCode(String((row as unknown as { custom_field?: { ifsc_code?: string } }).custom_field?.ifsc_code || ""));
        setIfscLookupError("");
        setIfscAutoFilled(false);
        setFacebookUrl(row.facebook_url || "");
        setTwitterUrl(row.twitter_url || "");
        setLinkedinUrl(row.linkedin_url || "");
        setInstagramUrl(row.instagram_url || "");
        setResume(row.resume || "");
        setJoiningLetter(row.joining_letter || "");
        setTenthCertificate(row.tenth_certificate || "");
        setEleventhCertificate(row.eleventh_certificate || "");
        setAadharCard(row.aadhar_card || "");
        setDrivingLicenseDoc(row.driving_license_doc || "");
        setOtherDocuments(
          parseOtherDocuments(row.other_document).map((name) => ({
            id: makeOtherDocumentId(),
            name,
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load staff details.");
      }
    };

    void loadEditStaff();
  }, [editParam]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const submitErrors = getSubmitFieldErrors();
    setFieldErrors(submitErrors);
    if (Object.keys(submitErrors).length > 0) {
      setError("");
      setToast("");
      const firstField = Object.keys(submitErrors)[0] as keyof typeof fieldErrors;
      scrollToField(firstField);
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setToast("");
      const payload = {
        staff_no: staffNo.trim(),
        role: roleId ? Number(roleId) : null,
        department: departmentId ? Number(departmentId) : null,
        designation: designationId ? Number(designationId) : null,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        fathers_name: fathersName.trim(),
        mothers_name: mothersName.trim(),
        email: email.trim(),
        gender,
        date_of_birth: dateOfBirth || null,
        join_date: joinDate,
        phone: phone.trim(),
        marital_status: maritalStatus,
        emergency_mobile: emergencyMobile.trim(),
        driving_license: drivingLicense.trim(),
        staff_photo: staffPhotoFile ? staffPhotoFile.name : undefined,
        show_public: showPublic,
        current_address: currentAddress.trim(),
        permanent_address: permanentAddress.trim(),
        qualification: qualification.trim(),
        experience: experience.trim(),
        epf_no: epfNo.trim(),
        basic_salary: basicSalary || "0.00",
        contract_type: contractType,
        location: location.trim(),
        bank_account_name: bankAccountName.trim(),
        bank_account_no: bankAccountNo.trim(),
        bank_name: bankName.trim(),
        bank_branch: bankBranch.trim(),
        bank_mobile_no: bankMobileNo.trim(),
        custom_field: {
          ifsc_code: ifscCode.trim().toUpperCase(),
          allowance: allowance.trim() || "0.00",
          deduction: deduction.trim() || "0.00",
          payroll_defaults: {
            allowance_items: staffPayrollDefaults.allowance_items,
            deduction_items: staffPayrollDefaults.deduction_items,
          },
        },
        facebook_url: facebookUrl.trim(),
        twitter_url: twitterUrl.trim(),
        linkedin_url: linkedinUrl.trim(),
        instagram_url: instagramUrl.trim(),
        resume: resume.trim(),
        joining_letter: joiningLetter.trim(),
        tenth_certificate: tenthCertificate.trim(),
        eleventh_certificate: eleventhCertificate.trim(),
        aadhar_card: aadharCard.trim(),
        driving_license_doc: drivingLicenseDoc.trim(),
        other_document: otherDocuments.map((doc) => doc.name.trim()).filter((name) => name.length > 0),
        status: "active",
      };

      const hasUploadFiles = Boolean(
        staffPhotoFile ||
        resumeFile ||
        joiningLetterFile ||
        tenthCertFile ||
        eleventhCertFile ||
        aadharFile ||
        drivingLicenseFile ||
        otherDocuments.some((doc) => Boolean(doc.file))
      );

      const requestPayload: typeof payload | FormData = hasUploadFiles
        ? (() => {
            const formData = new FormData();
            Object.entries(payload).forEach(([key, value]) => {
              if (value === null || value === undefined) return;
              if (key === "custom_field") {
                formData.append(key, JSON.stringify(value));
                return;
              }
              if (Array.isArray(value)) {
                value.forEach((item) => formData.append(key, String(item)));
                return;
              }
              formData.append(key, String(value));
            });

            if (staffPhotoFile) formData.set("staff_photo", staffPhotoFile, staffPhotoFile.name);
            if (resumeFile) formData.set("resume", resumeFile, resumeFile.name);
            if (joiningLetterFile) formData.set("joining_letter", joiningLetterFile, joiningLetterFile.name);
            if (tenthCertFile) formData.set("tenth_certificate", tenthCertFile, tenthCertFile.name);
            if (eleventhCertFile) formData.set("eleventh_certificate", eleventhCertFile, eleventhCertFile.name);
            if (aadharFile) formData.set("aadhar_card", aadharFile, aadharFile.name);
            if (drivingLicenseFile) formData.set("driving_license_doc", drivingLicenseFile, drivingLicenseFile.name);

            return formData;
          })()
        : payload;

      if (editingStaffId) {
        await apiPatch(`/api/v1/hr/staff/${editingStaffId}/`, requestPayload);
        try {
          localStorage.removeItem("hr_staff_form_draft");
        } catch {
          // ignore storage errors
        }
        setSuccess("Staff has been updated successfully.");
        router.push("/hr/staff-directory?updated=1");
        return;
      }

      await apiPost("/api/v1/hr/staff/", requestPayload);

      try {
        localStorage.removeItem("hr_staff_form_draft");
      } catch {
        // ignore storage errors
      }
      resetForm();
      setSuccess("Staff has been added successfully.");
      await load();
      router.push("/hr/staff-directory?created=1");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save staff.";
      const details = (err as { details?: unknown } | null)?.details;
      const mappedField = applyApiDetailsToField(details) || applyApiErrorToField(message);
      if (mappedField) {
        scrollToField(mappedField);
      }
      setError(message);
      setToast(message);
    } finally {
      setSaving(false);
    }
  };

  const tabs: Array<{ key: "basic" | "payroll" | "bank" | "social" | "document"; label: string }> = [
    { key: "basic", label: "Basic Info" },
    { key: "payroll", label: "Payroll Details" },
    { key: "bank", label: "Bank Info Details" },
    { key: "social", label: "Social Links Details" },
    { key: "document", label: "Document Info" },
  ];

  const sectionGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 } as const;

  return (
    <div className="legacy-panel">
      {breadcrumb(editingStaffId ? "Edit Staff" : "Add New Staff")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>{editingStaffId ? "Edit Staff Information" : "Staff Information"}</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {!editingStaffId ? (
                <button type="button" style={buttonStyle("#7c3aed")} onClick={openImportStaffPopup} disabled={importingStaff || saving || rolesLoading}>
                  {importingStaff ? "Importing..." : "Import Staff"}
                </button>
              ) : null}
              <button type="submit" form="staff-form" style={buttonStyle()} disabled={saving || rolesLoading || importingStaff}>
                {saving ? "Saving..." : editingStaffId ? "Update Staff" : "Save Staff"}
              </button>
              <button type="button" style={buttonStyle("#6b7280")} onClick={resetForm} disabled={saving || importingStaff}>Reset Form</button>
            </div>
          </div>
          {!editingStaffId ? (
            <p style={{ marginTop: 0, marginBottom: 12, fontSize: 12, color: "var(--text-muted)" }}>
              Import uses a sample Excel template. Fill one row per staff member, then upload the file from the popup.
            </p>
          ) : null}

          {!editingStaffId && showImportStaffPopup ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="staff-import-popup-title"
              onClick={closeImportStaffPopup}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 80,
                background: "rgba(15, 23, 42, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <div
                onClick={(event) => event.stopPropagation()}
                style={{
                  width: "min(560px, 100%)",
                  background: "#fff",
                  borderRadius: 16,
                  border: "1px solid rgba(148, 163, 184, 0.25)",
                  boxShadow: "0 24px 80px rgba(15, 23, 42, 0.24)",
                  padding: 20,
                  display: "grid",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <h3 id="staff-import-popup-title" style={{ margin: 0, fontSize: 20 }}>Import Staff</h3>
                    <p style={{ margin: "6px 0 0 0", color: "var(--text-muted)", fontSize: 13 }}>
                      Download the sample Excel first, or browse a completed file to bulk add staff members.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeImportStaffPopup}
                    disabled={importingStaff}
                    style={{
                      border: "1px solid var(--line)",
                      background: "transparent",
                      color: "var(--text)",
                      borderRadius: 999,
                      width: 34,
                      height: 34,
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  <button type="button" style={buttonStyle("#0ea5e9")} onClick={handleDownloadStaffTemplate} disabled={importingStaff}>
                    Download Sample Excel
                  </button>
                  <button type="button" style={buttonStyle("#7c3aed")} onClick={() => importStaffRef.current?.click()} disabled={importingStaff}>
                    Browse Documents
                  </button>
                </div>

                <input
                  ref={importStaffRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) {
                      return;
                    }
                    setShowImportStaffPopup(false);
                    void handleImportStaffFile(file).catch(() => {
                      setError("Unable to import staff file.");
                    });
                    e.target.value = "";
                  }}
                />

                <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>Template tips</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                    Keep one staff per row. Use role and department names from the system, or leave staff number blank to auto-generate it.
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--line)", paddingBottom: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  height: 34,
                  padding: "0 14px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: activeTab === tab.key ? "#e6ebff" : "var(--surface)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontSize: 12,
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form id="staff-form" onSubmit={submit} style={{ display: "grid", gap: 12 }}>
            {activeTab === "basic" && (
              <div style={{ display: "grid", gap: 16 }}>
                {/* Basic Information: system id + personal + contact + family + photo */}
                <section style={{ ...boxStyle(), padding: 12 }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: 14, textTransform: "uppercase", color: "var(--text-muted)" }}>Basic Information</h4>
                  <div style={sectionGrid}>
                    {/* 1) System Identifier */}
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Staff No *</span><input value={staffNo} onChange={(e) => { setStaffNo(e.target.value); clearFieldError("staff_no"); }} style={{ ...fieldStyle(), background: "#f8fafc", borderColor: fieldErrors.staff_no ? "#dc2626" : "var(--line)" }} readOnly title="Auto generated" />{fieldErrors.staff_no ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.staff_no}</span> : null}</label>
                    <div />
                    <div />
                    <div />

                    {/* 2) Personal Details */}
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>First Name *</span><input id="staff-field-first_name" value={firstName} onChange={(e) => { setFirstName(e.target.value); clearFieldError("first_name"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.first_name ? "#dc2626" : "var(--line)" }} />{fieldErrors.first_name ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.first_name}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Last Name</span><input id="staff-field-last_name" value={lastName} onChange={(e) => { setLastName(e.target.value); clearFieldError("last_name"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.last_name ? "#dc2626" : "var(--line)" }} />{fieldErrors.last_name ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.last_name}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Gender</span><select value={gender} onChange={(e) => setGender(e.target.value as "" | "male" | "female" | "other")} style={fieldStyle()}><option value="">Gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Date Of Birth</span><input type="date" value={dateOfBirth} onChange={(e) => { setDateOfBirth(e.target.value); clearFieldError("date_of_birth"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.date_of_birth ? "#dc2626" : "var(--line)" }} />{fieldErrors.date_of_birth ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.date_of_birth}</span> : null}</label>

                    {/* 3) Contact Details */}
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Email *</span><input type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.email ? "#dc2626" : "var(--line)" }} />{fieldErrors.email ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.email}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Mobile Number *</span><input id="staff-field-phone" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 12)); clearFieldError("phone"); }} maxLength={12} style={{ ...fieldStyle(), borderColor: fieldErrors.phone ? "#dc2626" : "var(--line)" }} />{fieldErrors.phone ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.phone}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Emergency Mobile</span><input value={emergencyMobile} onChange={(e) => { setEmergencyMobile(e.target.value.replace(/\D/g, "").slice(0, 12)); clearFieldError("emergency_mobile"); }} maxLength={12} style={{ ...fieldStyle(), borderColor: fieldErrors.emergency_mobile ? "#dc2626" : "var(--line)" }} />{fieldErrors.emergency_mobile ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.emergency_mobile}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Marital Status</span><select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value as "" | "single" | "married")} style={fieldStyle()}><option value="">Marital Status</option><option value="single">Single</option><option value="married">Married</option></select></label>

                    {/* 5) Family Details */}
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Father Name</span><input value={fathersName} onChange={(e) => setFathersName(e.target.value)} style={fieldStyle()} /></label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Mother Name</span><input value={mothersName} onChange={(e) => setMothersName(e.target.value)} style={fieldStyle()} /></label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Driving License</span><input value={drivingLicense} onChange={(e) => setDrivingLicense(e.target.value)} style={fieldStyle()} /></label>
                    <div style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Show As Expert Staff</span>
                      <div style={{ display: "flex", gap: 16, alignItems: "center", height: 36 }}>
                        <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="radio" checked={showPublic} onChange={() => setShowPublic(true)} /> Yes</label>
                        <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="radio" checked={!showPublic} onChange={() => setShowPublic(false)} /> No</label>
                      </div>
                    </div>

                    {/* 7) File Upload */}
                    <div style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Staff Photo *</span>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 86px", gap: 6 }}>
                        <input id="staff-field-staff_photo" readOnly value={staffPhoto || "Staff Photo"} style={{ ...fieldStyle(), borderColor: fieldErrors.staff_photo ? "#dc2626" : "var(--line)" }} />
                        <button type="button" style={buttonStyle("#7c3aed")} onClick={() => staffPhotoRef.current?.click()}>Browse</button>
                        <input
                          ref={staffPhotoRef}
                          type="file"
                          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) {
                              setStaffPhoto("");
                              setStaffPhotoFile(null);
                              setStaffPhotoPreview("");
                              clearFieldError("staff_photo");
                              return;
                            }
                            const isAllowedType = ["image/jpeg", "image/png"].includes(file.type);
                            if (!isAllowedType) {
                              const message = "Only JPG and PNG files are allowed.";
                              setFieldErrors((prev) => ({ ...prev, staff_photo: message }));
                              setError(message);
                              setToast(message);
                              e.target.value = "";
                              return;
                            }
                            if (file.size > 2 * 1024 * 1024) {
                              const message = "File size must be 2MB or less.";
                              setFieldErrors((prev) => ({ ...prev, staff_photo: message }));
                              setError(message);
                              setToast(message);
                              e.target.value = "";
                              return;
                            }
                            setStaffPhoto(file.name);
                            setStaffPhotoFile(file);
                            setStaffPhotoPreview(URL.createObjectURL(file));
                            clearFieldError("staff_photo");
                          }}
                        />
                      </div>
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted formats: JPG, JPEG, PNG (max 2MB).</span>
                      {staffPhotoPreview ? <img src={staffPhotoPreview} alt="Staff photo preview" style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} /> : null}
                      {fieldErrors.staff_photo ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.staff_photo}</span> : null}
                    </div>
                  </div>
                </section>

                {/* Job Details: grouped organizational fields in one block */}
                <section style={{ ...boxStyle(), padding: 12 }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: 14, textTransform: "uppercase", color: "var(--text-muted)" }}>Job Details</h4>
                  <div style={sectionGrid}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Role *</span>
                      <select value={roleId} onChange={(e) => { setRoleId(e.target.value); clearFieldError("role"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.role ? "#dc2626" : "var(--line)" }} disabled={rolesLoading}>
                        <option value="">{rolesLoading ? "Loading roles..." : "Role *"}</option>
                        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      {rolesError ? <span style={{ color: "#dc2626", fontSize: 12 }}>{rolesError}</span> : null}
                      {fieldErrors.role ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.role}</span> : null}
                    </label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Department</span><select value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setDesignationId(""); }} style={fieldStyle()}><option value="">Department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>{dropdownErrors.departments ? <span style={{ color: "#dc2626", fontSize: 12 }}>{dropdownErrors.departments}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Designation</span><select value={designationId} onChange={(e) => setDesignationId(e.target.value)} style={fieldStyle()}><option value="">Designation</option>{filteredDesignations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>{dropdownErrors.designations ? <span style={{ color: "#dc2626", fontSize: 12 }}>{dropdownErrors.designations}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Date Of Joining *</span><input type="date" value={joinDate} onChange={(e) => { setJoinDate(e.target.value); clearFieldError("join_date"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.join_date ? "#dc2626" : "var(--line)" }} />{fieldErrors.join_date ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.join_date}</span> : null}</label>
                  </div>
                </section>

                {/* Additional Information: long-text details grouped at end */}
                <section style={{ ...boxStyle(), padding: 12 }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: 14, textTransform: "uppercase", color: "var(--text-muted)" }}>Additional Information</h4>
                  <div style={sectionGrid}>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Current Address *</span><textarea id="staff-field-current_address" value={currentAddress} onChange={(e) => { setCurrentAddress(e.target.value); clearFieldError("current_address"); }} style={{ width: "100%", minHeight: 84, border: `1px solid ${fieldErrors.current_address ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: 10 }} />{fieldErrors.current_address ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.current_address}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Permanent Address *</span><textarea id="staff-field-permanent_address" value={permanentAddress} onChange={(e) => { setPermanentAddress(e.target.value); clearFieldError("permanent_address"); }} style={{ width: "100%", minHeight: 84, border: `1px solid ${fieldErrors.permanent_address ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: 10 }} />{fieldErrors.permanent_address ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.permanent_address}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Qualifications</span><textarea value={qualification} onChange={(e) => setQualification(e.target.value)} style={{ width: "100%", minHeight: 84, border: "1px solid var(--line)", borderRadius: 8, padding: 10 }} /></label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Experience</span><textarea value={experience} onChange={(e) => setExperience(e.target.value)} style={{ width: "100%", minHeight: 84, border: "1px solid var(--line)", borderRadius: 8, padding: 10 }} /></label>
                  </div>
                </section>
              </div>
            )}

            {activeTab === "payroll" && (
              <div style={sectionGrid}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>EPF Number</span>
                  <input id="staff-field-epf_no" value={epfNo} onChange={(e) => { setEpfNo(e.target.value); clearFieldError("epf_no"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.epf_no ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.epf_no ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.epf_no}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Basic Salary *</span>
                  <input id="staff-field-basic_salary" type="number" min="0" step="0.01" value={basicSalary} onChange={(e) => { setBasicSalary(e.target.value); clearFieldError("basic_salary"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.basic_salary ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.basic_salary ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.basic_salary}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Allowances</span>
                  <input type="number" min="0" step="0.01" value={allowance} onChange={(e) => setAllowance(e.target.value)} style={fieldStyle()} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Deductions</span>
                  <input type="number" min="0" step="0.01" value={deduction} onChange={(e) => setDeduction(e.target.value)} style={fieldStyle()} />
                </label>
                <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--text-muted)" }}>
                  Payroll defaults linked: {staffPayrollDefaults.allowance_items.length} allowance components and {staffPayrollDefaults.deduction_items.length} deduction components.
                </div>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Net Salary (Preview)</span>
                  <input readOnly value={salaryNetPreview} style={{ ...fieldStyle(), background: "#f8fafc" }} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Contract Type *</span>
                  <select id="staff-field-contract_type" value={contractType} onChange={(e) => { setContractType(e.target.value as "" | "permanent" | "contract"); clearFieldError("contract_type"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.contract_type ? "#dc2626" : "var(--line)" }}><option value="">Contract Type</option><option value="permanent">Permanent</option><option value="contract">Contract</option></select>
                  {fieldErrors.contract_type ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.contract_type}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Location</span>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} style={fieldStyle()} />
                </label>
              </div>
            )}

            {activeTab === "bank" && (
              <div style={sectionGrid}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Account Holder Name *</span>
                  <input id="staff-field-bank_account_name" value={bankAccountName} onChange={(e) => { setBankAccountName(e.target.value); clearFieldError("bank_account_name"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.bank_account_name ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.bank_account_name ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.bank_account_name}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Account Number *</span>
                  <input
                    id="staff-field-bank_account_no"
                    value={bankAccountNo}
                    onChange={(e) => {
                      const rawValue = e.target.value;
                      if (/\D/.test(rawValue)) {
                        setFieldErrors((prev) => ({ ...prev, bank_account_no: "Only numbers are allowed" }));
                      } else {
                        clearFieldError("bank_account_no");
                      }
                      setBankAccountNo(rawValue.replace(/\D/g, "").slice(0, 18));
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={18}
                    style={{ ...fieldStyle(), borderColor: fieldErrors.bank_account_no ? "#dc2626" : "var(--line)" }}
                  />
                  {fieldErrors.bank_account_no ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.bank_account_no}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Bank Name *</span>
                  <input id="staff-field-bank_name" value={bankName} onChange={(e) => { setBankName(e.target.value); clearFieldError("bank_name"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.bank_name ? "#dc2626" : "var(--line)", background: ifscAutoFilled ? "#f8fafc" : "#fff" }} disabled={ifscAutoFilled} />
                  {fieldErrors.bank_name ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.bank_name}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Branch Name *</span>
                  <input id="staff-field-bank_branch" value={bankBranch} onChange={(e) => { setBankBranch(e.target.value); clearFieldError("bank_branch"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.bank_branch ? "#dc2626" : "var(--line)", background: ifscAutoFilled ? "#f8fafc" : "#fff" }} disabled={ifscAutoFilled} />
                  {fieldErrors.bank_branch ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.bank_branch}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>IFSC Code *</span>
                  <input
                    id="staff-field-ifsc_code"
                    value={ifscCode}
                    onChange={(e) => {
                      setIfscCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11));
                      setIfscAutoFilled(false);
                      setIfscLookupError("");
                      clearFieldError("ifsc_code");
                    }}
                    placeholder="e.g., SBIN0001234"
                    style={{ ...fieldStyle(), borderColor: fieldErrors.ifsc_code ? "#dc2626" : "var(--line)" }}
                    maxLength={11}
                  />
                  {fieldErrors.ifsc_code ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.ifsc_code}</span> : null}
                  {ifscLookupLoading ? <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Fetching bank details...</span> : null}
                  {ifscLookupError ? <span style={{ color: "#dc2626", fontSize: 12 }}>{ifscLookupError}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Bank Contact Mobile</span>
                  <input value={bankMobileNo} onChange={(e) => { setBankMobileNo(e.target.value.replace(/\D/g, "").slice(0, 12)); clearFieldError("bank_mobile_no"); }} maxLength={12} placeholder="e.g., 9876543210" style={{ ...fieldStyle(), borderColor: fieldErrors.bank_mobile_no ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.bank_mobile_no ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.bank_mobile_no}</span> : null}
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Optional: Bank customer service contact number</span>
                </label>
              </div>
            )}

            {activeTab === "social" && (
              <div style={sectionGrid}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Facebook URL</span>
                  <input id="staff-field-facebook_url" value={facebookUrl} onChange={(e) => { setFacebookUrl(e.target.value); clearFieldError("facebook_url"); }} placeholder="Enter Facebook profile URL" style={{ ...fieldStyle(), borderColor: fieldErrors.facebook_url ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.facebook_url ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.facebook_url}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Twitter URL</span>
                  <input id="staff-field-twitter_url" value={twitterUrl} onChange={(e) => { setTwitterUrl(e.target.value); clearFieldError("twitter_url"); }} placeholder="Enter Twitter profile URL" style={{ ...fieldStyle(), borderColor: fieldErrors.twitter_url ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.twitter_url ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.twitter_url}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>LinkedIn URL</span>
                  <input id="staff-field-linkedin_url" value={linkedinUrl} onChange={(e) => { setLinkedinUrl(e.target.value); clearFieldError("linkedin_url"); }} placeholder="Enter LinkedIn profile URL" style={{ ...fieldStyle(), borderColor: fieldErrors.linkedin_url ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.linkedin_url ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.linkedin_url}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Instagram URL</span>
                  <input id="staff-field-instagram_url" value={instagramUrl} onChange={(e) => { setInstagramUrl(e.target.value); clearFieldError("instagram_url"); }} placeholder="Enter Instagram profile URL" style={{ ...fieldStyle(), borderColor: fieldErrors.instagram_url ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.instagram_url ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.instagram_url}</span> : null}
                </label>
              </div>
            )}

            {activeTab === "document" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Resume</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input readOnly value={resume || "Resume"} style={fieldStyle()} />
                    <button type="button" style={{ ...buttonStyle("#7c3aed"), flexShrink: 0 }} onClick={() => resumeRef.current?.click()}>Browse</button>
                    {resume || resumeFile ? (
                      <button type="button" style={{ ...buttonStyle("#dc2626"), flexShrink: 0, minWidth: 78, background: "#fff", color: "#dc2626" }} onClick={() => { setResume(""); setResumeFile(null); }}>
                        Remove
                      </button>
                    ) : null}
                    <input ref={resumeRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setResumeFile(file); setResume(file.name); } }} />
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted: PDF, DOC, DOCX, JPG, PNG</span>
                  {resumeFile ? <a href={URL.createObjectURL(resumeFile)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7c3aed", textDecoration: "underline" }}>Preview / Download</a> : null}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Joining Letter</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input readOnly value={joiningLetter || "Joining Letter"} style={fieldStyle()} />
                    <button type="button" style={{ ...buttonStyle("#7c3aed"), flexShrink: 0 }} onClick={() => joiningLetterRef.current?.click()}>Browse</button>
                    {joiningLetter || joiningLetterFile ? (
                      <button type="button" style={{ ...buttonStyle("#dc2626"), flexShrink: 0, minWidth: 78, background: "#fff", color: "#dc2626" }} onClick={() => { setJoiningLetter(""); setJoiningLetterFile(null); }}>
                        Remove
                      </button>
                    ) : null}
                    <input ref={joiningLetterRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setJoiningLetterFile(file); setJoiningLetter(file.name); } }} />
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted: PDF, DOC, DOCX, JPG, PNG</span>
                  {joiningLetterFile ? <a href={URL.createObjectURL(joiningLetterFile)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7c3aed", textDecoration: "underline" }}>Preview / Download</a> : null}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>10th Certificate</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input readOnly value={tenthCertificate || "10th Certificate"} style={fieldStyle()} />
                    <button type="button" style={{ ...buttonStyle("#7c3aed"), flexShrink: 0 }} onClick={() => tenthCertRef.current?.click()}>Browse</button>
                    {tenthCertificate || tenthCertFile ? (
                      <button type="button" style={{ ...buttonStyle("#dc2626"), flexShrink: 0, minWidth: 78, background: "#fff", color: "#dc2626" }} onClick={() => { setTenthCertificate(""); setTenthCertFile(null); }}>
                        Remove
                      </button>
                    ) : null}
                    <input ref={tenthCertRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setTenthCertFile(file); setTenthCertificate(file.name); } }} />
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted: PDF, JPG, JPEG, PNG</span>
                  {tenthCertFile ? <a href={URL.createObjectURL(tenthCertFile)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7c3aed", textDecoration: "underline" }}>Preview / Download</a> : null}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>11th/12th Certificate</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input readOnly value={eleventhCertificate || "11th/12th Certificate"} style={fieldStyle()} />
                    <button type="button" style={{ ...buttonStyle("#7c3aed"), flexShrink: 0 }} onClick={() => eleventhCertRef.current?.click()}>Browse</button>
                    {eleventhCertificate || eleventhCertFile ? (
                      <button type="button" style={{ ...buttonStyle("#dc2626"), flexShrink: 0, minWidth: 78, background: "#fff", color: "#dc2626" }} onClick={() => { setEleventhCertificate(""); setEleventhCertFile(null); }}>
                        Remove
                      </button>
                    ) : null}
                    <input ref={eleventhCertRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setEleventhCertFile(file); setEleventhCertificate(file.name); } }} />
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted: PDF, JPG, JPEG, PNG</span>
                  {eleventhCertFile ? <a href={URL.createObjectURL(eleventhCertFile)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7c3aed", textDecoration: "underline" }}>Preview / Download</a> : null}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Aadhar Card</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input readOnly value={aadharCard || "Aadhar Card"} style={fieldStyle()} />
                    <button type="button" style={{ ...buttonStyle("#7c3aed"), flexShrink: 0 }} onClick={() => aadharRef.current?.click()}>Browse</button>
                    {aadharCard || aadharFile ? (
                      <button type="button" style={{ ...buttonStyle("#dc2626"), flexShrink: 0, minWidth: 78, background: "#fff", color: "#dc2626" }} onClick={() => { setAadharCard(""); setAadharFile(null); }}>
                        Remove
                      </button>
                    ) : null}
                    <input ref={aadharRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setAadharFile(file); setAadharCard(file.name); } }} />
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted: PDF, JPG, JPEG, PNG</span>
                  {aadharFile ? <a href={URL.createObjectURL(aadharFile)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7c3aed", textDecoration: "underline" }}>Preview / Download</a> : null}
                </div>

                <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, alignItems: "start" }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Driving License</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input readOnly value={drivingLicenseDoc || "Driving License"} style={fieldStyle()} />
                      <button type="button" style={{ ...buttonStyle("#7c3aed"), flexShrink: 0 }} onClick={() => drivingLicenseRef.current?.click()}>Browse</button>
                      {drivingLicenseDoc || drivingLicenseFile ? (
                        <button type="button" style={{ ...buttonStyle("#dc2626"), flexShrink: 0, minWidth: 78, background: "#fff", color: "#dc2626" }} onClick={() => { setDrivingLicenseDoc(""); setDrivingLicenseFile(null); }}>
                          Remove
                        </button>
                      ) : null}
                      <input ref={drivingLicenseRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setDrivingLicenseFile(file); setDrivingLicenseDoc(file.name); } }} />
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted: PDF, JPG, JPEG, PNG</span>
                    {drivingLicenseFile ? <a href={URL.createObjectURL(drivingLicenseFile)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7c3aed", textDecoration: "underline" }}>Preview / Download</a> : null}
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Other Documents</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        readOnly
                        value={otherDocuments.length > 0 ? `${otherDocuments.length} document(s) selected` : "Other Documents"}
                        id="staff-field-other_document"
                        style={{ ...fieldStyle(), borderColor: fieldErrors.other_document ? "#dc2626" : "var(--line)" }}
                      />
                      <button type="button" style={{ ...buttonStyle("#7c3aed"), flexShrink: 0 }} onClick={() => otherDocRef.current?.click()}>Browse</button>
                      {otherDocuments.length > 0 ? (
                        <button
                          type="button"
                          style={{ ...buttonStyle("#dc2626"), flexShrink: 0, minWidth: 78, background: "#fff", color: "#dc2626" }}
                          onClick={() => {
                            setOtherDocuments([]);
                            clearFieldError("other_document");
                          }}
                        >
                          Remove
                        </button>
                      ) : null}
                      <input
                        ref={otherDocRef}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;

                          setOtherDocuments((prev) => {
                            const next = [...prev];
                            files.forEach((file) => {
                              const fileName = file.name.trim();
                              if (!fileName) return;
                              const existingIndex = next.findIndex((item) => item.name.toLowerCase() === fileName.toLowerCase());
                              const nextItem: OtherDocumentEntry = {
                                id: makeOtherDocumentId(),
                                name: fileName,
                                file,
                              };
                              if (existingIndex >= 0) {
                                next[existingIndex] = nextItem;
                              } else {
                                next.push(nextItem);
                              }
                            });
                            return next;
                          });

                          clearFieldError("other_document");

                          e.target.value = "";
                        }}
                      />
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted: PDF, DOC, DOCX, JPG, PNG</span>
                    {fieldErrors.other_document ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.other_document}</span> : null}
                    {otherDocuments.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 8, border: "1px solid var(--line)", borderRadius: 10, background: "#fafafa" }}>
                        {otherDocuments.map((document) => (
                          <div
                            key={document.id}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              maxWidth: "100%",
                              padding: "7px 10px",
                              borderRadius: 999,
                              border: "1px solid rgba(124, 58, 237, 0.18)",
                              background: "#fff",
                              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                            }}
                          >
                            <span
                              title={document.name}
                              style={{
                                fontSize: 12,
                                color: "var(--text)",
                                maxWidth: 220,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {document.name}
                            </span>
                            <button
                              type="button"
                              aria-label={`Remove ${document.name}`}
                              title={`Remove ${document.name}`}
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                border: "none",
                                background: "#eef2ff",
                                color: "#7c3aed",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 14,
                                lineHeight: 1,
                                padding: 0,
                                flexShrink: 0,
                              }}
                              onClick={() => {
                                setOtherDocuments((prev) => prev.filter((item) => item.id !== document.id));
                              }}
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "none" }}>
              <button type="submit">Save</button>
            </div>
          </form>
          {toast ? <p style={{ color: "#dc2626", marginTop: 8 }}>{toast}</p> : null}
          {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          {success && <p style={{ color: "#16a34a", marginTop: 8 }}>{success}</p>}
        </div>
      </div></section>
    </div>
  );
}

export function HrStaffDirectoryPanel() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [togglingStatusId, setTogglingStatusId] = useState<number | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterDesignation, setFilterDesignation] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = async (page = 1) => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));

      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      if (filterRole) {
        params.set("role", filterRole);
      }
      if (filterDepartment) {
        params.set("department", filterDepartment);
      }
      if (filterDesignation) {
        params.set("designation", filterDesignation);
      }
      if (filterStatus === "active") {
        params.set("status", "active");
      } else if (filterStatus === "inactive") {
        params.set("status", "inactive");
      }

      const [roleResult, departmentResult, designationResult, staffResult] = await Promise.allSettled([
        apiGet<ApiList<Role>>("/api/v1/access-control/roles/"),
        apiGet<ApiList<Department>>("/api/v1/hr/departments/?is_active=true"),
        apiGet<ApiList<Designation>>("/api/v1/hr/designations/?is_active=true"),
        apiGet<ApiList<Staff>>(`/api/v1/hr/staff/?${params.toString()}`),
      ]);

      // Process roles
      if (roleResult.status === "fulfilled") {
        const payload = roleResult.value as { results?: Role[]; data?: Role[] } | Role[];
        const roleList = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.data)
            ? payload.data
            : payload.results || [];
        setRoles(roleList);
      } else {
        setRoles([]);
      }

      // Process departments
      if (departmentResult.status === "fulfilled") {
        setDepartments(listData(departmentResult.value));
      } else {
        setDepartments([]);
      }

      // Process designations
      if (designationResult.status === "fulfilled") {
        setDesignations(listData(designationResult.value));
      } else {
        setDesignations([]);
      }

      // Process staff
      if (staffResult.status === "fulfilled") {
        const staffData = staffResult.value;
        setRows(listData(staffData));
        const meta = listPaginationMeta(staffData, pageSize);
        setTotalRows(meta.count);
        setTotalPages(meta.totalPages);
        setCurrentPage(page);
      } else {
        setRows([]);
        setTotalRows(0);
        setTotalPages(1);
      }

      const dropdownFailures = [roleResult, departmentResult, designationResult].filter((r) => r.status === "rejected");
      const staffFailed = staffResult.status === "rejected";

      if (dropdownFailures.length === 3) {
        setError("Unable to load dropdown options right now. Please refresh the page or check the backend API.");
      } else if (staffFailed) {
        console.warn("Staff rows failed to load:", staffResult.status === "rejected" ? staffResult.reason : "Unknown error");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load staff directory";
      setError(`ΓÜá∩╕Å Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(currentPage);
  }, [currentPage, pageSize, searchQuery, filterDepartment, filterRole, filterDesignation, filterStatus]);

  const filteredDesignationOptions = useMemo(() => {
    const activeDesignations = designations.filter((designation) => designation.is_active);
    if (!filterDepartment) {
      return activeDesignations;
    }
    return activeDesignations.filter((designation) => designation.department === Number(filterDepartment));
  }, [designations, filterDepartment]);

  const toggleStaffStatus = async (staffId: number, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      setTogglingStatusId(staffId);
      await apiPatch(`/api/v1/hr/staff/${staffId}/`, { status: newStatus });
      setSuccess(`Staff status updated to ${newStatus}.`);
      await load(currentPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update staff status.");
    } finally {
      setTogglingStatusId(null);
    }
  };

  const deleteStaff = async (staffId: number) => {
    if (!window.confirm("Are you sure you want to delete this staff member?")) return;
    try {
      setLoading(true);
      await apiDelete(`/api/v1/hr/staff/${staffId}/`);
      setSuccess("Staff has been deleted successfully.");
      await load(currentPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete staff.");
    } finally {
      setLoading(false);
    }
  };

  const refreshStaffList = async () => {
    setSearchQuery("");
    setFilterDepartment("");
    setFilterRole("");
    setFilterDesignation("");
    setFilterStatus("all");
    setCurrentPage(1);
    setSuccess("");
    await load(1);
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Staff Directory")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div className="white-box" style={boxStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Staff List</h3>
            <button type="button" style={buttonStyle("#334155")} onClick={() => void refreshStaffList()} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {/* Messages */}
          {error && <p style={{ color: "var(--warning)", marginTop: 8, marginBottom: 8 }}>{error}</p>}
          {success && <p style={{ color: "#16a34a", marginTop: 8, marginBottom: 8 }}>{success}</p>}

          {/* Search & Filter Controls */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 16, padding: "12px", background: "#f8fafc", borderRadius: 8 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Search (ID or Name)</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search staff..."
                style={{ ...fieldStyle(), width: "100%" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Role</label>
              <select
                value={filterRole}
                onChange={(e) => {
                  setFilterRole(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ ...fieldStyle(), width: "100%" }}
              >
                <option value="">All Roles</option>
                {([...roles]
                  .sort((a, b) => a.name.localeCompare(b.name)))
                  .map((role) => (
                    <option key={role.id} value={String(role.id)}>
                      {role.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Department</label>
              <select
                value={filterDepartment}
                onChange={(e) => {
                  setFilterDepartment(e.target.value);
                  setFilterDesignation("");
                  setCurrentPage(1);
                }}
                style={{ ...fieldStyle(), width: "100%" }}
              >
                <option value="">All Departments</option>
                {departments
                  .filter((d) => d.is_active)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((dept) => (
                    <option key={dept.id} value={String(dept.id)}>
                      {dept.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Designation</label>
              <select
                value={filterDesignation}
                onChange={(e) => {
                  setFilterDesignation(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ ...fieldStyle(), width: "100%" }}
              >
                <option value="">All Designations</option>
                {filteredDesignationOptions.map((desig) => (
                  <option key={desig.id} value={String(desig.id)}>
                    {desig.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Status</label>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as "all" | "active" | "inactive");
                  setCurrentPage(1);
                }}
                style={{ ...fieldStyle(), width: "100%" }}
              >
                <option value="all">All Staff</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Results info */}
          <div style={{ marginBottom: 12, fontSize: 12, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span>
              Showing {rows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalRows)} of {totalRows} staff member{totalRows !== 1 ? "s" : ""}
            </span>
            <span>Search and filters apply on the server.</span>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Staff No</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Name</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Role</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Department</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Designation</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Phone</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Status</th>
                  <th style={{ textAlign: "center", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 12, color: "var(--text-muted)", textAlign: "center" }}>
                      No staff found matching your filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const roleName = roles.find((r) => r.id === row.role)?.name || "-";
                    const departmentName = departments.find((d) => d.id === row.department)?.name || "-";
                    const designationName = designations.find((d) => d.id === row.designation)?.name || "-";
                    const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
                    const isActive = row.status === "active";
                    const rowBackground = isActive ? "transparent" : "#fef2f2";

                    return (
                      <tr
                        key={row.id}
                        style={{
                          background: rowBackground,
                          borderBottom: "1px solid var(--line)",
                          opacity: isActive ? 1 : 0.7,
                        }}
                      >
                        <td style={{ padding: 8 }}>{row.staff_no || "-"}</td>
                        <td style={{ padding: 8, fontWeight: isActive ? 500 : 400 }}>{fullName || "-"}</td>
                        <td style={{ padding: 8 }}>{roleName}</td>
                        <td style={{ padding: 8 }}>{departmentName}</td>
                        <td style={{ padding: 8 }}>{designationName}</td>
                        <td style={{ padding: 8 }}>{row.phone || "-"}</td>
                        <td style={{ padding: 8 }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 12px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 600,
                              color: isActive ? "#166534" : "#991b1b",
                              background: isActive ? "#dcfce7" : "#fee2e2",
                              border: `1px solid ${isActive ? "#86efac" : "#fca5a5"}`,
                              cursor: "pointer",
                              userSelect: "none",
                            }}
                            onClick={() => void toggleStaffStatus(row.id, row.status)}
                            title="Click to toggle status"
                          >
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ padding: 8, textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center" }}>
                            <button
                              type="button"
                              title="Edit staff member"
                              aria-label="Edit staff member"
                              style={{
                                width: 34,
                                height: 34,
                                padding: 0,
                                border: "1px solid #0ea5e9",
                                background: "#0ea5e9",
                                color: "#fff",
                                borderRadius: 6,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onClick={() => {
                                if (typeof window !== "undefined") window.location.href = `/hr/staff?edit=${row.id}`;
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              title="Delete staff member"
                              aria-label="Delete staff member"
                              style={{
                                width: 34,
                                height: 34,
                                padding: 0,
                                border: "1px solid #dc2626",
                                background: "#dc2626",
                                color: "#fff",
                                borderRadius: 6,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onClick={() => void deleteStaff(row.id)}
                              disabled={loading}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Rows per page</label>
              <select
                aria-label="Items per page"
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ ...fieldStyle(), width: 110, height: 34 }}
              >
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
                <option value="100">100 / page</option>
              </select>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Page {currentPage} of {totalPages} · {totalRows} total
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={buttonStyle("#334155")}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || loading}
              >
                Previous
              </button>

              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {buildPageButtons(currentPage, totalPages).map((page) => (
                  <button
                    key={page}
                    type="button"
                    style={{
                      width: 34,
                      height: 34,
                      border: currentPage === page ? "1px solid var(--primary)" : "1px solid var(--line)",
                      background: currentPage === page ? "var(--primary)" : "var(--surface)",
                      color: currentPage === page ? "#fff" : "var(--text)",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: currentPage === page ? 600 : 400,
                    }}
                    onClick={() => setCurrentPage(page)}
                    disabled={loading}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                type="button"
                style={buttonStyle("#334155")}
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || loading}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div></section>
    </div>
  );
}

export function HrLeaveTypesPanel() {
  const [rows, setRows] = useState<LeaveType[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [name, setName] = useState("");
  const [maxDays, setMaxDays] = useState("1");
  const [isPaid, setIsPaid] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [paidFilter, setPaidFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; max_days_per_year?: string; is_active?: string }>({});
  const formRef = useRef<HTMLDivElement | null>(null);

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateForm = () => {
    const nextErrors: typeof fieldErrors = {};
    const normalizedName = name.trim();
    const parsedDays = Number(maxDays);

    if (!normalizedName) {
      nextErrors.name = "Leave name is required.";
    } else {
      if (normalizedName.length < 3) {
        nextErrors.name = "Leave name must be at least 3 characters.";
      } else if (!/^[A-Za-z ]+$/.test(normalizedName)) {
        nextErrors.name = "Leave name can contain only letters and spaces.";
      }
    }

    if (!maxDays.trim()) {
      nextErrors.max_days_per_year = "Max days is required.";
    } else if (!Number.isFinite(parsedDays)) {
      nextErrors.max_days_per_year = "Max days must be a number.";
    } else if (parsedDays <= 0) {
      nextErrors.max_days_per_year = "Max days must be greater than 0.";
    } else if (parsedDays > 365) {
      nextErrors.max_days_per_year = "Max days cannot exceed 365.";
    }

    if (isPaid && Number.isFinite(parsedDays) && parsedDays <= 0) {
      nextErrors.max_days_per_year = "Paid leave must have max days greater than 0.";
    }

    return nextErrors;
  };

  const mapApiMessageToField = (message: string): keyof typeof fieldErrors | null => {
    const lowered = message.toLowerCase();
    if (lowered.includes("duplicate") || lowered.includes("already exists") || lowered.includes("already exist")) return "name";
    if (lowered.includes("name") || lowered.includes("leave type")) return "name";
    if (lowered.includes("max") || lowered.includes("days")) return "max_days_per_year";
    if (lowered.includes("active") || lowered.includes("deactivate")) return "is_active";
    return null;
  };

  const load = async (page = 1) => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      params.set("ordering", "name");
      if (paidFilter === "paid") params.set("is_paid", "true");
      if (paidFilter === "unpaid") params.set("is_paid", "false");
      if (statusFilter === "active") params.set("is_active", "true");
      if (statusFilter === "inactive") params.set("is_active", "false");

      const data = await apiGet<ApiList<LeaveType>>(`/api/v1/hr/leave-types/?${params.toString()}`);
      setRows(listData(data));
      const meta = listPaginationMeta(data, pageSize);
      setCurrentPage(page);
      setTotalRows(meta.count);
      setTotalPages(meta.totalPages);
    } catch {
      setError("Unable to load leave types.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
  }, [paidFilter, statusFilter, pageSize]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateForm();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("");
      setToast("");
      return;
    }

    try {
      setSaving(true);
      setFieldErrors({});
      setError("");
      setToast("");
      const payload = { name: name.trim(), max_days_per_year: Number(maxDays || "0"), is_paid: isPaid, is_active: isActive };
      if (editingId) {
        await apiPatch(`/api/v1/hr/leave-types/${editingId}/`, payload);
        setToast("Leave type updated successfully.");
      } else {
        await apiPost("/api/v1/hr/leave-types/", payload);
        setToast("Leave type created successfully.");
      }
      setEditingId(null);
      setName("");
      setMaxDays("1");
      setIsPaid(true);
      setIsActive(true);
      await load(currentPage);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed";
      const field = mapApiMessageToField(message);
      if (field) {
        setFieldErrors((prev) => ({ ...prev, [field]: message }));
      }
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Types of Leaves")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div ref={formRef} className={`white-box ${editingId ? "editing-highlight" : ""}`} style={{ ...boxStyle(), marginBottom: 12, scrollMarginTop: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>{editingId ? "Editing Leave Type" : "Add Different Types of Leaves"}</h3>
          {editingId ? (
            <p style={{ marginTop: 0, marginBottom: 12, color: "var(--text-muted)", fontSize: 13 }}>
              You are editing an existing leave type. Use Save changes or cancel editing.
            </p>
          ) : null}
          <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1.2fr 180px auto auto auto", gap: 8, alignItems: "start" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Leave Type Name *</label>
              <input value={name} onChange={(e) => { setName(e.target.value); clearFieldError("name"); }} placeholder="e.g. Casual Leave" style={{ ...fieldStyle(), borderColor: fieldErrors.name ? "#dc2626" : "var(--line)" }} />
              {fieldErrors.name ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.name}</span> : null}
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Max Days *</label>
              <input type="number" min="1" step="1" value={maxDays} onChange={(e) => { setMaxDays(e.target.value); clearFieldError("max_days_per_year"); }} placeholder="1 or more" style={{ ...fieldStyle(), borderColor: fieldErrors.max_days_per_year ? "#dc2626" : "var(--line)" }} />
              {fieldErrors.max_days_per_year ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.max_days_per_year}</span> : null}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, alignSelf: "end" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Type</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, height: 36 }}><input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} /> Paid</span>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, alignSelf: "end" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Status</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, height: 36 }}><input type="checkbox" checked={isActive} onChange={(e) => { setIsActive(e.target.checked); clearFieldError("is_active"); }} /> Active</span>
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "end", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" style={buttonStyle("#6b7280")} onClick={() => {
                setEditingId(null);
                setName("");
                setMaxDays("1");
                setIsPaid(true);
                setIsActive(true);
                setFieldErrors({});
                setError("");
                setToast("");
              }} disabled={saving}>
                {editingId ? "Cancel edit" : "Reset"}
              </button>
              <button type="submit" style={buttonStyle()} disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Save"}</button>
            </div>
          </form>
          {fieldErrors.is_active ? <p style={{ color: "#dc2626", marginTop: 8, marginBottom: 0 }}>{fieldErrors.is_active}</p> : null}
          {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          {toast ? <p style={{ color: "#16a34a", marginTop: 8 }}>{toast}</p> : null}
        </div>

        <div className="white-box" style={boxStyle()}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Paid Filter</label>
              <select value={paidFilter} onChange={(e) => setPaidFilter(e.target.value as "all" | "paid" | "unpaid")} style={fieldStyle()}>
                <option value="all">All Types</option>
                <option value="paid">Paid Only</option>
                <option value="unpaid">Unpaid Only</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Status Filter</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")} style={fieldStyle()}>
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
              <button type="button" style={buttonStyle("#334155")} onClick={() => { setPaidFilter("all"); setStatusFilter("all"); }}>
                Clear Filters
              </button>
            </div>
          </div>

          {loading ? <p style={{ marginTop: 0, marginBottom: 10, color: "var(--text-muted)" }}>Loading leave types...</p> : null}

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Max Days</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Paid</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ background: row.is_active ? "transparent" : "#fef2f2" }}>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.name}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.max_days_per_year}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.is_paid ? "Yes" : "No"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                    <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: row.is_active ? "#166534" : "#991b1b", background: row.is_active ? "#dcfce7" : "#fee2e2", border: `1px solid ${row.is_active ? "#86efac" : "#fca5a5"}` }}>
                      {row.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" style={buttonStyle("#0ea5e9")} onClick={() => {
                        setEditingId(row.id);
                        setName(row.name);
                        setMaxDays(String(row.max_days_per_year));
                        setIsPaid(row.is_paid);
                        setIsActive(row.is_active);
                        setError("");
                        setToast("");
                        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}>Edit details</button>
                      <button
                        type="button"
                        style={buttonStyle("#dc2626")}
                        disabled={deletingId === row.id}
                        onClick={() => {
                          if (!window.confirm(`Delete leave type \"${row.name}\"?`)) return;
                          setDeletingId(row.id);
                          void apiDelete(`/api/v1/hr/leave-types/${row.id}/`)
                            .then(async () => {
                              setToast("Leave type deleted successfully.");
                              setError("");
                              const targetPage = rows.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
                              await load(targetPage);
                            })
                            .catch((err) => {
                              setError(err instanceof Error ? err.message : "Validation failed");
                            })
                            .finally(() => setDeletingId(null));
                        }}
                      >
                        {deletingId === row.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 12, textAlign: "center", color: "var(--text-muted)" }}>
                    No leave types found for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 10, flexWrap: "wrap" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Showing {rows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalRows)} of {totalRows}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <select
                aria-label="Items per page"
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ ...fieldStyle(), width: 110, height: 34 }}
              >
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
                <option value="100">100 / page</option>
              </select>
              <button type="button" style={buttonStyle("#334155")} disabled={currentPage <= 1 || loading} onClick={() => void load(currentPage - 1)}>Previous</button>
              {buildPageButtons(currentPage, totalPages).map((page) => (
                <button
                  key={page}
                  type="button"
                  style={buttonStyle(page === currentPage ? "var(--primary)" : "#64748b")}
                  disabled={loading}
                  onClick={() => void load(page)}
                >
                  {page}
                </button>
              ))}
              <button type="button" style={buttonStyle("#334155")} disabled={currentPage >= totalPages || loading} onClick={() => void load(currentPage + 1)}>Next</button>
            </div>
          </div>
        </div>
      </div></section>
    </div>
  );
}

export function HrLeaveDefinePanel() {
  const [rows, setRows] = useState<LeaveDefine[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [staffRows, setStaffRows] = useState<Staff[]>([]);
  const [studentRows, setStudentRows] = useState<Student[]>([]);
  const [classRows, setClassRows] = useState<SchoolClassOption[]>([]);
  const [sectionRows, setSectionRows] = useState<SectionOption[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [studentLoading, setStudentLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "role" | "staff" | "student">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const formRef = useRef<HTMLDivElement | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    role?: string;
    staff?: string;
    school_class?: string;
    section?: string;
    student?: string;
    leave_type?: string;
    days?: string;
  }>({});

  const [roleId, setRoleId] = useState("");
  const [scopeType, setScopeType] = useState<"all" | "class" | "individual">("all");
  const [staffId, setStaffId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [days, setDays] = useState("0");

  const selectedRole = roles.find((item) => String(item.id) === roleId);
  const isStudentRole = !!selectedRole && selectedRole.name.trim().toLowerCase() === "student";
  const filteredRows = useMemo(() => {
    let items = [...rows];

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      items = items.filter((item) => {
        const scopeText = [item.role_name, item.staff_name, item.student_name, item.class_name, item.section_name, item.leave_type_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return scopeText.includes(query) || String(item.days).includes(query);
      });
    }

    if (roleFilter !== "all") {
      items = items.filter((item) => String(item.role || "") === roleFilter || item.role_name === roleFilter);
    }

    if (staffFilter !== "all") {
      items = items.filter((item) => String(item.staff || "") === staffFilter || item.staff_name === staffFilter);
    }

    if (leaveTypeFilter !== "all") {
      items = items.filter((item) => String(item.leave_type || "") === leaveTypeFilter || item.leave_type_name === leaveTypeFilter);
    }

    if (statusFilter === "role") {
      items = items.filter((item) => !!item.role && !item.staff && !item.student);
    } else if (statusFilter === "staff") {
      items = items.filter((item) => !!item.staff);
    } else if (statusFilter === "student") {
      items = items.filter((item) => !!item.student || !!item.school_class || !!item.section);
    }

    items.sort((a, b) => {
      const priority = (row: LeaveDefine) => (row.staff ? 0 : row.student ? 1 : 2);
      const pDiff = priority(a) - priority(b);
      if (pDiff !== 0) return pDiff;
      const typeDiff = (a.leave_type_name || "").localeCompare(b.leave_type_name || "");
      if (typeDiff !== 0) return typeDiff;
      return Number(a.days) - Number(b.days);
    });

    return items;
  }, [rows, searchQuery, roleFilter, staffFilter, leaveTypeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const pageStart = filteredRows.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const pageEnd = Math.min(currentPage * itemsPerPage, filteredRows.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, staffFilter, leaveTypeFilter, statusFilter]);

  const filteredSections = useMemo(() => {
    if (!classId) return [];
    return sectionRows.filter((item) => String(item.school_class || "") === classId);
  }, [sectionRows, classId]);
  const filteredStudents = useMemo(() => {
    return studentRows.filter((item) => {
      if (classId && String(item.current_class || "") !== classId) return false;
      if (sectionId && String(item.current_section || "") !== sectionId) return false;
      return true;
    });
  }, [studentRows, classId, sectionId]);

  const noLeaveDefinitions = !loading && !error && rows.length === 0;

  const mapLoadError = (message: string) => {
    const lowered = message.toLowerCase();
    if (lowered.includes("permission") || lowered.includes("forbidden") || lowered.includes("403")) {
      return "You do not have permission to view this data.";
    }
    if (lowered.includes("failed to fetch") || lowered.includes("network")) {
      return "Network error. Please check your connection.";
    }
    return "Unable to load leave data. Please try again.";
  };

  const fieldIdMap: Record<keyof typeof fieldErrors, string> = {
    role: "leave-define-role",
    staff: "leave-define-staff",
    school_class: "leave-define-class",
    section: "leave-define-section",
    student: "leave-define-student",
    leave_type: "leave-define-leave-type",
    days: "leave-define-days",
  };

  const scrollToFirstError = (errors: typeof fieldErrors) => {
    const firstField = (Object.keys(errors) as Array<keyof typeof fieldErrors>).find((key) => !!errors[key]);
    if (!firstField) return;
    const elementId = fieldIdMap[firstField];
    const element = document.getElementById(elementId);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.focus();
  };

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateForm = () => {
    const nextErrors: typeof fieldErrors = {};
    const parsedDays = Number(days);

    if (!roleId && !staffId) {
      nextErrors.role = "Select either role or staff.";
      nextErrors.staff = "Select either role or staff.";
    }
    if (roleId && staffId && !isStudentRole) {
      nextErrors.role = "Choose either role or staff, not both.";
      nextErrors.staff = "Choose either role or staff, not both.";
    }
    if (isStudentRole) {
      if (staffId) {
        nextErrors.staff = "Staff selection is not allowed for Student role.";
      }
      if (scopeType === "class") {
        if (!classId) {
          nextErrors.school_class = "Class is required for class scope.";
        }
        if (!sectionId) {
          nextErrors.section = "Section is required for class scope.";
        }
      }
      if (scopeType === "individual") {
        if (!classId) {
          nextErrors.school_class = "Class is required for individual scope.";
        }
        if (!sectionId) {
          nextErrors.section = "Section is required for individual scope.";
        }
        if (!studentId) {
          nextErrors.student = "Student is required for individual scope.";
        }
      }
    } else if (studentId) {
      nextErrors.student = "Student can be selected only when role is Student.";
    } else if (classId || sectionId) {
      nextErrors.school_class = "Class/Section can be selected only when role is Student.";
    }
    if (!leaveTypeId) {
      nextErrors.leave_type = "Leave type is required.";
    }
    if (!days.trim()) {
      nextErrors.days = "Days is required.";
    } else if (!Number.isInteger(parsedDays)) {
      nextErrors.days = "Days must be an integer.";
    } else if (parsedDays <= 0) {
      nextErrors.days = "Days must be greater than 0";
    }

    return nextErrors;
  };

  const mapApiMessageToField = (message: string): keyof typeof fieldErrors | null => {
    const lowered = message.toLowerCase();
    if (lowered.includes("role")) return "role";
    if (lowered.includes("staff")) return "staff";
    if (lowered.includes("class")) return "school_class";
    if (lowered.includes("section")) return "section";
    if (lowered.includes("student")) return "student";
    if (lowered.includes("leave type")) return "leave_type";
    if (lowered.includes("days")) return "days";
    return null;
  };

  const resetForm = () => {
    setEditingId(null);
    setRoleId("");
    setStaffId("");
    setClassId("");
    setSectionId("");
    setStudentId("");
    setLeaveTypeId("");
    setDays("0");
    setScopeType("all");
    setFieldErrors({});
    setError("");
    setToast("");
  };

  const loadStaffByRole = async (selectedRoleId: string) => {
    setStaffLoading(true);
    try {
      const endpoint = selectedRoleId
        ? `/api/v1/hr/staff/?status=active&role=${selectedRoleId}`
        : "/api/v1/hr/staff/?status=active";
      const staffData = await apiGet<ApiList<Staff>>(endpoint);
      const items = listData(staffData);
      if (selectedRoleId) {
        const selectedRoleNumber = Number(selectedRoleId);
        setStaffRows(items.filter((item) => item.role === selectedRoleNumber));
      } else {
        setStaffRows(items);
      }
    } catch {
      setStaffRows([]);
    } finally {
      setStaffLoading(false);
    }
  };

  const loadStudents = async () => {
    setStudentLoading(true);
    try {
      const studentData = await apiGet<ApiList<Student>>("/api/v1/students/students/");
      const items = listData(studentData);
      setStudentRows(items.filter((item) => item.is_active));
    } catch {
      setStudentRows([]);
    } finally {
      setStudentLoading(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [defineDataResult, roleDataResult, leaveTypeDataResult] = await Promise.allSettled([
        apiGet<ApiList<LeaveDefine>>("/api/v1/hr/leave-defines/"),
        apiGet<ApiList<Role>>("/api/v1/access-control/roles/"),
        apiGet<ApiList<LeaveType>>("/api/v1/hr/leave-types/?is_active=true"),
      ]);

      const [classDataResult, sectionDataResult] = await Promise.allSettled([
        apiGet<ApiList<SchoolClassOption>>("/api/v1/core/classes/"),
        apiGet<ApiList<SectionOption>>("/api/v1/core/sections/"),
      ]);

      if (defineDataResult.status === "fulfilled") {
        setRows(listData(defineDataResult.value));
      } else {
        setRows([]);
      }

      if (roleDataResult.status === "fulfilled") {
        setRoles(listData(roleDataResult.value));
      } else {
        setRoles([]);
      }

      if (leaveTypeDataResult.status === "fulfilled") {
        setLeaveTypes(listData(leaveTypeDataResult.value));
      } else {
        setLeaveTypes([]);
      }

      if (classDataResult.status === "fulfilled") {
        setClassRows(listData(classDataResult.value));
      } else {
        setClassRows([]);
      }

      if (sectionDataResult.status === "fulfilled") {
        setSectionRows(listData(sectionDataResult.value));
      } else {
        setSectionRows([]);
      }

      await Promise.all([loadStaffByRole(roleId), loadStudents()]);

      if (
        defineDataResult.status === "rejected"
        || roleDataResult.status === "rejected"
        || leaveTypeDataResult.status === "rejected"
        || classDataResult.status === "rejected"
        || sectionDataResult.status === "rejected"
      ) {
        const firstRejected = [
          defineDataResult,
          roleDataResult,
          leaveTypeDataResult,
          classDataResult,
          sectionDataResult,
        ].find((item) => item.status === "rejected");
        const errorMessage = firstRejected && firstRejected.status === "rejected"
          ? (firstRejected.reason instanceof Error ? firstRejected.reason.message : String(firstRejected.reason || ""))
          : "";
        setError(mapLoadError(errorMessage));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(mapLoadError(message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void loadStaffByRole(roleId);
  }, [roleId]);

  useEffect(() => {
    if (!isStudentRole) {
      return;
    }

    if (scopeType === "all") {
      setClassId("");
      setSectionId("");
      setStudentId("");
    }
    if (scopeType === "class") {
      setStudentId("");
    }
  }, [scopeType, isStudentRole]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateForm();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("");
      setToast("");
      scrollToFirstError(nextErrors);
      return;
    }

    try {
      setSaving(true);
      setFieldErrors({});
      setError("");
      setToast("");
      const payload = {
        role: roleId ? Number(roleId) : null,
        staff: staffId ? Number(staffId) : null,
        school_class: classId ? Number(classId) : null,
        section: sectionId ? Number(sectionId) : null,
        student: studentId ? Number(studentId) : null,
        leave_type: Number(leaveTypeId),
        days: Number(days || "0"),
      };
      if (editingId) {
        await apiPatch(`/api/v1/hr/leave-defines/${editingId}/`, payload);
        setToast("Leave policy updated successfully.");
      } else {
        await apiPost("/api/v1/hr/leave-defines/", payload);
        setToast("Leave policy created successfully.");
      }
      resetForm();
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed";
      const field = mapApiMessageToField(message);
      if (field) {
        setFieldErrors((prev) => ({ ...prev, [field]: message }));
      }
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Define Leave Policy")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div ref={formRef} className={`white-box ${editingId ? "editing-highlight" : ""}`} style={{ ...boxStyle(), marginBottom: 12, scrollMarginTop: 12, background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>{editingId ? "Editing Leave Policy" : "Leave Policy Setup"}</h3>
                {editingId ? (
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 10px", borderRadius: 999, background: "#fff7ed", color: "#9a3412", fontSize: 12, fontWeight: 600, border: "1px solid #fdba74" }}>
                    Edit mode
                  </span>
                ) : null}
              </div>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13, maxWidth: 760 }}>
                Define who gets a leave policy and set leave type and days in a clear single flow.
              </p>
            </div>
            {editingId ? (
              <span style={{ display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 600, border: "1px solid #bfdbfe" }}>
                Update an existing rule
              </span>
            ) : null}
          </div>
          {editingId ? (
            <p style={{ marginTop: 0, marginBottom: 12, color: "var(--text-muted)", fontSize: 13 }}>
              You are editing an existing leave policy. Save changes or cancel editing to exit this mode.
            </p>
          ) : null}
          <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
            {/* Scope Selection */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14, display: "grid", gap: 12, background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>Scope & Assignment</h4>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Choose role or staff first, then narrow the scope if needed</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isStudentRole ? "1.2fr 0.8fr" : "1fr", gap: 12, alignItems: "start" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Role *</label>
                  <select
                    id="leave-define-role"
                    value={roleId}
                    onChange={(e) => {
                      const value = e.target.value;
                      const nextRole = roles.find((item) => String(item.id) === value);
                      const nextIsStudentRole = !!nextRole && nextRole.name.trim().toLowerCase() === "student";
                      setRoleId(value);
                      clearFieldError("role");
                      if (value && !nextIsStudentRole) {
                        setStaffId("");
                        setStudentId("");
                      }
                      if (nextIsStudentRole) {
                        setScopeType("all");
                        setStaffId("");
                        clearFieldError("staff");
                      } else {
                        setClassId("");
                        setSectionId("");
                        setStudentId("");
                        clearFieldError("school_class");
                        clearFieldError("section");
                        clearFieldError("student");
                      }
                    }}
                    style={{ ...fieldStyle(), borderColor: fieldErrors.role ? "#dc2626" : "var(--line)" }}
                  >
                    <option value="">Select Role</option>
                    {roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  {fieldErrors.role ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.role}</span> : null}
                </div>

                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Staff *</label>
                  <select
                    id="leave-define-staff"
                    value={staffId}
                    onChange={(e) => { setStaffId(e.target.value); clearFieldError("staff"); if (e.target.value) setRoleId(""); }}
                    style={{ ...fieldStyle(), borderColor: fieldErrors.staff ? "#dc2626" : "var(--line)" }}
                    disabled={staffLoading || isStudentRole}
                  >
                    <option value="">{staffLoading ? "Loading staff..." : "Select Staff"}</option>
                    {staffRows.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name} ({item.staff_no})</option>)}
                  </select>
                  {fieldErrors.staff ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.staff}</span> : null}
                </div>
              </div>

              {isStudentRole ? (
                <div style={{ borderRadius: 10, border: "1px solid #dbeafe", background: "#eff6ff", padding: 12, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 13, color: "#1d4ed8" }}>Student scope</strong>
                    <span style={{ fontSize: 12, color: "#1d4ed8" }}>Applies only when the selected role is Student</span>
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Scope</label>
                    <select
                      id="leave-define-scope"
                      value={scopeType}
                      onChange={(e) => setScopeType(e.target.value as "all" | "class" | "individual")}
                      style={fieldStyle()}
                    >
                      <option value="all">All Students</option>
                      <option value="class">Class / Section</option>
                      <option value="individual">Individual Student</option>
                    </select>
                  </div>
                </div>
              ) : null}
            </div>

            {isStudentRole ? (
              <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14, display: "grid", gap: 12, background: "#ffffff" }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>Student Scope Details</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  {scopeType !== "all" ? (
                    <>
                      <div style={{ display: "grid", gap: 4 }}>
                        <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Class</label>
                        <select
                          id="leave-define-class"
                          value={classId}
                          onChange={(e) => {
                            setClassId(e.target.value);
                            setSectionId("");
                            setStudentId("");
                            clearFieldError("school_class");
                            clearFieldError("section");
                            clearFieldError("student");
                          }}
                          style={{ ...fieldStyle(), borderColor: fieldErrors.school_class ? "#dc2626" : "var(--line)" }}
                        >
                          <option value="">Select Class</option>
                          {classRows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        {fieldErrors.school_class ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.school_class}</span> : null}
                      </div>

                      <div style={{ display: "grid", gap: 4 }}>
                        <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Section</label>
                        <select
                          id="leave-define-section"
                          value={sectionId}
                          onChange={(e) => {
                            setSectionId(e.target.value);
                            setStudentId("");
                            clearFieldError("section");
                            clearFieldError("student");
                          }}
                          style={{ ...fieldStyle(), borderColor: fieldErrors.section ? "#dc2626" : "var(--line)" }}
                          disabled={!classId}
                        >
                          <option value="">{classId ? "Select Section" : "Select Class first"}</option>
                          {filteredSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        {fieldErrors.section ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.section}</span> : null}
                      </div>
                    </>
                  ) : (
                    <div style={{ gridColumn: "1 / -1", color: "var(--text-muted)", fontSize: 13 }}>
                      Leave will be applied to all students.
                    </div>
                  )}

                  {scopeType === "individual" ? (
                    <div style={{ display: "grid", gap: 4 }}>
                      <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Student</label>
                      <select
                        id="leave-define-student"
                        value={studentId}
                        onChange={(e) => { setStudentId(e.target.value); clearFieldError("student"); }}
                        style={{ ...fieldStyle(), borderColor: fieldErrors.student ? "#dc2626" : "var(--line)" }}
                        disabled={studentLoading || !classId || !sectionId}
                      >
                        <option value="">{studentLoading ? "Loading students..." : !classId || !sectionId ? "Select class and section first" : "Select Student"}</option>
                        {filteredStudents.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name} ({item.admission_no})</option>)}
                      </select>
                      {fieldErrors.student ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.student}</span> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Leave Details */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14, display: "grid", gap: 12, background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>Leave Allocation Details</h4>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Set the policy value and validity</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Leave Type *</label>
                  <select id="leave-define-leave-type" value={leaveTypeId} onChange={(e) => { setLeaveTypeId(e.target.value); clearFieldError("leave_type"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.leave_type ? "#dc2626" : "var(--line)" }}>
                    <option value="">Select Leave Type</option>
                    {leaveTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  {fieldErrors.leave_type ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.leave_type}</span> : null}
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Days *</label>
                  <input id="leave-define-days" type="number" min="1" step="1" value={days} onChange={(e) => { setDays(e.target.value); clearFieldError("days"); }} placeholder="Enter days greater than 0" style={{ ...fieldStyle(), borderColor: fieldErrors.days ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.days ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.days}</span> : null}
                </div>
              </div>
            </div>

            {/* Save Action */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14, display: "flex", justifyContent: "flex-end", background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={buttonStyle("#6b7280")} onClick={resetForm} disabled={saving || loading}>{editingId ? "Cancel edit" : "Reset"}</button>
                <button type="submit" style={buttonStyle()} disabled={saving || loading}>{saving ? "Saving..." : editingId ? "Save changes" : "Save"}</button>
              </div>
            </div>
          </form>
          {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          {toast ? <p style={{ color: "#16a34a", marginTop: 8 }}>{toast}</p> : null}
        </div>

        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: 14 }}>Search & Filters</h4>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Search is applied on the client for fast browsing</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Search</label>
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by role, staff, leave type" style={fieldStyle()} />
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Role Filter</label>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={fieldStyle()}>
                <option value="all">All Roles</option>
                {roles.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Staff Filter</label>
              <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} style={fieldStyle()}>
                <option value="all">All Staff</option>
                {staffRows.map((item) => <option key={item.id} value={String(item.id)}>{item.first_name} {item.last_name} ({item.staff_no})</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Leave Type Filter</label>
              <select value={leaveTypeFilter} onChange={(e) => setLeaveTypeFilter(e.target.value)} style={fieldStyle()}>
                <option value="all">All Leave Types</option>
                {leaveTypes.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Record Type Filter</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "role" | "staff" | "student")} style={fieldStyle()}>
                <option value="all">All Records</option>
                <option value="role">Role Based</option>
                <option value="staff">Staff Specific</option>
                <option value="student">Student Based</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "end" }}>
              <button type="button" style={buttonStyle("#6b7280")} onClick={() => { setSearchQuery(""); setRoleFilter("all"); setStaffFilter("all"); setLeaveTypeFilter("all"); setStatusFilter("all"); setCurrentPage(1); }}>
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        <div className="white-box" style={boxStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <h3 style={{ margin: 0 }}>Leave Allocation Rules</h3>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12 }}>
                Priority order: staff-specific rules override student-based rules, which override role-based rules.
              </p>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 600, border: "1px solid #bfdbfe" }}>
              Showing {pageStart} - {pageEnd} of {filteredRows.length}
            </div>
          </div>
          {loading ? <p style={{ marginTop: 0, color: "var(--text-muted)" }}>Loading leave policy data...</p> : null}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Scope</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Leave Type</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Days</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Priority</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {noLeaveDefinitions ? (
                <tr>
                  <td colSpan={5} style={{ padding: 12, color: "var(--text-muted)", borderBottom: "1px solid var(--line)" }}>
                    No leave definitions found.
                  </td>
                </tr>
              ) : null}
              {paginatedRows.map((row) => (
                <tr key={row.id} style={{ background: row.staff ? "#ecfeff" : row.student ? "#f5f3ff" : "transparent" }}>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                    {row.student_name
                      ? `${row.student_name} (${row.class_name || "-"}/${row.section_name || "-"})`
                      : row.class_name && row.section_name
                        ? `Students: ${row.class_name} - ${row.section_name}`
                        : row.role_name === "Student"
                          ? "All Students"
                          : row.role_name || row.staff_name || "-"}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.leave_type_name || row.leave_type}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.days}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                    <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: row.staff ? "#0f766e" : row.student ? "#6d28d9" : "#475569", background: row.staff ? "#ccfbf1" : row.student ? "#ede9fe" : "#e2e8f0" }}>
                      {row.staff ? "Staff priority" : row.student ? "Student priority" : "Role priority"}
                    </span>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={buttonStyle("#0ea5e9")}
                        onClick={() => {
                          if (row.role_name === "Student") {
                            if (row.student) {
                              setScopeType("individual");
                            } else if (row.school_class && row.section) {
                              setScopeType("class");
                            } else {
                              setScopeType("all");
                            }
                          }
                          setEditingId(row.id);
                          setRoleId(row.role ? String(row.role) : "");
                          setStaffId(row.staff ? String(row.staff) : "");
                          setClassId(row.school_class ? String(row.school_class) : "");
                          setSectionId(row.section ? String(row.section) : "");
                          setStudentId(row.student ? String(row.student) : "");
                          setLeaveTypeId(String(row.leave_type));
                          setDays(String(row.days));
                          setError("");
                          setToast("");
                          formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        Edit details
                      </button>
                      <button type="button" style={buttonStyle("#dc2626")} onClick={() => {
                        if (!window.confirm("Delete this leave policy?")) return;
                        void apiDelete(`/api/v1/hr/leave-defines/${row.id}/`).then(async () => {
                          setToast("Leave policy deleted successfully.");
                          await load();
                        }).catch((err) => setError(err instanceof Error ? err.message : "Unable to delete leave policy."));
                      }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedRows.length === 0 && filteredRows.length > 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 12, textAlign: "center", color: "var(--text-muted)" }}>
                    No leave definitions match the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", color: "var(--text-muted)", fontSize: 13 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Rows per page</label>
              <select
                aria-label="Items per page"
                value={String(itemsPerPage)}
                onChange={(e) => {
                  const nextPageSize = Number(e.target.value);
                  if (Number.isFinite(nextPageSize) && nextPageSize > 0) {
                    setItemsPerPage(nextPageSize);
                    setCurrentPage(1);
                  }
                }}
                style={{ ...fieldStyle(), width: 110, height: 34 }}
              >
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
              </select>
              <span>Page {currentPage} of {totalPages} · {filteredRows.length} total</span>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={buttonStyle("#334155")} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1 || loading}>Previous</button>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {buildPageButtons(currentPage, totalPages).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    style={{ width: 34, height: 34, border: currentPage === page ? "1px solid var(--primary)" : "1px solid var(--line)", background: currentPage === page ? "var(--primary)" : "var(--surface)", color: currentPage === page ? "#fff" : "var(--text)", borderRadius: 6, cursor: "pointer" }}
                    disabled={loading}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button type="button" style={buttonStyle("#334155")} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages || loading}>Next</button>
            </div>
          </div>
        </div>
      </div></section>
    </div>
  );
}

export function HrStaffAttendancePanel() {
  const [staffRows, setStaffRows] = useState<Staff[]>([]);
  const [rows, setRows] = useState<StaffAttendance[]>([]);
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceDateError, setAttendanceDateError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "P" | "A" | "L" | "F" | "H">("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [statusByStaff, setStatusByStaff] = useState<Record<number, "P" | "A" | "L" | "F" | "H">>({});
  const [noteByStaff, setNoteByStaff] = useState<Record<number, string>>({});
  const [noteErrorsByStaff, setNoteErrorsByStaff] = useState<Record<number, string>>({});

  const PAGE_SIZE = 25;
  const MAX_NOTE_LENGTH = 200;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const statusLabel: Record<string, string> = {
    P: "Present",
    A: "Absent",
    L: "Leave",
    F: "Half Day",
    H: "Holiday",
  };

  const isWeekend = useMemo(() => {
    if (!attendanceDate) return false;
    const day = new Date(`${attendanceDate}T00:00:00`).getDay();
    return day === 0 || day === 6;
  }, [attendanceDate]);

  const fetchAllPages = async <T,>(path: string): Promise<T[]> => {
    const merged: T[] = [];
    let nextPath = path;

    for (let i = 0; i < 50 && nextPath; i += 1) {
      const data = await apiGet<ApiList<T> & { next?: string | null }>(nextPath);
      merged.push(...listData<T>(data));

      const nextRaw = (data as { next?: string | null }).next;
      if (!nextRaw) {
        nextPath = "";
        continue;
      }

      if (nextRaw.startsWith("http")) {
        try {
          const nextUrl = new URL(nextRaw);
          nextPath = `${nextUrl.pathname}${nextUrl.search}`;
        } catch {
          nextPath = "";
        }
      } else {
        nextPath = nextRaw;
      }
    }

    return merged;
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const [staffList, attendanceList, reportData] = await Promise.all([
        fetchAllPages<Staff>("/api/v1/hr/staff/?status=active"),
        fetchAllPages<StaffAttendance>(`/api/v1/hr/staff-attendance/?attendance_date=${attendanceDate}`),
        apiGet<AttendanceReport>(`/api/v1/hr/staff-attendance/report/?attendance_date=${attendanceDate}`),
      ]);

      const statusMap: Record<number, "P" | "A" | "L" | "F" | "H"> = {};
      const noteMap: Record<number, string> = {};
      attendanceList.forEach((item) => {
        statusMap[item.staff] = item.attendance_type;
        noteMap[item.staff] = item.note || "";
      });

      setStaffRows(staffList);
      setRows(attendanceList);
      setReport(reportData);
      setStatusByStaff(statusMap);
      setNoteByStaff(noteMap);
      setNoteErrorsByStaff({});
    } catch {
      setError("Unable to load staff attendance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [attendanceDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, attendanceDate]);

  const filteredStaffRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return staffRows.filter((staff) => {
      const status = statusByStaff[staff.id] || "P";
      const matchesSearch = !term
        || `${staff.first_name} ${staff.last_name}`.toLowerCase().includes(term)
        || (staff.staff_no || "").toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [staffRows, statusByStaff, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStaffRows.length / PAGE_SIZE));
  const paginatedStaffRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStaffRows.slice(start, start + PAGE_SIZE);
  }, [filteredStaffRows, currentPage]);

  const liveSummary = useMemo(() => {
    const byType: Record<string, number> = { P: 0, A: 0, L: 0, F: 0, H: 0 };
    staffRows.forEach((staff) => {
      const code = statusByStaff[staff.id] || "P";
      byType[code] = (byType[code] || 0) + 1;
    });
    return {
      total: staffRows.length,
      by_type: byType,
    };
  }, [staffRows, statusByStaff]);

  const setBulkStatus = (status: "P" | "A" | "L" | "F" | "H") => {
    setStatusByStaff((prev) => {
      const next = { ...prev };
      staffRows.forEach((staff) => {
        next[staff.id] = status;
      });
      return next;
    });
    setToast(`All employees marked as ${statusLabel[status]}.`);
  };

  const onNoteChange = (staffId: number, value: string) => {
    if (value.length > MAX_NOTE_LENGTH) {
      setNoteErrorsByStaff((prev) => ({ ...prev, [staffId]: `Maximum ${MAX_NOTE_LENGTH} characters allowed.` }));
      return;
    }

    setNoteByStaff((prev) => ({ ...prev, [staffId]: value }));
    setNoteErrorsByStaff((prev) => ({ ...prev, [staffId]: "" }));
  };

  const saveAttendance = async () => {
    if (!attendanceDate) {
      setAttendanceDateError("Attendance date is required.");
      setError("Please select attendance date.");
      return;
    }

    if (attendanceDate > today) {
      setAttendanceDateError("Future dates are not allowed.");
      setError("Attendance date cannot be in the future.");
      return;
    }

    if (Object.values(noteErrorsByStaff).some((message) => !!message)) {
      setError("Please fix note validation errors before saving.");
      return;
    }

    if (staffRows.length === 0) {
      setError("No active employees found for attendance.");
      return;
    }

    if (!window.confirm(`Save attendance for ${staffRows.length} employees on ${attendanceDate}?`)) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      const payload = {
        rows: staffRows.map((staff) => ({
          staff: staff.id,
          attendance_date: attendanceDate,
          attendance_type: statusByStaff[staff.id] || "P",
          note: (noteByStaff[staff.id] || "").trim(),
        })),
      };
      const response = await apiPost<{ detail?: string; count?: number }>("/api/v1/hr/staff-attendance/bulk-store/", payload);
      await load();
      setToast(response?.detail ? `${response.detail} (${response?.count || 0} rows)` : "Attendance saved successfully.");
    } catch {
      setError("Unable to save staff attendance.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Staff Attendance")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 10 }}>Attendance Date</h3>
          <div style={{ display: "grid", gridTemplateColumns: "220px auto auto", gap: 8, alignItems: "end" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Date *</label>
              <input
                type="date"
                value={attendanceDate}
                max={today}
                onChange={(e) => {
                  setAttendanceDate(e.target.value);
                  setAttendanceDateError("");
                  setError("");
                }}
                style={{ ...fieldStyle(), borderColor: attendanceDateError ? "#dc2626" : "var(--line)" }}
              />
              {attendanceDateError ? <span style={{ color: "#dc2626", fontSize: 12 }}>{attendanceDateError}</span> : null}
            </div>
            <button type="button" style={buttonStyle("#0ea5e9")} onClick={() => void load()} disabled={loading || saving}>{loading ? "Loading..." : "Load"}</button>
            <button type="button" style={buttonStyle()} onClick={() => void saveAttendance()} disabled={loading || saving}>{saving ? "Saving..." : "Save Attendance"}</button>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={buttonStyle("#059669")} onClick={() => setBulkStatus("P")} disabled={loading || saving}>Mark All Present</button>
            <button type="button" style={buttonStyle("#dc2626")} onClick={() => setBulkStatus("A")} disabled={loading || saving}>Mark All Absent</button>
            <button type="button" style={buttonStyle("#d97706")} onClick={() => setBulkStatus("L")} disabled={loading || saving}>Mark All Leave</button>
            <button type="button" style={buttonStyle("#0f766e")} onClick={() => setBulkStatus("F")} disabled={loading || saving}>Mark All Half Day</button>
            <button type="button" style={buttonStyle("#334155")} onClick={() => setBulkStatus("H")} disabled={loading || saving}>Mark All Holiday</button>
          </div>
          {isWeekend ? <p style={{ color: "#d97706", marginTop: 8, marginBottom: 0 }}>Selected date is a weekend. You can use &quot;Mark All Holiday&quot; if this is a non-working day.</p> : null}
          {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          {toast ? <p style={{ color: "#16a34a", marginTop: 8 }}>{toast}</p> : null}
        </div>

        {(report || liveSummary) && (
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Attendance Summary (Live)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 }}>
              <div>Total: <strong>{liveSummary.total}</strong></div>
              <div>Present: <strong>{liveSummary.by_type?.P || 0}</strong></div>
              <div>Absent: <strong>{liveSummary.by_type?.A || 0}</strong></div>
              <div>Leave: <strong>{liveSummary.by_type?.L || 0}</strong></div>
              <div>Half Day: <strong>{liveSummary.by_type?.F || 0}</strong></div>
              <div>Holiday: <strong>{liveSummary.by_type?.H || 0}</strong></div>
            </div>
            <p style={{ marginTop: 8, marginBottom: 0, color: "var(--text-muted)", fontSize: 12 }}>Saved snapshot for selected date: {report?.total || 0} records.</p>
          </div>
        )}

        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Mark Attendance</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or staff no" style={{ ...fieldStyle(), width: 240 }} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "P" | "A" | "L" | "F" | "H")} style={{ ...fieldStyle(), width: 180 }}>
                <option value="all">All Statuses</option>
                <option value="P">Present</option>
                <option value="A">Absent</option>
                <option value="L">Leave</option>
                <option value="F">Half Day</option>
                <option value="H">Holiday</option>
              </select>
            </div>
          </div>

          <p style={{ marginTop: 0, marginBottom: 8, color: "var(--text-muted)", fontSize: 12 }}>
            Showing {paginatedStaffRows.length} of {filteredStaffRows.length} filtered employees ({staffRows.length} total).
          </p>

          <div style={{ maxHeight: 520, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ position: "sticky", top: 0, zIndex: 1, background: "#f8fafc", textAlign: "left", padding: 10, borderBottom: "1px solid var(--line)" }}>Staff</th>
                  <th style={{ position: "sticky", top: 0, zIndex: 1, background: "#f8fafc", textAlign: "left", padding: 10, borderBottom: "1px solid var(--line)" }}>Status *</th>
                  <th style={{ position: "sticky", top: 0, zIndex: 1, background: "#f8fafc", textAlign: "left", padding: 10, borderBottom: "1px solid var(--line)" }}>Note (Max {MAX_NOTE_LENGTH})</th>
                </tr>
              </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} style={{ padding: 12, color: "var(--text-muted)", textAlign: "center" }}>Loading employees...</td>
                </tr>
              )}
              {!loading && paginatedStaffRows.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: 12, color: "var(--text-muted)", textAlign: "center" }}>No employees match current filters.</td>
                </tr>
              )}
              {paginatedStaffRows.map((staff, index) => (
                <tr key={staff.id} style={{ background: index % 2 === 0 ? "#ffffff" : "#fcfdff" }}>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{staff.first_name} {staff.last_name} ({staff.staff_no})</td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
                    <select
                      value={statusByStaff[staff.id] || "P"}
                      onChange={(e) => {
                        setStatusByStaff((prev) => ({ ...prev, [staff.id]: e.target.value as "P" | "A" | "L" | "F" | "H" }));
                      }}
                      style={fieldStyle()}
                    >
                      {Object.entries(statusLabel).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
                    <input
                      value={noteByStaff[staff.id] || ""}
                      onChange={(e) => onNoteChange(staff.id, e.target.value)}
                      placeholder="Reason or context (optional)"
                      style={{ ...fieldStyle(), borderColor: noteErrorsByStaff[staff.id] ? "#dc2626" : "var(--line)" }}
                    />
                    {noteErrorsByStaff[staff.id] ? <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{noteErrorsByStaff[staff.id]}</div> : <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>{(noteByStaff[staff.id] || "").length}/{MAX_NOTE_LENGTH} characters</div>}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" style={buttonStyle("#334155")} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>Prev</button>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Page {currentPage} of {totalPages}</span>
              <button type="button" style={buttonStyle("#334155")} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>Next</button>
            </div>
          ) : null}
        </div>

        <div className="white-box" style={boxStyle()}>
          <h3 style={{ marginTop: 0, marginBottom: 10 }}>Saved Entries</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Staff</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Date</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Note</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.staff_name || row.staff}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.attendance_date}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{statusLabel[row.attendance_type] || row.attendance_type}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div></section>
    </div>
  );
}

export function HrLeaveRequestsPanel() {
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [staffRows, setStaffRows] = useState<Staff[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [actionByRow, setActionByRow] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<MePayload | null>(null);
  const [applyOnBehalf, setApplyOnBehalf] = useState(false);

  const [applyDate] = useState(new Date().toISOString().slice(0, 10));
  const [staffId, setStaffId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);
  
  const [fieldErrors, setFieldErrors] = useState<{
    staff?: string;
    leaveType?: string;
    fromDate?: string;
    toDate?: string;
    reason?: string;
    attachment?: string;
  }>({});
  
  const minReasonLength = 1;
  const maxReasonLength = 500;
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  const allowedFileTypes = ["application/pdf", "image/jpeg", "image/png"];
  const allowedFileExtensions = [".pdf", ".jpg", ".jpeg", ".png"];
  const canSelectStaff = !!currentUser && (currentUser.is_superuser || currentUser.is_school_admin);
  const canModerateLeave = !!currentUser && (
    currentUser.is_superuser
    || currentUser.is_school_admin
    || currentUser.permission_codes.includes("human_resource.apply_leave.view")
    || currentUser.permission_codes.includes("human_resource.apply_leave.edit")
    || currentUser.permission_codes.includes("human_resource.apply_leave.delete")
  );

  const ownStaffId = useMemo(() => {
    if (!currentUser) return null;
    const byUserId = typeof currentUser.id === "number"
      ? staffRows.find((item) => item.user === currentUser.id)
      : undefined;
    if (byUserId) return byUserId.id;

    const byEmail = currentUser.email
      ? staffRows.find((item) => item.email && item.email.toLowerCase() === currentUser.email?.toLowerCase())
      : undefined;
    return byEmail?.id ?? null;
  }, [currentUser, staffRows]);

  const effectiveStaffId = useMemo(() => {
    if (!canSelectStaff) {
      return staffId ? Number(staffId) : null;
    }
    if (applyOnBehalf) {
      return staffId ? Number(staffId) : null;
    }
    return ownStaffId;
  }, [canSelectStaff, applyOnBehalf, staffId, ownStaffId]);

  const effectiveStaffLabel = useMemo(() => {
    const selected = staffRows.find((item) => item.id === effectiveStaffId);
    if (selected) {
      return `${selected.first_name} ${selected.last_name}`.trim() || selected.staff_no || "Your profile";
    }

    const currentUserName = currentUser
      ? `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim()
      : "";

    if (currentUserName) return currentUserName;
    if (currentUser?.username?.trim()) return currentUser.username.trim();
    if (currentUser?.email?.trim()) return currentUser.email.trim();

    return "Your profile";
  }, [staffRows, effectiveStaffId, currentUser]);

  const load = async (page = 1, searchValue = search) => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      params.set("ordering", "-created_at");
      if (searchValue.trim()) {
        params.set("search", searchValue.trim());
      }

      const [leaveData, typeData, meData, staffData] = await Promise.all([
        apiGet<ApiList<LeaveRequest>>(`/api/v1/hr/leave-requests/?${params.toString()}`),
        fetchAllPages<LeaveType>("/api/v1/hr/leave-types/?is_active=true&page_size=100"),
        apiGet<MePayload>("/api/v1/auth/me/"),
        fetchAllPages<Staff>("/api/v1/hr/staff/?status=active&page_size=100"),
      ]);
      setRows(listData(leaveData));
      const meta = listPaginationMeta(leaveData, pageSize);
      setCurrentPage(page);
      setTotalRows(meta.count);
      setTotalPages(meta.totalPages);
      setLeaveTypes(typeData);
      setCurrentUser(meData);
      setStaffRows(staffData);
    } catch {
      setError("Unable to load leave requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load(1, search);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search, pageSize]);

  const validateForm = () => {
    const nextErrors: typeof fieldErrors = {};

    if (canSelectStaff && applyOnBehalf && !staffId.trim()) {
      nextErrors.staff = "Employee is required.";
    }
    if (canSelectStaff && !applyOnBehalf && !ownStaffId) {
      nextErrors.staff = "Your staff profile is not linked. Enable 'Apply on behalf' and choose an employee.";
    }
    
    if (!leaveTypeId.trim()) {
      nextErrors.leaveType = "Leave type is required.";
    }
    
    if (!fromDate.trim()) {
      nextErrors.fromDate = "From date is required.";
    }
    
    if (!toDate.trim()) {
      nextErrors.toDate = "To date is required.";
    }
    
    if (fromDate && toDate) {
      if (toDate < fromDate) {
        nextErrors.toDate = "To date cannot be earlier than From date.";
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const fromDateObj = new Date(fromDate);
      const sixMonthsFromNow = new Date(today);
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
      
      if (fromDateObj < today) {
        nextErrors.fromDate = "From date cannot be in the past.";
      }
      if (fromDateObj > sixMonthsFromNow) {
        nextErrors.fromDate = "From date cannot be more than 6 months in the future.";
      }
    }
    
    if (!reason.trim()) {
      nextErrors.reason = "Reason is required.";
    }
    if (reason.trim() && reason.trim().length > maxReasonLength) {
      nextErrors.reason = `Reason cannot exceed ${maxReasonLength} characters.`;
    }
    
    if (attachmentFile) {
      if (!allowedFileTypes.includes(attachmentFile.type)) {
        nextErrors.attachment = "Only PDF, JPG, and PNG files are allowed.";
      }
      if (attachmentFile.size > maxFileSize) {
        nextErrors.attachment = `File size cannot exceed ${maxFileSize / (1024 * 1024)}MB.`;
      }
    }
    
    return nextErrors;
  };

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const nextErrors = validateForm();
    setFieldErrors(nextErrors);
    
    if (Object.keys(nextErrors).length > 0) {
      setError("Please fix the errors below before submitting.");
      return;
    }
    
    try {
      setSaving(true);
      const payload = {
        ...(effectiveStaffId ? { staff: effectiveStaffId } : {}),
        leave_type: Number(leaveTypeId),
        from_date: fromDate,
        to_date: toDate,
        reason: reason.trim(),
        attachment: attachmentFile?.name || "",
      };
      if (editingId) {
        await apiPatch(`/api/v1/hr/leave-requests/${editingId}/`, payload);
        setToast("Leave request updated successfully.");
      } else {
        await apiPost("/api/v1/hr/leave-requests/", payload);
        setToast("Leave request submitted successfully.");
      }
      setEditingId(null);
      setStaffId("");
      setApplyOnBehalf(false);
      setLeaveTypeId("");
      setFromDate("");
      setToDate("");
      setReason("");
      setAttachment("");
      setAttachmentFile(null);
      await load(currentPage);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save leave request.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const deletePending = async (id: number) => {
    try {
      setError("");
      await apiDelete(`/api/v1/hr/leave-requests/${id}/`);
      const targetPage = rows.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      await load(targetPage);
    } catch {
      setError("Unable to delete leave request.");
    }
  };

  const viewLeave = (row: LeaveRequest) => {
    const leaveType = leaveTypes.find((item) => item.id === row.leave_type);
    const message = [
      `Leave Type: ${leaveType?.name || row.leave_type}`,
      `From: ${row.from_date}`,
      `To: ${row.to_date}`,
      `Reason: ${row.reason || "-"}`,
      `Attachment: ${row.attachment || "-"}`,
      `Status: ${row.status}`,
      `Approval Note: ${row.approval_note || "-"}`,
    ].join("\n");
    window.alert(message);
  };

  const handleRowAction = async (row: LeaveRequest, action: string) => {
    setActionByRow((prev) => ({ ...prev, [row.id]: "" }));
    if (action === "view") {
      viewLeave(row);
      return;
    }
    if (action === "edit" && row.status === "pending") {
      startEdit(row);
      return;
    }
    if (action === "delete" && row.status === "pending") {
      await deletePending(row.id);
      return;
    }
    if (action === "approve" && row.status === "pending" && canModerateLeave) {
      try {
        setError("");
        const note = window.prompt("Approval note (optional):", "") || "";
        await apiPost(`/api/v1/hr/leave-requests/${row.id}/approve/`, { approval_note: note.trim() });
        setToast("Leave request approved successfully.");
        await load(currentPage);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to approve leave request.";
        setError(message);
      }
      return;
    }
    if (action === "reject" && row.status === "pending" && canModerateLeave) {
      try {
        setError("");
        const note = window.prompt("Rejection note (optional):", "") || "";
        await apiPost(`/api/v1/hr/leave-requests/${row.id}/reject/`, { approval_note: note.trim() });
        setToast("Leave request rejected successfully.");
        await load(currentPage);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to reject leave request.";
        setError(message);
      }
    }
  };

  const statusText = (status: LeaveRequest["status"]) => {
    if (status === "rejected") return "Cancelled";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const statusColor = (status: LeaveRequest["status"]) => {
    if (status === "approved") return "#059669";
    if (status === "rejected") return "#dc2626";
    return "#d97706";
  };

  const startEdit = (row: LeaveRequest) => {
    setEditingId(row.id);
    setStaffId(String(row.staff ?? ""));
    setApplyOnBehalf(canSelectStaff && (!!row.staff && row.staff !== ownStaffId));
    setLeaveTypeId(String(row.leave_type));
    setFromDate(row.from_date);
    setToDate(row.to_date);
    setReason(row.reason || "");
    setAttachment(row.attachment || "");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setStaffId("");
    setApplyOnBehalf(false);
    setLeaveTypeId("");
    setFromDate("");
    setToDate("");
    setReason("");
    setAttachment("");
    setAttachmentFile(null);
    setFieldErrors({});
    setError("");
    setToast("");
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Apply Leave")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div ref={formRef} className={`white-box ${editingId ? "editing-highlight" : ""}`} style={{ ...boxStyle(), marginBottom: 12, scrollMarginTop: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>{editingId ? "Editing Leave Request" : "Apply for Leave"}</h3>
          {editingId ? (
            <p style={{ marginTop: 0, marginBottom: 12, color: "var(--text-muted)", fontSize: 13 }}>
              You are editing a leave request. Save changes or cancel edit to exit edit mode.
            </p>
          ) : null}
          
          <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
            {/* Leave Details Section */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>1. Leave Details</h4>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                {canSelectStaff
                  ? "By default this request is for you. Turn on 'Apply on behalf' only when submitting for someone else."
                  : "This request will be created for your linked staff profile."}
              </p>

              {canSelectStaff ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    id="apply-on-behalf"
                    type="checkbox"
                    checked={applyOnBehalf}
                    onChange={(e) => {
                      setApplyOnBehalf(e.target.checked);
                      if (!e.target.checked) {
                        setStaffId("");
                        clearFieldError("staff");
                      }
                    }}
                  />
                  <label htmlFor="apply-on-behalf" style={{ fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>
                    Apply on behalf of another employee
                  </label>
                </div>
              ) : null}
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {canSelectStaff && applyOnBehalf ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Employee *</label>
                    <select
                      value={staffId}
                      onChange={(e) => { setStaffId(e.target.value); clearFieldError("staff"); }}
                      style={{ ...fieldStyle(), borderColor: fieldErrors.staff ? "#dc2626" : "var(--line)" }}
                    >
                      <option value="">Select Employee</option>
                      {staffRows.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name} ({item.staff_no})</option>)}
                    </select>
                    {fieldErrors.staff ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.staff}</span> : null}
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Required for admin and school admin users.</span>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 4 }}>
                    <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Applying For</label>
                    <input value={effectiveStaffLabel} readOnly style={{ ...fieldStyle(), background: "#f7f7f7" }} />
                    {canSelectStaff ? (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Default is self-apply mode.</span>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Auto-detected from your account.</span>
                    )}
                    {fieldErrors.staff ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.staff}</span> : null}
                  </div>
                )}
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Application Date</label>
                  <input type="date" value={applyDate} readOnly style={{ ...fieldStyle(), background: "#f7f7f7" }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Auto-filled with today&apos;s date</span>
                </div>
                
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Leave Type *</label>
                  <select 
                    value={leaveTypeId} 
                    onChange={(e) => { setLeaveTypeId(e.target.value); clearFieldError("leaveType"); }}
                    style={{ ...fieldStyle(), borderColor: fieldErrors.leaveType ? "#dc2626" : "var(--line)" }}
                  >
                    <option value="">-- Select Leave Type --</option>
                    {leaveTypes.map((item) => <option key={item.id} value={item.id}>{item.name} (Max: {item.max_days_per_year} days)</option>)}
                  </select>
                  {fieldErrors.leaveType && <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.leaveType}</span>}
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Required field</span>
                </div>
              </div>
            </div>

            {/* Date Range Section */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>2. Leave Period</h4>
              <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "var(--text-muted)" }}>Select the date range for your leave request. You cannot request leave for past dates or more than 6 months in advance.</p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>From Date *</label>
                  <input 
                    type="date" 
                    value={fromDate}
                    onChange={(e) => { setFromDate(e.target.value); clearFieldError("fromDate"); }}
                    min={new Date().toISOString().slice(0, 10)}
                    style={{ ...fieldStyle(), borderColor: fieldErrors.fromDate ? "#dc2626" : "var(--line)" }}
                  />
                  {fieldErrors.fromDate && <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.fromDate}</span>}
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>YYYY-MM-DD format</span>
                </div>
                
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>To Date *</label>
                  <input 
                    type="date"
                    value={toDate}
                    onChange={(e) => { setToDate(e.target.value); clearFieldError("toDate"); }}
                    min={fromDate || new Date().toISOString().slice(0, 10)}
                    style={{ ...fieldStyle(), borderColor: fieldErrors.toDate ? "#dc2626" : "var(--line)" }}
                  />
                  {fieldErrors.toDate && <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.toDate}</span>}
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Must be on or after From Date</span>
                </div>
              </div>
            </div>

            {/* Reason Section */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>3. Reason for Leave</h4>
              
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                  Reason for Leave * {reason.trim().length > 0 ? `(${reason.trim().length} / ${maxReasonLength} characters)` : ""}
                </label>
                <textarea 
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); clearFieldError("reason"); }}
                  placeholder="Enter your reason for leave"
                  style={{ 
                    width: "100%", 
                    minHeight: 100, 
                    border: `1px solid ${fieldErrors.reason ? "#dc2626" : "var(--line)"}`,
                    borderRadius: 8, 
                    padding: 10,
                    fontFamily: "inherit"
                  }}
                />
                {fieldErrors.reason && <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.reason}</span>}
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {reason.trim().length === 0 ? "Required field" : "Valid length"}
                </span>
              </div>
            </div>

            {/* File Upload Section */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>4. Supporting Documents (Optional)</h4>
              <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "var(--text-muted)" }}>Upload supporting documents (PDF, JPG, PNG). File size limit: 5MB.</p>
              
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>File (Optional)</label>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAttachmentFile(file);
                      setAttachment(file.name);
                      clearFieldError("attachment");
                    }
                  }}
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ ...fieldStyle(), borderColor: fieldErrors.attachment ? "#dc2626" : "var(--line)" }}
                />
                {fieldErrors.attachment && <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.attachment}</span>}
                {attachmentFile && <div style={{ color: "#059669", fontSize: 12 }}>Γ£ô Selected: {attachmentFile.name} ({(attachmentFile.size / 1024).toFixed(2)} KB)</div>}
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Allowed: PDF, JPG, PNG | Max size: 5MB</span>
              </div>
            </div>

            {/* Submit Section */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={buttonStyle("#6b7280")} onClick={cancelEdit} disabled={saving || loading}>{editingId ? "Cancel edit" : "Reset"}</button>
              <button type="submit" style={buttonStyle()} disabled={saving || loading}>{saving ? "Saving..." : editingId ? "Save changes" : "Submit Leave Request"}</button>
            </div>
          </form>

          {error && <p style={{ color: "#dc2626", marginTop: 12, padding: 10, background: "#fee2e2", borderRadius: 6, fontSize: 13 }}>{error}</p>}
          {toast && <p style={{ color: "#059669", marginTop: 12, padding: 10, background: "#ecfdf5", borderRadius: 6, fontSize: 13 }}>{toast}</p>}
        </div>

        <div className="white-box" style={boxStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Your Leave Requests</h3>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." style={{ ...fieldStyle(), width: 200 }} />
          </div>
          {loading ? <p style={{ color: "var(--text-muted)" }}>Loading leave requests...</p> : null}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Type</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>From</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>To</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Applied</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th></tr></thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 12, textAlign: "center", color: "var(--text-muted)" }}>
                    {search ? "No leave requests match your search." : "No leave requests yet."}
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const leaveType = leaveTypes.find((item) => item.id === row.leave_type);
                return (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{leaveType?.name || row.leave_type}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.from_date}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.to_date}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.created_at ? new Date(row.created_at).toLocaleDateString() : "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 6, color: "#fff", background: statusColor(row.status), fontSize: 12 }}>
                        {statusText(row.status)}
                      </span>
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      <select
                        value={actionByRow[row.id] || ""}
                        onChange={(e) => {
                          const action = e.target.value;
                          setActionByRow((prev) => ({ ...prev, [row.id]: action }));
                          void handleRowAction(row, action);
                        }}
                        style={fieldStyle()}
                      >
                        <option value="">Action</option>
                        <option value="view">View</option>
                        {row.status === "pending" && <option value="edit">Edit</option>}
                        {row.status === "pending" && <option value="delete">Delete</option>}
                        {row.status === "pending" && canModerateLeave && <option value="approve">Approve</option>}
                        {row.status === "pending" && canModerateLeave && <option value="reject">Reject</option>}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 10, flexWrap: "wrap" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Showing {rows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalRows)} of {totalRows}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <select
                aria-label="Items per page"
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ ...fieldStyle(), width: 110, height: 34 }}
              >
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
                <option value="100">100 / page</option>
              </select>
              <button type="button" style={buttonStyle("#334155")} disabled={currentPage <= 1 || loading} onClick={() => void load(currentPage - 1)}>Previous</button>
              {buildPageButtons(currentPage, totalPages).map((page) => (
                <button
                  key={page}
                  type="button"
                  style={buttonStyle(page === currentPage ? "var(--primary)" : "#64748b")}
                  disabled={loading}
                  onClick={() => void load(page)}
                >
                  {page}
                </button>
              ))}
              <button type="button" style={buttonStyle("#334155")} disabled={currentPage >= totalPages || loading} onClick={() => void load(currentPage + 1)}>Next</button>
            </div>
          </div>
        </div>
      </div></section>
    </div>
  );
}

export function HrPayrollPanel() {
  const [rows, setRows] = useState<PayrollRecord[]>([]);
  const [staffRows, setStaffRows] = useState<Staff[]>([]);
  const [departmentRows, setDepartmentRows] = useState<Department[]>([]);
  const [designationRows, setDesignationRows] = useState<Designation[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [staffId, setStaffId] = useState("");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [basicSalary, setBasicSalary] = useState("0.00");
  const [allowance, setAllowance] = useState("0.00");
  const [allowanceItems, setAllowanceItems] = useState<PayrollComponentItem[]>([{ label: "", amount: "0.00" }]);
  const [defaultAllowanceItems, setDefaultAllowanceItems] = useState<PayrollComponentItem[]>([{ label: "", amount: "0.00" }]);
  const [deduction, setDeduction] = useState("0.00");
  const [deductionItems, setDeductionItems] = useState<PayrollComponentItem[]>([{ label: "", amount: "0.00" }]);
  const [defaultDeductionItems, setDefaultDeductionItems] = useState<PayrollComponentItem[]>([{ label: "", amount: "0.00" }]);
  const [statusFilter, setStatusFilter] = useState<"" | "draft" | "processed" | "paid">("");
  const [searchStaffId, setSearchStaffId] = useState("");
  const [searchMonth, setSearchMonth] = useState("");
  const [searchYear, setSearchYear] = useState("");
  const [bulkMonth, setBulkMonth] = useState(String(new Date().getMonth() + 1));
  const [bulkYear, setBulkYear] = useState(String(new Date().getFullYear()));
  const [bulkAllowance, setBulkAllowance] = useState("0.00");
  const [bulkDeduction, setBulkDeduction] = useState("0.00");
  const [bulkTargetScope, setBulkTargetScope] = useState<"all" | "selected">("all");
  const [bulkSelectedStaffIds, setBulkSelectedStaffIds] = useState<string[]>([]);
  const [activePayrollTab, setActivePayrollTab] = useState<"single" | "bulk" | "tracking" | "settings">("single");
  const [bulkOverwriteExisting, setBulkOverwriteExisting] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkPayrollResponse | null>(null);
  const [bulkFixNote, setBulkFixNote] = useState("");
  const [bulkDepartmentFilter, setBulkDepartmentFilter] = useState("");
  const [bulkDesignationFilter, setBulkDesignationFilter] = useState("");
  const [bulkStaffSearch, setBulkStaffSearch] = useState("");
  const [payrollPreview, setPayrollPreview] = useState<PayrollRecord | null>(null);
  const [savingPayrollSettings, setSavingPayrollSettings] = useState(false);
  const [payslipSchoolName, setPayslipSchoolName] = useState("Eskoolia School");
  const [payslipSchoolUrl, setPayslipSchoolUrl] = useState("");
  const [payslipLogoUrl, setPayslipLogoUrl] = useState("");
  const [payslipSignatureUrl, setPayslipSignatureUrl] = useState("");
  const payrollSettingsLastSavedRef = useRef("");
  const payrollSettingsHydratedRef = useRef(false);
  const payrollSettingsAutoSaveTimerRef = useRef<number | null>(null);

  const formatCurrency = (value: string | number) => {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return "0.00";
    return num.toFixed(2);
  };

  const componentTotal = (items: PayrollComponentItem[]) => {
    return items.reduce((sum, item) => {
      const amount = Number(item.amount || "0");
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  };

  const singleAllowanceTotal = useMemo(() => componentTotal(allowanceItems), [allowanceItems]);
  const singleDeductionTotal = useMemo(() => componentTotal(deductionItems), [deductionItems]);

  const payrollNetSalary = useMemo(() => {
    const basic = Number(basicSalary || "0");
    const allow = Number(allowance || "0");
    const deduct = Number(deduction || "0");
    if (!Number.isFinite(basic) || !Number.isFinite(allow) || !Number.isFinite(deduct)) return 0;
    return basic + allow - deduct;
  }, [basicSalary, allowance, deduction]);

  const payrollNetSalaryText = payrollNetSalary < 0 ? "0.00" : payrollNetSalary.toFixed(2);

  useEffect(() => {
    const nextAllowance = singleAllowanceTotal.toFixed(2);
    const nextDeduction = singleDeductionTotal.toFixed(2);
    if (allowance !== nextAllowance) setAllowance(nextAllowance);
    if (deduction !== nextDeduction) setDeduction(nextDeduction);
  }, [singleAllowanceTotal, singleDeductionTotal, allowance, deduction]);

  const bulkFilteredStaff = useMemo(() => {
    const query = bulkStaffSearch.trim().toLowerCase();
    return staffRows.filter((item) => {
      if (bulkDepartmentFilter && String(item.department ?? "") !== bulkDepartmentFilter) return false;
      if (bulkDesignationFilter && String(item.designation ?? "") !== bulkDesignationFilter) return false;
      if (!query) return true;
      const fullName = `${item.first_name} ${item.last_name}`.toLowerCase();
      return fullName.includes(query) || item.staff_no.toLowerCase().includes(query);
    });
  }, [staffRows, bulkDepartmentFilter, bulkDesignationFilter, bulkStaffSearch]);

  const bulkTargetStaff = useMemo(() => {
    if (bulkTargetScope === "all") return staffRows;
    const selectedSet = new Set(bulkSelectedStaffIds);
    return staffRows.filter((item) => selectedSet.has(String(item.id)));
  }, [bulkTargetScope, staffRows, bulkSelectedStaffIds]);

  const bulkPreviewRows = useMemo(() => {
    const commonAllowance = Number(bulkAllowance || "0");
    const commonDeduction = Number(bulkDeduction || "0");
    const safeAllowance = Number.isFinite(commonAllowance) ? commonAllowance : 0;
    const safeDeduction = Number.isFinite(commonDeduction) ? commonDeduction : 0;
    return bulkTargetStaff.map((staff) => {
      const basic = Number(staff.basic_salary || "0");
      const safeBasic = Number.isFinite(basic) ? basic : 0;
      const net = safeBasic + safeAllowance - safeDeduction;
      return {
        id: staff.id,
        staffNo: staff.staff_no,
        name: `${staff.first_name} ${staff.last_name}`.trim(),
        basic: safeBasic,
        allowance: safeAllowance,
        deduction: safeDeduction,
        net,
        isInvalid: net < 0,
      };
    });
  }, [bulkTargetStaff, bulkAllowance, bulkDeduction]);

  const bulkInvalidPreviewCount = useMemo(() => bulkPreviewRows.filter((row) => row.isInvalid).length, [bulkPreviewRows]);
  const bulkValidPreviewCount = bulkPreviewRows.length - bulkInvalidPreviewCount;
  const bulkPreviewNetTotal = useMemo(() => bulkPreviewRows.reduce((sum, row) => sum + row.net, 0), [bulkPreviewRows]);

  const load = async (page = 1, overrides?: Partial<{ statusFilter: string; searchStaffId: string; searchMonth: string; searchYear: string }>) => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const effectiveStatus = overrides?.statusFilter ?? statusFilter;
      const effectiveStaff = overrides?.searchStaffId ?? searchStaffId;
      const effectiveMonth = overrides?.searchMonth ?? searchMonth;
      const effectiveYear = overrides?.searchYear ?? searchYear;

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      params.set("ordering", "-created_at");
      if (effectiveStatus) params.set("status", effectiveStatus);
      if (effectiveStaff) params.set("staff", effectiveStaff);
      if (effectiveMonth) params.set("payroll_month", effectiveMonth);
      if (effectiveYear) params.set("payroll_year", effectiveYear);
      const suffix = params.toString() ? `?${params.toString()}` : "";

      const [payrollData, staffData, summaryData, departmentsData, designationsData, payrollSettingsData] = await Promise.all([
        apiGet<ApiList<PayrollRecord>>(`/api/v1/hr/payroll/${suffix}`),
        fetchAllPages<Staff>("/api/v1/hr/staff/?status=active&page_size=100"),
        apiGet<PayrollSummary>(`/api/v1/hr/payroll/summary/${suffix}`),
        fetchAllPages<Department>("/api/v1/hr/departments/?is_active=true&page_size=100"),
        fetchAllPages<Designation>("/api/v1/hr/designations/?is_active=true&page_size=100"),
        apiGet<PayrollSettings>("/api/v1/hr/payroll/settings/"),
      ]);
      setRows(listData(payrollData));
      const meta = listPaginationMeta(payrollData, pageSize);
      setCurrentPage(page);
      setTotalRows(meta.count);
      setTotalPages(meta.totalPages);
      setStaffRows(staffData);
      setDepartmentRows(departmentsData);
      setDesignationRows(designationsData);
      setSummary(summaryData);
      setPayslipSchoolName(payrollSettingsData.school_name || "Eskoolia School");
      setPayslipSchoolUrl(payrollSettingsData.school_url || "");
      setPayslipLogoUrl(payrollSettingsData.logo_url || "");
      setPayslipSignatureUrl(payrollSettingsData.signature_url || "");
      setDefaultAllowanceItems(cloneComponentItems(payrollSettingsData.default_allowance_items || []));
      setDefaultDeductionItems(cloneComponentItems(payrollSettingsData.default_deduction_items || []));
      payrollSettingsLastSavedRef.current = buildPayrollSettingsSnapshot({
        school_name: payrollSettingsData.school_name || "Eskoolia School",
        school_url: payrollSettingsData.school_url || "",
        logo_url: payrollSettingsData.logo_url || "",
        signature_url: payrollSettingsData.signature_url || "",
        default_allowance_items: cloneComponentItems(payrollSettingsData.default_allowance_items || []),
        default_deduction_items: cloneComponentItems(payrollSettingsData.default_deduction_items || []),
      });
      payrollSettingsHydratedRef.current = true;
    } catch {
      setError("Unable to load payroll records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
  }, [pageSize]);

  const runSearch = async () => {
    await load(1);
  };

  const resetSearch = async () => {
    const cleared = { statusFilter: "", searchStaffId: "", searchMonth: "", searchYear: "" };
    setStatusFilter(cleared.statusFilter as "" | "draft" | "processed" | "paid");
    setSearchStaffId(cleared.searchStaffId);
    setSearchMonth(cleared.searchMonth);
    setSearchYear(cleared.searchYear);
    await load(1, cleared);
  };

  const normalizeComponentItems = (items: PayrollComponentItem[]) => {
    return items
      .map((item) => ({
        label: (item.label || "").trim(),
        amount: formatCurrency(item.amount || "0"),
      }))
      .filter((item) => item.label || Number(item.amount) !== 0);
  };

  const cloneComponentItems = (items: PayrollComponentItem[]) => {
    if (!Array.isArray(items) || items.length === 0) return [{ label: "", amount: "0.00" }];
    return items.map((item) => ({
      label: String(item.label || ""),
      amount: formatCurrency(item.amount || "0"),
    }));
  };

  const buildPayrollSettingsPayload = () => ({
    school_name: payslipSchoolName.trim(),
    school_url: payslipSchoolUrl.trim(),
    logo_url: payslipLogoUrl.trim(),
    signature_url: payslipSignatureUrl.trim(),
    default_allowance_items: normalizeComponentItems(defaultAllowanceItems),
    default_deduction_items: normalizeComponentItems(defaultDeductionItems),
  });

  const buildPayrollSettingsSnapshot = (payload: ReturnType<typeof buildPayrollSettingsPayload>) => JSON.stringify(payload);

  const parseStaffDefaultItems = (value: unknown): PayrollComponentItem[] => {
    if (!Array.isArray(value)) return [];
    const normalized = value
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const row = entry as Record<string, unknown>;
        const label = String(row.label ?? row.name ?? row.title ?? "").trim();
        const amountSource = row.amount ?? row.value ?? "0";
        const amount = formatCurrency(typeof amountSource === "number" ? amountSource : String(amountSource));
        if (!label && Number(amount) === 0) return null;
        return { label, amount };
      })
      .filter((item): item is PayrollComponentItem => Boolean(item));
    return normalized;
  };

  const applyStaffPayrollDefaults = (nextStaffId: string) => {
    setStaffId(nextStaffId);
    const selected = staffRows.find((item) => String(item.id) === nextStaffId);
    if (!selected) {
      setBasicSalary("0.00");
      setAllowanceItems(cloneComponentItems(defaultAllowanceItems));
      setDeductionItems(cloneComponentItems(defaultDeductionItems));
      return;
    }

    setBasicSalary(formatCurrency(selected.basic_salary || "0"));

    const custom = selected.custom_field;
    const payrollDefaults =
      custom && typeof custom === "object"
        ? (custom as { payroll_defaults?: unknown }).payroll_defaults
        : undefined;

    if (!payrollDefaults || typeof payrollDefaults !== "object") {
      setAllowanceItems(cloneComponentItems(defaultAllowanceItems));
      setDeductionItems(cloneComponentItems(defaultDeductionItems));
      return;
    }

    const defaults = payrollDefaults as { allowance_items?: unknown; deduction_items?: unknown };
    const staffAllowanceDefaults = parseStaffDefaultItems(defaults.allowance_items);
    const staffDeductionDefaults = parseStaffDefaultItems(defaults.deduction_items);
    setAllowanceItems(staffAllowanceDefaults.length > 0 ? staffAllowanceDefaults : cloneComponentItems(defaultAllowanceItems));
    setDeductionItems(staffDeductionDefaults.length > 0 ? staffDeductionDefaults : cloneComponentItems(defaultDeductionItems));
  };

  const applyGlobalPayrollDefaultsToForm = () => {
    setAllowanceItems(cloneComponentItems(defaultAllowanceItems));
    setDeductionItems(cloneComponentItems(defaultDeductionItems));
  };

  const savePayrollSettings = async () => {
    try {
      setSavingPayrollSettings(true);
      setError("");
      setSuccess("");

      const payload = buildPayrollSettingsPayload();

      const updated = await apiPatch<PayrollSettings>("/api/v1/hr/payroll/settings/", payload);
      setDefaultAllowanceItems(cloneComponentItems(updated.default_allowance_items || []));
      setDefaultDeductionItems(cloneComponentItems(updated.default_deduction_items || []));
      payrollSettingsLastSavedRef.current = buildPayrollSettingsSnapshot({
        school_name: updated.school_name || payload.school_name,
        school_url: updated.school_url || payload.school_url,
        logo_url: updated.logo_url || payload.logo_url,
        signature_url: updated.signature_url || payload.signature_url,
        default_allowance_items: cloneComponentItems(updated.default_allowance_items || payload.default_allowance_items),
        default_deduction_items: cloneComponentItems(updated.default_deduction_items || payload.default_deduction_items),
      });
      setSuccess("Payroll settings saved successfully.");
    } catch {
      setError("Unable to save payroll settings.");
    } finally {
      setSavingPayrollSettings(false);
    }
  };

  const updateAllowanceItem = (index: number, key: "label" | "amount", value: string) => {
    setDefaultAllowanceItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));
  };

  const addAllowanceItem = () => {
    setDefaultAllowanceItems((prev) => [...prev, { label: "", amount: "0.00" }]);
  };

  const removeAllowanceItem = (index: number) => {
    setDefaultAllowanceItems((prev) => {
      const next = prev.filter((_item, idx) => idx !== index);
      return next.length > 0 ? next : [{ label: "", amount: "0.00" }];
    });
  };

  const updateDeductionItem = (index: number, key: "label" | "amount", value: string) => {
    setDefaultDeductionItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));
  };

  const addDeductionItem = () => {
    setDefaultDeductionItems((prev) => [...prev, { label: "", amount: "0.00" }]);
  };

  const removeDeductionItem = (index: number) => {
    setDefaultDeductionItems((prev) => {
      const next = prev.filter((_item, idx) => idx !== index);
      return next.length > 0 ? next : [{ label: "", amount: "0.00" }];
    });
  };

  useEffect(() => {
    if (!payrollSettingsHydratedRef.current) return;
    if (activePayrollTab !== "settings") return;

    const payload = buildPayrollSettingsPayload();
    const nextSnapshot = buildPayrollSettingsSnapshot(payload);
    if (nextSnapshot === payrollSettingsLastSavedRef.current) return;

    if (payrollSettingsAutoSaveTimerRef.current) {
      window.clearTimeout(payrollSettingsAutoSaveTimerRef.current);
    }

    payrollSettingsAutoSaveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          setSavingPayrollSettings(true);
          const updated = await apiPatch<PayrollSettings>("/api/v1/hr/payroll/settings/", payload);
          payrollSettingsLastSavedRef.current = buildPayrollSettingsSnapshot({
            school_name: updated.school_name || payload.school_name,
            school_url: updated.school_url || payload.school_url,
            logo_url: updated.logo_url || payload.logo_url,
            signature_url: updated.signature_url || payload.signature_url,
            default_allowance_items: cloneComponentItems(updated.default_allowance_items || payload.default_allowance_items),
            default_deduction_items: cloneComponentItems(updated.default_deduction_items || payload.default_deduction_items),
          });
          setSuccess("Payroll settings saved automatically.");
        } catch {
          setError("Unable to auto-save payroll settings.");
        } finally {
          setSavingPayrollSettings(false);
        }
      })();
    }, 700);

    return () => {
      if (payrollSettingsAutoSaveTimerRef.current) {
        window.clearTimeout(payrollSettingsAutoSaveTimerRef.current);
      }
    };
  }, [
    activePayrollTab,
    payslipSchoolName,
    payslipSchoolUrl,
    payslipLogoUrl,
    payslipSignatureUrl,
    defaultAllowanceItems,
    defaultDeductionItems,
  ]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!staffId || !month || !year) {
      setError("Staff, month and year are required.");
      setSuccess("");
      return;
    }
    if (payrollNetSalary < 0) {
      setError("Deduction cannot be greater than basic salary plus allowance.");
      setSuccess("");
      return;
    }
    try {
      setError("");
      setSuccess("");
      await apiPost("/api/v1/hr/payroll/", {
        staff: Number(staffId),
        payroll_month: Number(month),
        payroll_year: Number(year),
        basic_salary: basicSalary || "0.00",
        allowance: allowance || "0.00",
        allowance_items: normalizeComponentItems(allowanceItems),
        deduction: deduction || "0.00",
        deduction_items: normalizeComponentItems(deductionItems),
      });
      setStaffId("");
      setBasicSalary("0.00");
      setAllowance("0.00");
      setAllowanceItems(cloneComponentItems(defaultAllowanceItems));
      setDeduction("0.00");
      setDeductionItems(cloneComponentItems(defaultDeductionItems));
      setSuccess("Single payroll record created successfully.");
      await load(currentPage);
    } catch {
      setError("Unable to save payroll record.");
      setSuccess("");
    }
  };

  const markPaid = async (id: number) => {
    try {
      setError("");
      setSuccess("");
      await apiPost(`/api/v1/hr/payroll/${id}/mark-paid/`, {});
      setSuccess("Payroll marked as paid successfully.");
      await load(currentPage);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to mark payroll as paid.";
      setError(message || "Unable to mark payroll as paid.");
    }
  };

  const markApproved = async (id: number) => {
    try {
      setError("");
      setSuccess("");
      await apiPost(`/api/v1/hr/payroll/${id}/mark-processed/`, {});
      setSuccess("Payroll approved successfully.");
      await load(currentPage);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to approve payroll.";
      setError(message || "Unable to approve payroll.");
    }
  };

  const generateBulkPayroll = async () => {
    if (!bulkMonth || !bulkYear) {
      setError("Bulk payroll month and year are required.");
      return;
    }

    if (bulkTargetScope === "selected" && bulkTargetStaff.length === 0) {
      setError("Please select at least one staff member for selected-scope bulk generation.");
      return;
    }

    const targetText = bulkTargetScope === "all" ? "all active staff" : `${bulkTargetStaff.length} selected staff`;
    const proceed = window.confirm(`Generate payroll for ${targetText} for this period?`);
    if (!proceed) return;

    try {
      setBulkRunning(true);
      setError("");
      setBulkResult(null);
      const result = await apiPost<BulkPayrollResponse>("/api/v1/hr/payroll/bulk-generate/", {
        payroll_month: Number(bulkMonth),
        payroll_year: Number(bulkYear),
        allowance: bulkAllowance || "0.00",
        deduction: bulkDeduction || "0.00",
        overwrite_existing: bulkOverwriteExisting,
        staff_ids: bulkTargetScope === "selected" ? bulkTargetStaff.map((item) => item.id) : undefined,
      });
      setBulkResult(result);
      setSearchMonth(String(bulkMonth));
      setSearchYear(String(bulkYear));
      await load(1, {
        searchMonth: String(bulkMonth),
        searchYear: String(bulkYear),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to generate bulk payroll.";
      setError(message || "Unable to generate bulk payroll.");
    } finally {
      setBulkRunning(false);
    }
  };

  const selectAllVisibleBulkStaff = () => {
    const merged = new Set<string>(bulkSelectedStaffIds);
    bulkFilteredStaff.forEach((item) => merged.add(String(item.id)));
    setBulkSelectedStaffIds(Array.from(merged));
  };

  const clearBulkSelection = () => {
    setBulkSelectedStaffIds([]);
  };

  const autoFixBulkInvalidRows = () => {
    if (bulkPreviewRows.length === 0) {
      setError("No preview rows available for auto-fix.");
      return;
    }
    if (bulkInvalidPreviewCount === 0) {
      setBulkFixNote("No invalid rows found. No changes were needed.");
      return;
    }

    const minAllowedDeduction = bulkPreviewRows.reduce((minValue, row) => {
      return Math.min(minValue, row.basic + row.allowance);
    }, Number.POSITIVE_INFINITY);

    const fixedDeduction = Math.max(0, minAllowedDeduction);
    setBulkDeduction(fixedDeduction.toFixed(2));
    setBulkFixNote(`Common deduction auto-adjusted to ${fixedDeduction.toFixed(2)} so all preview rows remain non-negative.`);
    setError("");
  };

  const exportBulkPreviewCsv = async () => {
    if (bulkPreviewRows.length === 0) {
      setError("No preview rows available to export.");
      return;
    }

    const exportRows = bulkPreviewRows.map((row) => ({
      "Staff Name": row.name,
      "Staff No": row.staffNo,
      "Payroll Month": bulkMonth,
      "Payroll Year": bulkYear,
      Basic: row.basic.toFixed(2),
      Allowance: row.allowance.toFixed(2),
      Deduction: row.deduction.toFixed(2),
      Net: row.net.toFixed(2),
      Validity: row.isInvalid ? "Invalid (negative net)" : "Valid",
    }));

    const XLSX = await getXLSX();
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bulk Payroll Preview");
    const buffer = XLSX.write(workbook, { bookType: "csv", type: "array" });
    const blob = new Blob([buffer], { type: "text/csv;charset=utf-8;" });
    const filename = `bulk-payroll-preview-${bulkYear}-${String(bulkMonth).padStart(2, "0")}.csv`;
    downloadBlobFile(filename, blob);
  };

  const exportBulkInvalidRowsCsv = async () => {
    const invalidRows = bulkPreviewRows.filter((row) => row.isInvalid);
    if (invalidRows.length === 0) {
      setError("No invalid preview rows available to export.");
      return;
    }

    const exportRows = invalidRows.map((row) => ({
      "Staff Name": row.name,
      "Staff No": row.staffNo,
      "Payroll Month": bulkMonth,
      "Payroll Year": bulkYear,
      Basic: row.basic.toFixed(2),
      Allowance: row.allowance.toFixed(2),
      Deduction: row.deduction.toFixed(2),
      Net: row.net.toFixed(2),
      Issue: "Negative net salary",
    }));

    const XLSX = await getXLSX();
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invalid Payroll Rows");
    const buffer = XLSX.write(workbook, { bookType: "csv", type: "array" });
    const blob = new Blob([buffer], { type: "text/csv;charset=utf-8;" });
    const filename = `bulk-payroll-invalid-${bulkYear}-${String(bulkMonth).padStart(2, "0")}.csv`;
    downloadBlobFile(filename, blob);
  };

  const previewPayrollTemplate = (row: PayrollRecord) => {
    setPayrollPreview(row);
  };

  const downloadPayrollTemplate = async (row: PayrollRecord) => {
    const staff = staffRows.find((item) => item.id === row.staff);
    const staffName = row.staff_name || (staff ? `${staff.first_name} ${staff.last_name}` : `Staff ${row.staff}`);
    const staffNo = row.staff_no || staff?.staff_no || "";

    const exportRows = [
      { Field: "Staff Name", Value: staffName },
      { Field: "Staff Number", Value: staffNo },
      { Field: "Payroll Month", Value: String(row.payroll_month) },
      { Field: "Payroll Year", Value: String(row.payroll_year) },
      { Field: "Basic Salary", Value: formatCurrency(row.basic_salary) },
      { Field: "Allowance", Value: formatCurrency(row.allowance) },
      { Field: "Deduction", Value: formatCurrency(row.deduction) },
      { Field: "Net Salary", Value: formatCurrency(row.net_salary) },
      { Field: "Status", Value: row.status },
      { Field: "Paid At", Value: row.paid_at || "-" },
    ];

    const XLSX = await getXLSX();
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll Template");
    const buffer = XLSX.write(workbook, { bookType: "csv", type: "array" });
    const blob = new Blob([buffer], { type: "text/csv;charset=utf-8;" });
    const safeStaff = (staffName || "staff").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
    const filename = `payroll-template-${row.payroll_year}-${String(row.payroll_month).padStart(2, "0")}-${safeStaff || row.staff}.csv`;
    downloadBlobFile(filename, blob);
  };

  const getComponentLines = (row: PayrollRecord, type: "allowance" | "deduction") => {
    const raw = type === "allowance" ? row.allowance_items : row.deduction_items;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw
        .map((item) => ({
          label: String(item.label || "Component").trim() || "Component",
          amount: formatCurrency(item.amount || "0"),
        }))
        .filter((item) => item.label || Number(item.amount) !== 0);
    }
    return [{
      label: type === "allowance" ? "Allowance" : "Deduction",
      amount: formatCurrency(type === "allowance" ? row.allowance : row.deduction),
    }];
  };

  const downloadPayrollPdf = async (row: PayrollRecord) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const staffName = row.staff_name || String(row.staff);
    const staffNo = row.staff_no || "-";
    const allowanceLines = getComponentLines(row, "allowance");
    const deductionLines = getComponentLines(row, "deduction");
    let y = 18;

    doc.setFontSize(16);
    doc.text(payslipSchoolName || "Payroll Payslip", 14, y);
    y += 7;
    doc.setFontSize(14);
    doc.text("Payroll Payslip", 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(`Month/Year: ${row.payroll_month}/${row.payroll_year}`, 14, y);
    doc.text(`Status: ${row.status}`, 150, y);
    if (payslipSchoolUrl) {
      y += 6;
      doc.text(`Website: ${payslipSchoolUrl}`, 14, y);
    }
    y += 11;

    doc.setFontSize(11);
    doc.text(`Employee: ${staffName}`, 14, y);
    y += 7;
    doc.text(`Employee No: ${staffNo}`, 14, y);
    y += 7;

    doc.setDrawColor(209, 213, 219);
    doc.rect(14, y, 182, 84);

    let lineY = y + 10;
    doc.text("Basic Salary", 20, lineY);
    doc.text(formatCurrency(row.basic_salary), 175, lineY, { align: "right" });
    lineY += 8;

    allowanceLines.forEach((line) => {
      doc.text(`Allowance - ${line.label}`, 20, lineY);
      doc.text(line.amount, 175, lineY, { align: "right" });
      lineY += 7;
    });

    deductionLines.forEach((line) => {
      doc.text(`Deduction - ${line.label}`, 20, lineY);
      doc.text(line.amount, 175, lineY, { align: "right" });
      lineY += 7;
    });

    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text("Net Salary", 20, y + 75);
    doc.text(formatCurrency(row.net_salary), 175, y + 75, { align: "right" });
    doc.setTextColor(17, 24, 39);

    doc.setFontSize(9);
    doc.text(`Paid At: ${row.paid_at || "-"}`, 14, y + 92);
    doc.text(`School URL: ${payslipSchoolUrl || "-"}`, 14, y + 98);
    doc.text(`Logo URL: ${payslipLogoUrl || "-"}`, 14, y + 104);
    doc.text(`Signature URL: ${payslipSignatureUrl || "-"}`, 14, y + 110);
    doc.text("Generated by Eskoolia Payroll", 14, y + 116);

    const safeStaff = (staffName || "staff").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
    doc.save(`payroll-payslip-${row.payroll_year}-${String(row.payroll_month).padStart(2, "0")}-${safeStaff || row.staff}.pdf`);
  };

  const printPayrollPayslip = (row: PayrollRecord) => {
    const salaryBasic = formatCurrency(row.basic_salary);
    const salaryNet = formatCurrency(row.net_salary);
    const staffName = row.staff_name || String(row.staff);
    const staffNo = row.staff_no || "-";
    const allowanceLines = getComponentLines(row, "allowance");
    const deductionLines = getComponentLines(row, "deduction");

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      setError("Popup blocked. Please allow popups to print payslip.");
      return;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payslip ${row.payroll_month}/${row.payroll_year}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
    .card { border: 1px solid #d1d5db; border-radius: 10px; padding: 18px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .title { font-size: 22px; font-weight: 700; margin: 0; }
    .sub { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
    .item { font-size: 13px; }
    .label { color: #6b7280; margin-right: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 13px; }
    th { background: #f3f4f6; text-align: left; }
    .amount { text-align: right; }
    .net { font-weight: 700; background: #eef2ff; }
    .footer { margin-top: 22px; display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <p class="title">${payslipSchoolName || "Payroll Payslip"}</p>
        ${payslipSchoolUrl ? `<p class="sub">${payslipSchoolUrl}</p>` : ""}
        <p class="sub">Month ${row.payroll_month} / ${row.payroll_year}</p>
      </div>
      <div class="item"><span class="label">Status:</span><strong style="text-transform: capitalize;">${row.status}</strong></div>
    </div>

    ${payslipLogoUrl ? `<div style="margin-bottom:12px;"><img src="${payslipLogoUrl}" alt="School Logo" style="max-height:72px;" /></div>` : ""}

    <div class="grid">
      <div class="item"><span class="label">Employee:</span><strong>${staffName}</strong></div>
      <div class="item"><span class="label">Employee No:</span><strong>${staffNo}</strong></div>
      <div class="item"><span class="label">Payroll Month:</span><strong>${row.payroll_month}</strong></div>
      <div class="item"><span class="label">Payroll Year:</span><strong>${row.payroll_year}</strong></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Component</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Basic Salary</td>
          <td class="amount">${salaryBasic}</td>
        </tr>
        ${allowanceLines.map((line) => `<tr><td>Allowance - ${line.label}</td><td class="amount">${line.amount}</td></tr>`).join("")}
        ${deductionLines.map((line) => `<tr><td>Deduction - ${line.label}</td><td class="amount">${line.amount}</td></tr>`).join("")}
        <tr class="net">
          <td>Net Salary</td>
          <td class="amount">${salaryNet}</td>
        </tr>
      </tbody>
    </table>

    ${payslipSignatureUrl ? `<div style="margin-top:18px;"><img src="${payslipSignatureUrl}" alt="Authorized Signature" style="max-height:54px;" /><div style="font-size:12px;color:#6b7280;">Authorized Signature</div></div>` : ""}

    <div class="footer">
      <span>Paid At: ${row.paid_at || "-"}</span>
      <span>Generated by Eskoolia Payroll</span>
    </div>
  </div>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Payroll")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={buttonStyle(activePayrollTab === "single" ? "var(--primary)" : "#64748b")}
              onClick={() => setActivePayrollTab("single")}
            >
              Single Entry
            </button>
            <button
              type="button"
              style={buttonStyle(activePayrollTab === "bulk" ? "var(--primary)" : "#64748b")}
              onClick={() => setActivePayrollTab("bulk")}
            >
              Bulk Generation
            </button>
            <button
              type="button"
              style={buttonStyle(activePayrollTab === "settings" ? "var(--primary)" : "#64748b")}
              onClick={() => setActivePayrollTab("settings")}
            >
              Payroll Settings
            </button>
            <button
              type="button"
              style={buttonStyle(activePayrollTab === "tracking" ? "var(--primary)" : "#64748b")}
              onClick={() => setActivePayrollTab("tracking")}
            >
              Tracking and Records
            </button>
          </div>
        </div>

        {error ? (
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <p style={{ color: "var(--warning)", margin: 0 }}>{error}</p>
          </div>
        ) : null}
        {success ? (
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <p style={{ color: "#16a34a", margin: 0 }}>{success}</p>
          </div>
        ) : null}

        {activePayrollTab === "single" ? (
        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Create Payroll Entry</h3>
              <p style={{ margin: "6px 0 0 0", color: "var(--text-muted)", fontSize: 12 }}>
                Add one month payroll for a staff member. Net salary is auto-calculated.
              </p>
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${payrollNetSalary < 0 ? "#fecaca" : "#c7d2fe"}`,
                background: payrollNetSalary < 0 ? "#fef2f2" : "#eef2ff",
                color: payrollNetSalary < 0 ? "#b91c1c" : "#4338ca",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Net Preview: {payrollNetSalaryText}
            </div>
          </div>

          <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, alignItems: "end" }}>
            <div>
              <label htmlFor="payroll-staff" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Staff</label>
              <select id="payroll-staff" value={staffId} onChange={(e) => applyStaffPayrollDefaults(e.target.value)} style={fieldStyle()}>
                <option value="">Select Staff</option>
                {staffRows.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name} ({item.staff_no})</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="payroll-month" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Month</label>
              <input id="payroll-month" type="number" min="1" max="12" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="Month" style={fieldStyle()} />
            </div>

            <div>
              <label htmlFor="payroll-year" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Year</label>
              <input id="payroll-year" type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" style={fieldStyle()} />
            </div>

            <div>
              <label htmlFor="payroll-basic" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Basic Salary</label>
              <input id="payroll-basic" type="number" min="0" step="0.01" value={basicSalary} onChange={(e) => setBasicSalary(e.target.value)} placeholder="Basic Salary" style={fieldStyle()} />
            </div>

            <div>
              <label htmlFor="payroll-allowance" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Total Allowance</label>
              <input id="payroll-allowance" type="number" min="0" step="0.01" value={allowance} readOnly style={{ ...fieldStyle(), background: "#f8fafc" }} />
            </div>

            <div>
              <label htmlFor="payroll-deduction" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Total Deduction</label>
              <input id="payroll-deduction" type="number" min="0" step="0.01" value={deduction} readOnly style={{ ...fieldStyle(), background: "#f8fafc", borderColor: payrollNetSalary < 0 ? "#dc2626" : "var(--line)" }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, color: "transparent", marginBottom: 4 }} aria-hidden="true">Action</label>
              <button type="submit" style={{ ...buttonStyle(), width: "100%", minWidth: 130 }} disabled={loading}>Save Payroll</button>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "transparent", marginBottom: 4 }} aria-hidden="true">Action</label>
              <button type="button" style={{ ...buttonStyle("#2563eb"), width: "100%", minWidth: 130 }} onClick={applyGlobalPayrollDefaultsToForm}>
                Use Payroll Defaults
              </button>
            </div>
          </form>

          <p style={{ margin: "10px 0 0 0", color: "var(--text-muted)", fontSize: 12 }}>
            Allowance and deduction defaults are managed in Payroll Settings tab.
          </p>

          {payrollNetSalary < 0 ? <p style={{ color: "#dc2626", marginTop: 8, marginBottom: 0, fontSize: 12 }}>Deduction cannot be greater than basic salary plus allowance.</p> : null}
        </div>
        ) : null}

        {activePayrollTab === "bulk" ? (
        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Bulk Payroll Generation</h3>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Generate payroll for all active staff in one action</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, alignItems: "end" }}>
            <div>
              <label htmlFor="bulk-payroll-scope" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Target Scope</label>
              <select
                id="bulk-payroll-scope"
                value={bulkTargetScope}
                onChange={(e) => {
                  const nextScope = e.target.value as "all" | "selected";
                  setBulkTargetScope(nextScope);
                  if (nextScope === "all") {
                    setBulkSelectedStaffIds([]);
                  }
                }}
                style={fieldStyle()}
              >
                <option value="all">All Active Staff</option>
                <option value="selected">Selected Staff Only</option>
              </select>
            </div>

            <div>
              <label htmlFor="bulk-payroll-month" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Month</label>
              <input id="bulk-payroll-month" type="number" min="1" max="12" value={bulkMonth} onChange={(e) => setBulkMonth(e.target.value)} style={fieldStyle()} />
            </div>

            <div>
              <label htmlFor="bulk-payroll-year" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Year</label>
              <input id="bulk-payroll-year" type="number" min="2000" max="2100" value={bulkYear} onChange={(e) => setBulkYear(e.target.value)} style={fieldStyle()} />
            </div>

            <div>
              <label htmlFor="bulk-payroll-allowance" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Common Allowance</label>
              <input id="bulk-payroll-allowance" type="number" min="0" step="0.01" value={bulkAllowance} onChange={(e) => setBulkAllowance(e.target.value)} style={fieldStyle()} />
            </div>

            <div>
              <label htmlFor="bulk-payroll-deduction" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Common Deduction</label>
              <input id="bulk-payroll-deduction" type="number" min="0" step="0.01" value={bulkDeduction} onChange={(e) => setBulkDeduction(e.target.value)} style={fieldStyle()} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40 }}>
              <input
                id="bulk-payroll-overwrite"
                type="checkbox"
                checked={bulkOverwriteExisting}
                onChange={(e) => setBulkOverwriteExisting(e.target.checked)}
              />
              <label htmlFor="bulk-payroll-overwrite" style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                Overwrite existing (except paid)
              </label>
            </div>

            <div>
              <button
                type="button"
                style={{ ...buttonStyle("#0f766e"), width: "100%", minWidth: 160 }}
                disabled={bulkRunning || loading}
                onClick={() => void generateBulkPayroll()}
              >
                {bulkRunning ? "Generating..." : "Generate Bulk Payroll"}
              </button>
            </div>
          </div>

          {bulkTargetScope === "selected" ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 8 }}>
                <div>
                  <label htmlFor="bulk-filter-department" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Department</label>
                  <select
                    id="bulk-filter-department"
                    value={bulkDepartmentFilter}
                    onChange={(e) => {
                      setBulkDepartmentFilter(e.target.value);
                      setBulkDesignationFilter("");
                    }}
                    style={fieldStyle()}
                  >
                    <option value="">All Departments</option>
                    {departmentRows.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="bulk-filter-designation" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Designation</label>
                  <select
                    id="bulk-filter-designation"
                    value={bulkDesignationFilter}
                    onChange={(e) => setBulkDesignationFilter(e.target.value)}
                    style={fieldStyle()}
                  >
                    <option value="">All Designations</option>
                    {designationRows
                      .filter((item) => !bulkDepartmentFilter || String(item.department) === bulkDepartmentFilter)
                      .map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="bulk-filter-search" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Search Staff</label>
                  <input
                    id="bulk-filter-search"
                    type="text"
                    value={bulkStaffSearch}
                    onChange={(e) => setBulkStaffSearch(e.target.value)}
                    placeholder="Name or staff no"
                    style={fieldStyle()}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  Visible staff: {bulkFilteredStaff.length} | Selected: {bulkSelectedStaffIds.length}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" style={buttonStyle("#2563eb")} onClick={selectAllVisibleBulkStaff}>Select All Visible</button>
                  <button type="button" style={buttonStyle("#6b7280")} onClick={clearBulkSelection}>Clear Selection</button>
                </div>
              </div>

              <label htmlFor="bulk-payroll-selected-staff" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                Select Staff ({bulkSelectedStaffIds.length} selected)
              </label>
              <select
                id="bulk-payroll-selected-staff"
                multiple
                value={bulkSelectedStaffIds}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((option) => option.value);
                  setBulkSelectedStaffIds(selected);
                }}
                style={{ ...fieldStyle(), minHeight: 150 }}
              >
                {bulkFilteredStaff.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.first_name} {item.last_name} ({item.staff_no})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 8, padding: 10, background: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Bulk Preview</h4>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  Target: {bulkTargetScope === "all" ? "All Active Staff" : "Selected Staff Only"}
                </div>
                <button
                  type="button"
                  style={buttonStyle("#1d4ed8")}
                  onClick={exportBulkPreviewCsv}
                  disabled={bulkPreviewRows.length === 0}
                >
                  Export Preview CSV
                </button>
                <button
                  type="button"
                  style={buttonStyle("#b91c1c")}
                  onClick={exportBulkInvalidRowsCsv}
                  disabled={bulkInvalidPreviewCount === 0}
                >
                  Export Invalid Rows
                </button>
                <button
                  type="button"
                  style={buttonStyle("#c2410c")}
                  onClick={autoFixBulkInvalidRows}
                  disabled={bulkPreviewRows.length === 0}
                >
                  Auto-fix Invalid
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 10 }}>
              <div style={{ padding: 8, border: "1px solid var(--line)", borderRadius: 6, background: "#fff" }}>Rows: <strong>{bulkPreviewRows.length}</strong></div>
              <div style={{ padding: 8, border: "1px solid var(--line)", borderRadius: 6, background: "#fff" }}>Valid: <strong style={{ color: "#065f46" }}>{bulkValidPreviewCount}</strong></div>
              <div style={{ padding: 8, border: "1px solid var(--line)", borderRadius: 6, background: "#fff" }}>Invalid: <strong style={{ color: bulkInvalidPreviewCount > 0 ? "#b91c1c" : "#065f46" }}>{bulkInvalidPreviewCount}</strong></div>
              <div style={{ padding: 8, border: "1px solid var(--line)", borderRadius: 6, background: "#fff" }}>Estimated Net: <strong>{bulkPreviewNetTotal.toFixed(2)}</strong></div>
            </div>

            {bulkInvalidPreviewCount > 0 ? (
              <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#b91c1c" }}>
                Warning: {bulkInvalidPreviewCount} rows have negative net salary and will be skipped during generation.
              </p>
            ) : null}
            {bulkFixNote ? (
              <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#065f46" }}>
                {bulkFixNote}
              </p>
            ) : null}

            <div style={{ overflowX: "auto", maxHeight: 260 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
                <thead>
                  <tr style={{ background: "#eef2ff" }}>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Staff</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Staff No</th>
                    <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid var(--line)" }}>Basic</th>
                    <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid var(--line)" }}>Allowance</th>
                    <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid var(--line)" }}>Deduction</th>
                    <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid var(--line)" }}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkPreviewRows.slice(0, 25).map((row) => (
                    <tr key={row.id} style={{ background: row.isInvalid ? "#fef2f2" : "transparent" }}>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.name || "-"}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.staffNo}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "right" }}>{row.basic.toFixed(2)}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "right" }}>{row.allowance.toFixed(2)}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "right" }}>{row.deduction.toFixed(2)}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "right", color: row.isInvalid ? "#b91c1c" : "inherit", fontWeight: row.isInvalid ? 700 : 500 }}>
                        {row.net.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {bulkPreviewRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 10, textAlign: "center", color: "var(--text-muted)" }}>
                        No rows to preview.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {bulkPreviewRows.length > 25 ? (
              <p style={{ margin: "8px 0 0 0", color: "var(--text-muted)", fontSize: 12 }}>
                Showing first 25 rows of {bulkPreviewRows.length} preview rows.
              </p>
            ) : null}
          </div>

          {bulkResult ? (
            <div style={{ marginTop: 10, padding: 10, border: "1px solid var(--line)", borderRadius: 8, background: "#f8fafc", fontSize: 13 }}>
              <strong>{bulkResult.detail}</strong>
              <div style={{ marginTop: 6, color: "var(--text-muted)" }}>
                Total staff: {bulkResult.total_staff} | Created: {bulkResult.created_count} | Updated: {bulkResult.updated_count} | Existing skipped: {bulkResult.skipped_existing} | Paid skipped: {bulkResult.skipped_paid} | Invalid skipped: {bulkResult.skipped_invalid}
              </div>
            </div>
          ) : null}
        </div>
        ) : null}

        {activePayrollTab === "settings" ? (
        <>
        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 10 }}>Payslip Branding Settings</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>School Name</label>
              <input type="text" value={payslipSchoolName} onChange={(e) => setPayslipSchoolName(e.target.value)} style={fieldStyle()} placeholder="School Name" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>School URL</label>
              <input type="text" value={payslipSchoolUrl} onChange={(e) => setPayslipSchoolUrl(e.target.value)} style={fieldStyle()} placeholder="https://your-school-site.com" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>School Logo URL</label>
              <input type="text" value={payslipLogoUrl} onChange={(e) => setPayslipLogoUrl(e.target.value)} style={fieldStyle()} placeholder="https://.../logo.png" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Signature URL</label>
              <input type="text" value={payslipSignatureUrl} onChange={(e) => setPayslipSignatureUrl(e.target.value)} style={fieldStyle()} placeholder="https://.../signature.png" />
            </div>
          </div>
          {(payslipLogoUrl || payslipSignatureUrl) ? (
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              {payslipLogoUrl ? <img src={payslipLogoUrl} alt="School logo preview" style={{ maxHeight: 64, border: "1px solid var(--line)", borderRadius: 6, padding: 6, background: "#fff" }} /> : null}
              {payslipSignatureUrl ? <img src={payslipSignatureUrl} alt="Signature preview" style={{ maxHeight: 48, border: "1px solid var(--line)", borderRadius: 6, padding: 6, background: "#fff" }} /> : null}
            </div>
          ) : null}
          <div style={{ marginTop: 10 }}>
            <button type="button" style={buttonStyle("#0f766e")} onClick={() => void savePayrollSettings()} disabled={savingPayrollSettings}>
              {savingPayrollSettings ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Payroll Default Components</h3>
            <button type="button" style={buttonStyle("#1d4ed8")} onClick={applyGlobalPayrollDefaultsToForm}>Apply Defaults to Single Entry</button>
          </div>
          <p style={{ margin: "0 0 10px 0", color: "var(--text-muted)", fontSize: 12 }}>
            These defaults are used when a staff member has no payroll_defaults set in employee profile.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>Default Allowance Components</strong>
                <button type="button" style={buttonStyle("#2563eb")} onClick={addAllowanceItem}>Add</button>
              </div>
              {defaultAllowanceItems.map((item, index) => (
                <div key={`allowance-default-${index}`} style={{ display: "grid", gridTemplateColumns: "1fr 120px auto", gap: 6, marginBottom: 6 }}>
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateAllowanceItem(index, "label", e.target.value)}
                    placeholder="Label (e.g. HRA)"
                    style={fieldStyle()}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.amount}
                    onChange={(e) => updateAllowanceItem(index, "amount", e.target.value)}
                    placeholder="Amount"
                    style={fieldStyle()}
                  />
                  <button type="button" style={buttonStyle("#6b7280")} onClick={() => removeAllowanceItem(index)}>Remove</button>
                </div>
              ))}
            </div>

            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>Default Deduction Components</strong>
                <button type="button" style={buttonStyle("#2563eb")} onClick={addDeductionItem}>Add</button>
              </div>
              {defaultDeductionItems.map((item, index) => (
                <div key={`deduction-default-${index}`} style={{ display: "grid", gridTemplateColumns: "1fr 120px auto", gap: 6, marginBottom: 6 }}>
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateDeductionItem(index, "label", e.target.value)}
                    placeholder="Label (e.g. PF)"
                    style={fieldStyle()}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.amount}
                    onChange={(e) => updateDeductionItem(index, "amount", e.target.value)}
                    placeholder="Amount"
                    style={fieldStyle()}
                  />
                  <button type="button" style={buttonStyle("#6b7280")} onClick={() => removeDeductionItem(index)}>Remove</button>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Save updates to persist Payroll Settings in backend.
            </div>
            <button type="button" style={buttonStyle("#0f766e")} onClick={() => void savePayrollSettings()} disabled={savingPayrollSettings}>
              {savingPayrollSettings ? "Saving..." : "Save Payroll Settings"}
            </button>
          </div>
        </div>
        </>
        ) : null}

        {activePayrollTab === "tracking" ? (
        <>
        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Payroll Filters</h3>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Use filters to view records by staff, month, year, and status</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, alignItems: "end" }}>
            <div>
              <label htmlFor="payroll-filter-staff" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Staff</label>
              <select id="payroll-filter-staff" value={searchStaffId} onChange={(e) => setSearchStaffId(e.target.value)} style={fieldStyle()}>
                <option value="">All Staff</option>
                {staffRows.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name} ({item.staff_no})</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="payroll-filter-month" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Month</label>
              <input id="payroll-filter-month" type="number" min="1" max="12" value={searchMonth} onChange={(e) => setSearchMonth(e.target.value)} placeholder="Month" style={fieldStyle()} />
            </div>

            <div>
              <label htmlFor="payroll-filter-year" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Year</label>
              <input id="payroll-filter-year" type="number" min="2000" max="2100" value={searchYear} onChange={(e) => setSearchYear(e.target.value)} placeholder="Year" style={fieldStyle()} />
            </div>

            <div>
              <label htmlFor="payroll-filter-status" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Status</label>
              <select id="payroll-filter-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | "draft" | "processed" | "paid")} style={fieldStyle()}>
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="processed">Processed</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, color: "transparent", marginBottom: 4 }} aria-hidden="true">Action</label>
              <button type="button" style={{ ...buttonStyle("#0ea5e9"), width: "100%", minWidth: 120 }} onClick={() => void runSearch()}>Search</button>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, color: "transparent", marginBottom: 4 }} aria-hidden="true">Action</label>
              <button type="button" style={{ ...buttonStyle("#6b7280"), width: "100%", minWidth: 120 }} onClick={() => void resetSearch()}>Reset</button>
            </div>
          </div>
        </div>

        {summary && (
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Payroll Summary</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              <div style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, background: "#f8fafc" }}>Total Records<br /><strong>{summary.total_records}</strong></div>
              <div style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, background: "#f8fafc" }}>Total Basic<br /><strong>{summary.total_basic_salary}</strong></div>
              <div style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, background: "#f8fafc" }}>Total Allowance<br /><strong>{summary.total_allowance}</strong></div>
              <div style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, background: "#f8fafc" }}>Total Deduction<br /><strong>{summary.total_deduction}</strong></div>
              <div style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, background: "#f8fafc" }}>Total Net<br /><strong>{summary.total_net_salary}</strong></div>
            </div>
          </div>
        )}

        <div className="white-box" style={boxStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Payroll Records</h3>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Showing {rows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalRows)} of {totalRows}
            </div>
          </div>

          {loading ? <p style={{ color: "var(--text-muted)", marginTop: 0 }}>Loading payroll records...</p> : null}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>No</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Staff</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Month</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Year</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Basic</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Allowance</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Deduction</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Net</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const staff = staffRows.find((item) => item.id === row.staff);
                  const staffName = row.staff_name || (staff ? `${staff.first_name} ${staff.last_name}` : String(row.staff));
                  const statusLabel = row.status === "processed" ? "Approved" : row.status;
                  return (
                    <tr key={row.id}>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{totalRows - ((currentPage - 1) * pageSize + index)}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{staffName}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.payroll_month}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.payroll_year}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{formatCurrency(row.basic_salary)}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{formatCurrency(row.allowance)}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{formatCurrency(row.deduction)}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{formatCurrency(row.net_salary)}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)", textTransform: "capitalize" }}>{statusLabel}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)", display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button type="button" style={buttonStyle("#1d4ed8")} onClick={() => previewPayrollTemplate(row)}>Preview</button>
                        <button type="button" style={buttonStyle("#7c3aed")} onClick={() => downloadPayrollTemplate(row)}>Download</button>
                        <button type="button" style={buttonStyle("#0f766e")} onClick={() => void downloadPayrollPdf(row)}>PDF</button>
                        {row.status === "draft" ? <button type="button" style={buttonStyle("#0ea5e9")} onClick={() => void markApproved(row.id)}>Approve</button> : null}
                        {row.status === "processed" ? <button type="button" style={buttonStyle("#059669")} onClick={() => void markPaid(row.id)}>Mark Paid</button> : null}
                      </td>
                    </tr>
                  );
                })}
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 12, textAlign: "center", color: "var(--text-muted)" }}>
                      No payroll records found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 10, flexWrap: "wrap" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Page {currentPage} of {totalPages}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <select
                aria-label="Items per page"
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ ...fieldStyle(), width: 110, height: 34 }}
              >
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
                <option value="100">100 / page</option>
              </select>
              <button type="button" style={buttonStyle("#334155")} disabled={currentPage <= 1 || loading} onClick={() => void load(currentPage - 1)}>Previous</button>
              {buildPageButtons(currentPage, totalPages).map((page) => (
                <button
                  key={page}
                  type="button"
                  style={buttonStyle(page === currentPage ? "var(--primary)" : "#64748b")}
                  disabled={loading}
                  onClick={() => void load(page)}
                >
                  {page}
                </button>
              ))}
              <button type="button" style={buttonStyle("#334155")} disabled={currentPage >= totalPages || loading} onClick={() => void load(currentPage + 1)}>Next</button>
            </div>
          </div>
        </div>
        {activePayrollTab === "tracking" && payrollPreview ? (
          <div className="white-box" style={{ ...boxStyle(), marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Employee Payroll Preview</h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" style={buttonStyle("#0b7285")} onClick={() => void downloadPayrollPdf(payrollPreview)}>Download PDF</button>
                <button type="button" style={buttonStyle("#0f766e")} onClick={() => printPayrollPayslip(payrollPreview)}>Print Payslip</button>
                <button type="button" style={buttonStyle("#6b7280")} onClick={() => setPayrollPreview(null)}>Close</button>
              </div>
            </div>
            <div style={{ marginBottom: 10, color: "var(--text-muted)", fontSize: 12 }}>
              Branding and school URL are configured in Payroll Settings tab.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
              <div>Staff: <strong>{payrollPreview.staff_name || payrollPreview.staff}</strong></div>
              <div>Staff No: <strong>{payrollPreview.staff_no || "-"}</strong></div>
              <div>Month: <strong>{payrollPreview.payroll_month}</strong></div>
              <div>Year: <strong>{payrollPreview.payroll_year}</strong></div>
              <div>Basic Salary: <strong>{formatCurrency(payrollPreview.basic_salary)}</strong></div>
              <div>Allowance: <strong>{formatCurrency(payrollPreview.allowance)}</strong></div>
              <div>Deduction: <strong>{formatCurrency(payrollPreview.deduction)}</strong></div>
              <div>Net Salary: <strong>{formatCurrency(payrollPreview.net_salary)}</strong></div>
              <div>Status: <strong style={{ textTransform: "capitalize" }}>{payrollPreview.status === "processed" ? "Approved" : payrollPreview.status}</strong></div>
              <div>Paid At: <strong>{payrollPreview.paid_at || "-"}</strong></div>
            </div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10 }}>
                <h4 style={{ margin: "0 0 8px 0" }}>Allowance Breakdown</h4>
                {getComponentLines(payrollPreview, "allowance").map((line, idx) => (
                  <div key={`preview-allowance-${idx}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{line.label}</span>
                    <strong>{line.amount}</strong>
                  </div>
                ))}
              </div>
              <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10 }}>
                <h4 style={{ margin: "0 0 8px 0" }}>Deduction Breakdown</h4>
                {getComponentLines(payrollPreview, "deduction").map((line, idx) => (
                  <div key={`preview-deduction-${idx}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{line.label}</span>
                    <strong>{line.amount}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        </>
        ) : null}
      </div></section>
    </div>
  );
}
