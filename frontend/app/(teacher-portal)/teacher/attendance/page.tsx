'use client';

/**
 * Teacher Portal — Attendance Page (Sprint 5)
 *
 * Reuses admin attendance components 1-to-1:
 *   GlobalControls  → week strip, search, filters, mark-all
 *   AttendanceTable → student rows with all status/sign-in/lunch/notes columns
 *   BulkActionBar   → selected-row bulk actions
 *   LateCommerDialog, AbsentNoteDialog, NotesModal, ViewNotesModal → modals
 *
 * Scope: only the class+section where the teacher is the class teacher.
 * API:   /api/v1/teacher/attendance/students/ (fetch)
 *        /api/v1/teacher/attendance/store/    (save)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { fetchTeacherMe, type TeacherMe } from '@/lib/api/teacher';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

// ── Admin attendance components (reused unchanged) ────────────────────────────
import GlobalControls from '@/app/(dashboard)/attendance/student/components/GlobalControls';
import AttendanceTable from '@/app/(dashboard)/attendance/student/components/AttendanceTable';
import BulkActionBar from '@/app/(dashboard)/attendance/student/components/BulkActionBar';
import AttendanceKPIs from '@/app/(dashboard)/attendance/student/components/AttendanceKPIs';
import LateCommerDialog from '@/app/(dashboard)/attendance/student/components/LateCommerDialog';
import AbsentNoteDialog from '@/app/(dashboard)/attendance/student/components/AbsentNoteDialog';
import NotesModal from '@/app/(dashboard)/attendance/student/components/NotesModal';
import ViewNotesModal from '@/app/(dashboard)/attendance/student/components/ViewNotesModal';
import type { Student, AttendanceStatus, KPIData } from '@/app/(dashboard)/attendance/student/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const AVATAR_COLORS = ['#4729F4', '#0A8C5A', '#B4721B', '#C2264E', '#7B61FF', '#0891B2'];

function statusToType(s: AttendanceStatus): string {
  if (s === 'present') return 'P';
  if (s === 'absent') return 'A';
  if (s === 'late') return 'L';
  return 'P';
}

function typeToStatus(t: string | null): AttendanceStatus {
  if (t === 'P') return 'present';
  if (t === 'A') return 'absent';
  if (t === 'L') return 'late';
  return 'unmarked';
}

// ── localStorage runtime meta (sign-in/out times survive hot-reload) ─────────

const LS_KEY = (date: string) => `teacher-att-meta:${date}`;

function readMeta(date: string): Record<number, Partial<Student>> {
  try { return JSON.parse(localStorage.getItem(LS_KEY(date)) || '{}'); } catch { return {}; }
}
function writeMeta(date: string, id: number, patch: Partial<Student>) {
  const m = readMeta(date);
  m[id] = { ...m[id], ...patch };
  localStorage.setItem(LS_KEY(date), JSON.stringify(m));
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchWithRefresh(url: string, opts: RequestInit): Promise<Response> {
  const token = getAccessToken();
  const res = await fetch(url, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${token}` } });
  if (res.status !== 401) return res;
  // Try refresh
  const refresh = typeof window !== 'undefined' ? localStorage.getItem('school_erp_refresh_token') : null;
  if (!refresh) return res;
  const rr = await fetch(`${API_BASE_URL}/api/v1/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!rr.ok) return res;
  const rd = await rr.json();
  if (rd.access) localStorage.setItem('school_erp_access_token', rd.access);
  return fetch(url, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${rd.access}` } });
}

interface RawStudent {
  id: number;
  admission_no: string;
  roll_no: string;
  first_name: string;
  last_name: string;
  attendance_type?: string | null;
  attendance_note?: string | null;
  arrival_time?: string | null;
  sign_in_time?: string | null;
  sign_out_time?: string | null;
  pickup_time?: string | null;
  pickup_by?: string | null;
  lunch?: boolean;
}

function mapRaw(raw: RawStudent, date: string): Student {
  const full_name = `${raw.first_name} ${raw.last_name}`.trim();
  const initials = [raw.first_name[0], raw.last_name[0]].filter(Boolean).join('').toUpperCase();
  const meta = readMeta(date)[raw.id] ?? {};
  return {
    id: raw.id,
    admission_no: raw.admission_no ?? '',
    roll_no: raw.roll_no ?? '',
    full_name,
    initials,
    avatar_color: AVATAR_COLORS[raw.id % AVATAR_COLORS.length],
    group: '',
    synced_from_app: false,
    rte_pct: null,
    status: typeToStatus(raw.attendance_type ?? null),
    absent_reason: raw.attendance_note ?? null,
    arrival_time: (meta.arrival_time !== undefined ? meta.arrival_time : raw.arrival_time) ?? null,
    is_late: raw.attendance_type === 'L',
    late_minutes: 0,
    sign_in_time: (meta.sign_in_time !== undefined ? meta.sign_in_time : raw.sign_in_time) ?? null,
    sign_out_time: (meta.sign_out_time !== undefined ? meta.sign_out_time : raw.sign_out_time) ?? null,
    pickup_time: (meta.pickup_time !== undefined ? meta.pickup_time : raw.pickup_time) ?? null,
    pickup_by: raw.pickup_by ?? null,
    lunch: meta.lunch !== undefined ? (meta.lunch as boolean) : (raw.lunch ?? false),
    notes_count: raw.attendance_note ? raw.attendance_note.split('|||').filter(Boolean).length : 0,
    notes: raw.attendance_note
      ? raw.attendance_note.split('|||').filter(Boolean).map((t, i) => ({ id: `n${i}`, text: t.trim(), created_at: '' }))
      : [],
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

// Build a deduplicated list of all class+section pairs the teacher is assigned to
type ViewClass = { class_id: number; class_name: string; section_id: number; section_name: string; is_ct: boolean };

function buildAllClasses(me: TeacherMe): ViewClass[] {
  const map = new Map<string, ViewClass>();
  if (me.class_teacher_for) {
    const ct = me.class_teacher_for;
    map.set(`${ct.class_id}-${ct.section_id}`, { ...ct, is_ct: true });
  }
  for (const subj of me.subject_assignments) {
    for (const sec of subj.sections) {
      const key = `${sec.class_id}-${sec.section_id}`;
      if (!map.has(key)) map.set(key, { ...sec, is_ct: false });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.class_id !== b.class_id ? a.class_id - b.class_id : a.section_name.localeCompare(b.section_name)
  );
}

export default function TeacherAttendancePage() {
  const router = useRouter();
  const [me, setMe] = useState<TeacherMe | null>(null);
  const [meLoading, setMeLoading] = useState(true);

  // Date & filter state
  const [selectedDate, setSelectedDate] = useState(fmt(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');

  // Currently viewed class (may differ from CT class — subject teachers can view)
  const [viewClass, setViewClass] = useState<ViewClass | null>(null);

  // Student data
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [canEdit, setCanEdit] = useState(false); // true only when teacher is CT of this class
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Modals
  const [absentDialog, setAbsentDialog] = useState<Student | null>(null);
  const [lateDialog, setLateDialog] = useState<Student | null>(null);
  const [notesModal, setNotesModal] = useState<Student | null>(null);
  const [viewNotesModal, setViewNotesModal] = useState<Student | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs so autoSave always reads the latest values without re-creating the callback
  const viewClassRef = useRef<ViewClass | null>(null);
  const canEditRef = useRef(false);
  useEffect(() => { viewClassRef.current = viewClass; }, [viewClass]);
  useEffect(() => { canEditRef.current = canEdit; }, [canEdit]);

  // Load teacher profile
  useEffect(() => {
    fetchTeacherMe()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setMeLoading(false));
  }, []);

  // Once me loads, default to CT class (or first subject class)
  useEffect(() => {
    if (!me || viewClass) return;
    const all = buildAllClasses(me);
    if (all.length > 0) setViewClass(all[0]);
  }, [me]); // eslint-disable-line

  const ct = me?.class_teacher_for ?? null;

  // Date guards
  const today = fmt(new Date());
  const isPastDate = selectedDate < today;
  const isFutureDate = selectedDate > today;
  // effectiveReadOnly: past dates OR backend says this teacher cannot edit this class
  const effectiveReadOnly = isLocked || isPastDate || !canEdit;

  // Load students for the currently selected class + date
  const loadStudents = useCallback(async (date: string, vc: ViewClass) => {
    if (date > fmt(new Date())) {
      setStudents([]);
      setIsLocked(false);
      setCanEdit(false);
      setSelectedIds(new Set());
      return;
    }
    setLoadingStudents(true);
    setSaveError(null);
    try {
      const res = await fetchWithRefresh(`${API_BASE_URL}/api/v1/teacher/attendance/students/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: vc.class_id, section_id: vc.section_id, date }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStudents((data.students ?? []).map((r: RawStudent) => mapRaw(r, date)));
      setIsLocked(data.is_locked ?? false);
      setCanEdit(data.can_edit ?? false);
      setSelectedIds(new Set());
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  }, [router]);

  useEffect(() => {
    if (viewClass) loadStudents(selectedDate, viewClass);
  }, [viewClass, selectedDate, loadStudents]);

  // Auto-save (debounced 800ms) — reads viewClass/canEdit via refs to stay stable
  const autoSave = useCallback(async (currentStudents: Student[], date: string) => {
    const vc = viewClassRef.current;
    if (!vc || !canEditRef.current) return;
    if (date !== fmt(new Date())) return;
    const marked = currentStudents.filter((s) => s.status !== 'unmarked');
    if (marked.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const attendance: Record<string, string> = {};
      const note: Record<string, string> = {};
      const lunch: Record<string, boolean> = {};
      const arrival_time: Record<string, string> = {};
      const sign_in_time: Record<string, string> = {};
      const sign_out_time: Record<string, string> = {};

      for (const s of marked) {
        const k = String(s.id);
        attendance[k] = statusToType(s.status);
        if (s.absent_reason) note[k] = s.absent_reason;
        lunch[k] = s.lunch;
        if (s.arrival_time) arrival_time[k] = s.arrival_time;
        if (s.sign_in_time) sign_in_time[k] = s.sign_in_time;
        if (s.sign_out_time) sign_out_time[k] = s.sign_out_time;
      }

      const res = await fetchWithRefresh(`${API_BASE_URL}/api/v1/teacher/attendance/store/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: vc.class_id,
          section_id: vc.section_id,
          date,
          id: marked.map((s) => s.id),
          attendance,
          note,
          lunch,
          arrival_time,
          sign_in_time,
          sign_out_time,
          lock_attendance: false,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaveError(d.message || `Save failed (HTTP ${res.status})`);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, []); // stable — reads fresh values via refs

  const scheduleAutoSave = useCallback((updatedStudents: Student[], date: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => autoSave(updatedStudents, date), 800);
  }, [autoSave]);

  // Update a single student (optimistic) + persist to localStorage meta + schedule auto-save
  const updateStudent = useCallback((updated: Student) => {
    writeMeta(selectedDate, updated.id, {
      sign_in_time: updated.sign_in_time,
      sign_out_time: updated.sign_out_time,
      arrival_time: updated.arrival_time,
      lunch: updated.lunch,
    });
    setStudents((prev) => {
      const next = prev.map((s) => s.id === updated.id ? updated : s);
      scheduleAutoSave(next, selectedDate);
      return next;
    });
  }, [selectedDate, scheduleAutoSave]);

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const handleToggleAbsent = (student: Student) => {
    if (effectiveReadOnly) return;
    if (student.status === 'absent') {
      // Unmark absent → present
      updateStudent({ ...student, status: 'present', absent_reason: null });
    } else {
      // Opening absent dialog
      setAbsentDialog(student);
    }
  };

  const handleAbsentConfirm = (reason: string) => {
    if (!absentDialog) return;
    const note = reason || null;
    updateStudent({
      ...absentDialog,
      status: 'absent',
      absent_reason: note,
      notes_count: note ? 1 : 0,
      notes: note ? [{ id: 'n0', text: note, created_at: '' }] : [],
    });
    setAbsentDialog(null);
  };

  const handleToggleLunch = (student: Student) => {
    if (effectiveReadOnly) return;
    updateStudent({ ...student, lunch: !student.lunch });
  };

  const handleSignIn = (student: Student) => {
    if (effectiveReadOnly) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    // If arrival time not set, use sign-in time as arrival
    const updated = {
      ...student,
      sign_in_time: time,
      arrival_time: student.arrival_time ?? time,
      status: 'present' as AttendanceStatus,
    };
    // Check if late (more than 5 min after earliest sign-in)
    const earliest = students
      .filter((s) => s.sign_in_time && s.status !== 'absent')
      .map((s) => s.sign_in_time!)
      .sort()[0];
    if (earliest) {
      const [eh, em] = earliest.split(':').map(Number);
      const [nh, nm] = time.split(':').map(Number);
      const diff = (nh * 60 + nm) - (eh * 60 + em);
      if (diff >= 10) {
        setLateDialog({ ...updated, late_minutes: diff });
        updateStudent(updated);
        return;
      }
    }
    updateStudent(updated);
  };

  const handleSignOut = (student: Student) => {
    if (effectiveReadOnly) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    updateStudent({ ...student, sign_out_time: time });
  };

  const handleLateMarkLate = (message: string) => {
    if (!lateDialog) return;
    updateStudent({ ...lateDialog, status: 'late', absent_reason: message, is_late: true });
    setLateDialog(null);
  };

  const handleLateSchoolApproved = (reason: string) => {
    if (!lateDialog) return;
    updateStudent({ ...lateDialog, status: 'present', absent_reason: `School approved: ${reason}`, is_school_approved_late: true });
    setLateDialog(null);
  };

  const handleEditStatusPrompt = (student: Student) => {
    if (effectiveReadOnly) return;
    if (student.status === 'absent') setAbsentDialog(student);
    else if (student.status === 'late') setLateDialog(student);
  };

  const handleEditNote = (student: Student) => {
    if (effectiveReadOnly) return;
    setNotesModal(student);
  };

  const handleSaveNote = (student: Student, note: string) => {
    updateStudent({ ...student, absent_reason: note, notes_count: 1, notes: [{ id: 'n0', text: note, created_at: '' }] });
    setNotesModal(null);
  };

  const handleDeleteNote = (student: Student) => {
    if (effectiveReadOnly) return;
    updateStudent({ ...student, absent_reason: null, notes_count: 0, notes: [] });
  };

  const handleViewNotes = (student: Student) => setViewNotesModal(student);

  const handleEditNoteFromView = (noteId: string, newText: string) => {
    if (!viewNotesModal) return;
    const updated = { ...viewNotesModal, absent_reason: newText, notes: viewNotesModal.notes.map((n) => n.id === noteId ? { ...n, text: newText } : n) };
    updateStudent(updated);
    setViewNotesModal(updated);
  };

  const handleDeleteNoteFromView = (noteId: string) => {
    if (!viewNotesModal) return;
    const updated = { ...viewNotesModal, notes: viewNotesModal.notes.filter((n) => n.id !== noteId), notes_count: viewNotesModal.notes_count - 1, absent_reason: null };
    updateStudent(updated);
    setViewNotesModal(updated);
  };

  // Selection
  const handleSelect = (id: number, checked: boolean) => {
    setSelectedIds((prev) => { const next = new Set(prev); checked ? next.add(id) : next.delete(id); return next; });
  };
  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(filteredStudents.map((s) => s.id)) : new Set());
  };

  // Mark-all visible
  const handleMarkAllVisible = (status: 'present' | 'absent' | 'late') => {
    if (effectiveReadOnly) return;
    setStudents((prev) => {
      const next = prev.map((s) => {
        if (!filteredIds.has(s.id)) return s;
        return { ...s, status, absent_reason: status === 'absent' ? 'No intimation' : null, is_late: status === 'late' };
      });
      scheduleAutoSave(next, selectedDate);
      return next;
    });
  };

  // Bulk actions
  const handleBulkMark = (status: 'present' | 'absent' | 'late') => {
    if (effectiveReadOnly) return;
    setStudents((prev) => {
      const next = prev.map((s) => {
        if (!selectedIds.has(s.id)) return s;
        return { ...s, status, absent_reason: status === 'absent' ? 'No intimation' : null, is_late: status === 'late' };
      });
      scheduleAutoSave(next, selectedDate);
      return next;
    });
    setSelectedIds(new Set());
  };

  const handleBulkSignIn = () => {
    if (effectiveReadOnly) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setStudents((prev) => {
      const next = prev.map((s) => {
        if (!selectedIds.has(s.id)) return s;
        return { ...s, status: 'present' as AttendanceStatus, sign_in_time: time, arrival_time: s.arrival_time ?? time };
      });
      scheduleAutoSave(next, selectedDate);
      return next;
    });
    setSelectedIds(new Set());
  };

  // Filter students
  const filteredStudents = students.filter((s) => {
    if (searchQuery && !s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) && !s.roll_no.includes(searchQuery)) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });
  const filteredIds = new Set(filteredStudents.map((s) => s.id));

  const allVisibleMarked = filteredStudents.length > 0 && filteredStudents.every((s) => s.status !== 'unmarked');

  // Compute KPI data from local student state
  const presentCount = students.filter((s) => s.status === 'present').length;
  const absentCount  = students.filter((s) => s.status === 'absent').length;
  const lateCount    = students.filter((s) => s.status === 'late').length;
  const presentPct   = students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0;
  const kpiData: KPIData | null = loadingStudents || students.length === 0 ? null : {
    total_students:    students.length,
    present_today:     presentCount,
    absent_today:      absentCount,
    late_today:        lateCount,
    present_pct:       presentPct,
    delta_pct:         0,
    classes_marked:    allVisibleMarked ? 1 : 0,
    total_classes:     1,
    weekly_avg_pct:    0,
    chronic_absentees: 0,
    rte_at_risk:       0,
    absent_with_reason: students.filter((s) => s.status === 'absent' && s.absent_reason).length,
    late_student_name:  students.find((s) => s.status === 'late')?.full_name ?? null,
    late_minutes:       null,
    absent_delta:       0,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (meLoading) {
    return (
      <div style={{ padding: '32px 0' }}>
        <div style={{ height: 20, width: 200, borderRadius: 8, background: 'var(--line)', marginBottom: 12 }} />
        <div style={{ height: 32, width: 320, borderRadius: 8, background: 'var(--line)' }} />
      </div>
    );
  }

  const allClasses = me ? buildAllClasses(me) : [];

  if (!viewClass || allClasses.length === 0) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center', background: '#fff', border: '1px solid #E6E6EC', borderRadius: 14, padding: '48px 24px' }}>
        <Users size={32} color="#9CA0AE" style={{ marginBottom: 12, opacity: 0.4 }} />
        <p style={{ fontSize: 15, fontWeight: 600, color: '#0B0B14', marginBottom: 6 }}>No classes assigned</p>
        <p style={{ fontSize: 13, color: '#9CA0AE', maxWidth: 340, margin: '0 auto' }}>
          You are not assigned to any class. Ask your admin to assign you as a class teacher or subject teacher.
        </p>
      </div>
    );
  }

  const allMarked = students.length > 0 && students.every((s) => s.status !== 'unmarked');

  return (
    <div>
      {/* ── Page Header (matching admin AttendancePageHeader style) ─────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{
            margin: 0,
            fontFamily: 'var(--font-instrument-serif), "Instrument Serif", Georgia, serif',
            fontSize: 32, fontWeight: 700, lineHeight: 1.15,
            letterSpacing: '-0.02em', color: '#0f172a',
          }}>
            Student{' '}
            <span style={{ color: '#6c3ce1', fontStyle: 'italic', fontWeight: 400, fontSize: 32 }}>
              Attendance
            </span>
          </h1>
          <p style={{ fontSize: 14, color: '#6B6B80', marginTop: 2 }}>
            Track and manage daily student attendance
          </p>
        </div>

        {/* Class selector — shown when teacher has multiple classes */}
        {allClasses.length > 1 && (
          <select
            value={`${viewClass.class_id}-${viewClass.section_id}`}
            onChange={(e) => {
              const found = allClasses.find(c => `${c.class_id}-${c.section_id}` === e.target.value);
              if (found) { setViewClass(found); setStudents([]); setSelectedIds(new Set()); }
            }}
            style={{
              height: 36, padding: '0 12px',
              fontSize: 12, fontWeight: 600, color: '#1A1A2E',
              background: '#fff', border: '1px solid #E6E6EC',
              borderRadius: 8, cursor: 'pointer', outline: 'none',
            }}
          >
            {allClasses.map(c => (
              <option key={`${c.class_id}-${c.section_id}`} value={`${c.class_id}-${c.section_id}`}>
                {c.class_name} – Section {c.section_name}{c.is_ct ? '' : ' (View only)'}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      <AttendanceKPIs data={kpiData} selectedDate={selectedDate} today={today} />

      {/* ── Week strip + search/filter controls ──────────────────────────────── */}
      <GlobalControls
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sectionFilter={sectionFilter}
        onSectionFilterChange={setSectionFilter}
        onMarkAllVisible={effectiveReadOnly ? () => {} : handleMarkAllVisible}
        allVisibleMarked={allVisibleMarked}
      />

      {/* ── Bulk action bar ───────────────────────────────────────────────────── */}
      {!effectiveReadOnly && (
        <BulkActionBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onMarkAll={handleBulkMark}
          onSignInAll={handleBulkSignIn}
        />
      )}

      {/* ── Class accordion card (matching admin ClassAccordionCard header) ───── */}
      <div style={{ background: '#fff', border: '1px solid #E6E6EC', borderRadius: 12, overflow: 'hidden' }}>

        {/* Header row */}
        <div style={{
          padding: '10px 20px',
          background: '#FAFAFD',
          borderBottom: '1px solid #F0F0F6',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0B0B14' }}>
            {viewClass.class_name}
          </span>

          <span style={{ fontSize: 11, color: '#9CA0AE' }}>
            {students.length} student{students.length !== 1 ? 's' : ''}
          </span>

          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: '#0A8C5A',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0A8C5A', display: 'inline-block' }} />
            {presentCount} present
          </span>

          {/* Section badge */}
          <span style={{
            padding: '2px 8px', borderRadius: 20,
            fontSize: 10, fontWeight: 700,
            background: '#EEF2FF', color: '#4338CA',
          }}>
            Section {viewClass.section_name}
          </span>

          {/* Attendance status */}
          {!isFutureDate && !isLocked && !isPastDate && (
            <span style={{
              padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
              background: allMarked ? '#ECFDF5' : '#FFF7ED',
              color: allMarked ? '#16A34A' : '#EA580C',
            }}>
              {allMarked ? '✓ All Marked' : 'Attendance Needed'}
            </span>
          )}
          {isLocked && (
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#FDF1DC', color: '#B4721B' }}>
              🔒 Locked — contact admin to unlock
            </span>
          )}
          {isPastDate && (
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#EEF2FF', color: '#4338CA' }}>
              👁 Past date — view only
            </span>
          )}
          {isFutureDate && (
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#FEF9EC', color: '#B45309' }}>
              ⚠ Future date
            </span>
          )}
          {!canEdit && !isPastDate && !isFutureDate && !isLocked && (
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#F4F4F8', color: '#5A5E70' }}>
              👁 View only
            </span>
          )}

          {/* % today + auto-save — pushed to the right */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {saving && !effectiveReadOnly && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#9CA0AE' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0A8C5A', display: 'inline-block' }} />
                Auto-saving
              </span>
            )}
            {saveError && (
              <span style={{ fontSize: 11, color: '#C2264E', fontWeight: 600 }}>⚠ {saveError}</span>
            )}
            <span style={{
              fontSize: 11, fontWeight: 800,
              color: presentPct >= 75 ? '#16A34A' : '#E11D48',
            }}>
              {presentPct}%{' '}today
            </span>
          </div>
        </div>

        {/* Student table */}
        <AttendanceTable
          students={filteredStudents}
          loading={loadingStudents}
          readOnly={effectiveReadOnly}
          showLiveStatus
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          onToggleAbsent={handleToggleAbsent}
          onToggleLunch={handleToggleLunch}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onViewNotes={handleViewNotes}
          onEditStatusPrompt={handleEditStatusPrompt}
          onEditNote={handleEditNote}
          onDeleteNote={handleDeleteNote}
        />
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {absentDialog && (
        <AbsentNoteDialog
          student={absentDialog}
          initialReason={absentDialog.absent_reason ?? ''}
          onConfirm={handleAbsentConfirm}
          onSkip={() => {
            // Still mark absent even if reason skipped
            updateStudent({ ...absentDialog, status: 'absent', absent_reason: null });
            setAbsentDialog(null);
          }}
        />
      )}

      {lateDialog && (
        <LateCommerDialog
          student={lateDialog}
          minutesLate={lateDialog.late_minutes}
          initialMessage={lateDialog.absent_reason ?? ''}
          onMarkLate={handleLateMarkLate}
          onSchoolApproved={handleLateSchoolApproved}
          onMarkAbsent={(reason) => {
            updateStudent({ ...lateDialog, status: 'absent', absent_reason: reason });
            setLateDialog(null);
          }}
          onSkip={() => setLateDialog(null)}
        />
      )}

      {notesModal && (
        <NotesModal
          student={notesModal}
          initialNote={notesModal.absent_reason ?? ''}
          onSave={handleSaveNote}
          onClose={() => setNotesModal(null)}
        />
      )}

      {viewNotesModal && (
        <ViewNotesModal
          student={viewNotesModal}
          onEditNote={effectiveReadOnly ? () => {} : handleEditNoteFromView}
          onDeleteNote={effectiveReadOnly ? () => {} : handleDeleteNoteFromView}
          onClose={() => setViewNotesModal(null)}
        />
      )}
    </div>
  );
}
