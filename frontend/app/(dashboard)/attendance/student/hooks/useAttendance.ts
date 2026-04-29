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

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.message === 'string' && data.message.trim()) return data.message;
    if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail;
  } catch {
    // Fall through to default message below.
  }
  return `HTTP ${res.status}`;
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
  absent_with_reason?: number;
  late: number;
  unmarked: number;
  rte_at_risk?: number;
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
    rte_at_risk: data.rte_at_risk ?? 0,
    absent_with_reason: data.absent_with_reason ?? 0,
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
  const arrival_time: Record<number, string> = {};
  const sign_in_time: Record<number, string> = {};
  const sign_out_time: Record<number, string> = {};
  const pickup_time: Record<number, string> = {};
  const pickup_by: Record<number, string> = {};
  for (const m of marks) {
    // Treat 'unmarked' (and any falsy/empty status) as "no opinion": don't include
    // it in the attendance map. Otherwise unmarked students would silently be
    // saved as Present, and the backend's "must mark all students" check would
    // sometimes also reject the payload.
    if (m.status && m.status !== 'unmarked') attendance[m.student_id] = statusToAttendanceType(m.status);
    if (m.note !== undefined) note[m.student_id] = m.note;
    if (m.absent_reason !== undefined && m.note === undefined) note[m.student_id] = m.absent_reason;
    if (m.lunch !== undefined) lunch[m.student_id] = m.lunch;
    // Allow explicit empty strings to CLEAR a time field (used by Reset).
    if (m.arrival_time !== undefined) arrival_time[m.student_id] = m.arrival_time;
    if (m.sign_in_time !== undefined) sign_in_time[m.student_id] = m.sign_in_time;
    if (m.sign_out_time !== undefined) sign_out_time[m.student_id] = m.sign_out_time;
    if (m.pickup_time !== undefined) pickup_time[m.student_id] = m.pickup_time;
    if (m.pickup_by !== undefined) pickup_by[m.student_id] = m.pickup_by;
  }

  // Only send the IDs of students we actually have something to say about,
  // so the backend's "status_count == len(id)" coverage check passes.
  const touchedIds = Array.from(new Set([
    ...Object.keys(attendance),
    ...Object.keys(note),
    ...Object.keys(lunch),
    ...Object.keys(arrival_time),
    ...Object.keys(sign_in_time),
    ...Object.keys(sign_out_time),
    ...Object.keys(pickup_time),
    ...Object.keys(pickup_by),
  ])).map((k) => Number(k));
  const ids = touchedIds.length > 0 ? touchedIds : marks.map((m) => m.student_id);
  if (ids.length === 0) return { saved: 0 };

  const body = {
    date,
    id: ids,
    class_id: marks[0]?.class_id,
    section_id: marks[0]?.section_id,
    attendance,
    note,
    lunch,
    arrival_time,
    sign_in_time,
    sign_out_time,
    pickup_time,
    pickup_by,
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

  if (!res.ok) {
    const msg = await extractErrorMessage(res);
    throw new Error(msg);
  }
  return { saved: ids.length };
}

export function useAttendance(date: string) {
  const router = useRouter();
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refreshSummary = useCallback(async () => {
    const token = getToken();
    const res = await fetch(
      `${API_BASE_URL}/api/v1/attendance/student-attendance/daily-summary/?date=${date}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        router.push('/login');
        return;
      }
      const retry = await fetch(
        `${API_BASE_URL}/api/v1/attendance/student-attendance/daily-summary/?date=${date}`,
        { headers: { Authorization: `Bearer ${newToken}` } },
      );
      if (retry.ok) {
        const data = await retry.json();
        setKpis(mapSummaryToKpis(data));
      }
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setKpis(mapSummaryToKpis(data));
    }
  }, [date, router]);

  // Fetch school-wide daily summary whenever the date changes
  useEffect(() => {
    let cancelled = false;
    async function fetchSummary() {
      setKpisLoading(true);
      try {
        if (!cancelled) {
          await refreshSummary();
        }
      } catch {
        // silently fail — KPI cards will show skeleton
      } finally {
        if (!cancelled) setKpisLoading(false);
      }
    }
    fetchSummary();
    return () => { cancelled = true; };
  }, [refreshSummary]);

  const patchMark = useCallback(async (
    studentId: number,
    payload: Partial<AttendanceMark>,
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) => {
    setSaving(true);
    try {
      const token = getToken();
      const mark: AttendanceMark = { student_id: studentId, date, ...payload };
      await storeAttendance(token, date, [mark], router);
      await refreshSummary();
      onSuccess?.();
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : 'Unknown error');
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
      await refreshSummary();
      onSuccess?.(result.saved);
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [date, refreshSummary, router]);

  const exportAttendance = useCallback(async (
    classId: string,
    onSuccess?: () => void,
    onError?: (msg: string) => void,
    opts?: { sectionId?: string; dateFrom?: string; dateTo?: string; singleDate?: boolean; format?: 'xlsx' | 'csv' },
  ) => {
    try {
      const token = getToken();
      const fmt = opts?.format ?? 'xlsx';
      const query = new URLSearchParams({ format: fmt });
      if (opts?.singleDate) {
        query.set('date', date);
      } else if (opts?.dateFrom && opts?.dateTo) {
        query.set('date_from', opts.dateFrom);
        query.set('date_to', opts.dateTo);
      } else {
        query.set('date', date);
      }
      if (classId && classId !== 'all') query.set('class_id', classId);
      if (opts?.sectionId && opts.sectionId !== 'all') query.set('section_id', opts.sectionId);

      const url = `${API_BASE_URL}/api/v1/attendance/student-attendance/export/?${query.toString()}`;
      const fetchOnce = async (tok: string) => fetch(url, { headers: { Authorization: `Bearer ${tok}` } });

      let res = await fetchOnce(token || '');
      if (res.status === 401) {
        const newToken = await refreshAccessToken();
        if (!newToken) { router.push('/login'); return false; }
        res = await fetchOnce(newToken);
      }
      if (!res.ok) throw new Error(await extractErrorMessage(res));

      // Try to read filename from Content-Disposition.
      const cd = res.headers.get('Content-Disposition') || '';
      const match = /filename\*?=(?:UTF-8'')?\"?([^\";]+)\"?/i.exec(cd);
      const filename = match
        ? decodeURIComponent(match[1])
        : `student_attendance_${date}.${fmt}`;

      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      onSuccess?.();
      return true;
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : 'Failed to export attendance');
      return false;
    }
  }, [date, router]);

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
