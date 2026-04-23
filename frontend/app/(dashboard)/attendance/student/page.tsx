'use client';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { Student, LevelFilter, AttendanceStatus } from './types';
import { formatDate } from './utils/attendanceHelpers';
import { useClasses } from './hooks/useClasses';
import { useStudents } from './hooks/useStudents';
import { useAttendance } from './hooks/useAttendance';

import AttendancePageHeader from './components/AttendancePageHeader';
import AttendanceAlert from './components/AttendanceAlert';
import AttendanceKPIs from './components/AttendanceKPIs';
import AttendanceFilterBar from './components/AttendanceFilterBar';
import GlobalControls from './components/GlobalControls';
import ClassAccordionGrid from './components/ClassAccordionGrid';
import MonthlyReport from './components/MonthlyReport';

export default function StudentAttendancePage() {
  // ── Date & filters ──────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(() => formatDate(new Date()));
  const [academicYear, setAcademicYear] = useState('2025-26');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');

  // ── Accordion state ─────────────────────────────────────────────
  const [openClasses, setOpenClasses] = useState<Set<number>>(new Set());
  const [activeSections, setActiveSections] = useState<Record<number, number>>({});
  const [selectedRows, setSelectedRows] = useState<Record<string, Set<number>>>({});

  // ── Data hooks ──────────────────────────────────────────────────
  const { classes, loading: classesLoading } = useClasses(selectedDate);
  const { students, loading: studentsLoading, loadSection, updateStudent } = useStudents();
  const { exportAttendance, patchMark, saveBulk } = useAttendance(selectedDate);

  // Compute KPIs from all loaded student sections
  const kpis = useMemo(() => {
    const allStudents = Object.values(students).flat();
    if (allStudents.length === 0) return null;
    const present = allStudents.filter((s) => s.status === 'present').length;
    const absent = allStudents.filter((s) => s.status === 'absent').length;
    const late = allStudents.filter((s) => s.status === 'late').length;
    const total = allStudents.length;
    const lateStudent = allStudents.find((s) => s.status === 'late') ?? null;
    return {
      total_students: total,
      present_today: present,
      absent_today: absent,
      late_today: late,
      classes_marked: classes.filter((c) =>
        c.sections.some((sec) => {
          const key = `${c.id}-${sec.id}`;
          return (students[key]?.length ?? 0) > 0;
        })
      ).length,
      total_classes: classes.length,
      present_pct: total > 0 ? Math.round((present / total) * 100) : 0,
      weekly_avg_pct: total > 0 ? Math.round((present / total) * 100) : 0,
      chronic_absentees: 0,
      rte_at_risk: 0,
      absent_with_reason: 0,
      late_student_name: lateStudent?.full_name ?? null,
      late_minutes: lateStudent?.late_minutes ?? null,
      delta_pct: 0,
    };
  }, [students, classes]);

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
      const key = `${classId}-${sectionId}`;
      if (!students[key]) {
        loadSection(classId, sectionId, selectedDate);
      }
    });
  }, [openClasses, activeSections, classes, selectedDate, students, loadSection]);

  // ── Handlers ────────────────────────────────────────────────────
  const handleToggleClass = useCallback((classId: number) => {
    setOpenClasses((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId); else next.add(classId);
      return next;
    });
  }, []);

  const handleSectionChange = useCallback((classId: number, sectionId: number) => {
    setActiveSections((prev) => ({ ...prev, [classId]: sectionId }));
    const key = `${classId}-${sectionId}`;
    if (!students[key]) {
      loadSection(classId, sectionId, selectedDate);
    }
  }, [students, loadSection, selectedDate]);

  const handleSelectionChange = useCallback((key: string, ids: Set<number>) => {
    setSelectedRows((prev) => ({ ...prev, [key]: ids }));
  }, []);

  const handleDateChange = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedRows({});
  }, []);

  const handleToggleAbsent = useCallback((classId: number, sectionId: number, student: Student) => {
    const newStatus: AttendanceStatus = student.status === 'absent' ? 'present' : 'absent';
    updateStudent(classId, sectionId, { ...student, status: newStatus });
    patchMark(
      student.id,
      { student_id: student.id, date: selectedDate, status: newStatus },
      undefined,
      () => updateStudent(classId, sectionId, student),
    );
  }, [selectedDate, patchMark, updateStudent]);

  const handleToggleLunch = useCallback((classId: number, sectionId: number, student: Student) => {
    const newLunch = !student.lunch;
    updateStudent(classId, sectionId, { ...student, lunch: newLunch });
    patchMark(
      student.id,
      { student_id: student.id, date: selectedDate, lunch: newLunch },
      undefined,
      () => updateStudent(classId, sectionId, student),
    );
  }, [selectedDate, patchMark, updateStudent]);

  const handleSignIn = useCallback((classId: number, sectionId: number, student: Student) => {
    const now = new Date().toTimeString().slice(0, 5);
    // Optimistic update — sign_in_time is frontend-only (not a Django model field)
    updateStudent(classId, sectionId, { ...student, sign_in_time: now, status: 'present' });
    // Only save attendance status to backend (no sign_in_time — field doesn't exist on model)
    patchMark(
      student.id,
      { student_id: student.id, date: selectedDate, status: 'present' },
    );
  }, [selectedDate, patchMark, updateStudent]);

  const handleSignOut = useCallback((classId: number, sectionId: number, student: Student) => {
    const now = new Date().toTimeString().slice(0, 5);
    // Optimistic update — sign_out_time is frontend-only (not a Django model field)
    updateStudent(classId, sectionId, { ...student, sign_out_time: now });
  }, [updateStudent]);

  const handleBulkMark = useCallback((classId: number, sectionId: number, status: AttendanceStatus) => {
    const key = `${classId}-${sectionId}`;
    const ids = selectedRows[key] ?? new Set<number>();
    const sectionStudents = students[key] ?? [];
    const marks = sectionStudents
      .filter((s) => ids.has(s.id))
      .map((s) => ({ student_id: s.id, date: selectedDate, status }));
    saveBulk(marks);
    setSelectedRows((prev) => ({ ...prev, [key]: new Set() }));
  }, [selectedRows, students, selectedDate, saveBulk]);

  const handleBulkSignIn = useCallback((classId: number, sectionId: number) => {
    const key = `${classId}-${sectionId}`;
    const ids = selectedRows[key] ?? new Set<number>();
    const now = new Date().toTimeString().slice(0, 5);
    const marks = (students[key] ?? [])
      .filter((s) => ids.has(s.id))
      .map((s) => ({ student_id: s.id, date: selectedDate, sign_in_time: now }));
    saveBulk(marks);
  }, [selectedRows, students, selectedDate, saveBulk]);

  const handleSave = useCallback((classId: number, sectionId: number) => {
    const key = `${classId}-${sectionId}`;
    const marks = (students[key] ?? []).map((s) => ({
      student_id: s.id, date: selectedDate, status: s.status, lunch: s.lunch,
    }));
    saveBulk(marks);
  }, [students, selectedDate, saveBulk]);

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

  return (
    <div className="p-6 bg-[#F0EFFE] min-h-full overflow-x-hidden">
      <AttendancePageHeader
        onImport={() => {}}
        onExport={() => exportAttendance('all')}
      />

      {kpis && kpis.rte_at_risk > 0 && (
        <AttendanceAlert count={kpis.rte_at_risk} />
      )}

      <AttendanceKPIs data={kpis} />

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
        />
      )}

      <MonthlyReport />
    </div>
  );
}
