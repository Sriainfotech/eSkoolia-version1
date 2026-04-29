'use client';
import React, { useState } from 'react';
import type { Student } from '../types';

const SCHOOL_APPROVED_REASONS = [
  'Bus delay',
  'School event or trip',
  'Medical appointment',
  'Traffic / weather conditions',
  'Other school-approved reason',
] as const;

function generateLateNote(studentName: string, minutesLate: number): string {
  const templates = [
    `${studentName} arrived ${minutesLate} minutes late due to transport delay.`,
    `${studentName} reached late after heavy traffic conditions this morning.`,
    `${studentName} was delayed by weather conditions and joined class shortly after arrival.`,
    `${studentName} reported a late bus pickup and has now joined the class routine.`,
  ];
  const idx = Math.floor(Date.now() / 1000) % templates.length;
  return templates[idx];
}

function generateSchoolApprovedReason(): string {
  const options = [
    'Transport disruption reported by school bus coordinator',
    'School-approved participation in off-campus activity',
    'Verified medical appointment communicated by guardian',
    'Severe weather travel delay verified by administration',
  ];
  const idx = Math.floor(Date.now() / 1000) % options.length;
  return options[idx];
}

interface Props {
  student: Student;
  minutesLate: number;
  initialMessage?: string;
  onMarkLate: (message: string) => void;
  onSchoolApproved: (reason: string) => void;
  onSkip: () => void;
}

export default function LateCommerDialog({ student, minutesLate, initialMessage, onMarkLate, onSchoolApproved, onSkip }: Props) {
  const normalizedInitialMessage = initialMessage?.trim() ?? '';
  const initialApprovedReason = normalizedInitialMessage.startsWith('School approved:')
    ? normalizedInitialMessage.replace(/^School approved:\s*/, '')
    : '';
  const [mode, setMode] = useState<'choose' | 'school_approved'>(initialApprovedReason ? 'school_approved' : 'choose');
  const [approvedReason, setApprovedReason] = useState(initialApprovedReason);
  const [customMessage, setCustomMessage] = useState(initialApprovedReason ? '' : normalizedInitialMessage);

  if (mode === 'school_approved') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={onSkip}
      >
        <div
          className="bg-white rounded-xl shadow-xl w-[420px] max-w-[92vw] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-4 border-b border-[#F0F0F6]">
            <h3 className="text-[14px] font-semibold text-[#0B0B14] m-0">School-Approved Reason</h3>
            <p className="text-[12px] text-[#6B6B7B] mt-1 m-0">
              Select a reason to override the late-comer flag for{' '}
              <strong>{student.full_name}</strong>.
            </p>
          </div>
          <div className="px-5 pt-4 pb-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setApprovedReason(generateSchoolApprovedReason())}
              className="h-8 px-3 text-[11px] font-semibold text-[#4C1D95] bg-[#F5F3FF] border border-[#DDD6FE] rounded-lg cursor-pointer hover:bg-[#EDE9FE] transition-colors"
            >
              AI Suggest Approved Reason
            </button>
            {SCHOOL_APPROVED_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setApprovedReason(r)}
                className={`text-left px-3 py-2.5 rounded-lg text-[12px] font-medium border transition-colors cursor-pointer ${
                  approvedReason === r
                    ? 'bg-[#E4F6ED] border-[#0A8C5A]/40 text-[#0A5C3A]'
                    : 'bg-[#FAFAFD] border-[#E6E6EC] text-[#3A3A4A] hover:bg-[#F4F4F8]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 px-5 py-3 bg-[#FAFAFD] border-t border-[#F0F0F6]">
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="h-8 px-3 text-[11px] font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg cursor-pointer hover:bg-[#F4F4F8] transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={!approvedReason}
              onClick={() => onSchoolApproved(approvedReason)}
              className="h-8 px-4 text-[11px] font-semibold text-white bg-[#0A8C5A] rounded-lg border-none cursor-pointer hover:bg-[#087a4f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Override Late Flag
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="flex items-center gap-2 mb-1">
            <span className="w-5 h-5 rounded-full bg-[#FDF1DC] flex items-center justify-center shrink-0">
              <svg className="w-3 h-3 text-[#B4721B]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <circle cx={12} cy={12} r={10} />
                <path d="M12 6v6l4 2" />
              </svg>
            </span>
            <h3 className="text-[14px] font-semibold text-[#0B0B14] m-0">Late Arrival Detected</h3>
          </div>
          <p className="text-[12px] text-[#6B6B7B] m-0 ml-7">
            <strong>{student.full_name}</strong> is being marked present{' '}
            <strong>{minutesLate} minute{minutesLate !== 1 ? 's' : ''}</strong> after the
            late-arrival window opened (30 min after first absent mark).
          </p>
        </div>

        {/* Optional message */}
        <div className="px-5 py-4 flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] m-0">
            Add a note (optional)
          </p>
          <input
            type="text"
            placeholder="e.g. arrived after morning assembly…"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#E6E6EC] text-[12px] text-[#0B0B14] placeholder:text-[#9CA0AE] outline-none focus:border-[#4729F4] transition-colors"
          />
          <button
            type="button"
            onClick={() => setCustomMessage(generateLateNote(student.full_name, minutesLate))}
            className="self-start h-7 px-3 text-[10px] font-semibold text-[#4C1D95] bg-[#F5F3FF] border border-[#DDD6FE] rounded-lg cursor-pointer hover:bg-[#EDE9FE] transition-colors"
          >
            AI Suggest Note
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 bg-[#FAFAFD] border-t border-[#F0F0F6]">
          <button
            type="button"
            onClick={() => setMode('school_approved')}
            className="h-8 px-3 text-[11px] font-semibold text-[#B4721B] bg-[#FDF1DC] border border-[#B4721B]/30 rounded-lg cursor-pointer hover:bg-[#f5e3c0] transition-colors"
          >
            School Approved
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="h-8 px-3 text-[11px] font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg cursor-pointer hover:bg-[#F4F4F8] transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => onMarkLate(customMessage.trim())}
              className="h-8 px-4 text-[11px] font-semibold text-white bg-[#B4721B] rounded-lg border-none cursor-pointer hover:bg-[#975e14] transition-colors"
            >
              Mark as Late Comer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
