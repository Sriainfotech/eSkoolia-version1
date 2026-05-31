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
  AttendanceRecord,
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

export async function createStaff(body: Partial<Staff>) {
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

// ─── Attendance ───────────────────────────────────────────────────────────────
export function useAttendance(date: string) {
  return useFetch<PaginatedHR<AttendanceRecord>>(
    `/api/v1/hr/staff-attendance/?date=${date}&page_size=200`,
    [date],
  );
}

export async function saveAttendanceBatch(records: Partial<AttendanceRecord>[]) {
  const res = await apiRequestWithRefreshResponse("/api/v1/hr/staff-attendance/batch/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateAttendance(id: number, body: Partial<AttendanceRecord>) {
  const res = await apiRequestWithRefreshResponse(`/api/v1/hr/staff-attendance/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<AttendanceRecord>;
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


