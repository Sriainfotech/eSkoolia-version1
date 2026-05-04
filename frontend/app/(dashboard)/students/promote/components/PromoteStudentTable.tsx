'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import type { PromotionRecord } from '@/lib/promotion-api';

export type RecordDecision = {
  status: 'pending' | 'promote' | 'not_promoted';
  retention_reason: string;
  failed_subject_ids: number[];
  notes: string;
  ai_recommendation: string;
};

// Format an API class name ("1", "10", "Nursery") for display ("Grade 1", "Nursery").
function formatClassLabel(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  if (/^\d+$/.test(s)) return `Grade ${s}`;
  return s;
}

// Pick a stable, vibrant avatar background per student (matches the screenshot palette).
const AVATAR_PALETTE = [
  '#7C3AED', '#9333EA', '#EA580C', '#C2410C', '#D97706',
  '#DC2626', '#0891B2', '#0E7490', '#2563EB', '#1D4ED8',
  '#16A34A', '#15803D', '#DB2777', '#BE185D', '#4F46E5',
];
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

const STATUS_PILL: Record<RecordDecision['status'], { label: string; bg: string; color: string; dot: string; icon: string }> = {
  pending:      { label: 'Pending',      bg: '#FFFBEB', color: '#92400E', dot: '#D97706', icon: '⧗' },
  promote:      { label: 'Promote',      bg: '#ECFDF5', color: '#166534', dot: '#16A34A', icon: '✓' },
  not_promoted: { label: 'Not Promoted', bg: '#FFF1F2', color: '#991B1B', dot: '#DC2626', icon: '✗' },
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

  // Live counts — drive the summary strip above the table (matches image 2).
  const summary = useMemo(() => {
    let promote = 0, notPromoted = 0, pending = 0;
    for (const r of records) {
      const s = decisions[r.id]?.status ?? r.status;
      if (s === 'promote') promote++;
      else if (s === 'not_promoted') notPromoted++;
      else pending++;
    }
    return { promote, notPromoted, pending, total: records.length };
  }, [records, decisions]);

  if (records.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-[#9CA0AE]">
        No students match the current filters.
      </div>
    );
  }

  return (
    <div>
      {/* Summary strip — mirrors the section header in image 2. */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-2 border-b border-[#F1F1F5] bg-white">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#3A3A4A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
          {summary.promote} promote
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#3A3A4A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
          {summary.notPromoted} not promoted
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#3A3A4A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
          {summary.pending} pending
        </span>
        <span className="text-[11px] text-[#6B6B7B]">
          {summary.total} student{summary.total === 1 ? '' : 's'}
        </span>
        <label className="ml-auto inline-flex items-center gap-2 text-[11px] font-medium text-[#3A3A4A] cursor-pointer">
          <IndeterminateCheckbox
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            onChange={onSelectAll}
            ariaLabel="Select all rows"
          />
          Select all
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#FAFAFD] border-b border-[#F1F1F5] text-[10.5px] uppercase tracking-wide text-[#9CA0AE]">
              <th className="pl-5 pr-2 py-2.5 text-left font-semibold w-10"></th>
              <th className="px-3 py-2.5 text-left font-semibold w-20">Roll</th>
              <th className="px-3 py-2.5 text-left font-semibold">Student name</th>
              <th className="px-3 py-2.5 text-left font-semibold">Class · Section</th>
              <th className="px-3 py-2.5 text-left font-semibold">Promote to</th>
              <th className="px-3 py-2.5 text-left font-semibold w-44">Action</th>
              <th className="px-5 py-2.5 text-left font-semibold">Notes / remarks</th>
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
              const fromLabel = formatClassLabel(rec.from_class_name);
              const toLabel = formatClassLabel(rec.to_class_name);
              const sectionTxt = rec.from_section_name ? ` · ${rec.from_section_name}` : '';
              const avBg = avatarColor(rec.student_name);
              return (
                <tr
                  key={rec.id}
                  className={`border-b border-[#F1F1F5] hover:bg-[#FAFAFD] transition-colors ${
                    isSelected ? 'bg-[#F8F6FF]' : ''
                  }`}
                >
                  <td className="pl-5 pr-2 py-3">
                    <IndeterminateCheckbox
                      checked={isSelected}
                      indeterminate={false}
                      onChange={(c) => onSelect(rec.id, c)}
                      ariaLabel={`Select ${rec.student_name}`}
                    />
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] text-[#6B6B7B]">{rec.admission_no}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ background: avBg }}
                      >
                        {initials(rec.student_name)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-[12.5px] text-[#0B0B14] truncate">{rec.student_name}</div>
                        <div className="text-[10.5px] text-[#9CA0AE]">{fromLabel}{sectionTxt}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-[#3A3A4A]">
                    {fromLabel}{sectionTxt}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 rounded-md border border-[#A7F3D0] bg-[#F0FDF4] px-2 py-1 text-[11px] font-semibold text-[#0F766E]">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M7 17 17 7M9 7h8v8" />
                      </svg>
                      {toLabel}
                    </span>
                  </td>
                  <td className="px-3 py-3">
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
                        className="w-full text-[12px] font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#4729F4] cursor-pointer"
                        style={{ background: pill.bg, color: pill.color, border: `1px solid ${pill.dot}33` }}
                      >
                        <option value="pending">⧗ Pending</option>
                        <option value="promote">✓ Promote</option>
                        <option value="not_promoted">✗ Not Promoted</option>
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[12px] text-[#3A3A4A] max-w-[280px]">
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
                      <span className="text-[#C8C8D4]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

