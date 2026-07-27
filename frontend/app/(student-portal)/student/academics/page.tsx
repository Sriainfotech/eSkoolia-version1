"use client";

import { useEffect, useState } from "react";
import { AlertCircle, GraduationCap } from "lucide-react";
import { fetchStudentAcademics, type StudentAcademicsData } from "@/lib/api/student";

export default function StudentAcademicsPage() {
  const [data, setData] = useState<StudentAcademicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStudentAcademics()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 28px" }}>Loading academics...</div>;
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center", background: "#fff", border: "1px solid var(--bd)", borderRadius: 14, padding: "40px 24px" }}>
        <AlertCircle size={32} color="var(--err)" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-1)", marginBottom: 6 }}>Could not load academics</p>
        <p style={{ fontSize: 13, color: "var(--ink-2)" }}>{error ?? "Unexpected error. Please refresh."}</p>
      </div>
    );
  }

  const classSection = [data.class_name, data.section_name].filter(Boolean).join("-") || "-";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 28px 56px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <GraduationCap size={18} color="var(--ink-2)" />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--ink-1)" }}>Academics</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Class-Section", value: classSection },
          { label: "Academic Year", value: data.academic_year || "-" },
          { label: "Subjects", value: String(data.subjects.length) },
          { label: "Upcoming Papers", value: String(data.upcoming_exams.length) },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink-1)", marginTop: 4 }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-1)", marginBottom: 8 }}>Subjects</div>
        {data.subjects.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Subjects will appear here once marks or schedules are available.</div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {data.subjects.map((subject) => (
              <span key={subject} style={{ padding: "5px 10px", borderRadius: 20, border: "1px solid var(--bd)", background: "var(--bg-1)", fontSize: 12, color: "var(--ink-2)" }}>
                {subject}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--bd)", fontSize: 13, fontWeight: 700, color: "var(--ink-1)" }}>
          Upcoming Exams
        </div>
        {data.upcoming_exams.length === 0 ? (
          <div style={{ padding: "18px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>No upcoming exams found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Exam</th>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Subject</th>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Date</th>
                  <th style={{ textAlign: "left", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {data.upcoming_exams.map((row, idx) => (
                  <tr key={`${row.exam}-${row.subject}-${row.date}-${idx}`}>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>{row.exam || "-"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>{row.subject || "-"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>{row.date ? new Date(row.date).toLocaleDateString() : "-"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-1)", borderBottom: "1px solid #f1f5f9" }}>{row.start_time && row.end_time ? `${row.start_time} - ${row.end_time}` : "-"}</td>
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
