/**
 * HR API hooks — uses the project's existing apiRequestWithRefresh pattern.
 * No external libraries (React Query / Zustand) required.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequestWithRefresh, apiRequestWithRefreshResponse } from "@/lib/api-auth";
import type {
  Department,
  DepartmentType,
  Designation,
  Staff,
  StaffDocument,
  LeaveType,
  LeaveApplication,
  OffboardingRecord,
  PaginatedHR,
} from "@/types/hr";

// ─── Generic fetch hook ───────────────────────────────────────────────────────
function useFetch<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequestWithRefresh<T>(url, { method: "GET" });
      setData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [url, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

// ─── Department Types ─────────────────────────────────────────────────────────
export function useDepartmentTypes() {
  return useFetch<{ data: DepartmentType[] }>("/api/v1/hr/department-types/");
}

export async function createDepartmentType(name: string): Promise<DepartmentType> {
  const res = await apiRequestWithRefreshResponse("/api/v1/hr/department-types/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string; errors?: Record<string, string[]> };
    // backend now puts the specific field error in `message` directly
    throw new Error(body.errors?.name?.[0] ?? body.message ?? "Failed to create department type");
  }
  const json = await res.json() as { data: DepartmentType };
  return json.data;
}

export async function deleteDepartmentType(id: number): Promise<void> {
  const res = await apiRequestWithRefreshResponse(`/api/v1/hr/department-types/${id}/`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete department type");
}

// ─── Departments ─────────────────────────────────────────────────────────────
export function useStaffList() {
  return useFetch<PaginatedHR<Staff>>("/api/v1/hr/staff/?page_size=200&status=active");
}

export function useDepartments(page = 1) {
  return useFetch<PaginatedHR<Department>>(`/api/v1/hr/departments/?page_size=10&page=${page}`, [page]);
}

/** Fetches all departments (up to 200) for use in dropdowns — unpaginated. */
export function useAllDepartments() {
  return useFetch<PaginatedHR<Department>>(`/api/v1/hr/departments/?page_size=200`, []);
}

/** Backend-paginated departments for the designation hierarchy cards (5 per page). */
export function useHierarchyDepts(page = 1) {
  return useFetch<PaginatedHR<Department>>(`/api/v1/hr/departments/?page_size=5&page=${page}`, [page]);
}

export async function createDepartment(body: Partial<Department>) {
  const res = await apiRequestWithRefreshResponse("/api/v1/hr/departments/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? data.errors?.name?.[0] ?? data.errors?.name ?? "Failed to save department");
  }
  return res.json() as Promise<Department>;
}

export async function updateDepartment(id: number, body: Partial<Department>) {
  const res = await apiRequestWithRefreshResponse(`/api/v1/hr/departments/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? data.errors?.name?.[0] ?? data.errors?.name ?? "Failed to save department");
  }
  return res.json() as Promise<Department>;
}

export async function deleteDepartment(id: number) {
  const res = await apiRequestWithRefreshResponse(`/api/v1/hr/departments/${id}/`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

// ─── Designations ────────────────────────────────────────────────────────────
export function useDesignations(deptId?: number) {
  const url = deptId
    ? `/api/v1/hr/designations/?department=${deptId}&page_size=200`
    : `/api/v1/hr/designations/?page_size=200`;
  return useFetch<PaginatedHR<Designation>>(url, [deptId]);
}

export async function createDesignation(body: Partial<Designation>) {
  const res = await apiRequestWithRefreshResponse("/api/v1/hr/designations/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? data.errors?.name?.[0] ?? "Failed to save designation");
  }
  return res.json() as Promise<Designation>;
}

export async function updateDesignation(id: number, body: Partial<Designation>) {
  const res = await apiRequestWithRefreshResponse(`/api/v1/hr/designations/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? data.errors?.name?.[0] ?? "Failed to save designation");
  }
  return res.json() as Promise<Designation>;
}

export async function deleteDesignation(id: number) {
  const res = await apiRequestWithRefreshResponse(`/api/v1/hr/designations/${id}/`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function reorderDesignations(items: { id: number; sort_order: number }[]): Promise<void> {
  const res = await apiRequestWithRefreshResponse("/api/v1/hr/designations/reorder/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error("Failed to reorder");
}

// ─── Staff ───────────────────────────────────────────────────────────────────
export interface StaffFilters {
  departmentId?: number;
  department?: number | string;  // alias from pages
  designationId?: number;
  status?: string;
  search?: string;
  page?: number;
}

export function useStaff(filters: StaffFilters = {}) {
  const params = new URLSearchParams({ page_size: "50" });
  const deptVal = filters.department ?? filters.departmentId;
  if (deptVal) params.set("department", String(deptVal));
  if (filters.designationId) params.set("designation", String(filters.designationId));
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.page) params.set("page", String(filters.page));
  return useFetch<PaginatedHR<Staff>>(
    `/api/v1/hr/staff/?${params.toString()}`,
    [deptVal, filters.designationId, filters.status, filters.search, filters.page],
  );
}

export async function createStaff(body: Partial<Staff>, photoFile?: File | null) {
  if (photoFile) {
    const fd = new FormData();
    Object.entries(body).forEach(([key, val]) => {
      if (val === undefined || val === null) return;
      if (typeof val === "object") {
        fd.append(key, JSON.stringify(val));
      } else {
        fd.append(key, String(val));
      }
    });
    fd.append("staff_photo", photoFile, photoFile.name);
    const res = await apiRequestWithRefreshResponse("/api/v1/hr/staff/", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<Staff>;
  }
  const res = await apiRequestWithRefreshResponse("/api/v1/hr/staff/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Staff>;
}

export async function updateStaff(id: number, body: Partial<Staff>) {
  const res = await apiRequestWithRefreshResponse(`/api/v1/hr/staff/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Staff>;
}

export async function updateStaffStatus(id: number, status: string, note?: string) {
  const res = await apiRequestWithRefreshResponse(`/api/v1/hr/staff/${id}/set_status/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, note }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Staff>;
}

export async function reactivateStaff(id: number) {
  return updateStaffStatus(id, "active");
}

// ─── Staff Documents ─────────────────────────────────────────────────────────
export function useStaffDocuments(staffId: number) {
  return useFetch<PaginatedHR<StaffDocument>>(
    `/api/v1/hr/staff-documents/?staff=${staffId}&page_size=50`,
    [staffId],
  );
}

// ─── Onboard Drafts ──────────────────────────────────────────────────────────
export interface OnboardDraft {
  id: number;
  draft_name: string;
  form_data: Record<string, unknown>;
  current_step: number;
  created_at: string;
  updated_at: string;
}

export function useOnboardDrafts() {
  return useFetch<{ count: number; results: OnboardDraft[] }>("/api/v1/hr/onboard/drafts/");
}

export async function saveOnboardDraft(payload: {
  id?: number | null;
  form_data: Record<string, unknown>;
  current_step: number;
}): Promise<OnboardDraft> {
  const res = await apiRequestWithRefreshResponse("/api/v1/hr/onboard/drafts/save/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json() as OnboardDraft & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed to save draft.");
  return body;
}

export async function deleteOnboardDraft(id: number): Promise<void> {
  const res = await apiRequestWithRefreshResponse(`/api/v1/hr/onboard/drafts/${id}/`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error("Failed to delete draft.");
  }
}

/** Downloads the blank staff onboarding form PDF.
 *  Pass `copies` (1–5) to embed multiple copies in the same PDF.
 */
export async function downloadBlankForm(copies: number = 1): Promise<void> {
  const res = await apiRequestWithRefreshResponse(
    `/api/v1/hr/onboard/blank-form/?copies=${copies}`,
    { method: "GET" },
  );
  if (!res.ok) {
    let msg = "Failed to generate blank form.";
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      // ignore parse error, keep generic message
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "staff-onboarding-form.pdf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Downloads a filled staff onboarding PDF using the current wizard form data.
 *  Sends form_data as JSON to the backend, receives a PDF blob.
 *  Validates: form_data.first_name must be non-empty (backend also validates).
 */
export async function downloadFilledForm(formData: Record<string, unknown>): Promise<void> {
  const res = await apiRequestWithRefreshResponse("/api/v1/hr/onboard/filled-form/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ form_data: formData }),
  });
  if (!res.ok) {
    let msg = "Failed to generate PDF.";
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      // ignore parse error, keep generic message
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Derive filename from Content-Disposition if available, else default
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = cd.match(/filename="?([^";\n]+)"?/i);
  a.download = match?.[1] ?? "staff-onboarding.pdf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── PIN Code Lookup ──────────────────────────────────────────────────────────
/** Looks up city/state/country for a given PIN code via the backend proxy.
 *  Returns null if the pincode is not found or the request fails.
 */
export async function lookupPincode(
  pincode: string,
): Promise<{ city: string; state: string; country: string } | null> {
  try {
    const data = await apiRequestWithRefresh<{ city: string; state: string; country: string }>(
      `/api/v1/core/pincode-lookup/?pincode=${encodeURIComponent(pincode)}`,
      { method: "GET" },
    );
    return data;
  } catch {
    return null;
  }
}

// ─── Leave Types ─────────────────────────────────────────────────────────────
export function useLeaveTypes() {
  return useFetch<PaginatedHR<LeaveType>>("/api/v1/hr/leave-types/?page_size=50");
}

export async function createLeaveType(body: Partial<LeaveType>) {
  const res = await apiRequestWithRefreshResponse("/api/v1/hr/leave-types/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<LeaveType>;
}

export async function updateLeaveType(id: number, body: Partial<LeaveType>) {
  const res = await apiRequestWithRefreshResponse(`/api/v1/hr/leave-types/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<LeaveType>;
}

// ─── Leave Applications ───────────────────────────────────────────────────────
export interface LeaveAppFilters {
  status?: string;
  leaveType?: number;
  search?: string;
  page?: number;
}

export function useLeaveApplications(filters: LeaveAppFilters = {}) {
  const params = new URLSearchParams({ page_size: "50" });
  if (filters.status) params.set("status", filters.status);
  if (filters.leaveType) params.set("leave_type", String(filters.leaveType));
  if (filters.search) params.set("search", filters.search);
  if (filters.page) params.set("page", String(filters.page));
  return useFetch<PaginatedHR<LeaveApplication>>(
    `/api/v1/hr/leave-requests/?${params.toString()}`,
    [filters.status, filters.leaveType, filters.search, filters.page],
  );
}

export async function applyLeave(body: Partial<LeaveApplication>) {
  const res = await apiRequestWithRefreshResponse("/api/v1/hr/leave-requests/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<LeaveApplication>;
}

export async function updateLeaveStatus(
  id: number,
  action: "approve" | "reject" | "cancel" | "approved" | "rejected" | "cancelled",
  note?: string,
) {
  // Normalize verb/noun forms
  const verb = action.replace("approved", "approve").replace("rejected", "reject").replace("cancelled", "cancel");
  const res = await apiRequestWithRefreshResponse(`/api/v1/hr/leave-requests/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: verb, note }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<LeaveApplication>;
}

// ─── Staff Attendance ───────────────────────────────────────────────────────
// Backend model stores `attendance_type` (P/A/L/F/H) + `note` per (staff, date).
// We mark attendance against the full active-staff roster, grouped by department.

export type StaffAttCode = "P" | "A" | "L" | "F" | "H";

/** One saved attendance record for a staff member on a given date. */
export interface StaffAttendanceRow {
  id: number;
  staff: number;
  staff_name: string;
  staff_no: string;
  department_name: string;
  designation_name: string;
  attendance_date: string;          // YYYY-MM-DD
  attendance_type: StaffAttCode;
  note: string;
  arrival_time: string | null;
  sign_in_time: string | null;
  sign_out_time: string | null;
  lunch: boolean;
  created_at: string;
  updated_at: string;
}

/** Payload for a single bulk-store row. */
export interface StaffAttendanceMark {
  staff: number;
  attendance_date: string;
  attendance_type: string;
  note?: string;
  arrival_time?: string | null;
  sign_in_time?: string | null;
  sign_out_time?: string | null;
  lunch?: boolean;
}

/** Fetch all staff-attendance records already saved for a date. */
export function useStaffAttendanceForDate(date: string) {
  return useFetch<PaginatedHR<StaffAttendanceRow>>(
    `/api/v1/hr/staff-attendance/?attendance_date=${date}&page_size=500`,
    [date],
  );
}

/** Bulk upsert attendance rows (update_or_create by staff + date) via the backend's bulk-store. */
export async function saveStaffAttendanceBulk(rows: StaffAttendanceMark[]) {
  const res = await apiRequestWithRefreshResponse("/api/v1/hr/staff-attendance/bulk-store/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ detail: string; count: number }>;
}

// ─── Staff Attendance: summaries & reports ──────────────────────────────────
export interface StaffDailySummary {
  total_staff: number;
  present: number;
  absent: number;
  leave: number;
  half_day: number;
  holiday: number;
  marked: number;
  present_pct: number;
}

/** KPI counts for a single date (optionally scoped to a department). */
export function useStaffDailySummary(date: string, department?: number | string) {
  const dep = department ? `&department=${department}` : "";
  return useFetch<StaffDailySummary>(
    `/api/v1/hr/staff-attendance/daily-summary/?date=${date}${dep}`,
    [date, department],
  );
}

export interface StaffMonthlyRecord {
  staff: number;
  attendance_date: string;
  attendance_type: StaffAttCode;
}
export interface StaffMonthlyRow {
  staff_id: number;
  name: string;
  staff_no: string;
  department_name: string;
  present: number;
  absent: number;
  leave: number;
  half_day: number;
  holiday: number;
}
export interface StaffReasonInsight { reason: string; count: number; }
export interface StaffMonthlyReport {
  records: StaffMonthlyRecord[];
  rows: StaffMonthlyRow[];
  insights: { top_absent_reasons: StaffReasonInsight[]; top_leave_reasons: StaffReasonInsight[] };
}

/** Fetch the monthly report payload (records + per-staff rows + reason insights). */
export async function fetchStaffMonthlyReport(params: {
  month: number; year: number; department?: number | string; staff?: number | string;
}): Promise<StaffMonthlyReport> {
  const q = new URLSearchParams({ month: String(params.month), year: String(params.year) });
  if (params.department) q.set("department", String(params.department));
  if (params.staff) q.set("staff", String(params.staff));
  return apiRequestWithRefresh<StaffMonthlyReport>(
    `/api/v1/hr/staff-attendance/monthly-report/?${q.toString()}`,
    { method: "GET" },
  );
}

// ─── Offboarding ──────────────────────────────────────────────────────────────
export interface OffboardingFilters {
  dept?: string;
  status?: string;
  exitType?: string;
  exit_reason?: string;  // alias from pages
  search?: string;
}

export function useOffboarding(filters: OffboardingFilters = {}) {
  const params = new URLSearchParams({ page_size: "50" });
  if (filters.dept) params.set("department", filters.dept);
  if (filters.status) params.set("status", filters.status);
  const exitVal = filters.exitType ?? filters.exit_reason;
  if (exitVal) params.set("exit_type", exitVal);
  if (filters.search) params.set("search", filters.search);
  return useFetch<PaginatedHR<OffboardingRecord>>(
    `/api/v1/hr/offboarding/?${params.toString()}`,
    [filters.dept, filters.status, exitVal, filters.search],
  );
}

export async function createOffboarding(body: Partial<OffboardingRecord>) {
  const res = await apiRequestWithRefreshResponse("/api/v1/hr/offboarding/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<OffboardingRecord>;
}

export async function updateOffboarding(id: number, body: Partial<OffboardingRecord>) {
  const res = await apiRequestWithRefreshResponse(`/api/v1/hr/offboarding/${id}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<OffboardingRecord>;
}

export async function completeOffboarding(id: number) {
  const res = await apiRequestWithRefreshResponse(`/api/v1/hr/offboarding/${id}/complete/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<OffboardingRecord>;
}

// ─── Master Data ──────────────────────────────────────────────────────────────
export interface MasterItem { id: number; name: string; }

export function useMasterLanguages() {
  return useFetch<MasterItem[]>("/api/master/languages/");
}

export function useMasterReligions() {
  return useFetch<MasterItem[]>("/api/master/religions/");
}

export function useMasterCountries() {
  return useFetch<MasterItem[]>("/api/master/countries/");
}

export function useMasterEmploymentTypes() {
  return useFetch<MasterItem[]>("/api/master/employment-types/");
}

// Staff form options (roles, departments, designations) — backed by hr/staff/form-options/
export interface StaffFormOptions {
  roles: { id: number; name: string }[];
  departments: { id: number; name: string }[];
  designations: { id: number; name: string; department: number }[];
}
export function useStaffFormOptions() {
  return useFetch<{ success: boolean; data: StaffFormOptions }>("/api/v1/hr/staff/form-options/");
}


