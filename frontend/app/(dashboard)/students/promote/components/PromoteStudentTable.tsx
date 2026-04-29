'use client';

import React, { useEffect, useRef } from 'react';
import type { PromotionRecord } from '@/lib/promotion-api';

export type RecordDecision = {
  status: 'pending' | 'promote' | 'not_promoted';
  retention_reason: string;
  failed_subject_ids: number[];
  notes: string;
  ai_recommendation: string;
};

interface IndeterminateCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
}

function IndeterminateCheckbox({ checked, indeterminate, onChange, ariaLabel }: IndeterminateCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={ariaLabel}
      className="w-4 h-4 accent-[#4729F4] cursor-pointer"
    />
  );
}

const STATUS_PILL: Record<RecordDecision['status'], { label: string; bg: string; color: string; dot: string }> = {
  pending:      { label: 'Pending',      bg: '#FFFBEB', color: '#92400E', dot: '#D97706' },
  promote:      { label: 'Promote',      bg: '#ECFDF5', color: '#166534', dot: '#16A34A' },
  not_promoted: { label: 'Not Promoted', bg: '#FFF1F2', color: '#991B1B', dot: '#DC2626' },
};

interface Props {
  records: PromotionRecord[];
  decisions: Record<number, RecordDecision>;
  selectedIds: Set<number>;
  isReadOnly?: boolean;
  onSelect: (recordId: number, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onStatusChange: (recordId: number, status: RecordDecision['status']) => void;
  onOpenNotPromoted: (record: PromotionRecord) => void;
}

export default function PromoteStudentTable({
  records,
  decisions,
  selectedIds,
  isReadOnly = false,
  onSelect,
  onSelectAll,
  onStatusChange,
  onOpenNotPromoted,
}: Props) {
  const allSelected = records.length > 0 && records.every((r) => selectedIds.has(r.id));
  const someSelected = records.some((r) => selectedIds.has(r.id));

  if (records.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-[#9CA0AE]">
        No students match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#FAFAFD] border-b border-[#F1F1F5] text-[11px] uppercase tracking-wide text-[#6B6B7B]">
            <th className="px-4 py-2.5 text-left font-semibold w-10">
              <IndeterminateCheckbox
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onChange={onSelectAll}
                ariaLabel="Select all rows"
              />
            </th>
            <th className="px-4 py-2.5 text-left font-semibold">Adm. No</th>
            <th className="px-4 py-2.5 text-left font-semibold">Student</th>
            <th className="px-4 py-2.5 text-left font-semibold">Next Class</th>
            <th className="px-4 py-2.5 text-left font-semibold w-44">Decision</th>
            <th className="px-4 py-2.5 text-left font-semibold">Retention reason</th>
          </tr>
        </thead>
        <tbody>
          {records.map((rec) => {
            const d = decisions[rec.id] ?? {
              status: rec.status,
              retention_reason: rec.retention_reason ?? '',
              failed_subject_ids: rec.failed_subject_ids ?? [],
              notes: rec.notes ?? '',
              ai_recommendation: rec.ai_recommendation ?? '',
            };
            const pill = STATUS_PILL[d.status];
            const isSelected = selectedIds.has(rec.id);
            return (
              <tr
                key={rec.id}
                className={`border-b border-[#F1F1F5] hover:bg-[#FAFAFD] transition-colors ${
                  isSelected ? 'bg-[#F8F6FF]' : ''
                }`}
              >
                <td className="px-4 py-2.5">
                  <IndeterminateCheckbox
                    checked={isSelected}
                    indeterminate={false}
                    onChange={(c) => onSelect(rec.id, c)}
                    ariaLabel={`Select ${rec.student_name}`}
                  />
                </td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-[#3A3A4A]">{rec.admission_no}</td>
                <td className="px-4 py-2.5">
                  <div className="font-semibold text-[#0B0B14]">{rec.student_name}</div>
                  <div className="text-[11px] text-[#9CA0AE]">
                    {rec.from_class_name ?? '—'}{rec.from_section_name ? ` · ${rec.from_section_name}` : ''}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-[12px] text-[#3A3A4A]">
                  {rec.to_class_name ?? '—'}{rec.to_section_name ? ` · ${rec.to_section_name}` : ''}
                </td>
                <td className="px-4 py-2.5">
                  {isReadOnly ? (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                      style={{ background: pill.bg, color: pill.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: pill.dot }} />
                      {pill.label}
                    </span>
                  ) : (
                    <select
                      value={d.status}
                      onChange={(e) => {
                        const next = e.target.value as RecordDecision['status'];
                        if (next === 'not_promoted') {
                          onOpenNotPromoted(rec);
                        } else {
                          onStatusChange(rec.id, next);
                        }
                      }}
                      className="text-[12px] font-semibold border border-[#E6E6EC] rounded-lg px-2.5 py-1 bg-white text-[#0B0B14] focus:outline-none focus:ring-2 focus:ring-[#4729F4]"
                      style={{ background: pill.bg, color: pill.color, borderColor: pill.bg }}
                    >
                      <option value="pending">Pending</option>
                      <option value="promote">Promote</option>
                      <option value="not_promoted">Not Promoted</option>
                    </select>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[12px] text-[#3A3A4A] max-w-[280px]">
                  {d.status === 'not_promoted' ? (
                    <div className="flex items-center gap-2 group">
                      <span
                        className="inline-flex items-center text-[11px] font-semibold text-[#991B1B] bg-[#FFF1F2] border border-[#FECACA] rounded px-2 py-0.5 capitalize max-w-[160px] truncate"
                        title={d.retention_reason ? d.retention_reason.replace(/_/g, ' ') : 'No reason set'}
                      >
                        {d.retention_reason
                          ? d.retention_reason.replace(/_/g, ' ')
                          : 'No reason set'}
                      </span>
                      {!isReadOnly && (
                        <button
                          onClick={() => onOpenNotPromoted(rec)}
                          title="Edit retention details"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[#F1F1F5]"
                          aria-label={`Edit retention details for ${rec.student_name}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#6B6B7B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 2l3 3-9 9H2v-3l9-9z" />
                            <line x1="9" y1="4" x2="12" y2="7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-[#9CA0AE] italic">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
