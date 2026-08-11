"use client";

import { useEffect, useState } from "react";
import { User, Phone, MapPin, GraduationCap, Landmark, FileText, Search, type LucideIcon } from "lucide-react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { extractListData } from "@/lib/pagination";
import { usePermissions } from "@/hooks/usePermissions";

interface StaffProfile {
  id: number;
  full_name: string;
  staff_no: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  emergency_mobile: string;
  gender: string;
  date_of_birth: string | null;
  marital_status: string;
  blood_group: string;
  nationality: string;
  status: string;
  department_name: string | null;
  designation_name: string | null;
  role_name: string | null;
  contract_type: string;
  join_date: string | null;
  qualification: string;
  experience: string;
  current_address: string;
  permanent_address: string;
  city: string;
  state: string;
  epf_no: string;
  bank_account_name: string;
  bank_account_no: string;
  bank_name: string;
  bank_branch: string;
  basic_salary: string | number;
}

interface StaffListRow {
  id: number;
  full_name: string;
  staff_no: string;
  designation_name: string | null;
  department_name: string | null;
}

interface StaffDocumentRow {
  id: number;
  document_type: string;
  file_name: string;
}

const cardStyle: React.CSSProperties = {
  background: "var(--bg-1)",
  border: "1px solid var(--bd)",
  borderRadius: 18,
  boxShadow: "var(--sh-1, none)",
  padding: "22px 24px",
  marginBottom: 18,
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

export function StaffProfilePanel() {
  const { me, can } = usePermissions();
  const isAdmin = can("human_resource.staff.view");
  // usePermissions() starts with me === null while identity is still loading,
  // during which can() conservatively returns false — don't treat that as a
  // real "not admin" verdict, or an admin briefly flashes the self-view fetch
  // (and its "no profile linked" error) before flipping to the picker.
  const identityReady = me !== null;

  const [staffList, setStaffList] = useState<StaffListRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [documents, setDocuments] = useState<StaffDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin: load the staff picker list once, and stop showing the initial
  // "Loading…" state — an admin with nothing selected isn't loading a
  // profile, they're just waiting to pick someone.
  useEffect(() => {
    if (!identityReady || !isAdmin) return;
    setLoading(false);
    apiRequestWithRefresh<{ results?: StaffListRow[] } | StaffListRow[]>("/api/v1/hr/staff/?page_size=200")
      .then((data) => setStaffList(extractListData(data)))
      .catch(() => setStaffList([]));
  }, [identityReady, isAdmin]);

  // Non-admin: load own profile once we actually know they're not an admin
  // (identityReady guards against the transient me === null / isAdmin === false
  // window while usePermissions() is still resolving).
  useEffect(() => {
    if (!identityReady || isAdmin) return;
    setLoading(true);
    apiRequestWithRefresh<StaffProfile>("/api/v1/hr/staff/me/")
      .then((data) => {
        setProfile(data);
        setError(null);
      })
      .catch(() => setError("No staff profile is linked to your account yet."))
      .finally(() => setLoading(false));
  }, [identityReady, isAdmin]);

  // Admin: load selected staff's profile + documents.
  useEffect(() => {
    if (!isAdmin || !selectedId) return;
    setLoading(true);
    Promise.all([
      apiRequestWithRefresh<StaffProfile>(`/api/v1/hr/staff/${selectedId}/`),
      apiRequestWithRefresh<{ results?: StaffDocumentRow[] } | StaffDocumentRow[]>(
        `/api/v1/hr/staff-documents/?staff=${selectedId}`
      ).catch(() => []),
    ])
      .then(([staffData, docsData]) => {
        setProfile(staffData);
        setDocuments(extractListData(docsData as { results?: StaffDocumentRow[] } | StaffDocumentRow[]));
        setError(null);
      })
      .catch(() => setError("Could not load this staff member's profile."))
      .finally(() => setLoading(false));
  }, [isAdmin, selectedId]);

  const filteredStaff = staffList.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return s.full_name?.toLowerCase().includes(q) || s.staff_no?.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--ink-1)" }}>Staff Profile</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
          {isAdmin
            ? "Full onboarding and payroll details for any staff member."
            : "Your own onboarding and payroll details, as recorded during onboarding."}
        </p>
      </div>

      {isAdmin && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Search size={14} color="var(--ink-3)" />
            <input
              placeholder="Search staff by name or staff no…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                height: 36,
                border: "1px solid var(--bd-2)",
                borderRadius: 9,
                padding: "0 12px",
                fontSize: 13,
                background: "var(--bg-2)",
                color: "var(--ink-1)",
              }}
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 160, overflowY: "auto" }}>
            {filteredStaff.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 9,
                  border: `1px solid ${selectedId === s.id ? "var(--pu, #6D4AFF)" : "var(--bd-2)"}`,
                  background: selectedId === s.id ? "var(--pu-soft, #EEEAFF)" : "var(--bg-2)",
                  color: selectedId === s.id ? "var(--pu-deep, #4F35CC)" : "var(--ink-1)",
                  fontSize: 12.5,
                  fontWeight: 550,
                  cursor: "pointer",
                }}
              >
                {s.full_name} · {s.staff_no}
              </button>
            ))}
            {filteredStaff.length === 0 && (
              <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>No staff match this search.</span>
            )}
          </div>
        </div>
      )}

      {loading && <div style={{ ...cardStyle, textAlign: "center", color: "var(--ink-3)" }}>Loading…</div>}
      {!loading && error && <div style={{ ...cardStyle, textAlign: "center", color: "var(--ink-3)" }}>{error}</div>}
      {!loading && isAdmin && !selectedId && !error && (
        <div style={{ ...cardStyle, textAlign: "center", color: "var(--ink-3)" }}>
          Select a staff member above to view their profile.
        </div>
      )}

      {!loading && profile && (
        <>
          <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14 }}>
            <span
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "var(--pu-soft, #EEEAFF)",
                color: "var(--pu-deep, #4F35CC)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {(profile.full_name || `${profile.first_name} ${profile.last_name}`)
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-1)" }}>
                {profile.full_name || `${profile.first_name} ${profile.last_name}`}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                {profile.staff_no} · {profile.designation_name || "—"} · {profile.department_name || "—"}
                {profile.status ? ` · ${profile.status}` : ""}
              </div>
            </div>
          </div>

          <Section icon={User} title="Personal Info">
            <Field label="First Name" value={profile.first_name} />
            <Field label="Last Name" value={profile.last_name} />
            <Field label="Gender" value={profile.gender} />
            <Field label="Date of Birth" value={profile.date_of_birth} />
            <Field label="Marital Status" value={profile.marital_status} />
            <Field label="Blood Group" value={profile.blood_group} />
            <Field label="Nationality" value={profile.nationality} />
          </Section>

          <Section icon={Phone} title="Contact & Address">
            <Field label="Email" value={profile.email} />
            <Field label="Phone" value={profile.phone} />
            <Field label="Emergency Contact" value={profile.emergency_mobile} />
            <Field label="Current Address" value={profile.current_address} />
            <Field label="Permanent Address" value={profile.permanent_address} />
            <Field label="City / State" value={[profile.city, profile.state].filter(Boolean).join(", ")} />
          </Section>

          <Section icon={GraduationCap} title="Qualifications & Employment">
            <Field label="Qualification" value={profile.qualification} />
            <Field label="Experience" value={profile.experience} />
            <Field label="Role" value={profile.role_name} />
            <Field label="Contract Type" value={profile.contract_type} />
            <Field label="Joining Date" value={profile.join_date} />
          </Section>

          <div style={{ ...cardStyle, border: "1px solid var(--danger-soft, #FEE2E2)", background: "var(--danger-bg, #FFF7F7)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Landmark size={16} color="var(--danger, #DC2626)" />
              <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 650, color: "var(--ink-1)" }}>Bank & Payroll</h3>
              <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)" }}>
                SENSITIVE — visible to you and admins only
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px 20px" }}>
              <Field label="Account Holder" value={profile.bank_account_name} />
              <Field label="Account Number" value={profile.bank_account_no} />
              <Field label="Bank Name" value={profile.bank_name} />
              <Field label="Branch" value={profile.bank_branch} />
              <Field label="EPF No." value={profile.epf_no} />
              <Field label="Basic Salary" value={profile.basic_salary ? `₹${profile.basic_salary}` : null} />
            </div>
          </div>

          {isAdmin && (
            <Section icon={FileText} title="Documents">
              {documents.length === 0 && (
                <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>No documents on file.</span>
              )}
              {documents.map((d) => (
                <Field key={d.id} label={d.document_type} value={d.file_name} />
              ))}
            </Section>
          )}
        </>
      )}

      {!loading && !profile && !error && !isAdmin && (
        <div style={{ ...cardStyle, textAlign: "center", color: "var(--ink-3)" }}>
          <MapPin size={20} style={{ marginBottom: 8 }} />
          <div>No profile data available.</div>
        </div>
      )}
    </div>
  );
}
