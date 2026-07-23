"use client";
import { useEffect, useState } from "react";

// Same localStorage key the Student Enroll page's ConsentForm uses
// (frontend/components/students/ConsentForm.tsx) — a school configures its header
// once and it applies to both student and staff printed/PDF documents. Only the
// subset of fields the onboarding PDFs actually render is read/written here; any
// other fields already saved by ConsentForm (layout, declaration text, etc.) are
// preserved untouched via the spread in `save()`.
const SCHOOL_HEADER_KEY = "eskoolia:school:header:v2";

export interface SchoolHeaderInfo {
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  logoDataUrl: string;
  principalName: string;
}

const EMPTY_HEADER: SchoolHeaderInfo = {
  schoolName: "",
  schoolAddress: "",
  schoolPhone: "",
  schoolEmail: "",
  logoDataUrl: "",
  principalName: "",
};

export function loadSchoolHeader(): SchoolHeaderInfo {
  if (typeof window === "undefined") return EMPTY_HEADER;
  try {
    const raw = window.localStorage.getItem(SCHOOL_HEADER_KEY);
    if (!raw) return EMPTY_HEADER;
    const parsed = JSON.parse(raw) as Partial<SchoolHeaderInfo>;
    return { ...EMPTY_HEADER, ...parsed };
  } catch {
    return EMPTY_HEADER;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function SchoolHeaderPopover({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<SchoolHeaderInfo>(EMPTY_HEADER);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(loadSchoolHeader());
  }, []);

  const set = (k: keyof SchoolHeaderInfo) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const save = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SCHOOL_HEADER_KEY);
      const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      window.localStorage.setItem(SCHOOL_HEADER_KEY, JSON.stringify({ ...existing, ...form }));
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 700);
    } catch {
      // localStorage unavailable — nothing to do, popover just won't persist
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 10200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 440, padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#15172A" }}>Document header</h3>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94A3B8" }}>×</button>
        </div>
        <p style={{ margin: "2px 0 16px", fontSize: 12, color: "#6b7280" }}>
          Shown at the top of the blank and filled onboarding PDFs. Shared with the student
          admission form header — set it once here or on the Student Enroll page.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="School Name" value={form.schoolName} onChange={set("schoolName")} placeholder="Eskoolia School" />
          <Field label="Address" value={form.schoolAddress} onChange={set("schoolAddress")} placeholder="123 School Lane, City" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Phone" value={form.schoolPhone} onChange={set("schoolPhone")} placeholder="" />
            <Field label="Email" value={form.schoolEmail} onChange={set("schoolEmail")} placeholder="office@school.in" />
          </div>
          <Field label="Principal Name" value={form.principalName} onChange={set("principalName")} placeholder="Principal" />
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Logo</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {form.logoDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoDataUrl} alt="Logo preview" style={{ width: 36, height: 36, objectFit: "contain", border: "1px solid #E2E8F0", borderRadius: 6 }} />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const dataUrl = await fileToBase64(file);
                  setForm((p) => ({ ...p, logoDataUrl: dataUrl }));
                }}
                style={{ fontSize: 12 }}
              />
              {form.logoDataUrl && (
                <button type="button" onClick={() => setForm((p) => ({ ...p, logoDataUrl: "" }))} style={{ fontSize: 11, color: "#EF4444", background: "none", border: "none", cursor: "pointer" }}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button type="button" onClick={onClose} style={{ padding: "8px 16px", border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff", fontSize: 12.5, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
            Cancel
          </button>
          <button type="button" onClick={save} style={{ padding: "8px 18px", border: "none", borderRadius: 8, background: saved ? "#10b981" : "var(--brand, #4f46e5)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            {saved ? "Saved ✓" : "Save header"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", height: 34, border: "1px solid #E2E8F0", borderRadius: 7, padding: "0 10px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
      />
    </div>
  );
}
