'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  onViewNotes: (classId: number, sectionId: number, student: Student) => void;
  onEditStatusPrompt: (classId: number, sectionId: number, student: Student) => void;
  onEditNote: (classId: number, sectionId: number, student: Student) => void;
  onDeleteNote: (classId: number, sectionId: number, student: Student) => void;
  onSignOutAll: (classId: number, sectionId: number) => void;
  onBulkMark: (classId: number, sectionId: number, status: 'present' | 'absent' | 'late') => void;
  onBulkSignIn: (classId: number, sectionId: number) => void;
  onSave: (classId: number, sectionId: number) => void;
  onReset: (classId: number, sectionId: number) => void;
  onMarkAllClassPresent?: (classId: number) => void;
  onMarkSectionAllPresent?: (classId: number, sectionId: number) => void;
  readOnly?: boolean;
  showLiveStatus?: boolean;
  isCurrentDate?: boolean;
  classActionPending?: boolean;
  dirtySections?: Record<string, boolean>;
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
  onViewNotes,
  onEditStatusPrompt,
  onEditNote,
  onDeleteNote,
  onSignOutAll,
  onBulkMark,
  onBulkSignIn,
  onSave,
  onReset,
  onMarkAllClassPresent,
  onMarkSectionAllPresent,
  readOnly,
  showLiveStatus,
  isCurrentDate = false,
  classActionPending,
  dirtySections,
}: Props) {
  const activeSection: SectionSummary | undefined =
    cls.sections.find((s) => s.id === activeSectionId) ?? cls.sections[0];

  const sectionKey = `${cls.id}-${activeSection?.id}`;
  const sectionStudents = useMemo(() => students[sectionKey] ?? [], [students, sectionKey]);
  const isLoadingSectionStudents = loadingStudents[sectionKey] ?? false;
  const selectedIds = useMemo(() => selectedRows[sectionKey] ?? new Set<number>(), [selectedRows, sectionKey]);
  const isDirty = Boolean(dirtySections?.[sectionKey]);

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
  // For sections not yet loaded, use the API-reported student_count so total is always accurate
  const liveTotalStudents = cls.sections.reduce((sum, sec) => {
    const loaded = students[`${cls.id}-${sec.id}`];
    return sum + (loaded !== undefined ? loaded.length : (sec.student_count ?? 0));
  }, 0) || cls.total_students;
  const liveTotalPresent = allSectionStudents.filter((s) => s.status === 'present').length;
  const liveTotalAbsent = allSectionStudents.filter((s) => s.status === 'absent').length;
  const liveTotalLate = allSectionStudents.filter((s) => s.status === 'late').length;
  const livePct = liveTotalStudents > 0 ? Math.round((liveTotalPresent / liveTotalStudents) * 100) : cls.overall_pct;
  const hasLoadedAnySection = cls.sections.some((sec) => students[`${cls.id}-${sec.id}`] !== undefined);

  // "In Progress" = some students loaded, some marked, some still unmarked
  const liveTotalMarked = allSectionStudents.filter((s) => s.status !== 'unmarked').length;
  const effectiveUnmarked = Math.max(liveTotalStudents - liveTotalMarked, 0);
  const summaryMarkedCount = (cls.total_present ?? 0) + (cls.total_absent ?? 0) + (cls.total_late ?? 0);
  const summaryUnmarkedCount = Math.max((cls.total_students ?? 0) - summaryMarkedCount, 0);
  const localHour = new Date().getHours();
  const showPostSixOverdue = isCurrentDate && localHour >= 18 && summaryUnmarkedCount > 0;
  const isInProgress = isCurrentDate && (Boolean(classActionPending) || (hasLoadedAnySection && liveTotalMarked > 0 && effectiveUnmarked > 0));
  const showAttendanceNeeded =
    Boolean(showLiveStatus) &&
    !isInProgress &&
    liveTotalStudents > 0 &&
    (!hasLoadedAnySection || liveTotalMarked === 0) &&
    !classActionPending;

  const handleSelect = useCallback((id: number, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id); else next.delete(id);
    onSelectionChange(sectionKey, next);
  }, [selectedIds, sectionKey, onSelectionChange]);

  const handleSelectAll = useCallback((checked: boolean) => {
    onSelectionChange(sectionKey, checked ? new Set(sectionStudents.map((s) => s.id)) : new Set());
  }, [sectionStudents, sectionKey, onSelectionChange]);

  const pct = livePct;
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const prevIsOpenRef = useRef(isOpen);

  // Scroll so the card header is visible (below the fixed 64px topbar + 12px gap)
  const scrollToCard = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (!cardRef.current) return;
    const top = cardRef.current.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: Math.max(0, top), behavior });
  }, []);

  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (!wasOpen && isOpen) {
      // Opening: wait one frame for the body to render then scroll to top of card
      const id = requestAnimationFrame(() => scrollToCard('smooth'));
      return () => cancelAnimationFrame(id);
    } else if (wasOpen && !isOpen) {
      // Closing / saving: bring the card header back into view
      scrollToCard('smooth');
    }
  }, [isOpen, scrollToCard]);

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-xl border overflow-hidden transition-all ${
        showPostSixOverdue ? 'border-[#C2264E]' : 'border-[#E6E6EC]'
      } ${
        isOpen ? (showPostSixOverdue ? 'border-l-4 border-l-[#C2264E]' : 'border-l-4 border-l-[#4729F4]') : ''
      }`}
    >
      {/* Header */}
      <div
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none transition-colors ${
          isOpen
            ? (showPostSixOverdue ? 'bg-[#FFF1F4]' : 'bg-[#F8F6FF]')
            : (showPostSixOverdue ? 'hover:bg-[#FFF6F8]' : 'hover:bg-[#FAFAFD]')
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
          {isInProgress && (
            <span className="whitespace-nowrap flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FCE8EE] text-[#C2264E] border border-[#C2264E]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C2264E] animate-pulse inline-block flex-shrink-0" />
              In Progress
            </span>
          )}
            {showAttendanceNeeded && (
              <span className="whitespace-nowrap flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF4E0] text-[#B4721B] border border-[#B4721B]/25">
                <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <circle cx={12} cy={12} r={10} />
                  <path d="M12 8v4m0 4h.01" />
                </svg>
                Attendance Needed
              </span>
            )}
            <span className="whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F1F1F5] text-[#6B6B7B]">
            {cls.sections.length} sections
          </span>
        </div>

        {/* Right group */}
        <div className="ml-auto flex items-center gap-2.5 flex-shrink-0">
          {hovered && !isOpen && !readOnly && showLiveStatus && onMarkAllClassPresent && liveTotalAbsent === 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkAllClassPresent(cls.id); }}
              className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition"
              title="Mark all students in this class as Present"
            >
              ✓ All Present
            </button>
          )}
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
              students={students}
              classId={cls.id}
            />
          )}
          <SectionPanel
            section={liveSection ?? activeSection!}
            classId={cls.id}
            date=""
            students={sectionStudents}
            loadingStudents={isLoadingSectionStudents}
            readOnly={readOnly}
            showLiveStatus={showLiveStatus}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onToggleAbsent={(s) => onToggleAbsent(cls.id, activeSection.id, s)}
            onToggleLunch={(s) => onToggleLunch(cls.id, activeSection.id, s)}
            onSignIn={(s) => onSignIn(cls.id, activeSection.id, s)}
            onSignOut={(s) => onSignOut(cls.id, activeSection.id, s)}
            onViewNotes={(s) => onViewNotes(cls.id, activeSection.id, s)}
            onEditStatusPrompt={(s) => onEditStatusPrompt(cls.id, activeSection.id, s)}
            onEditNote={(s) => onEditNote(cls.id, activeSection.id, s)}
            onDeleteNote={(s) => onDeleteNote(cls.id, activeSection.id, s)}
            onSignOutAll={() => onSignOutAll(cls.id, activeSection.id)}
            onBulkMark={(status) => onBulkMark(cls.id, activeSection.id, status)}
            onBulkSignIn={() => onBulkSignIn(cls.id, activeSection.id)}
            onClearSelection={() => onSelectionChange(sectionKey, new Set())}
            onSave={() => onSave(cls.id, activeSection.id)}
            onReset={() => onReset(cls.id, activeSection.id)}
            onMarkAllPresent={() => onMarkSectionAllPresent?.(cls.id, activeSection.id)}
            isDirty={isDirty}
            isSaving={Boolean(classActionPending)}
          />
        </div>
      )}
    </div>
  );
}
