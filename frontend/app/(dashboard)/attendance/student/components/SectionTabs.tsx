'use client';
import React from 'react';
import type { SectionSummary, Student } from '../types';

interface Props {
  sections: SectionSummary[];
  activeSection: number;
  onChange: (sectionId: number) => void;
  students?: Record<string, Student[]>;
  classId?: number;
}

export default function SectionTabs({ sections, activeSection, onChange, students, classId }: Props) {
  return (
    <div className="flex px-5 bg-[#FAFAFD] border-b border-[#F1F1F5] overflow-x-auto">
      {sections.map((sec) => {
        const isActive = sec.id === activeSection;
        const key = classId != null ? `${classId}-${sec.id}` : '';
        const sectionStudents = (students && key) ? (students[key] ?? []) : [];
        const markedCount = sectionStudents.filter((s) => s.status !== 'unmarked' && s.status != null).length;
        const totalCount = sectionStudents.length;
        const isComplete = totalCount > 0 && markedCount === totalCount;
        const isPartial = totalCount > 0 && markedCount > 0 && markedCount < totalCount;

        let badgeClass: string;
        if (isComplete) {
          badgeClass = 'bg-green-100 text-green-700';
        } else if (isPartial) {
          badgeClass = 'bg-yellow-100 text-yellow-700';
        } else if (isActive) {
          badgeClass = 'bg-[#EEEBFF] text-[#4729F4]';
        } else {
          badgeClass = 'bg-[#F1F1F5] text-[#9CA0AE]';
        }

        const titleText = isComplete
          ? `Section ${sec.name} – Complete`
          : totalCount > 0
            ? `Section ${sec.name} – ${markedCount} of ${totalCount} marked`
            : `Section ${sec.name}`;

        return (
          <button
            key={sec.id}
            onClick={() => onChange(sec.id)}
            title={titleText}
            className={`py-2.5 px-3.5 text-[12px] font-medium whitespace-nowrap border-b-2 cursor-pointer bg-transparent transition-colors flex items-center gap-1 ${
              isActive
                ? 'text-[#4729F4] border-[#4729F4] font-semibold'
                : 'text-[#9CA0AE] border-transparent hover:text-[#4729F4]'
            }`}
          >
            Section {sec.name}
            <span
              className={`ml-1.5 px-1.5 py-px rounded-full text-[9px] font-bold ${badgeClass}`}
            >
              {sec.student_count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
