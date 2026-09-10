"use client";

/**
 * Parent Portal — Homework
 *
 * Read-only view of the child's homework, each row showing the teacher's
 * grading (if recorded) via the nested `submission` object.
 */

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Calendar, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useParentChild } from "@/contexts/ParentChildContext";
import { fetchChildHomework, type ChildHomeworkItem } from "@/lib/api/parent";

function Skeleton({ h = 16 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 8, background: "var(--bg-2)" }} />;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  C: { label: "Completed", color: "var(--ok)", bg: "var(--ok-soft)", icon: CheckCircle2 },
  I: { label: "Incomplete", color: "var(--warn)", bg: "var(--warn-soft)", icon: AlertCircle },
  P: { label: "Pending", color: "var(--ink-3)", bg: "var(--bg-2)", icon: Clock },
};

export default function ParentHomeworkPage() {
  const { children, selectedChild, setSelectedChildId, loading: ctxLoading } = useParentChild();
  const [items, setItems] = useState<ChildHomeworkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!selectedChild) return;
    setLoading(true);
    setError(false);
    fetchChildHomework(selectedChild.id).then(setItems).catch(() => setError(true)).finally(() => setLoading(false));
  }, [selectedChild?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 18, boxShadow: "var(--sh-1)", padding: "28px 30px" }}>
      <div style={{ marginBottom: 22, paddingBottom: 20, borderBottom: "1px solid var(--bd)" }}>
        <h1 style={{ fontSize: 34, fontWeight: 600, color: "var(--ink-1)", margin: "0 0 5px", lineHeight: 1.05, letterSpacing: "-0.03em", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          Homework{" "}
          <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "#15803D", fontSize: 38, letterSpacing: "-0.02em" }}>Tracker</em>
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55 }}>Assignments and grading for your child&rsquo;s current class.</p>
      </div>

      {children.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
          {children.map((c) => {
            const sel = c.id === selectedChild?.id;
            const initials = c.name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
            return (
              <button key={c.id} onClick={() => setSelectedChildId(c.id)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 24, border: `1.5px solid ${sel ? "var(--pu)" : "var(--bd)"}`, background: sel ? "var(--pu-soft)" : "#fff", color: sel ? "var(--pu)" : "var(--ink-2)", fontSize: 13, fontWeight: sel ? 600 : 400, cursor: "pointer" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: sel ? "var(--pu)" : "var(--pu-soft)", color: sel ? "#fff" : "var(--pu)", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700 }}>{initials}</div>
                <span>{c.name.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", color: "#B91C1C", fontSize: 13, marginBottom: 20 }}>
          Could not load homework. Please refresh.
        </div>
      )}

      {(loading || ctxLoading) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} h={92} />)}
        </div>
      ) : items.length === 0 ? (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--bd)", borderRadius: 12, padding: 40, textAlign: "center" }}>
          <BookOpen size={28} color="var(--ink-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)", marginBottom: 4 }}>No homework recorded yet</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>New assignments from your child&rsquo;s teachers will appear here.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((h) => {
            const cfg = h.submission ? STATUS_CFG[h.submission.complete_status] : null;
            const Icon = cfg?.icon ?? Clock;
            return (
              <div key={h.id} style={{ border: "1px solid var(--bd)", borderRadius: 14, padding: "16px 18px", display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#F0FDF4", display: "grid", placeItems: "center", flex: "none" }}>
                  <BookOpen size={18} color="#15803D" strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-1)" }}>{h.subject}</span>
                    {h.section_name && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{h.section_name}</span>}
                    {cfg && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, padding: "3px 9px", borderRadius: 20 }}>
                        <Icon size={11} /> {cfg.label}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>{h.description}</p>
                  <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: "var(--ink-3)", flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} /> Assigned {fmtDate(h.homework_date)}</span>
                    <span>Due {fmtDate(h.submission_date)}</span>
                    {h.submission?.marks != null && <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>Scored {h.submission.marks}{h.marks ? `/${h.marks}` : ""}</span>}
                  </div>
                  {h.submission?.note && (
                    <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-2)", background: "var(--bg-2)", borderRadius: 8, padding: "8px 10px" }}>
                      <strong style={{ color: "var(--ink-1)" }}>Teacher note:</strong> {h.submission.note}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
