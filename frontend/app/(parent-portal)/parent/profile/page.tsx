"use client";

/**
 * Parent Portal — My Profile
 *
 * Shows the onboarding-captured data for each of the guardian's children
 * (personal info, address, background, admission details, identity
 * documents, physical/medical info, and linked guardians) — the data
 * recorded during admission, not academic performance (that's the
 * existing /parent/children page).
 *
 * Multi-child support reuses the same useParentChild() sibling-switcher
 * already used by /parent/children — single source of truth for "which
 * child am I viewing", persisted across pages.
 */

import { useEffect, useState } from "react";
import { User, MapPin, Globe2, GraduationCap, IdCard, HeartPulse, Users, type LucideIcon } from "lucide-react";
import { useParentChild } from "@/contexts/ParentChildContext";
import { fetchChildDetail, type ChildDetail } from "@/lib/api/parent";

const cardStyle: React.CSSProperties = {
  background: "var(--bg-1,#fff)",
  border: "1px solid var(--bd)",
  borderRadius: 14,
  padding: "20px 22px",
  marginBottom: 16,
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--ink-3)" }}>
        {label}
      </div>
      <div style={{ fontSize: 13.5, color: "var(--ink-1)", marginTop: 3 }}>{value || "—"}</div>
    </div>
  );
}

function ListField({ label, values }: { label: string; values?: string[] }) {
  return <Field label={label} value={values && values.length > 0 ? values.join(", ") : null} />;
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ color: "var(--pu, #6D4AFF)" }}>
          <Icon size={16} />
        </span>
        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 650, color: "var(--ink-1)" }}>{title}</h3>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px 20px" }}>{children}</div>
    </div>
  );
}

export default function ParentProfilePage() {
  const { children: siblings, selectedChild, setSelectedChildId, loading: siblingsLoading } = useParentChild();
  const [detail, setDetail] = useState<ChildDetail | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedChild) return;
    setDetail(null);
    setError(false);
    setLoading(true);
    fetchChildDetail(selectedChild.id)
      .then(setDetail)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [selectedChild?.id]);

  return (
    <div style={{ background: "var(--bg-1,#fff)", border: "1px solid var(--bd)", borderRadius: 18, boxShadow: "var(--sh-1)", padding: "28px 30px" }}>
      {/* Header */}
      <div style={{ marginBottom: 22, paddingBottom: 20, borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--ink-1)", margin: "0 0 5px" }}>My Profile</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
            The details recorded during admission for each of your children.
          </p>
        </div>
        {siblings.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, border: "1px solid var(--bd)", background: "var(--bg-2)", flexShrink: 0 }}>
            <Users size={13} color="var(--ink-3)" />
            <span style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 500 }}>
              {siblings.length} {siblings.length === 1 ? "child" : "children"} enrolled
            </span>
          </div>
        )}
      </div>

      {/* Sibling tabs — identical pattern to /parent/children */}
      {siblings.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
          {siblings.map((c) => {
            const isSelected = c.id === selectedChild?.id;
            const initials = c.name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
            return (
              <button
                key={c.id}
                onClick={() => setSelectedChildId(c.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "7px 16px",
                  borderRadius: 24, border: `1.5px solid ${isSelected ? "var(--pu)" : "var(--bd)"}`,
                  background: isSelected ? "var(--pu-soft)" : "#fff",
                  color: isSelected ? "var(--pu)" : "var(--ink-2)",
                  fontSize: 13, fontWeight: isSelected ? 600 : 400, cursor: "pointer",
                }}
              >
                {c.photo_url ? (
                  <img src={c.photo_url} alt={c.name} style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: isSelected ? "var(--pu)" : "var(--pu-soft)", color: isSelected ? "#fff" : "var(--pu)", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700 }}>
                    {initials}
                  </div>
                )}
                <span>{c.name.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      )}

      {(siblingsLoading || loading) && <div style={{ ...cardStyle, textAlign: "center", color: "var(--ink-3)" }}>Loading…</div>}
      {!siblingsLoading && siblings.length === 0 && (
        <div style={{ ...cardStyle, textAlign: "center", color: "var(--ink-3)" }}>
          No active children linked to your account. Contact the school administrator.
        </div>
      )}
      {error && <div style={{ ...cardStyle, textAlign: "center", color: "var(--ink-3)" }}>Could not load this child&apos;s profile.</div>}

      {!loading && detail && (
        <>
          <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--pu-soft)", color: "var(--pu-deep, #4F35CC)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
              {detail.name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-1)" }}>{detail.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                {detail.admission_no} · {[detail.class_name, detail.section_name].filter(Boolean).join(" ")}
                {detail.roll_no ? ` · Roll ${detail.roll_no}` : ""}
              </div>
            </div>
          </div>

          <Section icon={User} title="Personal Info">
            <Field label="First Name" value={detail.first_name} />
            <Field label="Middle Name" value={detail.middle_name} />
            <Field label="Last Name" value={detail.last_name} />
            <Field label="Date of Birth" value={detail.date_of_birth} />
            <Field label="Gender" value={detail.custom_gender || detail.gender} />
            <Field label="Blood Group" value={detail.blood_group} />
          </Section>

          <Section icon={MapPin} title="Contact & Address">
            <Field label="Phone" value={detail.contact.phone} />
            <Field label="Email" value={detail.contact.email} />
            <Field label="Emergency Contact" value={detail.contact.emergency_contact_name && detail.contact.emergency_contact_phone ? `${detail.contact.emergency_contact_name} (${detail.contact.emergency_contact_phone})` : detail.contact.emergency_contact_name} />
            <Field label="Address" value={[detail.address.address_line, detail.address.landmark].filter(Boolean).join(", ")} />
            <Field label="City / District" value={[detail.address.city, detail.address.district].filter(Boolean).join(", ")} />
            <Field label="State / PIN" value={[detail.address.state, detail.address.pincode].filter(Boolean).join(" - ")} />
          </Section>

          <Section icon={Globe2} title="Background">
            <Field label="Mother Tongue" value={detail.background.other_mother_tongue || detail.background.mother_tongue} />
            <Field label="Religion" value={detail.background.religion} />
            <Field label="Nationality" value={detail.background.other_nationality || detail.background.nationality} />
          </Section>

          <Section icon={GraduationCap} title="Admission Details">
            <Field label="Admission Type" value={detail.admission.admission_type} />
            <Field label="Previous School" value={detail.admission.previous_school_name} />
            <Field label="RTE Certificate No." value={detail.admission.rte_certificate_no} />
            <Field label="Stream" value={detail.admission.stream} />
            <ListField label="Transport" values={detail.admission.transport_modes} />
            <Field label="Transport (other)" value={detail.admission.transport_custom} />
          </Section>

          <Section icon={IdCard} title="Identity Documents">
            <Field label="APAAR ID" value={detail.identity_documents.apaar_id} />
            <Field label="Aadhaar No." value={detail.identity_documents.aadhaar_no} />
            <Field label="PEN" value={detail.identity_documents.pen} />
            <Field label="DigiLocker Mobile" value={detail.identity_documents.digilocker_mobile} />
            <Field label="ABC ID" value={detail.identity_documents.abc_id} />
          </Section>

          <Section icon={HeartPulse} title="Physical & Medical">
            <Field label="Height (cm)" value={detail.physical.height_cm} />
            <Field label="Weight (kg)" value={detail.physical.weight_kg} />
            <Field label="Vision" value={detail.medical.vision} />
            <ListField label="Medical Conditions" values={detail.medical.medical_conditions} />
            <ListField label="Allergies" values={detail.medical.allergies} />
            <Field label="Current Medications" value={detail.medical.current_medications} />
            <Field label="Treating Doctor" value={detail.medical.treating_doctor} />
            <ListField label="Vaccinations" values={detail.medical.vaccinations} />
            <Field label="Medical Notes" value={detail.medical.medical_notes} />
            {detail.medical.is_pwd && (
              <>
                <ListField label="Disability Type(s)" values={detail.medical.disability_types} />
                <Field label="Disability %" value={detail.medical.disability_percent} />
                <Field label="Accommodations" value={detail.medical.disability_accommodations?.join(", ")} />
              </>
            )}
          </Section>

          <Section icon={Users} title="Guardians on Record">
            {detail.guardians.length === 0 && <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>No guardians on file.</span>}
            {detail.guardians.map((g) => (
              <Field
                key={g.id}
                label={`${g.relation}${g.is_primary ? " · primary" : ""}`}
                value={[g.full_name, g.phone].filter(Boolean).join(" · ")}
              />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}
