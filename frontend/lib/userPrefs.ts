'use client';
import { useState, useEffect, useCallback } from 'react';

export interface PinItem {
  path: string;
  label: string;
  modId: string;
}

interface UserPrefs {
  pins: PinItem[];
  showQuickAccess: boolean;
  showRecents: boolean;
}

const DEFAULT_PINS: PinItem[] = [
  { path: '/attendance/student', label: 'Student Attendance', modId: 'attendance' },
  { path: '/students/list', label: 'Student Enroll & List', modId: 'students' },
  { path: '/administration/visitor-book', label: 'Visitor Book', modId: 'admin' },
  { path: '/administration/admission-query', label: 'Admission Query', modId: 'admin' },
  { path: '/fees/payments', label: 'Fees Collection', modId: 'fees' },
  { path: '/transport/bus-tracking', label: 'Live Bus Tracking', modId: 'transport' },
  { path: '/exams/marks-register', label: 'Marks Register', modId: 'exam' },
  { path: '/utilities/chat', label: 'Chat', modId: 'utilities' },
];

const DEFAULT_PREFS: UserPrefs = {
  pins: DEFAULT_PINS,
  showQuickAccess: true,
  showRecents: true,
};

const LS_KEY = 'eskoolia_prefs';

function loadFromStorage(): UserPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useUserPrefs() {
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(loadFromStorage());
  }, []);

  const savePrefs = useCallback((next: UserPrefs) => {
    setPrefs(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    }
  }, []);

  const updatePrefs = useCallback((partial: Partial<UserPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...partial };
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const removePin = useCallback((path: string) => {
    setPrefs(prev => {
      const next = { ...prev, pins: prev.pins.filter(p => p.path !== path) };
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const addPin = useCallback((pin: PinItem) => {
    setPrefs(prev => {
      if (prev.pins.find(p => p.path === pin.path)) return prev;
      const next = { ...prev, pins: [...prev.pins, pin] };
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  return { prefs, updatePrefs, savePrefs, addPin, removePin };
}
