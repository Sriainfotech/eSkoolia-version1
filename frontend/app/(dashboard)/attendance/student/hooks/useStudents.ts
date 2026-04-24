'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Student, AttendanceStatus } from '../types';
import { getToken } from '../utils/attendanceHelpers';
import { API_BASE_URL } from '@/lib/api';

async function refreshAccessToken(): Promise<string | null> {
  const refresh = typeof window !== 'undefined'
    ? localStorage.getItem('school_erp_refresh_token') : null;
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.access) {
      localStorage.setItem('school_erp_access_token', data.access);
      return data.access;
    }
    return null;
  } catch {
    return null;
  }
}

const AVATAR_COLORS = ['#4729F4','#0A8C5A','#B4721B','#C2264E','#7B61FF','#0891B2'];

function attendanceTypeToStatus(type: string | null): AttendanceStatus {
  if (type === 'P') return 'present';
  if (type === 'A') return 'absent';
  if (type === 'L') return 'late';
  return 'unmarked';
}

interface DjangoStudent {
  id: number;
  admission_no: string;
  roll_no: string;
  first_name: string;
  last_name: string;
  student_group?: { name: string } | null;
  attendance_type?: string | null;
  attendance_note?: string | null;
  lunch?: boolean;
}

function mapDjangoStudentToStudent(raw: DjangoStudent): Student {
  const full_name = `${raw.first_name} ${raw.last_name}`.trim();
  const initials = [raw.first_name[0], raw.last_name[0]].filter(Boolean).join('').toUpperCase();
  const color_seed = (raw.id % AVATAR_COLORS.length);
  return {
    id: raw.id,
    admission_no: raw.admission_no ?? '',
    roll_no: raw.roll_no ?? '',
    full_name,
    initials,
    avatar_color: AVATAR_COLORS[color_seed],
    group: raw.student_group?.name ?? '',
    synced_from_app: false,
    rte_pct: null,
    status: attendanceTypeToStatus(raw.attendance_type ?? null),
    absent_reason: raw.attendance_note ?? null,
    arrival_time: null,
    is_late: raw.attendance_type === 'L',
    late_minutes: 0,
    sign_in_time: (raw.attendance_type === 'P' || raw.attendance_type === 'L') ? '—' : null,
    sign_out_time: null,
    pickup_time: null,
    pickup_by: null,
    lunch: raw.lunch ?? false,
    notes_count: raw.attendance_note ? 1 : 0,
    notes: raw.attendance_note
      ? [{ id: 'server-note', text: raw.attendance_note, created_at: '' }]
      : [],
  };
}

export function useStudents() {
  const router = useRouter();
  const [students, setStudents] = useState<Record<string, Student[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string>>({});

  const loadSection = useCallback(async (
    classId: number,
    sectionId: number,
    date: string,
  ) => {
    const key = `${classId}-${sectionId}`;
    setLoading((p) => ({ ...p, [key]: true }));
    setError((p) => { const n = { ...p }; delete n[key]; return n; });

    const fetchWithToken = async (token: string): Promise<void> => {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/attendance/student-attendance/student-search/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ class_id: classId, section_id: sectionId, attendance_date: date }),
        }
      );
      if (res.status === 401) {
        const newToken = await refreshAccessToken();
        if (!newToken) { router.push('/login'); return; }
        return fetchWithToken(newToken);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { students?: DjangoStudent[] } = await res.json();
      const list: DjangoStudent[] = data.students ?? [];
      setStudents((p) => ({ ...p, [key]: list.map(mapDjangoStudentToStudent) }));
    };

    try {
      await fetchWithToken(getToken());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError((p) => ({ ...p, [key]: msg }));
    } finally {
      setLoading((p) => ({ ...p, [key]: false }));
    }
  }, [router]);

  const updateStudent = useCallback((classId: number, sectionId: number, updated: Student) => {
    const key = `${classId}-${sectionId}`;
    setStudents((p) => ({
      ...p,
      [key]: (p[key] ?? []).map((s) => s.id === updated.id ? updated : s),
    }));
  }, []);

  // Clear all cached student data (called on date change so stale data is never shown)
  const clearStudents = useCallback(() => {
    setStudents({});
    setLoading({});
    setError({});
  }, []);

  return { students, loading, error, loadSection, updateStudent, clearStudents };
}
