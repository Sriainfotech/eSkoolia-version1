// ─── HR / HRMS TypeScript interfaces ────────────────────────────────────────

export interface DepartmentType {
  id: number | null;   // null for predefined types
  name: string;
  is_predefined: boolean;
  created_at?: string;
}

export interface Department {
  id: number;
  name: string;
  short_code: string;
  dept_type: string;                       // predefined OR custom free-text
  status: "active" | "inactive" | "archived";
  working_days: "Mon-Fri" | "Mon-Sat" | "All 7";
  head_id: number | null;
  deputy_head_id: number | null;
  head_name?: string | null;
  deputy_head_name?: string | null;
  email: string;
  description: string;
  is_active: boolean;
  designation_count?: number;
  staff_count?: number;
  attendance_pct?: number;
  created_at: string;
  updated_at: string;
}

export interface Designation {
  id: number;
  department: number;
  department_name?: string;
  name: string;
  short_code: string;
  status: "active" | "inactive";
  reports_to: "None" | "HOD" | "Principal" | "Vice Principal";
  employment_type: "Full-time" | "Part-time" | "Contract" | "Visiting Guest";
  role_template: "Teacher" | "Admin" | "Support" | "Finance" | "Transport" | "Library";
  grade_level: string;
  sort_order: number;
  staff_count?: number;
  is_active: boolean;
  created_at: string;
}

export interface Qualification {
  degree: string;
  university: string;
  year_of_passing: string;
  specialisation: string;
  percentage_cgpa: string;
}

export interface PreviousEmployer {
  name: string;
  designation_held: string;
  total_experience: string;
  from_date: string;
  to_date: string;
  last_salary: number | null;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  mobile: string;
  alternate_mobile: string;
  email: string;
}

export interface Nominee {
  name: string;
  relationship: string;
  share_pct: number;
}

export interface Staff {
  id: number;
  staff_no: string;
  staff_id?: string;           // alias / serializer computed
  biometric_rfid: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name?: string;          // computed by serializer
  date_of_birth: string;
  gender: "male" | "female" | "other" | "Male" | "Female" | "Other" | "Prefer not to say";
  blood_group?: string;
  mother_tongue: string;
  religion: string;
  nationality: string;
  department: number | null;
  department_name: string;
  designation: number | null;
  designation_name: string;
  role: number | string | null;
  role_name: string;
  joining_date: string;
  employment_type: "Full-time" | "Part-time" | "Contract" | "Visiting Guest";
  probation_period?: string;   // legacy free-text (deprecated)
  probation_value?: string;    // numeric part: "6"
  probation_unit?: string;     // unit: "days" | "months" | "years"
  probation_end_date?: string; // computed by backend
  reporting_manager: number | null;
  reporting_manager_name: string;
  mobile: string;
  phone_number?: string;       // alias for mobile
  alternate_mobile: string;
  official_email: string;
  personal_email: string;
  whatsapp: string;
  preferred_communication: string;
  address?: string;            // simple flat address field
  city?: string;
  state?: string;
  current_address: string;
  permanent_address: string;
  highest_qualification?: string;
  marital_status?: "single" | "married" | "divorced" | "widowed" | "Single" | "Married" | "Divorced" | "Widowed";
  num_children: number;
  spouse_name: string;
  emergency_contacts: EmergencyContact[];
  nominees: Nominee[];
  aadhaar: string;
  pan: string;
  passport_no: string;
  driving_licence: string;
  uan: string;
  esi_no: string;
  pt_reg: string;
  bank_name: string;
  bank_account_no: string;
  ifsc: string;
  qualifications: Qualification[];
  teaching_certifications: { bed_reg: string; ctet_score: string; subjects_qualified: string };
  previous_employers: PreviousEmployer[];
  medical_fitness_cert: string;
  medical_exam_date: string;
  medical_valid_till: string;
  disability_status: string;
  disability_cert: string;
  disability_pct: string;
  disability_issued_by: string;
  workplace_accommodations: string;
  basic_salary: number;
  hra: number;
  da: number;
  travel_allowance: number;
  medical_allowance: number;
  special_allowance: number;
  custom_allowances: Array<{ name: string; amount: number }>;
  custom_deductions: Array<{ name: string; amount: number }>;
  status: "active" | "inactive" | "probation" | "terminated" | "offboarded";
  photo: string;
  is_present: boolean;
  classes_subjects: string;
  email: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface StaffDocument {
  id: number;
  staff: number;
  name: string;
  doc_type: string;
  file_url: string;
  status: "uploaded" | "pending" | "requested";
  uploaded_at: string;
}

export interface LeaveType {
  id: number;
  code: string;
  name: string;
  color: string;
  unit?: "Days" | "Hours";      // form field
  max_days?: number;             // form field
  status?: "active" | "inactive"; // convenience
  description?: string;          // form field
  is_paid: boolean;
  carry_forward: boolean;
  carry_max: number;
  encash_days: number;
  proof_required: boolean;
  notice_days: number;
  half_day_allowed: boolean;
  statutory: boolean;
  statutory_min: number;
  max_consecutive: number;
  is_active: boolean;
  created_at: string;
}

export type EntitlementMatrix = Record<string, Record<string, number>>;

export interface ApprovalChain {
  designation: string;
  l1_approver: string;
  l2_approver: string;
  l2_trigger_days: number;
  response_window: string;
}

export interface LeaveApplication {
  id: number;
  staff: number;
  staff_name: string;
  staff_role: string;
  staff_grade: string;
  leave_type: number;
  leave_type_name: string;
  leave_type_color: string;
  from_date: string;
  to_date: string;
  start_date?: string;          // alias for from_date
  end_date?: string;            // alias for to_date
  duration: number;
  days_requested?: number;      // alias for duration
  half_day: boolean;
  half_day_type: "AM" | "PM" | null;
  reason: string;
  admin_note: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "stuck";
  days_stuck: number;
  l1_status: "pending" | "approved" | "rejected";
  l2_status: "pending" | "approved" | "rejected" | null;
  coverage_risk: boolean;
  unavailable_approver: boolean;
  is_on_behalf: boolean;
  created_at: string;
}

export interface LeaveBalance {
  leave_type: string;
  code: string;
  entitled: number;
  used: number;
  remaining: number;
}

export interface AttendanceRecord {
  id: number;
  staff: number;
  staff_name: string;
  department: string;
  department_name?: string;     // alternate naming
  designation: string;
  phone: string;
  date: string;
  is_absent: boolean;
  status: "present" | "absent" | "late" | "leave" | "half_day" | "on_leave";
  time_in?: string | null;      // also sign_in_time
  time_out?: string | null;
  lunch_out?: string | null;
  lunch_in?: string | null;
  sign_in_time: string | null;
  lunch: boolean;
  note: string;
  minutes_late: number;
  created_at: string;
}

export interface OffboardingRecord {
  id: number;
  staff: number;
  staff_name: string;
  staff_id: string;
  department: string;
  designation: string;
  joining_date: string;
  last_working_day: string;
  last_working_date?: string;   // alias
  exit_type: "Resignation" | "Termination" | "Retirement" | "End of Contract" | "Transfer" | "Voluntary Exit";
  exit_reason?: string;         // flat alias used in form
  notice_period_status: string;
  notice_period_days?: number;  // form field
  exit_interview_conducted: string;
  exit_interview_notes?: string; // form field
  interview_date: string;
  primary_reason: string;
  handover_checklist: Array<{ label: string; done: boolean }> | Record<string, boolean>;
  financial_clearance?: Record<string, boolean>; // form field
  ff_status: string;
  salary_dues_cleared: boolean;
  advance_loan: number;
  gratuity_applicable: boolean;
  pf_esi_settlement: string;
  docs_to_issue: string[];
  documents_to_issue?: string[]; // alias
  hod_approval: string;
  principal_approval: string;
  hr_signoff: string;
  finance_clearance: string;
  hr_notes: string;
  status: "initiated" | "in_progress" | "completed";
  is_complete?: boolean;         // computed from status
  completed_at: string | null;
  created_at: string;
}

// API pagination wrapper
export interface PaginatedHR<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
