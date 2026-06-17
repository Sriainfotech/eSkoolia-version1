import { apiRequestWithRefresh } from "@/lib/api-auth";

export type ApiList<T> = T[] | { results?: T[] };
export type PaginatedApiList<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

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
  academic_year?: number;
  fees_group?: number;
  name: string;
  gl_code: string;
  taxable: "Yes" | "No";
  default_structure: "Monthly" | "Quarterly" | "Term-wise" | "Yearly" | "Custom";
  status: "Active" | "Inactive";
  amount?: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type FeeTypeListParams = {
  page?: number;
  page_size?: number;
  search?: string;
  status?: "active" | "inactive" | "";
  sort_by?: "name" | "gl_code" | "status" | "created_date" | "updated_date";
  sort_dir?: "asc" | "desc";
};

function buildQuery(params: FeeTypeListParams = {}): string {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  if (params.sort_by) qs.set("sort_by", params.sort_by);
  if (params.sort_dir) qs.set("sort_dir", params.sort_dir);
  const query = qs.toString();
  return query ? `?${query}` : "";
}

function buildSearchQuery(params: SearchParams = {}): string {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  if (params.sort_by) qs.set("sort_by", params.sort_by);
  const query = qs.toString();
  return query ? `?${query}` : "";
}

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

export type AcademicYear = { id: number; name: string; is_current?: boolean; start_date?: string; end_date?: string };
export type SchoolClass = { id: number; name: string };

export type TermSettings = {
  id: number;
  academic_year: number;
  academic_year_name?: string;
  term_number: number;
  term_name: string;
  start_date: string;
  end_date: string;
  default_due_date: string;
  created_at?: string;
  updated_at?: string;
  created_by?: number;
};

export type FeeSchedule = {
  id: number;
  academic_year: number;
  academic_year_name?: string;
  fee_group: number;
  fee_group_name?: string;
  fee_type: number;
  fee_type_name?: string;
  amount: string;
  collection_frequency: string;
  due_date: string;
  late_fee_applicable: boolean;
  grace_period?: number;
  late_fee_rule?: string;
  term_breakdown?: Array<{
    term_settings_id: number;
    term_name: string;
    amount: string;
    due_date: string;
  }>;
  status: "active" | "inactive";
  is_deleted?: boolean;
  deleted_at?: string;
  deleted_by?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: number;
  updated_by?: number;
};

export type ConcessionRule = {
  id: number;
  academic_year?: number;
  academic_year_name?: string;
  name: string;
  applies_to?: string;
  discount_percentage?: string;
  status?: string; // "Active" | "Inactive"
  created_at?: string;
  updated_at?: string;
  created_by?: number;
};

export type LateFeeRule = {
  id: number;
  academic_year?: number;
  academic_year_name?: string;
  name: string;
  grace_period_days?: number;
  penalty_rule?: string;
  cap_amount?: string | null;
  status?: string; // "Active" | "Inactive"
  created_at?: string;
  updated_at?: string;
  created_by?: number;
};

export type SearchParams = {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  sort_by?: string;
};

export function listData<T = any>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload?.results && Array.isArray(payload.results)) return payload.results;
  if (payload?.data && Array.isArray(payload.data)) return payload.data;
  return [];
}

export const feesApi = {
  listGroups: (params?: { academic_year?: number }) => {
    const qs = new URLSearchParams();
    qs.set('page_size', '500');
    if (params?.academic_year) qs.set('academic_year', String(params.academic_year));
    return apiRequestWithRefresh<ApiList<FeesGroup>>(`/api/v1/fees/groups/?${qs.toString()}`);
  },
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

  listTypes: (params?: FeeTypeListParams) =>
    apiRequestWithRefresh<PaginatedApiList<FeesType> | ApiList<FeesType>>(`/api/v1/fees/types/${buildQuery(params)}`),
  getType: (id: number) => apiRequestWithRefresh<FeesType>(`/api/v1/fees/types/${id}/`),
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

  listAssignments: (params?: { page_size?: number; academic_year?: number }) => {
    const qs = new URLSearchParams();
    qs.set('page_size', String(params?.page_size ?? 500));
    if (params?.academic_year) qs.set('academic_year', String(params.academic_year));
    return apiRequestWithRefresh<ApiList<FeesAssignment>>(`/api/v1/fees/assignments/?${qs.toString()}`);
  },
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

  listTermSettings: (params?: SearchParams) =>
    apiRequestWithRefresh<PaginatedApiList<TermSettings> | ApiList<TermSettings>>(`/api/v1/fees/term-settings/${buildSearchQuery(params)}`),
  getTermSettings: (id: number) => apiRequestWithRefresh<TermSettings>(`/api/v1/fees/term-settings/${id}/`),
  createTermSettings: (payload: Partial<TermSettings> | Partial<TermSettings>[]) =>
    apiRequestWithRefresh<any>("/api/v1/fees/term-settings/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateTermSettings: (id: number, payload: Partial<TermSettings>) =>
    apiRequestWithRefresh<TermSettings>(`/api/v1/fees/term-settings/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteTermSettings: (id: number) =>
    apiRequestWithRefresh<void>(`/api/v1/fees/term-settings/${id}/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }),

  listSchedules: (params?: SearchParams & { academic_year?: number }) => {
    const base = `/api/v1/fees/schedules/${buildSearchQuery(params)}`;
    if (params?.academic_year) {
      const sep = base.includes('?') ? '&' : '?';
      return apiRequestWithRefresh<PaginatedApiList<FeeSchedule> | ApiList<FeeSchedule>>(`${base}${sep}academic_year=${params.academic_year}`);
    }
    return apiRequestWithRefresh<PaginatedApiList<FeeSchedule> | ApiList<FeeSchedule>>(base);
  },
  getSchedule: (id: number) => apiRequestWithRefresh<FeeSchedule>(`/api/v1/fees/schedules/${id}/`),
  createSchedule: (payload: Partial<FeeSchedule>) =>
    apiRequestWithRefresh<FeeSchedule>("/api/v1/fees/schedules/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateSchedule: (id: number, payload: Partial<FeeSchedule>) =>
    apiRequestWithRefresh<FeeSchedule>(`/api/v1/fees/schedules/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteSchedule: (id: number) =>
    apiRequestWithRefresh<void>(`/api/v1/fees/schedules/${id}/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }),

  listConcessionRules: (params?: SearchParams) =>
    apiRequestWithRefresh<PaginatedApiList<ConcessionRule> | ApiList<ConcessionRule>>(`/api/v1/fees/concession-rules/${buildSearchQuery(params)}`),
  createConcessionRule: (payload: Partial<ConcessionRule>) =>
    apiRequestWithRefresh<ConcessionRule>("/api/v1/fees/concession-rules/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateConcessionRule: (id: number, payload: Partial<ConcessionRule>) =>
    apiRequestWithRefresh<ConcessionRule>(`/api/v1/fees/concession-rules/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteConcessionRule: (id: number) =>
    apiRequestWithRefresh<void>(`/api/v1/fees/concession-rules/${id}/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }),

  listLateFeeRules: (params?: SearchParams) =>
    apiRequestWithRefresh<PaginatedApiList<LateFeeRule> | ApiList<LateFeeRule>>(`/api/v1/fees/late-fee-rules/${buildSearchQuery(params)}`),
  createLateFeeRule: (payload: Partial<LateFeeRule>) =>
    apiRequestWithRefresh<LateFeeRule>("/api/v1/fees/late-fee-rules/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateLateFeeRule: (id: number, payload: Partial<LateFeeRule>) =>
    apiRequestWithRefresh<LateFeeRule>(`/api/v1/fees/late-fee-rules/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteLateFeeRule: (id: number) =>
    apiRequestWithRefresh<void>(`/api/v1/fees/late-fee-rules/${id}/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }),

  listAcademicYears: () => apiRequestWithRefresh<ApiList<AcademicYear>>("/api/v1/core/academic-years/?page_size=500"),
  listClasses: (params?: { page_size?: number; academic_year?: number }) => {
    const qs = new URLSearchParams();
    qs.set('page_size', String(params?.page_size ?? 500));
    if (params?.academic_year) qs.set('academic_year', String(params.academic_year));
    return apiRequestWithRefresh<ApiList<SchoolClass>>(`/api/v1/core/classes/?${qs.toString()}`);
  },
  listStudents: (params?: { page_size?: number; academic_year?: number }) => {
    const qs = new URLSearchParams();
    qs.set('page_size', String(params?.page_size ?? 500));
    if (params?.academic_year) qs.set('academic_year', String(params.academic_year));
    return apiRequestWithRefresh<ApiList<StudentRow>>(`/api/v1/students/students/?${qs.toString()}`);
  },
};
