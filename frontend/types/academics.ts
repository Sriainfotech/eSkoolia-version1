/**
 * Consolidated Academics types — Timetable, Planning Studio, Reports.
 * Foundation's own types (AcademicYear, SchoolClass, Section, Subject, ...)
 * still live in components/academics/foundation/types.ts; re-exported here
 * so the three new modules import everything from one place instead of
 * redeclaring the same shapes a third time.
 */
export type {
  AcademicYear,
  ClassLevelGroup,
  ClassSubjectAssignment,
  ClassSubjectEntry,
  PagedResponse,
  SchoolClass,
  Section,
  Stream,
  Subject,
} from "@/components/academics/foundation/types";

export interface Teacher {
  id: number;
  full_name: string;
  staff_id?: number;
  designation?: string;
  department?: string;
  photo?: string | null;
  is_busy?: boolean;
  is_on_leave_today?: boolean;
  is_assigned?: boolean;
  periods_this_year?: number;
}

// ─── Timetable ──────────────────────────────────────────────────────────────

export type WeekdayCode = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface LevelScheduleConfig {
  id: number;
  school: number;
  academic_year: number;
  level_group: string;
  start_time: string; // "HH:MM:SS"
  end_time: string;
  period_duration_minutes: number;
  periods_per_day: number;
  snack_break_after_period: number | null;
  snack_break_minutes: number | null;
  lunch_break_after_period: number | null;
  lunch_break_minutes: number | null;
  bus_dispersal_time: string | null;
  pickup_time: string | null;
  working_days: WeekdayCode[];
  is_configured: boolean;
}

export interface ClassPeriod {
  id: number;
  period: string;
  start_time: string;
  end_time: string;
  period_type: "class" | "exam";
  is_break: boolean;
}

export interface ClassRoutineSlot {
  id: number;
  class_id: number;
  section_id: number;
  subject_id: number | null;
  subject?: { id: number; name: string } | null;
  teacher_id: number | null;
  teacher?: { id: number; get_full_name?: string } | null;
  day: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
  active_status: boolean;
}

export interface ClashEntry {
  day: string;
  start_time: string;
  teacher_id?: number;
  teacher_name?: string;
  room_id?: number;
  room_name?: string;
  slots: Array<{
    slot_id: number;
    class_id: number;
    class_name: string;
    section_id: number;
    section_name: string;
    subject_id: number | null;
    subject_name: string;
  }>;
}

// ─── Planning Studio ────────────────────────────────────────────────────────

export type WorkflowStatus = "draft" | "submitted" | "under_review" | "approved" | "revision_requested";

export interface Lesson {
  id: number;
  school_class: number;
  class_name?: string;
  section: number | null;
  section_name?: string;
  subject: number;
  subject_name?: string;
  lesson_title: string;
  active_status: boolean;
  topics_done?: number;
  topics_total?: number;
  topics_preview?: string[];
}

export interface LessonTopicDetail {
  id: number;
  topic: number;
  lesson: number;
  topic_title: string;
  completed_status: "Planned" | "In Progress" | "Completed" | "";
  competed_date: string | null;
}

export interface LessonGroup {
  class_id: number;
  class_name: string;
  section_id: number | null;
  section_name: string;
  subject_id: number;
  subject_name: string;
  items: Lesson[];
}

export interface LessonPlanner {
  id: number;
  class_id: number;
  class_name?: string;
  section_id: number | null;
  section_name?: string;
  subject_id: number;
  subject_name?: string;
  lesson_id: number | null;
  lesson_name?: string;
  teacher_id: number | null;
  teacher_name?: string;
  lesson_date: string;
  sub_topic: string;
  general_objectives: string;
  previous_knowledge: string;
  video_url: string;
  lecture_youtube_link: string;
  attachment: string;
  teaching_method: string;
  comp_question: string;
  note: string;
  completed_status: "Planned" | "In Progress" | "Completed" | "";
  completed_date: string | null;
  workflow_status: WorkflowStatus;
  submitted_by: number | null;
  submitted_at: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  review_notes: string;
}

export interface LessonPlanApprovalLogEntry {
  id: number;
  lesson_planner: number;
  action: WorkflowStatus;
  by: number | null;
  by_name: string;
  lesson_title: string;
  note: string;
  created_at: string;
}

export interface Homework {
  id: number;
  class_id_ref: number;
  section_id_ref: number | null;
  subject_id_ref: number;
  homework_date: string;
  submission_date: string;
  evaluation_date: string | null;
  marks: number | null;
  description: string;
  file: string | null;
}

export interface HomeworkSubmission {
  id: number;
  homework: number;
  student: number;
  marks: number | null;
  complete_status: "C" | "I" | "P" | "";
  note: string;
}

export interface UploadedContent {
  id: number;
  content_title: string;
  content_type: "sy" | "as" | "st" | "ot";
  class_id_ref: number | null;
  section_id_ref: number | null;
  source_url: string;
  upload_file: string | null;
  upload_date: string;
}

// ─── Reports ────────────────────────────────────────────────────────────────

export interface AcademicsReportsSummary {
  avg_coverage_pct: number;
  lessons_done_count: number;
  hw_pending_count: number;
  reports_ready_count: number;
}

export interface SyllabusProgressRow {
  class_id: number;
  class_name: string;
  done: number;
  total: number;
  pct: number;
}

export interface HomeworkEvaluationRow {
  id: number;
  title: string;
  class_name: string;
  section_name: string;
  subject_name: string;
  due_date: string;
  submitted_count: number;
  status: string;
  avg_score_pct: number | null;
}

export interface ReportDownload {
  key: string;
  name: string;
  description: string;
  format: string;
}
