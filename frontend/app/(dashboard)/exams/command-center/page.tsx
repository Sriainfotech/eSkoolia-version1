"use client";
/**
 * Examination · Command Center — landing hub for the Examination module.
 * Wired to the real backend (apps/exams/views.py::ExamCommandCenterSummaryAPIView,
 * a read-only KPI rollup over live ExamRoutine conflicts, ExamMarkRegister
 * completion and ExamResultPublish/ExamResultModerationFlag readiness) via
 * hooks/useExamsApi.ts — replaces the earlier static mockup. Colors match
 * components/academics/foundation/FoundationWorkspace.tsx (the app's
 * established light hero/card pattern) rather than a bespoke palette.
 */
import Link from "next/link";
import {
  Star, Copy, Calendar, User, Smartphone, AlertTriangle, AlertCircle,
  CheckSquare, CheckCircle2, Sparkles, Plus, Info,
} from "lucide-react";
import { useExamCommandCenterSummary, useExamTypes } from "@/hooks/useExamsApi";
import type { CommandCenterAttentionItem } from "@/types/exams";

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

function attentionIcon(severity: CommandCenterAttentionItem["severity"]) {
  if (severity === "danger") return { icon: AlertTriangle, color: L.danger, bg: L.dangerSoft };
  if (severity === "warn") return { icon: AlertCircle, color: L.warn, bg: L.warnSoft };
  return { icon: Info, color: L.info, bg: L.infoSoft };
}

export default function ExamCommandCenterPage() {
  const { data: summary, loading } = useExamCommandCenterSummary();
  const { data: examTypes } = useExamTypes();

  const examTypeCount = examTypes?.count ?? 0;
  const termTitle = summary?.current_exam_term?.title ?? "no exam in focus";
  const conflictCount = summary?.conflict_count ?? 0;
  const marksPercent = summary?.marks_entered_percent ?? 0;
  const readyCount = summary?.ready_to_publish_count ?? 0;
  const pendingModeration = summary?.pending_moderation_count ?? 0;

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
          <Eyebrow>Examination · {termTitle}</Eyebrow>
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
            label="Needs your action" value={loading ? "…" : String(summary?.needs_action_count ?? 0)} valueColor={L.danger}
            note={conflictCount > 0 ? `${conflictCount} conflict${conflictCount > 1 ? "s" : ""} in Schedule & Logistics` : "No conflicts detected"} noteColor={L.danger}
          />
          <StatTile
            icon={CheckSquare} iconColor={L.ok} iconBg={L.okSoft}
            label="Marks entered" value={loading ? "…" : `${marksPercent}%`} valueColor={L.ok}
            note={termTitle} noteColor={L.ink2}
          />
          <StatTile
            icon={CheckCircle2} iconColor={L.ok} iconBg={L.okSoft}
            label="Ready to publish" value={loading ? "…" : String(readyCount)} valueColor={L.ink1}
            note="class/section scope(s) fully entered, unmoderated-clear, unpublished" noteColor={L.ink2}
          />
        </div>

        {/* Modules + sidebar */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: 20, alignItems: "start" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ModuleCard
              icon={Star} badge="Set once"
              title="Exam Configuration"
              descDot={examTypeCount > 0 ? L.ok : L.warn}
              description={examTypeCount > 0 ? `${examTypeCount} exam type${examTypeCount > 1 ? "s" : ""} configured` : "No exam types configured yet"}
              cta="Review configuration" ctaHref="/exams/exam-type" ctaVariant="outline"
            />
            <ModuleCard
              icon={Copy} badge="Per cycle"
              title="Exam Setup"
              descDot={L.warn}
              description="Configure classes, subjects and mark distribution for each exam"
              cta="Go to Exam Setup" ctaHref="/exams/setup" ctaVariant="primary"
            />
            <ModuleCard
              icon={Calendar} badge="Every cycle"
              title="Schedule & Logistics"
              descDot={conflictCount > 0 ? L.danger : L.ok}
              description={conflictCount > 0 ? `${conflictCount} conflict${conflictCount > 1 ? "s" : ""} in the timetable` : "No scheduling conflicts detected"}
              cta={conflictCount > 0 ? "Resolve conflicts" : "Open schedule"} ctaHref="/exams/schedule" ctaVariant={conflictCount > 0 ? "danger" : "outline"}
            />
            <ModuleCard
              icon={User} badge="During exam"
              title="Conduct & Marks"
              descDot={marksPercent >= 100 ? L.ok : L.warn}
              description={`${marksPercent}% marks entered for ${termTitle}`}
              cta="View entry status" ctaHref="/exams/marks-register-create" ctaVariant="outline"
            />
            <ModuleCard
              icon={Smartphone} badge="After marks are in"
              title="Results & Reports"
              descDot={readyCount > 0 ? L.ok : L.warn}
              description={
                readyCount > 0
                  ? `${readyCount} class/section ready to publish`
                  : pendingModeration > 0
                    ? `${pendingModeration} result(s) pending moderation`
                    : "No sections ready to publish yet"
              }
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
                {loading && <div style={{ fontSize: 12, color: L.ink3 }}>Loading…</div>}
                {!loading && (summary?.needs_attention.length ?? 0) === 0 && (
                  <div style={{ fontSize: 12, color: L.ink3 }}>Nothing needs attention right now.</div>
                )}
                {(summary?.needs_attention ?? []).map((item, i) => {
                  const { icon, color, bg } = attentionIcon(item.severity);
                  return <AttentionItem key={i} icon={icon} color={color} bg={bg} title={item.title} sub={item.detail} />;
                })}
              </div>
            </div>

            <div style={{ background: "#fff", border: `1px solid ${L.border}`, borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Plus size={14} color={L.ink2} strokeWidth={2} />
                <span style={{ fontSize: 13, fontWeight: 700, color: L.ink1 }}>Quick actions</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <QuickAction icon={Plus} label="New exam setup" href="/exams/setup" />
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
