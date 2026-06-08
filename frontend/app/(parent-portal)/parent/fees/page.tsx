"use client";

import { useEffect, useState, useCallback } from "react";
import { CreditCard, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useParentChild } from "@/contexts/ParentChildContext";
import { fetchChildFees, type ChildFees, type FeeItem } from "@/lib/api/parent";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ status }: { status: FeeItem["status"] }) {
  const cfg = {
    paid:    { label: "Paid",    color: "var(--ok)",  bg: "rgba(34,197,94,0.1)",  icon: CheckCircle2 },
    partial: { label: "Partial", color: "#D97706",    bg: "#FFFBEB",              icon: Clock },
    unpaid:  { label: "Unpaid",  color: "#DC2626",    bg: "#FEF2F2",              icon: AlertCircle },
  }[status];
  const Icon = cfg.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg }}>
      <Icon size={10} strokeWidth={2} />{cfg.label}
    </span>
  );
}

function Skeleton({ h = 16, w = "100%" }: { h?: number; w?: string | number }) {
  return (
    <div style={{ height: h, width: w, borderRadius: 8, backgroundImage: "linear-gradient(90deg,var(--line,#dbe4f0) 25%,var(--bg-2,#f5f5fb) 50%,var(--line,#dbe4f0) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s ease-in-out infinite" }} />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FeesPage() {
  const { children, selectedChild, setSelectedChildId, loading: ctxLoading } = useParentChild();
  const [data, setData] = useState<ChildFees | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!selectedChild) return;
    setLoading(true);
    setError(false);
    fetchChildFees(selectedChild.id)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [selectedChild?.id]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary;

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 18, boxShadow: "var(--sh-1)", padding: "28px 30px" }}>

      {/* Header */}
      <div style={{ marginBottom: 22, paddingBottom: 20, borderBottom: "1px solid var(--bd)" }}>
        <h1 style={{ fontSize: 34, fontWeight: 600, color: "var(--ink-1)", margin: "0 0 5px", lineHeight: 1.05, letterSpacing: "-0.03em", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          Fee{" "}
          <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "var(--pu)", fontSize: 38, letterSpacing: "-0.02em" }}>
            Summary
          </em>
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55 }}>
          Fee assignments, payment status, and outstanding dues.
        </p>
      </div>

      {/* Child tabs */}
      {children.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
          {children.map((c) => {
            const sel = c.id === selectedChild?.id;
            const initials = c.name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
            return (
              <button key={c.id} onClick={() => setSelectedChildId(c.id)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 24, border: `1.5px solid ${sel ? "var(--pu)" : "var(--bd)"}`, background: sel ? "var(--pu-soft)" : "#fff", color: sel ? "var(--pu)" : "var(--ink-2)", fontSize: 13, fontWeight: sel ? 600 : 400, cursor: "pointer" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: sel ? "var(--pu)" : "var(--pu-soft)", color: sel ? "#fff" : "var(--pu)", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700 }}>{initials}</div>
                <span>{c.name.split(" ")[0]}</span>
                {c.class_name && <span style={{ fontSize: 11, opacity: 0.7 }}>{c.class_name}</span>}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", color: "#B91C1C", fontSize: 13, marginBottom: 20 }}>
          Could not load fee data. Please refresh.
        </div>
      )}

      {/* Summary bar */}
      {(loading || ctxLoading) ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
          {[1,2,3].map(i => <Skeleton key={i} h={80} />)}
        </div>
      ) : summary && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Total Billed", value: summary.total_billed, color: "var(--ink-1)", bg: "var(--bg-2)", icon: CreditCard },
            { label: "Total Paid",   value: summary.total_paid,   color: "var(--ok)",  bg: "rgba(34,197,94,0.08)", icon: CheckCircle2 },
            { label: "Outstanding",  value: summary.total_due,    color: summary.total_due > 0 ? "#DC2626" : "var(--ok)", bg: summary.total_due > 0 ? "#FEF2F2" : "rgba(34,197,94,0.08)", icon: summary.total_due > 0 ? AlertCircle : CheckCircle2 },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div key={label} style={{ border: "1px solid var(--bd)", borderRadius: 14, padding: "16px 18px", background: bg }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <Icon size={14} color={color} strokeWidth={1.8} />
                <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>{label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{fmtCurrency(value)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Fee groups */}
      {(loading || ctxLoading) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {[1,2].map(i => <Skeleton key={i} h={180} />)}
        </div>
      ) : data?.groups && data.groups.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {data.groups.map((group) => {
            const groupDue = group.items.reduce((s, i) => s + i.due_amount, 0);
            return (
              <div key={group.group_name} style={{ border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--bd)", background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-1)" }}>{group.group_name}</span>
                  {groupDue > 0 && (
                    <span style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>
                      {fmtCurrency(groupDue)} due
                    </span>
                  )}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#FAFAFA" }}>
                      {["Fee Type", "Due Date", "Amount", "Paid", "Due", "Status"].map((h, i) => (
                        <th key={h} style={{ padding: "9px 16px", textAlign: i >= 2 ? "right" : "left", fontWeight: 600, color: "var(--ink-3)", borderBottom: "1px solid var(--bd)", fontSize: 11.5 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: idx < group.items.length - 1 ? "1px solid var(--bd)" : "none" }}>
                        <td style={{ padding: "11px 16px", color: "var(--ink-1)", fontWeight: 500 }}>{item.fee_name}</td>
                        <td style={{ padding: "11px 16px", color: "var(--ink-3)", fontSize: 12 }}>
                          {new Date(item.due_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td style={{ padding: "11px 16px", textAlign: "right", color: "var(--ink-2)" }}>{fmtCurrency(item.net_amount)}</td>
                        <td style={{ padding: "11px 16px", textAlign: "right", color: "var(--ok)", fontWeight: 500 }}>{fmtCurrency(item.paid_amount)}</td>
                        <td style={{ padding: "11px 16px", textAlign: "right", color: item.due_amount > 0 ? "#DC2626" : "var(--ink-3)", fontWeight: item.due_amount > 0 ? 700 : 400 }}>{fmtCurrency(item.due_amount)}</td>
                        <td style={{ padding: "11px 16px", textAlign: "right" }}><StatusBadge status={item.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ) : !loading && !ctxLoading && (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--bd)", borderRadius: 12, padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
          No fee records found for this child.
        </div>
      )}
    </div>
  );
}
