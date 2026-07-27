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
  // Backend (FeesTypeSerializer.status = CharField()) returns the raw model
  // value — the lowercase STATUS_CHOICES key ("active"/"inactive") — not the
  // capitalized display label. Callers must normalize before comparing.
  status: string;
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
  fees_type_name?: string;
  due_date: string;
  amount: string;
  discount_amount: string;
  concession_amount?: string;
  status: "unpaid" | "partial" | "paid";
  reason?: string;
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

export type FeesReconciliation = {
  id?: number;
  reference: string;
  amount: string;
  method: "bank" | "online" | "cheque" | "wallet";
  date: string;
  status: "matched" | "review" | "needs_mapping";
  match_note?: string;
  score?: number;
  notes?: string;
  created_at?: string;
};

export type FeesSummary = {
  count: number;
  total_assigned: string;
  total_discount: string;
  total_concession: string;
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

export type DuesReminderLog = { date: string; by: string; note: string };

export type DuesReminderStudent = {
  id: string;
  name: string;
  adm_no: string;
  cls: string;
  cls_id: string;
  amount_due: number;
  days_overdue: number;
  last_reminder: string;
  status: "Overdue" | "Payment Watch" | "Escalated" | "Defaulter";
  status_note: string;
  log: DuesReminderLog[];
};

export type DuesReminderClass = {
  id: string;
  name: string;
  total: number;
  assigned: number;
  unassigned: number;
};

export type DuesRemindersData = {
  stats: {
    total_overdue_amount: number;
    students_with_dues: number;
    average_days_overdue: number;
    percent_collected: number;
  };
  classes: DuesReminderClass[];
  students: DuesReminderStudent[];
  late_fee_preview: {
    label: string;
    due_rule: string;
    outstanding: number;
    days_overdue: number;
    chargeable_days: number;
    raw_penalty: number;
    final_due: number;
  } | null;
};

export type FeesHomeData = {
  tasks: Array<{
    id: string;
    color: string;
    title: string;
    desc: string;
    buttons: Array<{ label: string; variant: "primary" | "outline"; toast: string; href?: string }>;
  }>;
  audit_trail: Array<{
    id: string;
    initials: string;
    event: string;
    desc: string;
    date: string;
    bg: string;
  }>;
};

export function listData<T = any>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload?.results && Array.isArray(payload.results)) return payload.results;
  if (payload?.data && Array.isArray(payload.data)) return payload.data;
  return [];
}

export const feesApi = {
  // Home Dashboard
  homeDashboard: () => apiRequestWithRefresh<FeesHomeData>("/api/v1/fees/home/"),
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

  listTypes: (params?: FeeTypeListParams) => {
    // Default to large page_size so all fee types load (backend default is 10)
    const merged: FeeTypeListParams = { page_size: 1000, ...params };
    return apiRequestWithRefresh<PaginatedApiList<FeesType> | ApiList<FeesType>>(`/api/v1/fees/types/${buildQuery(merged)}`);
  },
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

  listAssignments: (params?: { page_size?: number; academic_year?: number; student?: string | number }) => {
    const qs = new URLSearchParams();
    qs.set('page_size', String(params?.page_size ?? 10000));
    if (params?.academic_year) qs.set('academic_year', String(params.academic_year));
    if (params?.student)       qs.set('student', String(params.student));
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
  duesReminders: () => apiRequestWithRefresh<DuesRemindersData>("/api/v1/fees/assignments/dues-reminders/"),
  assignmentsCarryForward: (payload: { from_academic_year: number; to_academic_year: number; due_date?: string }) =>
    apiRequestWithRefresh<{ message: string; created: number; updated: number; total_amount: string }>(
      "/api/v1/fees/assignments/carry-forward/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),

  listPayments: (params?: { page_size?: number }) => {
    const qs = new URLSearchParams();
    qs.set('page_size', String(params?.page_size ?? 1000));
    return apiRequestWithRefresh<ApiList<FeesPayment>>(`/api/v1/fees/payments/?${qs.toString()}`);
  },
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
    // Always request a large page — backend default is 10 and would silently truncate results
    const merged: SearchParams & { academic_year?: number } = { page_size: 1000, ...params };
    const qs = new URLSearchParams();
    qs.set('page_size', String(merged.page_size ?? 1000));
    if (merged.page) qs.set('page', String(merged.page));
    if (merged.search) qs.set('search', merged.search);
    if (merged.status) qs.set('status', merged.status);
    if (merged.academic_year) qs.set('academic_year', String(merged.academic_year));
    return apiRequestWithRefresh<PaginatedApiList<FeeSchedule> | ApiList<FeeSchedule>>(`/api/v1/fees/schedules/?${qs.toString()}`);
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

  listReconciliations: () =>
    apiRequestWithRefresh<ApiList<FeesReconciliation>>("/api/v1/fees/reconciliations/?page_size=200"),
  createReconciliation: (payload: Omit<FeesReconciliation, "id" | "created_at">) =>
    apiRequestWithRefresh<FeesReconciliation>("/api/v1/fees/reconciliations/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteReconciliation: (id: number) =>
    apiRequestWithRefresh<void>(`/api/v1/fees/reconciliations/${id}/`, { method: "DELETE" }),

  getMySchoolInfo: () =>
    apiRequestWithRefresh<{ name: string; address: string; email: string; phone: string; logo_url: string }>(
      "/api/v1/tenancy/my-school-info/"
    ),

  // Dues & Reminders
  getDuesSummary: () =>
    apiRequestWithRefresh<{
      total_overdue_amount: string;
      students_with_dues: number;
      avg_days_overdue: number;
      pct_collected: number;
    }>("/api/v1/fees/dues/summary/"),

  getDuesByClass: (tier?: string) =>
    apiRequestWithRefresh<DuesClassGroup[]>(
      `/api/v1/fees/dues/by-class/${tier ? `?tier=${tier}` : ""}`
    ),

  getDueInteractions: (studentId: string) =>
    apiRequestWithRefresh<DueInteraction[]>(
      `/api/v1/fees/dues/interactions/?student=${studentId}`
    ),

  createDueInteraction: (data: {
    student: string;
    interaction_type: string;
    note: string;
    agreed_amount?: string;
    agreed_date?: string;
  }) =>
    apiRequestWithRefresh<DueInteraction>("/api/v1/fees/dues/interactions/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  resolveStudentDue: (studentId: string, note?: string) =>
    apiRequestWithRefresh<DueInteraction>("/api/v1/fees/dues/resolve/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, note }),
    }),

  sendDueReminders: (studentIds: string[], message: string) =>
    apiRequestWithRefresh<{ sent: number; interaction_ids: number[] }>(
      "/api/v1/fees/dues/send-reminder/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: studentIds, message }),
      }
    ),

  exportDuesCSV: () =>
    fetch("/api/v1/fees/dues/export-csv/", {
      headers: { Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : ""}` },
    }),

  yearEndReportCSV: (reportType: string) =>
    fetch(`/api/v1/fees/year-end/report/?report_type=${reportType}`, {
      headers: { Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : ""}` },
    }),

  yearEndGroupAmounts: (groupId: number) =>
    apiRequestWithRefresh<{ group_id: number; group_name: string; fee_types: YearEndFeeAmountRow[] }>(
      `/api/v1/fees/year-end/group-amounts/?group_id=${groupId}`
    ),

  yearEndSaveGroupAmounts: (groupId: number, amounts: { fee_type_id: number; new_amount: string }[]) =>
    apiRequestWithRefresh<{ status: string; message: string; updated_count: number }>(
      `/api/v1/fees/year-end/group-amounts/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, amounts }),
      }
    ),

  yearEndRollover: (payload: { next_year_name: string; rollover_date: string; group_ids: number[] }) =>
    apiRequestWithRefresh<{
      success: boolean;
      academic_year: { id: number; name: string; start_date: string; end_date: string };
      archived_year: string;
      groups_copied: number;
      fee_types_skipped: number;
      message: string;
    }>(`/api/v1/fees/year-end/rollover/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};

export type YearEndFeeAmountRow = {
  id: number;
  name: string;
  breakdown: string;
  current_total: string;
  schedule_type: string;
  new_amount: string;
  is_deleted?: boolean;
};

export type DuesClassGroup = {
  cls: string;
  total_students: number;
  assigned_students: number;
  students: DueStudent[];
};

export type DueStudent = {
  id: string;
  name: string;
  admNo: string;
  cls: string;
  amount_due: string;
  days_overdue: number;
  last_reminder: string | null;
  status: "Overdue" | "Payment Watch" | "Escalated" | "Defaulter";
  is_resolved: boolean;
};

export type DueInteraction = {
  id: number;
  student: string;
  interaction_type: string;
  note: string;
  agreed_amount: string | null;
  agreed_date: string | null;
  is_resolved: boolean;
  created_by: number;
  created_by_name: string;
  created_at: string;
};
