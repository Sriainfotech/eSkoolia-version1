'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { AttendanceMark, KPIData } from '../types';
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

function statusToAttendanceType(status: string): string {
  if (status === 'present') return 'P';
  if (status === 'absent') return 'A';
  if (status === 'late') return 'L';
  return 'P';
}

async function downloadSampleTemplateWithToken(token: string, router: ReturnType<typeof useRouter>): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/attendance/student-attendance/download-sample/`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) { router.push('/login'); return; }
    return downloadSampleTemplateWithToken(newToken, router);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'student_attendance_sheet.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function mapSummaryToKpis(data: {
  total_students: number;
  present: number;
  absent: number;
  late: number;
  unmarked: number;
}) {
  const total = data.total_students || 0;
  const present = data.present || 0;
  const absent = data.absent || 0;
  const late = data.late || 0;
  return {
    total_students: total,
    present_today: present,
    absent_today: absent,
    late_today: late,
    classes_marked: 0,
    total_classes: 0,
    present_pct: total > 0 ? Math.round((present / total) * 100) : 0,
    weekly_avg_pct: total > 0 ? Math.round((present / total) * 100) : 0,
    chronic_absentees: 0,
    rte_at_risk: 0,
    absent_with_reason: 0,
    late_student_name: null,
    late_minutes: null,
    delta_pct: 0,
  };
}

async function storeAttendance(
  token: string,
  date: string,
  marks: AttendanceMark[],
  router: ReturnType<typeof useRouter>,
): Promise<{ saved: number }> {
  if (marks.length === 0) return { saved: 0 };

  const attendance: Record<number, string> = {};
  const note: Record<number, string> = {};
  const lunch: Record<number, boolean> = {};
  for (const m of marks) {
    if (m.status) attendance[m.student_id] = statusToAttendanceType(m.status);
    if (m.note) note[m.student_id] = m.note;
    if (m.absent_reason && !m.note) note[m.student_id] = m.absent_reason;
    if (m.lunch !== undefined) lunch[m.student_id] = m.lunch;
  }

  const body = {
    date,
    id: marks.map((m) => m.student_id),
    class_id: marks[0]?.class_id,
    section_id: marks[0]?.section_id,
    attendance,
    note,
    lunch,
    lock_attendance: false,
  };

  const res = await fetch(`${API_BASE_URL}/api/v1/attendance/student-attendance/store/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) { router.push('/login'); return { saved: 0 }; }
    return storeAttendance(newToken, date, marks, router);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { saved: marks.length };
}

export function useAttendance(date: string) {
  const router = useRouter();
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch school-wide daily summary whenever the date changes
  useEffect(() => {
    let cancelled = false;
    async function fetchSummary() {
      setKpisLoading(true);
      try {
        const token = getToken();
        const res = await fetch(
          `${API_BASE_URL}/api/v1/attendance/student-attendance/daily-summary/?date=${date}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.status === 401) {
          const newToken = await refreshAccessToken();
          if (!newToken) { router.push('/login'); return; }
          const res2 = await fetch(
            `${API_BASE_URL}/api/v1/attendance/student-attendance/daily-summary/?date=${date}`,
            { headers: { Authorization: `Bearer ${newToken}` } },
          );
          if (!cancelled && res2.ok) {
            const data = await res2.json();
            setKpis(mapSummaryToKpis(data));
          }
          return;
        }
        if (!cancelled && res.ok) {
          const data = await res.json();
          setKpis(mapSummaryToKpis(data));
        }
      } catch {
        // silently fail — KPI cards will show skeleton
      } finally {
        if (!cancelled) setKpisLoading(false);
      }
    }
    fetchSummary();
    return () => { cancelled = true; };
  }, [date, router]);

  const patchMark = useCallback(async (
    studentId: number,
    payload: Partial<AttendanceMark>,
    onSuccess?: () => void,
    onError?: () => void,
  ) => {
    setSaving(true);
    try {
      const token = getToken();
      const mark: AttendanceMark = { student_id: studentId, date, ...payload };
      await storeAttendance(token, date, [mark], router);
      onSuccess?.();
    } catch {
      onError?.();
    } finally {
      setSaving(false);
    }
  }, [date, router]);

  const saveBulk = useCallback(async (
    marks: AttendanceMark[],
    onSuccess?: (saved: number) => void,
    onError?: (msg: string) => void,
  ) => {
    if (marks.length === 0) { onSuccess?.(0); return; }
    setSaving(true);
    try {
      const token = getToken();
      const result = await storeAttendance(token, date, marks, router);
      onSuccess?.(result.saved);
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [date, router]);

  // Export endpoint does not exist in the backend
  const exportAttendance = useCallback((_classId: string) => false, []);

  const downloadSampleTemplate = useCallback(async (
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) => {
    try {
      const token = getToken();
      await downloadSampleTemplateWithToken(token, router);
      onSuccess?.();
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : 'Failed to download sample file');
    }
  }, [router]);

  return { kpis, kpisLoading, saving, patchMark, saveBulk, exportAttendance, downloadSampleTemplate };
}
