import {
  LayoutGrid,
  GraduationCap,
  CalendarDays,
  Trophy,
  CreditCard,
  Bell,
  User,
  FileText,
} from "lucide-react";
import type { ModuleRoute } from "@/lib/routes";

export const STUDENT_MODULES: ModuleRoute[] = [
  {
    id: "student-home",
    name: "Home",
    path: "/student/home",
    icon: LayoutGrid,
    bg: "#EEF2FF",
    ic: "#4F46E5",
    sub: [],
  },
  {
    id: "student-academics",
    name: "Academics",
    path: "/student/academics",
    icon: GraduationCap,
    bg: "#ECFDF5",
    ic: "#047857",
    sub: [
      { label: "Overview", path: "/student/academics", icon: GraduationCap },
      { label: "Syllabus", path: "/student/academics", icon: FileText },
    ],
  },
  {
    id: "student-attendance",
    name: "Attendance",
    path: "/student/attendance",
    icon: CalendarDays,
    bg: "#FFFBEB",
    ic: "#B45309",
    sub: [
      { label: "Daily", path: "/student/attendance", icon: CalendarDays },
    ],
  },
  {
    id: "student-results",
    name: "Results",
    path: "/student/results",
    icon: Trophy,
    bg: "#F0F9FF",
    ic: "#0369A1",
    sub: [
      { label: "Report", path: "/student/results", icon: Trophy },
    ],
  },
  {
    id: "student-fees",
    name: "Fees",
    path: "/student/fees",
    icon: CreditCard,
    bg: "#FEF3F2",
    ic: "#B42318",
    sub: [
      { label: "Summary", path: "/student/fees", icon: CreditCard },
    ],
  },
  {
    id: "student-notices",
    name: "Notices",
    path: "/student/notices",
    icon: Bell,
    bg: "#FDF4FF",
    ic: "#A21CAF",
    sub: [
      { label: "Updates", path: "/student/notices", icon: Bell },
    ],
  },
  {
    id: "student-profile",
    name: "Profile",
    path: "/student/profile",
    icon: User,
    bg: "#F8FAFC",
    ic: "#334155",
    sub: [
      { label: "My Profile", path: "/student/profile", icon: User },
    ],
  },
];

export const STUDENT_FLAT_INDEX = STUDENT_MODULES.flatMap((m) => [
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
