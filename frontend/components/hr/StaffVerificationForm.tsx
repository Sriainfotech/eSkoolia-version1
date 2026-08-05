"use client";
import React, { useRef, useState } from "react";
import { useDocumentBranding } from "@/hooks/useDocumentBranding";

const DEFAULT_DECLARATION = "I, {staffName}, confirm that all information provided above is accurate and complete to the best of my knowledge, and consent to the school retaining it for employment and administrative purposes.";

function val(v: string | undefined | null): string {
  return v && String(v).trim() ? String(v).trim() : "—";
}

export interface StaffVerificationData {
  photo?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  staff_code?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group_input?: string;
  mother_tongue?: string;
  religion?: string;
  nationality?: string;
  status?: string;
  departmentName?: string;
  designationName?: string;
  role?: string;
  joining_date?: string;
  employment_type?: string;
  reporting_manager?: string;
  mobile?: string;
  personal_email?: string;
  official_email?: string;
  current_address_line1?: string;
  current_city?: string;
  current_state?: string;
  current_pin?: string;
  emergency_name?: string;
  emergency_relation?: string;
  emergency_phone?: string;
  aadhaar_number?: string;
  pan_number?: string;
  bank_name?: string;
  bank_account_number?: string;
  ifsc_code?: string;
}

interface StaffVerificationFormProps {
  onClose: () => void;
  staff: StaffVerificationData;
  onSavePdf: () => Promise<void> | void;
  saving?: boolean;
}

export function StaffVerificationForm({ onClose, staff, onSavePdf, saving }: StaffVerificationFormProps) {
  const [showAI, setShowAI] = useState(false);
  const [showHeaderInfo, setShowHeaderInfo] = useState(false);
  // Header image + declaration text come from Settings > Document Branding —
  // one central place, shared with the student verification form, fee
  // receipts, and payslips — instead of a per-browser localStorage blob.
  const { headerImageDataUrl, declarationText } = useDocumentBranding('staff_onboarding', DEFAULT_DECLARATION);
  const modalRef = useRef<HTMLDivElement>(null);

  const fullName = [staff.first_name, staff.middle_name, staff.last_name].filter(Boolean).join(" ") || "—";

  const printFormInNewWindow = () => {
    const el = modalRef.current;
    if (!el) { window.print(); return; }
    const styleHTML = Array.from(document.querySelectorAll<HTMLElement>('style, link[rel="stylesheet"]'))
      .map((n) => n.outerHTML)
      .join("\n");
    const printWin = window.open("", "_blank", "width=900,height=700,menubar=no,toolbar=no,status=no");
    if (!printWin) { window.print(); return; }
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll<HTMLElement>(".sv-toolbar, .sv-ai-panel, .no-print").forEach((n) => n.remove());
    printWin.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Staff Verification Form</title>
  ${styleHTML}
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .sv-toolbar, .sv-ai-panel, .no-print { display: none !important; }
    .sv-modal { position: static !important; margin: 0 !important; max-width: 100% !important; width: 100% !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; max-height: none !important; }
    .sv-section { page-break-inside: avoid; break-inside: avoid; }
  </style>
</head>
<body>${clone.outerHTML}</body>
</html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 600);
  };

  interface Tip { tone: "warn" | "info" | "success"; icon: string; title: string; body: string; }
  const tips: Tip[] = [];
  if (!headerImageDataUrl) tips.push({ tone: "info", icon: "🏫", title: "School header not configured", body: "Set it up once in Settings → Document Branding — it applies to this form and every other printed document." });
  if (!staff.photo) tips.push({ tone: "warn", icon: "📷", title: "No staff photo", body: "A photo helps verify identity. Upload one in the Identity step." });
  if (!staff.mobile) tips.push({ tone: "warn", icon: "📱", title: "Mobile number missing", body: "Required for HR to reach this staff member." });
  if (!staff.bank_account_number) tips.push({ tone: "info", icon: "🏦", title: "Bank details incomplete", body: "Needed before payroll can be processed." });
  if (tips.length === 0) tips.push({ tone: "success", icon: "🎉", title: "Looks complete", body: "This form is ready to print or save as PDF." });

  return (
    <div className="sv-backdrop" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div ref={modalRef} className="sv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sv-toolbar">
          <button type="button" className="sv-close-btn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Close
          </button>
          <span className="sv-title">Staff Verification Form</span>
          <div className="sv-toolbar-actions">
            <button type="button" className={`sv-tb-btn sv-tb-ai${showAI ? " sv-tb-ai-active" : ""}`} onClick={() => setShowAI((s) => !s)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l1.9 5.8L20 9.7l-5 3.6L16.5 19 12 15.7 7.5 19 9 13.3l-5-3.6 6.1-1.9L12 2z"/></svg>
              AI Assist
            </button>
            <button type="button" className="sv-tb-btn sv-tb-settings" onClick={() => setShowHeaderInfo((v) => !v)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Header
            </button>
            <button type="button" className="sv-tb-btn sv-tb-print" onClick={printFormInNewWindow}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print
            </button>
            <button type="button" className="sv-tb-btn sv-tb-pdf" disabled={!!saving} onClick={() => void onSavePdf()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {saving ? "Saving…" : "Save PDF"}
            </button>
          </div>
        </div>

        {showAI && (
          <div className="sv-ai-panel">
            <div className="sv-ai-head">
              <div className="sv-ai-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l1.9 5.8L20 9.7l-5 3.6L16.5 19 12 15.7 7.5 19 9 13.3l-5-3.6 6.1-1.9L12 2z"/></svg>
              </div>
              <div>
                <h4 className="sv-ai-title">AI Layout Assistant <span className="sv-ai-beta">BETA</span></h4>
                <p className="sv-ai-sub">Real-time suggestions to make your form official and complete.</p>
              </div>
            </div>
            <div className="sv-ai-body">
              {tips.map((t, i) => (
                <div key={i} className={`sv-tip sv-tip-${t.tone}`}>
                  <span className="sv-tip-icon">{t.icon}</span>
                  <div className="sv-tip-content">
                    <p className="sv-tip-title">{t.title}</p>
                    <p className="sv-tip-body">{t.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showHeaderInfo && (
          <div className="sv-header-info-banner no-print">
            <span>
              The header and declaration text shown on this form are configured centrally in{" "}
              <strong>Settings → Document Branding</strong> — changes there apply to every printed/PDF document.
            </span>
            <button type="button" onClick={() => window.open("/settings/document-branding", "_blank")}>
              Open Document Branding
            </button>
            <button type="button" className="sv-header-info-close" onClick={() => setShowHeaderInfo(false)} aria-label="Dismiss">✕</button>
          </div>
        )}

        <div className="sv-body">
          {headerImageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={headerImageDataUrl} alt="School header" className="sv-header-img" />
          ) : (
            <div className="sv-header-img-placeholder">
              School header not configured yet — set it up in Settings → Document Branding.
            </div>
          )}
          <hr className="sv-divider" />

          <h2 className="sv-form-title">Staff Verification Form</h2>
          <p className="sv-form-subtitle">Please verify all details. Contact HR if any information is incorrect.</p>

          <div className="sv-section">
            <h3 className="sv-section-heading">1. Personal Identity</h3>
            <div className="sv-detail-grid">
              {staff.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={staff.photo} alt="Staff photo" className="sv-staff-photo" />
              ) : (
                <div className="sv-photo-placeholder">Photo</div>
              )}
              <table className="sv-table">
                <tbody>
                  <tr><th>Full Name</th><td>{fullName}</td></tr>
                  <tr><th>Staff Code</th><td>{val(staff.staff_code)}</td></tr>
                  <tr><th>Date of Birth</th><td>{val(staff.date_of_birth)}</td></tr>
                  <tr><th>Gender</th><td>{val(staff.gender)}</td></tr>
                  <tr><th>Blood Group</th><td>{val(staff.blood_group_input)}</td></tr>
                  <tr><th>Mother Tongue</th><td>{val(staff.mother_tongue)}</td></tr>
                  <tr><th>Religion</th><td>{val(staff.religion)}</td></tr>
                  <tr><th>Nationality</th><td>{val(staff.nationality)}</td></tr>
                  <tr><th>Status</th><td>{val(staff.status)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="sv-section">
            <h3 className="sv-section-heading">2. Role &amp; Employment</h3>
            <table className="sv-table">
              <tbody>
                <tr><th>Department</th><td>{val(staff.departmentName)}</td></tr>
                <tr><th>Designation</th><td>{val(staff.designationName)}</td></tr>
                <tr><th>Role / Access</th><td>{val(staff.role)}</td></tr>
                <tr><th>Joining Date</th><td>{val(staff.joining_date)}</td></tr>
                <tr><th>Employment Type</th><td>{val(staff.employment_type)}</td></tr>
                <tr><th>Reporting Manager</th><td>{val(staff.reporting_manager)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="sv-section">
            <h3 className="sv-section-heading">3. Contact &amp; Address</h3>
            <table className="sv-table">
              <tbody>
                <tr><th>Mobile</th><td>{val(staff.mobile)}</td></tr>
                <tr><th>Personal Email</th><td>{val(staff.personal_email)}</td></tr>
                <tr><th>Official Email</th><td>{val(staff.official_email)}</td></tr>
                <tr><th>Address</th><td>{val([staff.current_address_line1, staff.current_city, staff.current_state, staff.current_pin].filter(Boolean).join(", "))}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="sv-section">
            <h3 className="sv-section-heading">4. Emergency Contact</h3>
            <table className="sv-table">
              <tbody>
                <tr><th>Name</th><td>{val(staff.emergency_name)}</td></tr>
                <tr><th>Relation</th><td>{val(staff.emergency_relation)}</td></tr>
                <tr><th>Mobile</th><td>{val(staff.emergency_phone)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="sv-section">
            <h3 className="sv-section-heading">5. Government &amp; Bank</h3>
            <table className="sv-table">
              <tbody>
                <tr><th>Aadhaar Number</th><td>{val(staff.aadhaar_number)}</td></tr>
                <tr><th>PAN Number</th><td>{val(staff.pan_number)}</td></tr>
                <tr><th>Bank Name</th><td>{val(staff.bank_name)}</td></tr>
                <tr><th>Account Number</th><td>{val(staff.bank_account_number)}</td></tr>
                <tr><th>IFSC Code</th><td>{val(staff.ifsc_code)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="sv-section">
            <h3 className="sv-section-heading">Declaration</h3>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: "#374151", background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 6, padding: "10px 12px" }}>
              {declarationText.replace("{staffName}", fullName === "—" ? "the undersigned" : fullName)}
            </p>
            <div style={{ display: "flex", gap: 20, marginTop: 20, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ borderBottom: "1.5px solid #374151", height: 36, marginBottom: 4 }} />
                <div style={{ fontSize: 10, color: "#6b7280" }}>Staff Signature &amp; Date</div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ borderBottom: "1.5px solid #374151", height: 36, marginBottom: 4 }} />
                <div style={{ fontSize: 10, color: "#6b7280" }}>HR Officer Signature &amp; Date</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .sv-backdrop {
          position: fixed; inset: 0; z-index: 900;
          background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(3px); overflow-y: auto;
        }
        .sv-modal {
          background: #fff; max-width: 860px; margin: 24px auto;
          border-radius: 12px; box-shadow: 0 16px 60px rgba(0, 0, 0, 0.2); overflow: hidden;
        }
        .sv-toolbar {
          display: flex; align-items: center; gap: 10px; padding: 12px 18px;
          border-bottom: 1px solid #e5e7eb; background: #fff; flex-wrap: wrap;
        }
        .sv-close-btn {
          display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px;
          border: 1px solid #e5e7eb; border-radius: 9px; background: #fafafa; cursor: pointer;
          font-size: 13px; font-weight: 500; color: #374151; white-space: nowrap; transition: all 0.15s;
        }
        .sv-close-btn:hover { background: #f3f4f6; border-color: #d1d5db; }
        .sv-title { flex: 1; font-size: 14.5px; font-weight: 600; color: #111827; text-align: center; min-width: 120px; }
        .sv-toolbar-actions { display: flex; gap: 7px; flex-wrap: wrap; }
        .sv-tb-btn {
          display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px;
          border-radius: 9px; border: 1px solid transparent; font-size: 13px; font-weight: 600;
          cursor: pointer; white-space: nowrap; transition: all 0.15s; position: relative;
        }
        .sv-tb-settings { background: #fafafa; border-color: #e5e7eb; color: #374151; }
        .sv-tb-settings:hover { background: #f5f3ff; border-color: #c4b5fd; color: #6c3ce1; }
        .sv-tb-ai { background: linear-gradient(135deg, #8b5cf6, #ec4899); color: #fff; box-shadow: 0 3px 12px -3px rgba(139,92,246,0.45); }
        .sv-tb-ai:hover { box-shadow: 0 6px 18px -4px rgba(236,72,153,0.55); transform: translateY(-1px); }
        .sv-tb-ai-active { box-shadow: 0 0 0 3px rgba(139,92,246,0.25), 0 6px 18px -4px rgba(139,92,246,0.45); }
        .sv-tb-print { background: #fafafa; border-color: #e5e7eb; color: #374151; }
        .sv-tb-print:hover { background: #f3f4f6; border-color: #d1d5db; }
        .sv-tb-pdf { background: #6c3ce1; color: #fff; border-color: transparent; box-shadow: 0 3px 10px -3px rgba(108,60,225,0.4); }
        .sv-tb-pdf:hover { background: #5a2ee0; transform: translateY(-1px); box-shadow: 0 6px 16px -4px rgba(108,60,225,0.5); }
        .sv-tb-pdf:disabled { opacity: 0.65; cursor: wait; transform: none; }

        .sv-ai-panel { background: linear-gradient(180deg, #faf5ff 0%, #fff 60%); border-bottom: 1px solid #e9d5ff; }
        .sv-ai-head { display: flex; gap: 12px; align-items: center; padding: 16px 24px 12px; }
        .sv-ai-icon {
          width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #8b5cf6, #ec4899);
          color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .sv-ai-title { margin: 0; font-size: 15px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px; }
        .sv-ai-beta { font-size: 9px; background: linear-gradient(135deg, #8b5cf6, #ec4899); color: #fff; padding: 2px 7px; border-radius: 999px; letter-spacing: 0.6px; font-weight: 700; }
        .sv-ai-sub { margin: 3px 0 0; font-size: 12.5px; color: #64748b; }
        .sv-ai-body { padding: 0 24px 20px; display: flex; flex-direction: column; gap: 7px; }
        .sv-tip { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid transparent; }
        .sv-tip-warn { background: #fffbeb; border-color: #fef3c7; }
        .sv-tip-info { background: #f0f9ff; border-color: #e0f2fe; }
        .sv-tip-success { background: #f0fdf4; border-color: #dcfce7; }
        .sv-tip-icon { font-size: 16px; flex-shrink: 0; }
        .sv-tip-content { flex: 1; min-width: 0; }
        .sv-tip-title { margin: 0; font-size: 12.5px; font-weight: 600; color: #0f172a; }
        .sv-tip-body { margin: 2px 0 0; font-size: 12px; color: #475569; line-height: 1.4; }

        .sv-body { padding: 36px 48px; }
        .sv-header-img { display: block; width: 100%; max-height: 140px; object-fit: contain; object-position: left center; margin-bottom: 16px; }
        .sv-header-img-placeholder {
          display: flex; align-items: center; justify-content: center; min-height: 80px; margin-bottom: 16px;
          border: 1.5px dashed #d1d5db; border-radius: 8px; background: #f9fafb; color: #9ca3af;
          font-size: 12.5px; text-align: center; padding: 12px;
        }
        .sv-header-info-banner {
          display: flex; align-items: center; gap: 12px; margin: 0 18px; padding: 12px 16px;
          background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 10px; font-size: 12.5px; color: #4c1d95; line-height: 1.5;
        }
        .sv-header-info-banner button {
          flex-shrink: 0; background: #6c3ce1; color: #fff; border: none; border-radius: 6px;
          padding: 7px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
        }
        .sv-header-info-close { background: transparent !important; color: #6c3ce1 !important; padding: 4px 8px !important; }
        .sv-divider { border: none; border-top: 2px solid #e5e7eb; margin: 16px 0; }
        .sv-form-title { margin: 0 0 6px; font-size: 18px; font-weight: 700; color: #111827; text-align: center; text-transform: uppercase; letter-spacing: 0.05em; }
        .sv-form-subtitle { text-align: center; font-size: 13px; color: #6b7280; margin: 0 0 24px; }
        .sv-section { margin-bottom: 24px; }
        .sv-section-heading { margin: 0 0 10px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6c3ce1; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
        .sv-detail-grid { display: flex; gap: 20px; align-items: flex-start; }
        .sv-staff-photo { width: 100px; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; flex-shrink: 0; }
        .sv-photo-placeholder { width: 100px; height: 120px; border: 1px dashed #d1d5db; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #9ca3af; flex-shrink: 0; }
        .sv-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .sv-table th { text-align: left; width: 38%; padding: 6px 8px; color: #6b7280; font-weight: 500; vertical-align: top; }
        .sv-table td { padding: 6px 8px; color: #111827; vertical-align: top; }
        .sv-table tr:not(:last-child) td, .sv-table tr:not(:last-child) th { border-bottom: 1px solid #f3f4f6; }
      `}</style>
    </div>
  );
}
