"use client";

import { useExamFocus } from "@/contexts/ExamFocusContext";
import { examTheme as T } from "@/lib/examTheme";

export interface ExamFocusOption {
  id: number;
  title: string;
}

const selectSx: React.CSSProperties = {
  height: 34, borderRadius: 8, border: `1px solid ${T.borderStrong}`,
  padding: "0 10px", fontSize: 13, fontWeight: 600, color: T.ink1, background: "#fff", outline: "none",
};

/**
 * The exam picked here is shared module-wide (see contexts/ExamFocusContext.tsx) —
 * every page renders this same bar bound to the same context instead of keeping
 * its own local "which exam" state, so switching pages no longer resets the choice.
 * Each page still fetches and owns its own `options` list (already does, via its
 * existing criteria hook) — this component only binds the *selected value*.
 */
export function ExamContextBar({
  icon: Icon,
  options,
  status,
  note,
}: {
  icon?: React.ElementType;
  options: ExamFocusOption[];
  status?: React.ReactNode;
  note?: string;
}) {
  const { examTypeId, setExamTypeId, hydrated } = useExamFocus();

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1px solid ${T.border}`,
      borderRadius: 12, padding: "12px 16px", marginBottom: 16, flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {Icon && <Icon size={14} color={T.purple} />}
        <span style={{ fontSize: 10.5, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
          Exam in focus
        </span>
      </div>
      <select
        value={hydrated ? examTypeId ?? "" : ""}
        onChange={(e) => setExamTypeId(e.target.value ? Number(e.target.value) : null)}
        style={selectSx}
      >
        <option value="">Select exam</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.title}</option>
        ))}
      </select>
      {status && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{status}</div>}
      {note && <span style={{ fontSize: 11.5, color: T.purple, flex: 1, minWidth: 160 }}>{note}</span>}
    </div>
  );
}

const chipTones: Record<"ok" | "warn" | "neutral", [string, string]> = {
  ok: [T.ok, T.okSoft],
  warn: [T.warn, T.warnSoft],
  neutral: [T.ink2, T.hoverSoft],
};

/** A small real-data status pill for the bar's `status` slot — e.g. "Marks entered: 62%". */
export function ExamFocusStatusChip({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "ok" | "warn" | "neutral" }) {
  const [color, bg] = chipTones[tone];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>
      {label}: {value}
    </span>
  );
}
