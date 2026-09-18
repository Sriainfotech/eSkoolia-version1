// Shared TypeScript shapes for the Examination module (Command Center, Exam
// Configuration, Exam Setup, Schedule & Logistics, Conduct & Marks, Results &
// Reports). Mirrors frontend/types/hr.ts's role for the HR module — import
// from here instead of redeclaring per-page ad hoc types.

export interface PaginatedExams<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── Lookups shared across sections ──────────────────────────────────────────
export interface ExamLookupOption { id: number; class_name?: string; section_name?: string; subject_name?: string; title?: string; class_id?: number }

export interface ExamTypeOption { id: number; title: string }
export interface ClassOption { id: number; class_name: string }
export interface SectionOption { id: number; section_name: string; class_id: number }
export interface SubjectOption { id: number; subject_name: string }
export interface RoomOption { id: number; room_no?: string; name?: string; description?: string }
export interface TeacherOption { id: number; full_name: string }
export interface ExamPeriodOption { id: number; period: string }

// ─── Exam Configuration ──────────────────────────────────────────────────────
export interface ExamType {
  id: number;
  school: number;
  academic_year: number | null;
  title: string;
  description: string;
  active_status: boolean;
  is_active: boolean;
  is_average: boolean;
  average_mark: string;
  counts_to_average: boolean;
  weight_percent: string;
  created_at: string;
  updated_at: string;
}

export type GradeScaleStyle = "percentage" | "letter" | "gpa";

export interface ExamGradeScaleGroup {
  id: number;
  school: number;
  name: string;
  style: GradeScaleStyle;
  min_pass_percent: string;
  is_default: boolean;
  band_count: number;
  created_at: string;
  updated_at: string;
}

export interface ExamGradeScale {
  id: number;
  school: number;
  group: number | null;
  name: string;
  min_percent: string;
  max_percent: string;
  gpa: string;
  is_fail: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Exam Setup ───────────────────────────────────────────────────────────────
export interface ExamSetupCriteria {
  classes: ClassOption[];
  sections: SectionOption[];
  subjects: SubjectOption[];
  exam_types: ExamTypeOption[];
}

export interface ExamSetupItem {
  id: number;
  school: number;
  academic_year: number | null;
  exam_term: number;
  school_class: number;
  section: number;
  subject: number;
  exam_title: string;
  exam_mark: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ExamSetupSearchResponse {
  items: ExamSetupItem[];
  totalMark: string;
}

// ─── Schedule & Logistics ─────────────────────────────────────────────────────
export interface ExamRoutineRow {
  id: number;
  exam_type: number;
  exam_type_name: string;
  class_name: string;
  class_id: number;
  section: string;
  section_id: number | null;
  subject: string;
  subject_id: number;
  teacher: string;
  teacher_id: number | null;
  room: string;
  room_id: number | null;
  date: string;
  period: number | null;
  period_name: string;
  start_time: string;
  end_time: string;
}

export interface HolidayItem {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  description: string;
}

export interface ExamScheduleCriteria {
  classes: ClassOption[];
  sections: SectionOption[];
  rooms: RoomOption[];
  exam_types: ExamTypeOption[];
  exam_periods: ExamPeriodOption[];
  teachers: TeacherOption[];
}

export interface AdmitCardSetting {
  id: number;
  admit_layout: number;
  student_photo: boolean;
  student_name: boolean;
  admission_no: boolean;
  class_section: boolean;
  exam_name: boolean;
  academic_year_label: boolean;
  principal_signature: boolean;
  guardian_name: boolean;
  class_teacher_signature: boolean;
  school_address: boolean;
  student_download: boolean;
  parent_download: boolean;
  student_notification: boolean;
  parent_notification: boolean;
  admit_sub_title: string;
  description: string;
}

export interface SeatPlanSetting {
  id: number;
  school_name: boolean;
  student_photo: boolean;
  student_name: boolean;
  roll_no: boolean;
  admission_no: boolean;
  class_section: boolean;
  exam_name: boolean;
  academic_year_label: boolean;
}

export interface ExamPlanStudentRecord {
  student_record_id: number;
  student_id: number;
  admission_no: string;
  roll_no: string;
  first_name: string;
  last_name: string;
}

// Distinct from ExamPlanStudentRecord above — /exam-report/index/ (backing
// exam-report/student-search) returns a plain student roster keyed by `id`
// and carrying class_id/section_id for client-side scoping, not the
// student_record_id shape the admit-card/seat-plan search endpoints use.
export interface ExamReportStudentOption {
  id: number;
  admission_no: string;
  first_name: string;
  last_name: string;
  roll_no: string;
  class_id: number;
  section_id: number | null;
}

// ─── Conduct & Marks ──────────────────────────────────────────────────────────
export interface ExamAttendanceCriteria {
  exams: ExamTypeOption[];
  classes: ClassOption[];
  sections: SectionOption[];
  subjects: SubjectOption[];
}

export interface ExamAttendanceStudentRow {
  student_record_id: number;
  student: number;
  class: number;
  section: number | null;
  admission_no: string;
  first_name: string;
  last_name: string;
  roll_no: string;
  attendance_type: "P" | "A";
}

export interface ExamMarksProgressRow {
  subject_id: number;
  subject_name: string;
  class_id: number;
  class_name: string;
  section_id: number | null;
  section_name: string;
  teacher_name: string;
  entered: number;
  total: number;
  status: "complete" | "in_progress" | "not_started";
}

export interface ExamMarksProgressSummary {
  rows: ExamMarksProgressRow[];
  total_entered: number;
  total_expected: number;
  percent: number;
}

export interface ExamMarkRegisterPart {
  id: number;
  exam_setup: number;
  exam_setup_id: number;
  exam_title: string;
  exam_mark: string;
  marks: string;
}

export interface ExamMarkRegisterRow {
  id: number;
  exam_term: number;
  school_class: number;
  section: number | null;
  subject: number;
  student: number;
  student_record_id: number | null;
  admission_no: string;
  first_name: string;
  last_name: string;
  roll_no: string;
  is_absent: boolean;
  total_marks: string;
  total_gpa_point: string;
  total_gpa_grade: string;
  teacher_remarks: string;
  parts: ExamMarkRegisterPart[];
}

export interface ExamMarksEntryComponent { id: number; exam_title: string; exam_mark: string }

export interface ExamMarksCreateStudentRow {
  student_record_id: number;
  student: number;
  class: number;
  section: number | null;
  admission_no: string;
  first_name: string;
  last_name: string;
  roll_no: string;
  marks: Record<string, string>;
  teacher_remarks: string;
  is_absent: boolean;
  total_marks: string;
  total_gpa_point: string;
  total_gpa_grade: string;
}

export interface ExamMarksCreateSearchResponse {
  students: ExamMarksCreateStudentRow[];
  marks_entry_form: ExamMarksEntryComponent[];
  search_info: { exam_name: string; class_name: string; section_name: string };
  exam_id: number;
  subject_id: number;
  class_id: number;
  section_id: number | null;
}

// ─── Results & Reports ────────────────────────────────────────────────────────
export type ReportCardTemplate = "cbse" | "icse" | "cambridge" | "ib" | "ssc" | "other";
export type ModerationWorkflow = "as_you_go" | "bulk" | "custom";

export interface ReportCardSetting {
  id: number;
  visible_to_class_teacher: boolean;
  visible_to_subject_teacher: boolean;
  template: ReportCardTemplate;
  include_photo: boolean;
  include_co_scholastic: boolean;
  include_attendance: boolean;
  include_comments: boolean;
  include_overall_notes: boolean;
  include_improvement: boolean;
  moderation_workflow: ModerationWorkflow;
}

export type ModerationFlagStatus = "pending" | "approved" | "rejected";

export interface ModerationFlag {
  id: number;
  exam_term: number;
  school_class: number;
  class_name: string;
  section: number | null;
  section_name: string;
  student: number;
  student_name: string;
  mark_register: number | null;
  reason: string;
  detail: string;
  status: ModerationFlagStatus;
  resolved_by: number | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ExamResultPublish {
  id: number;
  exam_term: number;
  school_class: number;
  section: number | null;
  is_published: boolean;
  published_at: string | null;
  published_by: number | null;
  principal_signoff: boolean;
  principal_signoff_by: number | null;
  principal_signoff_at: string | null;
}

export interface ExamResultPublishSearchResponse {
  search_info: { exam_name: string; class_name: string; section_name: string };
  total_mark_entries: number;
  is_published: boolean;
  published_at: string | null;
  principal_signoff: boolean;
  pending_moderation_count: number;
}

export interface MeritListRow {
  student_id: number;
  admission_no: string;
  student_name: string;
  roll_no: string;
  subject_count: number;
  total_marks: string;
  average_gpa: string;
  position: number;
}

export interface StudentReportSubjectRow {
  subject_id: number;
  subject_name: string;
  total_marks: string;
  grade: string;
  gpa: string;
  is_absent: boolean;
  remarks: string;
}

export interface StudentReportResponse {
  student: { id: number; admission_no: string; name: string; roll_no: string };
  search_info: { exam_name: string; class_name: string; section_name: string };
  subjects: StudentReportSubjectRow[];
  grand_total: string;
  average_gpa: string;
  result_published: boolean;
}

// ─── Command Center ───────────────────────────────────────────────────────────
export interface CommandCenterAttentionItem {
  severity: "danger" | "warn" | "info";
  title: string;
  detail: string;
}

export interface CommandCenterSummary {
  current_exam_term: { id: number; title: string } | null;
  needs_action_count: number;
  conflict_count: number;
  marks_entered_percent: number;
  ready_to_publish_count: number;
  pending_moderation_count: number;
  needs_attention: CommandCenterAttentionItem[];
  exams_scheduled_count: number;
  invigilators_assigned_count: number;
  teachers_submitted_marks_count: number;
  total_marks_teachers_count: number;
}

// ─── Online Exam (Schedule & Logistics · Step 4) ──────────────────────────────
export const ONLINE_EXAM_STATUS = { DRAFT: 0, PUBLISHED: 1, ARCHIVED: 2 } as const;

export interface OnlineExamRow {
  id: number;
  title: string;
  school_class: number;
  class_name: string;
  section: number;
  section_name: string;
  subject: number;
  subject_name: string;
  date: string;
  start_time: string;
  end_time: string;
  end_date_time: string;
  percentage: string;
  instruction: string;
  status: number;
  auto_mark: boolean;
}

export interface OnlineExamIndexResponse {
  classes: ClassOption[];
  sections: SectionOption[];
  subjects: SubjectOption[];
  online_exams: OnlineExamRow[];
}
