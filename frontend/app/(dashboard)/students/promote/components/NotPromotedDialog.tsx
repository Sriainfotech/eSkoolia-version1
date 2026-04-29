'use client';

import React, { useEffect, useState } from 'react';
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

// NEW (Fix 4): mandatory subjects by class level — static, no API
const MANDATORY_SUBJECTS: Record<string, string[]> = {
  'nursery': ['English (Oral)','Hindi (Oral)','Mathematics (Basic)','Environmental Awareness','Art & Craft','Music & Rhymes','Physical Development'],
  'lkg':     ['English','Hindi','Mathematics','Environmental Studies','Art & Craft','Music & Rhymes','Physical Education'],
  'ukg':     ['English','Hindi','Mathematics','Environmental Studies','General Knowledge','Art & Craft','Physical Education'],
  'grade 1': ['English','Hindi','Mathematics','EVS','General Knowledge','Art & Craft','Physical Education','Computer Basics'],
  'grade 2': ['English','Hindi','Mathematics','EVS','General Knowledge','Art & Craft','Physical Education','Computer Basics'],
  'grade 3': ['English','Hindi','Mathematics','Science','Social Studies','Computer Science','Physical Education','General Knowledge'],
  'grade 4': ['English','Hindi','Mathematics','Science','Social Studies','Computer Science','Physical Education','General Knowledge'],
  'grade 5': ['English','Hindi','Mathematics','Science','Social Studies','Computer Science','Physical Education','General Knowledge'],
  'grade 6': ['English','Hindi / Sanskrit','Mathematics','Science','Social Studies','Computer Science','Physical Education','Art & Craft'],
  'grade 7': ['English','Hindi / Sanskrit','Mathematics','Science','Social Studies','Computer Science','Physical Education','Art & Craft'],
  'grade 8': ['English','Hindi / Sanskrit','Mathematics','Science','Social Studies','Computer Science','Physical Education','Art & Craft'],
  'grade 9': ['English','Hindi','Mathematics','Physics','Chemistry','Biology','Social Studies / History','Computer Science'],
  'grade 10':['English','Hindi','Mathematics','Physics','Chemistry','Biology','Social Studies / History','Computer Science'],
};

function getSubjectsForClass(classDisplay: string): string[] {
  const normalized = String(classDisplay ?? '').toLowerCase().trim();
  if (MANDATORY_SUBJECTS[normalized]) return MANDATORY_SUBJECTS[normalized];
  if (/^\d+$/.test(normalized)) return MANDATORY_SUBJECTS[`grade ${normalized}`] ?? MANDATORY_SUBJECTS['grade 9'];
  // Try "class 5", "standard 7" → "grade N"
  const numMatch = normalized.match(/(\d+)/);
  if (numMatch) {
    const key = `grade ${numMatch[1]}`;
    if (MANDATORY_SUBJECTS[key]) return MANDATORY_SUBJECTS[key];
  }
  for (const key of Object.keys(MANDATORY_SUBJECTS)) {
    if (normalized.includes(key) || key.includes(normalized)) return MANDATORY_SUBJECTS[key];
  }
  return MANDATORY_SUBJECTS['grade 9'];
}

interface Props {
  batchId: number;
  record: PromotionRecord;
  isEditMode?: boolean;
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
  isEditMode = false,
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

  // NEW (Fix 4): Subjects of Concern state
  const subjectsForClass = getSubjectsForClass(record.from_class_name ?? '');
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(() => {
    // Try to seed from existing notes if they contain "Subjects of concern: …"
    const m = (initialNotes ?? '').match(/Subjects of concern:\s*([^\n]+)/i);
    if (!m) return new Set();
    return new Set(m[1].split(',').map((s) => s.trim()).filter(Boolean));
  });

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  };

  // Reset subjects when reason changes away from academic/other
  useEffect(() => {
    if (reason !== 'academic' && reason !== 'other') {
      setSelectedSubjects(new Set());
    }
  }, [reason]);

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
      // CHANGED (Fix 4): prepend selected subjects of concern to notes for record-keeping
      let mergedNotes = notes;
      if (selectedSubjects.size > 0) {
        const subjectsLine = `Subjects of concern: ${Array.from(selectedSubjects).join(', ')}`;
        const stripped = notes.replace(/^Subjects of concern:[^\n]*\n?/i, '').trim();
        mergedNotes = stripped ? `${subjectsLine}\n${stripped}` : subjectsLine;
      } else {
        mergedNotes = notes.replace(/^Subjects of concern:[^\n]*\n?/i, '').trim();
      }
      await onConfirm({
        record_id: record.id,
        reason,
        notes: mergedNotes,
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
        className="bg-white rounded-2xl shadow-2xl w-[680px] max-w-full max-h-[90vh] overflow-hidden flex flex-col"
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
            {isEditMode ? 'EDIT RETENTION' : 'NOT PROMOTED'}
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

          {/* NEW (Fix 4): Subjects of Concern — only for academic/other reasons */}
          {(reason === 'academic' || reason === 'other') && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B6B7B] mb-2">
                Subjects of Concern
                <span className="ml-2 font-normal normal-case tracking-normal text-[#9CA0AE]">
                  (select all that failed or are of concern)
                </span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {subjectsForClass.map((subject) => {
                  const checked = selectedSubjects.has(subject);
                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => toggleSubject(subject)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border-2 text-[11px] font-medium text-left transition-all duration-150 ${
                        checked
                          ? 'border-[#4729F4] bg-[#F1ECFF] text-[#3a21d4] font-semibold'
                          : 'border-[#E6E6EC] text-[#3A3A4A] hover:border-[#C7BCFF] hover:bg-[#FAF8FF]'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center ${
                          checked ? 'bg-[#4729F4] border-[#4729F4]' : 'border-[#9CA0AE]'
                        }`}
                      >
                        {checked && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <polyline points="1,4 3,6 7,2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{subject}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
              rows={5}
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
            {submitting ? 'Saving…' : isEditMode ? 'Update Retention Details' : '✗ Confirm Not Promoted'}
          </button>
        </div>
      </div>
    </div>
  );
}
