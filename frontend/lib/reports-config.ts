export type ReportDefinition = {
  key: string;
  title: string;
  endpoint: string;
  columns?: { key: string; label: string }[];
  filterFields?: ReportFilterField[];
};

export type ReportFilterField = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  source?:
    | "classes"
    | "sections"
    | "students"
    | "subjects"
    | "exams"
    | "departments"
    | "designations"
    | "staff"
    | "routes"
    | "vehicles"
    | "books"
    | "categories"
    | "suppliers"
    | "incidents";
  dependsOn?: string[];
};

const selectLookup = (
  key: string,
  label: string,
  source: NonNullable<ReportFilterField["source"]>,
  dependsOn?: string[],
): ReportFilterField => ({
  key,
  label,
  type: "select",
  source,
  dependsOn,
});

const DEFAULT_REPORT_FILTERS: ReportFilterField[] = [
  { key: "keyword", label: "Keyword", type: "text", placeholder: "Search" },
  { key: "start_date", label: "Start Date", type: "date" },
  { key: "end_date", label: "End Date", type: "date" },
];

const CLASS_SECTION_STUDENT_FILTERS: ReportFilterField[] = [
  selectLookup("class_id", "Class", "classes"),
  selectLookup("section_id", "Section", "sections", ["class_id"]),
  selectLookup("student_id", "Student", "students", ["class_id", "section_id"]),
  ...DEFAULT_REPORT_FILTERS,
];

const EXAM_SCOPE_FILTERS: ReportFilterField[] = [
  selectLookup("exam_term_id", "Exam", "exams"),
  selectLookup("class_id", "Class", "classes"),
  selectLookup("section_id", "Section", "sections", ["class_id"]),
  selectLookup("student_id", "Student", "students", ["class_id", "section_id"]),
  selectLookup("subject_id", "Subject", "subjects"),
  ...DEFAULT_REPORT_FILTERS,
];

const STAFF_FILTERS: ReportFilterField[] = [
  selectLookup("department_id", "Department", "departments"),
  selectLookup("designation_id", "Designation", "designations", ["department_id"]),
  selectLookup("staff_id", "Staff", "staff", ["department_id", "designation_id"]),
  {
    key: "attendance_type",
    label: "Attendance Type",
    type: "select",
    // Values must match StaffAttendance.STATUS_CHOICES (backend/apps/hr/models.py) —
    // single-letter codes, and note "L" means Leave for staff (not Late).
    options: [
      { value: "", label: "All" },
      { value: "P", label: "Present" },
      { value: "A", label: "Absent" },
      { value: "L", label: "Leave" },
      { value: "F", label: "Half Day" },
      { value: "H", label: "Holiday" },
    ],
  },
  ...DEFAULT_REPORT_FILTERS,
];

const TRANSPORT_FILTERS: ReportFilterField[] = [
  selectLookup("class_id", "Class", "classes"),
  selectLookup("section_id", "Section", "sections", ["class_id"]),
  selectLookup("route_id", "Route", "routes"),
  selectLookup("vehicle_id", "Vehicle", "vehicles", ["route_id"]),
  ...DEFAULT_REPORT_FILTERS,
];

const REPORTS: Record<string, ReportDefinition> = {
  "students/student-report": {
    key: "students/student-report",
    title: "Student Report",
    endpoint: "/api/v1/reports/students/student-report/",
    filterFields: CLASS_SECTION_STUDENT_FILTERS,
  },
  "students/guardian-report": {
    key: "students/guardian-report",
    title: "Guardian Report",
    endpoint: "/api/v1/reports/students/guardian-report/",
    filterFields: CLASS_SECTION_STUDENT_FILTERS,
  },
  "fees/balance-fees-report": {
    key: "fees/balance-fees-report",
    title: "Balance Fees Report",
    endpoint: "/api/v1/reports/fees/balance-fees-report/",
    filterFields: CLASS_SECTION_STUDENT_FILTERS,
  },
  "fees/collection-report": {
    key: "fees/collection-report",
    title: "Collection Report",
    endpoint: "/api/v1/reports/fees/collection-report/",
    filterFields: CLASS_SECTION_STUDENT_FILTERS,
  },
  "fees/student-fine-report": {
    key: "fees/student-fine-report",
    title: "Student Fine Report",
    endpoint: "/api/v1/reports/fees/student-fine-report/",
    filterFields: CLASS_SECTION_STUDENT_FILTERS,
  },
  "academics/class-report": {
    key: "academics/class-report",
    title: "Class Report",
    endpoint: "/api/v1/reports/academics/class-report/",
    filterFields: [
      selectLookup("class_id", "Class", "classes"),
      selectLookup("section_id", "Section", "sections", ["class_id"]),
      selectLookup("exam_term_id", "Exam", "exams"),
      selectLookup("subject_id", "Subject", "subjects"),
      ...DEFAULT_REPORT_FILTERS,
    ],
  },
  "academics/class-routine-report": {
    key: "academics/class-routine-report",
    title: "Class Routine Report",
    endpoint: "/api/v1/reports/academics/class-routine-report/",
    filterFields: [
      selectLookup("class_id", "Class", "classes"),
      selectLookup("section_id", "Section", "sections", ["class_id"]),
      selectLookup("exam_term_id", "Exam", "exams"),
      ...DEFAULT_REPORT_FILTERS,
    ],
  },
  "examination/exam-routine-report": {
    key: "examination/exam-routine-report",
    title: "Exam Routine Report",
    endpoint: "/api/v1/reports/examination/exam-routine-report/",
    filterFields: EXAM_SCOPE_FILTERS,
  },
  "examination/teacher-class-routine-report": {
    key: "examination/teacher-class-routine-report",
    title: "Teacher Class Routine Report",
    endpoint: "/api/v1/reports/examination/teacher-class-routine-report/",
    filterFields: EXAM_SCOPE_FILTERS,
  },
  "examination/merit-list-report": {
    key: "examination/merit-list-report",
    title: "Merit List Report",
    endpoint: "/api/v1/reports/examination/merit-list-report/",
    filterFields: EXAM_SCOPE_FILTERS,
  },
  "examination/online-exam-report": {
    key: "examination/online-exam-report",
    title: "Online Exam Report",
    endpoint: "/api/v1/reports/examination/online-exam-report/",
    filterFields: EXAM_SCOPE_FILTERS,
  },
  "examination/mark-sheet-report-student": {
    key: "examination/mark-sheet-report-student",
    title: "Mark Sheet Report Student",
    endpoint: "/api/v1/reports/examination/mark-sheet-report-student/",
    filterFields: EXAM_SCOPE_FILTERS,
  },
  "examination/tabulation-sheet-report": {
    key: "examination/tabulation-sheet-report",
    title: "Tabulation Sheet Report",
    endpoint: "/api/v1/reports/examination/tabulation-sheet-report/",
    filterFields: EXAM_SCOPE_FILTERS,
  },
  "examination/progress-card-report": {
    key: "examination/progress-card-report",
    title: "Progress Card Report",
    endpoint: "/api/v1/reports/examination/progress-card-report/",
    filterFields: EXAM_SCOPE_FILTERS,
  },
  "accounts/payroll-report": {
    key: "accounts/payroll-report",
    title: "Payroll Report",
    endpoint: "/api/v1/reports/accounts/payroll-report/",
    filterFields: STAFF_FILTERS,
  },
  "dormitory/student-dormitory-report": {
    key: "dormitory/student-dormitory-report",
    title: "Student Dormitory Report",
    endpoint: "/api/v1/reports/dormitory/student-dormitory-report/",
    filterFields: CLASS_SECTION_STUDENT_FILTERS,
  },
  "transport/student-transport-report": {
    key: "transport/student-transport-report",
    title: "Student Transport Report",
    endpoint: "/api/v1/reports/transport/student-transport-report/",
    filterFields: TRANSPORT_FILTERS,
  },
  student: {
    key: "student",
    title: "Student Report",
    endpoint: "/api/v1/reports/student/",
    filterFields: CLASS_SECTION_STUDENT_FILTERS,
  },
  exam: {
    key: "exam",
    title: "Exam Report",
    endpoint: "/api/v1/reports/exam/",
    filterFields: EXAM_SCOPE_FILTERS,
  },
  staff: {
    key: "staff",
    title: "Staff Report",
    endpoint: "/api/v1/reports/staff/",
    filterFields: STAFF_FILTERS,
  },
  fees: {
    key: "fees",
    title: "Fees Report",
    endpoint: "/api/v1/reports/fees/",
    filterFields: CLASS_SECTION_STUDENT_FILTERS,
  },
  accounts: {
    key: "accounts",
    title: "Accounts Report",
    endpoint: "/api/v1/reports/accounts/",
    filterFields: DEFAULT_REPORT_FILTERS,
  },
  "accounts/fee-collection": {
    key: "accounts/fee-collection",
    title: "Accounts Fee Collection",
    endpoint: "/api/v1/reports/accounts/fee-collection/",
    filterFields: CLASS_SECTION_STUDENT_FILTERS,
  },
  "accounts/expense": {
    key: "accounts/expense",
    title: "Accounts Expense",
    endpoint: "/api/v1/reports/accounts/expense/",
    filterFields: DEFAULT_REPORT_FILTERS,
  },
  "students/list": {
    key: "students/list",
    title: "Students List",
    endpoint: "/api/v1/reports/students/list/",
    filterFields: CLASS_SECTION_STUDENT_FILTERS,
  },
  "students/attendance": {
    key: "students/attendance",
    title: "Student Attendance",
    endpoint: "/api/v1/reports/students/attendance/",
    filterFields: [
      selectLookup("class_id", "Class", "classes"),
      selectLookup("section_id", "Section", "sections", ["class_id"]),
      selectLookup("student_id", "Student", "students", ["class_id", "section_id"]),
      {
        key: "attendance_type",
        label: "Attendance Type",
        type: "select",
        // Values must match ATTENDANCE_TYPE_CHOICES (backend/apps/attendance/models.py) —
        // single-letter codes, direct-equality filter on the backend.
        options: [
          { value: "", label: "All" },
          { value: "P", label: "Present" },
          { value: "A", label: "Absent" },
          { value: "L", label: "Late" },
          { value: "F", label: "Half Day" },
          { value: "H", label: "Holiday" },
        ],
      },
      ...DEFAULT_REPORT_FILTERS,
    ],
  },
  "examination/marks": {
    key: "examination/marks",
    title: "Examination Marks",
    endpoint: "/api/v1/reports/examination/marks/",
    filterFields: EXAM_SCOPE_FILTERS,
  },
  "examination/result-summary": {
    key: "examination/result-summary",
    title: "Exam Result Summary",
    endpoint: "/api/v1/reports/examination/result-summary/",
    filterFields: EXAM_SCOPE_FILTERS,
  },
  "library/issue-return": {
    key: "library/issue-return",
    title: "Library Issue Return",
    endpoint: "/api/v1/reports/library/issue-return/",
    filterFields: [
      selectLookup("book_id", "Book", "books"),
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "", label: "All" },
          { value: "issued", label: "Issued" },
          { value: "returned", label: "Returned" },
          { value: "lost", label: "Lost" },
        ],
      },
      {
        key: "member_type",
        label: "Member Type",
        type: "select",
        options: [
          { value: "", label: "All" },
          { value: "student", label: "Student" },
          { value: "staff", label: "Staff" },
        ],
      },
      ...DEFAULT_REPORT_FILTERS,
    ],
  },
  "academic/class-performance": {
    key: "academic/class-performance",
    title: "Academic Class Performance",
    endpoint: "/api/v1/reports/academic/class-performance/",
    filterFields: [
      selectLookup("exam_term_id", "Exam", "exams"),
      selectLookup("class_id", "Class", "classes"),
      selectLookup("section_id", "Section", "sections", ["class_id"]),
      selectLookup("subject_id", "Subject", "subjects"),
      ...DEFAULT_REPORT_FILTERS,
    ],
  },
  "hr/staff-attendance": {
    key: "hr/staff-attendance",
    title: "HR Staff Attendance",
    endpoint: "/api/v1/reports/hr/staff-attendance/",
    filterFields: STAFF_FILTERS,
  },
  "transport/student": {
    key: "transport/student",
    title: "Transport Student",
    endpoint: "/api/v1/reports/transport/student/",
    filterFields: TRANSPORT_FILTERS,
  },
  "inventory/stock": {
    key: "inventory/stock",
    title: "Inventory Stock",
    endpoint: "/api/v1/reports/inventory/stock/",
    filterFields: [
      selectLookup("category_id", "Category", "categories"),
      selectLookup("supplier_id", "Supplier", "suppliers"),
      {
        key: "low_stock_only",
        label: "Low Stock Only",
        type: "select",
        options: [
          { value: "", label: "All" },
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ],
      },
      ...DEFAULT_REPORT_FILTERS,
    ],
  },
  "behaviour/incidents": {
    key: "behaviour/incidents",
    title: "Behaviour Incidents",
    endpoint: "/api/v1/reports/behaviour/incidents/",
    filterFields: [
      selectLookup("incident_id", "Incident", "incidents"),
      selectLookup("class_id", "Class", "classes"),
      selectLookup("section_id", "Section", "sections", ["class_id"]),
      selectLookup("student_id", "Student", "students", ["class_id", "section_id"]),
      ...DEFAULT_REPORT_FILTERS,
    ],
  },
};

export function getReportDefinition(key: string): ReportDefinition | null {
  return REPORTS[key] || null;
}
