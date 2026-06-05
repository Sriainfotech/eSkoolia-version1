import { apiRequestWithRefresh } from "@/lib/api-auth";

export type ApiList<T> = T[] | { results?: T[] };

export type FeesGroup = {
  id: number;
  academic_year: number;
  name: string;
  description?: string;
  is_active: boolean;
  applicable_classes?: number[];
};

export type FeesType = {
  id: number;
  academic_year: number;
  fees_group: number;
  name: string;
  amount: string;
  description?: string;
  is_active: boolean;
};

export type FeesAssignment = {
  id: number;
  academic_year: number;
  student: number;
  fees_type: number;
  due_date: string;
  amount: string;
  discount_amount: string;
  status: "unpaid" | "partial" | "paid";
};

export type FeesPayment = {
  id: number;
  assignment: number;
  student: number;
  amount_paid: string;
  method: "cash" | "bank" | "online" | "wallet" | "cheque";
  transaction_reference?: string;
  note?: string;
  paid_at: string;
};

export type FeesSummary = {
  count: number;
  total_assigned: string;
  total_discount: string;
  total_net: string;
  total_paid: string;
  total_due: string;
};

export type StudentRow = {
  id: number;
  admission_no?: string;
  first_name?: string;
  last_name?: string;
  roll_no?: string;
};

export type AcademicYear = { id: number; name: string; is_current?: boolean };
export type SchoolClass = { id: number; name: string };

export function listData<T>(payload: ApiList<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results || [];
}

export const feesApi = {
  listGroups: () => apiRequestWithRefresh<ApiList<FeesGroup>>("/api/v1/fees/groups/"),
  createGroup: (payload: Partial<FeesGroup>) =>
    apiRequestWithRefresh<FeesGroup>("/api/v1/fees/groups/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateGroup: (id: number, payload: Partial<FeesGroup>) =>
    apiRequestWithRefresh<FeesGroup>(`/api/v1/fees/groups/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteGroup: (id: number) =>
    apiRequestWithRefresh<void>(`/api/v1/fees/groups/${id}/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }),

  listTypes: () => apiRequestWithRefresh<ApiList<FeesType>>("/api/v1/fees/types/"),
  createType: (payload: Partial<FeesType>) =>
    apiRequestWithRefresh<FeesType>("/api/v1/fees/types/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateType: (id: number, payload: Partial<FeesType>) =>
    apiRequestWithRefresh<FeesType>(`/api/v1/fees/types/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteType: (id: number) =>
    apiRequestWithRefresh<void>(`/api/v1/fees/types/${id}/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }),

  listAssignments: () => apiRequestWithRefresh<ApiList<FeesAssignment>>("/api/v1/fees/assignments/"),
  createAssignment: (payload: Partial<FeesAssignment>) =>
    apiRequestWithRefresh<FeesAssignment>("/api/v1/fees/assignments/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateAssignment: (id: number, payload: Partial<FeesAssignment>) =>
    apiRequestWithRefresh<FeesAssignment>(`/api/v1/fees/assignments/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteAssignment: (id: number) =>
    apiRequestWithRefresh<void>(`/api/v1/fees/assignments/${id}/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }),
  assignmentsSummary: () => apiRequestWithRefresh<FeesSummary>("/api/v1/fees/assignments/summary/"),
  assignmentsOverdue: () => apiRequestWithRefresh<ApiList<FeesAssignment>>("/api/v1/fees/assignments/overdue/"),
  assignmentsCarryForward: (payload: { from_academic_year: number; to_academic_year: number; due_date?: string }) =>
    apiRequestWithRefresh<{ message: string; created: number; updated: number; total_amount: string }>(
      "/api/v1/fees/assignments/carry-forward/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),

  listPayments: () => apiRequestWithRefresh<ApiList<FeesPayment>>("/api/v1/fees/payments/"),
  createPayment: (payload: Partial<FeesPayment>) =>
    apiRequestWithRefresh<FeesPayment>("/api/v1/fees/payments/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  paymentReceipt: (id: number) => apiRequestWithRefresh<Record<string, unknown>>(`/api/v1/fees/payments/${id}/receipt/`),
  deletePayment: (id: number) =>
    apiRequestWithRefresh<void>(`/api/v1/fees/payments/${id}/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }),

  listAcademicYears: () => apiRequestWithRefresh<ApiList<AcademicYear>>("/api/v1/core/academic-years/"),
  listClasses: () => apiRequestWithRefresh<ApiList<SchoolClass>>("/api/v1/core/classes/?page_size=100"),
  listStudents: () => apiRequestWithRefresh<ApiList<StudentRow>>("/api/v1/students/students/"),
};
