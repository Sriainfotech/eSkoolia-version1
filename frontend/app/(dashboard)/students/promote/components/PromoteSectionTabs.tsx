'use client';

import React from 'react';
import type { PromotionRecord } from '@/lib/promotion-api';
import type { RecordDecision } from './PromoteStudentTable';

export type SectionTabItem = {
  key: string;
  sectionId: number | null;
  sectionName: string;
  records: PromotionRecord[];
};

interface Props {
  sections: SectionTabItem[];
  activeKey: string;
  decisions: Record<number, RecordDecision>;
  onChange: (key: string) => void;
}

export default function PromoteSectionTabs({ sections, activeKey, decisions, onChange }: Props) {
  return (
    <div className="flex px-5 bg-[#FAFAFD] border-b border-[#F1F1F5] overflow-x-auto">
      {sections.map((sec) => {
        const isActive = sec.key === activeKey;
        const total = sec.records.length;
        const decidedCount = sec.records.filter((r) => {
          const s = decisions[r.id]?.status ?? r.status;
          return s !== 'pending';
        }).length;
        const isComplete = total > 0 && decidedCount === total;
        const isPartial = total > 0 && decidedCount > 0 && decidedCount < total;

        let badgeClass: string;
        if (isComplete) badgeClass = 'bg-green-100 text-green-700';
        else if (isPartial) badgeClass = 'bg-yellow-100 text-yellow-700';
        else if (isActive) badgeClass = 'bg-[#EEEBFF] text-[#4729F4]';
        else badgeClass = 'bg-[#F1F1F5] text-[#9CA0AE]';

        const titleText = isComplete
          ? `Section ${sec.sectionName} – Complete`
          : total > 0
            ? `Section ${sec.sectionName} – ${decidedCount} of ${total} decided`
            : `Section ${sec.sectionName}`;

        return (
          <button
            key={sec.key}
            onClick={() => onChange(sec.key)}
            title={titleText}
            className={`py-2.5 px-3.5 text-[12px] font-medium whitespace-nowrap border-b-2 cursor-pointer bg-transparent transition-colors flex items-center gap-1 ${
              isActive
                ? 'text-[#4729F4] border-[#4729F4] font-semibold'
                : 'text-[#9CA0AE] border-transparent hover:text-[#4729F4]'
            }`}
          >
            Section {sec.sectionName}
            <span className={`ml-1.5 px-1.5 py-px rounded-full text-[9px] font-bold ${badgeClass}`}>
              {total}
            </span>
          </button>
        );
      })}
    </div>
  );
}
