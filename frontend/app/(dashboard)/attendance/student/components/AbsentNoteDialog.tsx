'use client';
import React, { useState } from 'react';
import type { Student } from '../types';

const QUICK_REASONS = [
  'Parent applied leave',
  'Parent informed — student is sick',
  'No intimation',
] as const;

const NO_INTIMATION_REASON = 'No intimation';

interface Props {
  student: Student;
  initialReason?: string;
  onConfirm: (reason: string) => void;
  onSkip: () => void;
}

export default function AbsentNoteDialog({ student, initialReason, onConfirm, onSkip }: Props) {
  const normalizedInitialReason = initialReason?.trim() ?? '';
  const [selected, setSelected] = useState<string | null>(
    QUICK_REASONS.includes(normalizedInitialReason as (typeof QUICK_REASONS)[number])
      ? normalizedInitialReason
      : null,
  );
  const [custom, setCustom] = useState(
    normalizedInitialReason && !QUICK_REASONS.includes(normalizedInitialReason as (typeof QUICK_REASONS)[number])
      ? normalizedInitialReason
      : '',
  );

  const reason = custom.trim() || selected || '';
  const shouldCountWithReason = reason.length > 0 && reason !== NO_INTIMATION_REASON;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onSkip}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[420px] max-w-[92vw] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#F0F0F6]">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="w-5 h-5 rounded-full bg-[#FCE8EE] flex items-center justify-center shrink-0">
              <svg className="w-3 h-3 text-[#C2264E]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <circle cx={12} cy={12} r={10} />
                <path d="m15 9-6 6M9 9l6 6" />
              </svg>
            </span>
            <h3 className="text-[14px] font-semibold text-[#0B0B14] m-0">
              Mark {student.full_name} Absent
            </h3>
          </div>
          <p className="text-[12px] text-[#6B6B7B] m-0 ml-7">
            Select a reason to track this absence.
          </p>
        </div>

        {/* Quick reasons */}
        <div className="px-5 pt-4 pb-2 flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] m-0 mb-1">
            Quick reasons
          </p>
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => { setSelected(r); setCustom(''); }}
              className={`text-left px-3 py-2.5 rounded-lg text-[12px] font-medium border transition-colors cursor-pointer ${
                selected === r && !custom
                  ? 'bg-[#FCE8EE] border-[#C2264E]/40 text-[#7C1030]'
                  : 'bg-[#FAFAFD] border-[#E6E6EC] text-[#3A3A4A] hover:bg-[#F4F4F8]'
              }`}
            >
              {r}
            </button>
          ))}
          <input
            type="text"
            placeholder="Or type a custom reason…"
            value={custom}
            onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-[#E6E6EC] text-[12px] text-[#0B0B14] placeholder:text-[#9CA0AE] outline-none focus:border-[#4729F4] transition-colors"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-[#FAFAFD] border-t border-[#F0F0F6]">
          <button
            type="button"
            onClick={onSkip}
            className="h-8 px-3 text-[11px] font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg cursor-pointer hover:bg-[#F4F4F8] transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            className="h-8 px-4 text-[11px] font-semibold text-white bg-[#C2264E] rounded-lg border-none cursor-pointer hover:bg-[#a81e40] transition-colors"
          >
            {shouldCountWithReason ? 'Mark Absent with Reason' : 'Mark Absent'}
          </button>
        </div>
      </div>
    </div>
  );
}
