// ── Foundation workspace types (aligned with Django serializers) ────────────

export interface AcademicYear {
  id: number;
  name: string;
  board?: string | null;
  number_of_terms?: string | null;
  start_date: string;   // "YYYY-MM-DD"
  end_date: string;     // "YYYY-MM-DD"
  is_current: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Section {
  id: number;
  school_class: number;
  name: string;
  capacity: number;
  student_count: number;
  created_at?: string;
}

export interface Stream {
  id: number;
  name: string;
  is_active: boolean;
  capacity?: number;
  created_at?: string;
}

export type ClassLevelGroup = "pre_primary" | "primary" | "middle" | "secondary" | "senior_secondary";

export interface SchoolClass {
  id: number;
  name: string;
  numeric_order: number;
  /** Read-only — derived server-side from numeric_order, not independently editable. */
  level?: ClassLevelGroup | null;
  is_active: boolean;
  total_students: number;
  sections: Section[];
  streams?: number[];
  stream_details?: Stream[];
  created_at?: string;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  subject_type: "compulsory" | "optional" | "elective";
  description?: string;
  created_at?: string;
}

export interface ClassSubjectAssignment {
  id: number;
  school_class: number;
  section: number | null;
  subject: number;
  is_optional: boolean;
  academic_year: number | null;
}

export type ClassSubjectEntryType =
  | "core"
  | "first_language"
  | "second_language"
  | "third_language"
  | "sport"
  | "club"
  | "co_curricular"
  | "optional";

export interface ClassSubjectEntry {
  id: number;
  school: number;
  school_class: number;
  name: string;
  code: string;
  subject_type: ClassSubjectEntryType;
  periods_per_week: number;
  active_status: boolean;
  created_at: string;
}

export type WizardStep = "year" | "classes" | "sections" | "subjects";

export interface FoundationStats {
  years: number;
  currentYear: string;
  classes: number;
  sections: number;
  subjects: number;
}

export interface Toast {
  message: string;
  tone: "success" | "error";
}

// API list wrapper shape
export interface PagedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
