'use client';
import React from 'react';
import type { Student } from '../types';
import AttendanceTableRow from './AttendanceTableRow';

interface Props {
  students: Student[];
  loading?: boolean;
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
}

// Parse "HH:MM" to total minutes
function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export default function AttendanceTable({
  students,
  loading,
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
}: Props) {
  const allSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id));

  // Compute late-by-average: students whose arrival is 15+ min after class average
  const arrivals = students
    .filter((s) => s.arrival_time && /^\d{1,2}:\d{2}$/.test(s.arrival_time))
    .map((s) => ({ id: s.id, mins: timeToMins(s.arrival_time!) }));
  const avgMins = arrivals.length > 0
    ? arrivals.reduce((sum, a) => sum + a.mins, 0) / arrivals.length
    : null;
  const lateByAverageIds = new Set<number>(
    avgMins !== null ? arrivals.filter((a) => a.mins - avgMins > 15).map((a) => a.id) : []
  );

  return (
    <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
      <table className="w-full border-collapse" style={{ minWidth: 960 }}>
        <thead className="sticky top-0 z-10 bg-[#FAFAFD] border-b-[1.5px] border-[#EDEDF5]">
          <tr>
            <th className="px-3 py-2.5 text-left w-9">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={readOnly}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#4729F4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              />
            </th>
            <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap min-w-[180px]">
              Pupil
            </th>
            <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap w-[70px]">
              Roll No
            </th>
            <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap w-[80px]">
              Absent
            </th>
            <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap min-w-[140px]">
              Arrival
            </th>
            <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap min-w-[120px]">
              Sign In
            </th>
            <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap min-w-[110px]">
              Sign Out
            </th>
            <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap min-w-[90px]">
              Pick-up
            </th>
            <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap w-[70px]">
              Lunch
            </th>
            <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap w-[60px]">
              Notes
            </th>
            <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap w-[100px]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={11} className="px-3 py-8 text-center text-[12px] text-[#9CA0AE]">
                Loading students…
              </td>
            </tr>
          ) : students.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-3 py-8 text-center text-[12px] text-[#9CA0AE]">
                No students found
              </td>
            </tr>
          ) : (
            students.map((student) => (
              <AttendanceTableRow
                key={student.id}
                student={student}
                isSelected={selectedIds.has(student.id)}
                isLateByAverage={lateByAverageIds.has(student.id)}
                readOnly={readOnly}
                showLiveStatus={showLiveStatus}
                onSelect={onSelect}
                onToggleAbsent={onToggleAbsent}
                onToggleLunch={onToggleLunch}
                onSignIn={onSignIn}
                onSignOut={onSignOut}
                onViewNotes={onViewNotes}
                onEditStatusPrompt={onEditStatusPrompt}
                onEditNote={onEditNote}
                onDeleteNote={onDeleteNote}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
