"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CreditCard } from "lucide-react";
import { fetchStudentFees, type StudentFeesData } from "@/lib/api/student";

function inr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

export default function StudentFeesPage() {
  const [data, setData] = useState<StudentFeesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStudentFees()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 28px" }}>Loading fee summary...</div>;
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center", background: "#fff", border: "1px solid var(--bd)", borderRadius: 14, padding: "40px 24px" }}>
        <AlertCircle size={32} color="var(--err)" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-1)", marginBottom: 6 }}>Could not load fee data</p>
        <p style={{ fontSize: 13, color: "var(--ink-2)" }}>{error ?? "Unexpected error. Please refresh."}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 28px 56px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <CreditCard size={18} color="var(--ink-2)" />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--ink-1)" }}>Fees</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Total Assigned", value: inr(data.summary.total_assigned) },
          { label: "Total Paid", value: inr(data.summary.total_paid) },
          { label: "Outstanding", value: inr(data.summary.total_due) },
          { label: "Overdue Items", value: String(data.summary.overdue_count) },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{card.label}</div>
            <div style={{ fontSize: 21, fontWeight: 700, color: "var(--ink-1)", marginTop: 4 }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--bd)", fontSize: 13, fontWeight: 700, color: "var(--ink-1)" }}>
          Fee Assignments
        </div>
        {data.assignments.length === 0 ? (
          <div style={{ padding: "18px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>No assignments yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Fee Type</th>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Due Date</th>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Amount</th>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Due</th>
                </tr>
              </thead>
              <tbody>
                {data.assignments.map((row, idx) => (
                  <tr key={`${row.fee_type}-${row.due_date}-${idx}`}>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>{row.fee_type}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>{row.due_date ? new Date(row.due_date).toLocaleDateString() : "-"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>{inr(row.amount)}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>{inr(row.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--bd)", fontSize: 13, fontWeight: 700, color: "var(--ink-1)" }}>
          Payment History
        </div>
        {data.payments.length === 0 ? (
          <div style={{ padding: "18px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>No payments recorded yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Date</th>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Fee Type</th>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Amount</th>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Method</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((row, idx) => (
                  <tr key={`${row.reference}-${row.paid_at}-${idx}`}>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>{row.paid_at ? new Date(row.paid_at).toLocaleDateString() : "-"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>{row.fee_type || "-"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>{inr(row.amount_paid)}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>{row.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
