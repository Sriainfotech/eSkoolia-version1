"use client";
/**
 * Examination · Command Center — landing hub for the Examination module.
 * Redesign target: 5 groups (by how often each one changes) replacing the old
 * flat 14-item exam menu (still live at /exams/*, unchanged — see lib/routes.ts).
 * Colors match components/academics/foundation/FoundationWorkspace.tsx exactly
 * (the app's established light hero/card pattern) rather than a bespoke palette.
 * Static mockup: metrics below are hardcoded, only the module-card /
 * "Needs attention" links are real navigation.
 */
import Link from "next/link";
import {
  Star, Copy, Calendar, User, Smartphone, AlertTriangle, AlertCircle,
  CheckSquare, CheckCircle2, Sparkles, Plus, Info,
} from "lucide-react";

const L = {
  page: "var(--page, #FAFAFB)",
  card: "#f8f8fc", cardBorder: "#dfdfea",
  border: "#E8ECEF", borderStrong: "#D2D7DC",
  ink1: "#1A1D1F", ink2: "#6F767E", ink3: "#9FA6AD",
  purple: "#5B4FCF", purpleSoft: "#EEF0FF", hoverSoft: "#F0F2F5",
  danger: "#DC2626", dangerSoft: "#FEF2F2",
  warn: "#B45309", warnSoft: "#FFFBEB",
  ok: "#15803D", okSoft: "#ECFDF5",
  info: "#2563EB", infoSoft: "#EFF6FF",
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
      color: L.ink2,
    }}>
      {children}
    </div>
  );
}

function StatTile({ icon: Icon, iconColor, iconBg, label, value, valueColor, note, noteColor }: {
  icon: React.ElementType; iconColor: string; iconBg: string;
  label: string; value: string; valueColor: string; note: string; noteColor: string;
}) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${L.border}`, borderRadius: 14,
      padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Eyebrow>{label}</Eyebrow>
        <div style={{
          width: 26, height: 26, borderRadius: 8, background: iconBg, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={13} color={iconColor} strokeWidth={2} />
        </div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: valueColor, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: noteColor, lineHeight: 1.4 }}>{note}</div>
    </div>
  );
}

interface ModuleCardProps {
  icon: React.ElementType; badge: string; title: string;
  descDot: string; description: string;
  cta: string; ctaHref: string; ctaVariant: "primary" | "danger" | "outline";
  span2?: boolean;
}

function ModuleCard({ icon: Icon, badge, title, descDot, description, cta, ctaHref, ctaVariant, span2 }: ModuleCardProps) {
  const ctaStyle: React.CSSProperties =
    ctaVariant === "primary"
      ? { background: L.purple, border: `1px solid ${L.purple}`, color: "#fff" }
      : ctaVariant === "danger"
        ? { background: L.danger, border: `1px solid ${L.danger}`, color: "#fff" }
        : { background: "#fff", border: `1px solid ${L.borderStrong}`, color: L.ink1 };

  return (
    <div style={{
      gridColumn: span2 ? "1 / -1" : undefined,
      background: "#fff", border: `1px solid ${L.border}`, borderRadius: 16,
      padding: 22, display: "flex", flexDirection: "column", gap: 14,
      boxShadow: "0 1px 2px rgba(15,18,34,0.04)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: L.purpleSoft,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={17} color={L.purple} strokeWidth={1.75} />
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
          color: L.ink3, border: `1px solid ${L.borderStrong}`, borderRadius: 999, padding: "3px 9px",
        }}>
          {badge}
        </span>
      </div>

      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: L.ink1, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: L.ink2, lineHeight: 1.5, display: "flex", gap: 6 }}>
          <span style={{ color: descDot, flexShrink: 0 }}>●</span>
          <span>{description}</span>
        </div>
      </div>

      <Link
        href={ctaHref}
        style={{
          marginTop: "auto", height: 40, borderRadius: 10, textDecoration: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 600, transition: "opacity 0.15s", ...ctaStyle,
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.85")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
      >
        {cta}
      </Link>
    </div>
  );
}

function AttentionItem({ icon: Icon, color, bg, title, sub }: {
  icon: React.ElementType; color: string; bg: string; title: string; sub: string;
}) {
  return (
    <div style={{
      display: "flex", gap: 10, padding: "10px 12px", borderRadius: 10,
      borderLeft: `3px solid ${color}`, background: bg,
    }}>
      <Icon size={15} color={color} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: L.ink1, lineHeight: 1.35 }}>{title}</div>
        <div style={{ fontSize: 11, color: L.ink2, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, href }: { icon: React.ElementType; label: string; href: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8,
        textDecoration: "none", color: L.ink1, fontSize: 12.5, fontWeight: 500,
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = L.hoverSoft)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")}
    >
      <Icon size={14} color={L.purple} strokeWidth={2} />
      {label}
    </Link>
  );
}

export default function ExamCommandCenterPage() {
  return (
    <div style={{ minHeight: "100%", background: L.page, padding: "12px 20px 40px" }}>
      <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 16, padding: 24 }}>
        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 16 }}>
          <Link href="/dashboard" style={{ color: L.ink2, textDecoration: "none" }}>Dashboard</Link>
          <span style={{ color: L.ink3 }}>/</span>
          <Link href="/exams/command-center" style={{ color: L.ink2, textDecoration: "none" }}>Examinations</Link>
          <span style={{ color: L.ink3 }}>/</span>
          <span style={{ color: L.ink1, fontWeight: 600 }}>Command Center</span>
        </nav>

        {/* Hero */}
        <div style={{ marginBottom: 20 }}>
          <Eyebrow>Examination · AY 2026-27</Eyebrow>
          <h1 style={{ margin: "4px 0 6px", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, fontSize: 34 }}>
            <span style={{ fontFamily: "Georgia, serif", fontWeight: 900, color: L.ink1 }}>Organized by</span>
            <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: "italic", fontWeight: 500, color: L.purple }}>
              how often it changes.
            </span>
          </h1>
          <p style={{ fontSize: 13, color: L.ink2, lineHeight: 1.6, maxWidth: 640, margin: 0 }}>
            Configuration and grading barely change year to year. Scheduling changes every cycle.
            Five modules, grouped by that rhythm — not fourteen menu items in one flat list.
          </p>
        </div>

        {/* Stat tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 20 }}>
          <StatTile
            icon={AlertTriangle} iconColor={L.danger} iconBg={L.dangerSoft}
            label="Needs your action" value="1" valueColor={L.danger}
            note="module · 2 conflicts in Schedule & Logistics" noteColor={L.danger}
          />
          <StatTile
            icon={CheckSquare} iconColor={L.ok} iconBg={L.okSoft}
            label="Marks entered" value="88%" valueColor={L.ok}
            note="Periodic Test 1 · 14 pending in English" noteColor={L.ink2}
          />
          <StatTile
            icon={CheckCircle2} iconColor={L.ok} iconBg={L.okSoft}
            label="Ready to publish" value="1" valueColor={L.ink1}
            note="exam · Science Olympiad Quiz · published" noteColor={L.ink2}
          />
        </div>

        {/* Modules + sidebar */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: 20, alignItems: "start" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ModuleCard
              icon={Star} badge="Set once"
              title="Exam Configuration"
              descDot={L.ok}
              description="4 exam types · CBSE 9-point grading scale (A1-E2) · last edited 3 months ago"
              cta="Review configuration" ctaHref="/exams/exam-type" ctaVariant="outline"
            />
            <ModuleCard
              icon={Copy} badge="Per cycle"
              title="Exam Setup"
              descDot={L.warn}
              description="3 of 4 exams cloned from last term · Yearly Examination still needs setup"
              cta="Set up Yearly Examination" ctaHref="/exams/setup" ctaVariant="primary"
            />
            <ModuleCard
              icon={Calendar} badge="Every cycle"
              title="Schedule & Logistics"
              descDot={L.danger}
              description="2 conflicts in the Half-Yearly timetable · admit cards & seating wait on this"
              cta="Resolve conflicts" ctaHref="/exams/schedule" ctaVariant="danger"
            />
            <ModuleCard
              icon={User} badge="During exam"
              title="Conduct & Marks"
              descDot={L.ok}
              description="88% marks entered across 5 subjects · English still has 14 pending"
              cta="View entry status" ctaHref="/exams/marks-register-create" ctaVariant="outline"
            />
            <ModuleCard
              icon={Smartphone} badge="After marks are in"
              title="Results & Reports"
              descDot={L.ok}
              description="Periodic Test 1 · Mathematics 8A ready — 4 of 5 publish checks complete"
              cta="Go to results & reports" ctaHref="/exams/result-publish" ctaVariant="outline"
              span2
            />
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", border: `1px solid ${L.border}`, borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <Sparkles size={14} color={L.purple} strokeWidth={2} />
                <span style={{ fontSize: 13, fontWeight: 700, color: L.ink1 }}>Needs attention</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <AttentionItem
                  icon={AlertTriangle} color={L.danger} bg={L.dangerSoft}
                  title="Room 204 double-booked" sub="Half-Yearly · Sep 16, 10:00 AM"
                />
                <AttentionItem
                  icon={AlertTriangle} color={L.danger} bg={L.dangerSoft}
                  title="Invigilator clash — Ms. Iyer" sub="Half-Yearly · Sep 18, 9:00 AM"
                />
                <AttentionItem
                  icon={AlertCircle} color={L.warn} bg={L.warnSoft}
                  title="14 students missing marks" sub="Periodic Test 1 · English · Grade 7A"
                />
                <AttentionItem
                  icon={Info} color={L.info} bg={L.infoSoft}
                  title="3 results pending moderation" sub="Periodic Test 1 · Mathematics"
                />
              </div>
            </div>

            <div style={{ background: "#fff", border: `1px solid ${L.border}`, borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Plus size={14} color={L.ink2} strokeWidth={2} />
                <span style={{ fontSize: 13, fontWeight: 700, color: L.ink1 }}>Quick actions</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <QuickAction icon={Plus} label="New exam" href="/exams/setup" />
                <QuickAction icon={CheckSquare} label="Report card permissions" href="/exams/result-publish" />
                <QuickAction icon={Calendar} label="Room & invigilator roster" href="/exams/schedule" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
