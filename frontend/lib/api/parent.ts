/**
 * Parent Portal API client
 *
 * All functions hit /api/v1/parent/* endpoints, scoped to the
 * authenticated guardian's profile. No URL params carry student identity —
 * all scoping is enforced server-side via Guardian.user.
 */

import { apiRequestWithRefresh } from "@/lib/api-auth";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChildSummary {
  id: number;
  name: string;
  admission_no: string;
  roll_no: string;
  class_name: string;
  section_name: string;
  class_id: number | null;
  section_id: number | null;
  photo_url: string | null;
  gender: string;
}

export interface ChildWithStats extends ChildSummary {
  /** Attendance percentage over the last 90 days. null if no records yet. */
  attendance_pct: number | null;
}

export interface ParentMe {
  guardian_id: number;
  name: string;
  relation: string;
  phone: string;
  email: string;
  occupation: string;
  children: ChildSummary[];
  children_count: number;
}

export interface AttendanceSummary {
  present: number;
  late: number;
  absent: number;
  half_day: number;
  total: number;
  pct: number | null;
}

export interface ExamMarkRow {
  subject: string;
  exam_name: string;
  term: string;
  obtained: number;
  full_marks: number;
  pass_marks: number;
  absent: boolean;
  exam_date: string | null;
}

export interface ChildDetail extends ChildSummary {
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  blood_group: string;
  attendance: AttendanceSummary;
  recent_marks: ExamMarkRow[];
  behaviour_points: number;
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function parentGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(`/api/v1/parent${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/parent/me/
 * Returns the guardian's profile and lightweight children list.
 * Called once by ParentChildContext — not called directly in pages.
 */
export function fetchParentMe(): Promise<ParentMe> {
  return parentGet<ParentMe>("/me/");
}

/**
 * GET /api/v1/parent/children/
 * Returns children with attendance stats (last 90 days).
 */
export function fetchParentChildren(): Promise<ChildWithStats[]> {
  return parentGet<ChildWithStats[]>("/children/");
}

/**
 * GET /api/v1/parent/children/<id>/
 * Returns one child's full profile: attendance summary, exam marks, behaviour.
 * Returns 404 if the child does not belong to the authenticated guardian.
 */
export function fetchChildDetail(childId: number): Promise<ChildDetail> {
  return parentGet<ChildDetail>(`/children/${childId}/`);
}

// ── Attendance calendar ───────────────────────────────────────────────────────

export interface AttendanceDay {
  date: string;
  type: "P" | "A" | "L" | "F" | "H";
}

export interface HolidayDay {
  date: string;
  title: string;
}

export interface AttendanceCalendarSummary {
  present: number;
  absent: number;
  late: number;
  half_day: number;
  total: number;
  pct: number | null;
}

export interface AttendanceCalendar {
  year: number;
  month: number;
  child_id: number;
  child_name: string;
  days: AttendanceDay[];
  holidays: HolidayDay[];
  summary: AttendanceCalendarSummary;
}

/**
 * GET /api/v1/parent/attendance/?child_id=<id>&month=YYYY-MM
 */
export function fetchAttendanceCalendar(childId: number, month: string): Promise<AttendanceCalendar> {
  return parentGet<AttendanceCalendar>(`/attendance/?child_id=${childId}&month=${month}`);
}

// ── Fees ──────────────────────────────────────────────────────────────────────

export interface FeeItem {
  id: number;
  fee_name: string;
  amount: number;
  discount: number;
  net_amount: number;
  paid_amount: number;
  due_amount: number;
  due_date: string;
  status: "unpaid" | "partial" | "paid";
}

export interface FeeGroup {
  group_name: string;
  items: FeeItem[];
}

export interface FeesSummary {
  total_billed: number;
  total_paid: number;
  total_due: number;
}

export interface ChildFees {
  child_id: number;
  child_name: string;
  summary: FeesSummary;
  groups: FeeGroup[];
}

/**
 * GET /api/v1/parent/fees/?child_id=<id>
 */
export function fetchChildFees(childId: number): Promise<ChildFees> {
  return parentGet<ChildFees>(`/fees/?child_id=${childId}`);
}

// ── Notices ───────────────────────────────────────────────────────────────────

export interface NoticeItem {
  id: number;
  title: string;
  message: string;
  notice_date: string;
  publish_on: string;
}

/**
 * GET /api/v1/parent/notices/
 */
export function fetchParentNotices(): Promise<NoticeItem[]> {
  return parentGet<NoticeItem[]>("/notices/");
}
