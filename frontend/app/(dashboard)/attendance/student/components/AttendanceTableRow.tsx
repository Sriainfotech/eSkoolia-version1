'use client';
import React from 'react';
import type { Student, AttendanceStatus } from '../types';

interface Props {
  student: Student;
  isSelected: boolean;
  isLateByAverage?: boolean;
  readOnly?: boolean;
  showLiveStatus?: boolean;
  onSelect: (id: number, checked: boolean) => void;
  onToggleAbsent: (student: Student) => void;
  onToggleLunch: (student: Student) => void;
  onSignIn: (student: Student) => void;
  onSignOut: (student: Student) => void;
  onViewNotes: (student: Student) => void;
  onEditStatusPrompt: (student: Student) => void;
  onEditNote: (student: Student) => void;
  onDeleteNote: (student: Student) => void;
}

export default function AttendanceTableRow({
  student,
  isSelected,
  isLateByAverage = false,
  readOnly = false,
  showLiveStatus = true,
  onSelect,
  onToggleAbsent,
  onToggleLunch,
  onSignIn,
  onSignOut,
  onViewNotes,
  onEditStatusPrompt,
  onEditNote,
  onDeleteNote,
}: Props) {
  const isAbsent = student.status === 'absent';
  const hasActiveSignIn = Boolean(student.sign_in_time && !student.sign_out_time && !isAbsent);
  const absentToggleLocked = Boolean(student.sign_in_time && !student.sign_out_time);
  const canSignIn = !readOnly && !isAbsent && !student.sign_in_time;
  const canToggleLunch = !readOnly && hasActiveSignIn && (student.status === 'present' || student.status === 'late');
  const statusDotClass = showLiveStatus && hasActiveSignIn ? 'bg-[#0A8C5A]' : 'bg-[#9CA0AE]';
  const showLateStatus = showLiveStatus && student.status !== 'absent' && (student.status === 'late' || student.is_late);

  return (
    <tr
      className={`group border-b border-[#F4F4F8] transition-colors hover:bg-[#FAFAFD] ${
        isSelected
          ? 'bg-[#F4F2FF] border-l-[3px] border-l-[#4729F4]'
          : showLateStatus
          ? 'bg-[#FFF5F7] border-l-[3px] border-l-[#C2264E]'
          : 'border-l-[3px] border-l-transparent'
      }`}
    >
      {/* Checkbox */}
      <td className="px-3 py-2.5 whitespace-nowrap w-9">
        <input
          type="checkbox"
          checked={isSelected}
          disabled={readOnly}
          onChange={(e) => onSelect(student.id, e.target.checked)}
          className="w-3.5 h-3.5 accent-[#4729F4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        />
      </td>

      {/* Pupil */}
      <td className="px-3 py-2.5 whitespace-nowrap min-w-[180px] max-w-[220px]">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-shrink-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: student.avatar_color }}
            >
              <span className="text-[10px] font-bold text-white">{student.initials}</span>
            </div>
            <span
              className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-white ${statusDotClass}`}
            />
          </div>
          <div className="min-w-0 flex flex-col">
            <span className="text-[12px] font-semibold text-[#0B0B14] truncate max-w-[140px]">
              {student.full_name}
            </span>
            <div className="text-[10px] text-[#9CA0AE] flex items-center gap-1 flex-wrap">
              <span className="flex-shrink-0">{student.group}</span>
              {student.synced_from_app && (
                <span className="text-[9px] font-bold text-[#4729F4] bg-[#EEEBFF] px-1.5 py-px rounded whitespace-nowrap flex-shrink-0">
                  App
                </span>
              )}
              {student.rte_pct !== null && student.rte_pct < 75 && (
                <span className="text-[9px] font-bold text-[#C2264E] bg-[#FCE8EE] px-1.5 py-px rounded whitespace-nowrap flex-shrink-0">
                  RTE
                </span>
              )}
              {student.absent_reason && (
                <span className="text-[9px] font-bold text-[#B4721B] bg-[#FDF1DC] px-1.5 py-px rounded whitespace-nowrap flex-shrink-0 truncate max-w-[80px]">
                  {student.absent_reason}
                </span>
              )}
                {showLateStatus && (
                  <span className="text-[9px] font-bold text-[#B4721B] bg-[#FDF1DC] px-1.5 py-px rounded whitespace-nowrap flex-shrink-0 flex items-center gap-0.5">
                    <svg className="w-2 h-2 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <circle cx={12} cy={12} r={10} />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    Late Comer
                  </span>
                )}
            </div>
          </div>
        </div>
      </td>

      {/* Absent toggle */}
      <td className="px-3 py-2.5 whitespace-nowrap w-[80px] text-center">
        <button
          onClick={() => onToggleAbsent(student)}
          disabled={readOnly || absentToggleLocked}
          className="relative w-8 h-[18px] rounded-full border-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed enabled:cursor-pointer"
          style={{ backgroundColor: isAbsent ? '#C2264E' : '#E6E6EC' }}
          aria-label={isAbsent ? 'Mark present' : 'Mark absent'}
        >
          <span
            className="absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full transition-transform duration-200"
            style={{ left: isAbsent ? '18px' : '2px' }}
          />
        </button>
      </td>

      {/* Arrival */}
      <td className="px-3 py-2.5 whitespace-nowrap min-w-[140px]">
        {!showLiveStatus ? (
          <span className="text-[#3A3A4A] text-[12px]">{student.arrival_time || '—'}</span>
        ) : student.arrival_time ? (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
              student.is_late
                ? 'bg-[#FDF1DC] text-[#B4721B] border border-[#B4721B]/30'
                : 'bg-[#F4F4F8] text-[#3A3A4A]'
            }`}
          >
            {student.arrival_time}
            {student.is_late && (
              <span className="text-[9px]">+{student.late_minutes}m</span>
            )}
          </span>
        ) : (
          <span className="text-[#9CA0AE] text-[12px]">—</span>
        )}
      </td>

      {/* Sign In */}
      <td className="px-3 py-2.5 whitespace-nowrap min-w-[120px]">
        {!showLiveStatus ? (
          <span className="text-[#3A3A4A] text-[12px]">{student.sign_in_time || '—'}</span>
        ) : student.sign_in_time ? (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
              hasActiveSignIn
                ? 'bg-[#E4F6ED] text-[#0A8C5A]'
                : 'bg-[#F4F4F8] text-[#3A3A4A]'
            }`}
          >
            {student.sign_in_time}
          </span>
        ) : readOnly ? (
          <span className="text-[#9CA0AE] text-[12px]">—</span>
        ) : (
          <button
            onClick={() => onSignIn(student)}
            disabled={!canSignIn}
            className="bg-[#4729F4] text-white h-[28px] px-3 rounded-lg text-[11px] font-bold border-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed enabled:cursor-pointer enabled:hover:bg-[#3a21d4]"
          >
            Sign in
          </button>
        )}
      </td>

      {/* Sign Out */}
      <td className="px-3 py-2.5 whitespace-nowrap min-w-[110px]">
        {!showLiveStatus ? (
          <span className="text-[#3A3A4A] text-[12px]">{student.sign_out_time || '—'}</span>
        ) : student.sign_out_time ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F4F4F8] text-[#3A3A4A] text-[11px] font-semibold">
            {student.sign_out_time}
          </span>
        ) : student.sign_in_time && !readOnly ? (
          <button
            onClick={() => onSignOut(student)}
            className="bg-[#F4F4F8] text-[#3A3A4A] h-[28px] px-3 rounded-lg text-[11px] font-bold border border-[#E6E6EC] cursor-pointer hover:bg-[#E6E6EC] transition-colors"
          >
            Sign out
          </button>
        ) : (
          <span className="text-[#9CA0AE] text-[12px]">—</span>
        )}
      </td>

      {/* Pick-up */}
      <td className="px-3 py-2.5 whitespace-nowrap min-w-[90px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] text-[#3A3A4A]">
            {student.pickup_time ?? <span className="text-[#9CA0AE]">—</span>}
          </span>
          {student.pickup_by ? (
            <span className="text-[10px] text-[#6B6B7B] truncate max-w-[120px]" title={student.pickup_by}>
              {student.pickup_by}
            </span>
          ) : null}
        </div>
      </td>

      {/* Lunch toggle */}
      <td className="px-3 py-2.5 whitespace-nowrap w-[70px] text-center">
        <button
          onClick={() => onToggleLunch(student)}
          disabled={!canToggleLunch}
          className="relative w-8 h-[18px] rounded-full border-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed enabled:cursor-pointer"
          style={{ backgroundColor: student.lunch ? '#4729F4' : '#E6E6EC' }}
          aria-label={student.lunch ? 'Remove lunch' : 'Add lunch'}
        >
          <span
            className="absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full transition-transform duration-200"
            style={{ left: student.lunch ? '18px' : '2px' }}
          />
        </button>
      </td>

      {/* Notes count */}
      <td className="px-3 py-2.5 whitespace-nowrap w-[60px] text-center">
        {student.notes_count > 0 ? (
          <span className="inline-flex items-center justify-center bg-[#4729F4] text-white text-[9px] font-bold w-5 h-5 rounded-full">
            {student.notes_count}
          </span>
        ) : (
          <span className="text-[#9CA0AE] text-[12px]">—</span>
        )}
      </td>

      {/* Actions: view notes, add/edit note, delete note */}
      <td className="px-3 py-2.5 whitespace-nowrap w-[100px]">
        <div className="flex items-center gap-1">
          {!readOnly && (student.status === 'absent' || student.status === 'late') && (
            <button
              onClick={() => onEditStatusPrompt(student)}
              title={student.status === 'absent' ? 'Update absent reason' : 'Update late prompt'}
              className={`w-6 h-6 rounded-md border-none cursor-pointer flex items-center justify-center transition-colors ${
                student.status === 'absent'
                  ? 'bg-[#FCE8EE] text-[#C2264E] hover:bg-[#f8d9e3]'
                  : 'bg-[#FDF1DC] text-[#B4721B] hover:bg-[#f5e3c0]'
              }`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </button>
          )}
          {/* View notes */}
          {student.notes_count > 0 && (
            <button
              onClick={() => onViewNotes(student)}
              title="View notes"
              className="w-6 h-6 rounded-md border-none cursor-pointer bg-[#E6E6EC] text-[#6B6B7B] flex items-center justify-center hover:bg-[#EEEBFF] hover:text-[#4729F4] transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx={12} cy={12} r={3} />
              </svg>
            </button>
          )}
          {/* Add / edit note */}
          {!readOnly && (
          <button
            onClick={() => onEditNote(student)}
            title="Add / edit note"
            className="w-6 h-6 rounded-md border-none cursor-pointer bg-[#E6E6EC] text-[#6B6B7B] flex items-center justify-center hover:bg-[#EEEBFF] hover:text-[#4729F4] transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          )}
          {/* Delete last note */}
          {student.notes_count > 0 && !readOnly && (
            <button
              onClick={() => onDeleteNote(student)}
              title="Delete note"
              className="w-6 h-6 rounded-md border-none cursor-pointer bg-[#E6E6EC] text-[#6B6B7B] flex items-center justify-center hover:bg-[#FCE8EE] hover:text-[#C2264E] transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
