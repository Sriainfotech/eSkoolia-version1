'use client';
import React, { useState, useEffect, useCallback } from 'react';
import type { ClassInfo, Student, SectionSummary } from '../types';
import { pctTextColor } from '../utils/attendanceHelpers';
import AttendanceRing from './AttendanceRing';
import SectionTabs from './SectionTabs';
import SectionPanel from './SectionPanel';

const SYNC_COLORS: Record<string, string> = {
  live: 'bg-[#0A8C5A] animate-pulse',
  partial: 'bg-[#B4721B]',
  none: 'bg-[#E6E6EC]',
};

interface Props {
  cls: ClassInfo;
  isOpen: boolean;
  onToggle: () => void;
  students: Record<string, Student[]>;
  loadingStudents: Record<string, boolean>;
  activeSectionId: number | null;
  onSectionChange: (classId: number, sectionId: number) => void;
  selectedRows: Record<string, Set<number>>;
  onSelectionChange: (key: string, ids: Set<number>) => void;
  onToggleAbsent: (classId: number, sectionId: number, student: Student) => void;
  onToggleLunch: (classId: number, sectionId: number, student: Student) => void;
  onSignIn: (classId: number, sectionId: number, student: Student) => void;
  onSignOut: (classId: number, sectionId: number, student: Student) => void;
  onBulkMark: (classId: number, sectionId: number, status: 'present' | 'absent' | 'late') => void;
  onBulkSignIn: (classId: number, sectionId: number) => void;
  onSave: (classId: number, sectionId: number) => void;
  onReset: (classId: number, sectionId: number) => void;
}

export default function ClassAccordionCard({
  cls,
  isOpen,
  onToggle,
  students,
  loadingStudents,
  activeSectionId,
  onSectionChange,
  selectedRows,
  onSelectionChange,
  onToggleAbsent,
  onToggleLunch,
  onSignIn,
  onSignOut,
  onBulkMark,
  onBulkSignIn,
  onSave,
  onReset,
}: Props) {
  const activeSection: SectionSummary | undefined =
    cls.sections.find((s) => s.id === activeSectionId) ?? cls.sections[0];

  const sectionKey = `${cls.id}-${activeSection?.id}`;
  const sectionStudents = students[sectionKey] ?? [];
  const isLoadingSectionStudents = loadingStudents[sectionKey] ?? false;
  const selectedIds = selectedRows[sectionKey] ?? new Set<number>();

  // Compute live stats from loaded students
  const livePresentCount = sectionStudents.filter((s) => s.status === 'present').length;
  const liveAbsentCount = sectionStudents.filter((s) => s.status === 'absent').length;
  const liveLateCount = sectionStudents.filter((s) => s.status === 'late').length;
  const liveSection: SectionSummary | undefined = activeSection
    ? {
        ...activeSection,
        student_count: sectionStudents.length || activeSection.student_count,
        present_count: livePresentCount,
        absent_count: liveAbsentCount,
        late_count: liveLateCount,
        unmarked_count: sectionStudents.filter((s) => s.status === 'unmarked').length,
        attendance_pct: sectionStudents.length > 0
          ? Math.round((livePresentCount / sectionStudents.length) * 100) : 0,
      }
    : undefined;

  // Compute live class-level totals across all loaded sections
  const allSectionStudents = cls.sections.flatMap((sec) => students[`${cls.id}-${sec.id}`] ?? []);
  const liveTotalStudents = allSectionStudents.length || cls.total_students;
  const liveTotalPresent = allSectionStudents.filter((s) => s.status === 'present').length;
  const liveTotalAbsent = allSectionStudents.filter((s) => s.status === 'absent').length;
  const liveTotalLate = allSectionStudents.filter((s) => s.status === 'late').length;
  const livePct = liveTotalStudents > 0 ? Math.round((liveTotalPresent / liveTotalStudents) * 100) : cls.overall_pct;

  const handleSelect = useCallback((id: number, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id); else next.delete(id);
    onSelectionChange(sectionKey, next);
  }, [selectedIds, sectionKey, onSelectionChange]);

  const handleSelectAll = useCallback((checked: boolean) => {
    onSelectionChange(sectionKey, checked ? new Set(sectionStudents.map((s) => s.id)) : new Set());
  }, [sectionStudents, sectionKey, onSelectionChange]);

  const pct = livePct;

  return (
    <div className={`bg-white rounded-xl border border-[#E6E6EC] overflow-hidden transition-all ${isOpen ? 'border-l-4 border-l-[#4729F4]' : ''}`}>
      {/* Header */}
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
            {cls.display_label}
          </span>
          <span className="text-[10px] text-[#9CA0AE] mt-0.5 whitespace-nowrap">
            {cls.sub_label}
          </span>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-1.5 ml-4 items-center">
          <span className="whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAFAFD] text-[#3A3A4A] border border-[#E6E6EC]">
            {liveTotalStudents} students
          </span>
          <span className="whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E4F6ED] text-[#0A8C5A]">
            {liveTotalPresent} present
          </span>
          {liveTotalAbsent > 0 && (
            <span className="whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FCE8EE] text-[#C2264E]">
              {liveTotalAbsent} absent
            </span>
          )}
          {liveTotalLate > 0 && (
            <span className="whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FDF1DC] text-[#B4721B]">
              {liveTotalLate} late
            </span>
          )}
          <span className="whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F1F1F5] text-[#6B6B7B]">
            {cls.sections.length} sections
          </span>
        </div>

        {/* Right group */}
        <div className="ml-auto flex items-center gap-2.5 flex-shrink-0">
          <AttendanceRing pct={pct} />
          <div className="flex flex-col">
            <span className={`text-[11px] font-bold ${pctTextColor(pct)}`}>{pct}%</span>
            <span className="text-[10px] text-[#9CA0AE]">today</span>
          </div>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SYNC_COLORS[cls.sync_status]}`} />
        </div>
      </div>

      {/* Body */}
      {isOpen && activeSection && (
        <div className="border-t border-[#F0F0F6]">
          {cls.sections.length > 1 && (
            <SectionTabs
              sections={cls.sections}
              activeSection={activeSection.id}
              onChange={(id) => onSectionChange(cls.id, id)}
            />
          )}
          <SectionPanel
            section={liveSection ?? activeSection!}
            classId={cls.id}
            date=""
            students={sectionStudents}
            loadingStudents={isLoadingSectionStudents}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onToggleAbsent={(s) => onToggleAbsent(cls.id, activeSection.id, s)}
            onToggleLunch={(s) => onToggleLunch(cls.id, activeSection.id, s)}
            onSignIn={(s) => onSignIn(cls.id, activeSection.id, s)}
            onSignOut={(s) => onSignOut(cls.id, activeSection.id, s)}
            onViewNotes={() => {}}
            onEditStatusPrompt={() => {}}
            onEditNote={() => {}}
            onDeleteNote={() => {}}
            onBulkMark={(status) => onBulkMark(cls.id, activeSection.id, status)}
            onBulkSignIn={() => onBulkSignIn(cls.id, activeSection.id)}
            onClearSelection={() => onSelectionChange(sectionKey, new Set())}
            onSave={() => onSave(cls.id, activeSection.id)}
            onReset={() => onReset(cls.id, activeSection.id)}
            onMarkAllPresent={() => onBulkMark(cls.id, activeSection.id, 'present')}
            onSignOutAll={() => {}}
          />
        </div>
      )}
    </div>
  );
}
