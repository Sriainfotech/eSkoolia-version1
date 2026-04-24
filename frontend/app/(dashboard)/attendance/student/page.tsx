'use client';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
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

export default function StudentAttendancePage() {
  const router = useRouter();
  const today = formatDate(new Date());

  // -- Date & filters -------------------------------------------
  const [selectedDate, setSelectedDate] = useState<string>(() => formatDate(new Date()));
  const [academicYear, setAcademicYear] = useState('2025-26');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');

  // -- Date mode ------------------------------------------------
  const dateMode: 'today' | 'past' | 'future' = useMemo(() => {
    if (selectedDate === today) return 'today';
    if (selectedDate < today) return 'past';
    return 'future';
  }, [selectedDate, today]);

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
  const [absentDialogState, setAbsentDialogState] = useState<{ classId: number; sectionId: number; student: Student } | null>(null);
  const [lateDialogState, setLateDialogState] = useState<{ classId: number; sectionId: number; student: Student } | null>(null);
  const [notesDialogState, setNotesDialogState] = useState<{ classId: number; sectionId: number; studentId: number; mode: 'add' | 'view' } | null>(null);

  // -- Data hooks -----------------------------------------------
  const { classes, loading: classesLoading } = useClasses(selectedDate);
  const { students, loading: studentsLoading, loadSection, updateStudent, clearStudents } = useStudents();
  const { kpis: backendKpis, exportAttendance, patchMark, saveBulk, downloadSampleTemplate } = useAttendance(selectedDate);

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

  const handleExportCsv = useCallback(() => {
    const allStudents = Object.values(students).flat();

    if (allStudents.length === 0) {
      pushToast('No loaded student data to export. Open a class section first.', 'error');
      return;
    }

    const backendExportSupported = exportAttendance('all');
    if (backendExportSupported) {
      pushToast('Export started.', 'success');
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
    ) => {
      const nextStudent = {
        ...student,
        status: newStatus,
        absent_reason: absentReason ?? null,
      };
      updateStudent(classId, sectionId, nextStudent);
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
        () => pushToast('Attendance updated.', 'success'),
        () => {
          updateStudent(classId, sectionId, student);
          pushToast('Failed to update attendance.', 'error');
        },
      );
    },
    [selectedDate, patchMark, updateStudent, pushToast],
  );

  const handleToggleAbsent = useCallback((classId: number, sectionId: number, student: Student) => {
    if (isReadOnly) return;
    if (student.status === 'absent') {
      commitStudentStatus(classId, sectionId, student, 'present');
      return;
    }
    setAbsentDialogState({ classId, sectionId, student });
  }, [isReadOnly, commitStudentStatus]);

  const handleToggleLunch = useCallback((classId: number, sectionId: number, student: Student) => {
    const newLunch = !student.lunch;
    updateStudent(classId, sectionId, { ...student, lunch: newLunch });
    patchMark(
      student.id,
      { student_id: student.id, date: selectedDate, class_id: classId, section_id: sectionId, lunch: newLunch },
      () => pushToast('Lunch status updated.', 'success'),
      () => {
        updateStudent(classId, sectionId, student);
        pushToast('Failed to update lunch status.', 'error');
      },
    );
  }, [selectedDate, patchMark, updateStudent, pushToast]);

  const handleSignIn = useCallback((classId: number, sectionId: number, student: Student) => {
    const now = new Date().toTimeString().slice(0, 5);
    // Optimistic update ΓÇö sign_in_time is frontend-only (not a Django model field)
    updateStudent(classId, sectionId, { ...student, sign_in_time: now, status: 'present' });
    // Only save attendance status to backend (no sign_in_time ΓÇö field doesn't exist on model)
    patchMark(
      student.id,
      { student_id: student.id, date: selectedDate, class_id: classId, section_id: sectionId, status: 'present' },
      () => pushToast('Sign-in saved.', 'success'),
      () => pushToast('Failed to save sign-in.', 'error'),
    );
  }, [selectedDate, patchMark, updateStudent, pushToast]);

  const handleSignOut = useCallback((classId: number, sectionId: number, student: Student) => {
    const now = new Date().toTimeString().slice(0, 5);
    // Optimistic update ΓÇö sign_out_time is frontend-only (not a Django model field)
    updateStudent(classId, sectionId, { ...student, sign_out_time: now });
  }, [updateStudent]);

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
      updateStudent(classId, sectionId, update);
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
    const now = new Date().toTimeString().slice(0, 5);
    const marks = (students[key] ?? [])
      .filter((s) => ids.has(s.id))
      .map((s) => ({ student_id: s.id, date: selectedDate, class_id: classId, section_id: sectionId, sign_in_time: now }));
    saveBulk(
      marks,
      (saved) => pushToast(`${saved} sign-in record(s) saved.`, 'success'),
      () => pushToast('Failed to save bulk sign-in.', 'error'),
    );
  }, [selectedRows, students, selectedDate, saveBulk, pushToast]);

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
    updateStudent(classId, sectionId, { ...student, notes: updatedNotes, notes_count: updatedNotes.length });
    patchMark(
      student.id,
      { student_id: student.id, date: selectedDate, class_id: classId, section_id: sectionId, note: noteText },
      () => pushToast('Note saved.', 'success'),
      () => pushToast('Failed to save note.', 'error'),
    );
    setNotesDialogState(null);
  }, [students, selectedDate, patchMark, updateStudent, pushToast]);

  const handleUpdateNote = useCallback((classId: number, sectionId: number, studentId: number, noteId: string, newText: string) => {
    const key = `${classId}-${sectionId}`;
    const student = students[key]?.find((s) => s.id === studentId);
    if (!student) return;
    const updatedNotes = student.notes.map((n) => n.id === noteId ? { ...n, text: newText } : n);
    updateStudent(classId, sectionId, { ...student, notes: updatedNotes });
    const latest = updatedNotes[updatedNotes.length - 1];
    if (latest) {
      patchMark(
        student.id,
        { student_id: student.id, date: selectedDate, class_id: classId, section_id: sectionId, note: latest.text },
        () => pushToast('Note updated.', 'success'),
        () => pushToast('Failed to update note.', 'error'),
      );
    }
  }, [students, selectedDate, patchMark, updateStudent, pushToast]);

  const handleDeleteNote = useCallback((classId: number, sectionId: number, studentId: number, noteId: string) => {
    const key = `${classId}-${sectionId}`;
    const student = students[key]?.find((s) => s.id === studentId);
    if (!student) return;
    const updatedNotes = student.notes.filter((n) => n.id !== noteId);
    updateStudent(classId, sectionId, { ...student, notes: updatedNotes, notes_count: updatedNotes.length });
    if (updatedNotes.length === 0) {
      patchMark(
        student.id,
        { student_id: student.id, date: selectedDate, class_id: classId, section_id: sectionId, note: '' },
        () => pushToast('Note deleted.', 'success'),
        () => pushToast('Failed to delete note.', 'error'),
      );
    }
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
    const now = new Date().toTimeString().slice(0, 5);
    cls.sections.forEach((sec) => {
      const key = `${classId}-${sec.id}`;
      const sectionStudents = students[key];
      if (!sectionStudents || sectionStudents.length === 0) return;
      sectionStudents.forEach((s) => {
        const update: Student = { ...s, status: 'present', sign_in_time: s.sign_in_time ?? now };
        updateStudent(classId, sec.id, update);
      });
      const marks = sectionStudents.map((s) => ({
        student_id: s.id, date: selectedDate, class_id: classId, section_id: sec.id,
        status: 'present' as const, sign_in_time: s.sign_in_time ?? now,
      }));
      saveBulk(marks, () => {}, () => {});
    });
    pushToast(`All students in ${cls.display_label} marked present.`, 'success');
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
        onImport={() => router.push('/attendance/student/import')}
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

      <AttendanceKPIs data={kpis} selectedDate={selectedDate} today={today} />

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
            commitStudentStatus(
              absentDialogState.classId,
              absentDialogState.sectionId,
              absentDialogState.student,
              'absent',
            );
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
          minutesLate={lateDialogState.student.late_minutes || 1}
          initialMessage={lateDialogState.student.absent_reason ?? ''}
          onMarkLate={(message) => {
            commitStudentStatus(
              lateDialogState.classId,
              lateDialogState.sectionId,
              lateDialogState.student,
              'late',
              message || undefined,
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
            );
            setLateDialogState(null);
          }}
          onSkip={() => {
            commitStudentStatus(
              lateDialogState.classId,
              lateDialogState.sectionId,
              lateDialogState.student,
              'late',
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
    </div>
  );
}
