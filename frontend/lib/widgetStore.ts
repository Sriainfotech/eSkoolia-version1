'use client';
import { useState, useEffect, useCallback } from 'react';

export type PortalRole = 'admin' | 'teacher' | 'parent' | 'student' | 'custom';

export interface WidgetDef {
  id: string;
  name: string;
  description: string;
  rail: 'left' | 'right';
  icon: string;
  defaultEnabled: boolean;
  disabled?: boolean;
  /** Which portal roles can see this widget. Omit to show to all roles. */
  roles?: PortalRole[];
}

export const ALL_WIDGETS: WidgetDef[] = [
  // ── Teacher-only ──────────────────────────────────────────────────────────
  { id: 'teacher-day-plan', name: "Today's Schedule",  description: "Period-by-period schedule for today",               rail: 'left',  icon: '🗒', defaultEnabled: true,  roles: ['teacher'] },

  // ── Admin-only — Left rail (Today's Pulse) ────────────────────────────────
  { id: 'attendance',    name: 'Student Attendance',   description: 'Live attendance snapshot with class-wise breakdown', rail: 'left',  icon: '📊', defaultEnabled: true,  roles: ['admin'] },
  { id: 'sickbay',       name: 'Sick Bay',              description: 'Active sick-bay cases & parent contact status',      rail: 'left',  icon: '🏥', defaultEnabled: true,  roles: ['admin'] },
  { id: 'busfleet',      name: 'Bus Fleet',             description: 'Live bus positions & ETA for all routes',            rail: 'left',  icon: '🚌', defaultEnabled: true,  roles: ['admin'] },
  { id: 'feestoday',     name: "Today's Fees",          description: 'Fee collections received today vs target',           rail: 'left',  icon: '💰', defaultEnabled: true,  roles: ['admin'] },
  { id: 'staffleave',    name: 'Staff Leave',           description: 'Staff on leave today & substitute assignments',      rail: 'left',  icon: '👤', defaultEnabled: true,  roles: ['admin'] },

  // ── Admin-only — Right rail (Admin Cockpit) ───────────────────────────────
  { id: 'morning-brief', name: 'Morning Brief',         description: 'AI-generated start-of-day briefing',                rail: 'right', icon: '☀️', defaultEnabled: true,  roles: ['admin'] },
  { id: 'notifications', name: 'Notifications',         description: 'Recent system & activity notifications',             rail: 'right', icon: '🔔', defaultEnabled: true,  roles: ['admin'] },
  { id: 'calls-queue',   name: 'Calls Queue',           description: 'Pending parent & vendor call-backs, AI-ranked',     rail: 'right', icon: '📞', defaultEnabled: true,  roles: ['admin'] },
  { id: 'drafts',        name: 'Drafts Pending',        description: 'Communications awaiting your approval',             rail: 'right', icon: '📝', defaultEnabled: false, roles: ['admin'], disabled: true },
  { id: 'academic-strip',name: 'Academic Calendar',     description: 'Merged into Week Ahead widget',                     rail: 'right', icon: '📅', defaultEnabled: false, roles: ['admin'], disabled: true },
  { id: 'broadcast',     name: 'Quick Broadcast',       description: 'Send announcements to parents & students',          rail: 'right', icon: '📢', defaultEnabled: false, roles: ['admin'] },

  // ── Parent-only — Left rail ────────────────────────────────────────────────
  { id: 'parent-attendance', name: "Child's Attendance",  description: 'Attendance ring & stats for the selected child',     rail: 'left',  icon: '📅', defaultEnabled: true,  roles: ['parent'] },
  { id: 'parent-results',    name: 'Recent Results',       description: 'Latest exam scores for the selected child',           rail: 'left',  icon: '📊', defaultEnabled: true,  roles: ['parent'] },

  // ── Parent-only — Right rail ───────────────────────────────────────────────
  { id: 'parent-notices',    name: 'Notice Board',         description: 'Latest school circulars & announcements',             rail: 'right', icon: '🔔', defaultEnabled: true,  roles: ['parent'] },
  { id: 'parent-fees',       name: 'Fee Status',           description: 'Outstanding fees & payment reminders',                rail: 'right', icon: '💳', defaultEnabled: true,  roles: ['parent'] },

  // ── Shared — Right rail (available to admin + teacher) ───────────────────
  { id: 'smart-todo',    name: 'Smart To-Do',           description: 'AI-ranked tasks with category tabs',                rail: 'right', icon: '✅', defaultEnabled: true  },
  { id: 'week-ahead',    name: 'Week Ahead',            description: 'Intelligent 7-day planner — drag to schedule',      rail: 'right', icon: '🗓', defaultEnabled: true  },
  { id: 'pinned-notes',  name: 'Pinned Notes',          description: 'Important pinned sticky notes at a glance',         rail: 'right', icon: '📌', defaultEnabled: false },
];

/** Returns only the widgets visible to a given portal role. */
export function widgetsForRole(role: PortalRole): WidgetDef[] {
  return ALL_WIDGETS.filter(w => !w.roles || w.roles.includes(role));
}

const LS_KEY = 'eskoolia_widget_prefs_v2';

/* ─────────────────────────────────────────────────────────────────
   Module-level singleton — ONE shared state across ALL components.
   Each useWidgetStore() call subscribes to the same store; toggling
   in WidgetManager immediately re-renders LeftRail / RightRail.
   ───────────────────────────────────────────────────────────────── */
function computeDefault(): Record<string, boolean> {
  return Object.fromEntries(ALL_WIDGETS.map(w => [w.id, w.defaultEnabled]));
}

let _store: Record<string, boolean> = computeDefault();
let _loaded = false;
const _listeners = new Set<() => void>();

function _notifyAll() {
  _listeners.forEach(fn => fn());
}

function _loadOnce() {
  if (_loaded) return;
  _loaded = true;
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, boolean>;
      _store = { ..._store, ...parsed };
    }
  } catch { /* ignore */ }
  // Always force disabled widgets OFF regardless of saved state
  ALL_WIDGETS.forEach(w => { if (w.disabled) _store[w.id] = false; });
}

export function useWidgetStore() {
  // tick is only used to force a re-render when _store changes
  const [, setTick] = useState(0);

  useEffect(() => {
    // Load persisted prefs once (first subscriber wins)
    _loadOnce();
    // Immediately re-render with loaded values
    setTick(v => v + 1);
    // Subscribe to future changes from ANY component
    const update = () => setTick(v => v + 1);
    _listeners.add(update);
    return () => { _listeners.delete(update); };
  }, []);

  const toggle = useCallback((id: string) => {
    _store = { ..._store, [id]: !_store[id] };
    try { localStorage.setItem(LS_KEY, JSON.stringify(_store)); } catch { /* ignore */ }
    _notifyAll();
  }, []);

  // Direct read from module singleton — always fresh after re-render
  const isEnabled = (id: string): boolean => _store[id] ?? true;

  // Only count non-disabled widgets
  const enabledCount = ALL_WIDGETS.filter(w => !w.disabled && (_store[w.id] ?? w.defaultEnabled)).length;

  return { enabled: _store, isEnabled, toggle, enabledCount };
}
