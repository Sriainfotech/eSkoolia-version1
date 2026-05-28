"use client";
/**
 * HR Onboard — 10-step wizard matching the mockup design.
 * Layout: page header → QR banner → [252px grouped sidebar | step card] → sticky footer bar
 */
import { useRef, useState } from "react";
import {
  Camera, Upload, ChevronDown, X, Printer, Sparkles,
  FileText, CheckCircle, QrCode,
} from "lucide-react";
import {
  HrField, HrInput, HrSelect, useHrToast,
} from "@/components/hr/HrUi";
import {
  useAllDepartments, useDesignations, useStaffList, createStaff,
} from "@/hooks/useHrApi";
import type { Staff } from "@/types/hr";

// --- Constants ---
const GENDERS        = ["Male", "Female", "Other", "Prefer not to say"] as const;
const BLOOD_GROUPS   = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const MARITAL_STATUS = ["Single", "Married", "Divorced", "Widowed"] as const;
const EMP_TYPES      = ["Permanent", "Contract", "Part-time", "Temporary", "Full-time", "Visiting Guest"] as const;
const RELIGIONS      = ["Islam", "Christianity", "Hinduism", "Buddhism", "Other", "Prefer not to say"] as const;
const MOTHER_TONGUES = ["English", "Yoruba", "Igbo", "Hausa", "French", "Arabic", "Tamil", "Other"] as const;
const ROLES          = ["Teacher", "Admin Staff", "Finance", "Support", "Transport / Driver", "Library", "Principal", "Vice Principal"] as const;
const SALARY_MODES   = ["Monthly", "Bi-monthly", "Weekly", "Daily"] as const;
const BANKS          = ["GTBank", "Access Bank", "First Bank", "UBA", "Zenith Bank", "Polaris Bank", "Other"] as const;
const DEGREES        = ["B.Ed", "M.Ed", "MBA", "B.Tech", "M.Tech", "B.Sc", "M.Sc", "B.A", "M.A", "Ph.D", "Diploma", "Other"] as const;
const RELATIONSHIPS  = ["Spouse", "Parent", "Sibling", "Child", "Friend", "Guardian", "Other"] as const;
const DISABILITY_STATUSES = ["None", "Physical disability", "Visual impairment", "Hearing impairment", "Speech or language disability", "Cognitive / learning disability", "Multiple disabilities", "Prefer not to say"] as const;
const CC_OPTIONS     = ["+91", "+234", "+44", "+1", "+971", "+61", "+27"] as const;

// --- Step definitions grouped by category ---
const STEP_GROUPS = [
  {
    group: "Personal",
    steps: [
      { num: 1, label: "Staff identity",     sub: "Basic profile, DOB, photo" },
      { num: 2, label: "Role & placement",   sub: "Department, role, joining" },
      { num: 3, label: "Contact & address",  sub: "Phone, email, location" },
      { num: 4, label: "Family & emergency", sub: "Nominees and contacts" },
    ],
  },
  {
    group: "Compliance",
    steps: [
      { num: 5, label: "Government identity", sub: "Aadhaar, PAN, etc." },
      { num: 6, label: "Qualifications",      sub: "Education and experience" },
      { num: 7, label: "Medical & fitness",   sub: "Health, transport, fitness" },
    ],
  },
  {
    group: "Payroll & Files",
    steps: [
      { num: 8,  label: "Payroll setup",    sub: "CTC and deductions" },
      { num: 9,  label: "Documents",        sub: "Tally-based checklist" },
      { num: 10, label: "Review & onboard", sub: "Confirm and create" },
    ],
  },
];

type StepDef = { num: number; label: string; sub: string };
const ALL_STEPS: StepDef[] = STEP_GROUPS.flatMap((g) => g.steps as StepDef[]);
const TOTAL     = ALL_STEPS.length;

// --- Form data type ---
type FormData = Partial<
  Staff & {
    // Contact step extras
    preferred_communication: string;
    current_address_line2: string;
    current_pin: string;
    current_country: string;
    permanent_city: string;
    permanent_state: string;
    permanent_pin: string;
    permanent_country: string;
    same_address: string;
    // Family step
    num_children: string;
    spouse_parent_name: string;
    emergency_name: string;
    emergency_phone: string;
    emergency_relation: string;
    // Gov ID step extras
    nin: string;
    pt_registration: string;
    ifsc_code: string;
    bank_name: string;
    account_number: string;
    account_name: string;
    // Qualifications step
    bed_reg_no: string;
    ctet_score: string;
    subjects_qualified: string;
    qualifications_summary: string;
    // Medical step
    med_cert_no: string;
    med_exam_date: string;
    cert_valid_till: string;
    disability_cert_no: string;
    disability_pct: string;
    disability_authority: string;
    workplace_accommodations: string;
    eye_exam_result: string;
    colour_blindness: string;
    dl_medical_exam: string;
    medical_conditions: string;
    // Payroll step
    basic_salary_input: string;
    hra_input: string;
    da_input: string;
    travel_allowance_input: string;
    medical_allowance_input: string;
    special_allowance_input: string;
    salary_mode: string;
    // Legacy (kept for backward compat)
    blood_group_input: string;
    pension_id: string;
    tax_id: string;
    passport_number: string;
    // Review step
    create_login: string;
    send_welcome: string;
    activate_attendance: string;
  }
>;

// --- Shared visual helpers ---
const PF = 'var(--font-playfair),"Playfair Display",Georgia,serif';
const CC_SEL_CLS = "h-[44px] px-3 border border-[var(--line)] rounded-[11px] bg-white text-[13px] text-[var(--ink)] outline-none focus:border-[#c4b5fd] shrink-0";

function WizardBlock({
  title, right, children,
}: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between pb-[10px] border-b border-[#F1F5F9]">
        <div className="text-[13px] font-[600] text-[#334155]" style={{ fontFamily: PF }}>
          {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function TipBox({ type, children }: { type: "info" | "warn" | "success"; children: React.ReactNode }) {
  const s = {
    info:    "bg-[#eff6ff] border-[#bfdbfe] text-[#1e40af]",
    warn:    "bg-[#fffbeb] border-[#fde68a] text-[#92400e]",
    success: "bg-[#ecfdf5] border-[#bbf7d0] text-[#065f46]",
  };
  return (
    <div className={`text-[12.5px] px-[14px] py-[10px] rounded-[10px] border leading-relaxed ${s[type]}`}>
      {children}
    </div>
  );
}

function FHG({ hints }: { hints: (string | null)[] }) {
  return (
    <div
      className="-mt-4 grid gap-6"
      style={{ gridTemplateColumns: `repeat(${hints.length}, minmax(0,1fr))` }}
    >
      {hints.map((h, i) => (
        <div key={i} className="text-[11px] text-[#94A3B8] leading-snug">{h ?? ""}</div>
      ))}
    </div>
  );
}

function PhoneField({
  label, required, value, onChange,
}: { label: string; required?: boolean; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-[9px]">
      <label className="text-[11px] uppercase tracking-[0.07em] text-[#64748b] font-[850]">
        {label}{required && <span className="text-[var(--red)] ml-1">*</span>}
      </label>
      <div className="flex gap-2">
        <select className={CC_SEL_CLS}>
          {CC_OPTIONS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <HrInput
          className="flex-1 min-w-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Mobile number"
        />
      </div>
    </div>
  );
}

function AddRowBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start text-[12px] font-[700] text-[var(--brand)] border border-[var(--brand)] rounded-[8px] px-3 py-1.5 hover:bg-[var(--soft)] transition-colors"
    >
      + {label}
    </button>
  );
}

// --- Sidebar Nav ---
function WizardNav({ step, onGo }: { step: number; onGo: (n: number) => void }) {
  return (
    <div className="w-[252px] shrink-0 sticky top-[108px] self-start">
      <div
        className="bg-white border border-[#E8E8F0] rounded-[14px] overflow-hidden"
        style={{ boxShadow: "0 2px 8px -2px rgba(15,18,34,0.07)" }}
      >
        {STEP_GROUPS.map((group) => (
          <div key={group.group}>
            <div className="px-[18px] pt-[20px] pb-[6px] text-[10px] font-[900] text-[#94A3B8] uppercase tracking-[0.13em]">
              {group.group}
            </div>
            {group.steps.map((s) => {
              const done   = s.num < step;
              const active = s.num === step;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => onGo(s.num)}
                  className="w-full flex items-start gap-3 px-[18px] py-[12px] text-left transition-colors hover:bg-[#F8FAFC]"
                  style={{
                    background: active ? "var(--soft)" : undefined,
                    borderLeft: active ? "3px solid var(--brand)" : "3px solid transparent",
                  }}
                >
                  <span
                    className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10.5px] font-[900] shrink-0 mt-[1px]"
                    style={{
                      background: done ? "#22C55E" : active ? "var(--brand)" : "#F1F5F9",
                      color:      done || active ? "white" : "#94A3B8",
                    }}
                  >
                    {done ? "✓" : s.num}
                  </span>
                  <div className="min-w-0">
                    <div
                      className="text-[13px] font-[700] leading-snug"
                      style={{ color: active ? "var(--brand)" : done ? "#15172A" : "#475569" }}
                    >
                      {s.label}
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-[2px] leading-snug">{s.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}

        {/* Heads up box */}
        <div className="m-[14px_14px_16px] p-[12px_14px] bg-amber-50 border border-amber-200 rounded-[9px]">
          <div className="text-[10.5px] font-[800] text-amber-800 mb-1.5">Heads up</div>
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            <span className="text-[8.5px] font-[700] px-[5px] py-[1.5px] bg-red-100 text-red-600 rounded-[4px]">Required</span>
            <span className="text-[8.5px] font-[700] px-[5px] py-[1.5px] bg-amber-100 text-amber-700 rounded-[4px] uppercase tracking-wide">RECOMMENDED</span>
            <span className="text-[8.5px] font-[600] px-[5px] py-[1.5px] bg-gray-100 text-gray-500 rounded-[4px]">suggested</span>
          </div>
          <p className="text-[10px] text-amber-700 m-0 leading-relaxed">Role-sensitive fields stay visible but compact</p>
        </div>
      </div>
    </div>
  );
}

// --- Step 1: Staff Identity ---
function StepIdentity({
  f, set, photoPreview, onPhotoClick,
}: {
  f: FormData;
  set: (k: string, v: string) => void;
  photoPreview: string | null;
  onPhotoClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      {/* Photo upload */}
      <div className="flex items-start gap-6 p-[20px_24px] bg-[#F8FAFC] border border-[#E8E8F0] rounded-[12px]">
        <button
          type="button"
          onClick={onPhotoClick}
          className="w-[90px] h-[90px] rounded-full border-2 border-dashed border-[#CBD5E1] bg-white flex flex-col items-center justify-center cursor-pointer overflow-hidden shrink-0 hover:border-[var(--brand)] transition-colors"
        >
          {photoPreview ? (
            <img src={photoPreview} className="w-full h-full object-cover" alt="Staff" />
          ) : (
            <span className="text-[8px] font-[900] text-[#94A3B8] tracking-[0.05em] text-center leading-snug">
              ADD<br />PHOTO
            </span>
          )}
        </button>
        <div>
          <div className="text-[13px] font-[700] text-[#15172A] mb-1">Staff photo</div>
          <div className="text-[12px] text-[#94A3B8] mb-3 leading-relaxed">
            Square JPG or PNG, at least 400x400px. Used for ID card, directory, payroll and attendance.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onPhotoClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]"
            >
              <Upload size={12} /> Upload file
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]"
            >
              <Camera size={12} /> Take photo
            </button>
          </div>
        </div>
      </div>

      {/* Row 1: Staff Code | Biometric/RFID | Status */}
      <div className="grid grid-cols-3 gap-6">
        <HrField label="Staff Code" required>
          <HrInput
            value="Auto generated"
            readOnly
            className="bg-[#F1F5F9] cursor-not-allowed !text-[#94A3B8]"
          />
        </HrField>
        <HrField label="Biometric / RFID Code">
          <HrInput
            value={f.biometric_rfid ?? ""}
            onChange={(e) => set("biometric_rfid", e.target.value)}
            placeholder="Assigned later"
          />
        </HrField>
        <HrField label="Status" required>
          <div className="flex rounded-[11px] overflow-hidden border border-[#E2E8F0] h-[44px]">
            <button
              type="button"
              onClick={() => set("status", "active")}
              className="flex-1 text-[12.5px] font-[700] transition-colors"
              style={{
                background: (f.status ?? "active") !== "inactive" ? "#15172A" : "white",
                color:      (f.status ?? "active") !== "inactive" ? "white" : "#64748B",
              }}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => set("status", "inactive")}
              className="flex-1 text-[12.5px] font-[700] transition-colors border-l border-[#E2E8F0]"
              style={{
                background: f.status === "inactive" ? "#15172A" : "white",
                color:      f.status === "inactive" ? "white" : "#64748B",
              }}
            >
              Inactive
            </button>
          </div>
        </HrField>
      </div>

      {/* Row 2: First Name | Middle Name | Last Name */}
      <div className="grid grid-cols-3 gap-6">
        <HrField label="First Name" required>
          <HrInput value={f.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} placeholder="e.g. Priya" />
        </HrField>
        <HrField label="Middle Name">
          <HrInput value={f.middle_name ?? ""} onChange={(e) => set("middle_name", e.target.value)} placeholder="Optional" />
        </HrField>
        <HrField label="Last Name" required>
          <HrInput value={f.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} placeholder="e.g. Sharma" />
        </HrField>
      </div>

      {/* Row 3: Date of Birth | Gender | Blood Group */}
      <div className="grid grid-cols-3 gap-6">
        <HrField label="Date of Birth" required>
          <HrInput
            type="date"
            value={f.date_of_birth ?? ""}
            onChange={(e) => set("date_of_birth", e.target.value)}
            placeholder="dd/mm/yyyy"
          />
        </HrField>
        <HrField label="Gender" required>
          <HrSelect value={f.gender ?? ""} onChange={(e) => set("gender", e.target.value)}>
            <option value="">Select</option>
            {GENDERS.map((g) => <option key={g}>{g}</option>)}
          </HrSelect>
        </HrField>
        <HrField label="Blood Group">
          <HrSelect value={f.blood_group_input ?? ""} onChange={(e) => set("blood_group_input", e.target.value)}>
            <option value="">Select</option>
            {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
          </HrSelect>
        </HrField>
      </div>

      {/* Row 4: Mother Tongue | Religion | Nationality */}
      <div className="grid grid-cols-3 gap-6">
        <HrField label="Mother Tongue">
          <HrSelect value={f.mother_tongue ?? ""} onChange={(e) => set("mother_tongue", e.target.value)}>
            <option value="">Select</option>
            {MOTHER_TONGUES.map((m) => <option key={m}>{m}</option>)}
          </HrSelect>
        </HrField>
        <HrField label="Religion">
          <HrSelect value={f.religion ?? ""} onChange={(e) => set("religion", e.target.value)}>
            <option value="">Prefer not to say</option>
            {RELIGIONS.map((r) => <option key={r}>{r}</option>)}
          </HrSelect>
        </HrField>
        <HrField label="Nationality" required>
          <HrInput
            value={f.nationality ?? ""}
            onChange={(e) => set("nationality", e.target.value)}
            placeholder="Select Nationality"
            list="nationality-list"
          />
          <datalist id="nationality-list">
            {["Nigerian", "Ghanaian", "Kenyan", "South African", "Indian", "British", "American", "Other"].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </HrField>
      </div>
    </div>
  );
}

// --- Step 2: Role & Placement ---
function StepRole({
  f, set, departments, designations, staffList,
}: {
  f: FormData;
  set: (k: string, v: string) => void;
  departments: { id: number; name: string }[];
  designations: { id: number; name: string; department: number }[];
  staffList: { id: number; first_name: string; last_name: string }[];
}) {
  const filteredDesigs = designations.filter(
    (d) => !f.department || String(d.department) === String(f.department),
  );
  return (
    <div className="flex flex-col gap-6">
      {/* Row 1: Department | Designation | Role/access */}
      <div className="grid grid-cols-3 gap-6">
        <HrField label="Department" required>
          <HrSelect value={String(f.department ?? "")} onChange={(e) => set("department", e.target.value)}>
            <option value="">Select...</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </HrSelect>
        </HrField>
        <HrField label="Designation" required>
          <HrSelect value={String(f.designation ?? "")} onChange={(e) => set("designation", e.target.value)}>
            <option value="">Select...</option>
            {filteredDesigs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </HrSelect>
        </HrField>
        <HrField label="Role / Access" required>
          <HrSelect value={String(f.role ?? "")} onChange={(e) => set("role", e.target.value)}>
            <option value="">Select...</option>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </HrSelect>
        </HrField>
      </div>

      {/* Row 2: Joining Date | Employment Type | Probation Period */}
      <div className="grid grid-cols-3 gap-6">
        <HrField label="Joining Date" required>
          <HrInput type="date" value={f.joining_date ?? ""} onChange={(e) => set("joining_date", e.target.value)} />
        </HrField>
        <HrField label="Employment Type" required>
          <HrSelect value={f.employment_type ?? ""} onChange={(e) => set("employment_type", e.target.value)}>
            <option value="">Select...</option>
            {EMP_TYPES.map((t) => <option key={t}>{t}</option>)}
          </HrSelect>
        </HrField>
        <HrField label="Probation Period">
          <HrInput value={f.probation_period ?? ""} onChange={(e) => set("probation_period", e.target.value)} placeholder="e.g. 3 months" />
        </HrField>
      </div>

      {/* Full-width: Reporting Manager */}
      <HrField label="Reporting Manager" required>
        <HrSelect value={String(f.reporting_manager ?? "")} onChange={(e) => set("reporting_manager", e.target.value)}>
          <option value="">Select reporting manager...</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
          ))}
        </HrSelect>
      </HrField>
    </div>
  );
}

// --- Step 3: Contact & Address ---
function StepContact({ f, set }: { f: FormData; set: (k: string, v: string) => void }) {
  const sameAddr = f.same_address === "true";
  const ccSel = [
    "h-[44px] px-3 border border-[var(--line)] rounded-[11px] bg-white text-[13px]",
    "text-[var(--ink)] outline-none focus:border-[#c4b5fd] shrink-0",
  ].join(" ");

  return (
    <div className="flex flex-col gap-8">

      {/* ── 01 · CONTACT ─────────────────────────────── */}
      <div className="flex flex-col gap-5">
        <div className="text-[10.5px] font-[900] text-[#94A3B8] uppercase tracking-[0.1em] pb-3 border-b border-[#F1F5F9]">
          01 · Contact
        </div>

        {/* Row 1: Mobile | Alternate Mobile | Official Email */}
        <div className="grid grid-cols-3 gap-6">
          <div className="flex flex-col gap-[9px]">
            <label className="text-[11px] uppercase tracking-[0.07em] text-[#64748b] font-[850]">
              Mobile <span className="text-[var(--red)]">*</span>
            </label>
            <div className="flex gap-2">
              <select className={ccSel}>
                <option>+91</option><option>+234</option><option>+44</option><option>+1</option>
              </select>
              <HrInput
                className="flex-1 min-w-0"
                value={f.mobile ?? ""}
                onChange={(e) => set("mobile", e.target.value)}
                placeholder="Mobile number"
              />
            </div>
            <span className="text-[11px] text-[#94A3B8] -mt-1">Used for WhatsApp</span>
          </div>

          <HrField label="Alternate Mobile">
            <HrInput value={f.alternate_mobile ?? ""} onChange={(e) => set("alternate_mobile", e.target.value)} placeholder="Optional" />
          </HrField>

          <HrField label="Official Email">
            <HrInput type="email" value={f.official_email ?? ""} onChange={(e) => set("official_email", e.target.value)} placeholder="name@school.edu.in" />
          </HrField>
        </div>

        {/* Row 2: Personal Email | WhatsApp | Preferred Communication */}
        <div className="grid grid-cols-3 gap-6">
          <HrField label="Personal Email">
            <HrInput type="email" value={f.personal_email ?? ""} onChange={(e) => set("personal_email", e.target.value)} placeholder="personal@gmail.com" />
          </HrField>

          <div className="flex flex-col gap-[9px]">
            <label className="text-[11px] uppercase tracking-[0.07em] text-[#64748b] font-[850]">WhatsApp</label>
            <div className="flex gap-2">
              <select className={ccSel}>
                <option>+91</option><option>+234</option><option>+44</option><option>+1</option>
              </select>
              <HrInput
                className="flex-1 min-w-0"
                value={f.whatsapp ?? ""}
                onChange={(e) => set("whatsapp", e.target.value)}
                placeholder=""
              />
            </div>
          </div>

          <div className="flex flex-col gap-[9px]">
            <label className="text-[11px] uppercase tracking-[0.07em] text-[#64748b] font-[850]">Preferred Communication</label>
            <label className="flex items-center gap-[7px] text-[12px] text-[#64748B] cursor-pointer">
              <input
                type="checkbox"
                checked={!!f.mobile && f.whatsapp === f.mobile}
                onChange={(e) => set("whatsapp", e.target.checked ? (f.mobile ?? "") : "")}
                className="accent-[var(--brand)] w-[13px] h-[13px] shrink-0"
              />
              Same as mobile
            </label>
            <HrSelect value={f.preferred_communication ?? ""} onChange={(e) => set("preferred_communication", e.target.value)}>
              <option value="">Select...</option>
              <option>Phone</option>
              <option>WhatsApp</option>
              <option>Email</option>
            </HrSelect>
          </div>
        </div>
      </div>

      {/* ── 02 · CURRENT ADDRESS ─────────────────────── */}
      <div className="flex flex-col gap-5">
        <div className="text-[10.5px] font-[900] text-[#94A3B8] uppercase tracking-[0.1em] pb-3 border-b border-[#F1F5F9]">
          02 · Current Address
        </div>
        <HrField label="Address Line 1" required>
          <HrInput value={f.current_address ?? ""} onChange={(e) => set("current_address", e.target.value)} placeholder="House no., Building, Street" />
        </HrField>
        <HrField label="Address Line 2">
          <HrInput value={f.current_address_line2 ?? ""} onChange={(e) => set("current_address_line2", e.target.value)} placeholder="Area / Locality (optional)" />
        </HrField>
        <div className="grid grid-cols-4 gap-6">
          <HrField label="City" required>
            <HrInput value={f.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="City" />
          </HrField>
          <HrField label="State" required>
            <HrInput value={f.state ?? ""} onChange={(e) => set("state", e.target.value)} placeholder="State" />
          </HrField>
          <HrField label="Pin Code" required>
            <HrInput value={f.current_pin ?? ""} onChange={(e) => set("current_pin", e.target.value)} placeholder="560001" />
          </HrField>
          <HrField label="Country">
            <HrInput value={f.current_country ?? ""} onChange={(e) => set("current_country", e.target.value)} placeholder="India" />
          </HrField>
        </div>
      </div>

      {/* ── 03 · PERMANENT ADDRESS ───────────────────── */}
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
          <div className="text-[10.5px] font-[900] text-[#94A3B8] uppercase tracking-[0.1em]">
            03 · Permanent Address
          </div>
          <label className="flex items-center gap-[7px] text-[12.5px] text-[#475569] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sameAddr}
              onChange={(e) => set("same_address", e.target.checked ? "true" : "false")}
              className="accent-[var(--brand)] w-[13px] h-[13px] shrink-0"
            />
            Same as current address
          </label>
        </div>
        {!sameAddr && (
          <>
            <HrField label="Address Line 1">
              <HrInput value={f.permanent_address ?? ""} onChange={(e) => set("permanent_address", e.target.value)} placeholder="House no., Building, Street" />
            </HrField>
            <div className="grid grid-cols-4 gap-6">
              <HrField label="City">
                <HrInput value={f.permanent_city ?? ""} onChange={(e) => set("permanent_city", e.target.value)} placeholder="City" />
              </HrField>
              <HrField label="State">
                <HrInput value={f.permanent_state ?? ""} onChange={(e) => set("permanent_state", e.target.value)} placeholder="State" />
              </HrField>
              <HrField label="Pin Code">
                <HrInput value={f.permanent_pin ?? ""} onChange={(e) => set("permanent_pin", e.target.value)} placeholder="560001" />
              </HrField>
              <HrField label="Country">
                <HrInput value={f.permanent_country ?? ""} onChange={(e) => set("permanent_country", e.target.value)} placeholder="India" />
              </HrField>
            </div>
          </>
        )}
      </div>

    </div>
  );
}

// --- Step 4: Family & Emergency ---
function StepFamily({ f, set }: { f: FormData; set: (k: string, v: string) => void }) {
  type EC = { name: string; relation: string; mobile: string; alt_mobile: string; email: string };
  type Nominee = { name: string; relation: string; share: string };
  const [ecs, setEcs] = useState<EC[]>([{ name: "", relation: "", mobile: "", alt_mobile: "", email: "" }]);
  const [nominees, setNominees] = useState<Nominee[]>([{ name: "", relation: "", share: "" }]);

  const setEc  = (i: number, k: keyof EC, v: string) => setEcs((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const setNom = (i: number, k: keyof Nominee, v: string) => setNominees((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  return (
    <div className="flex flex-col gap-8">

      {/* 01 · Marital & family */}
      <WizardBlock title="01 · Marital &amp; family">
        <div className="grid grid-cols-3 gap-6">
          <HrField label="Marital Status">
            <HrSelect value={f.marital_status ?? ""} onChange={(e) => set("marital_status", e.target.value)}>
              <option value="">Select...</option>
              {MARITAL_STATUS.map((m) => <option key={m}>{m}</option>)}
            </HrSelect>
          </HrField>
          <HrField label="No. of Children">
            <HrInput type="number" min={0} value={f.num_children ?? ""} onChange={(e) => set("num_children", e.target.value)} placeholder="0" />
          </HrField>
          <HrField label="Spouse / Parent Name">
            <HrInput value={f.spouse_parent_name ?? ""} onChange={(e) => set("spouse_parent_name", e.target.value)} placeholder="Full name" />
          </HrField>
        </div>
      </WizardBlock>

      {/* 02 · Emergency contacts */}
      <WizardBlock title="02 · Emergency contacts">
        {ecs.map((ec, i) => (
          <div key={i} className="flex flex-col gap-5 pb-5 border-b border-[#F1F5F9] last:border-0 last:pb-0">
            <div className="grid grid-cols-3 gap-6">
              <HrField label="Name" required>
                <HrInput value={ec.name} onChange={(e) => setEc(i, "name", e.target.value)} placeholder="Full name" />
              </HrField>
              <HrField label="Relationship" required>
                <HrSelect value={ec.relation} onChange={(e) => setEc(i, "relation", e.target.value)}>
                  <option value="">Select...</option>
                  {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
                </HrSelect>
              </HrField>
              <PhoneField label="Mobile" required value={ec.mobile} onChange={(v) => setEc(i, "mobile", v)} />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <HrField label="Alternate Mobile">
                <HrInput value={ec.alt_mobile} onChange={(e) => setEc(i, "alt_mobile", e.target.value)} placeholder="Optional" />
              </HrField>
              <HrField label="Email">
                <HrInput type="email" value={ec.email} onChange={(e) => setEc(i, "email", e.target.value)} placeholder="email@example.com" />
              </HrField>
            </div>
          </div>
        ))}
        <AddRowBtn onClick={() => setEcs((p) => [...p, { name: "", relation: "", mobile: "", alt_mobile: "", email: "" }])} label="Add emergency contact" />
      </WizardBlock>

      {/* 03 · Nominees */}
      <WizardBlock title="03 · Nominees">
        <TipBox type="info">
          Nominees are used for PF, gratuity and group insurance. Ensure percentages add up to 100%.
        </TipBox>
        {nominees.map((nom, i) => (
          <div key={i} className="grid grid-cols-3 gap-6 items-end">
            <HrField label="Nominee Name" required>
              <HrInput value={nom.name} onChange={(e) => setNom(i, "name", e.target.value)} placeholder="Full name" />
            </HrField>
            <HrField label="Relationship">
              <HrSelect value={nom.relation} onChange={(e) => setNom(i, "relation", e.target.value)}>
                <option value="">Select...</option>
                {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
              </HrSelect>
            </HrField>
            <div className="flex gap-2 items-end">
              <HrField label="Share %">
                <HrInput type="number" min={0} max={100} value={nom.share} onChange={(e) => setNom(i, "share", e.target.value)} placeholder="e.g. 50" />
              </HrField>
              {nominees.length > 1 && (
                <button
                  type="button"
                  onClick={() => setNominees((p) => p.filter((_, idx) => idx !== i))}
                  className="h-[44px] w-[36px] flex items-center justify-center rounded-[11px] border border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2] mb-0 shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        <AddRowBtn onClick={() => setNominees((p) => [...p, { name: "", relation: "", share: "" }])} label="Add nominee" />
      </WizardBlock>
    </div>
  );
}

// --- Step 5: Government Identity ---
function StepGovId({ f, set }: { f: FormData; set: (k: string, v: string) => void }) {
  return (
    <div className="flex flex-col gap-8">
      <TipBox type="warn">
        <strong>Documents verified by HR</strong> · Aadhaar, PAN &amp; bank details are mandatory for payroll processing and statutory compliance. Ensure information matches government records exactly.
      </TipBox>

      {/* 01 · Identity documents */}
      <WizardBlock title="01 · Identity documents">
        <div className="grid grid-cols-2 gap-6">
          <HrField label="Aadhaar Number" required>
            <HrInput value={f.nin ?? ""} onChange={(e) => set("nin", e.target.value)} maxLength={12} placeholder="12-digit number" />
          </HrField>
          <HrField label="PAN Number" required>
            <HrInput value={f.pan ?? ""} onChange={(e) => set("pan", e.target.value)} placeholder="e.g. ABCDE1234F" />
          </HrField>
        </div>
        <FHG hints={["12-digit Aadhaar. Masked after save.", "Required for TDS (Section 192)"]} />
        <div className="grid grid-cols-2 gap-6">
          <HrField label="Passport Number">
            <HrInput value={f.passport_no ?? ""} onChange={(e) => set("passport_no", e.target.value)} placeholder="e.g. A1234567" />
          </HrField>
          <HrField label="Driving Licence">
            <HrInput value={f.driving_licence ?? ""} onChange={(e) => set("driving_licence", e.target.value)} placeholder="Licence number" />
          </HrField>
        </div>
        <FHG hints={[null, "Required for transport staff"]} />
      </WizardBlock>

      {/* 02 · Statutory IDs */}
      <WizardBlock title="02 · Statutory IDs">
        <div className="grid grid-cols-3 gap-6">
          <HrField label="UAN (PF)">
            <HrInput value={f.uan ?? ""} onChange={(e) => set("uan", e.target.value)} placeholder="Universal Account Number" />
          </HrField>
          <HrField label="ESI Number">
            <HrInput value={f.esi_no ?? ""} onChange={(e) => set("esi_no", e.target.value)} placeholder="ESI registration no." />
          </HrField>
          <HrField label="PT Registration">
            <HrInput value={f.pt_registration ?? ""} onChange={(e) => set("pt_registration", e.target.value)} placeholder="State PT no." />
          </HrField>
        </div>
        <FHG hints={["Universal Account Number · EPFO", "If gross salary ≤ ₹21,000 / month", "Professional Tax · State-specific"]} />
      </WizardBlock>

      {/* 03 · Bank details */}
      <WizardBlock title="03 · Bank details">
        <div className="grid grid-cols-3 gap-6">
          <HrField label="Bank Name" required>
            <HrSelect value={f.bank_name ?? ""} onChange={(e) => set("bank_name", e.target.value)}>
              <option value="">Select bank...</option>
              {BANKS.map((b) => <option key={b}>{b}</option>)}
            </HrSelect>
          </HrField>
          <HrField label="Account Number" required>
            <HrInput value={f.account_number ?? ""} onChange={(e) => set("account_number", e.target.value)} placeholder="Account number" />
          </HrField>
          <HrField label="IFSC Code" required>
            <HrInput value={f.ifsc_code ?? ""} onChange={(e) => set("ifsc_code", e.target.value)} placeholder="e.g. SBIN0001234" />
          </HrField>
        </div>
        <FHG hints={[null, "Masked after save", "11-character IFSC"]} />
      </WizardBlock>
    </div>
  );
}

// --- Step 6: Qualifications ---
function StepQualifications({ f, set }: { f: FormData; set: (k: string, v: string) => void }) {
  type Qual = { degree: string; university: string; year: string; spec: string; pct: string };
  type Prev = { employer: string; designation: string; experience: string; from: string; to: string; salary: string };
  const [quals, setQuals] = useState<Qual[]>([{ degree: "", university: "", year: "", spec: "", pct: "" }]);
  const [prevs, setPrevs] = useState<Prev[]>([{ employer: "", designation: "", experience: "", from: "", to: "", salary: "" }]);

  const setQ = (i: number, k: keyof Qual, v: string) => setQuals((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const setP = (i: number, k: keyof Prev, v: string) => setPrevs((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  return (
    <div className="flex flex-col gap-8">

      {/* 01 · Academic qualifications */}
      <WizardBlock
        title="01 · Academic qualifications"
        right={<AddRowBtn onClick={() => setQuals((p) => [...p, { degree: "", university: "", year: "", spec: "", pct: "" }])} label="Add qualification" />}
      >
        {quals.map((q, i) => (
          <div key={i} className="flex flex-col gap-5 pb-5 border-b border-[#F1F5F9] last:border-0 last:pb-0">
            <div className="grid grid-cols-3 gap-6">
              <HrField label="Degree / Qualification" required>
                <HrSelect value={q.degree} onChange={(e) => setQ(i, "degree", e.target.value)}>
                  <option value="">Select...</option>
                  {DEGREES.map((d) => <option key={d}>{d}</option>)}
                </HrSelect>
              </HrField>
              <HrField label="University / Board">
                <HrInput value={q.university} onChange={(e) => setQ(i, "university", e.target.value)} placeholder="University or board name" />
              </HrField>
              <HrField label="Year of Passing">
                <HrInput type="number" value={q.year} onChange={(e) => setQ(i, "year", e.target.value)} placeholder="e.g. 2018" min={1990} max={new Date().getFullYear()} />
              </HrField>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <HrField label="Specialisation / Subject">
                <HrInput value={q.spec} onChange={(e) => setQ(i, "spec", e.target.value)} placeholder="e.g. Mathematics" />
              </HrField>
              <HrField label="Percentage / CGPA">
                <HrInput value={q.pct} onChange={(e) => setQ(i, "pct", e.target.value)} placeholder="e.g. 78% or 8.5 CGPA" />
              </HrField>
            </div>
          </div>
        ))}
      </WizardBlock>

      {/* 02 · Teaching certifications */}
      <WizardBlock title="02 · Teaching certifications">
        <div className="grid grid-cols-3 gap-6">
          <HrField label="B.Ed Registration No.">
            <HrInput value={f.bed_reg_no ?? ""} onChange={(e) => set("bed_reg_no", e.target.value)} placeholder="Registration number" />
          </HrField>
          <HrField label="CTET / STET Score">
            <HrInput value={f.ctet_score ?? ""} onChange={(e) => set("ctet_score", e.target.value)} placeholder="e.g. 115 / 150" />
          </HrField>
          <HrField label="Subjects Qualified">
            <HrInput value={f.subjects_qualified ?? ""} onChange={(e) => set("subjects_qualified", e.target.value)} placeholder="e.g. Maths, Science" />
          </HrField>
        </div>
      </WizardBlock>

      {/* 03 · Previous employment */}
      <WizardBlock
        title="03 · Previous employment"
        right={<AddRowBtn onClick={() => setPrevs((p) => [...p, { employer: "", designation: "", experience: "", from: "", to: "", salary: "" }])} label="Add employer" />}
      >
        {prevs.map((pe, i) => (
          <div key={i} className="flex flex-col gap-5 pb-5 border-b border-[#F1F5F9] last:border-0 last:pb-0">
            <div className="grid grid-cols-3 gap-6">
              <HrField label="Previous Employer">
                <HrInput value={pe.employer} onChange={(e) => setP(i, "employer", e.target.value)} placeholder="School / Organisation" />
              </HrField>
              <HrField label="Designation Held">
                <HrInput value={pe.designation} onChange={(e) => setP(i, "designation", e.target.value)} placeholder="e.g. Senior Teacher" />
              </HrField>
              <HrField label="Total Experience (yrs)">
                <HrInput type="number" min={0} value={pe.experience} onChange={(e) => setP(i, "experience", e.target.value)} placeholder="e.g. 3" />
              </HrField>
            </div>
            <div className="grid grid-cols-3 gap-6">
              <HrField label="From Date">
                <HrInput type="date" value={pe.from} onChange={(e) => setP(i, "from", e.target.value)} />
              </HrField>
              <HrField label="To Date">
                <HrInput type="date" value={pe.to} onChange={(e) => setP(i, "to", e.target.value)} />
              </HrField>
              <HrField label="Last Drawn Salary">
                <HrInput type="number" min={0} value={pe.salary} onChange={(e) => setP(i, "salary", e.target.value)} placeholder="Monthly gross" />
              </HrField>
            </div>
          </div>
        ))}
      </WizardBlock>
    </div>
  );
}

// --- Step 7: Medical & Fitness ---
function StepMedical({ f, set }: { f: FormData; set: (k: string, v: string) => void }) {
  return (
    <div className="flex flex-col gap-8">

      {/* 01 · Medical fitness */}
      <WizardBlock title="01 · Medical fitness">
        <div className="grid grid-cols-3 gap-6">
          <HrField label="Medical Fitness Certificate">
            <HrInput value={f.med_cert_no ?? ""} onChange={(e) => set("med_cert_no", e.target.value)} placeholder="Certificate no." />
          </HrField>
          <HrField label="Date of Medical Exam">
            <HrInput type="date" value={f.med_exam_date ?? ""} onChange={(e) => set("med_exam_date", e.target.value)} />
          </HrField>
          <HrField label="Certificate Valid Till">
            <HrInput type="date" value={f.cert_valid_till ?? ""} onChange={(e) => set("cert_valid_till", e.target.value)} />
          </HrField>
        </div>
        <div>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] border border-[#E2E8F0] text-[12.5px] font-[600] text-[#475569] bg-white hover:bg-[#f8fafc]"
          >
            <Upload size={13} /> Upload PDF / JPG
          </button>
          <span className="text-[11px] text-[#94A3B8] ml-1">No file chosen</span>
        </div>
      </WizardBlock>

      {/* 02 · Accessibility & special needs */}
      <WizardBlock title="02 · Accessibility &amp; special needs">
        <TipBox type="info">
          This information is confidential and used only for providing appropriate workplace support. It does not affect employment status.
        </TipBox>
        <div className="grid grid-cols-2 gap-6">
          <HrField label="Accessibility / Disability Status">
            <HrSelect value={f.disability_status ?? ""} onChange={(e) => set("disability_status", e.target.value)}>
              <option value="">Select...</option>
              {DISABILITY_STATUSES.map((d) => <option key={d}>{d}</option>)}
            </HrSelect>
          </HrField>
          <HrField label="Disability Certificate No.">
            <HrInput value={f.disability_cert_no ?? ""} onChange={(e) => set("disability_cert_no", e.target.value)} placeholder="Certificate number" />
          </HrField>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <HrField label="Disability Percentage (%)">
            <HrInput type="number" min={0} max={100} value={f.disability_pct ?? ""} onChange={(e) => set("disability_pct", e.target.value)} placeholder="e.g. 40" />
          </HrField>
          <HrField label="Issued by (Authority)">
            <HrInput value={f.disability_authority ?? ""} onChange={(e) => set("disability_authority", e.target.value)} placeholder="Issuing authority" />
          </HrField>
        </div>
        <div>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] border border-[#E2E8F0] text-[12.5px] font-[600] text-[#475569] bg-white hover:bg-[#f8fafc]"
          >
            <Upload size={13} /> Upload disability certificate
          </button>
        </div>
        <HrField label="Workplace Accommodations Required">
          <HrInput value={f.workplace_accommodations ?? ""} onChange={(e) => set("workplace_accommodations", e.target.value)} placeholder="Describe any accommodations needed..." />
        </HrField>
      </WizardBlock>

      {/* 03 · Transport staff — additional */}
      <WizardBlock title="03 · Transport staff — additional">
        <TipBox type="info">
          Applicable if role is Driver / Transport Staff. Leave blank for other staff.
        </TipBox>
        <div className="grid grid-cols-3 gap-6">
          <HrField label="Eye Exam Result">
            <HrInput value={f.eye_exam_result ?? ""} onChange={(e) => set("eye_exam_result", e.target.value)} placeholder="Pass / Fail" />
          </HrField>
          <HrField label="Colour Blindness Test">
            <HrSelect value={f.colour_blindness ?? ""} onChange={(e) => set("colour_blindness", e.target.value)}>
              <option value="">Select...</option>
              <option>Normal</option>
              <option>Mild</option>
              <option>Moderate</option>
              <option>Severe</option>
            </HrSelect>
          </HrField>
          <HrField label="Last DL Medical Exam">
            <HrInput type="date" value={f.dl_medical_exam ?? ""} onChange={(e) => set("dl_medical_exam", e.target.value)} />
          </HrField>
        </div>
      </WizardBlock>
    </div>
  );
}

// --- Step 8: Payroll Setup ---
function StepPayroll({ f, set }: { f: FormData; set: (k: string, v: string) => void }) {
  type CustomLine = { label: string; amount: string };
  const [customEarnings,  setCustomEarnings]  = useState<CustomLine[]>([]);
  const [customDeductions, setCustomDeductions] = useState<CustomLine[]>([]);

  const basic   = Number(f.basic_salary_input ?? 0);
  const hra     = Number(f.hra_input ?? 0);
  const da      = Number(f.da_input ?? 0);
  const ta      = Number(f.travel_allowance_input ?? 1600);
  const med     = Number(f.medical_allowance_input ?? 1250);
  const special = Number(f.special_allowance_input ?? 0);

  const gross = basic + hra + da + ta + med + special + customEarnings.reduce((s, l) => s + Number(l.amount || 0), 0);
  const pf    = Math.round(basic * 0.12);
  const esi   = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
  const pt    = gross > 15000 ? 200 : 0;
  const tds   = 0; // simplified
  const totalDed = pf + esi + pt + tds + customDeductions.reduce((s, l) => s + Number(l.amount || 0), 0);
  const netHome = gross - totalDed;

  return (
    <div className="flex flex-col gap-8">

      {/* 01 · CTC structure */}
      <WizardBlock title="01 · CTC structure">
        <div className="grid grid-cols-3 gap-6">
          <HrField label="Basic Salary / Month" required>
            <HrInput type="number" min={0} value={f.basic_salary_input ?? ""} onChange={(e) => set("basic_salary_input", e.target.value)} placeholder="0.00" />
          </HrField>
          <HrField label="HRA">
            <HrInput type="number" min={0} value={f.hra_input ?? ""} onChange={(e) => set("hra_input", e.target.value)} placeholder="0.00" />
          </HrField>
          <HrField label="DA">
            <HrInput type="number" min={0} value={f.da_input ?? ""} onChange={(e) => set("da_input", e.target.value)} placeholder="0.00" />
          </HrField>
        </div>
        <FHG hints={[null, "Metro = 50%, Non-metro = 40% of Basic", "Dearness Allowance"]} />
        <div className="grid grid-cols-3 gap-6">
          <HrField label="Travel Allowance">
            <HrInput type="number" min={0} value={f.travel_allowance_input ?? "1600"} onChange={(e) => set("travel_allowance_input", e.target.value)} placeholder="1600" />
          </HrField>
          <HrField label="Medical Allowance">
            <HrInput type="number" min={0} value={f.medical_allowance_input ?? "1250"} onChange={(e) => set("medical_allowance_input", e.target.value)} placeholder="1250" />
          </HrField>
          <HrField label="Special Allowance">
            <HrInput type="number" min={0} value={f.special_allowance_input ?? ""} onChange={(e) => set("special_allowance_input", e.target.value)} placeholder="0.00" />
          </HrField>
        </div>
      </WizardBlock>

      {/* 02 · Custom allowances */}
      <WizardBlock
        title="02 · Custom allowances"
        right={<AddRowBtn onClick={() => setCustomEarnings((p) => [...p, { label: "", amount: "" }])} label="Add allowance" />}
      >
        {customEarnings.length === 0 ? (
          <div className="text-[12.5px] text-[#94A3B8]">No custom allowances added. Click "+ Add allowance" to add one.</div>
        ) : (
          customEarnings.map((ce, i) => (
              <div className="flex gap-3 items-end">
              <HrField label="Allowance Name" >
                <HrInput value={ce.label} onChange={(e) => setCustomEarnings((p) => p.map((r, idx) => idx === i ? { ...r, label: e.target.value } : r))} placeholder="e.g. Shift allowance" />
              </HrField>
              <div style={{ width: 160 }}>
              <HrField label="Amount (₹ / month)">
                <HrInput type="number" min={0} value={ce.amount} onChange={(e) => setCustomEarnings((p) => p.map((r, idx) => idx === i ? { ...r, amount: e.target.value } : r))} placeholder="0" />
              </HrField>
              </div>
              <button
                type="button"
                onClick={() => setCustomEarnings((p) => p.filter((_, idx) => idx !== i))}
                className="h-[44px] w-[36px] flex items-center justify-center rounded-[11px] border border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2] shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))
        )}
      </WizardBlock>

      {/* 03 · Custom deductions */}
      <WizardBlock
        title="03 · Custom deductions"
        right={<AddRowBtn onClick={() => setCustomDeductions((p) => [...p, { label: "", amount: "" }])} label="Add deduction" />}
      >
        {customDeductions.length === 0 ? (
          <div className="text-[12.5px] text-[#94A3B8]">No custom deductions added. Click "+ Add deduction" to add one.</div>
        ) : (
          customDeductions.map((cd, i) => (
            <div key={i} className="flex gap-3 items-end">
              <HrField label="Deduction Name">
                <HrInput value={cd.label} onChange={(e) => setCustomDeductions((p) => p.map((r, idx) => idx === i ? { ...r, label: e.target.value } : r))} placeholder="e.g. Loan EMI" />
              </HrField>
              <div style={{ width: 160 }}>
              <HrField label="Amount (₹ / month)">
                <HrInput type="number" min={0} value={cd.amount} onChange={(e) => setCustomDeductions((p) => p.map((r, idx) => idx === i ? { ...r, amount: e.target.value } : r))} placeholder="0" />
              </HrField>
              </div>
              <button
                type="button"
                onClick={() => setCustomDeductions((p) => p.filter((_, idx) => idx !== i))}
                className="h-[44px] w-[36px] flex items-center justify-center rounded-[11px] border border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2] shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))
        )}
      </WizardBlock>

      {/* Live CTC Preview */}
      {basic > 0 && (
        <div className="rounded-[14px] p-[20px_24px]" style={{ background: "var(--soft)", border: "1.5px solid var(--brand)" }}>
          <div className="text-[14px] font-[700] mb-5" style={{ fontFamily: PF, color: "var(--brand)" }}>
            Live CTC Preview
          </div>
          <div className="grid grid-cols-2 gap-6">
            {/* Earnings */}
            <div>
              <div className="text-[10.5px] font-[800] uppercase tracking-[0.08em] text-[#64748B] mb-3">Earnings</div>
              <div className="flex flex-col gap-2">
                {[
                  ["Basic", basic],
                  ["HRA", hra],
                  ["DA", da],
                  ["Travel Allowance", ta],
                  ["Medical Allowance", med],
                  ["Special Allowance", special],
                  ...customEarnings.map((ce) => [ce.label || "Custom", Number(ce.amount || 0)]),
                ].map(([label, amount], i) => (
                  <div key={i} className="flex justify-between text-[12.5px]">
                    <span className="text-[#64748B]">{label as string}</span>
                    <span className="font-[600]">{(amount as number).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[12.5px] font-[800] border-t border-[#e2e8f0] pt-2 mt-1">
                  <span>Gross</span>
                  <span>{gross.toLocaleString()}</span>
                </div>
              </div>
            </div>
            {/* Deductions */}
            <div>
              <div className="text-[10.5px] font-[800] uppercase tracking-[0.08em] text-[#64748B] mb-3">Deductions</div>
              <div className="flex flex-col gap-2">
                {[
                  ["PF (12%)", pf],
                  ["ESI (0.75%)", esi],
                  ["PT", pt],
                  ["TDS", tds],
                  ...customDeductions.map((cd) => [cd.label || "Custom", Number(cd.amount || 0)]),
                ].map(([label, amount], i) => (
                  <div key={i} className="flex justify-between text-[12.5px]">
                    <span className="text-[#64748B]">{label as string}</span>
                    <span className="font-[600]">{(amount as number).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[12.5px] font-[800] border-t border-[#e2e8f0] pt-2 mt-1">
                  <span>Total Ded.</span>
                  <span>{totalDed.toLocaleString()}</span>
                </div>
              </div>
              {/* Net take home */}
              <div
                className="mt-4 rounded-[10px] px-4 py-3 text-white"
                style={{ background: "#15172A" }}
              >
                <div className="text-[10px] uppercase tracking-[0.08em] opacity-70">Net Take Home</div>
                <div className="text-[24px] font-[800] leading-tight mt-0.5">
                  ₹{netHome.toLocaleString()}
                </div>
                <div className="text-[11px] opacity-60">per month</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Step 9: Documents ---
const REQUIRED_DOCS = [
  "Aadhaar Card (self-attested copy)",
  "PAN Card",
  "Passport-size photographs (3 copies)",
  "Bank cancelled cheque or passbook copy",
  "Address proof (Aadhaar / utility bill)",
  "10th Marksheet and certificate",
  "12th Marksheet and certificate",
  "Degree / graduation certificate",
  "B.Ed / D.El.Ed certificate (teaching staff)",
  "Experience letter (previous employer)",
  "No-objection certificate (previous employer)",
  "Medical fitness certificate",
  "Police verification certificate",
];

type DocStatus = "pending" | "uploaded";

function StepDocuments() {
  const [docStates, setDocStates] = useState<Record<string, DocStatus>>(
    Object.fromEntries(REQUIRED_DOCS.map((d) => [d, "pending"]))
  );
  const uploaded = Object.values(docStates).filter((s) => s === "uploaded").length;

  return (
    <div className="flex flex-col gap-5">
      <TipBox type="success">
        Documents listed below are role-based. Add, preview or remove documents as needed. <strong>{uploaded} of {REQUIRED_DOCS.length}</strong> uploaded.
      </TipBox>
      <div className="flex flex-col divide-y divide-[#F1F5F9] border border-[#E8E8F0] rounded-[12px] overflow-hidden">
        {REQUIRED_DOCS.map((doc, i) => {
          const isUploaded = docStates[doc] === "uploaded";
          return (
            <div key={doc} className="flex items-center gap-3 px-4 py-3 bg-white">
              <span className="text-[12px] text-[#94A3B8] w-[20px] shrink-0 font-[600]">{i + 1}.</span>
              <span className="flex-1 text-[13px] font-[600] text-[#15172A]">{doc}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="text-[11.5px] font-[600] px-3 py-1.5 rounded-[8px] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setDocStates((p) => ({ ...p, [doc]: isUploaded ? "pending" : "uploaded" }))}
                  className="text-[11.5px] font-[600] px-3 py-1.5 rounded-[8px] border transition-colors"
                  style={{
                    background: isUploaded ? "var(--soft)" : "white",
                    borderColor: isUploaded ? "var(--brand)" : "#E2E8F0",
                    color: isUploaded ? "var(--brand)" : "#475569",
                  }}
                >
                  {isUploaded ? "Uploaded ✓" : "Upload"}
                </button>
                <span
                  className="text-[11px] font-[600] px-2.5 py-1 rounded-[6px]"
                  style={{
                    background: isUploaded ? "#dcfce7" : "#fef3c7",
                    color: isUploaded ? "#15803d" : "#92400e",
                  }}
                >
                  {isUploaded ? "Done" : "Pending"}
                </span>
                <button
                  type="button"
                  onClick={() => setDocStates((p) => ({ ...p, [doc]: "pending" }))}
                  className="text-[11.5px] font-[600] px-3 py-1.5 rounded-[8px] border border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2]"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Step 10: Review & Onboard ---
function StepReview({
  f, set, departments, designations,
}: {
  f: FormData;
  set: (k: string, v: string) => void;
  departments: { id: number; name: string }[];
  designations: { id: number; name: string }[];
}) {
  const deptName  = departments.find((d) => String(d.id) === String(f.department))?.name;
  const desigName = designations.find((d) => String(d.id) === String(f.designation))?.name;
  const fullName  = [f.first_name, f.middle_name, f.last_name].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-6">
      {/* Ready to onboard banner */}
      <div className="rounded-[12px] p-[16px_20px]" style={{ background: "#ecfdf5", border: "1px solid #bbf7d0" }}>
        <div className="text-[14px] font-[800] text-[#065f46] mb-1" style={{ fontFamily: PF }}>Ready to onboard</div>
        <div className="text-[12.5px] text-[#065f46] opacity-80">
          Review identity, role, contact, documents and payroll before enrolling the staff member. You can still edit each section after saving.
        </div>
      </div>

      {/* Profile + Operational summary */}
      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-[12px] border border-[#E8E8F0] p-[16px_18px] bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12.5px] font-[700] text-[#15172A]" style={{ fontFamily: PF }}>Profile summary</div>
            <span className="text-[10px] font-[800] uppercase tracking-[0.06em] px-2 py-0.5 rounded-[5px] bg-[#fef3c7] text-[#92400e]">Required</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              ["Full Name",  fullName || "—"],
              ["Gender",     f.gender || "—"],
              ["DOB",        f.date_of_birth || "—"],
              ["Mobile",     f.mobile || "—"],
              ["Email",      f.official_email || "—"],
              ["Nationality",f.nationality || "—"],
            ].map(([k, v]) => (
              <div key={k as string} className="flex gap-2 text-[12px]">
                <span className="text-[#94A3B8] w-[90px] shrink-0">{k}</span>
                <span className="font-[600] text-[#15172A]">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[12px] border border-[#E8E8F0] p-[16px_18px] bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12.5px] font-[700] text-[#15172A]" style={{ fontFamily: PF }}>Operational summary</div>
            <span className="text-[10px] font-[800] uppercase tracking-[0.06em] px-2 py-0.5 rounded-[5px] bg-[#fef3c7] text-[#92400e]">Required</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              ["Department",  deptName || "—"],
              ["Designation", desigName || "—"],
              ["Emp. Type",   f.employment_type || "—"],
              ["Joining",     f.joining_date || "—"],
              ["Basic Salary",f.basic_salary_input ? `₹${Number(f.basic_salary_input).toLocaleString()}` : "—"],
              ["Bank",        f.bank_name || "—"],
            ].map(([k, v]) => (
              <div key={k as string} className="flex gap-2 text-[12px]">
                <span className="text-[#94A3B8] w-[90px] shrink-0">{k}</span>
                <span className="font-[600] text-[#15172A]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create login | Send welcome | Activate attendance */}
      <div className="grid grid-cols-3 gap-6">
        <HrField label="Create Login">
          <HrSelect value={f.create_login ?? ""} onChange={(e) => set("create_login", e.target.value)}>
            <option value="">Select...</option>
            <option value="yes_email">Yes — Send via email</option>
            <option value="yes_sms">Yes — Send via SMS</option>
            <option value="no">No — Skip for now</option>
          </HrSelect>
        </HrField>
        <HrField label="Send Welcome Message">
          <HrSelect value={f.send_welcome ?? ""} onChange={(e) => set("send_welcome", e.target.value)}>
            <option value="">Select...</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="both">Both</option>
            <option value="no">No</option>
          </HrSelect>
        </HrField>
        <HrField label="Activate Attendance">
          <HrSelect value={f.activate_attendance ?? ""} onChange={(e) => set("activate_attendance", e.target.value)}>
            <option value="">Select...</option>
            <option value="immediately">Immediately</option>
            <option value="joining_date">From joining date</option>
            <option value="manual">Activate manually later</option>
          </HrSelect>
        </HrField>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function HrOnboardPage() {
  const [step,         setStep]         = useState(1);
  const [form,         setForm]         = useState<FormData>({ status: "active" });
  const [saving,       setSaving]       = useState(false);
  const [done,         setDone]         = useState(false);
  const [showQrBanner, setShowQrBanner] = useState(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: allDeptData } = useAllDepartments();
  const { data: desigData }   = useDesignations();
  const { data: staffData }   = useStaffList();
  const { toast }             = useHrToast();

  const departments  = allDeptData?.results ?? [];
  const designations = desigData?.results ?? [];
  const staffList    = (staffData?.results ?? []) as { id: number; first_name: string; last_name: string }[];
  const staffCount   = staffData?.count ?? 0;

  const setField = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const goNext   = () => setStep((s) => Math.min(s + 1, TOTAL));
  const goPrev   = () => setStep((s) => Math.max(s - 1, 1));

  const currentStep = ALL_STEPS.find((s: StepDef) => s.num === step) ?? ALL_STEPS[0];
  const progress    = Math.round((step / TOTAL) * 100);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name || !form.department || !form.designation || !form.joining_date) {
      toast("Fill in required fields: Name, Department, Designation, Joining Date", "error");
      return;
    }
    setSaving(true);
    try {
      await createStaff({ ...form, basic_salary: form.basic_salary_input ? Number(form.basic_salary_input) : 0 });
      toast("Staff onboarded successfully!");
      setDone(true);
    } catch {
      toast("Failed to save staff. Please check the form.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Success screen
  if (done) {
    return (
      <div
        className="bg-white border border-[#E8E8F0] rounded-[14px] p-[72px_28px] text-center"
        style={{ boxShadow: "0 2px 8px -2px rgba(15,18,34,0.07)" }}
      >
        <div className="text-[56px] mb-4">🎉</div>
        <h2 className="text-[28px] font-[800] m-0 text-[#15172A]">
          Staff{" "}
          <em className="not-italic" style={{ fontFamily: "var(--serif)", color: "var(--brand)" }}>Onboarded!</em>
        </h2>
        <p className="text-[var(--muted)] mt-3 mb-6">
          {[form.first_name, form.last_name].filter(Boolean).join(" ")} has been successfully onboarded and added to your staff directory.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => { setForm({ status: "active" }); setStep(1); setDone(false); setPhotoPreview(null); }}
            className="px-5 py-2 rounded-[10px] text-[13px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]"
          >
            Onboard another
          </button>
          <button
            onClick={() => { window.location.href = "/hr/directory"; }}
            className="px-5 py-2 rounded-[10px] text-[13px] font-[700] text-white"
            style={{ background: "var(--brand)" }}
          >
            View Directory
          </button>
        </div>
      </div>
    );
  }

  // Main layout
  return (
    <div className="flex flex-col" style={{ paddingBottom: "72px", marginLeft: "-20px", marginRight: "-20px", marginBottom: "-40px" }}>
      {/* Hidden photo file input */}
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

      {/* Page header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-[28px] font-[900] text-[#15172A] m-0 leading-tight">
            Onboard a{" "}
            <em className="not-italic font-[400]" style={{ fontFamily: "var(--serif)", color: "var(--brand)" }}>
              staff member
            </em>
          </h1>
          <p className="text-[13px] text-[#5B5E72] mt-1 m-0 max-w-[520px]">
            Create a staff profile, assign department and role, collect statutory details, documents, payroll setup
            and attendance-ready access.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E8E8F0] text-[12px] font-[600] text-[#475569]"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            >
              <span className="w-[7px] h-[7px] rounded-full bg-green-500 inline-block" />
              Draft saved
            </div>
            <div className="text-right">
              <div className="text-[28px] font-[900] text-[#15172A] leading-none">{staffCount}</div>
              <div className="text-[9.5px] font-[700] uppercase tracking-[0.1em] text-[#94A3B8]">Current Staff</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toast("2 drafts saved", "info")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]"
            >
              Drafts <span className="text-[10px] font-[800] px-1 py-0.5 rounded-[4px] bg-[#F1F5F9]">2</span>
            </button>
            <button
              onClick={() => toast("AI Assist coming soon", "info")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-[700] border border-[#ddd6fe] text-[var(--brand)] bg-[var(--soft)] hover:bg-[#e5dfff]"
            >
              <Sparkles size={12} /> AI Assist
            </button>
            <button
              onClick={() => toast("PDF generation coming soon", "info")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]"
            >
              <FileText size={12} /> PDF
            </button>
            <button
              onClick={() => toast("Documents checklist: NIN, Photos, Certs, Offer letter", "info")}
              className="px-3 py-1.5 rounded-[8px] text-[12.5px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]"
            >
              What I&apos;ll need
            </button>
          </div>
        </div>
      </div>

      {/* QR Scan banner */}
      {showQrBanner && (
        <div
          className="flex items-center gap-4 mb-5 px-[20px] py-[14px] rounded-[12px] text-white relative"
          style={{ background: "#15172A" }}
        >
          <div
            className="w-[36px] h-[36px] rounded-[8px] flex items-center justify-center shrink-0"
            style={{ background: "var(--brand)" }}
          >
            <QrCode size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[13.5px] font-[800]">Scan to pre-fill</span>
              <span className="text-[9px] font-[900] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-[4px] bg-[var(--brand)]">NEW</span>
            </div>
            <p className="text-[12px] opacity-70 m-0">
              Got Aadhaar QR, PAN, previous employment record, or joining form? Scan it once and staff onboarding fields will be prepared.
            </p>
          </div>
          <button
            onClick={() => toast("QR scanner coming soon", "info")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[13px] font-[700] border border-white/20 hover:bg-white/10 transition-colors shrink-0"
          >
            Scan now
          </button>
          <button
            onClick={() => setShowQrBanner(false)}
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Sidebar + Step content */}
      <div className="flex gap-6 items-start">
        <WizardNav step={step} onGo={setStep} />

        <div className="flex-1 min-w-0">
          <div
            className="bg-white border border-[#E8E8F0] rounded-[14px] pt-[36px] pb-[28px] px-[48px] flex flex-col"
            style={{ boxShadow: "0 2px 8px -2px rgba(15,18,34,0.07)" }}
          >
            {/* Step card header */}
            <div className="flex items-start justify-between mb-[4px]">
              <h2 className="m-0 text-[24px] font-[800] text-[#15172A] leading-tight">
                {(() => {
                  const i = currentStep.label.lastIndexOf(" ");
                  if (i === -1) return (
                    <em className="italic font-[400]" style={{ fontFamily: 'var(--font-playfair),"Playfair Display",Georgia,serif', color: "var(--brand)" }}>
                      {currentStep.label}
                    </em>
                  );
                  return (
                    <>
                      {currentStep.label.slice(0, i)}{" "}
                      <em className="italic font-[400]" style={{ fontFamily: 'var(--font-playfair),"Playfair Display",Georgia,serif', color: "var(--brand)" }}>
                        {currentStep.label.slice(i + 1)}
                      </em>
                    </>
                  );
                })()}
              </h2>
              <span className="text-[13px] font-[700] text-[#94A3B8] shrink-0 ml-4 mt-1">{step}/{TOTAL}</span>
            </div>
            <p className="text-[13px] text-[#94A3B8] mt-1 mb-9">{currentStep.sub}</p>

            {/* Step content */}
            {step === 1 && (
              <StepIdentity
                f={form}
                set={setField}
                photoPreview={photoPreview}
                onPhotoClick={() => photoInputRef.current?.click()}
              />
            )}
            {step === 2 && <StepRole f={form} set={setField} departments={departments} designations={designations} staffList={staffList} />}
            {step === 3 && <StepContact f={form} set={setField} />}
            {step === 4 && <StepFamily  f={form} set={setField} />}
            {step === 5 && <StepGovId   f={form} set={setField} />}
            {step === 6 && <StepQualifications f={form} set={setField} />}
            {step === 7 && <StepMedical f={form} set={setField} />}
            {step === 8 && <StepPayroll f={form} set={setField} />}
            {step === 9 && <StepDocuments />}
            {step === 10 && <StepReview f={form} set={setField} departments={departments} designations={designations} />}

            {/* In-card next step nav */}
            {step < TOTAL && (
              <div className="flex justify-end mt-8 pt-4 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={goNext}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[13px] font-[700] text-white"
                  style={{ background: "var(--brand)" }}
                >
                  {ALL_STEPS[step]?.label} →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky footer bar */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8E8F0] z-[100]"
        style={{ boxShadow: "0 -2px 8px -2px rgba(15,18,34,0.07)" }}
      >
        {/* Progress bar */}
        <div className="h-[3px] bg-[#F1F5F9]">
          <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: "var(--brand)" }} />
        </div>
        {/* Footer row */}
        <div className="flex items-center justify-between px-8 py-[10px]">
          <span className="text-[12.5px] font-[700] text-[#475569] shrink-0">Step {step} / {TOTAL}</span>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => { setForm({ status: "active" }); setStep(1); setPhotoPreview(null); }}
              className="px-3 py-1.5 text-[12.5px] font-[600] text-[#EF4444] hover:bg-red-50 rounded-[8px] transition-colors"
            >
              Discard
            </button>
            <button
              onClick={() => toast("Draft saved", "success")}
              className="px-3 py-1.5 rounded-[8px] text-[12.5px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]"
            >
              Save draft
            </button>
            <button
              onClick={() => toast("Upload signed document — coming soon", "info")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]"
            >
              <Upload size={11} /> Upload signed
            </button>
            <button
              onClick={() => toast("Blank form download — coming soon", "info")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-[12.5px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]"
            >
              Blank form <ChevronDown size={11} />
            </button>
            <button
              onClick={() => toast("QR scan to fill — coming soon", "info")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]"
            >
              <QrCode size={11} /> Scan &amp; fill
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]"
            >
              <Printer size={11} /> Print / PDF
            </button>
            {step > 1 && (
              <button
                onClick={goPrev}
                className="px-4 py-2 rounded-[10px] text-[13px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]"
              >
                Back
              </button>
            )}
            {step < TOTAL ? (
              <button
                onClick={goNext}
                className="px-5 py-2 rounded-[10px] text-[13px] font-[700] text-white"
                style={{ background: "var(--brand)" }}
              >
                Next
              </button>
            ) : (
              <button
                onClick={() => void handleSubmit()}
                disabled={saving}
                className="px-5 py-2 rounded-[10px] text-[13px] font-[700] text-white disabled:opacity-60"
                style={{ background: "var(--brand)" }}
              >
                {saving ? "Saving..." : "Submit & Onboard"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
