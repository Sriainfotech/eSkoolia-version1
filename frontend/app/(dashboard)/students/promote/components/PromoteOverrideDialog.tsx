'use client';

import React, { useState } from 'react';
import type { PromotionRecord } from '@/lib/promotion-api';

const OVERRIDE_REASONS = [
  { value: 'reviewed_records',  label: 'Records reviewed',         sub: 'Performance / attendance re-checked and is acceptable' },
  { value: 'remedial_completed', label: 'Remedial work completed', sub: 'Student finished assigned catch-up work' },
  { value: 'parent_appeal',     label: 'Parent appeal accepted',   sub: 'Guardian appeal granted by school committee' },
  { value: 'admin_decision',    label: 'Administrative decision',  sub: 'Approved by principal / academic head' },
  { value: 'data_correction',   label: 'Data correction',          sub: 'Earlier "not promoted" was a data-entry mistake' },
  { value: 'other',             label: 'Other',                    sub: 'Provide a custom message below' },
];

interface Props {
  record: PromotionRecord;
  previousRetentionReason?: string;
  onConfirm: (recordId: number, overrideNote: string) => Promise<void> | void;
  onCancel: () => void;
}

export default function PromoteOverrideDialog({ record, previousRetentionReason, onConfirm, onCancel }: Props) {
  const [reasonKey, setReasonKey] = useState<string>('reviewed_records');
  const [customNote, setCustomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isOther = reasonKey === 'other';
  const trimmedCustom = customNote.trim();
  const isValid = isOther ? trimmedCustom.length >= 3 : true;

  const handleSubmit = async () => {
    if (!isValid) return;
    const reason = OVERRIDE_REASONS.find((r) => r.value === reasonKey);
    const baseLabel = reason?.label ?? 'Override';
    const note = isOther
      ? `[Promote override] ${trimmedCustom}`
      : trimmedCustom
        ? `[Promote override · ${baseLabel}] ${trimmedCustom}`
        : `[Promote override] ${baseLabel}`;
    setSubmitting(true);
    try {
      await onConfirm(record.id, note);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-xl w-[480px] max-w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[#F0F0F6]">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#FEF3C7] text-[#92400E]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <path d="M12 9v4M12 17h.01" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-[#0B0B14] m-0">Override &quot;Not Promoted&quot; decision?</h3>
              <p className="text-[12px] text-[#6B6B7B] mt-1 m-0">
                <strong className="text-[#0B0B14]">{record.student_name}</strong> is currently marked as
                <span className="mx-1 inline-flex items-center gap-1 rounded-full bg-[#FFF1F2] px-2 py-0.5 text-[10px] font-bold text-[#991B1B]">
                  Not Promoted
                </span>
                {previousRetentionReason ? (
                  <>(reason: <em className="capitalize">{previousRetentionReason.replace(/_/g, ' ')}</em>)</>
                ) : null}.
                Please record why this is being changed.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6B7B] mb-2">Reason for override</p>
          <div className="space-y-1.5">
            {OVERRIDE_REASONS.map((r) => (
              <label
                key={r.value}
                className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${
                  reasonKey === r.value
                    ? 'border-[#4729F4] bg-[#F8F6FF]'
                    : 'border-[#E6E6EC] hover:bg-[#FAFAFD]'
                }`}
              >
                <input
                  type="radio"
                  name="override-reason"
                  value={r.value}
                  checked={reasonKey === r.value}
                  onChange={() => setReasonKey(r.value)}
                  className="mt-0.5 accent-[#4729F4]"
                />
                <div>
                  <div className="text-[12px] font-semibold text-[#0B0B14]">{r.label}</div>
                  <div className="text-[10.5px] text-[#6B6B7B]">{r.sub}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-4">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6B7B] block mb-1">
              {isOther ? 'Custom message (required)' : 'Additional note (optional)'}
            </label>
            <textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              rows={3}
              placeholder={isOther ? 'Describe the reason for this override…' : 'Add context for audit log…'}
              className="w-full px-3 py-2 text-[12px] border border-[#E6E6EC] rounded-lg outline-none focus:border-[#4729F4] focus:ring-2 focus:ring-[#4729F4]/20 resize-none"
            />
            {isOther && !isValid && (
              <p className="text-[10.5px] text-[#C2264E] mt-1">A custom message of at least 3 characters is required.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-[#FAFAFD] border-t border-[#F0F0F6]">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="h-8 px-3 text-[12px] font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg hover:bg-[#F4F4F8] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="h-8 px-4 text-[12px] font-semibold text-white bg-[#4729F4] rounded-lg hover:bg-[#3a21d4] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving…' : 'Confirm override'}
          </button>
        </div>
      </div>
    </div>
  );
}
