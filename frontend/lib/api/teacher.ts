/**
 * Teacher Portal API client
 *
 * All functions:
 *  - Read the auth token from localStorage
 *  - Hit /api/v1/teacher/* endpoints
 *  - Throw on non-2xx (let callers handle errors)
 *  - Return typed interfaces only — no raw API shapes leaking to components
 *
 * Endpoints are added sprint-by-sprint. Sprint 0 has /teacher/me/.
 */

import { apiRequestWithRefresh } from '@/lib/api-auth';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClassTeacherFor {
  class_id: number;
  class_name: string;
  section_id: number;
  section_name: string;
  student_count: number;
}

export interface SubjectSection {
  class_id: number;
  class_name: string;
  section_id: number;
  section_name: string;
  student_count: number;
}

export interface SubjectAssignment {
  subject_id: number;
  subject_name: string;
  total_sections: number;
  total_students: number;
  sections: SubjectSection[];
}

export interface PendingItems {
  homework_to_review: number;
  attendance_pending: boolean;
}

export interface TodayPeriod {
  period: number;
  subject: string;
  class_name: string;
  section_name: string;
  room: string;
  from: string;
  to: string;
  is_now: boolean;
  is_done: boolean;
}

export interface TimetableSlot extends TodayPeriod {
  is_break: boolean;
}

export interface TimetableDay {
  day: string;
  day_key: string;
  is_today: boolean;
  periods: TimetableSlot[];
}

export interface TimetableKpis {
  total_periods: number;
  free_periods: number;
  cover_assignments: number;
  teaching_days: number;
}

export interface TeacherTimetable {
  week_of: string;
  days: TimetableDay[];
  kpis: TimetableKpis;
}

export interface TeacherMe {
  staff_id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  designation: string;
  designation_id: number | null;
  department: string;
  department_id: number | null;
  photo_url: string | null;

  /** The section this teacher is class teacher of — null for subject-only teachers */
  class_teacher_for: ClassTeacherFor | null;

  /**
   * All subject+class+section assignments.
   * Grouped by subject — used to compute the home screen layout dynamically.
   */
  subject_assignments: SubjectAssignment[];

  pending_items: PendingItems;
  /** Today's period-by-period schedule from ClassRoutineSlot */
  todays_periods: TodayPeriod[];
}

// ── View config ───────────────────────────────────────────────────────────────

export type TeacherViewLayout =
  | 'single_subject_many_classes'  // Art teacher: 1 subject, many classes
  | 'multi_subject'                 // Priya: Hindi + Maths, different classes
  | 'class_teacher_primary';        // Class teacher with few subjects

/**
 * Computes how the teacher home screen should be laid out
 * based purely on the teacher's assignment data.
 *
 * No hardcoded logic per role name. Adding new roles or changing
 * assignments requires zero code change — the layout updates automatically.
 */
export function computeTeacherViewLayout(me: TeacherMe): TeacherViewLayout {
  const subjectCount = me.subject_assignments.length;
  const totalSections = me.subject_assignments.reduce(
    (sum, s) => sum + s.total_sections, 0
  );

  // Single subject across many classes (e.g. Art teacher, Class 1–10)
  if (subjectCount === 1 && totalSections > 4) {
    return 'single_subject_many_classes';
  }

  // Class teacher with 1–2 subjects — class teacher card is the primary anchor
  if (me.class_teacher_for && subjectCount <= 2) {
    return 'class_teacher_primary';
  }

  // Multiple subjects — group by subject
  return 'multi_subject';
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function teacherGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(`/api/v1/teacher${path}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
}

// ── Sprint 3 types ────────────────────────────────────────────────────────────

/** One class+section entry returned by GET /teacher/my-classes/ */
export interface MyClass {
  class_id: number;
  class_name: string;
  section_id: number;
  section_name: string;
  /** True when the teacher is the designated class teacher for this section */
  is_class_teacher: boolean;
  /** Subjects they teach in this section (empty when they are CT only) */
  subjects: string[];
  student_count: number;
}

/** One row in the student list returned by GET /teacher/students/ */
export interface StudentListItem {
  id: number;
  student_id: string;          // UUID string
  name: string;
  roll_no: string;
  admission_no: string;
  gender: string;
  photo_url: string | null;
  /** null until Sprint 5 (Attendance module) */
  attendance_pct: number | null;
  /** null until Sprint 6 (Results module) */
  avg_score: number | null;
}

// ── Sprint 4 types ────────────────────────────────────────────────────────────

export type ProfileTab =
  | 'overview'
  | 'academic'
  | 'attendance'
  | 'behaviour'
  | 'homework'
  | 'communication'
  | 'notes'
  | 'credentials';

export interface StudentOverview {
  id: number;
  student_id: string;
  name: string;
  roll_no: string;
  admission_no: string;
  gender: string;
  photo_url: string | null;
  date_of_birth: string | null;
  blood_group: string;
  phone: string;
  email: string;
  class_name: string;
  section_name: string;
  class_id: number | null;
  section_id: number | null;
  guardian_name: string;
  guardian_phone: string;
  guardian_relation: string;
}

export interface ExamMarkRow {
  exam_name: string;
  term: string;
  subject: string;
  obtained: number;
  full_marks: number;
  pass_marks: number;
  absent: boolean;
  exam_date: string | null;
}

export interface AttendanceRecord {
  date: string;
  status: 'P' | 'A' | 'L' | 'F' | 'H';
  label: string;
  notes: string;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  half_day: number;
  holiday: number;
  attendance_pct: number | null;
}

export interface BehaviourRecord {
  title: string;
  point: number;
  description: string;
  assigned_by: string;
  date: string;
}

export interface StudentProfile {
  sections_available: ProfileTab[];
  overview: StudentOverview;
  academic: { marks: ExamMarkRow[] } | null;
  attendance: { records: AttendanceRecord[]; summary: AttendanceSummary } | null;
  behaviour: { records: BehaviourRecord[]; total_points: number } | null;
  homework: unknown[];
  communication: unknown[];
  notes: null;
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/teacher/me/
 * Returns the authenticated teacher's profile, assigned classes, and today's periods.
 */
export function fetchTeacherMe(): Promise<TeacherMe> {
  return teacherGet<TeacherMe>('/me/');
}

/**
 * GET /api/v1/teacher/timetable/
 * Returns the teacher's full weekly timetable grouped by day.
 */
export function fetchTeacherTimetable(): Promise<TeacherTimetable> {
  return teacherGet<TeacherTimetable>('/timetable/');
}

/**
 * GET /api/v1/teacher/my-classes/
 * Returns all class+section pairs assigned to the teacher (as CT or subject teacher).
 * Scope-safe by construction — no params needed.
 */
export function fetchMyClasses(): Promise<MyClass[]> {
  return teacherGet<MyClass[]>('/my-classes/');
}

/**
 * GET /api/v1/teacher/students/?class_id=<id>&section_id=<id>
 * Returns the student roster for a specific class+section.
 * Throws if the teacher is not assigned to that class+section (403).
 */
export function fetchStudentList(classId: number, sectionId: number): Promise<StudentListItem[]> {
  return teacherGet<StudentListItem[]>(`/students/?class_id=${classId}&section_id=${sectionId}`);
}

/**
 * GET /api/v1/teacher/students/<pk>/
 * Returns the permission-scoped student profile.
 * sections_available[] tells the frontend exactly which tabs to render.
 * Throws 403 if the student is not in this teacher's assigned class.
 * Throws 404 if the student does not exist.
 */
export function fetchStudentProfile(studentPk: number): Promise<StudentProfile> {
  return teacherGet<StudentProfile>(`/students/${studentPk}/`);
}

// ── Sprint 5 types — Credentials ─────────────────────────────────────────────

export interface PortalAccountInfo {
  has_account: boolean;
  username?: string;
  is_active?: boolean;
  last_login?: string | null;
  date_joined?: string | null;
}

export interface StudentCredentials {
  student: PortalAccountInfo;
  parent: PortalAccountInfo & {
    guardian_name?: string | null;
    guardian_relation?: string | null;
  };
}

export interface ResetPasswordResult {
  success: boolean;
  new_password: string;
  username: string;
  target: 'student' | 'parent';
}

/**
 * GET /api/v1/teacher/students/<pk>/credentials/
 * Returns portal account info for the student and their guardian.
 */
export function fetchStudentCredentials(studentPk: number): Promise<StudentCredentials> {
  return teacherGet<StudentCredentials>(`/students/${studentPk}/credentials/`);
}

/**
 * POST /api/v1/teacher/students/<pk>/reset-password/
 * Resets the portal password for the student or guardian.
 * Returns the new one-time password (requires students.manage).
 */
export function resetStudentPortalPassword(
  studentPk: number,
  target: 'student' | 'parent',
): Promise<ResetPasswordResult> {
  return apiRequestWithRefresh<ResetPasswordResult>(
    `/api/v1/teacher/students/${studentPk}/reset-password/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
      cache: 'no-store',
    },
  );
}
