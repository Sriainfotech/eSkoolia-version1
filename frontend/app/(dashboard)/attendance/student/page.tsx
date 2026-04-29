'use client';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Student, StudentNote, LevelFilter, AttendanceStatus } from './types';
import { formatDate } from './utils/attendanceHelpers';
import { useClasses } from './hooks/useClasses';
import { useStudents } from './hooks/useStudents';
import { useAttendance } from './hooks/useAttendance';
import { TopToast } from '@/components/common/TopToast';

import AttendancePageHeader from './components/AttendancePageHeader';
import AttendanceAlert from './components/AttendanceAlert';
import AttendanceKPIs from './components/AttendanceKPIs';
import AttendanceFilterBar from './components/AttendanceFilterBar';
import GlobalControls from './components/GlobalControls';
import ClassAccordionGrid from './components/ClassAccordionGrid';
import MonthlyReport from './components/MonthlyReport';
import AbsentNoteDialog from './components/AbsentNoteDialog';
import LateCommerDialog from './components/LateCommerDialog';
import NotesModal from './components/NotesModal';
import ViewNotesModal from './components/ViewNotesModal';

import UnlockEditDialog from './components/UnlockEditDialog';
import StudentAttendanceImportDialog from './components/StudentAttendanceImportDialog';

const LATE_RATIO_THRESHOLD = 0.7;
const LATE_MINUTES_BUFFER = 20;

function toMinutes(time: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function currentTimeHHMM(): string {
  return new Date().toTimeString().slice(0, 5);
}

export default function StudentAttendancePage() {
  const router = useRouter();
  const [currentDay, setCurrentDay] = useState<string>(() => formatDate(new Date()));

  // -- Date & filters -------------------------------------------
  const [selectedDate, setSelectedDate] = useState<string>(() => formatDate(new Date()));
  const [academicYear, setAcademicYear] = useState('2025-26');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // -- Date mode ------------------------------------------------
  const dateMode: 'today' | 'past' | 'future' = useMemo(() => {
    if (selectedDate === currentDay) return 'today';
    if (selectedDate < currentDay) return 'past';
    return 'future';
  }, [selectedDate, currentDay]);

  // -- Past-date unlock state -----------------------------------
  const [isEditUnlocked, setIsEditUnlocked] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);

  // Sunday detection
  const selectedDayOfWeek = new Date(`${selectedDate}T00:00:00`).getDay();
  const isSundaySelected = selectedDayOfWeek === 0;

  // Read-only when viewing past (and not unlocked), future, or Sunday (and not unlocked)
  const isReadOnly =
    dateMode === 'future' ||
    (isSundaySelected && !isEditUnlocked) ||
    (dateMode === 'past' && !isEditUnlocked);

  // -- Accordion state ------------------------------------------
  const [openClasses, setOpenClasses] = useState<Set<number>>(new Set());
  const [activeSections, setActiveSections] = useState<Record<number, number>>({});
  const [selectedRows, setSelectedRows] = useState<Record<string, Set<number>>>({});
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [absentDialogState, setAbsentDialogState] = useState<{ classId: number; sectionId: number; student: Student; mode: 'mark' | 'edit' } | null>(null);
  const [lateDialogState, setLateDialogState] = useState<{ classId: number; sectionId: number; student: Student; signInTime: string; minutesLate: number } | null>(null);
  const [notesDialogState, setNotesDialogState] = useState<{ classId: number; sectionId: number; studentId: number; mode: 'add' | 'view' } | null>(null);

  // -- Data hooks -----------------------------------------------
  const { classes, loading: classesLoading } = useClasses(selectedDate);
  const { students, loading: studentsLoading, loadSection, updateStudent, clearStudents } = useStudents();
  const { kpis: backendKpis, exportAttendance, patchMark, saveBulk, downloadSampleTemplate } = useAttendance(selectedDate);
  const selectedDateRef = useRef(selectedDate);
  const studentsRef = useRef(students);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  const pushToast = useCallback((message: string, tone: 'success' | 'error') => {
    setToast({ message, tone });
  }, []);

  // KPIs come from the backend daily-summary endpoint (accurate across all sections/dates)
  // Fall back to local computation from loaded sections if backend data isn't ready yet
  const kpis = useMemo(() => {
    if (backendKpis) return backendKpis;
    if (classes.length === 0) return null;
    const dbTotal = classes.reduce((sum, c) => sum + c.total_students, 0);
    const allStudents = Object.values(students).flat();
    const present = allStudents.filter((s) => s.status === 'present').length;
    const absent = allStudents.filter((s) => s.status === 'absent').length;
    const late = allStudents.filter((s) => s.status === 'late').length;
    const lateStudent = allStudents.find((s) => s.status === 'late') ?? null;
    return {
      total_students: dbTotal,
      present_today: present,
      absent_today: absent,
      late_today: late,
      classes_marked: 0,
      total_classes: classes.length,
      present_pct: dbTotal > 0 ? Math.round((present / dbTotal) * 100) : 0,
      weekly_avg_pct: dbTotal > 0 ? Math.round((present / dbTotal) * 100) : 0,
      chronic_absentees: 0,
      rte_at_risk: 0,
      absent_with_reason: 0,
      late_student_name: lateStudent?.full_name ?? null,
      late_minutes: lateStudent?.late_minutes ?? null,
      delta_pct: 0,
    };
  }, [backendKpis, students, classes]);

  // Open the first class (with sections) by default when classes load
  useEffect(() => {
    if (classes.length > 0) {
      setOpenClasses((prev) => {
        if (prev.size === 0) {
          const firstWithSections = classes.find((c) => c.sections.length > 0);
          const target = firstWithSections ?? classes[0];
          return new Set([target.id]);
        }
        return prev;
      });
    }
  }, [classes]);

  // Load students when a section becomes visible
  useEffect(() => {
    openClasses.forEach((classId) => {
      const cls = classes.find((c) => c.id === classId);
      if (!cls) return;
      const sectionId = activeSections[classId] ?? cls.sections[0]?.id;
      if (!sectionId) return;
      // Always reload for the currently selected date so stale cached rows
      // from another date are not reused.
      loadSection(classId, sectionId, selectedDate);
    });
  }, [openClasses, activeSections, classes, selectedDate, loadSection]);

  // ΓöÇΓöÇ Handlers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const handleToggleClass = useCallback((classId: number) => {
    const isCurrentlyOpen = openClasses.has(classId);
    if (isCurrentlyOpen && !isReadOnly) {
      const cls = classes.find((c) => c.id === classId);
      if (cls) {
        cls.sections.forEach((sec) => {
          const key = `${classId}-${sec.id}`;
          const sectionStudents = students[key];
          if (sectionStudents && sectionStudents.length > 0) {
            const marks = sectionStudents.map((s) => ({
              student_id: s.id,
              date: selectedDate,
              class_id: classId,
              section_id: sec.id,
              status: s.status,
              absent_reason: s.absent_reason ?? undefined,
              arrival_time: s.arrival_time ?? undefined,
              sign_in_time: s.sign_in_time ?? undefined,
              sign_out_time: s.sign_out_time ?? undefined,
              pickup_time: s.pickup_time ?? undefined,
              pickup_by: s.pickup_by ?? undefined,
              lunch: s.lunch,
            }));
            saveBulk(marks, () => {}, () => {});
          }
        });
      }
    }
    setOpenClasses((prev) => {
      if (prev.has(classId)) return new Set<number>();
      return new Set([classId]);
    });
  }, [openClasses, classes, students, selectedDate, isReadOnly, saveBulk]);

  const handleSectionChange = useCallback((classId: number, sectionId: number) => {
    setActiveSections((prev) => ({ ...prev, [classId]: sectionId }));
    // Reload section data for the selected date every time section changes.
    loadSection(classId, sectionId, selectedDate);
  }, [loadSection, selectedDate]);

  const handleSelectionChange = useCallback((key: string, ids: Set<number>) => {
    setSelectedRows((prev) => ({ ...prev, [key]: ids }));
  }, []);

  const handleDateChange = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedRows({});
    setIsEditUnlocked(false);  // lock again when switching dates
    clearStudents();            // clear cached data so new date's data is fetched fresh
  }, [clearStudents]);

  const handleMidnightReset = useCallback(async (previousDate: string, nextDate: string) => {
    setCurrentDay(nextDate);

    if (selectedDateRef.current !== previousDate) {
      return;
    }

    const pendingBySection: Record<string, { student_id: number; date: string; class_id: number; section_id: number; status?: AttendanceStatus; sign_out_time: string }[]> = {};

    Object.entries(studentsRef.current).forEach(([key, sectionStudents]) => {
      const [classIdRaw, sectionIdRaw] = key.split('-');
      const classId = Number(classIdRaw);
      const sectionId = Number(sectionIdRaw);
      if (Number.isNaN(classId) || Number.isNaN(sectionId)) return;

      const pendingMarks = sectionStudents
        .filter((student) => student.sign_in_time && !student.sign_out_time)
        .map((student) => ({
          student_id: student.id,
          date: previousDate,
          class_id: classId,
          section_id: sectionId,
          status: student.status !== 'unmarked' ? student.status : undefined,
          sign_out_time: '23:59',
        }));

      if (pendingMarks.length > 0) {
        pendingBySection[key] = pendingMarks;
      }
    });

    await Promise.all(
      Object.values(pendingBySection).map(async (marks) => {
        await saveBulk(marks, () => {}, () => {});
      }),
    );

    setSelectedDate(nextDate);
    setSelectedRows({});
    setIsEditUnlocked(false);
    clearStudents();
    pushToast('Attendance rolled over to the new day.', 'success');
  }, [clearStudents, pushToast, saveBulk]);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 1, 0);
    const timeout = window.setTimeout(() => {
      const nextDate = formatDate(new Date());
      void handleMidnightReset(currentDay, nextDate);
    }, Math.max(nextMidnight.getTime() - now.getTime(), 1000));

    return () => window.clearTimeout(timeout);
  }, [currentDay, handleMidnightReset]);

  const handleExportCsv = useCallback(async () => {
    const allStudents = Object.values(students).flat();

    const exported = await exportAttendance(
      'all',
      () => pushToast('Attendance export downloaded.', 'success'),
      () => {
        // Fallback to local export only if backend export fails.
      },
    );
    if (exported) return;

    if (allStudents.length === 0) {
      pushToast('No loaded student data to export. Open a class section first.', 'error');
      return;
    }

    const header = ['Admission No', 'Student Name', 'Roll No', 'Status', 'Absent Reason', 'Sign In', 'Sign Out', 'Lunch'];
    const rows = allStudents.map((s) => [
      s.admission_no || '',
      s.full_name || '',
      s.roll_no || '',
      s.status || 'unmarked',
      s.absent_reason || '',
      s.sign_in_time || '',
      s.sign_out_time || '',
      s.lunch ? 'Yes' : 'No',
    ]);

    const escapeCell = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((line) => line.map(escapeCell).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `student_attendance_${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    pushToast('Attendance CSV exported successfully.', 'success');
  }, [students, selectedDate, exportAttendance, pushToast]);

  const commitStudentStatus = useCallback(
    (
      classId: number,
      sectionId: number,
      student: Student,
      newStatus: AttendanceStatus,
      absentReason?: string,
      options?: { signInTime?: string | null; signOutTime?: string | null; successMessage?: string },
    ) => {
      const autoSignInTime = newStatus === 'present' && !student.sign_in_time
        ? currentTimeHHMM()
        : student.sign_in_time;
      const nextStudent = {
        ...student,
        status: newStatus,
        absent_reason: absentReason ?? null,
        sign_in_time: options?.signInTime ?? autoSignInTime,
        sign_out_time: options?.signOutTime ?? student.sign_out_time,
      };
      updateStudent(classId, sectionId, nextStudent, selectedDate);
      patchMark(
        student.id,
        {
          student_id: student.id,
          date: selectedDate,
          class_id: classId,
          section_id: sectionId,
          status: newStatus,
          absent_reason: absentReason,
        },
        () => pushToast(options?.successMessage ?? 'Attendance updated.', 'success'),
        (msg) => {
          updateStudent(classId, sectionId, student, selectedDate);
          pushToast(msg || 'Failed to update attendance.', 'error');
        },
      );
    },
    [selectedDate, patchMark, updateStudent, pushToast],
  );

  const getLateThresholdInfo = useCallback((classId: number, sectionId: number, student: Student, signInTime: string) => {
    const key = `${classId}-${sectionId}`;
    const sectionStudents = students[key] ?? [];
    const eligible = sectionStudents.filter((s) => s.status !== 'absent');
    if (eligible.length === 0) return { shouldPrompt: false, minutesLate: 0 };

    const candidateMinutes = toMinutes(signInTime);
    if (candidateMinutes === null) return { shouldPrompt: false, minutesLate: 0 };

    let signedInCount = 0;
    const signedTimes: number[] = [];

    eligible.forEach((s) => {
      const isCurrent = s.id === student.id;
      const time = isCurrent ? signInTime : s.sign_in_time;
      const mins = time ? toMinutes(time) : null;
      if (mins !== null) {
        signedInCount += 1;
        signedTimes.push(mins);
      }
    });

    if (signedInCount === 0) return { shouldPrompt: false, minutesLate: 0 };
    const signedRatio = signedInCount / eligible.length;
    if (signedRatio < LATE_RATIO_THRESHOLD) return { shouldPrompt: false, minutesLate: 0 };

    const earliest = Math.min(...signedTimes);
    const minutesLate = Math.max(0, candidateMinutes - earliest);
    if (minutesLate < LATE_MINUTES_BUFFER) return { shouldPrompt: false, minutesLate: 0 };

    return { shouldPrompt: true, minutesLate };
  }, [students]);

  const handleEditStatusPrompt = useCallback((classId: number, sectionId: number, student: Student) => {
    if (isReadOnly) return;
    if (student.status === 'absent') {
      setAbsentDialogState({ classId, sectionId, student, mode: 'edit' });
      return;
    }
    if (student.status === 'late') {
      setLateDialogState({
        classId,
        sectionId,
        student,
        signInTime: student.sign_in_time ?? currentTimeHHMM(),
        minutesLate: student.late_minutes || 1,
      });
    }
  }, [isReadOnly]);

  const handleToggleAbsent = useCallback((classId: number, sectionId: number, student: Student) => {
    if (isReadOnly) return;
    if (student.sign_in_time && !student.sign_out_time) {
      pushToast('Sign out the student before marking absent.', 'error');
      return;
    }
    if (student.status === 'absent') {
      commitStudentStatus(classId, sectionId, student, 'present');
      return;
    }
    setAbsentDialogState({ classId, sectionId, student, mode: 'mark' });
  }, [isReadOnly, commitStudentStatus, pushToast]);

  const handleToggleLunch = useCallback((classId: number, sectionId: number, student: Student) => {
    const newLunch = !student.lunch;
    updateStudent(classId, sectionId, { ...student, lunch: newLunch }, selectedDate);
    patchMark(
      student.id,
      { student_id: student.id, date: selectedDate, class_id: classId, section_id: sectionId, lunch: newLunch },
      () => pushToast('Lunch status updated.', 'success'),
      (msg) => {
        updateStudent(classId, sectionId, student, selectedDate);
        pushToast(msg || 'Failed to update lunch status.', 'error');
      },
    );
  }, [selectedDate, patchMark, updateStudent, pushToast]);

  const handleSignIn = useCallback((classId: number, sectionId: number, student: Student) => {
    if (isReadOnly || student.status === 'absent' || student.sign_in_time) return;
    const now = currentTimeHHMM();
    const lateInfo = getLateThresholdInfo(classId, sectionId, student, now);
    if (lateInfo.shouldPrompt) {
      setLateDialogState({ classId, sectionId, student, signInTime: now, minutesLate: lateInfo.minutesLate });
      return;
    }
    commitStudentStatus(classId, sectionId, student, 'present', undefined, {
      signInTime: now,
      successMessage: 'Sign-in saved.',
    });
  }, [isReadOnly, getLateThresholdInfo, commitStudentStatus]);

  const handleSignOut = useCallback((classId: number, sectionId: number, student: Student) => {
    if (isReadOnly || !student.sign_in_time || student.sign_out_time) return;
    const now = currentTimeHHMM();
    updateStudent(classId, sectionId, { ...student, sign_out_time: now }, selectedDate);
    pushToast('Sign-out saved.', 'success');
  }, [isReadOnly, updateStudent, selectedDate, pushToast]);

  const handleBulkMark = useCallback((classId: number, sectionId: number, status: AttendanceStatus) => {
    const key = `${classId}-${sectionId}`;
    const ids = selectedRows[key] ?? new Set<number>();
    const sectionStudents = students[key] ?? [];
    // If no rows are selected, treat as "mark all"; otherwise mark only selected rows
    const baseTargets = ids.size > 0 ? sectionStudents.filter((s) => ids.has(s.id)) : sectionStudents;
    // For mark-all-present, preserve students already marked absent.
    const targets = status === 'present' ? baseTargets.filter((s) => s.status !== 'absent') : baseTargets;
    if (targets.length === 0) return;
    const now = new Date().toTimeString().slice(0, 5);
    // Update local state immediately so the UI reflects changes
    targets.forEach((s) => {
      const update: Student = { ...s, status };
      if (status === 'present' && !s.sign_in_time) update.sign_in_time = now;
      updateStudent(classId, sectionId, update, selectedDate);
    });
    const marks = targets.map((s) => ({ student_id: s.id, date: selectedDate, class_id: classId, section_id: sectionId, status }));
    saveBulk(
      marks,
      (saved) => pushToast(`${saved} attendance record(s) updated.`, 'success'),
      () => pushToast('Failed to update attendance.', 'error'),
    );
    setSelectedRows((prev) => ({ ...prev, [key]: new Set() }));
  }, [selectedRows, students, selectedDate, saveBulk, updateStudent, pushToast]);

  const handleBulkSignIn = useCallback((classId: number, sectionId: number) => {
    const key = `${classId}-${sectionId}`;
    const ids = selectedRows[key] ?? new Set<number>();
    const now = currentTimeHHMM();
    const targets = (students[key] ?? []).filter((s) => ids.has(s.id) && s.status !== 'absent');
    targets.forEach((s) => {
      updateStudent(classId, sectionId, { ...s, status: 'present', sign_in_time: s.sign_in_time ?? now }, selectedDate);
    });
    const marks = targets.map((s) => ({ student_id: s.id, date: selectedDate, class_id: classId, section_id: sectionId, status: 'present' as const }));
    saveBulk(
      marks,
      (saved) => pushToast(`${saved} sign-in record(s) saved.`, 'success'),
      () => pushToast('Failed to save bulk sign-in.', 'error'),
    );
  }, [selectedRows, students, selectedDate, saveBulk, pushToast, updateStudent]);

  const handleSave = useCallback((classId: number, sectionId: number) => {
    const key = `${classId}-${sectionId}`;
    const marks = (students[key] ?? []).map((s) => ({
      student_id: s.id,
      date: selectedDate,
      class_id: classId,
      section_id: sectionId,
      status: s.status,
      absent_reason: s.absent_reason ?? undefined,
      arrival_time: s.arrival_time ?? undefined,
      sign_in_time: s.sign_in_time ?? undefined,
      sign_out_time: s.sign_out_time ?? undefined,
      pickup_time: s.pickup_time ?? undefined,
      pickup_by: s.pickup_by ?? undefined,
      lunch: s.lunch,
    }));
    saveBulk(
      marks,
      (saved) => {
        pushToast(`Saved ${saved} attendance row(s).`, 'success');
        setOpenClasses((prev) => {
          const next = new Set(prev);
          next.delete(classId);
          return next;
        });
      },
      () => pushToast('Failed to save attendance.', 'error'),
    );
  }, [students, selectedDate, saveBulk, pushToast]);

  const handleOpenNote = useCallback((classId: number, sectionId: number, student: Student) => {
    setNotesDialogState({
      classId,
      sectionId,
      studentId: student.id,
      mode: student.notes_count > 0 ? 'view' : 'add',
    });
  }, []);

  const handleSaveNote = useCallback((classId: number, sectionId: number, studentId: number, noteText: string) => {
    const key = `${classId}-${sectionId}`;
    const student = students[key]?.find((s) => s.id === studentId);
    if (!student) return;
    const newNote: StudentNote = { id: `note-${Date.now()}`, text: noteText, created_at: new Date().toISOString() };
    const updatedNotes = [...student.notes, newNote];
    updateStudent(classId, sectionId, { ...student, notes: updatedNotes, notes_count: updatedNotes.length }, selectedDate);
    patchMark(
      student.id,
      { student_id: student.id, date: selectedDate, class_id: classId, section_id: sectionId, note: noteText },
      () => pushToast('Note saved.', 'success'),
      (msg) => pushToast(msg || 'Failed to save note.', 'error'),
    );
    setNotesDialogState(null);
  }, [students, selectedDate, patchMark, updateStudent, pushToast]);

  const handleUpdateNote = useCallback((classId: number, sectionId: number, studentId: number, noteId: string, newText: string) => {
    const key = `${classId}-${sectionId}`;
    const student = students[key]?.find((s) => s.id === studentId);
    if (!student) return;
    const updatedNotes = student.notes.map((n) => n.id === noteId ? { ...n, text: newText } : n);
    updateStudent(classId, sectionId, { ...student, notes: updatedNotes }, selectedDate);
    const latest = updatedNotes[updatedNotes.length - 1];
    patchMark(
      student.id,
      { student_id: student.id, date: selectedDate, class_id: classId, section_id: sectionId, note: latest?.text ?? '' },
      () => pushToast('Note updated.', 'success'),
      (msg) => pushToast(msg || 'Failed to update note.', 'error'),
    );
  }, [students, selectedDate, patchMark, updateStudent, pushToast]);

  const handleDeleteNote = useCallback((classId: number, sectionId: number, studentId: number, noteId: string) => {
    const key = `${classId}-${sectionId}`;
    const student = students[key]?.find((s) => s.id === studentId);
    if (!student) return;
    const updatedNotes = student.notes.filter((n) => n.id !== noteId);
    updateStudent(classId, sectionId, { ...student, notes: updatedNotes, notes_count: updatedNotes.length }, selectedDate);
    const latest = updatedNotes[updatedNotes.length - 1];
    patchMark(
      student.id,
      { student_id: student.id, date: selectedDate, class_id: classId, section_id: sectionId, note: latest?.text ?? '' },
      () => pushToast('Note deleted.', 'success'),
      (msg) => pushToast(msg || 'Failed to delete note.', 'error'),
    );
  }, [students, selectedDate, patchMark, updateStudent, pushToast]);

  const handleReset = useCallback((classId: number, sectionId: number) => {
    loadSection(classId, sectionId, selectedDate);
  }, [loadSection, selectedDate]);

  const handleMarkAllVisible = useCallback((status: AttendanceStatus) => {
    openClasses.forEach((classId) => {
      const cls = classes.find((c) => c.id === classId);
      if (!cls) return;
      const sectionId = activeSections[classId] ?? cls.sections[0]?.id;
      if (sectionId) handleBulkMark(classId, sectionId, status);
    });
  }, [openClasses, classes, activeSections, handleBulkMark]);

  const handleMarkAllPresentForClass = useCallback((classId: number) => {
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return;
    const now = currentTimeHHMM();
    let touched = 0;
    cls.sections.forEach((sec) => {
      const key = `${classId}-${sec.id}`;
      const sectionStudents = students[key];
      if (!sectionStudents || sectionStudents.length === 0) return;
      const targets = sectionStudents.filter((s) => s.status !== 'absent');
      targets.forEach((s) => {
        const update: Student = { ...s, status: 'present', sign_in_time: s.sign_in_time ?? now };
        updateStudent(classId, sec.id, update, selectedDate);
        touched += 1;
      });
      const marks = targets.map((s) => ({
        student_id: s.id, date: selectedDate, class_id: classId, section_id: sec.id,
        status: 'present' as const,
      }));
      saveBulk(marks, () => {}, () => {});
    });
    if (touched > 0) {
      pushToast(`Marked ${touched} student(s) present in ${cls.display_label}.`, 'success');
    }
  }, [classes, students, selectedDate, updateStudent, saveBulk, pushToast]);

  return (
    <div className="p-6 bg-[#F0EFFE] min-h-full overflow-x-hidden">
      {toast ? (
        <TopToast
          message={toast.message}
          tone={toast.tone}
          autoCloseMs={toast.tone === 'error' ? 8000 : 3000}
          onClose={() => setToast(null)}
        />
      ) : null}

      <AttendancePageHeader
        onImport={() => setImportDialogOpen(true)}
        onExport={handleExportCsv}
        onDownloadSample={() => {
          downloadSampleTemplate(
            () => pushToast('Sample attendance template downloaded.', 'success'),
            () => pushToast('Failed to download sample file.', 'error'),
          );
        }}
      />

      {kpis && kpis.rte_at_risk > 0 && (
        <AttendanceAlert count={kpis.rte_at_risk} />
      )}

      <AttendanceKPIs data={kpis} selectedDate={selectedDate} today={currentDay} />

      <AttendanceFilterBar
        academicYear={academicYear}
        levelFilter={levelFilter}
        onYearChange={setAcademicYear}
        onLevelChange={setLevelFilter}
      />

      <GlobalControls
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sectionFilter={sectionFilter}
        onSectionFilterChange={setSectionFilter}
        onMarkAllVisible={handleMarkAllVisible}
      />

      {classesLoading ? (
        <div className="flex flex-col gap-2.5 mb-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E6E6EC] h-14 animate-pulse" />
          ))}
        </div>
      ) : (
        <ClassAccordionGrid
          classes={classes}
          levelFilter={levelFilter}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          sectionFilter={sectionFilter}
          openClasses={openClasses}
          onToggleClass={handleToggleClass}
          activeSections={activeSections}
          onSectionChange={handleSectionChange}
          students={students}
          loadingStudents={studentsLoading}
          selectedRows={selectedRows}
          onSelectionChange={handleSelectionChange}
          onToggleAbsent={handleToggleAbsent}
          onEditStatusPrompt={handleEditStatusPrompt}
          onToggleLunch={handleToggleLunch}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onBulkMark={handleBulkMark}
          onBulkSignIn={handleBulkSignIn}
          onSave={handleSave}
          onReset={handleReset}
          onOpenNote={handleOpenNote}
          readOnly={isReadOnly}
          dateMode={dateMode}
          selectedDate={selectedDate}
          onRequestUnlock={() => setShowUnlockDialog(true)}
          isSundayLocked={isSundaySelected && !isEditUnlocked && dateMode === 'today'}
          onMarkAllPresentForClass={handleMarkAllPresentForClass}
          isEditUnlocked={isEditUnlocked}
          onLogoutPastEdit={() => {
            setIsEditUnlocked(false);
            pushToast('Past-date edit mode closed.', 'success');
          }}
        />
      )}

      <MonthlyReport
        selectedDate={selectedDate}
        classes={classes}
      />

      {absentDialogState ? (
        <AbsentNoteDialog
          student={absentDialogState.student}
          initialReason={absentDialogState.student.absent_reason ?? ''}
          onConfirm={(reason) => {
            commitStudentStatus(
              absentDialogState.classId,
              absentDialogState.sectionId,
              absentDialogState.student,
              'absent',
              reason || undefined,
            );
            setAbsentDialogState(null);
          }}
          onSkip={() => {
            if (absentDialogState.mode === 'mark') {
              commitStudentStatus(
                absentDialogState.classId,
                absentDialogState.sectionId,
                absentDialogState.student,
                'absent',
              );
            }
            setAbsentDialogState(null);
          }}
        />
      ) : null}

      {notesDialogState ? (() => {
        const { classId, sectionId, studentId, mode } = notesDialogState;
        const notesStudent = students[`${classId}-${sectionId}`]?.find((s) => s.id === studentId) ?? null;
        if (!notesStudent) return null;
        if (mode === 'view' && notesStudent.notes.length > 0) {
          return (
            <ViewNotesModal
              student={notesStudent}
              onEditNote={(noteId, newText) => handleUpdateNote(classId, sectionId, studentId, noteId, newText)}
              onDeleteNote={(noteId) => handleDeleteNote(classId, sectionId, studentId, noteId)}
              onClose={() => setNotesDialogState(null)}
            />
          );
        }
        return (
          <NotesModal
            student={notesStudent}
            initialNote={notesStudent.notes[0]?.text ?? ''}
            onSave={(_s, noteText) => handleSaveNote(classId, sectionId, studentId, noteText)}
            onClose={() => setNotesDialogState(null)}
          />
        );
      })() : null}

      {lateDialogState ? (
        <LateCommerDialog
          student={lateDialogState.student}
          minutesLate={lateDialogState.minutesLate}
          initialMessage={lateDialogState.student.absent_reason ?? ''}
          onMarkLate={(message) => {
            commitStudentStatus(
              lateDialogState.classId,
              lateDialogState.sectionId,
              lateDialogState.student,
              'late',
              message || undefined,
              { signInTime: lateDialogState.signInTime },
            );
            setLateDialogState(null);
          }}
          onSchoolApproved={(reason) => {
            commitStudentStatus(
              lateDialogState.classId,
              lateDialogState.sectionId,
              lateDialogState.student,
              'present',
              reason ? `School approved: ${reason}` : undefined,
              { signInTime: lateDialogState.signInTime },
            );
            setLateDialogState(null);
          }}
          onSkip={() => {
            commitStudentStatus(
              lateDialogState.classId,
              lateDialogState.sectionId,
              lateDialogState.student,
              'present',
              undefined,
              { signInTime: lateDialogState.signInTime },
            );
            setLateDialogState(null);
          }}
        />
      ) : null}

      {showUnlockDialog && (
        <UnlockEditDialog
          onUnlock={() => {
            setIsEditUnlocked(true);
            setShowUnlockDialog(false);
            pushToast('Past date editing unlocked.', 'success');
          }}
          onClose={() => setShowUnlockDialog(false)}
        />
      )}

      <StudentAttendanceImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onNotify={(message, tone) => pushToast(message, tone)}
        onImported={({ classId, sectionId, date, imported }) => {
          setSelectedDate(date);
          setActiveSections((prev) => ({ ...prev, [classId]: sectionId }));
          setOpenClasses(new Set([classId]));
          // Force a refresh of that section's roster for the imported date.
          loadSection(classId, sectionId, date);
          pushToast(
            `Imported ${imported} attendance record${imported === 1 ? '' : 's'}. Refreshed view.`,
            'success',
          );
        }}
      />
    </div>
  );
}
