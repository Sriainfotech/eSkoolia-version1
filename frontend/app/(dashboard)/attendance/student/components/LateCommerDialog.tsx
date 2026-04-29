'use client';
import React, { useState } from 'react';
import type { Student } from '../types';

type ReasonKind = 'school_approved' | 'unapproved';
interface PresetReason { label: string; kind: ReasonKind; }

const PRESET_REASONS: PresetReason[] = [
  // School-approved reasons
  { label: 'Bus delay', kind: 'school_approved' },
  { label: 'School event or trip', kind: 'school_approved' },
  { label: 'Medical appointment', kind: 'school_approved' },
  { label: 'Traffic / weather conditions', kind: 'school_approved' },
  { label: 'Other school-approved reason', kind: 'school_approved' },
  // Unapproved (counts as Late)
  { label: 'Overslept', kind: 'unapproved' },
  { label: 'Personal errand', kind: 'unapproved' },
  { label: 'No reason provided', kind: 'unapproved' },
];

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

interface Props {
  student: Student;
  minutesLate: number;
  initialMessage?: string;
  onMarkLate: (message: string) => void;
  onSchoolApproved: (reason: string) => void;
  onMarkAbsent?: (reason: string) => void;
  onSkip: () => void;
}

export default function LateCommerDialog({ student, minutesLate, initialMessage, onMarkLate, onSchoolApproved, onMarkAbsent, onSkip }: Props) {
  const normalized = initialMessage?.trim() ?? '';
  const initialApproved = normalized.startsWith('School approved:')
    ? normalized.replace(/^School approved:\s*/, '')
    : '';
  // selected: either a PresetReason or { label: string, kind: 'custom' }
  const [selectedLabel, setSelectedLabel] = useState<string>(initialApproved || (initialApproved ? '' : normalized));
  const [selectedKind, setSelectedKind] = useState<ReasonKind | 'custom'>(
    initialApproved ? 'school_approved' : (normalized ? 'custom' : 'unapproved'),
  );
  const [customText, setCustomText] = useState<string>(initialApproved ? '' : normalized);

  const useCustom = selectedKind === 'custom';
  const finalText = useCustom ? customText.trim() : selectedLabel;
  const canSubmit = finalText.length > 0;

  function pickPreset(p: PresetReason) {
    setSelectedKind(p.kind);
    setSelectedLabel(p.label);
  }

  function pickCustom() {
    setSelectedKind('custom');
    setSelectedLabel('');
  }

  function handlePrimary() {
    if (!canSubmit) return;
    if (selectedKind === 'school_approved') {
      onSchoolApproved(finalText);
    } else {
      // 'unapproved' or 'custom' → mark late with that reason
      onMarkLate(finalText);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onSkip}>
      <div className="bg-white rounded-xl shadow-xl w-[480px] max-w-[94vw] overflow-hidden" onClick={(e) => e.stopPropagation()}>
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
            <strong>{student.full_name}</strong> arrived <strong>{minutesLate} minute{minutesLate !== 1 ? 's' : ''}</strong> after class start.
            Pick a reason below — school-approved reasons keep the student marked Present.
          </p>
        </div>

        {/* Combined reasons list */}
        <div className="px-5 py-4 max-h-[300px] overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#0A8C5A] m-0 mb-1.5">School-approved (counts as Present)</p>
          <div className="flex flex-col gap-1.5 mb-3">
            {PRESET_REASONS.filter((r) => r.kind === 'school_approved').map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => pickPreset(r)}
                className={`text-left px-3 py-2 rounded-lg text-[12px] font-medium border transition-colors cursor-pointer ${
                  selectedKind === 'school_approved' && selectedLabel === r.label
                    ? 'bg-[#E4F6ED] border-[#0A8C5A]/50 text-[#0A5C3A]'
                    : 'bg-[#FAFAFD] border-[#E6E6EC] text-[#3A3A4A] hover:bg-[#F4F4F8]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <p className="text-[10px] font-bold uppercase tracking-wide text-[#B4721B] m-0 mb-1.5">Unapproved (counts as Late)</p>
          <div className="flex flex-col gap-1.5 mb-3">
            {PRESET_REASONS.filter((r) => r.kind === 'unapproved').map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => pickPreset(r)}
                className={`text-left px-3 py-2 rounded-lg text-[12px] font-medium border transition-colors cursor-pointer ${
                  selectedKind === 'unapproved' && selectedLabel === r.label
                    ? 'bg-[#FDF1DC] border-[#B4721B]/50 text-[#7A4A0F]'
                    : 'bg-[#FAFAFD] border-[#E6E6EC] text-[#3A3A4A] hover:bg-[#F4F4F8]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <p className="text-[10px] font-bold uppercase tracking-wide text-[#4729F4] m-0 mb-1.5">Custom reason</p>
          <input
            type="text"
            placeholder="Type a custom reason…"
            value={customText}
            onChange={(e) => { setCustomText(e.target.value); pickCustom(); }}
            onFocus={pickCustom}
            className={`w-full px-3 py-2 rounded-lg border text-[12px] text-[#0B0B14] placeholder:text-[#9CA0AE] outline-none transition-colors ${
              useCustom ? 'border-[#4729F4] bg-[#F4F2FF]' : 'border-[#E6E6EC] bg-white focus:border-[#4729F4]'
            }`}
          />
          <button
            type="button"
            onClick={() => { setCustomText(generateLateNote(student.full_name, minutesLate)); pickCustom(); }}
            className="self-start mt-2 h-7 px-3 text-[10px] font-semibold text-[#4C1D95] bg-[#F5F3FF] border border-[#DDD6FE] rounded-lg cursor-pointer hover:bg-[#EDE9FE] transition-colors"
          >
            AI Suggest Note
          </button>
        </div>

        {/* Footer — different actions for custom vs preset */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 bg-[#FAFAFD] border-t border-[#F0F0F6] flex-wrap">
          <button
            type="button"
            onClick={onSkip}
            className="h-8 px-3 text-[11px] font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg cursor-pointer hover:bg-[#F4F4F8] transition-colors"
          >
            Skip
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {useCustom && onMarkAbsent && (
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => onMarkAbsent(finalText)}
                className="h-8 px-3 text-[11px] font-semibold text-white bg-[#C2264E] rounded-lg border-none cursor-pointer hover:bg-[#a81e40] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Reject this custom reason and mark the student absent"
              >
                Mark Absent
              </button>
            )}
            {useCustom && (
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => onSchoolApproved(finalText)}
                className="h-8 px-3 text-[11px] font-semibold text-white bg-[#0A8C5A] rounded-lg border-none cursor-pointer hover:bg-[#087a4f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Approve this custom reason — student stays Present"
              >
                Approve as School-Approved
              </button>
            )}
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handlePrimary}
              className={`h-8 px-4 text-[11px] font-semibold text-white rounded-lg border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                selectedKind === 'school_approved'
                  ? 'bg-[#0A8C5A] hover:bg-[#087a4f]'
                  : 'bg-[#B4721B] hover:bg-[#975e14]'
              }`}
            >
              {selectedKind === 'school_approved' ? 'Mark Present (Approved)' : 'Mark as Late'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
