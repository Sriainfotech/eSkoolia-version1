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
import ConfirmDialogHost, { confirmDialog } from './components/ConfirmDialog';
import ExportOptionsDialogHost, { exportOptionsDialog } from './components/ExportOptionsDialog';
import { useCurrentAcademicYear } from '@/hooks/useCurrentAcademicYear';

const LATE_RATIO_THRESHOLD = 0;
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
  const { year: defaultAcademicYear } = useCurrentAcademicYear('2026-27');
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear);
  useEffect(() => { setAcademicYear(defaultAcademicYear); }, [defaultAcademicYear]);
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
  const { classes, loading: classesLoading, refreshClassSummary } = useClasses(selectedDate);
  const { students, loading: studentsLoading, loadSection, updateStudent, clearStudents, clearStudentMeta } = useStudents();
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
    const opts = await exportOptionsDialog({
      defaultDate: selectedDate,
      classes: classes.map((c) => ({
        id: String(c.id),
        name: c.name,
        sections: (c.sections ?? []).map((s) => ({ id: String(s.id), name: s.name })),
      })),
      initialClassId: 'all',
      initialSectionId: 'all',
    });
    if (!opts) return;

    const exportArgs: { sectionId?: string; dateFrom?: string; dateTo?: string; singleDate?: boolean; format?: 'xlsx' | 'csv' } = {
      format: 'xlsx',
      sectionId: opts.sectionId,
    };
    if (opts.scope === 'day') {
      exportArgs.singleDate = true;
      exportArgs.dateFrom = opts.date;
      exportArgs.dateTo = opts.date;
    } else if (opts.scope === 'month') {
      const [yy, mm] = opts.month.split('-').map(Number);
      const lastDay = new Date(yy, mm, 0).getDate();
      exportArgs.dateFrom = `${opts.month}-01`;
      exportArgs.dateTo = `${opts.month}-${String(lastDay).padStart(2, '0')}`;
    } else {
      if (!opts.dateFrom || !opts.dateTo) {
        pushToast('Please pick both From and To dates.', 'error');
        return;
      }
      exportArgs.dateFrom = opts.dateFrom;
      exportArgs.dateTo = opts.dateTo;
    }

    if (opts.scope === 'day') {
      // override: use the picked single date as the request date
      await exportAttendance(
        opts.classId,
        () => pushToast('Attendance report downloaded.', 'success'),
        (msg) => pushToast(msg || 'Failed to download report.', 'error'),
        { ...exportArgs, dateFrom: undefined, dateTo: undefined, singleDate: true },
      );
      return;
    }

    await exportAttendance(
      opts.classId,
      () => pushToast('Attendance report downloaded.', 'success'),
      (msg) => pushToast(msg || 'Failed to download report.', 'error'),
      exportArgs,
    );
  }, [classes, selectedDate, exportAttendance, pushToast]);

  const commitStudentStatus = useCallback(
    (
      classId: number,
      sectionId: number,
      student: Student,
      newStatus: AttendanceStatus,
      absentReason?: string,
      options?: { signInTime?: string | null; signOutTime?: string | null; successMessage?: string },
    ) => {
      // Issue #1: never auto-sign-in on a status change. Sign-in only happens
      // when the explicit Sign-in flow runs and passes options.signInTime.
      const signInTime = options?.signInTime !== undefined ? options.signInTime : student.sign_in_time;
      const signOutTime = options?.signOutTime !== undefined ? options.signOutTime : student.sign_out_time;
      // Issue #2: arrival mirrors sign-in, pickup mirrors sign-out.
      const arrivalTime = signInTime ?? student.arrival_time;
      const pickupTime = signOutTime ?? student.pickup_time;
      const nextStudent = {
        ...student,
        status: newStatus,
        absent_reason: absentReason ?? (newStatus === 'absent' ? student.absent_reason : null),
        sign_in_time: signInTime,
        sign_out_time: signOutTime,
        arrival_time: arrivalTime,
        pickup_time: pickupTime,
      };
      updateStudent(classId, sectionId, nextStudent, selectedDate);
      // CHANGED (persistence): convert explicit nulls to '' so the backend
      // actually clears the field; previous `?? undefined` swallowed reset.
      const toPayload = (v: string | null | undefined) =>
        v === null ? '' : (v ?? undefined);
      // When transitioning OUT of absent (and no explicit reason was given),
      // wipe the stored absent reason on the server too — otherwise the
      // backend "preserve existing note" logic keeps the old reason and it
      // re-appears on refresh attached to a non-absent row.
      const noteToSend =
        absentReason !== undefined
          ? absentReason
          : (newStatus !== 'absent' ? '' : undefined);
      patchMark(
        student.id,
        {
          student_id: student.id,
          date: selectedDate,
          class_id: classId,
          section_id: sectionId,
          status: newStatus,
          absent_reason: absentReason,
          note: noteToSend,
          sign_in_time: toPayload(signInTime),
          sign_out_time: toPayload(signOutTime),
          arrival_time: toPayload(arrivalTime),
          pickup_time: toPayload(pickupTime),
        },
        () => {
          pushToast(options?.successMessage ?? 'Attendance updated.', 'success');
          // CHANGED (persistence): clear local optimistic overlay then refetch
          // from the server so the displayed data is what was actually stored.
          clearStudentMeta(selectedDate, [student.id]);
          loadSection(classId, sectionId, selectedDate);
        },
        (msg) => {
          updateStudent(classId, sectionId, student, selectedDate);
          pushToast(msg || 'Failed to update attendance.', 'error');
        },
      );
    },
    [selectedDate, patchMark, updateStudent, pushToast, loadSection, clearStudentMeta],
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

  const handleToggleAbsent = useCallback(async (classId: number, sectionId: number, student: Student) => {
    if (isReadOnly) return;
    if (student.sign_in_time && !student.sign_out_time) {
      pushToast('Sign out the student before marking absent.', 'error');
      return;
    }
    if (student.status === 'absent') {
      // Issue #1 + #4: confirm reverting via centered dialog (no native browser prompt).
      const { ok } = await confirmDialog({
        title: 'Remove absent mark?',
        message: `${student.full_name} will be moved back to the unmarked list. You can sign them in afterwards.`,
        tone: 'warn',
        confirmLabel: 'Yes, remove',
        cancelLabel: 'Keep absent',
      });
      if (!ok) return;
      // Revert to present without auto sign-in (issue #1 + #2).
      commitStudentStatus(classId, sectionId, student, 'present', undefined, { signInTime: null });
      return;
    }
    // Issue #1 + #4: confirm flipping to absent via centered dialog.
    const { ok } = await confirmDialog({
      title: 'Mark student absent?',
      message: `Confirm marking ${student.full_name} as absent for today. You'll be asked to add a reason next.`,
      tone: 'danger',
      confirmLabel: 'Mark absent',
    });
    if (!ok) return;
    setAbsentDialogState({ classId, sectionId, student, mode: 'mark' });
  }, [isReadOnly, commitStudentStatus, pushToast]);

  const handleToggleLunch = useCallback((classId: number, sectionId: number, student: Student) => {
    const newLunch = !student.lunch;
    updateStudent(classId, sectionId, { ...student, lunch: newLunch }, selectedDate);
    patchMark(
      student.id,
      { student_id: student.id, date: selectedDate, class_id: classId, section_id: sectionId, lunch: newLunch },
      () => {
        pushToast('Lunch status updated.', 'success');
        clearStudentMeta(selectedDate, [student.id]);
        loadSection(classId, sectionId, selectedDate);
      },
      (msg) => {
        updateStudent(classId, sectionId, student, selectedDate);
        pushToast(msg || 'Failed to update lunch status.', 'error');
      },
    );
  }, [selectedDate, patchMark, updateStudent, pushToast, loadSection, clearStudentMeta]);

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

  const handleSignOut = useCallback(async (classId: number, sectionId: number, student: Student) => {
    if (isReadOnly || !student.sign_in_time || student.sign_out_time) return;
    const now = currentTimeHHMM();

    // Issue #7: very short stay (sign-in & sign-out same or under 1 hour apart) → centered confirm
    const inMins = toMinutes(student.sign_in_time);
    const outMins = toMinutes(now);
    let shortStayNote: string | null = null;
    if (inMins !== null && outMins !== null && outMins - inMins < 60) {
      const gap = Math.max(0, outMins - inMins);
      const { ok, note } = await confirmDialog({
        title: 'Sign out so soon?',
        message: `${student.full_name} signed in at ${student.sign_in_time} — only ${gap} minute${gap === 1 ? '' : 's'} ago. Confirm to sign them out now.`,
        tone: 'warn',
        confirmLabel: 'Confirm sign-out',
        cancelLabel: 'Wait',
        noteLabel: 'Reason / note',
        notePlaceholder: 'e.g. parent emergency pickup…',
        noteRequired: false,
      });
      if (!ok) return;
      shortStayNote = note ?? null;
    }

    // Issue #2: early pickup detection (vs. peer baseline). Uses centered dialog now.
    const key = `${classId}-${sectionId}`;
    const peers = students[key] ?? [];
    const peerOuts = peers
      .filter((s) => s.id !== student.id && s.sign_out_time)
      .map((s) => toMinutes(s.sign_out_time as string))
      .filter((v): v is number => v !== null);
    const latestPeer = peerOuts.length > 0 ? Math.max(...peerOuts) : null;
    const isEarly = outMins !== null && latestPeer !== null && (latestPeer - outMins) >= 20;
    let earlyReason: string | null = null;
    if (isEarly) {
      const { ok, note } = await confirmDialog({
        title: 'Early pickup',
        message: `${student.full_name} is being picked up ${latestPeer! - outMins!} minutes earlier than typical for the section. Please add a reason for the records.`,
        tone: 'warn',
        confirmLabel: 'Confirm sign-out',
        noteLabel: 'Reason',
        notePlaceholder: 'e.g. doctor appointment…',
        noteRequired: true,
      });
      if (!ok) return;
      earlyReason = (note ?? '').trim() || null;
      if (!earlyReason) {
        pushToast('A reason is required for early pickup.', 'error');
        return;
      }
    }

    // Build combined note text (early-pickup wins, short-stay appended)
    const noteFragments: string[] = [];
    if (earlyReason) noteFragments.push(`Early pickup: ${earlyReason}`);
    if (shortStayNote) noteFragments.push(`Short stay: ${shortStayNote}`);
    const combinedNoteText = noteFragments.join(' | ') || null;

    const updatedNotes = combinedNoteText
      ? [
          ...student.notes,
          { id: `note-${Date.now()}`, text: combinedNoteText, created_at: new Date().toISOString() } as StudentNote,
        ]
      : student.notes;
    const next: Student = {
      ...student,
      sign_out_time: now,
      pickup_time: now,
      notes: updatedNotes,
      notes_count: updatedNotes.length,
    };
    updateStudent(classId, sectionId, next, selectedDate);
    patchMark(
      student.id,
      {
        student_id: student.id,
        date: selectedDate,
        class_id: classId,
        section_id: sectionId,
        sign_out_time: now,
        pickup_time: now,
        ...(combinedNoteText ? { note: combinedNoteText } : {}),
      },
      () => {
        pushToast(combinedNoteText ? 'Sign-out saved with note.' : 'Sign-out saved.', 'success');
        clearStudentMeta(selectedDate, [student.id]);
        loadSection(classId, sectionId, selectedDate);
      },
      (msg) => {
        updateStudent(classId, sectionId, student, selectedDate);
        pushToast(msg || 'Failed to sign out.', 'error');
      },
    );
  }, [isReadOnly, students, updateStudent, selectedDate, patchMark, pushToast, loadSection, clearStudentMeta]);

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
    // Issue #1: marking present must auto sign-in (and mirror arrival = sign-in).
    const shouldSignIn = status === 'present';
    targets.forEach((s) => {
      const update: Student = { ...s, status };
      if (shouldSignIn && !s.sign_in_time) {
        update.sign_in_time = now;
        update.arrival_time = s.arrival_time ?? now;
      }
      updateStudent(classId, sectionId, update, selectedDate);
    });
    const marks = targets.map((s) => {
      const base: Record<string, unknown> = {
        student_id: s.id, date: selectedDate, class_id: classId, section_id: sectionId, status,
      };
      if (shouldSignIn && !s.sign_in_time) {
        base.sign_in_time = now;
        base.arrival_time = s.arrival_time ?? now;
      }
      return base as { student_id: number; date: string; class_id: number; section_id: number; status: AttendanceStatus };
    });
    saveBulk(
      marks,
      (saved) => {
        pushToast(`${saved} attendance record(s) updated.`, 'success');
        clearStudentMeta(selectedDate, targets.map((t) => t.id));
        loadSection(classId, sectionId, selectedDate);
      },
      () => pushToast('Failed to update attendance.', 'error'),
    );
    setSelectedRows((prev) => ({ ...prev, [key]: new Set() }));
  }, [selectedRows, students, selectedDate, saveBulk, updateStudent, pushToast, loadSection, clearStudentMeta]);

  const handleBulkSignIn = useCallback((classId: number, sectionId: number) => {
    const key = `${classId}-${sectionId}`;
    const ids = selectedRows[key] ?? new Set<number>();
    const now = currentTimeHHMM();
    const targets = (students[key] ?? []).filter((s) => ids.has(s.id) && s.status !== 'absent');
    targets.forEach((s) => {
      updateStudent(classId, sectionId, {
        ...s,
        status: 'present',
        sign_in_time: s.sign_in_time ?? now,
        arrival_time: s.arrival_time ?? s.sign_in_time ?? now,
      }, selectedDate);
    });
    const marks = targets.map((s) => ({
      student_id: s.id, date: selectedDate, class_id: classId, section_id: sectionId,
      status: 'present' as const,
      sign_in_time: s.sign_in_time ?? now,
      arrival_time: s.arrival_time ?? s.sign_in_time ?? now,
    }));
    saveBulk(
      marks,
      (saved) => {
        pushToast(`${saved} sign-in record(s) saved.`, 'success');
        clearStudentMeta(selectedDate, targets.map((t) => t.id));
        loadSection(classId, sectionId, selectedDate);
      },
      () => pushToast('Failed to save bulk sign-in.', 'error'),
    );
  }, [selectedRows, students, selectedDate, saveBulk, pushToast, updateStudent, loadSection, clearStudentMeta]);

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
        // Issue #9: close the accordion AND show a small success toast.
        pushToast(`✓ Saved ${saved} attendance record(s).`, 'success');
        setOpenClasses((prev) => {
          const next = new Set(prev);
          next.delete(classId);
          return next;
        });
        // Clear selections for this section.
        setSelectedRows((prev) => ({ ...prev, [`${classId}-${sectionId}`]: new Set() }));
        // CHANGED (persistence): drop optimistic overlay and pull server truth
        // so what's displayed equals what's actually persisted.
        clearStudentMeta(selectedDate, marks.map((m) => m.student_id));
        loadSection(classId, sectionId, selectedDate);
        // Refresh class-summary so accordion percentages reflect what was just saved.
        refreshClassSummary();
      },
      (msg) => pushToast(msg ? `Failed to save: ${msg}` : 'Failed to save attendance.', 'error'),
    );
  }, [students, selectedDate, saveBulk, pushToast, refreshClassSummary, loadSection, clearStudentMeta]);

  const handleOpenNote = useCallback((classId: number, sectionId: number, student: Student, mode: 'add' | 'view' = 'add') => {
    // Issue #3: Add icon ALWAYS opens a fresh-note composer, View icon ALWAYS
    // shows the existing notes list. The caller decides via `mode`. If view is
    // requested but no notes exist, fall back to add silently.
    const effectiveMode = mode === 'view' && student.notes_count === 0 ? 'add' : mode;
    setNotesDialogState({ classId, sectionId, studentId: student.id, mode: effectiveMode });
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
      () => {
        pushToast('Note saved.', 'success');
        clearStudentMeta(selectedDate, [student.id]);
        loadSection(classId, sectionId, selectedDate);
      },
      (msg) => pushToast(msg || 'Failed to save note.', 'error'),
    );
    setNotesDialogState(null);
  }, [students, selectedDate, patchMark, updateStudent, pushToast, loadSection, clearStudentMeta]);

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
      () => {
        pushToast('Note updated.', 'success');
        clearStudentMeta(selectedDate, [student.id]);
        loadSection(classId, sectionId, selectedDate);
      },
      (msg) => pushToast(msg || 'Failed to update note.', 'error'),
    );
  }, [students, selectedDate, patchMark, updateStudent, pushToast, loadSection, clearStudentMeta]);

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
      () => {
        pushToast('Note deleted.', 'success');
        clearStudentMeta(selectedDate, [student.id]);
        loadSection(classId, sectionId, selectedDate);
      },
      (msg) => pushToast(msg || 'Failed to delete note.', 'error'),
    );
  }, [students, selectedDate, patchMark, updateStudent, pushToast, loadSection, clearStudentMeta]);

  const handleReset = useCallback(async (classId: number, sectionId: number) => {
    // Issue #9: Reset must wipe today's attendance state on the server too,
    // not just refetch. Send an explicit clear payload (status -> present
    // baseline, sign_in/out cleared) for every loaded student in the section,
    // then re-fetch to mirror server truth.
    const key = `${classId}-${sectionId}`;
    const sectionStudents = students[key] ?? [];
    if (sectionStudents.length === 0) {
      loadSection(classId, sectionId, selectedDate);
      return;
    }
    const marks = sectionStudents.map((s) => ({
      student_id: s.id,
      date: selectedDate,
      class_id: classId,
      section_id: sectionId,
      status: 'present' as const,
      absent_reason: '',
      arrival_time: '',
      sign_in_time: '',
      sign_out_time: '',
      pickup_time: '',
      pickup_by: '',
      note: '',
    }));
    // Optimistically clear the UI so the student rows revert immediately.
    sectionStudents.forEach((s) => {
      updateStudent(classId, sectionId, {
        ...s,
        status: 'unmarked' as AttendanceStatus,
        absent_reason: null,
        arrival_time: null,
        sign_in_time: null,
        sign_out_time: null,
        pickup_time: null,
        pickup_by: null,
        notes: [],
        notes_count: 0,
      }, selectedDate);
    });
    // Issue #3: also wipe runtime localStorage meta so a refetch (or accordion
    // re-open) doesn't replay the pre-reset sign-in/out times.
    clearStudentMeta(selectedDate, sectionStudents.map((s) => s.id));
    await new Promise<void>((resolve) => {
      saveBulk(
        marks,
        () => { pushToast('Section attendance reset.', 'success'); resolve(); },
        (msg) => { pushToast(msg || 'Failed to reset attendance.', 'error'); resolve(); },
      );
    });
    loadSection(classId, sectionId, selectedDate);
  }, [students, selectedDate, saveBulk, updateStudent, pushToast, loadSection, clearStudentMeta]);

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
        // Issue #1: marking present must auto sign-in + arrival.
        const update: Student = {
          ...s,
          status: 'present',
          sign_in_time: s.sign_in_time ?? now,
          arrival_time: s.arrival_time ?? s.sign_in_time ?? now,
        };
        updateStudent(classId, sec.id, update, selectedDate);
        touched += 1;
      });
      const marks = targets.map((s) => ({
        student_id: s.id, date: selectedDate, class_id: classId, section_id: sec.id,
        status: 'present' as const,
        sign_in_time: s.sign_in_time ?? now,
        arrival_time: s.arrival_time ?? s.sign_in_time ?? now,
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
        allVisibleMarked={(() => {
          // Issue #4: disable header bulk action when every visible (loaded) student is already marked.
          const visible = Array.from(openClasses).flatMap((classId) => {
            const cls = classes.find((c) => c.id === classId);
            if (!cls) return [] as Student[];
            const sectionId = activeSections[classId] ?? cls.sections[0]?.id;
            if (!sectionId) return [] as Student[];
            return students[`${classId}-${sectionId}`] ?? [];
          });
          if (visible.length === 0) return false;
          return visible.every((s) => s.status === 'present' || s.status === 'absent' || s.status === 'late');
        })()}
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
            initialNote={mode === 'add' ? '' : (notesStudent.notes[0]?.text ?? '')}
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
          onMarkAbsent={(reason) => {
            // Issue #8: admin rejected the custom reason and chose to mark absent.
            commitStudentStatus(
              lateDialogState.classId,
              lateDialogState.sectionId,
              lateDialogState.student,
              'absent',
              reason || undefined,
              { signInTime: null },
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
      <ConfirmDialogHost />
      <ExportOptionsDialogHost />
    </div>
  );
}
