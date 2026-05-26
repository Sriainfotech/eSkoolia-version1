"use client";
/**
 * HR Onboard — 10-step wizard for onboarding a new staff member.
 * 2-col layout: 280px sticky WizardNav + main step content.
 */
import { useState } from "react";
import { CheckCircle, ChevronRight } from "lucide-react";
import {
  HrButton, HrBadge, HrField, HrInput, HrSelect, HrTextarea,
  HrHero, useHrToast,
} from "@/components/hr/HrUi";
import { useDepartments, useDesignations, createStaff } from "@/hooks/useHrApi";
import type { Staff } from "@/types/hr";

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"] as const;
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const MARITAL_STATUS = ["Single", "Married", "Divorced", "Widowed"] as const;
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Visiting Guest"] as const;
const RELIGIONS = ["Islam", "Christianity", "Hinduism", "Buddhism", "Other", "None"] as const;
const ROLES = ["Teacher", "Admin", "Finance", "Support", "Transport", "Library"] as const;
const SALARY_MODES = ["Monthly", "Bi-monthly", "Weekly", "Daily"] as const;
const BANKS = ["GTBank", "Access Bank", "First Bank", "UBA", "Zenith Bank", "Polaris Bank", "Other"] as const;

const STEPS = [
  { key: "identity",       label: "Identity",          icon: "👤" },
  { key: "role",           label: "Role & Dept",        icon: "🏢" },
  { key: "contact",        label: "Contact",            icon: "📞" },
  { key: "family",         label: "Family & Emergency", icon: "👨‍👩‍👧" },
  { key: "gov_id",         label: "Govt. IDs",          icon: "🪪" },
  { key: "qualifications", label: "Qualifications",     icon: "🎓" },
  { key: "medical",        label: "Medical",            icon: "🏥" },
  { key: "payroll",        label: "Payroll",            icon: "💰" },
  { key: "documents",      label: "Documents",          icon: "📎" },
  { key: "review",         label: "Review & Submit",    icon: "✅" },
];

type FormData = Partial<Staff & {
  // Extra onboard-only fields
  emergency_name: string;
  emergency_phone: string;
  emergency_relation: string;
  nin: string;
  passport_number: string;
  pension_id: string;
  tax_id: string;
  blood_group: string;
  medical_conditions: string;
  qualifications_summary: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  salary_mode: string;
  basic_salary: string;
}>;

function SideNav({ step, steps, onClick }: { step: number; steps: typeof STEPS; onClick: (i: number) => void }) {
  return (
    <div
      className="sticky top-[108px] self-start flex flex-col gap-0 w-[260px] shrink-0 bg-white border border-[var(--line)] rounded-[14px] overflow-hidden"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="p-[14px_16px] bg-gradient-to-br from-[var(--brand)] to-[var(--strong)] text-white">
        <div className="text-[12px] font-[700] uppercase tracking-[0.08em] opacity-80 mb-[4px]">Onboarding Wizard</div>
        <div className="text-[22px] font-[800]">{steps[step - 1]?.label}</div>
        <div className="text-[12px] opacity-70 mt-1">Step {step} of {steps.length}</div>
        {/* Progress bar */}
        <div className="mt-3 h-[5px] rounded-full bg-white/30 overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-500"
            style={{ width: `${(step / steps.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-0">
        {steps.map((s, i) => {
          const num = i + 1;
          const done = num < step;
          const active = num === step;
          return (
            <button
              key={s.key}
              onClick={() => onClick(num)}
              className="flex items-center gap-3 px-4 py-[10px] text-left transition-colors border-b border-[#f1f5f9] last:border-0"
              style={{
                background: active ? "var(--soft)" : "transparent",
                color: active ? "var(--brand)" : done ? "#22c55e" : "#64748b",
                borderLeft: active ? "3px solid var(--brand)" : "3px solid transparent",
              }}
            >
              <span className="w-[24px] h-[24px] rounded-full flex items-center justify-center text-[11px] font-[900]"
                style={{ background: done ? "#22c55e" : active ? "var(--brand)" : "#f1f5f9", color: done || active ? "white" : "#64748b" }}
              >
                {done ? "✓" : num}
              </span>
              <div>
                <div className="text-[12px] font-[750]">{s.label}</div>
              </div>
              {active && <ChevronRight size={14} className="ml-auto" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Individual Step components ───────────────────────────────────────────────
function StepIdentity({ f, set }: { f: FormData; set: (k: string, v: string) => void }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-4">
        <HrField label="First Name" required>
          <HrInput value={f.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} placeholder="Ahmed" />
        </HrField>
        <HrField label="Middle Name">
          <HrInput value={f.middle_name ?? ""} onChange={(e) => set("middle_name", e.target.value)} />
        </HrField>
        <HrField label="Last Name" required>
          <HrInput value={f.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} placeholder="Ibrahim" />
        </HrField>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <HrField label="Gender" required>
          <HrSelect value={f.gender ?? ""} onChange={(e) => set("gender", e.target.value)}>
            <option value="">Select…</option>
            {GENDERS.map((g) => <option key={g}>{g}</option>)}
          </HrSelect>
        </HrField>
        <HrField label="Date of Birth">
          <HrInput type="date" value={f.date_of_birth ?? ""} onChange={(e) => set("date_of_birth", e.target.value)} />
        </HrField>
        <HrField label="Nationality">
          <HrInput value={f.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} placeholder="Nigerian" />
        </HrField>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <HrField label="Marital Status">
          <HrSelect value={f.marital_status ?? ""} onChange={(e) => set("marital_status", e.target.value)}>
            <option value="">Select…</option>
            {MARITAL_STATUS.map((m) => <option key={m}>{m}</option>)}
          </HrSelect>
        </HrField>
        <HrField label="Religion">
          <HrSelect value={f.religion ?? ""} onChange={(e) => set("religion", e.target.value)}>
            <option value="">Select…</option>
            {RELIGIONS.map((r) => <option key={r}>{r}</option>)}
          </HrSelect>
        </HrField>
        <HrField label="Blood Group">
          <HrSelect value={f.blood_group ?? ""} onChange={(e) => set("blood_group", e.target.value)}>
            <option value="">Select…</option>
            {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
          </HrSelect>
        </HrField>
      </div>
    </div>
  );
}

function StepRole({
  f, set, departments, designations,
}: {
  f: FormData;
  set: (k: string, v: string) => void;
  departments: { id: number; name: string }[];
  designations: { id: number; name: string; department: number }[];
}) {
  const filteredDesig = designations.filter(
    (d) => !f.department || String(d.department) === String(f.department)
  );
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <HrField label="Department" required>
          <HrSelect value={f.department ?? ""} onChange={(e) => set("department", e.target.value)}>
            <option value="">Select…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </HrSelect>
        </HrField>
        <HrField label="Designation" required>
          <HrSelect value={f.designation ?? ""} onChange={(e) => set("designation", e.target.value)}>
            <option value="">Select…</option>
            {filteredDesig.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </HrSelect>
        </HrField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <HrField label="Employment Type" required>
          <HrSelect value={f.employment_type ?? ""} onChange={(e) => set("employment_type", e.target.value)}>
            <option value="">Select…</option>
            {EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </HrSelect>
        </HrField>
        <HrField label="Role">
          <HrSelect value={f.role ?? ""} onChange={(e) => set("role", e.target.value)}>
            <option value="">Select…</option>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </HrSelect>
        </HrField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <HrField label="Joining Date" required>
          <HrInput type="date" value={f.joining_date ?? ""} onChange={(e) => set("joining_date", e.target.value)} />
        </HrField>
        <HrField label="Staff ID">
          <HrInput value={f.staff_id ?? ""} onChange={(e) => set("staff_id", e.target.value)} placeholder="Auto-generated if blank" />
        </HrField>
      </div>
    </div>
  );
}

function StepContact({ f, set }: { f: FormData; set: (k: string, v: string) => void }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <HrField label="Phone Number" required>
          <HrInput value={f.phone_number ?? ""} onChange={(e) => set("phone_number", e.target.value)} placeholder="+234 803 000 0000" />
        </HrField>
        <HrField label="Email">
          <HrInput type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="staff@school.com" />
        </HrField>
      </div>
      <HrField label="Home Address">
        <HrTextarea value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="Full residential address…" />
      </HrField>
      <div className="grid grid-cols-2 gap-4">
        <HrField label="City">
          <HrInput value={f.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="Lagos" />
        </HrField>
        <HrField label="State">
          <HrInput value={f.state ?? ""} onChange={(e) => set("state", e.target.value)} placeholder="Lagos" />
        </HrField>
      </div>
    </div>
  );
}

function StepFamily({ f, set }: { f: FormData; set: (k: string, v: string) => void }) {
  return (
    <div className="grid gap-4">
      <div className="text-[13px] font-[700] text-[var(--muted)] uppercase tracking-[0.08em]">Emergency Contact</div>
      <div className="grid grid-cols-3 gap-4">
        <HrField label="Contact Name">
          <HrInput value={f.emergency_name ?? ""} onChange={(e) => set("emergency_name", e.target.value)} placeholder="Jane Doe" />
        </HrField>
        <HrField label="Phone">
          <HrInput value={f.emergency_phone ?? ""} onChange={(e) => set("emergency_phone", e.target.value)} />
        </HrField>
        <HrField label="Relationship">
          <HrInput value={f.emergency_relation ?? ""} onChange={(e) => set("emergency_relation", e.target.value)} placeholder="Spouse, Parent…" />
        </HrField>
      </div>
    </div>
  );
}

function StepGovId({ f, set }: { f: FormData; set: (k: string, v: string) => void }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <HrField label="National ID (NIN)">
          <HrInput value={f.nin ?? ""} onChange={(e) => set("nin", e.target.value)} maxLength={11} placeholder="12345678901" />
        </HrField>
        <HrField label="Passport Number">
          <HrInput value={f.passport_number ?? ""} onChange={(e) => set("passport_number", e.target.value)} />
        </HrField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <HrField label="Pension ID">
          <HrInput value={f.pension_id ?? ""} onChange={(e) => set("pension_id", e.target.value)} />
        </HrField>
        <HrField label="Tax ID (TIN)">
          <HrInput value={f.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value)} />
        </HrField>
      </div>
    </div>
  );
}

function StepQualifications({ f, set }: { f: FormData; set: (k: string, v: string) => void }) {
  return (
    <div className="grid gap-4">
      <HrField label="Highest Qualification">
        <HrInput value={f.highest_qualification ?? ""} onChange={(e) => set("highest_qualification", e.target.value)} placeholder="B.Sc Computer Science, University of Lagos" />
      </HrField>
      <HrField label="Other Qualifications / Certifications">
        <HrTextarea
          value={f.qualifications_summary ?? ""} rows={4}
          onChange={(e) => set("qualifications_summary", e.target.value)}
          placeholder="List other certificates, year obtained, and awarding body…"
        />
      </HrField>
    </div>
  );
}

function StepMedical({ f, set }: { f: FormData; set: (k: string, v: string) => void }) {
  return (
    <div className="grid gap-4">
      <HrField label="Blood Group">
        <HrSelect value={f.blood_group ?? ""} onChange={(e) => set("blood_group", e.target.value)}>
          <option value="">Select…</option>
          {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
        </HrSelect>
      </HrField>
      <HrField label="Known Medical Conditions / Allergies">
        <HrTextarea
          value={f.medical_conditions ?? ""} rows={4}
          onChange={(e) => set("medical_conditions", e.target.value)}
          placeholder="List any known conditions or write 'None'…"
        />
      </HrField>
    </div>
  );
}

function StepPayroll({ f, set }: { f: FormData; set: (k: string, v: string) => void }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <HrField label="Basic Salary (₦)">
          <HrInput
            type="number" min={0}
            value={f.basic_salary ?? ""}
            onChange={(e) => set("basic_salary", e.target.value)}
            placeholder="0.00"
          />
        </HrField>
        <HrField label="Payment Schedule">
          <HrSelect value={f.salary_mode ?? "Monthly"} onChange={(e) => set("salary_mode", e.target.value)}>
            {SALARY_MODES.map((m) => <option key={m}>{m}</option>)}
          </HrSelect>
        </HrField>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <HrField label="Bank Name">
          <HrSelect value={f.bank_name ?? ""} onChange={(e) => set("bank_name", e.target.value)}>
            <option value="">Select…</option>
            {BANKS.map((b) => <option key={b}>{b}</option>)}
          </HrSelect>
        </HrField>
        <HrField label="Account Name">
          <HrInput value={f.account_name ?? ""} onChange={(e) => set("account_name", e.target.value)} placeholder="Ahmed I. Musa" />
        </HrField>
        <HrField label="Account Number">
          <HrInput value={f.account_number ?? ""} onChange={(e) => set("account_number", e.target.value)} maxLength={10} placeholder="0123456789" />
        </HrField>
      </div>

      {/* CTC Preview card */}
      {f.basic_salary && (
        <div
          className="rounded-[12px] p-[16px_20px] mt-2"
          style={{ background: "var(--soft)", border: "1px solid var(--brand)" }}
        >
          <div className="text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--brand)] mb-3">CTC Preview</div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Basic Salary", amount: Number(f.basic_salary) },
              { label: "Housing (15%)", amount: Number(f.basic_salary) * 0.15 },
              { label: "Transport (10%)", amount: Number(f.basic_salary) * 0.10 },
            ].map(({ label, amount }) => (
              <div key={label} className="bg-white rounded-[8px] p-2">
                <div className="text-[10px] text-[var(--muted)]">{label}</div>
                <div className="text-[13px] font-[800] text-[var(--brand)]">
                  ₦{amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-right text-[13px] font-[800]">
            Total CTC: ₦{(Number(f.basic_salary) * 1.25).toLocaleString("en-NG", { minimumFractionDigits: 2 })} / month
          </div>
        </div>
      )}
    </div>
  );
}

function StepDocuments({ f, set }: { f: FormData; set: (k: string, v: string) => void }) {
  return (
    <div>
      <p className="text-[13px] text-[var(--muted)] mb-4">
        You can upload documents after saving the staff record. Below is a checklist of required documents.
      </p>
      {[
        "Passport photograph", "NIN slip / National ID", "Academic certificates",
        "Offer letter (if applicable)", "Previous employment reference",
        "Medical fitness certificate",
      ].map((doc) => (
        <label key={doc} className="flex items-center gap-3 mb-3 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-[var(--brand)]" />
          <span className="text-[13px]">{doc}</span>
        </label>
      ))}
    </div>
  );
}

function StepReview({ f, departments, designations }: {
  f: FormData;
  departments: { id: number; name: string }[];
  designations: { id: number; name: string }[];
}) {
  const deptName = departments.find((d) => String(d.id) === String(f.department))?.name;
  const desigName = designations.find((d) => String(d.id) === String(f.designation))?.name;
  const rows = [
    ["Full Name", [f.first_name, f.middle_name, f.last_name].filter(Boolean).join(" ")],
    ["Gender", f.gender],
    ["Date of Birth", f.date_of_birth],
    ["Department", deptName],
    ["Designation", desigName],
    ["Employment Type", f.employment_type],
    ["Joining Date", f.joining_date],
    ["Phone", f.phone_number],
    ["Email", f.email],
    ["Basic Salary", f.basic_salary ? `₦${Number(f.basic_salary).toLocaleString()}` : "—"],
  ];
  return (
    <div>
      <div className="bg-[var(--soft)] rounded-[12px] p-[16px_20px] mb-4 flex items-center gap-3">
        <CheckCircle size={18} className="text-[var(--brand)]" />
        <span className="text-[13px] font-[700]">Please review the information below before submitting.</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rows.map(([k, v]) => (
          <div key={k as string} className="bg-white border border-[var(--line)] rounded-[8px] p-[10px_14px]">
            <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.08em]">{k}</div>
            <div className="text-[13px] font-[700] mt-[2px]">{(v as string) || "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Onboard Page ────────────────────────────────────────────────────────
export default function HrOnboardPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const { data: deptData } = useDepartments();
  const { data: desigData } = useDesignations();
  const { toast } = useHrToast();

  const departments = deptData?.results ?? [];
  const designations = desigData?.results ?? [];

  const setField = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length));
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name || !form.department || !form.designation || !form.joining_date) {
      toast("Fill in required fields (Name, Department, Designation, Joining Date)", "error");
      return;
    }
    setSaving(true);
    try {
      await createStaff(form);
      toast("Staff onboarded successfully!");
      setDone(true);
    } catch (e) {
      toast("Failed to save staff. Check the form.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div
        className="bg-white border border-[var(--line)] rounded-[14px] p-[60px_28px] text-center"
        style={{ boxShadow: "var(--shadow)" }}
      >
        <div className="text-[56px] mb-4">🎉</div>
        <h2 className="text-[28px] font-[800] m-0" style={{ fontFamily: "var(--serif)" }}>
          Staff <em className="text-[var(--brand)] not-italic">Onboarded!</em>
        </h2>
        <p className="text-[var(--muted)] mt-3 mb-6">
          {[form.first_name, form.last_name].join(" ")} has been successfully onboarded.
        </p>
        <div className="flex justify-center gap-3">
          <HrButton variant="ghost" onClick={() => { setForm({}); setStep(1); setDone(false); }}>Onboard another</HrButton>
          <HrButton variant="primary" onClick={() => { window.location.href = "/hr/directory"; }}>View Directory →</HrButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <HrHero
        eyebrow="HR Module"
        title="Staff"
        accent="Onboarding"
        sub="Complete each step to create a new staff record."
      />

      <div className="flex gap-5 items-start">
        {/* Sidebar nav */}
        <SideNav step={step} steps={STEPS} onClick={setStep} />

        {/* Step content */}
        <div className="flex-1 min-w-0">
          <div
            className="bg-white border border-[var(--line)] rounded-[14px] p-[28px_32px]"
            style={{ boxShadow: "var(--shadow)" }}
          >
            <h2 className="m-0 mb-[6px] text-[20px] font-[800]" style={{ fontFamily: "var(--serif)" }}>
              {STEPS[step - 1].icon} {STEPS[step - 1].label}
            </h2>
            <p className="text-[var(--muted)] text-[13px] mt-0 mb-5">
              Step {step} of {STEPS.length}
            </p>

            {step === 1 && <StepIdentity f={form} set={setField} />}
            {step === 2 && (
              <StepRole f={form} set={setField} departments={departments} designations={designations} />
            )}
            {step === 3 && <StepContact f={form} set={setField} />}
            {step === 4 && <StepFamily f={form} set={setField} />}
            {step === 5 && <StepGovId f={form} set={setField} />}
            {step === 6 && <StepQualifications f={form} set={setField} />}
            {step === 7 && <StepMedical f={form} set={setField} />}
            {step === 8 && <StepPayroll f={form} set={setField} />}
            {step === 9 && <StepDocuments f={form} set={setField} />}
            {step === 10 && (
              <StepReview f={form} departments={departments} designations={designations} />
            )}

            {/* Sticky footer nav */}
            <div className="flex justify-between items-center mt-8 pt-5 border-t border-[#f1f5f9]">
              <HrButton variant="ghost" onClick={goPrev} disabled={step === 1}>← Back</HrButton>
              <div className="flex gap-2 items-center">
                <span className="text-[12px] text-[var(--muted)]">{step} / {STEPS.length}</span>
                {step < STEPS.length ? (
                  <HrButton variant="primary" onClick={goNext}>Continue →</HrButton>
                ) : (
                  <HrButton variant="primary" onClick={() => void handleSubmit()} loading={saving}>
                    Submit & Onboard
                  </HrButton>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
