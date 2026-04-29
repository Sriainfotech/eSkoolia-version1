'use client';
import React from 'react';
import type { SectionSummary } from '../types';

interface Props {
  section: SectionSummary;
}

export default function SectionSummaryBar({ section }: Props) {
  const pct = section.attendance_pct;

  return (
    <div className="px-5 py-2 flex items-center gap-4 flex-wrap bg-[#F8F6FF] border-b border-[#EEEBFF]">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#3A3A4A]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#0A8C5A] flex-shrink-0" />
        <span>{section.present_count} present</span>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#3A3A4A]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#C2264E] flex-shrink-0" />
        <span>{section.absent_count} absent</span>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#3A3A4A]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#B4721B] flex-shrink-0" />
        <span>{section.late_count} late</span>
      </div>
      {section.unmarked_count > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#3A3A4A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#9CA0AE] flex-shrink-0" />
          <span>{section.unmarked_count} unmarked</span>
        </div>
      )}
      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        <div className="w-[80px] h-[5px] bg-[#F1F1F5] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4729F4] rounded-full transition-all"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <span className="text-[11px] font-bold text-[#4729F4] whitespace-nowrap">{pct}%</span>
      </div>
    </div>
  );
}
