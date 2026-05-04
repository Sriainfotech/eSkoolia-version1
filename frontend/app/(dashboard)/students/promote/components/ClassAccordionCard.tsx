'use client';

import React, { useMemo, useState } from 'react';
import type { PromotionRecord } from '@/lib/promotion-api';
import PromoteCircularProgress from './PromoteCircularProgress';
import PromoteSectionTabs, { type SectionTabItem } from './PromoteSectionTabs';
import PromoteStudentTable, { type RecordDecision } from './PromoteStudentTable';
import BulkActionFooter from './BulkActionFooter';

export type ClassGroup = {
  classKey: string;
  classId: number | null;
  className: string;
  totalRecords: number;
  sections: SectionTabItem[];
};

interface Props {
  group: ClassGroup;
  isOpen: boolean;
  isReadOnly?: boolean;
  decisions?: Record<number, RecordDecision>;
  selectedIds?: Set<number>;
  onToggle: () => void;
  onSelect?: (recordId: number, checked: boolean) => void;
  onSelectMany?: (ids: number[], checked: boolean) => void;
  onStatusChange?: (recordId: number, status: RecordDecision['status']) => void;
  onOpenNotPromoted?: (record: PromotionRecord) => void;
  onPromoteAll?: (records: PromotionRecord[]) => void;
  onNotPromotedAll?: (records: PromotionRecord[]) => void;
  onResetAll?: (records: PromotionRecord[]) => void;
  // additional props used by StudentPromotePanel
  batchStatus?: string;
  batchIsEditable?: boolean;
  recordDecisions?: Record<number, unknown>;
  aiLoadingId?: number | null;
  onDecisionChange?: (...args: any[]) => void;
  onAskAi?: (recordId: number) => void;
  fieldStyle?: unknown;
  renderStatusBadge?: (status: any) => React.ReactNode;
}

export default function ClassAccordionCard({
  group,
  isOpen,
  isReadOnly = false,
  decisions = {},
  selectedIds = new Set(),
  onToggle,
  onSelect = () => {},
  onSelectMany = () => {},
  onStatusChange = () => {},
  onOpenNotPromoted = () => {},
  onPromoteAll = () => {},
  onNotPromotedAll = () => {},
  onResetAll = () => {},
}: Props) {
  const [activeKey, setActiveKey] = useState<string>(group.sections[0]?.key ?? '');

  const activeSection = useMemo(
    () => group.sections.find((s) => s.key === activeKey) ?? group.sections[0],
    [group.sections, activeKey],
  );

  const allRecords = useMemo(
    () => group.sections.flatMap((s) => s.records),
    [group.sections],
  );

  // Live counts based on decisions
  const counts = useMemo(() => {
    let promoted = 0, notPromoted = 0, pending = 0;
    for (const r of allRecords) {
      const s = decisions[r.id]?.status ?? r.status;
      if (s === 'promote') promoted++;
      else if (s === 'not_promoted') notPromoted++;
      else pending++;
    }
    return { promoted, notPromoted, pending, total: allRecords.length };
  }, [allRecords, decisions]);

  // Sync indicator: green if all decided, yellow if some, gray if none
  const syncStatus: 'live' | 'partial' | 'none' =
    counts.pending === 0 && counts.total > 0
      ? 'live'
      : counts.pending < counts.total
        ? 'partial'
        : 'none';

  const SYNC_COLORS: Record<string, string> = {
    live: 'bg-[#0A8C5A] animate-pulse',
    partial: 'bg-[#B4721B]',
    none: 'bg-[#E6E6EC]',
  };

  const sectionRecords = activeSection?.records ?? [];
  const sectionSelectedIds = useMemo(
    () => new Set(sectionRecords.filter((r) => selectedIds.has(r.id)).map((r) => r.id)),
    [sectionRecords, selectedIds],
  );

  const handleSelectAll = (checked: boolean) => {
    onSelectMany(sectionRecords.map((r) => r.id), checked);
  };

  const targetForBulk = sectionSelectedIds.size > 0
    ? sectionRecords.filter((r) => sectionSelectedIds.has(r.id))
    : sectionRecords;

  return (
    <div className={`bg-white rounded-xl border border-[#E6E6EC] overflow-hidden transition-all ${isOpen ? 'border-l-4 border-l-[#4729F4]' : ''}`}>
      {/* Header (mirrors attendance ClassAccordionCard) */}
      <div
        onClick={onToggle}
        className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none transition-colors ${
          isOpen ? 'bg-[#F8F6FF]' : 'hover:bg-[#FAFAFD]'
        }`}
      >
        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-[#9CA0AE] flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>

        {/* Class name */}
        <div className="flex flex-col flex-shrink-0">
          <span className="text-[13px] font-semibold text-[#0B0B14] whitespace-nowrap">
            {group.className}
          </span>
          <span className="text-[10px] text-[#9CA0AE] mt-0.5 whitespace-nowrap">
            {group.sections.length} section{group.sections.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* NEW (Fix 2a): Section name pills */}
        <div className="flex gap-1 ml-2 flex-shrink-0">
          {group.sections.map((sec) => (
            <span
              key={sec.key}
              className="text-[10px] px-1.5 py-0.5 bg-[#F1F1F5] text-[#6B6B7B] rounded font-medium"
            >
              {sec.sectionName}
            </span>
          ))}
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-1.5 ml-4 items-center">
          <span className="whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAFAFD] text-[#3A3A4A] border border-[#E6E6EC]">
            {counts.total} students
          </span>
          <span className="whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E4F6ED] text-[#0A8C5A]">
            {counts.promoted} promote
          </span>
          {counts.notPromoted > 0 && (
            <span className="whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FCE8EE] text-[#C2264E]">
              {counts.notPromoted} not promoted
            </span>
          )}
          {counts.pending > 0 && (
            <span className="whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FDF1DC] text-[#B4721B]">
              {counts.pending} pending
            </span>
          )}
        </div>

        {/* Right group */}
        <div className="ml-auto flex items-center gap-2.5 flex-shrink-0">
          <PromoteCircularProgress promoted={counts.promoted} total={counts.total} />
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SYNC_COLORS[syncStatus]}`} title={syncStatus === 'live' ? 'All decided' : syncStatus === 'partial' ? 'In progress' : 'Not started'} />
        </div>
      </div>

      {/* Body */}
      {isOpen && activeSection && (
        <div className="border-t border-[#F0F0F6]">
          {group.sections.length > 1 && (
            <PromoteSectionTabs
              sections={group.sections}
              activeKey={activeSection.key}
              decisions={decisions}
              onChange={setActiveKey}
            />
          )}
          <PromoteStudentTable
            records={sectionRecords}
            decisions={decisions}
            selectedIds={sectionSelectedIds}
            isReadOnly={isReadOnly}
            onSelect={onSelect}
            onSelectAll={handleSelectAll}
            onStatusChange={onStatusChange}
            onOpenNotPromoted={onOpenNotPromoted}
          />
          <BulkActionFooter
            selectedCount={sectionSelectedIds.size}
            totalRecords={sectionRecords.length}
            isReadOnly={isReadOnly}
            onPromoteAll={() => onPromoteAll(targetForBulk)}
            onNotPromotedAll={() => onNotPromotedAll(targetForBulk)}
            onReset={() => onResetAll(targetForBulk)}
          />
        </div>
      )}
    </div>
  );
}
