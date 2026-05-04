'use client';

import React, { useState } from 'react';
import type { ClassInfo, Student, SectionSummary, LevelFilter, AttendanceStatus } from '../types';
import SectionTabs from './SectionTabs';
import AttendanceTable from './AttendanceTable';
import BulkActionBar from './BulkActionBar';
import AttendanceRing from './AttendanceRing';

interface SectionInnerBarProps {
  present: number;
  absent: number;
  late: number;
  total: number;
  pct: number;
}
function SectionInnerBar({ present, absent, late, total, pct }: SectionInnerBarProps) {
  return (
    <div className="px-5 py-2 flex items-center gap-2 flex-wrap bg-[#F8F6FF] border-b border-[#EDEDF5]">
      <div className="flex items-center gap-3 mr-2">
        <span className="flex items-center gap-1 text-[11px] font-medium text-[#3A3A4A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0A8C5A] inline-block" />{present} present
        </span>
        <span className="flex items-center gap-1 text-[11px] font-medium text-[#3A3A4A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C2264E] inline-block" />{absent} absent
        </span>
        <span className="flex items-center gap-1 text-[11px] font-medium text-[#3A3A4A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#B4721B] inline-block" />{late} late
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-[70px] h-1.5 bg-[#EDEDF5] rounded-full overflow-hidden">
          <div className="h-full bg-[#4729F4] rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className="text-[10px] font-bold text-[#4729F4]">{pct}%</span>
      </div>
    </div>
  );
}

interface SectionFooterProps {
  present: number;
  absent: number;
  late: number;
  total: number;
  signedInCount: number;
  onMarkAllPresent: () => void;
  onSignOutAll: () => void;
  onReset: () => void;
  onSave: () => void;
}
function SectionFooter({ present, absent, late, total, signedInCount, onMarkAllPresent, onSignOutAll, onReset, onSave }: SectionFooterProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // Issue #4: disable "All Present" once every student has been marked.
  const allMarked = total > 0 && (present + absent + late) >= total;
  return (
    <>
      <div className="px-5 py-2.5 border-t border-[#F1F1F5] bg-[#FAFAFD] flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2.5 flex-wrap items-center">
          <span className="flex items-center gap-1 text-[11px] font-medium text-[#3A3A4A]"><span className="w-1.5 h-1.5 rounded-full bg-[#0A8C5A] inline-block" />{present} present</span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-[#3A3A4A]"><span className="w-1.5 h-1.5 rounded-full bg-[#C2264E] inline-block" />{absent} absent</span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-[#3A3A4A]"><span className="w-1.5 h-1.5 rounded-full bg-[#B4721B] inline-block" />{late} late</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onMarkAllPresent}
            disabled={allMarked}
            title={allMarked ? 'All students already marked' : 'Mark all unmarked students present'}
            className="bg-[#E4F6ED] text-[#0A8C5A] h-8 px-3 text-[11px] font-semibold rounded-lg border border-[#0A8C5A]/20 hover:bg-[#c8edd8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#E4F6ED]"
          >
            {allMarked ? '✓ All Marked' : '✓ All Present'}
          </button>
          {signedInCount > 0 && (
            <button onClick={onSignOutAll} className="bg-[#F4F4F8] text-[#3A3A4A] h-8 px-3 text-[11px] font-semibold rounded-lg border border-[#E6E6EC] hover:bg-[#E6E6EC] transition-colors">Sign Out All ({signedInCount})</button>
          )}
          <span className="flex items-center gap-1 text-[11px] text-[#9CA0AE]"><span className="w-1.5 h-1.5 bg-[#0A8C5A] rounded-full animate-pulse inline-block" />Auto-saving</span>
          <button onClick={() => setShowResetConfirm(true)} className="bg-white border border-[#E6E6EC] h-8 px-3 text-[11px] font-semibold text-[#3A3A4A] rounded-lg hover:bg-[#F4F4F8] transition-colors">Reset</button>
          <button onClick={onSave} className="bg-[#4729F4] text-white h-8 px-4 text-[11px] font-semibold rounded-lg hover:bg-[#3a21d4] transition-colors">Save Attendance</button>
        </div>
      </div>
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowResetConfirm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-[360px] max-w-[90vw] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#F0F0F6]">
              <h3 className="text-[14px] font-semibold text-[#0B0B14] m-0">Reset Attendance?</h3>
              <p className="text-[12px] text-[#6B6B7B] mt-1 m-0">This will discard all unsaved changes for this section and reload from the server.</p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-[#FAFAFD]">
              <button onClick={() => setShowResetConfirm(false)} className="h-8 px-3 text-[11px] font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg hover:bg-[#F4F4F8] transition-colors">Cancel</button>
              <button onClick={() => { setShowResetConfirm(false); onReset(); }} className="h-8 px-4 text-[11px] font-semibold text-white bg-[#C2264E] rounded-lg hover:bg-[#a81e40] transition-colors">Yes, Reset</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface SectionBodyProps {
  classId: number;
  sectionId: number;
  sectionSummary: SectionSummary;
  students: Student[];
  loading: boolean;
  searchQuery: string;
  statusFilter: string;
  selectedRows: Set<number>;
  onSelectionChange: (key: string, ids: Set<number>) => void;
  onToggleAbsent: (classId: number, sectionId: number, student: Student) => void;
  onEditStatusPrompt: (classId: number, sectionId: number, student: Student) => void;
  onToggleLunch: (classId: number, sectionId: number, student: Student) => void;
  onSignIn: (classId: number, sectionId: number, student: Student) => void;
  onSignOut: (classId: number, sectionId: number, student: Student) => void;
  onBulkMark: (classId: number, sectionId: number, status: AttendanceStatus) => void;
  onBulkSignIn: (classId: number, sectionId: number) => void;
  onSave: (classId: number, sectionId: number) => void;
  onReset: (classId: number, sectionId: number) => void;
  onOpenNote: (classId: number, sectionId: number, student: Student, mode?: 'add' | 'view') => void;
  readOnly?: boolean;
}

function nowTime(): string { return new Date().toTimeString().slice(0, 5); }

function SectionBody({ classId, sectionId, sectionSummary, students, loading, searchQuery, statusFilter, selectedRows, onSelectionChange, onToggleAbsent, onEditStatusPrompt, onToggleLunch, onSignIn, onSignOut, onBulkMark, onBulkSignIn, onSave, onReset, onOpenNote, readOnly = false }: SectionBodyProps) {
  const key = `${classId}-${sectionId}`;
  const q = searchQuery.trim().toLowerCase();
  const visible = students.filter((s) => {
    if (q && !s.full_name.toLowerCase().includes(q) && !String(s.roll_no ?? '').includes(q)) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });
  const allIds = visible.map((s) => s.id);
  const toggleAll = (checked: boolean) => { if (readOnly) return; onSelectionChange(key, checked ? new Set(allIds) : new Set()); };
  const toggleOne = (id: number, checked: boolean) => { if (readOnly) return; const next = new Set(selectedRows); if (checked) next.add(id); else next.delete(id); onSelectionChange(key, next); };
  const signedInCount = students.filter((s) => s.sign_in_time && !s.sign_out_time).length;
  const present = students.filter((s) => s.status === 'present').length;
  const absent = students.filter((s) => s.status === 'absent').length;
  const late = students.filter((s) => s.status === 'late').length;
  // Issue #5 + #6: only count students who actually arrived (sign-in present)
  // toward the attendance percentage; clamp to 0–100.
  const attendedPresent = students.filter((s) => s.status === 'present' && !!s.sign_in_time).length;
  const pct = students.length > 0
    ? Math.max(0, Math.min(100, Math.round(((attendedPresent + late) / students.length) * 100)))
    : 0;
  const handleSignOutAll = () => { if (readOnly) return; const t = nowTime(); students.filter((s) => s.sign_in_time && !s.sign_out_time).forEach((s) => onSignOut(classId, sectionId, { ...s, sign_out_time: t })); };
  if (loading) return <div className="p-4 space-y-2">{[0,1,2,3].map((i) => <div key={i} className="h-10 rounded-lg bg-[#F0F0F5] animate-pulse" style={{ opacity: 1 - i * 0.15 }} />)}</div>;
  if (students.length === 0) return <div className="py-8 text-center text-sm text-[#9B9BAD]">No students found for this section.</div>;
  return (
    <div>
      <SectionInnerBar present={present} absent={absent} late={late} total={students.length} pct={pct} />
      {!readOnly && selectedRows.size > 0 && <BulkActionBar count={selectedRows.size} onClear={() => onSelectionChange(key, new Set())} onMarkAll={(status) => onBulkMark(classId, sectionId, status)} onSignInAll={() => onBulkSignIn(classId, sectionId)} onSignOutAll={() => { const t = nowTime(); students.filter((s) => selectedRows.has(s.id) && s.sign_in_time && !s.sign_out_time).forEach((s) => onSignOut(classId, sectionId, { ...s, sign_out_time: t })); }} />}
      <AttendanceTable students={visible} loading={false} selectedIds={readOnly ? new Set<number>() : selectedRows} onSelect={readOnly ? () => {} : toggleOne} onSelectAll={readOnly ? () => {} : toggleAll} onToggleAbsent={readOnly ? () => {} : (s) => onToggleAbsent(classId, sectionId, s)} onToggleLunch={readOnly ? () => {} : (s) => onToggleLunch(classId, sectionId, s)} onSignIn={readOnly ? () => {} : (s) => onSignIn(classId, sectionId, s)} onSignOut={readOnly ? () => {} : (s) => onSignOut(classId, sectionId, s)} onViewNotes={(s) => onOpenNote(classId, sectionId, s, 'view')} onEditStatusPrompt={readOnly ? () => {} : (s) => onEditStatusPrompt(classId, sectionId, s)} onEditNote={(s) => onOpenNote(classId, sectionId, s, 'add')} onDeleteNote={(s) => onOpenNote(classId, sectionId, s, 'view')} />
      {readOnly ? (
        <div className="px-5 py-2.5 border-t border-[#F1F1F5] bg-[#FAFAFD] flex items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-medium text-[#3A3A4A]"><span className="w-1.5 h-1.5 rounded-full bg-[#0A8C5A] inline-block" />{present} present</span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-[#3A3A4A]"><span className="w-1.5 h-1.5 rounded-full bg-[#C2264E] inline-block" />{absent} absent</span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-[#3A3A4A]"><span className="w-1.5 h-1.5 rounded-full bg-[#B4721B] inline-block" />{late} late</span>
          <div className="flex-1" />
          <span className="text-[10px] text-[#9CA0AE] italic">Read-only</span>
        </div>
      ) : (
        <SectionFooter present={present} absent={absent} late={late} total={students.length} signedInCount={signedInCount} onMarkAllPresent={() => onBulkMark(classId, sectionId, 'present')} onSignOutAll={handleSignOutAll} onReset={() => onReset(classId, sectionId)} onSave={() => onSave(classId, sectionId)} />
      )}
    </div>
  );
}

interface ClassCardProps {
  cls: ClassInfo;
  isOpen: boolean;
  onToggle: (id: number) => void;
  activeSectionId: number | undefined;
  onSectionChange: (classId: number, sectionId: number) => void;
  students: Record<string, Student[]>;
  loadingStudents: Record<string, boolean>;
  selectedRows: Record<string, Set<number>>;
  searchQuery: string;
  statusFilter: string;
  sectionFilter: string;
  onSelectionChange: (key: string, ids: Set<number>) => void;
  onToggleAbsent: (classId: number, sectionId: number, student: Student) => void;
  onEditStatusPrompt: (classId: number, sectionId: number, student: Student) => void;
  onToggleLunch: (classId: number, sectionId: number, student: Student) => void;
  onSignIn: (classId: number, sectionId: number, student: Student) => void;
  onSignOut: (classId: number, sectionId: number, student: Student) => void;
  onBulkMark: (classId: number, sectionId: number, status: AttendanceStatus) => void;
  onBulkSignIn: (classId: number, sectionId: number) => void;
  onSave: (classId: number, sectionId: number) => void;
  onReset: (classId: number, sectionId: number) => void;
  onOpenNote: (classId: number, sectionId: number, student: Student, mode?: 'add' | 'view') => void;
  readOnly?: boolean;
  dateMode?: 'today' | 'past' | 'future';
  onMarkAllPresentForClass?: (classId: number) => void;
}

function ClassCard({ cls, isOpen, onToggle, activeSectionId, onSectionChange, students, loadingStudents, selectedRows, searchQuery, statusFilter, sectionFilter, onSelectionChange, onToggleAbsent, onEditStatusPrompt, onToggleLunch, onSignIn, onSignOut, onBulkMark, onBulkSignIn, onSave, onReset, onOpenNote, readOnly = false, dateMode, onMarkAllPresentForClass }: ClassCardProps) {
  const [showMarkAll, setShowMarkAll] = useState(false);
  const [markAllCooldown, setMarkAllCooldown] = useState(false);
  const filteredSections = sectionFilter === 'all' ? cls.sections : cls.sections.filter((sec) => { const name = (sec.name || '').trim().toUpperCase(); const target = sectionFilter.toUpperCase(); return name === target || name.endsWith(` ${target}`) || name.replace(/^SECTION\s+/i, '') === target; });
  const activeSec = activeSectionId ?? filteredSections[0]?.id;
  const sectionKey = activeSec !== undefined ? `${cls.id}-${activeSec}` : null;
  const sectionStudents = sectionKey ? (students[sectionKey] ?? []) : [];
  const isLoading = sectionKey ? (loadingStudents[sectionKey] ?? false) : false;
  const sectionSelected = sectionKey ? (selectedRows[sectionKey] ?? new Set<number>()) : new Set<number>();
  const activeSectionSummary = filteredSections.find((s) => s.id === activeSec) ?? filteredSections[0];

  // Issue #2 + #5 + #6: accordion-level counts must reflect the WHOLE class,
  // not just the currently-loaded section. Always start from the backend
  // class-summary numbers (cls.total_present etc.), then if all sections are
  // loaded locally we can overlay the live local counts for accuracy.
  const allSectionsLoaded = filteredSections.length > 0 && filteredSections.every((sec) => {
    const arr = students[`${cls.id}-${sec.id}`];
    return Array.isArray(arr) && arr.length > 0;
  });
  const allLoaded = filteredSections.flatMap((sec) => students[`${cls.id}-${sec.id}`] ?? []);

  // Count present students from the locally-loaded sections (used when all
  // sections are loaded for fully-accurate live counts).
  const localPresentMarked = allLoaded.filter((s) => s.status === 'present').length;
  const localAbsent = allLoaded.filter((s) => s.status === 'absent').length;
  const localLate = allLoaded.filter((s) => s.status === 'late').length;

  const totalPresent = allSectionsLoaded ? localPresentMarked : (cls.total_present ?? 0);
  const totalAbsent = allSectionsLoaded ? localAbsent : (cls.total_absent ?? 0);
  const totalLate = allSectionsLoaded ? localLate : (cls.total_late ?? 0);
  const totalForPct = cls.total_students;

  // Issue #9: percentage and status must derive from the SAME counts shown in
  // the badges, otherwise users see "3 present" alongside "0% / Attendance
  // Needed". Use totalPresent (the value rendered) as the numerator.
  const rawPct = totalForPct > 0
    ? Math.round(((totalPresent + totalLate) / totalForPct) * 100)
    : 0;
  // Issue #6: never display impossible values.
  const attendancePct = Math.max(0, Math.min(100, rawPct));

  // Attendance status badge logic — derive from the same numbers shown in the
  // badges so the UI is internally consistent.
  const totalLoaded = cls.total_students;
  const accountedFor = totalPresent + totalLate + totalAbsent;
  const attendanceStatus: 'needed' | 'in_progress' | 'complete' | 'none' =
    totalLoaded === 0 ? 'none' :
    accountedFor === 0 ? 'needed' :
    accountedFor < totalLoaded ? 'in_progress' : 'complete';

  const levelBorderColor = cls.level === 'primary' ? 'border-l-[#22C55E]' : cls.level === 'middle' ? 'border-l-[#4729F4]' : 'border-l-[#F59E0B]';
  return (
    <div className={`bg-white rounded-xl border overflow-hidden mb-2 transition-all ${isOpen ? `border-[#E0DBFD] shadow-sm border-l-4 ${levelBorderColor}` : 'border-[#E6E6EC]'}`}>
      <div
        onClick={() => onToggle(cls.id)}
        onMouseEnter={() => setShowMarkAll(true)}
        onMouseLeave={() => setShowMarkAll(false)}
        className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none transition-colors ${isOpen ? 'bg-[#F8F6FF]' : 'hover:bg-[#FAFAFD]'}`}
      >
        <svg className={`w-4 h-4 text-[#9CA0AE] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
        <div className="flex flex-col shrink-0">
          <span className="text-[13px] font-semibold text-[#0B0B14] whitespace-nowrap">{cls.display_label}</span>
          {cls.sub_label && <span className="text-[10px] text-[#9CA0AE] mt-0.5 whitespace-nowrap">{cls.sub_label}</span>}
        </div>
        <div className="flex flex-wrap gap-1.5 ml-2 items-center">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAFAFD] text-[#3A3A4A] border border-[#E6E6EC] whitespace-nowrap">{cls.total_students} {cls.total_students === 1 ? 'student' : 'students'}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E4F6ED] text-[#0A8C5A] whitespace-nowrap">{totalPresent} present</span>
          {totalAbsent > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FCE8EE] text-[#C2264E] whitespace-nowrap">{totalAbsent} absent</span>}
          {totalLate > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FDF1DC] text-[#B4721B] whitespace-nowrap">{totalLate} late</span>}
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F1F1F5] text-[#6B6B7B] whitespace-nowrap">{filteredSections.length} {filteredSections.length === 1 ? 'section' : 'sections'}</span>
          {dateMode !== 'future' && attendanceStatus === 'needed' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FCE8EE] text-[#C2264E] whitespace-nowrap">Attendance Needed</span>
          )}
          {dateMode !== 'future' && attendanceStatus === 'in_progress' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FDF1DC] text-[#B4721B] whitespace-nowrap">In Progress</span>
          )}
          {dateMode !== 'future' && attendanceStatus === 'complete' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E4F6ED] text-[#0A8C5A] whitespace-nowrap">✓ Complete</span>
          )}
        </div>
        <div className="flex-1" />
        {!isOpen && dateMode === 'today' && !readOnly && showMarkAll && onMarkAllPresentForClass && attendanceStatus !== 'complete' && (
          <button
            disabled={markAllCooldown}
            onClick={(e) => {
              e.stopPropagation();
              if (markAllCooldown) return;
              onMarkAllPresentForClass(cls.id);
              setMarkAllCooldown(true);
              setTimeout(() => setMarkAllCooldown(false), 1500);
            }}
            className="flex-shrink-0 h-7 px-3 text-[10px] font-bold bg-[#E4F6ED] text-[#0A8C5A] rounded-lg border border-[#0A8C5A]/20 hover:bg-[#c8edd8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✓ Mark All Present
          </button>
        )}
        <AttendanceRing pct={attendancePct} size={38} strokeWidth={3.5} />
        <div className="flex flex-col items-end shrink-0 ml-1">
          <span className={`text-[11px] font-bold leading-tight ${attendancePct === 0 ? 'text-[#EF4444]' : 'text-[#4729F4]'}`}>{attendancePct}%</span>
          <span className="text-[10px] text-[#9CA0AE] leading-tight">today</span>
        </div>
      </div>
      {isOpen && (
        <div className="border-t border-[#F0F0F6]">
          {filteredSections.length === 0 ? (
            <div className="py-6 text-center text-sm text-[#9B9BAD]">No sections configured.</div>
          ) : (
            <>
              {filteredSections.length > 1 && <SectionTabs sections={filteredSections} activeSection={activeSec ?? filteredSections[0].id} onChange={(id) => onSectionChange(cls.id, id)} students={students} classId={cls.id} />}
              {activeSec !== undefined && activeSectionSummary && (
                <SectionBody classId={cls.id} sectionId={activeSec} sectionSummary={activeSectionSummary} students={sectionStudents} loading={isLoading} searchQuery={searchQuery} statusFilter={statusFilter} selectedRows={sectionSelected} onSelectionChange={onSelectionChange} onToggleAbsent={onToggleAbsent} onEditStatusPrompt={onEditStatusPrompt} onToggleLunch={onToggleLunch} onSignIn={onSignIn} onSignOut={onSignOut} onBulkMark={onBulkMark} onBulkSignIn={onBulkSignIn} onSave={onSave} onReset={onReset} onOpenNote={onOpenNote} readOnly={readOnly} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export interface ClassAccordionGridProps {
  classes: ClassInfo[];
  levelFilter: LevelFilter;
  searchQuery: string;
  statusFilter: string;
  sectionFilter: string;
  openClasses: Set<number>;
  onToggleClass: (classId: number) => void;
  activeSections: Record<number, number>;
  onSectionChange: (classId: number, sectionId: number) => void;
  students: Record<string, Student[]>;
  loadingStudents: Record<string, boolean>;
  selectedRows: Record<string, Set<number>>;
  onSelectionChange: (key: string, ids: Set<number>) => void;
  onToggleAbsent: (classId: number, sectionId: number, student: Student) => void;
  onEditStatusPrompt: (classId: number, sectionId: number, student: Student) => void;
  onToggleLunch: (classId: number, sectionId: number, student: Student) => void;
  onSignIn: (classId: number, sectionId: number, student: Student) => void;
  onSignOut: (classId: number, sectionId: number, student: Student) => void;
  onBulkMark: (classId: number, sectionId: number, status: AttendanceStatus) => void;
  onBulkSignIn: (classId: number, sectionId: number) => void;
  onSave: (classId: number, sectionId: number) => void;
  onReset: (classId: number, sectionId: number) => void;
  onOpenNote: (classId: number, sectionId: number, student: Student, mode?: 'add' | 'view') => void;
  readOnly?: boolean;
  dateMode?: 'today' | 'past' | 'future';
  selectedDate?: string;
  onRequestUnlock?: () => void;
  isSundayLocked?: boolean;
  onMarkAllPresentForClass?: (classId: number) => void;
  isEditUnlocked?: boolean;
  onLogoutPastEdit?: () => void;
}

export default function ClassAccordionGrid({ classes, levelFilter, searchQuery, statusFilter, sectionFilter, openClasses, onToggleClass, activeSections, onSectionChange, students, loadingStudents, selectedRows, onSelectionChange, onToggleAbsent, onEditStatusPrompt, onToggleLunch, onSignIn, onSignOut, onBulkMark, onBulkSignIn, onSave, onReset, onOpenNote, readOnly = false, dateMode = 'today', selectedDate, onRequestUnlock, isSundayLocked = false, onMarkAllPresentForClass, isEditUnlocked = false, onLogoutPastEdit }: ClassAccordionGridProps) {
  const q = searchQuery.trim().toLowerCase();
  const visible = classes.filter((cls) => {
    if (levelFilter !== 'all' && cls.level !== levelFilter) return false;
    if (q) {
      if (cls.name.toLowerCase().includes(q) || cls.display_label.toLowerCase().includes(q)) return true;
      const all = cls.sections.flatMap((sec) => students[`${cls.id}-${sec.id}`] ?? []);
      return all.some((s) => s.full_name.toLowerCase().includes(q));
    }
    return true;
  });

  // Format the selected date nicely for banner display
  const formattedDate = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  if (visible.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-[#9B9BAD] text-sm">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="mb-3 opacity-30" aria-hidden="true"><circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" /><path d="M13 20h14M20 13v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      No classes match the current filters.
    </div>
  );
  return (
    <div>
      {/* Read-only banner for past/future dates */}
      {readOnly && dateMode === 'past' && (
        <div className="flex items-center justify-between gap-3 mb-3 px-4 py-3 rounded-xl border border-[#F4DCA7] bg-[#FFFBEB]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 flex-shrink-0 rounded-lg bg-[#FDF1DC] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-[#B4721B]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[#92400E] leading-tight">Viewing past date — {formattedDate}</p>
              <p className="text-[11px] text-[#B45309] leading-tight mt-0.5">This record is read-only. Login to edit past attendance.</p>
            </div>
          </div>
          {onRequestUnlock && (
            <button
              onClick={onRequestUnlock}
              className="flex-shrink-0 h-8 px-3.5 text-[11px] font-bold bg-[#FDF1DC] text-[#9A5C00] rounded-lg border border-[#F4DCA7] hover:bg-[#FDE8B8] transition-colors"
            >
              Login to Edit
            </button>
          )}
        </div>
      )}
      {!readOnly && dateMode === 'past' && isEditUnlocked && (
        <div className="flex items-center justify-between gap-3 mb-3 px-4 py-3 rounded-xl border border-[#FBCFE8] bg-[#FFF1F2]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 flex-shrink-0 rounded-lg bg-[#FCE7F3] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-[#BE185D]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M12 9v4m0 4h.01" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[#9D174D] leading-tight">Past-date edit mode is active</p>
              <p className="text-[11px] text-[#BE185D] leading-tight mt-0.5">Please log out after finishing changes for this past date.</p>
            </div>
          </div>
          {onLogoutPastEdit && (
            <button
              onClick={onLogoutPastEdit}
              className="flex-shrink-0 h-8 px-3.5 text-[11px] font-bold bg-[#FCE7F3] text-[#9D174D] rounded-lg border border-[#F9A8D4] hover:bg-[#FBCFE8] transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      )}
      {readOnly && dateMode === 'future' && (
        <div className="flex items-center gap-2.5 mb-3 px-4 py-3 rounded-xl border border-[#C5BEFF] bg-[#F5F3FF]">
          <span className="w-7 h-7 flex-shrink-0 rounded-lg bg-[#EDE9FE] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-[#7C3AED]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <circle cx={12} cy={12} r={10} />
              <path d="M12 6v6l4 2" />
            </svg>
          </span>
          <div>
            <p className="text-[12px] font-semibold text-[#4C1D95] leading-tight">Viewing future date — {formattedDate}</p>
            <p className="text-[11px] text-[#6D28D9] leading-tight mt-0.5">Attendance cannot be taken for future dates.</p>
          </div>
        </div>
      )}
      {isSundayLocked && (
        <div className="flex items-center justify-between gap-3 mb-3 px-4 py-3 rounded-xl border border-[#C5BEFF] bg-[#F5F3FF]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 flex-shrink-0 rounded-lg bg-[#EDE9FE] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-[#7C3AED]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[#4C1D95] leading-tight">Today is Sunday — attendance is read-only</p>
              <p className="text-[11px] text-[#6D28D9] leading-tight mt-0.5">Sunday attendance is locked by default. Login to edit if needed.</p>
            </div>
          </div>
          {onRequestUnlock && (
            <button
              onClick={onRequestUnlock}
              className="flex-shrink-0 h-8 px-3.5 text-[11px] font-bold bg-[#EDE9FE] text-[#5B21B6] rounded-lg border border-[#C5BEFF] hover:bg-[#DDD6FE] transition-colors"
            >
              Login to Edit
            </button>
          )}
        </div>
      )}
      {visible.map((cls) => (
        <ClassCard key={cls.id} cls={cls} isOpen={openClasses.has(cls.id)} onToggle={onToggleClass} activeSectionId={activeSections[cls.id]} onSectionChange={onSectionChange} students={students} loadingStudents={loadingStudents} selectedRows={selectedRows} searchQuery={searchQuery} statusFilter={statusFilter} sectionFilter={sectionFilter} onSelectionChange={onSelectionChange} onToggleAbsent={onToggleAbsent} onEditStatusPrompt={onEditStatusPrompt} onToggleLunch={onToggleLunch} onSignIn={onSignIn} onSignOut={onSignOut} onBulkMark={onBulkMark} onBulkSignIn={onBulkSignIn} onSave={onSave} onReset={onReset} onOpenNote={onOpenNote} readOnly={readOnly} dateMode={dateMode} onMarkAllPresentForClass={onMarkAllPresentForClass} />
      ))}
    </div>
  );
}