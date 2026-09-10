"use client";

/**
 * Parent Portal — Exam Results
 *
 * Marks grouped by term, published exams only. Links to the Report Card
 * view for the per-subject grade/pass-fail grid.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, FileText } from "lucide-react";
import { useParentChild } from "@/contexts/ParentChildContext";
import { fetchChildResults, type ChildResults } from "@/lib/api/parent";

function Skeleton({ h = 16 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 8, background: "var(--bg-2)" }} />;
}

function pctColor(obtained: number, full: number, pass: number, absent: boolean) {
  if (absent) return { color: "var(--ink-3)", bg: "var(--bg-2)" };
  if (obtained < pass) return { color: "var(--danger)", bg: "var(--danger-soft)" };
  const pct = full > 0 ? (obtained / full) * 100 : 0;
  if (pct >= 75) return { color: "var(--ok)", bg: "var(--ok-soft)" };
  return { color: "var(--warn)", bg: "var(--warn-soft)" };
}

export default function ParentResultsPage() {
  const { children, selectedChild, setSelectedChildId, loading: ctxLoading } = useParentChild();
  const [data, setData] = useState<ChildResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!selectedChild) return;
    setLoading(true);
    setError(false);
    fetchChildResults(selectedChild.id).then(setData).catch(() => setError(true)).finally(() => setLoading(false));
  }, [selectedChild?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 18, boxShadow: "var(--sh-1)", padding: "28px 30px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22, paddingBottom: 20, borderBottom: "1px solid var(--bd)" }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 600, color: "var(--ink-1)", margin: "0 0 5px", lineHeight: 1.05, letterSpacing: "-0.03em", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            Exam{" "}
            <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "var(--pu)", fontSize: 38, letterSpacing: "-0.02em" }}>Results</em>
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55 }}>Published results only, grouped by term.</p>
        </div>
        <Link href="/parent/results/report-card"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "1px solid var(--bd)", background: "var(--bg-1)", color: "var(--ink-2)", fontSize: 13, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
          <FileText size={15} /> Report Card
        </Link>
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
          Could not load results. Please refresh.
        </div>
      )}

      {(loading || ctxLoading) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[1, 2].map((i) => <Skeleton key={i} h={140} />)}
        </div>
      ) : !data || data.terms.length === 0 ? (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--bd)", borderRadius: 12, padding: 40, textAlign: "center" }}>
          <Trophy size={28} color="var(--ink-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)", marginBottom: 4 }}>No published results yet</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Results appear here once the school publishes them.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {data.terms.map((term) => (
            <div key={term.term} style={{ border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--bd)", background: "var(--bg-2)", fontSize: 13, fontWeight: 700, color: "var(--ink-1)" }}>{term.term}</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#FAFAFA" }}>
                    {["Subject", "Exam", "Obtained", "Full Marks", ""].map((h, i) => (
                      <th key={h} style={{ padding: "9px 16px", textAlign: i >= 2 ? "right" : "left", fontWeight: 600, color: "var(--ink-3)", borderBottom: "1px solid var(--bd)", fontSize: 11.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {term.marks.map((m, idx) => {
                    const c = pctColor(m.obtained, m.full_marks, m.pass_marks, m.absent);
                    return (
                      <tr key={idx} style={{ borderBottom: idx < term.marks.length - 1 ? "1px solid var(--bd)" : "none" }}>
                        <td style={{ padding: "11px 16px", color: "var(--ink-1)", fontWeight: 500 }}>{m.subject}</td>
                        <td style={{ padding: "11px 16px", color: "var(--ink-3)", fontSize: 12 }}>{m.exam_name}</td>
                        <td style={{ padding: "11px 16px", textAlign: "right", fontWeight: 600, color: "var(--ink-1)" }}>{m.absent ? "Absent" : m.obtained}</td>
                        <td style={{ padding: "11px 16px", textAlign: "right", color: "var(--ink-2)" }}>{m.full_marks}</td>
                        <td style={{ padding: "11px 16px", textAlign: "right" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: c.color, background: c.bg, padding: "3px 9px", borderRadius: 20 }}>
                            {m.absent ? "Absent" : m.obtained >= m.pass_marks ? "Pass" : "Fail"}
                          </span>
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
