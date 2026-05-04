"use client";

import { useMemo, useState, useEffect } from "react";
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
    relation: "",
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
  // Inline confirmation card shown when a relation is already assigned to
  // another guardian. Holds the pending change so the user can confirm/cancel.
  const [relationConflict, setRelationConflict] = useState<{
    clientId: string;
    nextRel: string;
    existingIdx: number;
  } | null>(null);

  // Sibling search states
  const [siblingSearchName, setSiblingSearchName] = useState("");
  const [siblingSearchClass, setSiblingSearchClass] = useState("");
  const [siblingSearchResults, setSiblingSearchResults] = useState<Array<{
    id: number;
    first_name: string;
    last_name: string;
    current_class_name?: string;
    current_section_name?: string;
    guardian?: { id: number; full_name: string; relation: string; phone: string; email?: string; occupation?: string };
  }>>([]);
  const [siblingLinkLoading, setSiblingLinkLoading] = useState(false);
  const [siblingSearchError, setSiblingSearchError] = useState("");

  // Local error state per card for inline onBlur validation
  const [localErrors, setLocalErrors] = useState<GuardianFieldErrors[]>(() =>
    drafts.map(() => ({}))
  );

  // Keep localErrors in sync when drafts length changes
  useEffect(() => {
    setLocalErrors((prev) => {
      if (prev.length === drafts.length) return prev;
      const next = drafts.map((_, i) => prev[i] || {});
      return next;
    });
  }, [drafts.length]);

  const setCardError = (idx: number, field: keyof GuardianDraft, msg: string) => {
    setLocalErrors((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: msg || undefined };
      if (!msg) delete next[idx][field];
      return next;
    });
  };

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

  const clearCard = (clientId: string) => {
    onDraftsChange(
      drafts.map((d) =>
        d.clientId === clientId
          ? { ...makeEmptyGuardianDraft(d.isPrimary), clientId: d.clientId }
          : d,
      ),
    );
  };

  const setAsPrimary = (clientId: string) => {
    onDraftsChange(
      drafts.map((d) => ({ ...d, isPrimary: d.clientId === clientId })),
    );
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

  const searchSiblings = async () => {
    if (!siblingSearchName.trim()) {
      setSiblingSearchError("Please enter a name to search");
      return;
    }
    
    setSiblingLinkLoading(true);
    setSiblingSearchError("");
    setSiblingSearchResults([]);
    
    try {
      // Get auth token
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      if (!token) {
        setSiblingSearchError("Authentication required. Please log in again.");
        setSiblingLinkLoading(false);
        return;
      }
      
      const params = new URLSearchParams({
        search: siblingSearchName.trim(),
        limit: '20',
      });
      if (siblingSearchClass.trim()) {
        params.append('class_name', siblingSearchClass.trim());
      }
      
      const response = await fetch(`/api/v1/students/students/?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      const results = Array.isArray(data) ? data : (data.results || []);
      setSiblingSearchResults(results);
      
      if (results.length === 0) {
        setSiblingSearchError("No students found with that name/class");
      }
    } catch (err) {
      setSiblingSearchError(err instanceof Error ? err.message : "Failed to search students");
    } finally {
      setSiblingLinkLoading(false);
    }
  };

  const linkSiblingGuardian = (sibling: typeof siblingSearchResults[0]) => {
    if (sibling.guardian) {
      onDraftsChange(
        drafts.map((d, idx) =>
          idx === 0
            ? {
                ...d,
                isPrimary: true,
                linkedExistingId: sibling.guardian!.id,
                fullName: sibling.guardian!.full_name,
                relation: sibling.guardian!.relation || "Father",
                phone: sibling.guardian!.phone || "",
                email: sibling.guardian!.email || d.email,
                occupation: sibling.guardian!.occupation || d.occupation,
              }
            : d,
        ),
      );
      setSiblingSearchName("");
      setSiblingSearchClass("");
      setSiblingSearchResults([]);
      setPickerOpen(false);
    }
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
        <div className="gdn-picker" role="region" aria-label="Sibling guardian search">
          <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#374151' }}>
              Search for a sibling to link their guardian
            </h4>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <input
                type="text"
                className="gdn-picker-search"
                placeholder="Sibling's Name"
                value={siblingSearchName}
                onChange={(e) => setSiblingSearchName(e.target.value)}
                style={{ flex: 2 }}
              />
              <input
                type="text"
                className="gdn-picker-search"
                placeholder="Class (optional)"
                value={siblingSearchClass}
                onChange={(e) => setSiblingSearchClass(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
            <button
              type="button"
              onClick={() => void searchSiblings()}
              disabled={siblingLinkLoading}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: siblingLinkLoading ? '#9ca3af' : '#6c3ce1',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: siblingLinkLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {siblingLinkLoading ? 'Searching...' : 'Search Students'}
            </button>
          </div>
          
          {siblingSearchError ? (
            <p style={{ padding: 16, color: '#dc2626', fontSize: 13, margin: 0 }}>
              {siblingSearchError}
            </p>
          ) : null}
          
          {siblingSearchResults.length > 0 ? (
            <ul className="gdn-picker-list">
              {siblingSearchResults.map((student) => (
                <li key={student.id} style={{ 
                  padding: 12, 
                  borderBottom: '1px solid #f3f4f6',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 4 }}>
                      {student.first_name} {student.last_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      Class: {student.current_class_name || '—'} {student.current_section_name ? `/ ${student.current_section_name}` : ''}
                    </div>
                    {student.guardian ? (
                      <div style={{ fontSize: 12, color: '#374151', padding: 8, background: '#f9fafb', borderRadius: 6, marginTop: 6 }}>
                        <div><strong>Guardian:</strong> {student.guardian.full_name}</div>
                        <div>{student.guardian.relation} · {student.guardian.phone}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                        No guardian on file
                      </div>
                    )}
                  </div>
                  {student.guardian ? (
                    <button
                      type="button"
                      onClick={() => linkSiblingGuardian(student)}
                      style={{
                        padding: '8px 14px',
                        background: '#6c3ce1',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginLeft: 12,
                        flexShrink: 0,
                      }}
                    >
                      Link this guardian
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="gdn-cards">
        {drafts.map((draft, idx) => {
          const errors = { ...(errorsByCard?.[idx] || {}), ...(localErrors[idx] || {}) };
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {!draft.isPrimary && (
                    <button
                      type="button"
                      style={{ fontSize: 12, color: '#6c3ce1', background: 'none', border: '1px solid #c4b5fd', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
                      onClick={() => setAsPrimary(draft.clientId)}
                    >
                      Set as primary
                    </button>
                  )}
                  {idx === 0 ? (
                    <button
                      type="button"
                      style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                      onClick={() => clearCard(draft.clientId)}
                      aria-label="Clear guardian 1 fields"
                      title="Clear all fields for this guardian"
                    >
                      Clear fields
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="gdn-card-close"
                      onClick={() => removeCard(draft.clientId)}
                      aria-label={`Remove guardian ${idx + 1}`}
                      title={`Remove guardian ${idx + 1}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              </header>

              <div className="gdn-row gdn-row-3">
                <div className="gdn-field">
                  <label className="gdn-label">
                    Full name <span className="gdn-req">*</span>
                  </label>
                  <input
                    type="text"
                    className={`gdn-input ${errors.fullName ? "is-invalid" : ""}`}
                    placeholder="e.g. Rajesh Sharma"
                    value={draft.fullName}
                    onChange={(e) =>
                      updateDraft(draft.clientId, { 
                        fullName: e.target.value.replace(/[^A-Za-z\s''.,-]/g, '').slice(0, 100)
                      })
                    }
                    onBlur={() => {
                      const v = draft.fullName.trim();
                      if (!v) setCardError(idx, 'fullName', 'Guardian name is required');
                      else if (v.length < 3) setCardError(idx, 'fullName', 'Name must be at least 3 characters');
                      else if (!/^[A-Za-z\s''.,\-]+$/.test(v)) setCardError(idx, 'fullName', 'Name can only contain letters, spaces, and basic punctuation');
                      else setCardError(idx, 'fullName', '');
                    }}
                    aria-describedby={`guardian_${idx}_fullName-error`}
                    autoComplete="off"
                  />
                  {errors.fullName ? (
                    <span id={`guardian_${idx}_fullName-error`} role="alert" aria-live="polite" className="gdn-err-text">{errors.fullName}</span>
                  ) : null}
                </div>
                <div className="gdn-field">
                  <label className="gdn-label">
                    Relation <span className="gdn-req">*</span>
                  </label>
                  <div className="gdn-select-wrap">
                    <select
                      className={`gdn-select ${errors.relation ? "is-invalid" : ""}`}
                      value={draft.relation}
                      onChange={(e) => {
                        const nextRel = e.target.value;
                        const norm = nextRel.trim().toLowerCase();
                        // Find any OTHER non-empty card already using this relation.
                        const conflictIdx = drafts.findIndex((d) => {
                          if (d.clientId === draft.clientId) return false;
                          const isFilled =
                            (d.fullName || "").trim() ||
                            (d.phone || "").trim() ||
                            d.linkedExistingId != null ||
                            d.isPrimary;
                          return isFilled && (d.relation || "").trim().toLowerCase() === norm;
                        });
                        if (conflictIdx !== -1 && nextRel) {
                          // Surface a small confirmation card instead of window.confirm.
                          setRelationConflict({
                            clientId: draft.clientId,
                            nextRel,
                            existingIdx: conflictIdx,
                          });
                          return;
                        }
                        updateDraft(draft.clientId, { relation: nextRel });
                      }}
                      onBlur={() => {
                        if (!draft.relation) setCardError(idx, 'relation', 'Relationship is required');
                        else setCardError(idx, 'relation', '');
                      }}
                      aria-describedby={`guardian_${idx}_relation-error`}
                    >
                      <option value="">Select relation</option>
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
                  {errors.relation ? (
                    <span id={`guardian_${idx}_relation-error`} role="alert" aria-live="polite" className="gdn-err-text">{errors.relation}</span>
                  ) : null}
                </div>
                <div className="gdn-field">
                  <label className="gdn-label">
                    Phone <span className="gdn-req">*</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    className={`gdn-input ${errors.phone ? "is-invalid" : ""}`}
                    placeholder="10-digit mobile"
                    value={draft.phone}
                    maxLength={10}
                    onChange={(e) =>
                      updateDraft(draft.clientId, { phone: phoneOnInput(e) })
                    }
                    onBlur={() => {
                      const p = draft.phone.replace(/\D/g, '');
                      if (!p) setCardError(idx, 'phone', 'Phone number is required');
                      else if (!/^[6-9]\d{9}$/.test(p)) setCardError(idx, 'phone', 'Enter a valid 10-digit number starting with 6-9');
                      else if (/^(\d)\1{9}$/.test(p)) setCardError(idx, 'phone', 'Phone number appears invalid (all same digits)');
                      else setCardError(idx, 'phone', '');
                    }}
                    aria-describedby={`guardian_${idx}_phone-error`}
                    autoComplete="off"
                  />
                  {errors.phone ? (
                    <span id={`guardian_${idx}_phone-error`} role="alert" aria-live="polite" className="gdn-err-text">{errors.phone}</span>
                  ) : null}
                </div>
              </div>

              <div className="gdn-row gdn-row-2">
                  <div className="gdn-field">
                    <div className="gdn-label-row">
                      <label className="gdn-label">Email</label>
                      <span className="gdn-optional-tag">OPTIONAL</span>
                    </div>
                    <input
                      type="email"
                      className={`gdn-input ${errors.email ? "is-invalid" : ""}`}
                      placeholder="guardian@example.com"
                      value={draft.email}
                      onChange={(e) =>
                        updateDraft(draft.clientId, { email: e.target.value.slice(0, 100) })
                      }
                      onBlur={() => {
                        const e = draft.email.trim();
                        if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) {
                          setCardError(idx, 'email', 'Enter a valid email address');
                        } else if (e) {
                          const [local] = e.split('@');
                          if (/^(.)\1+$/.test(local)) setCardError(idx, 'email', 'Email address appears invalid');
                          else setCardError(idx, 'email', '');
                        } else {
                          setCardError(idx, 'email', '');
                        }
                      }}
                      aria-describedby={`guardian_${idx}_email-error`}
                      autoComplete="off"
                    />
                    {errors.email ? (
                      <span id={`guardian_${idx}_email-error`} role="alert" aria-live="polite" className="gdn-err-text">{errors.email}</span>
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
                        updateDraft(draft.clientId, { 
                          occupation: e.target.value.replace(/[^A-Za-z0-9\s.,&'-]/g, '').slice(0, 100)
                        })
                      }
                      autoComplete="off"
                    />
                  </div>
                </div>
            </article>
          );
        })}

        <button type="button" className="gdn-add-btn" onClick={addCard}>
          + Add another guardian
        </button>
      </div>

      {submitError ? <p className="gdn-submit-err">{submitError}</p> : null}

      {navButtonsSlot}

      {/* Inline confirmation card for duplicate-relation selection */}
      {relationConflict ? (
        <div
          className="gdn-conflict-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gdn-conflict-title"
          onClick={() => setRelationConflict(null)}
        >
          <div className="gdn-conflict-card" onClick={(e) => e.stopPropagation()}>
            <div className="gdn-conflict-icon" aria-hidden="true">!</div>
            <h4 id="gdn-conflict-title" className="gdn-conflict-title">
              {relationConflict.nextRel} is already assigned
            </h4>
            <p className="gdn-conflict-text">
              Guardian {relationConflict.existingIdx + 1} is already set as
              <strong> {relationConflict.nextRel}</strong>. Add another
              {" "}{relationConflict.nextRel} as well, or pick a different relation?
            </p>
            <div className="gdn-conflict-actions">
              <button
                type="button"
                className="gdn-conflict-btn gdn-conflict-btn-ghost"
                onClick={() => setRelationConflict(null)}
              >
                Pick different
              </button>
              <button
                type="button"
                className="gdn-conflict-btn gdn-conflict-btn-primary"
                onClick={() => {
                  updateDraft(relationConflict.clientId, { relation: relationConflict.nextRel });
                  setRelationConflict(null);
                }}
              >
                Add another {relationConflict.nextRel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

        /* Duplicate-relation confirmation card */
        .gdn-conflict-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
          animation: gdnFadeIn 0.12s ease-out;
        }
        .gdn-conflict-card {
          background: #ffffff;
          border-radius: 14px;
          box-shadow: 0 20px 48px rgba(15, 23, 42, 0.25);
          width: 100%;
          max-width: 380px;
          padding: 22px 22px 18px;
          text-align: left;
          animation: gdnPopIn 0.14s ease-out;
        }
        .gdn-conflict-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #fef3c7;
          color: #b45309;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 18px;
          margin-bottom: 10px;
        }
        .gdn-conflict-title {
          margin: 0 0 6px;
          font-size: 15px;
          font-weight: 600;
          color: #111827;
        }
        .gdn-conflict-text {
          margin: 0 0 16px;
          font-size: 13px;
          color: #4b5563;
          line-height: 1.5;
        }
        .gdn-conflict-text strong {
          color: #111827;
        }
        .gdn-conflict-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .gdn-conflict-btn {
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 8px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
        }
        .gdn-conflict-btn-ghost {
          background: #ffffff;
          color: #374151;
          border-color: #d1d5db;
        }
        .gdn-conflict-btn-ghost:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }
        .gdn-conflict-btn-primary {
          background: #4f39f6;
          color: #ffffff;
        }
        .gdn-conflict-btn-primary:hover {
          background: #3d2ed6;
        }
        @keyframes gdnFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes gdnPopIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </section>
  );
}

export default StudentGuardiansStep;
