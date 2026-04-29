'use client';
import React, { useState } from 'react';
import type { Student, SectionSummary } from '../types';
import SectionSummaryBar from './SectionSummaryBar';
import BulkActionBar from './BulkActionBar';
import AttendanceTable from './AttendanceTable';

interface Props {
  section: SectionSummary;
  classId: number;
  date: string;
  students: Student[];
  loadingStudents: boolean;
  readOnly?: boolean;
  showLiveStatus?: boolean;
  selectedIds: Set<number>;
  onSelect: (id: number, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onToggleAbsent: (student: Student) => void;
  onToggleLunch: (student: Student) => void;
  onSignIn: (student: Student) => void;
  onSignOut: (student: Student) => void;
  onViewNotes: (student: Student) => void;
  onEditStatusPrompt: (student: Student) => void;
  onEditNote: (student: Student) => void;
  onDeleteNote: (student: Student) => void;
  onBulkMark: (status: 'present' | 'absent' | 'late') => void;
  onBulkSignIn: () => void;
  onClearSelection: () => void;
  onSave: () => void;
  onReset: () => void;
  onMarkAllPresent: () => void;
  onSignOutAll: () => void;
  isDirty?: boolean;
  isSaving?: boolean;
}

export default function SectionPanel({
  section,
  students,
  loadingStudents,
  readOnly,
  showLiveStatus = true,
  selectedIds,
  onSelect,
  onSelectAll,
  onToggleAbsent,
  onToggleLunch,
  onSignIn,
  onSignOut,
  onViewNotes,
  onEditStatusPrompt,
  onEditNote,
  onDeleteNote,
  onBulkMark,
  onBulkSignIn,
  onClearSelection,
  onSave,
  onReset,
  onMarkAllPresent,
  onSignOutAll,
  isDirty = false,
  isSaving = false,
}: Props) {
  const signedInCount = students.filter((s) => s.sign_in_time && !s.sign_out_time).length;
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  return (
    <div>
      <SectionSummaryBar section={section} />

      {selectedIds.size > 0 && !readOnly && (
        <BulkActionBar
          count={selectedIds.size}
          onClear={onClearSelection}
          onMarkAll={onBulkMark}
          onSignInAll={onBulkSignIn}
        />
      )}

      <AttendanceTable
        students={students}
        loading={loadingStudents}
        readOnly={readOnly}
        showLiveStatus={showLiveStatus}
        selectedIds={selectedIds}
        onSelect={onSelect}
        onSelectAll={onSelectAll}
        onToggleAbsent={onToggleAbsent}
        onToggleLunch={onToggleLunch}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        onViewNotes={onViewNotes}
        onEditStatusPrompt={onEditStatusPrompt}
        onEditNote={onEditNote}
        onDeleteNote={onDeleteNote}
      />

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-[#F1F1F5] bg-[#FAFAFD] flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2.5 flex-wrap items-center">
          <div className="flex items-center gap-1 text-[11px] font-medium text-[#3A3A4A]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0A8C5A] flex-shrink-0" />
            {section.present_count} present
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-[#3A3A4A]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C2264E] flex-shrink-0" />
            {section.absent_count} absent
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-[#3A3A4A]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B4721B] flex-shrink-0" />
            {section.late_count} late
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {readOnly ? (
            <span className="flex items-center gap-1.5 text-[11px] text-[#9CA0AE] italic">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Read-only
            </span>
          ) : (
          <>
          <button
            onClick={onMarkAllPresent}
            className="bg-[#E4F6ED] text-[#0A8C5A] h-8 px-3 text-[11px] font-semibold rounded-lg border border-[#0A8C5A]/20 cursor-pointer hover:bg-[#c8edd8] transition-colors"
          >
            ✓ All Present
          </button>
          {signedInCount > 0 && (
            <button
              onClick={onSignOutAll}
              className="bg-[#F4F4F8] text-[#3A3A4A] h-8 px-3 text-[11px] font-semibold rounded-lg border border-[#E6E6EC] cursor-pointer hover:bg-[#E6E6EC] transition-colors"
            >
              Sign Out All ({signedInCount})
            </button>
          )}
          <span className="flex items-center gap-1 text-[11px] text-[#9CA0AE]">
            <span className="w-1.5 h-1.5 bg-[#0A8C5A] rounded-full animate-pulse inline-block" />
            Auto-saving
          </span>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="bg-white border border-[#E6E6EC] h-8 px-3 text-[11px] font-semibold text-[#3A3A4A] rounded-lg cursor-pointer hover:bg-[#F4F4F8] transition-colors"
          >
            Reset
          </button>
          <button
            onClick={onSave}
            disabled={!isDirty || isSaving}
            className="bg-[#4729F4] text-white h-8 px-4 text-[11px] font-semibold rounded-lg border-none cursor-pointer hover:bg-[#3a21d4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Attendance
          </button>
          </>
          )}
        </div>
      </div>

      {/* Reset confirmation dialog */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-[360px] max-w-[90vw] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#F0F0F6]">
              <h3 className="text-[14px] font-semibold text-[#0B0B14] m-0">Reset Attendance?</h3>
              <p className="text-[12px] text-[#6B6B7B] mt-1 m-0">
                This will discard all unsaved changes for this section and reload from the server.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-[#FAFAFD]">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="h-8 px-3 text-[11px] font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg cursor-pointer hover:bg-[#F4F4F8] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowResetConfirm(false); onReset(); }}
                className="h-8 px-4 text-[11px] font-semibold text-white bg-[#C2264E] rounded-lg border-none cursor-pointer hover:bg-[#a81e40] transition-colors"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

