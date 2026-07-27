"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, CalendarDays, Trophy, CreditCard, Bell, User, AlertCircle } from "lucide-react";
import { useCurrentAcademicYear } from "@/hooks/useCurrentAcademicYear";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { usePermissions } from "@/hooks/usePermissions";
import { fetchStudentMe, type StudentDashboardMe } from "@/lib/api/student";

type TileDef = {
  n: string;
  sub: string;
  icon: React.ElementType;
  col: string;
  bg: string;
  path: string;
};

const QUICK: TileDef[] = [
  { n: "Academics", sub: "Syllabus", icon: GraduationCap, col: "#047857", bg: "#ECFDF5", path: "/student/academics" },
  { n: "Attendance", sub: "Daily", icon: CalendarDays, col: "#B45309", bg: "#FFFBEB", path: "/student/attendance" },
  { n: "Results", sub: "Exams", icon: Trophy, col: "#0369A1", bg: "#F0F9FF", path: "/student/results" },
  { n: "Fees", sub: "Summary", icon: CreditCard, col: "#B42318", bg: "#FEF3F2", path: "/student/fees" },
  { n: "Notices", sub: "Updates", icon: Bell, col: "#A21CAF", bg: "#FDF4FF", path: "/student/notices" },
  { n: "Profile", sub: "Identity", icon: User, col: "#334155", bg: "#F8FAFC", path: "/student/profile" },
];

function QuickTile({ mod }: { mod: TileDef }) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(mod.path)}
      style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", transition: "box-shadow 0.15s, border-color 0.15s" }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 2px 10px -2px rgba(15,18,34,0.08)";
        el.style.borderColor = "rgba(124,91,255,0.25)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "none";
        el.style.borderColor = "var(--bd)";
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 9, background: mod.bg, color: mod.col, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <mod.icon size={17} strokeWidth={1.75} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-1)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mod.n}</div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>{mod.sub}</div>
      </div>
    </div>
  );
}

export default function StudentHomePage() {
  const { me } = usePermissions();
  const { year: academicYear } = useCurrentAcademicYear("-");
  const [student, setStudent] = useState<StudentDashboardMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const visibleModules = useVisibleModules({ includeHome: true });
  const visiblePaths = new Set(visibleModules.map((m) => m.path));
  const quickTiles = QUICK.filter((mod) => visiblePaths.has(mod.path));

  useEffect(() => {
    fetchStudentMe()
      .then(setStudent)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 28px" }}>Loading your dashboard...</div>;
  }

  if (error || !student) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center", background: "#fff", border: "1px solid var(--bd)", borderRadius: 14, padding: "40px 24px" }}>
        <AlertCircle size={32} color="var(--err)" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-1)", marginBottom: 6 }}>Could not load student details</p>
        <p style={{ fontSize: 13, color: "var(--ink-2)" }}>{error ?? "Unexpected error. Please refresh."}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 28px 56px" }}>
      <section style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.5px", lineHeight: 1.25, margin: 0, color: "var(--ink-1)" }}>
            Welcome, <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontStyle: "italic", color: "var(--pu)", fontWeight: 400, fontSize: 26 }}>{student.first_name || me?.first_name || "Student"}</em>
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>
            {student.class_section || "Class pending"}
            {student.admission_no ? ` · Admission ${student.admission_no}` : ""}
            {student.roll_no ? ` · Roll ${student.roll_no}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 0, border: "1px solid var(--bd)", borderRadius: 9, overflow: "hidden", background: "#fff", flexShrink: 0 }}>
          <div style={{ padding: "8px 14px", borderRight: "1px solid var(--bd)" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Academic Year</div>
            <div style={{ fontFamily: "var(--font-mono,'JetBrains Mono',ui-monospace,monospace)", fontSize: 13, fontWeight: 600, color: "var(--ink-1)", marginTop: 3 }}>{academicYear || "-"}</div>
          </div>
          <div style={{ padding: "8px 14px", borderRight: "1px solid var(--bd)" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>School</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-1)", marginTop: 3 }}>{student.school_name || me?.school_name || "-"}</div>
          </div>
          <div style={{ padding: "8px 14px" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Attendance (30d)</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-1)", marginTop: 3 }}>
              {student.attendance_last_30_days.pct == null ? "-" : `${student.attendance_last_30_days.pct}%`}
            </div>
          </div>
        </div>
      </section>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 10 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Quick Access</span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.06em" }}>{quickTiles.length} PINNED</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))", gap: 10 }}>
        {quickTiles.map((mod) => <QuickTile key={mod.n} mod={mod} />)}
      </div>
    </div>
  );
}
