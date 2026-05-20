import {
  LayoutGrid,
  Users,
  GraduationCap,
  UserCheck,
  ClipboardList,
  HandCoins,
  Landmark,
  UserCog,
  BookOpen,
  Bus,
  Package,
  AlertTriangle,
  UserPlus,
  Briefcase,
  Settings,
  BarChart2,
  MessageCircle,
  BookMarked,
  Calendar,
  School,
  DollarSign,
  AlertCircle,
  CreditCard,
  ChartBar,
  BanknoteIcon,
  ArrowRightLeft,
  Building2,
  ClipboardCheck,
  FileText,
  FileBadge,
  FileBarChart,
  ShieldCheck,
  Lock,
  LogIn,
  BookOpenCheck,
  BookmarkCheck,
  UserSearch,
  MapPin,
  Truck,
  Route,
  Car,
  Store,
  FlagTriangleRight,
  MessageSquare,
  Mail,
  Phone,
  Send,
  BadgeCheck,
  Award,
  ShieldAlert,
  Globe,
  Star,
  List,
  Navigation,
  UserX,
  type LucideIcon,
} from 'lucide-react';

export interface SubRoute {
  label: string;
  path: string;
  icon?: LucideIcon;
  permission?: string;
}

export interface ModuleRoute {
  id: string;
  name: string;
  path: string;
  icon: LucideIcon;
  bg: string;
  ic: string;
  sub: SubRoute[];
  permission?: string;
}

export const MODULES: ModuleRoute[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    path: '/dashboard',
    icon: LayoutGrid,
    bg: '#EEF2FF',
    ic: '#4F46E5',
    sub: [],
  },
  {
    id: 'roles',
    name: 'Roles & Permissions',
    path: '/roles',
    icon: ShieldCheck,
    bg: '#F5F3FF',
    ic: '#6D28D9',
    permission: 'roles',
    sub: [
      { label: 'Roles & Assign Permissions', path: '/roles/assign-permission', icon: Lock, permission: 'role_permission.assign_permission.manage' },
      { label: 'Login Permission', path: '/roles/login-permission', icon: LogIn, permission: 'role_permission.login_permission.manage' },
      // HIDDEN - no backend yet
      // { label: 'Due Fees Login', path: '/roles/due-fees-login-permission', icon: ShieldAlert },
    ],
  },
  {
    id: 'admin',
    name: 'Administration',
    path: '/administration/communication-hub',
    icon: Briefcase,
    bg: '#FDF4FF',
    ic: '#A21CAF',
    permission: 'admin_section',
    sub: [
      { label: 'Communication Hub', path: '/administration/communication-hub', icon: UserSearch },
      { label: 'Postal Management',  path: '/administration/postal',            icon: Mail       },
      { label: 'Documents Studio',   path: '/administration/documents',          icon: FileBadge  },
      { label: 'System Config',      path: '/administration/system-config',      icon: Settings   },
    ],
  },
  {
    id: 'admissions',
    name: 'Admissions',
    path: '/admissions/command-center',
    icon: UserPlus,
    bg: '#ECFDF5',
    ic: '#047857',
    permission: 'admissions',
    sub: [
      { label: 'Command Center', path: '/admissions/command-center', icon: LayoutGrid },
      { label: 'Analytics', path: '/admissions/analytics', icon: BarChart2 },
      { label: 'Marketing', path: '/admissions/marketing', icon: Send },
    ],
  },
  {
    id: 'students',
    name: 'Students',
    path: '/students/list',
    icon: Users,
    bg: '#FEF3F2',
    ic: '#B42318',
    permission: 'student_info',
    sub: [
      { label: 'Student Enroll & List', path: '/students/list', icon: Users, permission: 'student_info.student_list.view' },
      { label: 'Multi Subject Assignment', path: '/students/multi-class', icon: GraduationCap, permission: 'student_info.multi_class_student.view' },
      { label: 'Student Group', path: '/student-groups', icon: UserCheck, permission: 'student_info.student_group.view' },
      { label: 'Student Promote', path: '/students/promote', icon: Star, permission: 'student_info.student_promote.view' },
    ],
  },
  {
    id: 'attendance',
    name: 'Attendance',
    path: '/attendance/student',
    icon: UserCheck,
    bg: '#FFFBEB',
    ic: '#B45309',
    permission: 'attendance',
    sub: [
      { label: 'Student Attendance', path: '/attendance/student', icon: UserCheck, permission: 'student_info.student_attendance.view' },
    ],
  },
  {
    id: 'academics',
    name: 'Academics',
    path: '/academics/core-setup',
    icon: GraduationCap,
    bg: '#F0FDF4',
    ic: '#15803D',
    permission: 'academics',
    sub: [
      // ── Workspace tabs (primary navigation) ─────────────────────────────
      { label: 'Foundation',      path: '/academics/core-setup',         icon: LayoutGrid,   permission: 'academics.core_setup.view' },
      { label: 'Staff',           path: '/academics/staff-workspace',    icon: Users,        permission: 'academics' },
      { label: 'Timetable',       path: '/academics/timetable',          icon: Calendar,     permission: 'academics' },
      { label: 'Planning Studio', path: '/academics/planning-studio',    icon: BookOpen,     permission: 'academics' },
      { label: 'Reports',         path: '/academics/academic-reports',   icon: FileBarChart, permission: 'academics' },

      // HIDDEN - replaced with workspace navigation
      // { label: 'Core Setup',            path: '/academics/core-setup',                 icon: Settings,       permission: 'academics.core_setup.view' },
      // { label: 'Assign Class Teacher',  path: '/academics/assign-class-teacher',       icon: UserCog,        permission: 'academics.assign_class_teacher.view' },
      // { label: 'Assign Subject',        path: '/academics/assign-subject',             icon: ClipboardList,  permission: 'academics.assign_subject.view' },
      // { label: 'Class Room',            path: '/academics/class-room',                 icon: School,         permission: 'academics.class_room.view' },
      // { label: 'Class Routine',         path: '/academics/class-routine',              icon: Calendar,       permission: 'academics.class_routine.view' },
      // { label: 'Lessons',               path: '/academics/lessons',                    icon: BookOpen,       permission: 'academics.lesson.view' },
      // { label: 'Topics',                path: '/academics/topics',                     icon: BookOpenCheck,  permission: 'academics.topic.view' },
      // { label: 'Lesson Planner',        path: '/academics/lesson-planner',             icon: ClipboardCheck, permission: 'academics.lesson_planner.view' },
      // { label: 'Homework Add',          path: '/academics/homework-add',               icon: FileText,       permission: 'academics.add_homework.view' },
      // { label: 'Homework List',         path: '/academics/homework-list',              icon: ClipboardList,  permission: 'academics.homework_list.view' },
      // { label: 'Homework Evaluation',   path: '/academics/homework-evaluation-report', icon: FileBarChart,   permission: 'academics.homework_evaluation_report.view' },
      // { label: 'Upload Content',        path: '/academics/upload-content',             icon: Send,           permission: 'academics.upload_content.view' },
      // { label: 'Assignment List',       path: '/academics/assignment-list',            icon: ClipboardCheck, permission: 'academics.assignment_list.view' },
      // { label: 'Study Material',        path: '/academics/study-material-list',        icon: BookOpenCheck,  permission: 'academics.study_material_list.view' },
      // { label: 'Syllabus',              path: '/academics/syllabus-list',              icon: BookMarked,     permission: 'academics.syllabus_list.view' },
      // { label: 'Other Downloads',       path: '/academics/other-downloads-list',       icon: FileText,       permission: 'academics.other_downloads_list.view' },
    ],
  },
  {
    id: 'exam',
    name: 'Examination',
    path: '/exams/setup',
    icon: ClipboardList,
    bg: '#FDF4FF',
    ic: '#A21CAF',
    permission: 'examination',
    sub: [
      { label: 'Exam Type',         path: '/exams/exam-type',             icon: FileText,       permission: 'examination.exam_type.view' },
      { label: 'Exam Setup',        path: '/exams/setup',                 icon: Settings,       permission: 'examination.exam_setup.view' },
      { label: 'Exam Schedule',     path: '/exams/schedule',              icon: Calendar,       permission: 'examination.exam_schedule.view' },
      { label: 'Schedule Report',   path: '/exams/schedule-report',       icon: FileBarChart,   permission: 'examination.exam_schedule_report.view' },
      { label: 'Exam Attendance',   path: '/exams/attendance',            icon: UserCheck,      permission: 'examination.exam_attendance.view' },
      { label: 'Attendance Report', path: '/exams/attendance-report',     icon: FileBarChart,   permission: 'examination.exam_attendance_report.view' },
      { label: 'Marks Register',    path: '/exams/marks-register',        icon: ClipboardList,  permission: 'examination.marks_register.view' },
      { label: 'Add Marks',         path: '/exams/marks-register-create', icon: ClipboardCheck, permission: 'examination.add_marks.view' },
      { label: 'Result Publish',    path: '/exams/result-publish',        icon: Globe,          permission: 'examination.result_publish.view' },
      { label: 'Online Exam',       path: '/exams/online-exam',           icon: Globe,          permission: 'examination.online_exam.view' },
      { label: 'Merit Report',      path: '/exams/merit-report',          icon: Award,          permission: 'examination.merit_list.view' },
      { label: 'Student Report',    path: '/exams/student-report',        icon: FileBarChart,   permission: 'examination.student_mark_sheet.view' },
      { label: 'Admit Card',        path: '/exams/exam-plan/admit-card',  icon: FileBadge,      permission: 'examination.admit_card.view' },
      { label: 'Seat Plan',         path: '/exams/exam-plan/seat-plan',   icon: LayoutGrid,     permission: 'examination.seat_plan.view' },
    ],
  },
  {
    id: 'reports',
    name: 'Reports',
    path: '/reports',
    icon: BarChart2,
    bg: '#FFF1F2',
    ic: '#BE123C',
    sub: [
      { label: 'Student Report', path: '/reports/student', icon: FileBarChart },
      { label: 'Student List', path: '/reports/student-list', icon: Users },
      { label: 'Student Attendance', path: '/reports/student-attendance', icon: UserCheck },
      { label: 'Exam Result', path: '/reports/exam-result', icon: ClipboardList },
      { label: 'Exam Merit', path: '/reports/exam-merit', icon: Award },
      { label: 'Staff List', path: '/reports/staff-list', icon: UserCog },
      { label: 'Staff Attendance', path: '/reports/staff-attendance', icon: UserCheck },
      { label: 'Fees Collection', path: '/reports/fees-collection', icon: HandCoins },
      { label: 'Fees Due', path: '/reports/fees-due', icon: AlertCircle },
      { label: 'Accounts Ledger', path: '/reports/accounts-ledger', icon: Landmark },
      { label: 'Library Issue', path: '/reports/library-issue', icon: BookmarkCheck },
      { label: 'Transport', path: '/reports/transport', icon: Bus },
      { label: 'Inventory Stock', path: '/reports/inventory-stock', icon: Package },
      { label: 'Student Export', path: '/students/export', icon: FileBarChart },
    ],
  },
  {
    id: 'fees',
    name: 'Fees',
    path: '/fees/groups',
    icon: HandCoins,
    bg: '#ECFEFF',
    ic: '#0E7490',
    permission: 'fees',
    sub: [
      { label: 'Fees Group',        path: '/fees/groups',        icon: Users,           permission: 'fees.fees_group.view' },
      { label: 'Fees Type',         path: '/fees/types',         icon: CreditCard,      permission: 'fees.fees_type.view' },
      { label: 'Fees Master',       path: '/fees/master',        icon: DollarSign,      permission: 'fees.fees_master.view' },
      { label: 'Fees Collection',   path: '/fees/payments',      icon: HandCoins,       permission: 'fees.fees_collection.view' },
      { label: 'Fees Due',          path: '/fees/due',           icon: AlertCircle,     permission: 'fees.fees_due.view' },
      { label: 'Fees Carry Forward',path: '/fees/carry-forward', icon: ArrowRightLeft,  permission: 'fees.fees_carry_forward.view' },
    ],
  },
  // HIDDEN - no backend yet
  /* {
    id: 'library',
    name: 'Library',
    path: '/library/books',
    icon: BookMarked,
    bg: '#FDF2F8',
    ic: '#BE185D',
    permission: 'library',
    sub: [
      { label: 'Book Categories', path: '/library/categories', icon: BookMarked },
      { label: 'Books', path: '/library/books', icon: BookOpen },
      { label: 'Library Members', path: '/library/members', icon: Users },
      { label: 'Book Issues', path: '/library/issues', icon: BookmarkCheck },
    ],
  }, */
  // HIDDEN - no backend yet
  /* {
    id: 'transport',
    name: 'Transport',
    path: '/transport',
    icon: Bus,
    bg: '#EFF6FF',
    ic: '#1D4ED8',
    permission: 'transport',
    sub: [
      { label: 'Vehicles', path: '/transport/vehicles', icon: Car },
      { label: 'Routes', path: '/transport/routes', icon: Route },
      { label: 'Assign Vehicles', path: '/transport/assign-vehicles', icon: Truck },
      { label: 'Bus Tracking', path: '/transport/bus-tracking', icon: MapPin },
      { label: 'Live Tracking', path: '/transport/tracking', icon: Navigation },
      { label: 'Tracked Buses', path: '/transport/tracking/buses', icon: Bus },
      { label: 'Route Builder', path: '/transport/tracking/route-builder', icon: Route },
      { label: 'Student Report', path: '/transport/student-report', icon: FileBarChart },
    ],
  }, */
  // HIDDEN - no backend yet
  /* {
    id: 'inventory',
    name: 'Inventory',
    path: '/inventory',
    icon: Package,
    bg: '#F7FEE7',
    ic: '#4D7C0F',
    permission: 'inventory',
    sub: [
      { label: 'Inventory', path: '/inventory', icon: Store },
      { label: 'Stock Report', path: '/reports/inventory-stock', icon: FileBarChart },
    ],
  }, */
  // HIDDEN - no backend yet
  /* {
    id: 'behaviour',
    name: 'Behaviour',
    path: '/behaviour/incidents',
    icon: AlertTriangle,
    bg: '#FFF7ED',
    ic: '#C2410C',
    sub: [
      { label: 'Assign Incident', path: '/behaviour/assign-incident', icon: FlagTriangleRight },
      { label: 'Incidents', path: '/behaviour/incidents', icon: AlertTriangle },
      { label: 'Student Incident', path: '/behaviour/reports/student-incident', icon: FileBarChart },
      { label: 'Student Rank', path: '/behaviour/reports/student-rank', icon: Award },
      { label: 'Class Section Rank', path: '/behaviour/reports/class-section-rank', icon: BarChart2 },
      { label: 'Incident Report', path: '/behaviour/reports/incident-wise', icon: FileText },
      { label: 'Settings', path: '/behaviour/settings', icon: Settings },
    ],
  }, */
  {
    id: 'hr',
    name: 'Human Resource',
    path: '/hr/staff',
    icon: UserCog,
    bg: '#FEF2F2',
    ic: '#DC2626',
    permission: 'hr',
    sub: [
      { label: 'HR Departments',  path: '/hr/departments',     icon: Building2,      permission: 'human_resource.departments.view' },
      { label: 'HR Designations', path: '/hr/designations',    icon: Briefcase,      permission: 'human_resource.designations.view' },
      { label: 'Add Staff',       path: '/hr/staff',           icon: UserPlus,       permission: 'human_resource.staff.view' },
      { label: 'Staff Directory', path: '/hr/staff-directory', icon: Users,          permission: 'human_resource.staff.view' },
      { label: 'Leave Types',     path: '/hr/leave-types',     icon: Calendar,       permission: 'human_resource.leave_type.view' },
      { label: 'Leave Define',    path: '/hr/leave-defines',   icon: FileText,       permission: 'human_resource.leave_define.view' },
      { label: 'Leave Requests',  path: '/hr/leave-requests',  icon: MessageSquare,  permission: 'human_resource.apply_leave.view' },
      { label: 'Staff Attendance',path: '/hr/staff-attendance',icon: UserCheck,      permission: 'human_resource.staff_attendance.view' },
      { label: 'Payroll',         path: '/hr/payroll',         icon: DollarSign,     permission: 'human_resource.payroll.view' },
    ],
  },
  // HIDDEN - no backend yet
  /* {
    id: 'accounts',
    name: 'Accounts',
    path: '/finance/chart-of-accounts',
    icon: Landmark,
    bg: '#F0F9FF',
    ic: '#0369A1',
    permission: 'finance',
    sub: [
      { label: 'Chart of Accounts', path: '/finance/chart-of-accounts', icon: ChartBar },
      { label: 'Bank Accounts', path: '/finance/bank-accounts', icon: Building2 },
      { label: 'Ledger Entries', path: '/finance/ledger', icon: BanknoteIcon },
      { label: 'Fund Transfer', path: '/finance/fund-transfer', icon: ArrowRightLeft },
    ],
  }, */
  // HIDDEN - no backend yet
  /* {
    id: 'utilities',
    name: 'Utilities',
    path: '/utilities/chat',
    icon: MessageCircle,
    bg: '#F8FAFC',
    ic: '#334155',
    sub: [
      { label: 'Chat', path: '/utilities/chat', icon: MessageCircle },
      { label: 'Communication', path: '/utilities/communication', icon: Mail },
      { label: 'Invitation', path: '/utilities/invitation', icon: Send },
      { label: 'Blocked Users', path: '/utilities/blocked-users', icon: UserX },
    ],
  }, */
  // HIDDEN - no backend yet
  /* {
    id: 'settings',
    name: 'Settings',
    path: '/setup',
    icon: Settings,
    bg: '#F1F5F9',
    ic: '#475569',
    permission: 'settings_section',
    sub: [
      { label: 'General Settings', path: '/setup', icon: Settings },
      { label: 'Schools', path: '/setup/schools', icon: School },
      { label: 'Class Periods', path: '/setup/class-periods', icon: Calendar },
      { label: 'Academic Year', path: '/academics/academic-year', icon: Calendar },
    ],
  }, */
];

/** Flat list: module + all sub-routes — used by ⌘K and AI bot */
export const FLAT_INDEX = MODULES.flatMap((m) => [
  { modId: m.id, label: m.name, path: m.path, icon: m.icon, bg: m.bg, ic: m.ic, permission: m.permission },
  ...m.sub.map((s) => ({
    modId: m.id,
    label: s.label,
    path: s.path,
    icon: s.icon ?? m.icon,
    bg: m.bg,
    ic: m.ic,
    permission: s.permission ?? m.permission,
  })),
]);
