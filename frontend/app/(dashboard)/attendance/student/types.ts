// types.ts

export type SyncStatus = 'live' | 'partial' | 'none';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'unmarked';
export type LevelFilter = 'all' | 'primary' | 'middle' | 'secondary';

export interface SectionSummary {
  id: number;
  name: string;
  student_count: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  unmarked_count: number;
  attendance_pct: number;
  sync_status: SyncStatus;
}

export interface ClassInfo {
  id: number;
  name: string;
  display_label: string;
  sub_label: string;
  level: 'primary' | 'middle' | 'secondary';
  sections: SectionSummary[];
  total_students: number;
  total_present: number;
  total_absent: number;
  total_late: number;
  overall_pct: number;
  sync_status: SyncStatus;
}

export interface Student {
  id: number;
  admission_no: string;
  roll_no: string;
  full_name: string;
  initials: string;
  avatar_color: string;
  group: string;
  synced_from_app: boolean;
  rte_pct: number | null;
  status: AttendanceStatus;
  absent_reason: string | null;
  arrival_time: string | null;
  is_late: boolean;
  late_minutes: number;
  sign_in_time: string | null;
  sign_out_time: string | null;
  pickup_time: string | null;
  pickup_by: string | null;
  lunch: boolean;
  notes_count: number;
  notes: StudentNote[];
}

export interface StudentNote {
  id: string;
  text: string;
  created_at: string;
}

export interface AttendanceMark {
  student_id: number;
  date: string;
  class_id?: number;
  section_id?: number;
  status?: AttendanceStatus;
  absent_reason?: string;
  arrival_time?: string;
  sign_in_time?: string;
  sign_out_time?: string;
  pickup_time?: string;
  lunch?: boolean;
  note?: string;
}

export interface KPIData {
  total_students: number;
  present_today: number;
  absent_today: number;
  late_today: number;
  classes_marked: number;
  total_classes: number;
  present_pct: number;
  weekly_avg_pct: number;
  chronic_absentees: number;
  rte_at_risk: number;
  absent_with_reason: number;
  late_student_name: string | null;
  late_minutes: number | null;
  delta_pct: number;
}

export interface WeeklyBar {
  label: string;
  present_pct: number;
  absent_pct: number;
}

export interface MonthlyReportData {
  weeks: WeeklyBar[];
  month_total: { present_pct: number; absent_pct: number };
}
