"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Trophy } from "lucide-react";
import { fetchStudentResults, type StudentResultsData } from "@/lib/api/student";

export default function StudentResultsPage() {
  const [data, setData] = useState<StudentResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStudentResults()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 28px" }}>Loading results...</div>;
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center", background: "#fff", border: "1px solid var(--bd)", borderRadius: 14, padding: "40px 24px" }}>
        <AlertCircle size={32} color="var(--err)" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-1)", marginBottom: 6 }}>Could not load results</p>
        <p style={{ fontSize: 13, color: "var(--ink-2)" }}>{error ?? "Unexpected error. Please refresh."}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 28px 56px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Trophy size={18} color="var(--ink-2)" />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--ink-1)" }}>Results</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Overall %", value: data.overall.overall_pct == null ? "-" : `${data.overall.overall_pct}%` },
          { label: "Total Obtained", value: data.overall.total_obtained.toFixed(1) },
          { label: "Total Full Marks", value: data.overall.total_full_marks.toFixed(1) },
          { label: "Paper Count", value: String(data.overall.subjects_count) },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{card.label}</div>
            <div style={{ fontSize: 21, fontWeight: 700, color: "var(--ink-1)", marginTop: 4 }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--bd)", fontSize: 13, fontWeight: 700, color: "var(--ink-1)" }}>
          Recent Marks
        </div>
        {data.marks.length === 0 ? (
          <div style={{ padding: "18px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>No marks published yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Exam</th>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Subject</th>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Score</th>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {data.marks.map((row, idx) => (
                  <tr key={`${row.exam}-${row.subject}-${idx}`}>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>
                      <div>{row.exam || "-"}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{row.term || ""}</div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>{row.subject || "-"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>
                      {row.absent ? "Absent" : `${row.obtained} / ${row.full_marks}`}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>
                      {row.absent || row.score_pct == null ? "-" : `${row.score_pct}%`}
                    </td>
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
