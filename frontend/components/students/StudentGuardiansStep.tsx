"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

export type GuardianDraft = {
  clientId: string;
  isPrimary: boolean;
  linkedExistingId: number | null;
  fullName: string;
  relation: string;
  phone: string;
  email: string;
  occupation: string;
};

export type GuardianLite = {
  id: number;
  full_name: string;
  relation: string;
  phone: string;
};

export type GuardianFieldErrors = Partial<Record<keyof GuardianDraft, string>>;

export interface StudentGuardiansStepProps {
  drafts: GuardianDraft[];
  onDraftsChange: (next: GuardianDraft[]) => void;
  existingGuardians: GuardianLite[];
  sectionCounter?: string;
  errorsByCard?: GuardianFieldErrors[];
  submitError?: string | null;
  navButtonsSlot?: ReactNode;
}

const RELATION_OPTIONS = ["Father", "Mother", "Guardian", "Grandfather", "Grandmother", "Uncle", "Aunt", "Other"];

export function makeEmptyGuardianDraft(isPrimary: boolean): GuardianDraft {
  return {
    clientId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `g_${Math.random().toString(36).slice(2)}_${Date.now()}`,
    isPrimary,
    linkedExistingId: null,
    fullName: "",
    relation: "Father",
    phone: "",
    email: "",
    occupation: "",
  };
}

export function StudentGuardiansStep({
  drafts,
  onDraftsChange,
  existingGuardians,
  sectionCounter = "04 / 06",
  errorsByCard,
  submitError,
  navButtonsSlot,
}: StudentGuardiansStepProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const updateDraft = (clientId: string, patch: Partial<GuardianDraft>) => {
    onDraftsChange(
      drafts.map((d) => (d.clientId === clientId ? { ...d, ...patch } : d)),
    );
  };

  const removeCard = (clientId: string) => {
    const target = drafts.find((d) => d.clientId === clientId);
    if (!target) return;
    if (target.isPrimary) {
      // Primary is always present — clear fields instead of removing
      onDraftsChange(
        drafts.map((d) =>
          d.clientId === clientId
            ? {
                ...makeEmptyGuardianDraft(true),
                clientId: d.clientId,
              }
            : d,
        ),
      );
      return;
    }
    onDraftsChange(drafts.filter((d) => d.clientId !== clientId));
  };

  const addCard = () => {
    onDraftsChange([...drafts, makeEmptyGuardianDraft(false)]);
  };

  const linkExistingToPrimary = (guardian: GuardianLite) => {
    // Link the selected guardian to the first (primary) card.
    onDraftsChange(
      drafts.map((d, idx) =>
        idx === 0
          ? {
              ...d,
              isPrimary: true,
              linkedExistingId: guardian.id,
              fullName: guardian.full_name,
              relation: guardian.relation || "Father",
              phone: guardian.phone || "",
              email: d.email,
              occupation: d.occupation,
            }
          : d,
      ),
    );
    setPickerOpen(false);
    setPickerQuery("");
  };

  const filteredExisting = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const linkedIds = new Set(
      drafts.map((d) => d.linkedExistingId).filter((id): id is number => id != null),
    );
    const pool = existingGuardians.filter((g) => !linkedIds.has(g.id));
    if (!q) return pool.slice(0, 20);
    return pool
      .filter(
        (g) =>
          g.full_name.toLowerCase().includes(q) ||
          (g.phone || "").includes(q),
      )
      .slice(0, 20);
  }, [existingGuardians, pickerQuery, drafts]);

  const phoneOnInput = (e: ChangeEvent<HTMLInputElement>) =>
    e.target.value.replace(/\D/g, "").slice(0, 10);

  return (
    <section className="gdn-shell" id="guardians">
      <header className="gdn-header">
        <div className="gdn-header-text">
          <h2 className="gdn-title">
            Family &amp; <span className="gdn-title-em">guardians</span>
          </h2>
          <p className="gdn-subtitle">
            Add at least one guardian. You can add more later from the student profile.
          </p>
        </div>
        <span className="gdn-counter">{sectionCounter}</span>
      </header>

      <button
        type="button"
        className="gdn-link-existing"
        onClick={() => setPickerOpen((s) => !s)}
        aria-expanded={pickerOpen}
      >
        {pickerOpen ? "↑" : "↓"} Link an existing guardian (for siblings already enrolled)
      </button>

      {pickerOpen ? (
        <div className="gdn-picker" role="region" aria-label="Existing guardian picker">
          <input
            type="search"
            className="gdn-picker-search"
            placeholder="Search by name or phone…"
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
          />
          {filteredExisting.length === 0 ? (
            <p className="gdn-picker-empty">
              {existingGuardians.length === 0
                ? "No guardians have been created yet for this school."
                : "No matching guardians. Try a different search."}
            </p>
          ) : (
            <ul className="gdn-picker-list">
              {filteredExisting.map((g) => (
                <li key={g.id} className="gdn-picker-item">
                  <div className="gdn-picker-item-main">
                    <div className="gdn-picker-item-name">{g.full_name}</div>
                    <div className="gdn-picker-item-meta">
                      {g.relation || "—"} · {g.phone || "no phone"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="gdn-picker-link-btn"
                    onClick={() => linkExistingToPrimary(g)}
                  >
                    Link as primary
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="gdn-cards">
        {drafts.map((draft, idx) => {
          const errs = errorsByCard?.[idx] ?? {};
          return (
            <article key={draft.clientId} className="gdn-card">
              <header className="gdn-card-header">
                <div className="gdn-card-title-wrap">
                  <h3 className="gdn-card-title">Guardian {idx + 1}</h3>
                  {draft.isPrimary ? (
                    <span className="gdn-badge-primary">PRIMARY</span>
                  ) : null}
                  {draft.linkedExistingId != null ? (
                    <span className="gdn-badge-linked">LINKED</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="gdn-card-close"
                  onClick={() => removeCard(draft.clientId)}
                  aria-label={
                    draft.isPrimary
                      ? "Clear primary guardian"
                      : `Remove guardian ${idx + 1}`
                  }
                  title={
                    draft.isPrimary
                      ? "Clear primary guardian"
                      : `Remove guardian ${idx + 1}`
                  }
                >
                  ×
                </button>
              </header>

              <div className="gdn-row gdn-row-3">
                <div className="gdn-field">
                  <label className="gdn-label">
                    Full name <span className="gdn-req">*</span>
                  </label>
                  <input
                    type="text"
                    className={`gdn-input ${errs.fullName ? "is-invalid" : ""}`}
                    placeholder="e.g. Rajesh Sharma"
                    value={draft.fullName}
                    onChange={(e) =>
                      updateDraft(draft.clientId, { fullName: e.target.value })
                    }
                    autoComplete="off"
                  />
                  {errs.fullName ? (
                    <p className="gdn-err-text">{errs.fullName}</p>
                  ) : null}
                </div>
                <div className="gdn-field">
                  <label className="gdn-label">
                    Relation <span className="gdn-req">*</span>
                  </label>
                  <div className="gdn-select-wrap">
                    <select
                      className={`gdn-select ${errs.relation ? "is-invalid" : ""}`}
                      value={draft.relation}
                      onChange={(e) =>
                        updateDraft(draft.clientId, { relation: e.target.value })
                      }
                    >
                      {RELATION_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <span className="gdn-select-chevron" aria-hidden="true">
                      ⌄
                    </span>
                  </div>
                  {errs.relation ? (
                    <p className="gdn-err-text">{errs.relation}</p>
                  ) : null}
                </div>
                <div className="gdn-field">
                  <label className="gdn-label">
                    Phone <span className="gdn-req">*</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    className={`gdn-input ${errs.phone ? "is-invalid" : ""}`}
                    placeholder="10-digit mobile"
                    value={draft.phone}
                    maxLength={10}
                    onChange={(e) =>
                      updateDraft(draft.clientId, { phone: phoneOnInput(e) })
                    }
                    autoComplete="off"
                  />
                  {errs.phone ? (
                    <p className="gdn-err-text">{errs.phone}</p>
                  ) : null}
                </div>
              </div>

              {draft.isPrimary ? (
                <div className="gdn-row gdn-row-2">
                  <div className="gdn-field">
                    <div className="gdn-label-row">
                      <label className="gdn-label">Email</label>
                      <span className="gdn-optional-tag">OPTIONAL</span>
                    </div>
                    <input
                      type="email"
                      className={`gdn-input ${errs.email ? "is-invalid" : ""}`}
                      placeholder="guardian@example.com"
                      value={draft.email}
                      onChange={(e) =>
                        updateDraft(draft.clientId, { email: e.target.value })
                      }
                      autoComplete="off"
                    />
                    {errs.email ? (
                      <p className="gdn-err-text">{errs.email}</p>
                    ) : null}
                  </div>
                  <div className="gdn-field">
                    <div className="gdn-label-row">
                      <label className="gdn-label">Occupation</label>
                      <span className="gdn-optional-tag">OPTIONAL</span>
                    </div>
                    <input
                      type="text"
                      className="gdn-input"
                      placeholder="e.g. Engineer"
                      value={draft.occupation}
                      onChange={(e) =>
                        updateDraft(draft.clientId, { occupation: e.target.value })
                      }
                      autoComplete="off"
                    />
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}

        <button type="button" className="gdn-add-btn" onClick={addCard}>
          + Add another guardian
        </button>
      </div>

      {submitError ? <p className="gdn-submit-err">{submitError}</p> : null}

      {navButtonsSlot}

      <style jsx>{`
        .gdn-shell {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 32px;
          scroll-margin-top: 108px;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI",
            Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #111827;
        }

        .gdn-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 20px;
        }

        .gdn-header-text {
          flex: 1;
          min-width: 0;
        }

        .gdn-title {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -0.015em;
          color: #111827;
          font-family: var(--font-playfair-display), Georgia, "Times New Roman", serif;
        }

        .gdn-title-em {
          color: #5b3df5;
          font-style: italic;
          font-family: var(--font-playfair-display), Georgia, "Times New Roman", serif;
          font-weight: 400;
        }

        .gdn-subtitle {
          margin: 8px 0 0;
          font-size: 14px;
          color: #6b7280;
          line-height: 1.5;
        }

        .gdn-counter {
          font-size: 13px;
          color: #9ca3af;
          white-space: nowrap;
          padding-top: 6px;
          font-variant-numeric: tabular-nums;
        }

        .gdn-link-existing {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 20px;
          padding: 0;
          border: none;
          background: transparent;
          color: #5b3df5;
          font-size: 14px;
          font-weight: 500;
          text-decoration: underline;
          cursor: pointer;
          font-family: inherit;
          text-decoration-thickness: 1px;
          text-underline-offset: 3px;
        }

        .gdn-link-existing:hover {
          color: #4c33e6;
        }

        .gdn-picker {
          margin: 0 0 20px;
          padding: 16px;
          background: #f8f7ff;
          border: 1px solid #e4defc;
          border-radius: 14px;
        }

        .gdn-picker-search {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #e6e4f6;
          border-radius: 10px;
          background: #ffffff;
          font-size: 14px;
          font-family: inherit;
          color: #111827;
          outline: none;
        }

        .gdn-picker-search:focus {
          border-color: #b6a8fb;
          box-shadow: 0 0 0 3px rgba(91, 61, 245, 0.12);
        }

        .gdn-picker-empty {
          margin: 12px 0 0;
          font-size: 13px;
          color: #6b7280;
        }

        .gdn-picker-list {
          list-style: none;
          padding: 0;
          margin: 12px 0 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 280px;
          overflow-y: auto;
        }

        .gdn-picker-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          background: #ffffff;
          border: 1px solid #eeebff;
          border-radius: 10px;
        }

        .gdn-picker-item-main {
          min-width: 0;
          flex: 1;
        }

        .gdn-picker-item-name {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .gdn-picker-item-meta {
          margin-top: 2px;
          font-size: 12.5px;
          color: #6b7280;
        }

        .gdn-picker-link-btn {
          padding: 6px 12px;
          background: #5b3df5;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          transition: background-color 140ms ease;
          white-space: nowrap;
        }

        .gdn-picker-link-btn:hover {
          background: #4c33e6;
        }

        .gdn-cards {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .gdn-card {
          padding: 22px 22px 24px;
          background: #fafafb;
          border: 1px solid #e8e9ef;
          border-radius: 16px;
        }

        .gdn-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        .gdn-card-title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .gdn-card-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.005em;
        }

        .gdn-badge-primary {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          background: #ece7ff;
          color: #5b3df5;
          line-height: 1.4;
        }

        .gdn-badge-linked {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          background: #dcfce7;
          color: #166534;
          line-height: 1.4;
        }

        .gdn-card-close {
          width: 28px;
          height: 28px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
          font-size: 20px;
          line-height: 1;
          border-radius: 6px;
          transition: background-color 140ms ease, color 140ms ease;
        }

        .gdn-card-close:hover {
          background: #f3f4f6;
          color: #4b5563;
        }

        .gdn-row {
          display: grid;
          gap: 16px;
        }

        .gdn-row-3 {
          grid-template-columns: repeat(3, 1fr);
        }

        .gdn-row-2 {
          grid-template-columns: repeat(2, 1fr);
          margin-top: 18px;
        }

        .gdn-field {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .gdn-label {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          margin: 0 0 6px;
        }

        .gdn-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .gdn-label-row .gdn-label {
          margin: 0;
        }

        .gdn-optional-tag {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.6px;
          color: #b45309;
          text-transform: uppercase;
        }

        .gdn-req {
          color: #dc2626;
          font-weight: 600;
        }

        .gdn-input,
        .gdn-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #ffffff;
          font-size: 14px;
          font-family: inherit;
          color: #111827;
          outline: none;
          transition: border-color 140ms ease, box-shadow 140ms ease;
        }

        .gdn-input::placeholder {
          color: #9ca3af;
        }

        .gdn-input:focus,
        .gdn-select:focus {
          border-color: #b6a8fb;
          box-shadow: 0 0 0 3px rgba(91, 61, 245, 0.12);
        }

        .gdn-input.is-invalid,
        .gdn-select.is-invalid {
          border-color: #f4a1a1;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.08);
        }

        .gdn-select-wrap {
          position: relative;
        }

        .gdn-select {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          padding-right: 32px;
          cursor: pointer;
        }

        .gdn-select-chevron {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-55%);
          pointer-events: none;
          color: #6b7280;
          font-size: 14px;
        }

        .gdn-err-text {
          margin: 6px 0 0;
          font-size: 12px;
          color: #dc2626;
        }

        .gdn-add-btn {
          width: 100%;
          padding: 16px 18px;
          border: 1.5px dashed #d1d5db;
          background: transparent;
          border-radius: 14px;
          color: #6b7280;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          transition: border-color 140ms ease, color 140ms ease,
            background-color 140ms ease;
        }

        .gdn-add-btn:hover {
          border-color: #5b3df5;
          color: #5b3df5;
          background: #faf8ff;
        }

        .gdn-submit-err {
          margin: 14px 0 0;
          font-size: 13px;
          color: #dc2626;
          font-weight: 500;
        }

        @media (max-width: 1024px) {
          .gdn-shell {
            padding: 28px;
          }
          .gdn-row-3 {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .gdn-shell {
            padding: 20px;
            border-radius: 14px;
          }
          .gdn-header {
            flex-direction: column;
            gap: 6px;
          }
          .gdn-counter {
            padding-top: 0;
          }
          .gdn-title {
            font-size: 22px;
          }
          .gdn-row-3,
          .gdn-row-2 {
            grid-template-columns: 1fr;
          }
          .gdn-card {
            padding: 18px 16px 20px;
          }
          .gdn-picker-item {
            flex-wrap: wrap;
          }
          .gdn-picker-link-btn {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}

export default StudentGuardiansStep;
