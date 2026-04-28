"use client";

import { useRef } from "react";
import type { ChangeEvent, ReactNode } from "react";

export type DocumentStatus = "idle" | "validating" | "uploading" | "success" | "error";

export interface DocumentState {
  status: DocumentStatus;
  fileName: string;
  url: string | null;
  error: string | null;
  uploadedAt: string | null;
}

export type DocumentType = "birth_certificate" | "aadhaar_card" | "medical_information";

export interface DocumentsUploadState {
  birth_certificate: DocumentState;
  aadhaar_card: DocumentState;
  medical_information: DocumentState;
}

export interface StudentDocumentsUploadProps {
  documents: DocumentsUploadState;
  onPickFile: (documentType: DocumentType, file: File) => void | Promise<void>;
  consentChecked: boolean;
  onConsentChange: (checked: boolean) => void;
  consentError?: string | null;
  sectionCounter?: string;
  navButtonsSlot?: ReactNode;
}

type CardSpec = {
  key: DocumentType;
  title: string;
  badge: { label: string; variant: "req" | "mask" | "opt" };
  iconGlyph: string;
  iconVariant: "purple" | "pill";
  idleDescription: string;
};

const CARDS: ReadonlyArray<CardSpec> = [
  {
    key: "birth_certificate",
    title: "Birth certificate",
    badge: { label: "REQUIRED", variant: "req" },
    iconGlyph: "📋",
    iconVariant: "purple",
    idleDescription:
      "Government-issued proof of date of birth. PDF, JPG, or PNG up to 5 MB.",
  },
  {
    key: "aadhaar_card",
    title: "Aadhaar card",
    badge: { label: "MASKED", variant: "mask" },
    iconGlyph: "🆔",
    iconVariant: "purple",
    idleDescription:
      "We store only the last 4 digits. The full number is never saved to disk or shared.",
  },
  {
    key: "medical_information",
    title: "Medical information",
    badge: { label: "OPTIONAL", variant: "opt" },
    iconGlyph: "💊",
    iconVariant: "pill",
    idleDescription:
      "Allergies, ongoing conditions, emergency contact for medical decisions. Stored encrypted.",
  },
];

export function StudentDocumentsUpload({
  documents,
  onPickFile,
  consentChecked,
  onConsentChange,
  consentError,
  sectionCounter = "05 / 06",
  navButtonsSlot,
}: StudentDocumentsUploadProps) {
  const birthCertRef = useRef<HTMLInputElement | null>(null);
  const aadhaarRef = useRef<HTMLInputElement | null>(null);
  const medicalRef = useRef<HTMLInputElement | null>(null);

  const refFor = (key: DocumentType) => {
    if (key === "birth_certificate") return birthCertRef;
    if (key === "aadhaar_card") return aadhaarRef;
    return medicalRef;
  };

  const handleFileChange = async (
    e: ChangeEvent<HTMLInputElement>,
    documentType: DocumentType,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await onPickFile(documentType, file);
      } catch {
        /* parent surfaces errors via toast; swallow to avoid unhandled-rejection noise */
      }
    }
    e.target.value = "";
  };

  const stateClass = (state: DocumentState) =>
    state.status === "success"
      ? "is-success"
      : state.status === "error"
      ? "is-error"
      : state.status === "uploading"
      ? "is-uploading"
      : "";

  const iconContent = (state: DocumentState, fallbackGlyph: string) => {
    if (state.status === "success") return "✓";
    if (state.status === "error") return "✗";
    if (state.status === "uploading") return "⟳";
    return fallbackGlyph;
  };

  const renderBody = (state: DocumentState, idle: string) => {
    if (state.status === "success") {
      return (
        <>
          <p className="doc-status-ok">✓ Uploaded</p>
          {state.fileName ? (
            <p className="doc-status-filename">{state.fileName}</p>
          ) : null}
        </>
      );
    }
    if (state.status === "error") {
      return (
        <>
          <p className="doc-status-bad">✗ Upload failed</p>
          {state.error ? (
            <p className="doc-status-error-detail">{state.error}</p>
          ) : null}
        </>
      );
    }
    if (state.status === "uploading") {
      return <p className="doc-status-run">⏳ Uploading…</p>;
    }
    return <p className="doc-card-desc">{idle}</p>;
  };

  const actionLabel = (state: DocumentState) => {
    if (state.status === "uploading") return "⏳ Uploading…";
    if (state.status === "success") return "↻ Replace";
    return "↑ Upload file";
  };

  return (
    <section className="doc-shell" id="documents">
      <header className="doc-header">
        <div className="doc-header-text">
          <h2 className="doc-title">
            Know your <span className="doc-title-em">student</span>
          </h2>
          <p className="doc-subtitle">
            Upload the documents your school needs on file. Some appear only when relevant — for example, caste certificate shows up if you picked a reserved category.
          </p>
        </div>
        <span className="doc-counter">{sectionCounter}</span>
      </header>

      {CARDS.map((spec) => (
        <input
          key={`input-${spec.key}`}
          type="file"
          ref={refFor(spec.key)}
          className="doc-hidden-input"
          title={`${spec.title} file input`}
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => handleFileChange(e, spec.key)}
        />
      ))}

      <div className="doc-grid">
        {CARDS.map((spec) => {
          const state = documents[spec.key];
          return (
            <article
              key={spec.key}
              className={`doc-card ${stateClass(state)}`.trim()}
            >
              <div className="doc-card-top">
                <div className="doc-card-row">
                  <span className={`doc-icon doc-icon-${spec.iconVariant}`}>
                    {iconContent(state, spec.iconGlyph)}
                  </span>
                  <span className={`doc-badge doc-badge-${spec.badge.variant}`}>
                    {spec.badge.label}
                  </span>
                </div>
                <h3 className="doc-card-title">{spec.title}</h3>
                <div className="doc-card-body">
                  {renderBody(state, spec.idleDescription)}
                </div>
              </div>
              <button
                type="button"
                className="doc-action"
                onClick={() => refFor(spec.key).current?.click()}
                disabled={state.status === "uploading"}
              >
                {actionLabel(state)}
              </button>
            </article>
          );
        })}
      </div>

      <div className="doc-callout doc-rte">
        <span className="doc-rte-icon" aria-hidden="true">
          🛡️
        </span>
        <div>
          <h4 className="doc-rte-title">RTE Act 2009 compliance</h4>
          <p className="doc-rte-text">
            Students admitted under the 25% EWS/DG quota must have their income or caste certificate verified within 30 days. All personal data is stored per the Digital Personal Data Protection Act, 2023 and is never shared with third parties without parental consent.{" "}
            <a href="#" className="doc-rte-link">
              Read our data policy →
            </a>
          </p>
        </div>
      </div>

      <div className="doc-callout doc-consent">
        <label className="doc-consent-label">
          <input
            type="checkbox"
            className="doc-consent-checkbox"
            checked={consentChecked}
            onChange={(e) => onConsentChange(e.target.checked)}
          />
          <div>
            <div className="doc-consent-title">Parent / Guardian consent</div>
            <p className="doc-consent-text">
              I confirm that the student&apos;s parent or legal guardian has authorized me to submit these documents and has consented to their storage for school records, admissions, fee management, and legally required reporting. I understand that withdrawing consent requires a written request.
            </p>
          </div>
        </label>
        {consentError ? <p className="doc-error-msg">{consentError}</p> : null}
      </div>

      {navButtonsSlot}

      <style jsx>{`
        .doc-shell {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 32px;
          scroll-margin-top: 108px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI",
            Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #111827;
        }

        .doc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 28px;
        }

        .doc-header-text {
          flex: 1;
          min-width: 0;
        }

        .doc-title {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -0.015em;
          color: #111827;
          font-family: var(--font-playfair-display), Georgia, "Times New Roman", serif;
        }

        .doc-title-em {
          color: #5b3df5;
          font-style: italic;
          font-family: var(--font-playfair-display), Georgia, "Times New Roman", serif;
          font-weight: 400;
        }

        .doc-subtitle {
          margin: 8px 0 0;
          font-size: 14px;
          color: #6b7280;
          line-height: 1.5;
          max-width: 68ch;
        }

        .doc-counter {
          font-size: 13px;
          color: #9ca3af;
          white-space: nowrap;
          padding-top: 6px;
          font-variant-numeric: tabular-nums;
        }

        .doc-hidden-input {
          display: none;
        }

        .doc-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 16px;
          align-items: stretch;
        }

        .doc-card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 18px;
          min-height: 176px;
          padding: 20px 22px;
          background: #ffffff;
          border: 1px solid #e7eaf1;
          border-radius: 20px;
          transition: border-color 180ms ease, box-shadow 180ms ease,
            transform 180ms ease, background-color 180ms ease;
        }

        .doc-card:hover {
          border-color: #c7bcfb;
          box-shadow: 0 0 0 4px rgba(91, 61, 245, 0.06),
            0 8px 20px rgba(17, 24, 39, 0.05);
          transform: translateY(-1px);
        }

        .doc-card-top {
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-width: 0;
        }

        .doc-card-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .doc-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
          line-height: 1;
        }

        .doc-icon-purple {
          background: #f3eeff;
          color: #5b3df5;
        }

        .doc-icon-pill {
          background: #fdeff0;
          color: #be123c;
        }

        .doc-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          line-height: 1.4;
          white-space: nowrap;
        }

        .doc-badge-req {
          background: #fee2e2;
          color: #b91c1c;
        }

        .doc-badge-mask {
          background: #ffedd5;
          color: #9a3412;
        }

        .doc-badge-opt {
          background: #f3f4f6;
          color: #6b7280;
        }

        .doc-card-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.005em;
          line-height: 1.25;
        }

        .doc-card-body {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .doc-card-desc {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
          line-height: 1.5;
        }

        .doc-status-ok {
          margin: 0;
          font-size: 14px;
          color: #047857;
          font-weight: 600;
        }

        .doc-status-filename {
          margin: 0;
          font-size: 13px;
          color: #047857;
          font-weight: 500;
          word-break: break-word;
          overflow-wrap: anywhere;
          line-height: 1.4;
        }

        .doc-status-bad {
          margin: 0;
          font-size: 14px;
          color: #b91c1c;
          font-weight: 600;
        }

        .doc-status-error-detail {
          margin: 0;
          font-size: 13px;
          color: #7f1d1d;
          word-break: break-word;
          overflow-wrap: anywhere;
          line-height: 1.4;
        }

        .doc-status-run {
          margin: 0;
          font-size: 14px;
          color: #1d4ed8;
          font-weight: 600;
        }

        .doc-action {
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0;
          border: none;
          background: transparent;
          color: #5b3df5;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          font-family: inherit;
          transition: color 140ms ease;
        }

        .doc-action:hover:not(:disabled) {
          color: #4c33e6;
          text-decoration: underline;
        }

        .doc-action:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        /* Success state */
        .doc-card.is-success {
          background: #ecfdf5;
          border-color: #a7f3d0;
        }

        .doc-card.is-success .doc-icon {
          background: #10b981;
          color: #ffffff;
          font-size: 22px;
          font-weight: 600;
        }

        .doc-card.is-success .doc-action {
          color: #059669;
        }

        .doc-card.is-success .doc-action:hover:not(:disabled) {
          color: #047857;
        }

        /* Error state */
        .doc-card.is-error {
          background: #fef2f2;
          border-color: #fca5a5;
        }

        .doc-card.is-error .doc-icon {
          background: #dc2626;
          color: #ffffff;
          font-size: 22px;
          font-weight: 600;
        }

        .doc-card.is-error .doc-action {
          color: #dc2626;
        }

        .doc-card.is-error .doc-action:hover:not(:disabled) {
          color: #991b1b;
        }

        /* Uploading state */
        .doc-card.is-uploading {
          background: #eff6ff;
          border-color: #93c5fd;
        }

        .doc-card.is-uploading .doc-icon {
          background: #3b82f6;
          color: #ffffff;
          font-size: 22px;
          animation: doc-spin 1s linear infinite;
        }

        .doc-card.is-uploading .doc-action {
          color: #3b82f6;
        }

        @keyframes doc-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        /* Callouts */
        .doc-callout {
          margin-top: 12px;
          padding: 18px 22px;
          border-radius: 16px;
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }

        .doc-rte {
          background: #fffbeb;
          border: 1px solid #fde68a;
        }

        .doc-rte-icon {
          font-size: 22px;
          line-height: 1;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .doc-rte-title {
          margin: 0 0 6px;
          font-size: 14px;
          font-weight: 600;
          color: #92400e;
        }

        .doc-rte-text {
          margin: 0;
          font-size: 13px;
          color: #78350f;
          line-height: 1.6;
        }

        .doc-rte-link {
          color: #b45309;
          text-decoration: underline;
          font-weight: 500;
        }

        .doc-rte-link:hover {
          color: #92400e;
        }

        .doc-consent {
          background: #f7f5ff;
          border: 1px solid #c4b5fd;
        }

        .doc-consent-label {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          cursor: pointer;
          width: 100%;
        }

        .doc-consent-checkbox {
          width: 18px;
          height: 18px;
          margin-top: 3px;
          cursor: pointer;
          flex-shrink: 0;
          accent-color: #5b3df5;
        }

        .doc-consent-title {
          margin: 0 0 6px;
          font-size: 14px;
          font-weight: 600;
          color: #111827;
        }

        .doc-consent-text {
          margin: 0;
          font-size: 13px;
          color: #4b5563;
          line-height: 1.6;
        }

        .doc-error-msg {
          font-size: 12px;
          color: #dc2626;
          margin: 8px 0 0;
        }

        @media (max-width: 1024px) {
          .doc-shell {
            padding: 28px;
          }
        }

        @media (max-width: 768px) {
          .doc-shell {
            padding: 20px;
            border-radius: 14px;
          }

          .doc-header {
            flex-direction: column;
            gap: 6px;
            margin-bottom: 20px;
          }

          .doc-counter {
            padding-top: 0;
          }

          .doc-title {
            font-size: 22px;
          }

          .doc-grid {
            grid-template-columns: 1fr;
            gap: 14px;
          }

          .doc-card {
            min-height: 168px;
          }

          .doc-callout {
            padding: 16px 18px;
          }
        }
      `}</style>
    </section>
  );
}

export default StudentDocumentsUpload;
