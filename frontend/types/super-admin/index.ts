/**
 * Super Admin TypeScript Types
 * 
 * All types used in the super-admin console following the API contracts.
 * Keep in sync with backend Django models.
 */

// ============================================================================
// Pagination & Common Types
// ============================================================================

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
  health_flags_counts?: HealthFlagsCounts;
  status_counts?: StatusCounts;
}

export interface HealthFlagsCounts {
  billing_overdue: number;
  storage_80: number;
  trial_ending: number;
  gstin_missing: number;
}

export interface StatusCounts {
  all: number;
  active: number;
  trial: number;
  suspended: number;
  archived: number;
}

export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ApiError {
  detail?: string;
  non_field_errors?: string[];
  [key: string]: any;
}

// ============================================================================
// School & Tenant Types
// ============================================================================

export type SchoolStatus = 'pending' | 'provisioning' | 'onboarding' | 'active' | 'trial' | 'suspended' | 'archived';
export type PlanType = 'trial' | 'starter' | 'standard' | 'premium' | 'enterprise' | 'custom';
export type BoardType = 'CBSE' | 'SSC_AP' | 'ICSE' | 'SSC_TG' | 'OTHER';
export type RegionType = 'north' | 'south' | 'east' | 'west' | 'northeast';

export interface SchoolTenant {
  tenant_id: string; // Immutable, unique
  name: string;
  short_code: string;
  subdomain_url: string;
  shard_region: string;
  storage_region: string;
  backup_retention: number; // days
  sso_method: string; // 'native' | 'google' | 'microsoft' | 'saml'
  api_access: boolean;
  plan: PlanType;
  status: SchoolStatus;
  provisioned_at: string | null; // ISO 8601
  created_at?: string;
  updated_at?: string;
  
  // Computed fields for display
  students?: number;
  activeStudents?: number;
  seats?: number;
  staff?: number;
  lastActivity?: string;
  board?: BoardType;
  state?: string;
  region?: RegionType;
  gstin?: string;
  udiseCode?: string;
  udise_code?: string;
  pan?: string;
  brand_color?: string;
  logo_url?: string;
}

export interface ProvisionSchoolRequest {
  name: string;
  subdomain_url: string;
  state: string;
  board: BoardType;
  plan: PlanType;
  shard_region?: string;
  storage_region?: string;
  backup_retention?: number;
  sso_method?: string;
  short_code?: string;
  gstin?: string;
  pan?: string;
  udise_code?: string;
  seats?: number;
  brand_color?: string;
  logo_url?: string;
  admin_username?: string;
  admin_password?: string;
}

export interface ProvisionSchoolResponse {
  tenant_id: string;
  status: string;
  message?: string;
  school_id?: number | null;
  admin_username?: string | null;
  admin_password?: string | null;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface KPICard {
  label: string;
  value: number | string;
  trend?: number; // percentage change
  trendLabel?: string;
  icon?: string;
}

export interface BoardBreakdown {
  board: BoardType | string;
  count: number;
  percent: number;
}

export interface RecentActivityEvent {
  id: string;
  timestamp: string; // ISO 8601
  actor: string;
  action: string;
  detail: string;
  severity: 'info' | 'warning' | 'error';
  tenantId?: string;
  schoolName?: string;
}

// Synced with views.py DashboardKPIView response — do not add fields not returned by backend
export interface DashboardData {
  totalSchools: number;
  activeSchools: number;
  totalStudents: number;
  activeStudents?: number;
  inactiveStudents?: number;
  totalStaff: number;
  mrr: { current: number; previous: number; trend: number };
  alertCount: number;
  overdueCount?: number;
  blockedCount?: number;
  boardBreakdown: BoardBreakdown[];
  trends: {
    students: number; // percentage
    mrr: number; // percentage
  };
  recentEvents?: RecentActivityEvent[];
  stateBreakdown?: Array<{ state: string; code: string; count: number; students: number }>;
  planBreakdown?: Array<{ plan: string; count: number; mrr: number; students: number }>;
  // Raw API fields (snake_case from backend)
  suspended_schools_count?: number;  // Fix #17 – removed active_schools_count, new_schools_today, api_uptime_percent (dead fields)
  outstanding_amount?: number;
}

// ============================================================================
// Billing Types
// ============================================================================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  sac_code: string;
  amount: number;
  gst_percent?: number;
  gst_amount?: number;
}

export interface TaxBreakdown {
  subtotal: number;
  igst?: number;
  cgst?: number;
  sgst?: number;
  total_tax: number;
  grand_total: number;
  amount_in_words: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  school_name: string;
  tenant_id: string;
  invoice_date: string; // ISO date
  due_date: string; // ISO date
  status: InvoiceStatus;
  
  // Seller info
  seller_name: string;
  seller_gstin: string;
  seller_state: string;
  
  // Buyer info
  buyer_name: string;
  buyer_gstin: string;
  buyer_state: string;
  
  // Line items
  line_items: InvoiceLineItem[];
  tax_breakdown: TaxBreakdown;
  
  // Metadata
  notes?: string;
  terms_conditions?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MrrData {
  current_mrr: number;
  previous_mrr: number;
  gst_collected: number;
  outstanding_amount: number;
  at_risk_amount: number;
  trend_percent: number;
  // Extended metrics
  gst_igst?: number;
  gst_cgst_sgst?: number;
  gst_trend_percent?: number;
  gst_month_label?: string;
  outstanding_count?: number;
  outstanding_avg_overdue_days?: number;
  invoices_ytd?: number;
  invoices_paid?: number;
  fiscal_year_label?: string;
  mrr_series?: number[];
  gst_series?: number[];
  outstanding_series?: number[];
  invoices_series?: number[];
  seller_gstin?: string;
  seller_state?: string;
}

export interface SubscriptionPlan {
  code: string;
  name: string;
  price_inr: number;
  billing_cycle: string;
  popular: boolean;
  description: string;
  features: string[];
  sort_order?: number;
}

export interface PlansCatalog {
  plans: SubscriptionPlan[];
  gst_percent: number;
  sac_code: string;
  sac_description: string;
  currency: string;
}

export interface BillingMetrics {
  mrr: MrrData;
  invoices: {
    total_count: number;
    paid_count: number;
    sent_count: number;
    overdue_count: number;
  };
}

// ============================================================================
// Audit Types
// ============================================================================

export type AuditAction =
  | 'school.provision'
  | 'school.update'
  | 'school.archive'
  | 'plan.upgrade'
  | 'plan.downgrade'
  | 'invoice.generated'
  | 'invoice.sent'
  | 'invoice.overdue'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.impersonate'
  | 'api_key.rotate'
  | 'backup.complete'
  | 'migration.start'
  | 'migration.complete'
  | 'migration.rollback'
  | 'policy.updated';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditEvent {
  id: string;
  timestamp: string; // ISO 8601
  actor: string;
  actor_ip: string;
  action: AuditAction;
  detail: string;
  severity: AuditSeverity;
  tenant_id?: string;
  school_name?: string;
  affected_fields?: string[];
  before_values?: Record<string, any>;
  after_values?: Record<string, any>;
  status: 'success' | 'partial' | 'failed';
  error_message?: string;
}

// ============================================================================
// Policy Types
// ============================================================================

export type PolicyCategory = 'security' | 'data_isolation' | 'billing' | 'system';

export interface GlobalPolicy {
  id: string;
  key: string; // e.g., 'password.min_length', 'gst.rate'
  category: PolicyCategory;
  description: string;
  value: string | number | boolean;
  value_type: 'string' | 'number' | 'boolean';
  is_toggle: boolean;
  is_overridable: boolean;
  default_value?: string | number | boolean;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface PolicyGroup {
  category: PolicyCategory;
  label: string;
  description: string;
  policies: GlobalPolicy[];
}

export interface UpdatePoliciesRequest {
  [key: string]: string | number | boolean;
}

// ============================================================================
// Feature Flag Types
// ============================================================================

export interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  tenant_id?: string;
  school_id?: string;
  config?: Record<string, any>;
}

// ============================================================================
// Search & Filter Types
// ============================================================================

export interface SchoolFilters {
  status?: SchoolStatus;
  board?: BoardType;
  plan?: PlanType;
  region?: RegionType;
  state?: string;
  search?: string;
  page?: number;
  page_size?: number;
  health_flag?: string;
}

export interface AuditFilters {
  actor?: string;
  action?: AuditAction;
  tenant_id?: string;
  severity?: AuditSeverity;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface InvoiceFilters {
  status?: InvoiceStatus;
  school_name?: string;
  tenant_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

// ============================================================================
// Component State Types
// ============================================================================

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export interface FormState {
  isDirty: boolean;
  isSubmitting: boolean;
  errors: Record<string, string>;
  successMessage: string | null;
}

export interface TableState {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
  filters: Record<string, any>;
}
