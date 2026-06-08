"use client";

/**
 * Teacher Portal — My Classes Screen
 *
 * Sprint 3: teacher browses their assigned classes and student rosters.
 *
 * Layout:
 *   - Page header (ERP serif italic style)
 *   - Class tab pills (one per assigned class+section)
 *   - Student list table for the active tab
 *   - Search + filter bar (name / roll / gender)
 *   - Empty state when the class has no students yet
 *   - Skeleton loader while fetching
 *
 * Data scope is enforced on the backend:
 *   - /my-classes/ returns only the teacher's own assignments
 *   - /students/?class_id=&section_id= returns 403 for unassigned classes
 *
 * attendance_pct and avg_score are null until Sprint 5 & 6 respectively.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import {
  fetchMyClasses,
  fetchStudentList,
  type MyClass,
  type StudentListItem,
} from "@/lib/api/teacher";
import { StudentProfileDrawer } from "@/components/teacher/StudentProfileDrawer";

// ── Helpers ───────────────────────────────────────────────────────────────────

function genderLabel(g: string) {
  if (g === "male")   return "Male";
  if (g === "female") return "Female";
  if (g === "other")  return "Other";
  return g || "—";
}

function genderColor(g: string): { bg: string; text: string } {
  if (g === "male")   return { bg: "#EFF6FF", text: "#1D4ED8" };
  if (g === "female") return { bg: "#FDF4FF", text: "#A21CAF" };
  return { bg: "#F5F5FB", text: "#5B5E72" };
}

/** Deterministic colour for a class tab */
const TAB_COLORS = [
  { bg: "#EEF2FF", text: "#4F46E5", border: "#C7D2FE", active: "#6D4AFF" },
  { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0", active: "#16A34A" },
  { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA", active: "#EA580C" },
  { bg: "#FDF4FF", text: "#A21CAF", border: "#E9D5FF", active: "#9333EA" },
  { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A", active: "#D97706" },
  { bg: "#F0F9FF", text: "#0369A1", border: "#BAE6FD", active: "#0284C7" },
];
function tabColor(idx: number) {
  return TAB_COLORS[idx % TAB_COLORS.length];
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ w = "100%", h = 14 }: { w?: string | number; h?: number }) {
  return (
    <div
      style={{
        width: w, height: h, borderRadius: 6,
        backgroundImage:
          "linear-gradient(90deg, var(--line,#dbe4f0) 25%, var(--bg-2,#f5f5fb) 50%, var(--line,#dbe4f0) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}

function PageSkeleton() {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Skeleton w={140} h={10} />
        <div style={{ marginTop: 8 }}><Skeleton w={240} h={26} /></div>
        <div style={{ marginTop: 6 }}><Skeleton w={180} h={12} /></div>
      </div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} w={110} h={34} />
        ))}
      </div>
      {/* Table */}
      <div
        style={{
          background: "#fff", borderRadius: 14, padding: 20,
          border: "1px solid var(--line,#dbe4f0)",
        }}
      >
        <Skeleton w="40%" h={16} />
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} h={44} />)}
        </div>
      </div>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function StudentAvatar({
  name,
  photo_url,
  gender,
}: {
  name: string;
  photo_url: string | null;
  gender: string;
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const col = genderColor(gender);

  if (photo_url) {
    return (
      <img
        src={photo_url}
        alt={name}
        style={{
          width: 32, height: 32, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0,
          border: "1.5px solid var(--line,#dbe4f0)",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 32, height: 32, borderRadius: "50%",
        background: col.bg, color: col.text,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, flexShrink: 0,
      }}
    >
      {initials || "?"}
    </div>
  );
}

// ── Student table ─────────────────────────────────────────────────────────────

function StudentTable({
  students,
  loading,
  error,
  onRetry,
  onSelectStudent,
}: {
  students: StudentListItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectStudent: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female" | "other">("all");

  // Reset search when tab changes
  useEffect(() => {
    setSearch("");
    setGenderFilter("all");
  }, [students]);

  const filtered = useMemo(() => {
    let result = students;
    if (genderFilter !== "all") {
      result = result.filter((s) => s.gender === genderFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.roll_no.toLowerCase().includes(q) ||
          s.admission_no.toLowerCase().includes(q)
      );
    }
    return result;
  }, [students, search, genderFilter]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 0" }}>
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} h={44} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <AlertCircle size={28} color="var(--red,#E0463A)" style={{ marginBottom: 10 }} />
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink,#15172A)", marginBottom: 4 }}>
          Could not load students
        </p>
        <p style={{ fontSize: 12, color: "var(--muted,#5B5E72)", marginBottom: 12 }}>{error}</p>
        <button
          onClick={onRetry}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: "var(--soft,#EEEAFF)", color: "var(--brand,#6D4AFF)",
            border: "1px solid #ddd6fe", cursor: "pointer",
          }}
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ── Search + filter bar ──────────────────────────────────── */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 16, flexWrap: "wrap",
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8,
            flex: "1 1 200px", minWidth: 180, maxWidth: 360,
            background: "var(--bg-2,#F5F5FB)",
            border: "1px solid var(--line,#dbe4f0)",
            borderRadius: 8, padding: "7px 12px",
          }}
        >
          <Search size={14} color="var(--muted,#5B5E72)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by name, roll or admission no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              border: "none", background: "transparent", outline: "none",
              fontSize: 13, color: "var(--ink,#15172A)", width: "100%",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--muted,#5B5E72)", padding: 0, lineHeight: 1, fontSize: 15,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Gender filter pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["all", "male", "female", "other"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGenderFilter(g)}
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: "pointer", border: "1px solid",
                background: genderFilter === g ? "var(--brand,#6D4AFF)" : "var(--bg-2,#F5F5FB)",
                color: genderFilter === g ? "#fff" : "var(--muted,#5B5E72)",
                borderColor: genderFilter === g ? "var(--brand,#6D4AFF)" : "var(--line,#dbe4f0)",
                transition: "all 0.15s",
              }}
            >
              {g === "all" ? "All" : genderLabel(g)}
            </button>
          ))}
        </div>

        {/* Count badge */}
        <span
          style={{
            marginLeft: "auto", fontSize: 11, color: "var(--muted,#5B5E72)",
            whiteSpace: "nowrap",
          }}
        >
          {filtered.length} of {students.length} student{students.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Empty state ──────────────────────────────────────────── */}
      {students.length === 0 ? (
        <div
          style={{
            textAlign: "center", padding: "56px 24px",
            border: "1.5px dashed var(--line,#dbe4f0)",
            borderRadius: 12,
          }}
        >
          <Users size={32} color="var(--muted,#5B5E72)" style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink,#15172A)", marginBottom: 4 }}>
            No students yet
          </p>
          <p style={{ fontSize: 12, color: "var(--muted,#5B5E72)" }}>
            No active students are enrolled in this class section.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 24px" }}>
          <Search size={26} color="var(--muted,#5B5E72)" style={{ marginBottom: 10, opacity: 0.4 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink,#15172A)", marginBottom: 4 }}>
            No results
          </p>
          <p style={{ fontSize: 12, color: "var(--muted,#5B5E72)" }}>
            No students match your search.
          </p>
        </div>
      ) : (
        /* ── Student table ──────────────────────────────────────── */
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr
                style={{
                  background: "var(--bg-2,#F5F5FB)",
                  borderBottom: "1px solid var(--line,#dbe4f0)",
                }}
              >
                {["#", "Student", "Roll No.", "Admission No.", "Gender", "Attendance", "Avg. Score"].map(
                  (col) => (
                    <th
                      key={col}
                      style={{
                        padding: "9px 14px", textAlign: "left",
                        fontSize: 10, fontWeight: 800,
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        color: "var(--muted,#5B5E72)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => (
                <tr
                  key={s.id}
                  onClick={() => onSelectStudent(s.id)}
                  style={{
                    borderBottom: "1px solid var(--line,#dbe4f0)",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.background =
                      "var(--bg-2,#F5F5FB)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")
                  }
                >
                  {/* Row number */}
                  <td
                    style={{
                      padding: "10px 14px", fontSize: 11,
                      color: "var(--muted,#5B5E72)", width: 40,
                    }}
                  >
                    {idx + 1}
                  </td>

                  {/* Avatar + Name */}
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <StudentAvatar
                        name={s.name}
                        photo_url={s.photo_url}
                        gender={s.gender}
                      />
                      <div>
                        <p
                          style={{
                            fontSize: 13, fontWeight: 600,
                            color: "var(--ink,#15172A)", margin: 0, lineHeight: 1.3,
                          }}
                        >
                          {s.name}
                        </p>
                        <p
                          style={{
                            fontSize: 10, color: "var(--muted,#5B5E72)",
                            margin: "2px 0 0",
                          }}
                        >
                          ID: {s.student_id.slice(0, 8)}…
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Roll No */}
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--ink,#15172A)" }}>
                    {s.roll_no || "—"}
                  </td>

                  {/* Admission No */}
                  <td
                    style={{
                      padding: "10px 14px", fontSize: 12,
                      color: "var(--muted,#5B5E72)", fontFamily: "monospace",
                    }}
                  >
                    {s.admission_no || "—"}
                  </td>

                  {/* Gender chip */}
                  <td style={{ padding: "10px 14px" }}>
                    {s.gender ? (
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px", borderRadius: 20,
                          fontSize: 10, fontWeight: 700,
                          background: genderColor(s.gender).bg,
                          color: genderColor(s.gender).text,
                        }}
                      >
                        {genderLabel(s.gender)}
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted,#5B5E72)", fontSize: 12 }}>—</span>
                    )}
                  </td>

                  {/* Attendance % (Sprint 5) */}
                  <td style={{ padding: "10px 14px" }}>
                    {s.attendance_pct !== null ? (
                      <span
                        style={{
                          fontSize: 13, fontWeight: 700,
                          color:
                            s.attendance_pct >= 75
                              ? "#15803D"
                              : s.attendance_pct >= 50
                              ? "#B45309"
                              : "#B42318",
                        }}
                      >
                        {s.attendance_pct.toFixed(1)}%
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11, color: "var(--muted,#5B5E72)",
                          fontStyle: "italic",
                        }}
                      >
                        —
                      </span>
                    )}
                  </td>

                  {/* Avg score (Sprint 6) */}
                  <td style={{ padding: "10px 14px" }}>
                    {s.avg_score !== null ? (
                      <span
                        style={{
                          fontSize: 13, fontWeight: 700,
                          color: "var(--ink,#15172A)",
                        }}
                      >
                        {s.avg_score.toFixed(1)}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11, color: "var(--muted,#5B5E72)",
                          fontStyle: "italic",
                        }}
                      >
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MyClassesPage() {
  const [classes, setClasses]       = useState<MyClass[]>([]);
  const [activeIdx, setActiveIdx]   = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError]   = useState<string | null>(null);

  const [students, setStudents]         = useState<StudentListItem[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError]   = useState<string | null>(null);

  // Profile drawer state
  const [selectedStudentPk, setSelectedStudentPk] = useState<number | null>(null);

  // ── Load class list ───────────────────────────────────────────────────────
  function loadClasses() {
    setPageLoading(true);
    setPageError(null);
    fetchMyClasses()
      .then((data) => {
        setClasses(data);
        setActiveIdx(0);
        // Load students for the first class immediately
        if (data.length > 0) {
          loadStudents(data[0].class_id, data[0].section_id);
        }
      })
      .catch((e: Error) => setPageError(e.message))
      .finally(() => setPageLoading(false));
  }

  // ── Load student list for active tab ─────────────────────────────────────
  function loadStudents(classId: number, sectionId: number) {
    setStudentsLoading(true);
    setStudentsError(null);
    setStudents([]);
    fetchStudentList(classId, sectionId)
      .then(setStudents)
      .catch((e: Error) => setStudentsError(e.message))
      .finally(() => setStudentsLoading(false));
  }

  useEffect(() => { loadClasses(); }, []);

  // ── Switch tab ────────────────────────────────────────────────────────────
  function selectTab(idx: number) {
    setActiveIdx(idx);
    const cls = classes[idx];
    if (cls) loadStudents(cls.class_id, cls.section_id);
  }

  // ── Loading (page-level) ──────────────────────────────────────────────────
  if (pageLoading) return <PageSkeleton />;

  // ── Error (page-level) ───────────────────────────────────────────────────
  if (pageError) {
    return (
      <div
        style={{
          maxWidth: 480, margin: "60px auto", textAlign: "center",
          background: "#fff", border: "1px solid var(--line,#dbe4f0)",
          borderRadius: 14, padding: "40px 24px",
        }}
      >
        <AlertCircle size={32} color="var(--red,#E0463A)" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink,#15172A)", marginBottom: 6 }}>
          Could not load classes
        </p>
        <p style={{ fontSize: 13, color: "var(--muted,#5B5E72)", marginBottom: 16 }}>
          {pageError}
        </p>
        <button
          onClick={loadClasses}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: "var(--soft,#EEEAFF)", color: "var(--brand,#6D4AFF)",
            border: "1px solid #ddd6fe", cursor: "pointer",
          }}
        >
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  // ── No assignments at all ─────────────────────────────────────────────────
  if (classes.length === 0) {
    return (
      <div>
        <PageHeader />
        <div
          style={{
            textAlign: "center", padding: "72px 24px",
            border: "1.5px dashed var(--line,#dbe4f0)",
            borderRadius: 14, background: "#fff",
          }}
        >
          <Users size={36} color="var(--muted,#5B5E72)" style={{ marginBottom: 14, opacity: 0.35 }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink,#15172A)", marginBottom: 6 }}>
            No classes assigned yet
          </p>
          <p style={{ fontSize: 13, color: "var(--muted,#5B5E72)" }}>
            Ask your administrator to assign you to a class or subject.
          </p>
        </div>
      </div>
    );
  }

  const activeClass = classes[activeIdx];

  return (
    <>
    <div>
      <PageHeader />

      {/* ── Class tab pills ─────────────────────────────────────────── */}
      <div
        style={{
          display: "flex", gap: 8, flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        {classes.map((cls, idx) => {
          const col = tabColor(idx);
          const isActive = idx === activeIdx;
          return (
            <button
              key={`${cls.class_id}-${cls.section_id}`}
              onClick={() => selectTab(idx)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 16px", borderRadius: 24,
                fontSize: 12, fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s",
                border: isActive
                  ? `1.5px solid ${col.active}`
                  : `1px solid ${col.border}`,
                background: isActive ? col.active : col.bg,
                color: isActive ? "#fff" : col.text,
                boxShadow: isActive
                  ? `0 2px 8px -2px ${col.active}55`
                  : "none",
              }}
            >
              {/* Class teacher star */}
              {cls.is_class_teacher && (
                <span
                  style={{
                    fontSize: 10,
                    opacity: isActive ? 1 : 0.7,
                  }}
                  title="Class Teacher"
                >
                  ★
                </span>
              )}
              <span>
                {cls.class_name}‑{cls.section_name}
              </span>
              {/* Student count bubble */}
              <span
                style={{
                  display: "inline-flex", alignItems: "center",
                  justifyContent: "center",
                  width: 18, height: 18, borderRadius: "50%",
                  fontSize: 9, fontWeight: 800,
                  background: isActive ? "rgba(255,255,255,0.25)" : col.border,
                  color: isActive ? "#fff" : col.text,
                }}
              >
                {cls.student_count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Active class header ─────────────────────────────────────── */}
      {activeClass && (
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--line,#dbe4f0)",
            borderRadius: 14, padding: "18px 20px",
            boxShadow: "var(--shadow,0 4px 12px -4px rgba(15,18,34,0.08))",
          }}
        >
          {/* Card header */}
          <div
            style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16, gap: 12, flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 16, fontWeight: 700,
                  fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",
                  color: "var(--ink,#15172A)", margin: 0,
                }}
              >
                {activeClass.class_name} —{" "}
                <em style={{ fontWeight: 400, color: "var(--brand,#6D4AFF)", fontStyle: "italic" }}>
                  Section {activeClass.section_name}
                </em>
              </h2>
              <div
                style={{
                  display: "flex", flexWrap: "wrap",
                  gap: "4px 12px", marginTop: 6, alignItems: "center",
                }}
              >
                {activeClass.is_class_teacher && (
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 10, fontWeight: 700, padding: "2px 8px",
                      borderRadius: 20, background: "#FFFBEB", color: "#B45309",
                      border: "1px solid #FDE68A",
                    }}
                  >
                    ★ Class Teacher
                  </span>
                )}
                {activeClass.subjects.length > 0 && (
                  <span style={{ fontSize: 11, color: "var(--muted,#5B5E72)" }}>
                    <BookOpen
                      size={11}
                      style={{ verticalAlign: "middle", marginRight: 3 }}
                    />
                    {activeClass.subjects.join(" · ")}
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 20,
                background: "var(--bg-2,#F5F5FB)",
                border: "1px solid var(--line,#dbe4f0)",
                fontSize: 12, fontWeight: 700,
                color: "var(--ink,#15172A)",
              }}
            >
              <Users size={13} color="var(--muted,#5B5E72)" />
              {activeClass.student_count} student
              {activeClass.student_count !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Student table */}
          <StudentTable
            students={students}
            loading={studentsLoading}
            error={studentsError}
            onRetry={() => loadStudents(activeClass.class_id, activeClass.section_id)}
            onSelectStudent={(id) => setSelectedStudentPk(id)}
          />
        </div>
      )}
    </div>

      {/* ── Student profile drawer (fixed overlay) ─────────────────── */}
      <StudentProfileDrawer
        studentPk={selectedStudentPk}
        onClose={() => setSelectedStudentPk(null)}
      />
    </>
  );
}

// ── Page header (extracted for reuse) ────────────────────────────────────────

function PageHeader() {
  return (
    <div style={{ marginBottom: 20 }}>
      <p
        style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "var(--muted,#5B5E72)",
          marginBottom: 4,
        }}
      >
        Teacher Portal &nbsp;·&nbsp; My Classes
      </p>
      <h1
        style={{
          fontSize: 26, fontWeight: 700,
          fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",
          color: "var(--ink,#15172A)", margin: 0, lineHeight: 1.15,
        }}
      >
        My{" "}
        <em
          style={{
            fontWeight: 400, color: "var(--brand,#6D4AFF)",
            fontStyle: "italic",
          }}
        >
          Classes
        </em>
      </h1>
      <p style={{ fontSize: 12, color: "var(--muted,#5B5E72)", marginTop: 4 }}>
        Select a class tab to view the student roster.
      </p>
    </div>
  );
}
