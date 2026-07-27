"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CalendarDays } from "lucide-react";
import { fetchStudentAttendance, type StudentAttendanceData } from "@/lib/api/student";

function statusLabel(code: string) {
  if (code === "P") return "Present";
  if (code === "A") return "Absent";
  if (code === "L") return "Late";
  if (code === "F") return "Half Day";
  if (code === "H") return "Holiday";
  return code;
}

export default function StudentAttendancePage() {
  const [data, setData] = useState<StudentAttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStudentAttendance()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 28px" }}>Loading attendance...</div>;
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center", background: "#fff", border: "1px solid var(--bd)", borderRadius: 14, padding: "40px 24px" }}>
        <AlertCircle size={32} color="var(--err)" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-1)", marginBottom: 6 }}>Could not load attendance</p>
        <p style={{ fontSize: 13, color: "var(--ink-2)" }}>{error ?? "Unexpected error. Please refresh."}</p>
      </div>
    );
  }

  const s = data.summary_last_30_days;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 28px 56px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <CalendarDays size={18} color="var(--ink-2)" />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--ink-1)" }}>Attendance</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Attendance %", value: s.pct == null ? "-" : `${s.pct}%` },
          { label: "Present", value: String(s.present) },
          { label: "Late", value: String(s.late) },
          { label: "Absent", value: String(s.absent) },
          { label: "Half Day", value: String(s.half_day) },
          { label: "Marked Days", value: String(s.total) },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{card.label}</div>
            <div style={{ fontSize: 21, fontWeight: 700, color: "var(--ink-1)", marginTop: 4 }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--bd)", fontSize: 13, fontWeight: 700, color: "var(--ink-1)" }}>
          Recent Entries
        </div>
        {data.recent_records.length === 0 ? (
          <div style={{ padding: "18px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>No attendance records yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Date</th>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Status</th>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_records.map((row) => (
                  <tr key={`${row.date}-${row.status}-${row.notes}`}>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>{new Date(row.date).toLocaleDateString()}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>{statusLabel(row.status)}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-2)", borderBottom: "1px solid #f1f5f9" }}>{row.notes || "-"}</td>
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
