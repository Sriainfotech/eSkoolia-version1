import { apiRequestWithRefresh } from "@/lib/api-auth";

export interface StudentDashboardMe {
  student_id: number;
  name: string;
  first_name: string;
  last_name: string;
  admission_no: string;
  roll_no: string;
  class_name: string;
  section_name: string;
  class_section: string;
  photo_url: string | null;
  school_name: string | null;
  attendance_last_30_days: {
    present: number;
    late: number;
    absent: number;
    total: number;
    pct: number | null;
  };
}

export interface StudentAttendanceData {
  summary_last_30_days: {
    present: number;
    late: number;
    absent: number;
    half_day: number;
    total: number;
    pct: number | null;
  };
  recent_records: Array<{
    date: string;
    status: string;
    notes: string;
  }>;
}

export interface StudentAcademicsData {
  class_name: string;
  section_name: string;
  academic_year: string | null;
  subjects: string[];
  upcoming_exams: Array<{
    exam: string;
    subject: string;
    date: string | null;
    start_time: string | null;
    end_time: string | null;
    room: string;
  }>;
}

export interface StudentResultsData {
  overall: {
    overall_pct: number | null;
    total_obtained: number;
    total_full_marks: number;
    subjects_count: number;
  };
  marks: Array<{
    exam: string;
    term: string;
    subject: string;
    date: string | null;
    obtained: number;
    full_marks: number;
    pass_marks: number | null;
    absent: boolean;
    score_pct: number | null;
  }>;
}

export interface StudentFeesData {
  summary: {
    total_assigned: number;
    total_paid: number;
    total_due: number;
    overdue_count: number;
  };
  assignments: Array<{
    fee_type: string;
    academic_year: string;
    due_date: string | null;
    amount: number;
    paid: number;
    due: number;
    status: "paid" | "partial" | "unpaid";
  }>;
  payments: Array<{
    fee_type: string;
    amount_paid: number;
    method: string;
    status: string;
    paid_at: string | null;
    reference: string;
  }>;
}

export interface StudentNoticeItem {
  id: number;
  title: string;
  message: string;
  notice_date: string | null;
  publish_on: string | null;
  author: string;
}

export interface StudentProfileData {
  student_id: number;
  name: string;
  first_name: string;
  last_name: string;
  admission_no: string;
  roll_no: string;
  date_of_birth: string | null;
  gender: string;
  blood_group: string;
  phone: string;
  email: string;
  address: {
    address_line: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
  };
  school_name: string | null;
  class_name: string;
  section_name: string;
  class_section: string;
  academic_year: string | null;
  photo_url: string | null;
  guardian: {
    name: string;
    relation: string;
    phone: string;
    email: string;
    occupation: string;
  } | null;
  transport: {
    route: string | null;
    vehicle: string | null;
  };
}

export function fetchStudentMe(): Promise<StudentDashboardMe> {
  return apiRequestWithRefresh<StudentDashboardMe>("/api/v1/student/me/", {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
}

export function fetchStudentAttendance(): Promise<StudentAttendanceData> {
  return apiRequestWithRefresh<StudentAttendanceData>("/api/v1/student/attendance/", {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
}

export function fetchStudentAcademics(): Promise<StudentAcademicsData> {
  return apiRequestWithRefresh<StudentAcademicsData>("/api/v1/student/academics/", {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
}

export function fetchStudentResults(): Promise<StudentResultsData> {
  return apiRequestWithRefresh<StudentResultsData>("/api/v1/student/results/", {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
}

export function fetchStudentFees(): Promise<StudentFeesData> {
  return apiRequestWithRefresh<StudentFeesData>("/api/v1/student/fees/", {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
}

export function fetchStudentNotices(): Promise<StudentNoticeItem[]> {
  return apiRequestWithRefresh<StudentNoticeItem[]>("/api/v1/student/notices/", {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
}

export function fetchStudentProfile(): Promise<StudentProfileData> {
  return apiRequestWithRefresh<StudentProfileData>("/api/v1/student/profile/", {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
}
