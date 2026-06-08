"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, CreditCard, Bell, BookOpen,
  ChevronRight, Award, User, Droplets, Hash, GraduationCap,
} from "lucide-react";
import { useParentChild } from "@/contexts/ParentChildContext";
import { fetchChildDetail, type ChildDetail, type ExamMarkRow } from "@/lib/api/parent";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ w = "100%", h = 16 }: { w?: string | number; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 8,
      backgroundImage: "linear-gradient(90deg, var(--line,#dbe4f0) 25%, var(--bg-2,#f5f5fb) 50%, var(--line,#dbe4f0) 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s ease-in-out infinite",
    }} />
  );
}

// ── Attendance ring ───────────────────────────────────────────────────────────

function AttRing({ pct }: { pct: number | null }) {
  if (pct === null) return <div style={{ fontSize: 12, color: "var(--ink-3)" }}>No records</div>;
  const color = pct >= 85 ? "var(--ok)" : pct >= 70 ? "#D97706" : "#DC2626";
  const r = 38, circ = 2 * Math.PI * r, dash = (pct / 100) * circ;
  return (
    <svg width={96} height={96} viewBox="0 0 96 96">
      <circle cx={48} cy={48} r={r} fill="none" stroke="var(--line,#dbe4f0)" strokeWidth={7} />
      <circle cx={48} cy={48} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform="rotate(-90 48 48)" />
      <text x={48} y={45} textAnchor="middle" dominantBaseline="middle" fontSize={16} fontWeight={700} fill={color}>{pct}%</text>
      <text x={48} y={60} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="var(--ink-3)">Attendance</text>
    </svg>
  );
}

// ── Exam results table ────────────────────────────────────────────────────────

function MarksTable({ marks }: { marks: ExamMarkRow[] }) {
  if (marks.length === 0) return (
    <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "20px 0", textAlign: "center" }}>No exam records yet.</div>
  );

  const byTerm = marks.reduce<Record<string, ExamMarkRow[]>>((acc, m) => {
    const key = m.term || "—";
    (acc[key] = acc[key] || []).push(m);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {Object.entries(byTerm).map(([term, rows]) => (
        <div key={term}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>{term}</div>
          <div style={{ border: "1px solid var(--bd)", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-2,#F5F5FB)" }}>
                  {["Subject", "Exam", "Obtained", "Max", "%"].map((h, i) => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: i >= 2 ? "center" : "left", fontWeight: 600, color: "var(--ink-2)", borderBottom: "1px solid var(--bd)", fontSize: 11.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const pct = row.full_marks > 0 ? Math.round(row.obtained / row.full_marks * 100) : 0;
                  const passed = !row.absent && row.obtained >= row.pass_marks;
                  const color = row.absent ? "var(--ink-3)" : passed ? "var(--ok)" : "#DC2626";
                  return (
                    <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--bd)" : "none" }}>
                      <td style={{ padding: "9px 14px", color: "var(--ink-1)", fontWeight: 500 }}>{row.subject || "—"}</td>
                      <td style={{ padding: "9px 14px", color: "var(--ink-3)", fontSize: 12 }}>{row.exam_name || "—"}</td>
                      <td style={{ padding: "9px 14px", textAlign: "center", color }}>{row.absent ? "Absent" : row.obtained}</td>
                      <td style={{ padding: "9px 14px", textAlign: "center", color: "var(--ink-3)" }}>{row.full_marks}</td>
                      <td style={{ padding: "9px 14px", textAlign: "center", fontWeight: 700, color }}>{row.absent ? "—" : `${pct}%`}</td>
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

// ── Sidebar quick action ──────────────────────────────────────────────────────

function SidebarAction({ icon: Icon, label, sublabel, color, bg, path }: {
  icon: React.ElementType; label: string; sublabel: string;
  color: string; bg: string; path: string;
}) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(path)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, cursor: "pointer", transition: "background 0.12s" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-2)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} color={color} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-1)" }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{sublabel}</div>
      </div>
      <ChevronRight size={13} strokeWidth={1.8} color="var(--ink-3)" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChildrenPage() {
  const { children: siblings, selectedChild, setSelectedChildId, loading } = useParentChild();
  const [detail, setDetail] = useState<ChildDetail | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!selectedChild) return;
    setDetail(null);
    setDetailError(false);
    setDetailLoading(true);
    fetchChildDetail(selectedChild.id)
      .then(setDetail)
      .catch(() => setDetailError(true))
      .finally(() => setDetailLoading(false));
  }, [selectedChild?.id]);

  const att = detail?.attendance;

  return (
    /* ── Outer white card — matches admin page chrome ── */
    <div style={{
      background: "var(--bg-1)",
      border: "1px solid var(--bd)",
      borderRadius: 18,
      boxShadow: "var(--sh-1)",
      padding: "28px 30px",
    }}>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 22, paddingBottom: 20, borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 600, color: "var(--ink-1)", margin: "0 0 5px", lineHeight: 1.05, letterSpacing: "-0.03em", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            My{" "}
            <em style={{ fontFamily: "var(--font-instrument-serif, 'Instrument Serif', Georgia, serif)", fontWeight: 400, fontStyle: "italic", color: "var(--pu)", fontSize: 38, letterSpacing: "-0.02em" }}>
              Children
            </em>
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55 }}>
            View attendance, results, and profile details for each child.
          </p>
        </div>

        {/* Child count badge */}
        {siblings.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, border: "1px solid var(--bd)", background: "var(--bg-2)", flexShrink: 0 }}>
            <User size={13} color="var(--ink-3)" strokeWidth={1.5} />
            <span style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 500 }}>
              {siblings.length} {siblings.length === 1 ? "child" : "children"} enrolled
            </span>
          </div>
        )}
      </div>

      {/* ── Sibling tabs ─────────────────────────────────────────────────── */}
      {siblings.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
          {siblings.map((c) => {
            const isSelected = c.id === selectedChild?.id;
            const initials = c.name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
            return (
              <button
                key={c.id}
                onClick={() => setSelectedChildId(c.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "7px 16px",
                  borderRadius: 24, border: `1.5px solid ${isSelected ? "var(--pu)" : "var(--bd)"}`,
                  background: isSelected ? "var(--pu-soft)" : "#fff",
                  color: isSelected ? "var(--pu)" : "var(--ink-2)",
                  fontSize: 13, fontWeight: isSelected ? 600 : 400, cursor: "pointer", transition: "all 0.12s",
                }}
              >
                {c.photo_url ? (
                  <img src={c.photo_url} alt={c.name} style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: isSelected ? "var(--pu)" : "var(--pu-soft)", color: isSelected ? "#fff" : "var(--pu)", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                    {initials}
                  </div>
                )}
                <span>{c.name.split(" ")[0]}</span>
                {c.class_name && <span style={{ fontSize: 11, opacity: 0.7 }}>{c.class_name}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {detailError && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", color: "#B91C1C", fontSize: 13, marginBottom: 20 }}>
          Could not load child data. Please refresh.
        </div>
      )}

      {/* ── Loading skeleton ────────────────────────────────────────────── */}
      {(loading || detailLoading) && !detail && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Skeleton h={160} /><Skeleton h={220} /><Skeleton h={200} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Skeleton h={140} /><Skeleton h={160} />
          </div>
        </div>
      )}

      {/* ── No children ─────────────────────────────────────────────────── */}
      {!loading && siblings.length === 0 && (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--bd)", borderRadius: 12, padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
          No active children linked to your account. Contact the school administrator.
        </div>
      )}

      {/* ── 2-col content ────────────────────────────────────────────────── */}
      {detail && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>

          {/* ── Left ─────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Profile card */}
            <div style={{ border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ background: "linear-gradient(135deg, var(--pu) 0%, var(--pu-deep) 100%)", padding: "20px 22px", display: "flex", alignItems: "center", gap: 16 }}>
                {detail.photo_url ? (
                  <img src={detail.photo_url} alt={detail.name} style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(255,255,255,0.18)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 20, border: "2px solid rgba(255,255,255,0.35)", flexShrink: 0 }}>
                    {detail.name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: "#fff", marginBottom: 3 }}>{detail.name}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
                    {[detail.class_name, detail.section_name].filter(Boolean).join(" · ")}
                    {detail.roll_no ? ` · Roll ${detail.roll_no}` : ""}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "#fff" }}>
                {[
                  { icon: Hash, label: "Admission No.", value: detail.admission_no || "—" },
                  { icon: User, label: "Gender", value: detail.gender ? detail.gender.charAt(0).toUpperCase() + detail.gender.slice(1) : "—" },
                  { icon: GraduationCap, label: "Date of Birth", value: detail.date_of_birth ? new Date(detail.date_of_birth).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—" },
                  { icon: Droplets, label: "Blood Group", value: detail.blood_group || "—" },
                ].map((item, i) => (
                  <div key={i} style={{ padding: "12px 16px", borderTop: "1px solid var(--bd)", borderRight: i < 3 ? "1px solid var(--bd)" : "none" }}>
                    <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <item.icon size={10} strokeWidth={1.5} />{item.label}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-1)" }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Attendance */}
            <div style={{ border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
              <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--pu-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CalendarDays size={13} color="var(--pu)" strokeWidth={1.8} />
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-1)" }}>Attendance — Last 90 Days</span>
                </div>
                {att && att.total > 0 && (
                  <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{att.total} school days recorded</span>
                )}
              </div>
              <div style={{ padding: "20px 22px", display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
                <AttRing pct={att?.pct ?? null} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 36px" }}>
                  {[
                    { label: "Present", value: att?.present ?? 0, color: "var(--ok)" },
                    { label: "Absent",  value: att?.absent  ?? 0, color: "#DC2626" },
                    { label: "Late",    value: att?.late    ?? 0, color: "#D97706" },
                    { label: "Half Day",value: att?.half_day ?? 0, color: "var(--pu)" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 3 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                {att && att.total > 0 && (
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ height: 6, borderRadius: 99, background: "var(--line,#dbe4f0)", marginBottom: 7 }}>
                      <div style={{ height: "100%", width: `${att.pct ?? 0}%`, background: (att.pct ?? 0) >= 85 ? "var(--ok)" : (att.pct ?? 0) >= 70 ? "#D97706" : "#DC2626", borderRadius: 99, transition: "width 0.6s ease" }} />
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                      {(att.pct ?? 0) >= 85 ? "✓ Good standing" : (att.pct ?? 0) >= 70 ? "⚠ Below recommended 85%" : "⚠ Critical — please follow up"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Exam Results */}
            <div style={{ border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
              <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--pu-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BookOpen size={13} color="var(--pu)" strokeWidth={1.8} />
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-1)" }}>Exam Results</span>
              </div>
              <div style={{ padding: "18px 20px" }}>
                <MarksTable marks={detail.recent_marks} />
              </div>
            </div>

          </div>

          {/* ── Right sidebar ─────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Behaviour points */}
            <div style={{ border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
              <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--pu-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Award size={12} color="var(--pu)" strokeWidth={1.8} />
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-1)" }}>Behaviour Points</span>
              </div>
              <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 50, height: 50, borderRadius: 12, background: detail.behaviour_points >= 0 ? "var(--pu-soft)" : "#FEF2F2", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: detail.behaviour_points >= 0 ? "var(--pu)" : "#DC2626" }}>
                    {detail.behaviour_points >= 0 ? "+" : ""}{detail.behaviour_points}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>
                  {detail.behaviour_points > 0 ? "Positive record — keep it up!" : detail.behaviour_points < 0 ? "Needs improvement. Talk to the class teacher." : "No behaviour records yet."}
                </div>
              </div>
            </div>

            {/* Attendance compact */}
            {att && att.total > 0 && (
              <div style={{ border: "1px solid var(--bd)", borderRadius: 14, padding: "14px 16px", background: "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 12 }}>Attendance at a glance</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "var(--ink-2)" }}>Overall rate</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: (att.pct ?? 0) >= 85 ? "var(--ok)" : "#DC2626" }}>{att.pct ?? 0}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 99, background: "var(--line,#dbe4f0)", marginBottom: 12 }}>
                  <div style={{ height: "100%", width: `${att.pct ?? 0}%`, background: (att.pct ?? 0) >= 85 ? "var(--ok)" : "#DC2626", borderRadius: 99 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Present", val: att.present, c: "var(--ok)" },
                    { label: "Absent",  val: att.absent,  c: "#DC2626" },
                    { label: "Late",    val: att.late,    c: "#D97706" },
                    { label: "Total",   val: att.total,   c: "var(--ink-2)" },
                  ].map(({ label, val, c }) => (
                    <div key={label} style={{ background: "var(--bg-2)", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: c, lineHeight: 1 }}>{val}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
              <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--bd)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>Quick Actions</span>
              </div>
              <div style={{ padding: "6px 4px" }}>
                <SidebarAction icon={CalendarDays} label="Attendance Calendar" sublabel="View month-wise" color="var(--ok)" bg="rgba(34,197,94,0.1)" path="/parent/attendance" />
                <SidebarAction icon={CreditCard} label="Fee Summary" sublabel="Dues & payments" color="#D97706" bg="#FFF7ED" path="/parent/fees" />
                <SidebarAction icon={Bell} label="Notices" sublabel="School circulars" color="#0284C7" bg="#F0F9FF" path="/parent/notices" />
                <SidebarAction icon={BookOpen} label="All Results" sublabel="Exam reports" color="var(--pu)" bg="var(--pu-soft)" path="/parent/results" />
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
