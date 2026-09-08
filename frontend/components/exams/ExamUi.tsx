"use client";
/**
 * Small shared pieces for the Examination module's regrouped static pages
 * (Conduct & Marks, Results & Reports, ...). Keeps the accordion-by-grade /
 * status-badge / exam-picker pattern consistent instead of re-implementing
 * it per page. Palette from lib/examTheme.ts.
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { examTheme as T } from "@/lib/examTheme";

export type Tone = "ok" | "warn" | "danger" | "info" | "neutral" | "purple";

const TONE_COLORS: Record<Tone, [string, string]> = {
  ok: [T.ok, T.okSoft],
  warn: [T.warn, T.warnSoft],
  danger: [T.danger, T.dangerSoft],
  info: [T.info, T.infoSoft],
  neutral: [T.ink2, T.hoverSoft],
  purple: [T.purple, T.purpleSoft],
};

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  const [color, bg] = TONE_COLORS[tone];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export function Accordion({ icon: Icon, title, right, defaultOpen, children }: {
  icon?: React.ElementType; title: React.ReactNode; right?: React.ReactNode; defaultOpen?: boolean; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
      <button
        type="button" onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        {Icon && <Icon size={14} color={T.ink2} strokeWidth={2} />}
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: T.ink1 }}>{title}</span>
        {right}
        <ChevronDown size={15} color={T.ink3} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }} />
      </button>
      {open && <div style={{ borderTop: `1px solid ${T.border}`, padding: 14 }}>{children}</div>}
    </div>
  );
}

export function ExamPicker({ icon: Icon, value, options, onChange, note }: {
  icon: React.ElementType; value: string; options: string[]; onChange: (v: string) => void; note: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={14} color={T.purple} />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
          Now entering & viewing data for
        </span>
      </div>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        style={{ height: 34, borderRadius: 8, border: `1px solid ${T.borderStrong}`, padding: "0 10px", fontSize: 13, fontWeight: 600, color: T.ink1, background: "#fff" }}
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
      <span style={{ fontSize: 11.5, color: T.purple, flex: 1, minWidth: 200 }}>{note}</span>
    </div>
  );
}

export function StepPills({ step, setStep, steps }: {
  step: number; setStep: (n: number) => void; steps: string[];
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <button
            key={label} type="button" onClick={() => setStep(n)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              height: 30, padding: "0 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer",
              border: `1px solid ${active ? T.purple : done ? T.ok : T.borderStrong}`,
              background: active ? T.purple : done ? T.okSoft : "#fff",
              color: active ? "#fff" : done ? T.ok : T.ink3,
            }}
          >
            {done && "✓"} Step {n} · {label}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({ value, color = T.purple, bg = T.hoverSoft }: { value: number; color?: string; bg?: string }) {
  return (
    <div style={{ width: "100%", height: 6, borderRadius: 999, background: bg, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, Math.max(0, value))}%`, height: "100%", background: color, borderRadius: 999 }} />
    </div>
  );
}
