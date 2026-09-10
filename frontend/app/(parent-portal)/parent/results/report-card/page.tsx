"use client";

/**
 * Parent Portal — Report Card
 *
 * One row per subject per term with grade + pass/fail, computed
 * server-side (ParentReportCardView) from ExamGradeScale.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";
import { useParentChild } from "@/contexts/ParentChildContext";
import { fetchChildReportCard, type ChildReportCard } from "@/lib/api/parent";

function Skeleton({ h = 16 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 8, background: "var(--bg-2)" }} />;
}

const PASS_FAIL_CFG: Record<string, { color: string; bg: string }> = {
  Pass: { color: "var(--ok)", bg: "var(--ok-soft)" },
  Fail: { color: "var(--danger)", bg: "var(--danger-soft)" },
  Absent: { color: "var(--ink-3)", bg: "var(--bg-2)" },
};

export default function ParentReportCardPage() {
  const { children, selectedChild, setSelectedChildId, loading: ctxLoading } = useParentChild();
  const [data, setData] = useState<ChildReportCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!selectedChild) return;
    setLoading(true);
    setError(false);
    fetchChildReportCard(selectedChild.id).then(setData).catch(() => setError(true)).finally(() => setLoading(false));
  }, [selectedChild?.id]);

  useEffect(() => { load(); }, [load]);

  const byTerm = new Map<string, ChildReportCard["rows"]>();
  (data?.rows ?? []).forEach((r) => {
    if (!byTerm.has(r.term)) byTerm.set(r.term, []);
    byTerm.get(r.term)!.push(r);
  });

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 18, boxShadow: "var(--sh-1)", padding: "28px 30px" }}>
      <div style={{ marginBottom: 22, paddingBottom: 20, borderBottom: "1px solid var(--bd)" }}>
        <Link href="/parent/results" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--ink-3)", textDecoration: "none", marginBottom: 10 }}>
          <ArrowLeft size={13} /> Back to Results
        </Link>
        <h1 style={{ fontSize: 34, fontWeight: 600, color: "var(--ink-1)", margin: "0 0 5px", lineHeight: 1.05, letterSpacing: "-0.03em", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          Report{" "}
          <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "var(--pu)", fontSize: 38, letterSpacing: "-0.02em" }}>Card</em>
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55 }}>Grades and pass/fail status per subject, per term.</p>
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
          Could not load the report card. Please refresh.
        </div>
      )}

      {(loading || ctxLoading) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[1, 2].map((i) => <Skeleton key={i} h={140} />)}
        </div>
      ) : byTerm.size === 0 ? (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--bd)", borderRadius: 12, padding: 40, textAlign: "center" }}>
          <FileText size={28} color="var(--ink-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)", marginBottom: 4 }}>No report card yet</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>This fills in once results are published for a term.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[...byTerm.entries()].map(([term, rows]) => (
            <div key={term} style={{ border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--bd)", background: "var(--bg-2)", fontSize: 13, fontWeight: 700, color: "var(--ink-1)" }}>{term}</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#FAFAFA" }}>
                    {["Subject", "Obtained", "Full Marks", "Grade", "Status"].map((h, i) => (
                      <th key={h} style={{ padding: "9px 16px", textAlign: i >= 1 ? "right" : "left", fontWeight: 600, color: "var(--ink-3)", borderBottom: "1px solid var(--bd)", fontSize: 11.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const cfg = PASS_FAIL_CFG[r.pass_fail] ?? PASS_FAIL_CFG.Absent;
                    return (
                      <tr key={idx} style={{ borderBottom: idx < rows.length - 1 ? "1px solid var(--bd)" : "none" }}>
                        <td style={{ padding: "11px 16px", color: "var(--ink-1)", fontWeight: 500 }}>{r.subject}</td>
                        <td style={{ padding: "11px 16px", textAlign: "right", fontWeight: 600, color: "var(--ink-1)" }}>{r.pass_fail === "Absent" ? "—" : r.obtained}</td>
                        <td style={{ padding: "11px 16px", textAlign: "right", color: "var(--ink-2)" }}>{r.full_marks}</td>
                        <td style={{ padding: "11px 16px", textAlign: "right", fontWeight: 700, color: "var(--pu)" }}>{r.grade || "—"}</td>
                        <td style={{ padding: "11px 16px", textAlign: "right" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, padding: "3px 9px", borderRadius: 20 }}>{r.pass_fail}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
