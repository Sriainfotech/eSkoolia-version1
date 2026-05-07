// All admissions-related TypeScript interfaces

export type ApiInquiry = {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  query_date: string | null;
  follow_up_date: string | null;
  next_follow_up_date: string | null;
  assigned: string;
  reference: number | null;
  reference_name?: string;
  source: number | null;
  source_name?: string;
  school_class: number | null;
  class_name_resolved?: string;
  no_of_child: number;
  active_status: number;
  status: string;
  note: string;
  lead_score?: number;
  documents_status?: string;
  last_contacted_at?: string;
};

export type ApiSection = {
  id: number;
  school_class: number;
  name: string;
  capacity: number;
  student_count: number;
  created_at: string;
};

export type ApiSchoolClass = {
  id: number;
  name: string;
  numeric_order?: number;
  sections?: ApiSection[];
  total_students?: number;
};

export type ApiAdminSetup = { id: number; type: string; name: string };

export type ClassConfig = {
  id: number;
  name: string;
  capacity: number;
  sections: ApiSection[];
  pipelineCount: number;
  enrolledCount: number;
  overdueCount: number;
  healthStatus: "urgent" | "active" | "healthy" | "quiet";
};

export type MorningBriefData = {
  newToday: number;
  overdueFollowUp: number;
  visitsToday: number;
  decisionsPending: number;
};

export type StageTab = "all" | "new" | "active" | "pending" | "enrolled" | "waitlist" | "cold";

export type DrawerForm = {
  full_name: string;
  phone: string;
  email: string;
  school_class: string;
  no_of_child: string;
  source: string;
  reference: string;
  query_date: string;
  next_follow_up_date: string;
  assigned: string;
  description: string;
  active_status: "1" | "2";
  note: string;
  child_name: string;
  child_dob: string;
  child_gender: string;
  parent_occupation: string;
  previous_school: string;
  reason_for_change: string;
  budget_range: string;
  preferred_contact_time: string;
  sibling_count: string;
  specific_requirements: string;
  relationship: string;
  alternate_phone: string;
  home_area: string;
  has_sibling_enrolled: string;
  sibling_name: string;
  sibling_class_name: string;
  referred_by: string;
  preferred_visit_date: string;
  preferred_visit_time: string;
};

export type LogForm = {
  outcome: string;
  note: string;
  next_follow_up_date: string;
  status: string;
};

export type ApiList<T> = T[] | { results?: T[] };
