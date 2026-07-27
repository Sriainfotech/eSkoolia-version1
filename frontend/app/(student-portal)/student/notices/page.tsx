"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Bell } from "lucide-react";
import { fetchStudentNotices, type StudentNoticeItem } from "@/lib/api/student";

export default function StudentNoticesPage() {
  const [rows, setRows] = useState<StudentNoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStudentNotices()
      .then(setRows)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 28px" }}>Loading notices...</div>;
  }

  if (error) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center", background: "#fff", border: "1px solid var(--bd)", borderRadius: 14, padding: "40px 24px" }}>
        <AlertCircle size={32} color="var(--err)" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-1)", marginBottom: 6 }}>Could not load notices</p>
        <p style={{ fontSize: 13, color: "var(--ink-2)" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 28px 56px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Bell size={18} color="var(--ink-2)" />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--ink-1)" }}>Notices</h1>
      </div>

      {rows.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, padding: "18px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>
          No published notices for your role yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row) => (
            <article key={row.id} style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, padding: "14px 16px" }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink-1)" }}>{row.title}</h2>
              <p style={{ margin: "7px 0 9px", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>{row.message}</p>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span>Published: {row.publish_on ? new Date(row.publish_on).toLocaleDateString() : "-"}</span>
                <span>Notice date: {row.notice_date ? new Date(row.notice_date).toLocaleDateString() : "-"}</span>
                <span>By: {row.author || "School Office"}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
