'use client';

import React, { useState } from 'react';
import type { PromotionRecord } from '@/lib/promotion-api';
import { promotionApi } from '@/lib/promotion-api';

export type RetentionReason = 'academic' | 'attendance' | 'medical' | 'behavioral' | 'parent_request' | 'other';

const REASONS: { value: RetentionReason; label: string; sub: string }[] = [
  { value: 'academic',       label: 'Academic',       sub: 'Failed exams / performance' },
  { value: 'attendance',     label: 'Attendance',     sub: 'Below required threshold' },
  { value: 'medical',        label: 'Medical Leave',  sub: 'Prolonged health-related' },
  { value: 'behavioral',     label: 'Behavioral',     sub: 'Disciplinary concerns' },
  { value: 'parent_request', label: 'Parent Request', sub: 'Guardian requested retention' },
  { value: 'other',          label: 'Other',          sub: 'Specify in notes' },
];

interface Props {
  batchId: number;
  record: PromotionRecord;
  initialReason?: string;
  initialNotes?: string;
  initialAi?: string;
  onConfirm: (data: {
    record_id: number;
    reason: RetentionReason;
    notes: string;
    ai_recommendation: string;
  }) => Promise<void> | void;
  onCancel: () => void;
}

export default function NotPromotedDialog({
  batchId,
  record,
  initialReason,
  initialNotes,
  initialAi,
  onConfirm,
  onCancel,
}: Props) {
  const [reason, setReason] = useState<RetentionReason>(
    (initialReason as RetentionReason) || 'academic',
  );
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [aiText, setAiText] = useState(initialAi ?? '');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleGenerate = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const res = await promotionApi.aiRecommendation(batchId, {
        record_id: record.id,
        reason,
      });
      setAiText(res.recommendation);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI recommendation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm({
        record_id: record.id,
        reason,
        notes,
        ai_recommendation: aiText,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[640px] max-w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F6]">
          <div>
            <div className="text-[15px] font-bold text-[#0B0B14]">{record.student_name}</div>
            <div className="text-xs text-[#9CA0AE]">
              {record.admission_no} · {record.from_class_name ?? '—'}
              {record.from_section_name ? ` · ${record.from_section_name}` : ''}
            </div>
          </div>
          <span className="px-3 py-1 bg-[#DC2626] text-white rounded-full text-[11px] font-bold">
            NOT PROMOTED
          </span>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-5">
          {/* Reason */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B6B7B] mb-2">
              Reason for Retention
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`flex items-start gap-2 p-3 rounded-lg border-2 text-left transition ${
                    reason === r.value
                      ? 'border-[#DC2626] bg-[#FEF2F2]'
                      : 'border-[#E6E6EC] hover:border-[#FCA5A5] hover:bg-[#FEF2F2]'
                  }`}
                >
                  <input
                    type="radio"
                    checked={reason === r.value}
                    readOnly
                    className="mt-0.5 accent-[#DC2626]"
                  />
                  <div>
                    <div className="text-xs font-bold text-[#0B0B14]">{r.label}</div>
                    <div className="text-[10px] text-[#6B6B7B] mt-0.5">{r.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* AI Recommendation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B6B7B]">
                AI Recommendation
              </label>
              <button
                onClick={handleGenerate}
                disabled={aiLoading}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#4729F4] hover:underline disabled:opacity-40"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
                </svg>
                {aiLoading ? 'Generating…' : aiText ? 'Regenerate' : 'Generate AI'}
              </button>
            </div>
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Click Generate AI to draft a recommendation, or write one yourself."
              rows={4}
              className="w-full text-[12px] border border-[#E6E6EC] rounded-lg px-3 py-2 bg-[#FAFAFD] text-[#0B0B14] focus:outline-none focus:ring-2 focus:ring-[#4729F4] resize-y"
            />
            {aiError && <p className="text-[11px] text-[#DC2626] mt-1">{aiError}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-[#6B6B7B] mb-2">
              Internal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything else for the record (visible to teachers/admin)…"
              rows={3}
              className="w-full text-[12px] border border-[#E6E6EC] rounded-lg px-3 py-2 bg-white text-[#0B0B14] focus:outline-none focus:ring-2 focus:ring-[#4729F4] resize-y"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#F0F0F6] flex items-center gap-3 px-6 py-3 bg-[#FAFAFD]">
          <span className="flex-1 text-[11px] text-[#9CA0AE]">
            Reason &amp; notes will be saved with this student record.
          </span>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 border border-[#E6E6EC] rounded-lg text-[12px] font-semibold text-[#3A3A4A] bg-white hover:bg-[#F4F4F8] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="px-5 py-2 bg-[#DC2626] text-white rounded-lg text-[12px] font-bold hover:bg-[#b91c1c] transition-colors disabled:opacity-40"
          >
            {submitting ? 'Saving…' : '✗ Confirm Not Promoted'}
          </button>
        </div>
      </div>
    </div>
  );
}
