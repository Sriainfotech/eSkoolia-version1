"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, CheckSquare, Calendar, BookOpen, FileText,
  MessageSquare, Star, AlertCircle, ClipboardList,
} from "lucide-react";
import {
  fetchTeacherMe,
  type TeacherMe,
  type SubjectAssignment,
  type SubjectSection,
} from "@/lib/api/teacher";
import { TEACHER_MODULES, TEACHER_FLAT_INDEX } from "@/lib/teacher-routes";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { useWidgetStore } from "@/lib/widgetStore";
import { TeacherDayPlanner } from "@/components/widgets/teacher/TeacherDayPlanner";
import { WeekAhead }         from "@/components/widgets/cockpit/WeekAhead";
import { SmartTodoList }     from "@/components/widgets/cockpit/SmartTodoList";
import { PinnedNotes }       from "@/components/widgets/cockpit/PinnedNotes";
import { Greeting }          from "@/components/home/Greeting";
import { SectionLabel }      from "@/components/home/SectionLabel";
import { RecentsRow }        from "@/components/home/RecentsRow";
import { ModuleGrid }        from "@/components/home/ModuleGrid";

// ── Quick Access tiles for teachers ──────────────────────────────────────────

const TEACHER_QUICK = [
  { label: "My Classes",  sub: "Students",     icon: Users,        bg: "#FEF3F2", ic: "#B42318", path: "/teacher/classes"    },
  { label: "Attendance",  sub: "Mark daily",   icon: CheckSquare,  bg: "#FFFBEB", ic: "#B45309", path: "/teacher/attendance" },
  { label: "Timetable",   sub: "This week",    icon: Calendar,     bg: "#ECFDF5", ic: "#047857", path: "/teacher/timetable"  },
  { label: "Homework",    sub: "Assignments",  icon: BookOpen,     bg: "#F0FDF4", ic: "#15803D", path: "/teacher/homework"   },
  { label: "Lessons",     sub: "Plans",        icon: FileText,     bg: "#FDF4FF", ic: "#A21CAF", path: "/teacher/lessons"    },
  { label: "Messages",    sub: "Parent comms", icon: MessageSquare,bg: "#F0F9FF", ic: "#0369A1", path: "/teacher/messages"   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByClass(sections: SubjectSection[]) {
  const map = new Map<number, { class_name: string; sections: SubjectSection[] }>();
  for (const s of sections) {
    if (!map.has(s.class_id)) map.set(s.class_id, { class_name: s.class_name, sections: [] });
    map.get(s.class_id)!.sections.push(s);
  }
  return [...map.values()].sort((a, b) =>
    a.class_name.localeCompare(b.class_name, undefined, { numeric: true })
  );
}

// ── Quick Access tile ─────────────────────────────────────────────────────────

function QuickTile({ tile }: { tile: typeof TEACHER_QUICK[0] }) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(tile.path)}
      style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", transition: "box-shadow 0.15s, border-color 0.15s" }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = "0 2px 10px -2px rgba(15,18,34,0.08)"; el.style.borderColor = "rgba(124,91,255,0.25)"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = "none"; el.style.borderColor = "var(--bd)"; }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 9, background: tile.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <tile.icon size={17} strokeWidth={1.75} style={{ color: tile.ic }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-1)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tile.label}</div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>{tile.sub}</div>
      </div>
    </div>
  );
}

// ── Class teacher card ────────────────────────────────────────────────────────

function ClassTeacherCard({ me }: { me: TeacherMe }) {
  const ct = me.class_teacher_for;
  if (!ct) return null;
  const router = useRouter();
  return (
    <div style={{ background: "#fff", border: "1px solid var(--bd)", borderLeft: "3px solid var(--pu)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--pu-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Star size={18} style={{ color: "var(--pu)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--pu)", marginBottom: 3 }}>Class Teacher</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-1)", lineHeight: 1.2 }}>
          {ct.class_name}<span style={{ fontWeight: 500, color: "var(--ink-2)" }}> · Section {ct.section_name}</span>
        </p>
        <p style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 3 }}>
          {ct.student_count > 0 ? `${ct.student_count} students` : "No students enrolled yet"}
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => router.push("/teacher/attendance")} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "var(--pu)", background: "var(--pu-soft)", border: "1px solid #ddd6fe", cursor: "pointer" }}>
          <CheckSquare size={13} /> Mark Attendance
        </button>
        <button onClick={() => router.push("/teacher/classes")} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "var(--ink-1)", background: "var(--bg-2)", border: "1px solid var(--bd)", cursor: "pointer" }}>
          <Users size={13} /> View Students
        </button>
      </div>
    </div>
  );
}

// ── Subject summary card ──────────────────────────────────────────────────────

function SubjectCard({ subject }: { subject: SubjectAssignment }) {
  const [expanded, setExpanded] = useState(false);
  const byClass = subject.total_sections > 4 ? groupByClass(subject.sections) : null;
  return (
    <div style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }} onClick={() => setExpanded(e => !e)}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <BookOpen size={15} color="#15803D" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-1)", margin: 0 }}>{subject.subject_name}</p>
          <p style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 2 }}>
            {subject.total_sections} section{subject.total_sections !== 1 ? "s" : ""} · {subject.total_students > 0 ? `${subject.total_students} students` : "No students"}
          </p>
        </div>
        <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={{ borderTop: "1px solid var(--bd)", padding: "12px 16px" }}>
          {byClass ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
              {byClass.map(g => (
                <div key={g.class_name} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--bg-2)", border: "1px solid var(--bd)" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-1)", marginBottom: 6 }}>{g.class_name}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {g.sections.map(s => (
                      <span key={s.section_id} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "var(--pu-soft)", color: "var(--pu)" }}>{s.section_name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {subject.sections.map(s => (
                <div key={s.section_id} style={{ padding: "8px 14px", borderRadius: 10, background: "var(--bg-2)", border: "1px solid var(--bd)", minWidth: 100 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-1)" }}>{s.class_name}-{s.section_name}</p>
                  <p style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>{s.student_count > 0 ? `${s.student_count} students` : "—"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ w = "100%", h = 16 }: { w?: string | number; h?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: 8, backgroundImage: "linear-gradient(90deg, var(--bg-2) 25%, var(--bg-3,#EFEFF4) 50%, var(--bg-2) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s ease-in-out infinite" }} />
  );
}

// ── Center content ────────────────────────────────────────────────────────────

function TeacherCenter({ me }: { me: TeacherMe }) {
  const hasAttendancePending = me.pending_items.attendance_pending;
  const homeworkPending = me.pending_items.homework_to_review;
  // Dynamically built by the portal registry: teacher-specific modules +
  // any admin modules granted via Roles & Permissions
  const visibleModules = useVisibleModules();

  return (
    <div style={{ minWidth: 0 }}>
      {/* Greeting — reuse admin component */}
      <Greeting />

      {/* Pending action chips */}
      {(hasAttendancePending || homeworkPending > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {hasAttendancePending && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: "var(--warn)", background: "var(--warn-soft)", border: "1px solid #fde68a" }}>
              <CheckSquare size={12} /> 1 attendance to mark
            </span>
          )}
          {homeworkPending > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: "var(--info)", background: "var(--info-soft)", border: "1px solid #bfdbfe" }}>
              <ClipboardList size={12} /> {homeworkPending} homework to review
            </span>
          )}
        </div>
      )}

      {/* Quick Access */}
      <SectionLabel title="Quick Access" pinned={TEACHER_QUICK.length} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))", gap: 10, marginBottom: 4 }}>
        {TEACHER_QUICK.map(t => <QuickTile key={t.path} tile={t} />)}
      </div>

      {/* Recently Visited */}
      <RecentsRow flatIndex={TEACHER_FLAT_INDEX} modules={TEACHER_MODULES} />

      {/* Teacher context: class assignment + subjects */}
      {(me.class_teacher_for || me.subject_assignments.length > 0) && (
        <>
          <SectionLabel title="Your Assignments" count={me.subject_assignments.length + (me.class_teacher_for ? 1 : 0)} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 4 }}>
            {me.class_teacher_for && <ClassTeacherCard me={me} />}
            {me.subject_assignments.map(s => <SubjectCard key={s.subject_id} subject={s} />)}
          </div>
        </>
      )}

      {/* All Modules */}
      <SectionLabel title="All Modules" count={visibleModules.length} />
      <ModuleGrid modules={visibleModules} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeacherHomePage() {
  const [me, setMe] = useState<TeacherMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isEnabled } = useWidgetStore();

  useEffect(() => {
    fetchTeacherMe()
      .then(setMe)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const showLeft  = isEnabled("teacher-day-plan") || isEnabled("pinned-notes");
  const showRight = isEnabled("week-ahead") || isEnabled("smart-todo");

  if (loading) {
    return (
      <div style={{ maxWidth: 1680, margin: "0 auto", padding: "24px 28px" }}>
        <Skeleton w={200} h={12} />
        <div style={{ marginTop: 10 }}><Skeleton w={300} h={28} /></div>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px,1fr))", gap: 10 }}>
          {[1,2,3,4].map(i => <Skeleton key={i} h={56} />)}
        </div>
      </div>
    );
  }

  if (error || !me) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center", background: "#fff", border: "1px solid var(--bd)", borderRadius: 14, padding: "40px 24px" }}>
        <AlertCircle size={32} color="var(--err)" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-1)", marginBottom: 6 }}>Could not load your portal</p>
        <p style={{ fontSize: 13, color: "var(--ink-2)" }}>{error ?? "Unexpected error — please refresh the page."}</p>
      </div>
    );
  }

  return (
    <div
      data-left={showLeft ? "on" : "off"}
      data-right={showRight ? "on" : "off"}
      style={{ display: "grid", gap: 28, maxWidth: 1680, margin: "0 auto", padding: "24px 28px 56px", gridTemplateColumns: "1fr" }}
      className="home-grid"
    >
      <div className="home-left-rail" style={{ minWidth: 0, overflow: "hidden" }}>
        {showLeft && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {isEnabled("teacher-day-plan") && <TeacherDayPlanner periods={me.todays_periods ?? []} />}
            {isEnabled("pinned-notes") && <PinnedNotes />}
          </div>
        )}
      </div>

      <TeacherCenter me={me} />

      <div className="home-right-rail" style={{ minWidth: 0, overflow: "hidden" }}>
        {showRight && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {isEnabled("week-ahead") && <WeekAhead />}
            {isEnabled("smart-todo") && <SmartTodoList />}
          </div>
        )}
      </div>

      <style>{`
        .home-left-rail  { display: none; }
        .home-right-rail { display: none; }
        @media (min-width: 1024px) {
          .home-grid { grid-template-columns: 272px 1fr 0px !important; gap: 32px !important; }
          .home-left-rail  { display: block !important; }
          .home-right-rail { display: block !important; }
          .home-grid[data-left="off"] { grid-template-columns: 0px 1fr 0px !important; }
        }
        @media (min-width: 1360px) {
          .home-grid { grid-template-columns: 280px 1fr 340px !important; gap: 32px !important; }
          .home-grid[data-left="off"]  { grid-template-columns: 0px 1fr 340px !important; }
          .home-grid[data-right="off"] { grid-template-columns: 280px 1fr 0px !important; }
          .home-grid[data-left="off"][data-right="off"] { grid-template-columns: 0px 1fr 0px !important; }
        }
        @media (min-width: 1560px) {
          .home-grid { grid-template-columns: 296px 1fr 360px !important; gap: 36px !important; }
          .home-grid[data-left="off"]  { grid-template-columns: 0px 1fr 360px !important; }
          .home-grid[data-right="off"] { grid-template-columns: 296px 1fr 0px !important; }
          .home-grid[data-left="off"][data-right="off"] { grid-template-columns: 0px 1fr 0px !important; }
        }
      `}</style>
    </div>
  );
}
