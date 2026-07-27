"use client";
import { useEffect, useRef, useState } from "react";

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
  schoolWebsite: string;
  affiliationNo: string;
  schoolMotto: string;
  logoDataUrl: string;
  principalName: string;
}

const EMPTY_HEADER: SchoolHeaderInfo = {
  schoolName: "",
  schoolAddress: "",
  schoolPhone: "",
  schoolEmail: "",
  schoolWebsite: "",
  affiliationNo: "",
  schoolMotto: "",
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

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

type Tab = "identity" | "layout" | "import" | "declaration";

/**
 * Inline header-settings panel — pixel match of ConsentForm's `.cf-settings-panel`
 * (Student Enroll page). Mounted inline inside StaffVerificationForm's toolbar
 * area (not a centered popup), same as the student page.
 */
export function SchoolHeaderPopover({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<SchoolHeaderInfo>(EMPTY_HEADER);
  const [tab, setTab] = useState<Tab>("identity");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(loadSchoolHeader());
  }, []);

  const setErr = (field: string, msg: string) => setErrors((prev) => ({ ...prev, [field]: msg }));
  const clearErr = (field: string) => setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });

  const save = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SCHOOL_HEADER_KEY);
      const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      window.localStorage.setItem(SCHOOL_HEADER_KEY, JSON.stringify({ ...existing, ...form }));
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 700);
    } catch {
      // localStorage unavailable — nothing to do, panel just won't persist
    }
  };

  const handleLogoUpload = async (file: File) => {
    const dataUrl = await fileToBase64(file);
    setForm((p) => ({ ...p, logoDataUrl: dataUrl }));
  };

  return (
    <div className="sv-settings-panel">
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.[0]) void handleLogoUpload(e.target.files[0]); e.target.value = ""; }}
      />

      <div className="sv-sp-header">
        <div>
          <h4 className="sv-settings-title">Header Settings</h4>
          <p className="sv-settings-desc">Changes save to this browser and appear on every printed form.</p>
        </div>
        <div className="sv-sp-tabs">
          {(["identity", "layout", "import", "declaration"] as const).map((t) => (
            <button key={t} type="button" className={`sv-sp-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              {t === "identity" ? "🏫 School Info" : t === "layout" ? "🎨 Logo & Layout" : t === "import" ? "📄 Import Letterhead" : "📝 Declaration"}
            </button>
          ))}
        </div>
      </div>

      {tab === "identity" && (
        <div className="sv-settings-grid">
          <div className="sv-settings-field" style={{ gridColumn: "1 / -1" }}>
            <label className="sv-settings-label">School Name *</label>
            <input
              className={`sv-settings-input${errors.schoolName ? " sv-input-error" : ""}`}
              value={form.schoolName}
              placeholder="e.g. Sunshine Public School"
              onChange={(e) => setForm((p) => ({ ...p, schoolName: titleCase(e.target.value) }))}
              onBlur={() => { if (!form.schoolName.trim()) setErr("schoolName", "School name is required"); else clearErr("schoolName"); }}
            />
            {errors.schoolName && <span className="sv-inline-err">{errors.schoolName}</span>}
          </div>

          <div className="sv-settings-field" style={{ gridColumn: "1 / -1" }}>
            <label className="sv-settings-label">Address</label>
            <input
              className="sv-settings-input"
              value={form.schoolAddress}
              placeholder="Street, City, PIN"
              onChange={(e) => setForm((p) => ({ ...p, schoolAddress: titleCase(e.target.value) }))}
            />
          </div>

          <div className="sv-settings-field">
            <label className="sv-settings-label">Phone</label>
            <input
              className={`sv-settings-input${errors.schoolPhone ? " sv-input-error" : ""}`}
              value={form.schoolPhone}
              placeholder="+91 98765 43210"
              onChange={(e) => {
                let v = e.target.value.replace(/[^\d\s+\-()]/g, "");
                if (v && !v.startsWith("+")) v = "+91 " + v.replace(/^\+?91\s*/, "");
                setForm((p) => ({ ...p, schoolPhone: v }));
              }}
              onBlur={() => {
                const digits = form.schoolPhone.replace(/\D/g, "");
                const local = digits.startsWith("91") ? digits.slice(2) : digits;
                if (form.schoolPhone && !/^[6-9]\d{9}$/.test(local)) setErr("schoolPhone", "Enter a valid 10-digit Indian mobile number");
                else clearErr("schoolPhone");
              }}
            />
            {errors.schoolPhone && <span className="sv-inline-err">{errors.schoolPhone}</span>}
          </div>

          <div className="sv-settings-field">
            <label className="sv-settings-label">Email</label>
            <input
              className={`sv-settings-input${errors.schoolEmail ? " sv-input-error" : ""}`}
              value={form.schoolEmail}
              placeholder="admissions@school.in"
              onChange={(e) => setForm((p) => ({ ...p, schoolEmail: e.target.value.trim() }))}
              onBlur={() => {
                const v = form.schoolEmail.trim();
                if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) setErr("schoolEmail", "Enter a valid email address");
                else clearErr("schoolEmail");
              }}
            />
            {errors.schoolEmail && <span className="sv-inline-err">{errors.schoolEmail}</span>}
          </div>

          <div className="sv-settings-field">
            <label className="sv-settings-label">Website</label>
            <input
              className="sv-settings-input"
              value={form.schoolWebsite}
              placeholder="www.schoolname.in"
              onChange={(e) => setForm((p) => ({ ...p, schoolWebsite: e.target.value.trim() }))}
            />
          </div>

          <div className="sv-settings-field">
            <label className="sv-settings-label">Principal Name *</label>
            <input
              className={`sv-settings-input${errors.principalName ? " sv-input-error" : ""}`}
              value={form.principalName}
              placeholder="Full name for signature line"
              onChange={(e) => setForm((p) => ({ ...p, principalName: e.target.value.replace(/[^A-Za-z\s'.,-]/g, "") }))}
              onBlur={() => {
                const v = form.principalName.trim();
                const tc = titleCase(v);
                if (tc !== form.principalName) setForm((p) => ({ ...p, principalName: tc }));
                if (!v) setErr("principalName", "Principal name is required"); else clearErr("principalName");
              }}
            />
            {errors.principalName && <span className="sv-inline-err">{errors.principalName}</span>}
          </div>

          <div className="sv-settings-field">
            <label className="sv-settings-label">Affiliation / Reg No.</label>
            <input
              className="sv-settings-input"
              value={form.affiliationNo}
              placeholder="CBSE / State board ref"
              onChange={(e) => setForm((p) => ({ ...p, affiliationNo: e.target.value.replace(/[^A-Za-z0-9\s/\-]/g, "") }))}
            />
          </div>

          <div className="sv-settings-field" style={{ gridColumn: "1 / -1" }}>
            <label className="sv-settings-label">Motto / Tagline</label>
            <input
              className="sv-settings-input"
              value={form.schoolMotto}
              placeholder="Shown under school name"
              onChange={(e) => setForm((p) => ({ ...p, schoolMotto: e.target.value }))}
            />
          </div>
        </div>
      )}

      {tab === "layout" && (
        <div className="sv-layout-tab">
          <div className="sv-field-group">
            <p className="sv-field-group-label">SCHOOL LOGO</p>
            <div className="sv-logo-zone">
              {form.logoDataUrl ? (
                <div className="sv-logo-preview-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logoDataUrl} alt="Logo preview" className="sv-logo-preview-img" />
                  <div className="sv-logo-preview-actions">
                    <button type="button" className="sv-logo-change-btn" onClick={() => logoInputRef.current?.click()}>Change</button>
                    <button type="button" className="sv-logo-remove-btn" onClick={() => setForm((p) => ({ ...p, logoDataUrl: "" }))}>Remove</button>
                  </div>
                </div>
              ) : (
                <div className="sv-logo-empty" onClick={() => logoInputRef.current?.click()}>
                  <p className="sv-logo-empty-title">Click to upload a logo</p>
                  <p className="sv-logo-empty-hint">PNG or JPG, shown at the top of every printed form</p>
                  <button type="button" className="sv-logo-browse-btn">Browse file</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "import" && (
        <div className="sv-layout-tab">
          <p style={{ fontSize: 12.5, color: "#64748b", margin: 0 }}>
            Letterhead import isn&apos;t needed for the staff onboarding form — set a school
            name, address and logo under <strong>School Info</strong> instead.
          </p>
        </div>
      )}

      {tab === "declaration" && (
        <div className="sv-layout-tab">
          <p style={{ fontSize: 12.5, color: "#64748b", margin: 0 }}>
            The staff onboarding PDF already includes a fixed declaration and signature
            block (staff, HR officer, principal/director) — no separate text to edit here.
          </p>
        </div>
      )}

      <div className="sv-settings-actions">
        <button type="button" className="sv-settings-reset" onClick={() => setForm(EMPTY_HEADER)}>Reset defaults</button>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="sv-settings-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="sv-settings-save" onClick={save}>
            {saved ? "✓ Applied!" : "Apply & save"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .sv-settings-panel { background: #faf7ff; border-bottom: 1px solid #e9d5ff; }
        .sv-sp-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 24px 0; flex-wrap: wrap; }
        .sv-settings-title { margin: 0 0 2px; font-size: 15px; font-weight: 700; color: #0f172a; }
        .sv-settings-desc { margin: 0; font-size: 12.5px; color: #64748b; }
        .sv-sp-tabs { display: flex; gap: 4px; padding: 2px; background: rgba(0,0,0,0.04); border-radius: 10px; }
        .sv-sp-tab { padding: 6px 12px; border-radius: 8px; border: none; background: transparent; font-size: 12.5px; font-weight: 500; color: #64748b; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .sv-sp-tab.active { background: #fff; color: #6c3ce1; font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .sv-settings-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 16px 24px; }
        .sv-settings-field { display: flex; flex-direction: column; gap: 4px; }
        .sv-settings-label { font-size: 11.5px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.4px; }
        .sv-settings-input { padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; background: #fff; transition: border-color 0.15s, box-shadow 0.15s; }
        .sv-settings-input:focus { outline: none; border-color: #c4b5fd; box-shadow: 0 0 0 3px rgba(139,92,246,0.1); }
        .sv-input-error { border-color: #ef4444 !important; }
        .sv-inline-err { display: block; color: #ef4444; font-size: 11.5px; margin-top: 3px; }
        .sv-settings-actions { display: flex; gap: 8px; justify-content: space-between; align-items: center; padding: 12px 24px 16px; border-top: 1px solid #e9d5ff; }
        .sv-settings-reset { padding: 7px 14px; border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; cursor: pointer; font-size: 12.5px; color: #6b7280; transition: all 0.12s; }
        .sv-settings-reset:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }
        .sv-settings-cancel { padding: 8px 16px; border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; cursor: pointer; font-size: 13px; color: #374151; }
        .sv-settings-save { padding: 8px 18px; background: linear-gradient(135deg, #6c3ce1, #8b5cf6); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; box-shadow: 0 2px 8px -2px rgba(108,60,225,0.4); transition: all 0.15s; }
        .sv-settings-save:hover { box-shadow: 0 4px 14px -3px rgba(108,60,225,0.5); transform: translateY(-1px); }

        .sv-layout-tab { padding: 16px 24px; display: flex; flex-direction: column; gap: 20px; }
        .sv-field-group { display: flex; flex-direction: column; gap: 10px; }
        .sv-field-group-label { font-size: 10.5px; font-weight: 700; letter-spacing: 0.8px; color: #94a3b8; text-transform: uppercase; }
        .sv-logo-zone { border: 2px dashed #ddd6fe; border-radius: 12px; overflow: hidden; background: #faf5ff; min-height: 90px; transition: border-color 0.15s, background 0.15s; }
        .sv-logo-zone:hover { border-color: #c4b5fd; background: #f5f3ff; }
        .sv-logo-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 22px 16px; cursor: pointer; gap: 6px; }
        .sv-logo-empty-title { margin: 0; font-size: 13.5px; font-weight: 600; color: #374151; }
        .sv-logo-empty-hint { margin: 0; font-size: 11.5px; color: #94a3b8; text-align: center; }
        .sv-logo-browse-btn { margin-top: 4px; padding: 6px 16px; background: #8b5cf6; color: #fff; border: none; border-radius: 7px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .sv-logo-preview-wrap { padding: 12px 16px; display: flex; align-items: center; gap: 14px; }
        .sv-logo-preview-img { max-height: 60px; max-width: 160px; object-fit: contain; border-radius: 4px; }
        .sv-logo-preview-actions { display: flex; gap: 8px; }
        .sv-logo-change-btn { padding: 5px 12px; background: #fff; border: 1px solid #ddd6fe; border-radius: 7px; font-size: 12px; color: #6c3ce1; cursor: pointer; font-weight: 600; }
        .sv-logo-remove-btn { padding: 5px 12px; background: #fff; border: 1px solid #fecaca; border-radius: 7px; font-size: 12px; color: #dc2626; cursor: pointer; }
      `}</style>
    </div>
  );
}
