"use client";

/**
 * Student Profile Drawer — Sprint 4
 *
 * Slide-in panel that shows a permission-driven student profile.
 * Triggered by clicking a student row on the My Classes page.
 *
 * Architecture:
 *  - Fetches GET /teacher/students/:id/ on mount
 *  - sections_available[] from the API response determines which tabs render
 *  - usePermissions().can() additionally gates action buttons within each tab
 *    (e.g. attendance.manage → editable toggles; attendance.view → read-only)
 *  - Backdrop click or × button closes the drawer
 *
 * Tabs:
 *  overview      — always shown (demographics + guardian)
 *  academic      — exam marks table (results.view)
 *  attendance    — 90-day attendance list + summary (attendance.view)
 *  behaviour     — incident log + point total (behaviour.view)
 *  homework      — placeholder until Sprint 6
 *  communication — placeholder until Sprint 7
 *  notes         — always shown (teacher personal notes — future)
 */

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle,
  Copy,
  Key,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  StickyNote,
  User,
  X,
  XCircle,
} from "lucide-react";
import {
  fetchStudentCredentials,
  fetchStudentProfile,
  resetStudentPortalPassword,
  type AttendanceRecord,
  type BehaviourRecord,
  type ExamMarkRow,
  type ProfileTab,
  type ResetPasswordResult,
  type StudentCredentials,
  type StudentOverview,
  type StudentProfile,
} from "@/lib/api/teacher";
import { usePermissions } from "@/hooks/usePermissions";

// ── Tab config ────────────────────────────────────────────────────────────────

interface TabDef {
  key: ProfileTab;
  label: string;
  icon: React.ReactNode;
}

const ALL_TABS: TabDef[] = [
  { key: "overview",      label: "Overview",      icon: <User size={13} /> },
  { key: "academic",      label: "Academic",      icon: <BookOpen size={13} /> },
  { key: "attendance",    label: "Attendance",    icon: <Calendar size={13} /> },
  { key: "behaviour",     label: "Behaviour",     icon: <ShieldAlert size={13} /> },
  { key: "homework",      label: "Homework",      icon: <BookOpen size={13} /> },
  { key: "communication", label: "Communication", icon: <MessageSquare size={13} /> },
  { key: "credentials",   label: "Credentials",   icon: <Key size={13} /> },
  { key: "notes",         label: "Notes",         icon: <StickyNote size={13} /> },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function genderLabel(g: string) {
  if (g === "male")   return "Male";
  if (g === "female") return "Female";
  if (g === "other")  return "Other";
  return g || "—";
}

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

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
      <span
        style={{
          width: 120, flexShrink: 0,
          fontSize: 10, fontWeight: 700,
          letterSpacing: "0.06em", textTransform: "uppercase",
          color: "var(--muted,#5B5E72)",
          paddingTop: 1,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: "var(--ink,#15172A)" }}>
        {value || "—"}
      </span>
    </div>
  );
}

// Status chip colours for attendance
const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  P: { bg: "#F0FDF4", text: "#15803D" },
  A: { bg: "#FEF2F2", text: "#B91C1C" },
  L: { bg: "#FFFBEB", text: "#B45309" },
  F: { bg: "#EFF6FF", text: "#1D4ED8" },
  H: { bg: "#F5F5FB", text: "#5B5E72" },
};

// ── Tab content components ─────────────────────────────────────────────────────

function OverviewTab({ overview }: { overview: StudentOverview }) {
  return (
    <div style={{ padding: "0 4px" }}>
      <p style={{
        fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "var(--muted,#5B5E72)",
        marginBottom: 12,
      }}>
        Personal Information
      </p>
      <InfoRow label="Full Name"   value={overview.name} />
      <InfoRow label="Roll No."    value={overview.roll_no} />
      <InfoRow label="Admission"   value={overview.admission_no} />
      <InfoRow label="Gender"      value={genderLabel(overview.gender)} />
      <InfoRow label="Date of Birth" value={overview.date_of_birth ?? undefined} />
      <InfoRow label="Blood Group" value={overview.blood_group} />
      <InfoRow label="Phone"       value={overview.phone} />
      <InfoRow label="Email"       value={overview.email} />

      {(overview.guardian_name || overview.guardian_phone) && (
        <>
          <div style={{ borderTop: "1px solid var(--line,#dbe4f0)", margin: "16px 0 12px" }} />
          <p style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--muted,#5B5E72)",
            marginBottom: 12,
          }}>
            Guardian
          </p>
          <InfoRow label="Name"     value={overview.guardian_name} />
          <InfoRow label="Relation" value={overview.guardian_relation} />
          <InfoRow label="Phone"    value={overview.guardian_phone} />
        </>
      )}
    </div>
  );
}

function AcademicTab({ marks }: { marks: ExamMarkRow[] }) {
  const { can } = usePermissions();
  const canManage = can("results.manage");

  if (marks.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 16px" }}>
        <BookOpen size={28} color="var(--muted,#5B5E72)" style={{ marginBottom: 10, opacity: 0.4 }} />
        <p style={{ fontSize: 13, color: "var(--muted,#5B5E72)" }}>No exam records yet.</p>
      </div>
    );
  }

  // Group by term
  const byTerm: Record<string, ExamMarkRow[]> = {};
  for (const m of marks) {
    const t = m.term || m.exam_name || "Other";
    if (!byTerm[t]) byTerm[t] = [];
    byTerm[t].push(m);
  }

  return (
    <div>
      {!canManage && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 12px", borderRadius: 8, marginBottom: 16,
          background: "#FFFBEB", border: "1px solid #FDE68A",
          fontSize: 11, color: "#B45309",
        }}>
          <AlertCircle size={12} />
          View only — contact admin to request edit access
        </div>
      )}
      {Object.entries(byTerm).map(([term, rows]) => (
        <div key={term} style={{ marginBottom: 20 }}>
          <p style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--muted,#5B5E72)",
            marginBottom: 10,
          }}>
            {term}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line,#dbe4f0)" }}>
                  {["Subject", "Obtained", "Full Marks", "Result"].map(col => (
                    <th key={col} style={{
                      padding: "6px 10px", textAlign: "left",
                      fontSize: 9, fontWeight: 800,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      color: "var(--muted,#5B5E72)",
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const passed = !row.absent && row.obtained >= row.pass_marks;
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--line,#dbe4f0)" }}>
                      <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600, color: "var(--ink,#15172A)" }}>
                        {row.subject}
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 700, color: "var(--ink,#15172A)" }}>
                        {row.absent ? "—" : row.obtained}
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--muted,#5B5E72)" }}>
                        {row.full_marks}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        {row.absent ? (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px",
                            borderRadius: 20, background: "#F5F5FB", color: "#5B5E72",
                          }}>
                            Absent
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px",
                            borderRadius: 20,
                            background: passed ? "#F0FDF4" : "#FEF2F2",
                            color: passed ? "#15803D" : "#B91C1C",
                          }}>
                            {passed ? "Pass" : "Fail"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function AttendanceTab({
  records,
  summary,
}: {
  records: AttendanceRecord[];
  summary: { present: number; absent: number; late: number; attendance_pct: number | null };
}) {
  return (
    <div>
      {/* Summary strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)",
        gap: 8, marginBottom: 16,
      }}>
        {[
          { label: "Present",  value: summary.present,  color: "#15803D" },
          { label: "Absent",   value: summary.absent,   color: "#B91C1C" },
          { label: "Late",     value: summary.late,     color: "#B45309" },
          { label: "% Attend", value: summary.attendance_pct !== null ? `${summary.attendance_pct}%` : "—", color: "var(--ink,#15172A)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: "var(--bg-2,#F5F5FB)",
            border: "1px solid var(--line,#dbe4f0)",
            borderRadius: 10, padding: "10px 8px", textAlign: "center",
          }}>
            <p style={{ fontSize: 16, fontWeight: 800, color, margin: 0 }}>{value}</p>
            <p style={{ fontSize: 9, color: "var(--muted,#5B5E72)", marginTop: 2 }}>{label}</p>
          </div>
        ))}
      </div>

      <p style={{
        fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "var(--muted,#5B5E72)",
        marginBottom: 10,
      }}>
        Last 90 Days
      </p>

      {records.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--muted,#5B5E72)", textAlign: "center", padding: "20px 0" }}>
          No attendance records in the last 90 days.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {records.map((r, i) => {
            const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.P;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "7px 10px", borderRadius: 8,
                background: "var(--bg-2,#F5F5FB)",
                border: "1px solid var(--line,#dbe4f0)",
              }}>
                <span style={{ fontSize: 12, color: "var(--muted,#5B5E72)", width: 80, flexShrink: 0 }}>
                  {r.date}
                </span>
                <span style={{
                  padding: "2px 8px", borderRadius: 20,
                  fontSize: 10, fontWeight: 700,
                  background: s.bg, color: s.text,
                }}>
                  {r.label}
                </span>
                {r.notes && (
                  <span style={{ fontSize: 11, color: "var(--muted,#5B5E72)", flex: 1 }}>
                    {r.notes}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BehaviourTab({
  records,
  totalPoints,
}: {
  records: BehaviourRecord[];
  totalPoints: number;
}) {
  const pointColor =
    totalPoints > 0 ? "#15803D" : totalPoints < 0 ? "#B91C1C" : "var(--muted,#5B5E72)";

  return (
    <div>
      {/* Total points */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px", borderRadius: 10,
        background: "var(--bg-2,#F5F5FB)",
        border: "1px solid var(--line,#dbe4f0)",
        marginBottom: 16,
      }}>
        <div>
          <p style={{ fontSize: 9, color: "var(--muted,#5B5E72)", margin: 0, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Behaviour Score
          </p>
          <p style={{ fontSize: 22, fontWeight: 800, color: pointColor, margin: "2px 0 0" }}>
            {totalPoints > 0 ? `+${totalPoints}` : totalPoints}
          </p>
        </div>
        <span style={{ fontSize: 11, color: "var(--muted,#5B5E72)", flex: 1 }}>
          {totalPoints > 0
            ? "Positive behaviour overall"
            : totalPoints < 0
            ? "Needs improvement"
            : "No behaviour records yet"}
        </span>
      </div>

      {records.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--muted,#5B5E72)", textAlign: "center", padding: "20px 0" }}>
          No behaviour records found.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {records.map((r, i) => {
            const isPositive = r.point >= 0;
            return (
              <div key={i} style={{
                padding: "10px 12px", borderRadius: 10,
                background: "#fff",
                border: "1px solid var(--line,#dbe4f0)",
                borderLeft: `3px solid ${isPositive ? "#22C55E" : "#EF4444"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink,#15172A)" }}>
                    {r.title}
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 800,
                    color: isPositive ? "#15803D" : "#B91C1C",
                    flexShrink: 0,
                  }}>
                    {r.point > 0 ? `+${r.point}` : r.point}
                  </span>
                </div>
                {r.description && (
                  <p style={{ fontSize: 11, color: "var(--muted,#5B5E72)", margin: "4px 0 0" }}>
                    {r.description}
                  </p>
                )}
                <p style={{ fontSize: 10, color: "var(--muted,#5B5E72)", margin: "4px 0 0" }}>
                  {r.date}
                  {r.assigned_by ? ` · by ${r.assigned_by}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AccountCard({
  title,
  info,
  canReset,
  onReset,
  resetResult,
  resetting,
}: {
  title: string;
  info: StudentCredentials["student"] & { guardian_name?: string | null; guardian_relation?: string | null };
  canReset: boolean;
  onReset: () => void;
  resetResult: ResetPasswordResult | null;
  resetting: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function copyPassword() {
    if (!resetResult) return;
    navigator.clipboard.writeText(resetResult.new_password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{
      border: "1px solid var(--line,#dbe4f0)",
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 16,
    }}>
      {/* Card header */}
      <div style={{
        padding: "10px 14px",
        background: "var(--bg-2,#F5F5FB)",
        borderBottom: "1px solid var(--line,#dbe4f0)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted,#5B5E72)", margin: 0 }}>
          {title}
          {info.guardian_name && (
            <span style={{ fontWeight: 400, textTransform: "none", marginLeft: 6 }}>
              — {info.guardian_name} ({info.guardian_relation})
            </span>
          )}
        </p>
        {info.has_account && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
            background: info.is_active ? "#F0FDF4" : "#FEF2F2",
            color: info.is_active ? "#15803D" : "#B91C1C",
          }}>
            {info.is_active
              ? <><CheckCircle size={10} /> Active</>
              : <><XCircle size={10} /> Inactive</>
            }
          </span>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: "12px 14px" }}>
        {!info.has_account ? (
          <p style={{ fontSize: 12, color: "var(--muted,#5B5E72)", margin: 0 }}>
            No portal account created yet.
          </p>
        ) : (
          <>
            <InfoRow label="Username" value={info.username} />
            <InfoRow label="Last Login" value={info.last_login ? new Date(info.last_login).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Never"} />
            <InfoRow label="Joined"    value={info.date_joined ? new Date(info.date_joined).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"} />

            {canReset && (
              <div style={{ marginTop: 12 }}>
                {resetResult ? (
                  <div style={{
                    padding: "10px 12px", borderRadius: 8,
                    background: "#F0FDF4", border: "1px solid #BBF7D0",
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#15803D", margin: "0 0 6px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      New Password (share with user)
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <code style={{
                        flex: 1, fontSize: 14, fontWeight: 700,
                        color: "#15172A", letterSpacing: "0.06em",
                        background: "#fff", border: "1px solid #BBF7D0",
                        borderRadius: 6, padding: "4px 10px",
                      }}>
                        {resetResult.new_password}
                      </code>
                      <button
                        onClick={copyPassword}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: copied ? "#15803D" : "var(--soft,#EEEAFF)",
                          color: copied ? "#fff" : "var(--brand,#6D4AFF)",
                          border: "none", cursor: "pointer",
                        }}
                      >
                        <Copy size={11} />
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p style={{ fontSize: 10, color: "#15803D", margin: "6px 0 0" }}>
                      User will be prompted to change this on next login.
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={onReset}
                    disabled={resetting}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "7px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: resetting ? "var(--bg-2,#F5F5FB)" : "var(--soft,#EEEAFF)",
                      color: "var(--brand,#6D4AFF)",
                      border: "1px solid #ddd6fe",
                      cursor: resetting ? "not-allowed" : "pointer",
                    }}
                  >
                    <RefreshCw size={11} />
                    {resetting ? "Resetting…" : "Reset Password"}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CredentialsTab({ studentPk }: { studentPk: number }) {
  const { can } = usePermissions();
  const canReset = can("students.manage");

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [data, setData]       = useState<StudentCredentials | null>(null);
  const [studentResetResult, setStudentResetResult] = useState<ResetPasswordResult | null>(null);
  const [parentResetResult, setParentResetResult]   = useState<ResetPasswordResult | null>(null);
  const [resettingStudent, setResettingStudent]     = useState(false);
  const [resettingParent, setResettingParent]       = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchStudentCredentials(studentPk)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentPk]);

  async function handleReset(target: "student" | "parent") {
    if (target === "student") setResettingStudent(true);
    else setResettingParent(true);
    try {
      const result = await resetStudentPortalPassword(studentPk, target);
      if (target === "student") setStudentResetResult(result);
      else setParentResetResult(result);
    } catch (e: unknown) {
      alert((e as Error).message || "Reset failed. Please try again.");
    } finally {
      setResettingStudent(false);
      setResettingParent(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
        {[1, 2].map(i => <Skeleton key={i} h={100} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <AlertCircle size={24} color="var(--red,#E0463A)" style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: "var(--muted,#5B5E72)" }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <AccountCard
        title="Student Portal"
        info={data.student}
        canReset={canReset}
        onReset={() => handleReset("student")}
        resetResult={studentResetResult}
        resetting={resettingStudent}
      />
      <AccountCard
        title="Parent Portal"
        info={data.parent}
        canReset={canReset}
        onReset={() => handleReset("parent")}
        resetResult={parentResetResult}
        resetting={resettingParent}
      />
    </div>
  );
}

function PlaceholderTab({ label, sprint }: { label: string; sprint: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 16px" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 40, height: 40, borderRadius: "50%",
        background: "var(--soft,#EEEAFF)", marginBottom: 12,
      }}>
        <BookOpen size={18} color="var(--brand,#6D4AFF)" />
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink,#15172A)", marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ fontSize: 12, color: "var(--muted,#5B5E72)" }}>
        Coming in {sprint}
      </p>
    </div>
  );
}

// ── Main Drawer component ─────────────────────────────────────────────────────

interface StudentProfileDrawerProps {
  studentPk: number | null;
  onClose: () => void;
}

export function StudentProfileDrawer({ studentPk, onClose }: StudentProfileDrawerProps) {
  const [profile, setProfile]   = useState<StudentProfile | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");

  const { can } = usePermissions();

  // Close on Escape key
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Fetch when studentPk changes
  useEffect(() => {
    if (!studentPk) {
      setProfile(null);
      return;
    }
    setLoading(true);
    setError(null);
    setActiveTab("overview");
    fetchStudentProfile(studentPk)
      .then((data) => {
        setProfile(data);
        // Default to first available tab
        if (data.sections_available.length > 0) {
          setActiveTab(data.sections_available[0]);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentPk]);

  // Don't render when not open
  if (!studentPk) return null;

  const isOpen = !!studentPk;

  // Filter tabs to ones the server says are available
  const visibleTabs = profile
    ? ALL_TABS.filter((t) => profile.sections_available.includes(t.key))
    : [];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(15,18,34,0.35)",
          animation: "fadeIn 0.15s ease",
        }}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(520px, 100vw)",
          zIndex: 50,
          background: "#fff",
          boxShadow: "-8px 0 32px -4px rgba(15,18,34,0.18)",
          display: "flex", flexDirection: "column",
          animation: "slideInRight 0.2s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line,#dbe4f0)" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Skeleton w={52} h={52} />
              <div style={{ flex: 1 }}>
                <Skeleton w="60%" h={16} />
                <div style={{ marginTop: 6 }}><Skeleton w="40%" h={11} /></div>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color="var(--muted,#5B5E72)" />
              </button>
            </div>
          </div>
        ) : profile ? (
          <StudentHeader overview={profile.overview} onClose={onClose} />
        ) : (
          <div style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--line,#dbe4f0)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink,#15172A)" }}>
              Student Profile
            </span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
              <X size={20} color="var(--muted,#5B5E72)" />
            </button>
          </div>
        )}

        {/* ── Error state ──────────────────────────────────────────── */}
        {error && (
          <div style={{ padding: "32px 24px", textAlign: "center" }}>
            <AlertCircle size={28} color="var(--red,#E0463A)" style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink,#15172A)", marginBottom: 4 }}>
              Could not load profile
            </p>
            <p style={{ fontSize: 12, color: "var(--muted,#5B5E72)", marginBottom: 12 }}>{error}</p>
            <button
              onClick={() => studentPk && fetchStudentProfile(studentPk).then(setProfile).catch((e: Error) => setError(e.message))}
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
        )}

        {/* ── Loading skeleton (body) ───────────────────────────────── */}
        {loading && (
          <div style={{ padding: "16px 24px", flex: 1 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
              {[1, 2, 3].map(i => <Skeleton key={i} w={80} h={30} />)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} h={16} />)}
            </div>
          </div>
        )}

        {/* ── Tabs + content ────────────────────────────────────────── */}
        {!loading && !error && profile && (
          <>
            {/* Tab pills */}
            <div style={{
              display: "flex", gap: 4, flexWrap: "wrap",
              padding: "12px 20px 0",
              borderBottom: "1px solid var(--line,#dbe4f0)",
            }}>
              {visibleTabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 12px",
                      fontSize: 11, fontWeight: 700,
                      cursor: "pointer",
                      border: "none",
                      background: "transparent",
                      color: isActive ? "var(--brand,#6D4AFF)" : "var(--muted,#5B5E72)",
                      borderBottom: isActive ? "2px solid var(--brand,#6D4AFF)" : "2px solid transparent",
                      marginBottom: -1,
                      transition: "color 0.15s",
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              {activeTab === "overview" && (
                <OverviewTab overview={profile.overview} />
              )}
              {activeTab === "academic" && profile.academic && (
                <AcademicTab marks={profile.academic.marks} />
              )}
              {activeTab === "attendance" && profile.attendance && (
                <AttendanceTab
                  records={profile.attendance.records}
                  summary={profile.attendance.summary}
                />
              )}
              {activeTab === "behaviour" && profile.behaviour && (
                <BehaviourTab
                  records={profile.behaviour.records}
                  totalPoints={profile.behaviour.total_points}
                />
              )}
              {activeTab === "homework" && (
                <PlaceholderTab label="Homework" sprint="Sprint 6" />
              )}
              {activeTab === "communication" && (
                <PlaceholderTab label="Communication" sprint="Sprint 7" />
              )}
              {activeTab === "credentials" && (
                <CredentialsTab studentPk={studentPk!} />
              )}
              {activeTab === "notes" && (
                <PlaceholderTab label="Teacher Notes" sprint="a future sprint" />
              )}
            </div>
          </>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes fadeIn      { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes shimmer {
          from { background-position: 200% 0 }
          to   { background-position: -200% 0 }
        }
      `}</style>
    </>
  );
}

// ── Student header ────────────────────────────────────────────────────────────

function StudentHeader({
  overview,
  onClose,
}: {
  overview: StudentOverview;
  onClose: () => void;
}) {
  const initials = overview.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const genderColors: Record<string, { bg: string; text: string }> = {
    male:   { bg: "#EFF6FF", text: "#1D4ED8" },
    female: { bg: "#FDF4FF", text: "#A21CAF" },
    other:  { bg: "#F5F5FB", text: "#5B5E72" },
  };
  const gc = genderColors[overview.gender] ?? { bg: "#F5F5FB", text: "#5B5E72" };

  return (
    <div style={{
      padding: "20px 24px",
      borderBottom: "1px solid var(--line,#dbe4f0)",
      background: "var(--bg-2,#F5F5FB)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        {/* Avatar */}
        {overview.photo_url ? (
          <img
            src={overview.photo_url}
            alt={overview.name}
            style={{
              width: 52, height: 52, borderRadius: "50%",
              objectFit: "cover", flexShrink: 0,
              border: "2px solid var(--line,#dbe4f0)",
            }}
          />
        ) : (
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: gc.bg, color: gc.text,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, flexShrink: 0,
          }}>
            {initials || "?"}
          </div>
        )}

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            fontSize: 16, fontWeight: 700,
            fontFamily: "var(--serif,'Playfair Display',Georgia,serif)",
            color: "var(--ink,#15172A)", margin: 0, lineHeight: 1.2,
          }}>
            {overview.name}
          </h2>
          <p style={{ fontSize: 12, color: "var(--muted,#5B5E72)", margin: "3px 0 6px" }}>
            {overview.class_name}
            {overview.section_name ? ` – ${overview.section_name}` : ""}
            {overview.roll_no ? ` · Roll ${overview.roll_no}` : ""}
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              padding: "2px 8px", borderRadius: 20,
              fontSize: 10, fontWeight: 700,
              background: gc.bg, color: gc.text,
            }}>
              {genderLabel(overview.gender)}
            </span>
            {overview.blood_group && (
              <span style={{
                padding: "2px 8px", borderRadius: 20,
                fontSize: 10, fontWeight: 700,
                background: "#FEF2F2", color: "#B91C1C",
              }}>
                {overview.blood_group}
              </span>
            )}
          </div>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 4, color: "var(--muted,#5B5E72)",
          }}
          title="Close (Esc)"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}

export default StudentProfileDrawer;
