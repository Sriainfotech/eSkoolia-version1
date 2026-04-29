// utils/attendanceHelpers.ts
import type { ClassInfo } from '../types';

export const CLASS_LEVEL_MAP: Record<string, ClassInfo['level']> = {
  'Nursery':  'primary',
  'LKG':      'primary',
  'UKG':      'primary',
  'Class 1':  'primary',
  'Class 2':  'primary',
  'Class 3':  'primary',
  'Class 4':  'primary',
  'Class 5':  'primary',
  'Class 6':  'middle',
  'Class 7':  'middle',
  'Class 8':  'middle',
  'Class 9':  'secondary',
  'Class 10': 'secondary',
  'Class 11': 'secondary',
  'Class 12': 'secondary',
};

export const CLASS_SUB_LABELS: Record<string, string> = {
  'Nursery':  'Pre-Nursery / Nursery',
  'LKG':      'Lower Kindergarten',
  'UKG':      'Upper Kindergarten',
  'Class 1':  'Primary',
  'Class 2':  'Primary',
  'Class 3':  'Primary',
  'Class 4':  'Primary',
  'Class 5':  'Primary',
  'Class 6':  'Middle School',
  'Class 7':  'Middle School',
  'Class 8':  'Middle School',
  'Class 9':  'Secondary',
  'Class 10': 'Secondary',
  'Class 11': 'Senior Secondary',
  'Class 12': 'Senior Secondary',
};

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekDates(centerDate: Date): Date[] {
  const day = centerDate.getDay();
  // Start from Monday
  const monday = new Date(centerDate);
  monday.setDate(centerDate.getDate() - ((day === 0 ? 7 : day) - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function ringColor(pct: number): string {
  if (pct >= 85) return '#4729F4';
  if (pct >= 70) return '#B4721B';
  return '#C2264E';
}

export function pctTextColor(pct: number): string {
  if (pct >= 85) return 'text-[#0A8C5A]';
  if (pct >= 70) return 'text-[#B4721B]';
  return 'text-[#C2264E]';
}

export function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('school_erp_access_token') ?? '';
}

export function getRefreshToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('school_erp_refresh_token') ?? '';
}
