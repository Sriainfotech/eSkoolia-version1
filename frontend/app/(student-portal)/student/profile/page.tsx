"use client";

import { useEffect, useState } from "react";
import { AlertCircle, User } from "lucide-react";
import { fetchStudentProfile, type StudentProfileData } from "@/lib/api/student";

function fieldRow(label: string, value?: string | null) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{label}</span>
      <span style={{ fontSize: 12.5, color: "var(--ink-1)", fontWeight: 600, textAlign: "right" }}>{value || "-"}</span>
    </div>
  );
}

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStudentProfile()
      .then(setProfile)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 28px" }}>Loading profile...</div>;
  }

  if (error || !profile) {
    return (
      <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center", background: "#fff", border: "1px solid var(--bd)", borderRadius: 14, padding: "40px 24px" }}>
        <AlertCircle size={32} color="var(--err)" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-1)", marginBottom: 6 }}>Could not load profile</p>
        <p style={{ fontSize: 13, color: "var(--ink-2)" }}>{error ?? "Unexpected error. Please refresh."}</p>
      </div>
    );
  }

  const address = [
    profile.address.address_line,
    profile.address.city,
    profile.address.district,
    profile.address.state,
    profile.address.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 28px 56px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <User size={18} color="var(--ink-2)" />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--ink-1)" }}>Profile</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        <section style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, padding: "12px 14px" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "var(--ink-1)" }}>Student Details</h2>
          {fieldRow("Name", profile.name)}
          {fieldRow("Admission No", profile.admission_no)}
          {fieldRow("Roll No", profile.roll_no)}
          {fieldRow("Class", profile.class_section)}
          {fieldRow("Academic Year", profile.academic_year)}
          {fieldRow("Date of Birth", profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : "-")}
          {fieldRow("Gender", profile.gender)}
          {fieldRow("Blood Group", profile.blood_group)}
        </section>

        <section style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, padding: "12px 14px" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "var(--ink-1)" }}>Contact & Transport</h2>
          {fieldRow("Phone", profile.phone)}
          {fieldRow("Email", profile.email)}
          {fieldRow("Address", address)}
          {fieldRow("School", profile.school_name)}
          {fieldRow("Route", profile.transport.route)}
          {fieldRow("Vehicle", profile.transport.vehicle)}
        </section>
      </div>

      <section style={{ marginTop: 12, background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, padding: "12px 14px" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "var(--ink-1)" }}>Guardian</h2>
        {!profile.guardian ? (
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Guardian details are not linked yet.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
            <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Name</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-1)", marginTop: 4 }}>{profile.guardian.name || "-"}</div>
            </div>
            <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Relation</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-1)", marginTop: 4 }}>{profile.guardian.relation || "-"}</div>
            </div>
            <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Phone</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-1)", marginTop: 4 }}>{profile.guardian.phone || "-"}</div>
            </div>
            <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-1)", marginTop: 4 }}>{profile.guardian.email || "-"}</div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
