'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { ClassInfo } from '../types';
import { getToken, getRefreshToken, CLASS_LEVEL_MAP, CLASS_SUB_LABELS } from '../utils/attendanceHelpers';
import { API_BASE_URL } from '@/lib/api';
import { sortAcademicsClasses } from '@/lib/classOrdering';

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
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

interface DjangoSection {
  id: number;
  name: string;
  student_count?: number;
  school_class?: number;
  class?: number;
  class_id?: number;
}

interface DjangoClass {
  id: number;
  name: string;
  numeric_order: number | null;
  sections: DjangoSection[];
  total_students?: number;
}

function levelFromNumericOrder(order: number | null, name: string): ClassInfo['level'] {
  // Migration 0015: LKG=1, UKG=2, Grade N = N+2 (so Grade 5=7, Grade 6=8, Grade 8=10, Grade 9=11)
  const upper = (name ?? '').trim().toUpperCase();
  if (upper === 'NURSERY' || upper === 'LKG' || upper === 'UKG') return 'primary';
  const m = name.match(/(\d+)/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n <= 5) return 'primary';
    if (n <= 8) return 'middle';
    return 'secondary';
  }
  if (order && order > 0 && order < 900) {
    // numeric_order = grade_number + 2, so grade = order - 2
    const grade = order - 2;
    if (grade <= 5) return 'primary';
    if (grade <= 8) return 'middle';
    return 'secondary';
  }
  return 'primary';
}

function extractClassNumber(name: string): number | null {
  // Try CLASS_LEVEL_MAP first (exact match)
  if (CLASS_LEVEL_MAP[name]) {
    const mapped = CLASS_LEVEL_MAP[name];
    if (mapped === 'primary') return 1;
    if (mapped === 'middle') return 6;
    return 9;
  }
  // Extract leading/trailing number from name (handles "Class 6", "Grade 6", "6", "VI" etc.)
  const match = name.match(/\d+/);
  if (match) return parseInt(match[0], 10);
  // Roman numerals
  const ROMAN: Record<string, number> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
    IX: 9, X: 10, XI: 11, XII: 12,
  };
  const upper = name.trim().toUpperCase();
  for (const [roman, val] of Object.entries(ROMAN)) {
    if (upper === roman || upper === `CLASS ${roman}` || upper === `GRADE ${roman}`) return val;
  }
  return null;
}

function mapDjangoClassToClassInfo(raw: DjangoClass): ClassInfo {
  const level = levelFromNumericOrder(raw.numeric_order, raw.name);
  const totalStudents = raw.total_students ?? 0;
  const rawName = raw.name.trim();
  const isNumericOnly = /^\d+$/.test(rawName);
  const displayLabel = isNumericOnly ? `Grade ${rawName}` : rawName;
  const subLabel = CLASS_SUB_LABELS[displayLabel] ?? CLASS_SUB_LABELS[rawName] ?? '';
  return {
    id: raw.id,
    name: raw.name,
    display_label: displayLabel,
    sub_label: subLabel,
    level,
    sections: (raw.sections ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      student_count: s.student_count ?? 0,
      present_count: 0,
      absent_count: 0,
      late_count: 0,
      unmarked_count: 0,
      attendance_pct: 0,
      sync_status: 'none' as const,
    })),
    total_students: totalStudents,
    total_present: 0,
    total_absent: 0,
    total_late: 0,
    overall_pct: 0,
    sync_status: 'none',
  };
}

function sortSections(sections: DjangoSection[]): DjangoSection[] {
  return [...sections].sort((a, b) => {
    const an = (a.name ?? '').trim();
    const bn = (b.name ?? '').trim();
    const aNum = Number(an);
    const bNum = Number(bn);
    const aIsNum = !Number.isNaN(aNum);
    const bIsNum = !Number.isNaN(bNum);
    if (aIsNum && bIsNum) return aNum - bNum;
    if (aIsNum) return -1;
    if (bIsNum) return 1;
    return an.localeCompare(bn, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function useClasses(date: string) {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = useCallback(async (token: string): Promise<ClassInfo[] | undefined> => {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/core/classes/?page_size=200`,
      { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
    );
    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (!newToken) { router.push('/login'); return undefined; }
      return fetchClasses(newToken);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: DjangoClass[] | { results: DjangoClass[]; count?: number } = await res.json();
    const list = Array.isArray(data) ? data : (data.results ?? []);

    let sectionsByClass: Record<number, DjangoSection[]> = {};
    try {
      const secRes = await fetch(
        `${API_BASE_URL}/api/v1/core/sections/?page_size=500`,
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
      );
      if (secRes.ok) {
        const secData: DjangoSection[] | { results: DjangoSection[] } = await secRes.json();
        const secList = Array.isArray(secData) ? secData : (secData.results ?? []);
        sectionsByClass = secList.reduce<Record<number, DjangoSection[]>>((acc, sec) => {
          const classId = sec.school_class ?? sec.class ?? sec.class_id;
          if (!classId) return acc;
          if (!acc[classId]) acc[classId] = [];
          acc[classId].push(sec);
          return acc;
        }, {});
      }
    } catch {
      sectionsByClass = {};
    }

    // Use the shared sortAcademicsClasses utility which correctly handles
    // LKG→1, UKG→2, Grade 1→3 ... Grade 10→12 (per migration 0015)
    const sorted = sortAcademicsClasses(list);
    return sorted.map((rawClass) => {
      // Sections from the classes API are authoritative for class membership.
      // Sections from the sections endpoint may have wrong school_class FKs for some records.
      // Strategy: start with the class-embedded sections (guaranteed correct),
      // then enrich with student_count from the sections endpoint where IDs match,
      // and add any extra sections from the sections endpoint that aren't already present.
      const classEmbedded: DjangoSection[] = rawClass.sections ?? [];
      const fromEndpoint: DjangoSection[] = sectionsByClass[rawClass.id] ?? [];

      // Build a lookup of sections from the endpoint by ID for fast access
      const endpointById = new Map<number, DjangoSection>(fromEndpoint.map((s) => [s.id, s]));

      // Enrich embedded sections with student_count from endpoint
      const enriched: DjangoSection[] = classEmbedded.map((s) => {
        const endpointSec = endpointById.get(s.id);
        return endpointSec ? { ...s, student_count: endpointSec.student_count ?? s.student_count } : s;
      });

      // Add any sections from the endpoint not in the embedded list (extra safety)
      const embeddedIds = new Set(classEmbedded.map((s) => s.id));
      fromEndpoint.forEach((s) => {
        if (!embeddedIds.has(s.id)) enriched.push(s);
      });

      // If no embedded sections at all, fall back to the endpoint list
      const finalSections = enriched.length > 0 ? enriched : fromEndpoint;

      return mapDjangoClassToClassInfo({
        ...rawClass,
        sections: sortSections(finalSections),
      });
    });
  }, [router]);

  // Stable base class structure (fetched once)
  const [baseClasses, setBaseClasses] = useState<ClassInfo[]>([]);
  useEffect(() => {
    setLoading(true);
    setError(null);
    const token = getToken();
    fetchClasses(token)
      .then((result) => { if (result) setBaseClasses(result); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [fetchClasses]);

  // Re-fetch per-class attendance counts whenever date or base classes change
  const [summaryRefreshTick, setSummaryRefreshTick] = useState(0);
  const refreshClassSummary = useCallback(() => {
    setSummaryRefreshTick((n) => n + 1);
  }, []);
  useEffect(() => {
    if (!baseClasses.length) return;
    // Seed with base classes only if we have no data yet (avoid flashing 0 counts on refresh)
    setClasses((prev) => prev.length === 0 ? baseClasses : prev);
    let cancelled = false;
    async function fetchSummary(token: string): Promise<void> {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/attendance/student-attendance/class-summary/?date=${date}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.status === 401) {
          const newToken = await refreshAccessToken();
          if (!newToken) return;
          return fetchSummary(newToken);
        }
        if (!res.ok) return;
        const data: { date: string; classes: Array<{ class_id: number; present: number; signed_in?: number; absent: number; late: number; total: number; pct: number }> } = await res.json();
        if (cancelled) return;
        const summaryMap: Record<number, { present: number; signed_in: number; absent: number; late: number; pct: number }> = {};
        for (const row of data.classes ?? []) {
          summaryMap[row.class_id] = {
            present: row.present,
            signed_in: row.signed_in ?? 0,
            absent: row.absent,
            late: row.late,
            pct: row.pct,
          };
        }
        setClasses(baseClasses.map((cls) => {
          const s = summaryMap[cls.id];
          if (!s) return cls;
          return {
            ...cls,
            total_present: s.present,
            total_signed_in: s.signed_in,
            total_absent: s.absent,
            total_late: s.late,
            overall_pct: s.pct,
          };
        }));
      } catch {
        // silently fail — accordion will show local counts when opened
      }
    }
    fetchSummary(getToken());
    return () => { cancelled = true; };
  }, [date, baseClasses, summaryRefreshTick]);

  return { classes, loading, error, refreshClassSummary };
}
