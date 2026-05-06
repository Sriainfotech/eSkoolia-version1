'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Sparkles, ChevronLeft, ChevronRight, Trash2, X, Check, Calendar, Clock } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  academic:  { bg: '#EEEAFF', border: '#6D4AFF', text: '#4C35BE', dot: '#6D4AFF' },
  meeting:   { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF', dot: '#3B82F6' },
  admin:     { bg: '#D1FAE5', border: '#059669', text: '#065F46', dot: '#059669' },
  personal:  { bg: '#FEF3C7', border: '#D97706', text: '#92400E', dot: '#D97706' },
  urgent:    { bg: '#FEE2E2', border: '#E0463A', text: '#991B1B', dot: '#E0463A' },
};
type Category = keyof typeof CATEGORY_COLORS;

interface WeekEvent {
  id: string;
  dayIndex: number;
  time: string;
  title: string;
  category: Category;
  note?: string;
  done?: boolean;
  aiGenerated?: boolean;
}

/* ─── Academic calendar (from AcademicStrip, merged) ─── */
interface AcadEvent { title: string; type: 'exam' | 'submission' | 'comms' | 'ops'; }
interface AcadDay   { date: string; events: AcadEvent[]; }
const ACAD_COLORS = {
  exam:       '#6D4AFF',
  submission: '#22C55E',
  comms:      '#3B82F6',
  ops:        '#F59E0B',
} as const;

interface ExamReadiness { daysLeft: number; pct: number; label: string; checks: Array<{ label: string; ok: boolean }>; }
const MOCK_READINESS: ExamReadiness = {
  daysLeft: 12, pct: 64, label: 'Term 1 exams begin',
  checks: [{ label: 'Schedule', ok: true }, { label: 'Admit cards', ok: true }, { label: 'Syllabus 64%', ok: false }, { label: 'Results template', ok: false }],
};

function buildMockAcadWeek(weekStart: Date): AcadDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
    const events: AcadEvent[] = [];
    if (i === 1) events.push({ title: 'Class 10 Math', type: 'exam' });
    if (i === 2) events.push({ title: 'Results due', type: 'submission' }, { title: 'Parent SMS', type: 'comms' });
    if (i === 4) events.push({ title: 'Fire drill', type: 'ops' });
    if (i === 5) events.push({ title: 'Class 8 Science', type: 'exam' });
    return { date: d.toISOString(), events };
  });
}

const AI_SUGGESTIONS: Omit<WeekEvent, 'id'>[] = [
  { dayIndex: 0, time: '09:00', title: 'Morning attendance review',  category: 'academic',  aiGenerated: true },
  { dayIndex: 0, time: '14:00', title: 'Staff sync — weekly goals',  category: 'meeting',   aiGenerated: true },
  { dayIndex: 2, time: '10:30', title: 'Parent-teacher follow-ups',  category: 'admin',     aiGenerated: true },
  { dayIndex: 3, time: '15:00', title: 'Fee collection review',      category: 'admin',     aiGenerated: true },
  { dayIndex: 4, time: '09:30', title: 'Exam schedule finalisation', category: 'academic',  aiGenerated: true },
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_SHORT  = ['M',   'T',   'W',   'T',   'F',   'S',   'S'];
// School hours 7am–5pm in the modal planner
const HOUR_SLOTS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];

const LS_KEY = 'eskoolia_week_events_v2';

function getWeekStart(offset = 0): Date {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getDayDate(weekStart: Date, dayIndex: number): Date {
  const d = new Date(weekStart);
  d.setDate(weekStart.getDate() + dayIndex);
  return d;
}

function isToday(weekStart: Date, dayIndex: number): boolean {
  const d = getDayDate(weekStart, dayIndex);
  return d.toDateString() === new Date().toDateString();
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function loadEvents(weekKey: string): WeekEvent[] {
  try { return JSON.parse(localStorage.getItem(`${LS_KEY}_${weekKey}`) || '[]'); } catch { return []; }
}
function saveEvents(weekKey: string, events: WeekEvent[]) {
  try { localStorage.setItem(`${LS_KEY}_${weekKey}`, JSON.stringify(events)); } catch {}
}
function weekKey(d: Date) { return d.toISOString().slice(0, 10); }

function getTodayIdx(): number {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

/* ─────────────────────────────────────────
   Compact home widget
   ───────────────────────────────────────── */
export function WeekAhead() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [events, setEvents] = useState<WeekEvent[]>([]);
  const [showPlanner, setShowPlanner] = useState(false);
  const [acadWeek, setAcadWeek]       = useState<AcadDay[]>([]);
  const [readiness, setReadiness]     = useState<ExamReadiness>(MOCK_READINESS);

  const weekStart = getWeekStart(weekOffset);
  const wk = weekKey(weekStart);

  useEffect(() => { setEvents(loadEvents(wk)); }, [wk]);

  // Listen for events added by the AI bot
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { weekKey?: string };
      if (detail?.weekKey === wk) setEvents(loadEvents(wk));
    };
    window.addEventListener('eskoolia-planner-updated', handler);
    return () => window.removeEventListener('eskoolia-planner-updated', handler);
  }, [wk]);

  // Load academic events for current week
  useEffect(() => {
    setAcadWeek(buildMockAcadWeek(weekStart));
    const token = getAccessToken();
    Promise.all([
      fetch(`${API_BASE_URL}/api/calendar/week-ahead/`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE_URL}/api/exams/readiness/`,     { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.ok ? r.json() : null),
    ]).then(([w, r]) => {
      if (Array.isArray(w)) setAcadWeek(w);
      if (r) setReadiness(r);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wk]);

  const saveAndSet = useCallback((evts: WeekEvent[]) => {
    setEvents(evts);
    saveEvents(wk, evts);
  }, [wk]);

  const toggleDone = (id: string) => {
    saveAndSet(events.map(e => e.id === id ? { ...e, done: !e.done } : e));
  };

  const todayIdx = getTodayIdx();
  const todayEvents = events.filter(e => e.dayIndex === todayIdx).sort((a, b) => a.time.localeCompare(b.time));

  return (
    <>
      <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--sh-1)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 10px', borderBottom: '1px solid var(--bd)', background: 'linear-gradient(135deg,rgba(109,74,255,0.04) 0%,transparent 100%)' }}>
          <span style={{ fontSize: 15 }}>🗓</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>Week Ahead</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
              {formatDate(weekStart)} – {formatDate(getDayDate(weekStart, 6))}
            </div>
          </div>
          <button
            onClick={() => setShowPlanner(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--pu)', background: 'var(--pu-soft)', border: '1px solid rgba(109,74,255,0.3)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}
          >
            <Calendar size={11} strokeWidth={2} />Open Planner
          </button>
        </div>

        {/* 7-day mini strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, padding: '10px 12px 8px' }}>
          {DAY_SHORT.map((lbl, idx) => {
            const dayEvts = events.filter(e => e.dayIndex === idx);
            const doneCount = dayEvts.filter(e => e.done).length;
            const total = dayEvts.length;
            const today = isToday(weekStart, idx);
            const pending = total - doneCount;
            const isPast = getDayDate(weekStart, idx) < new Date() && !today;
            const barColor = total === 0 ? 'var(--bd)' : (doneCount === total ? '#22C55E' : (isPast && pending > 0 ? '#E0463A' : '#F59E0B'));
            const acadDay = acadWeek[idx];
            const acadEvents = acadDay?.events ?? [];
            return (
              <button
                key={idx}
                onClick={() => setShowPlanner(true)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: today ? 'var(--pu-soft)' : 'transparent', border: today ? '1.5px solid rgba(109,74,255,0.3)' : '1px solid transparent', borderRadius: 8, padding: '5px 2px', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => !today && (e.currentTarget.style.background = 'var(--bg-2)')}
                onMouseLeave={e => !today && (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: 9, fontWeight: 700, color: today ? 'var(--pu)' : 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{lbl}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: today ? 'var(--pu)' : 'var(--ink-2)' }}>{getDayDate(weekStart, idx).getDate()}</span>
                {/* personal task progress bar */}
                <div style={{ width: '100%', height: 3, borderRadius: 3, background: 'var(--bd)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: barColor, width: total === 0 ? '0%' : `${(doneCount / total) * 100}%`, transition: 'width 0.3s' }} />
                </div>
                {/* academic event dots */}
                {acadEvents.length > 0 && (
                  <div style={{ display: 'flex', gap: 2, marginTop: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {acadEvents.slice(0, 3).map((ev, j) => (
                      <span key={j} title={ev.title} style={{ width: 5, height: 5, borderRadius: '50%', background: ACAD_COLORS[ev.type], flexShrink: 0 }} />
                    ))}
                  </div>
                )}
                {total > 0 && (
                  <span style={{ fontSize: 9, color: barColor, fontWeight: 600 }}>{doneCount}/{total}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Today's tasks */}
        <div style={{ padding: '0 12px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Today · {todayEvents.length} task{todayEvents.length !== 1 ? 's' : ''}
          </div>
          {todayEvents.length === 0 ? (
            <button
              onClick={() => setShowPlanner(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', fontSize: 11.5, color: 'var(--ink-3)', background: 'var(--bg-0)', border: '1.5px dashed var(--bd)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}
            >
              <Plus size={12} strokeWidth={2} />Plan your day…
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {todayEvents.slice(0, 4).map(ev => {
                const c = CATEGORY_COLORS[ev.category];
                const isOverdue = !ev.done && ev.time < new Date().toTimeString().slice(0, 5);
                return (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 8, background: ev.done ? '#F0FDF4' : (isOverdue ? '#FFF7F7' : 'var(--bg-0)'), border: `1px solid ${ev.done ? '#BBF7D0' : (isOverdue ? '#FEE2E2' : 'var(--bd)')}`, transition: 'all 0.2s' }}>
                    <button
                      onClick={() => toggleDone(ev.id)}
                      style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${ev.done ? '#22C55E' : (isOverdue ? '#E0463A' : c.border)}`, background: ev.done ? '#22C55E' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      {ev.done && <Check size={9} color="#fff" strokeWidth={3} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: ev.done ? '#6B7280' : 'var(--ink-1)', textDecoration: ev.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9.5, color: isOverdue && !ev.done ? '#E0463A' : 'var(--ink-3)', flexShrink: 0 }}>
                      <Clock size={9} strokeWidth={2} />{ev.time}
                    </span>
                  </div>
                );
              })}
              {todayEvents.length > 4 && (
                <button onClick={() => setShowPlanner(true)} style={{ fontSize: 11, color: 'var(--pu)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '2px 0' }}>
                  +{todayEvents.length - 4} more — open planner
                </button>
              )}
            </div>
          )}
        </div>

        {/* Academic readiness section */}
        <div style={{ margin: '0 12px 12px', padding: '10px 12px', background: 'var(--bg-0)', border: '1px solid var(--bd)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 5 }}>
            📋 {readiness.label} in {readiness.daysLeft} days
          </div>
          <div style={{ height: 4, background: '#EEEAFF', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${readiness.pct}%`, background: 'var(--pu)', borderRadius: 3, transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {readiness.checks.map((c, i) => (
              <span key={i} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, color: c.ok ? '#059669' : '#E0463A' }}>
                {c.ok ? '✓' : '✗'} {c.label}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* Full-screen planner modal */}
      {showPlanner && (
        <PlannerModal
          weekOffset={weekOffset}
          events={events}
          onClose={() => setShowPlanner(false)}
          onSave={saveAndSet}
          onWeekChange={setWeekOffset}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────
   Full-screen week planner modal
   ───────────────────────────────────────── */
interface PlannerModalProps {
  weekOffset: number;
  events: WeekEvent[];
  onClose: () => void;
  onSave: (evts: WeekEvent[]) => void;
  onWeekChange: (offset: number) => void;
}

function PlannerModal({ weekOffset, events, onClose, onSave, onWeekChange }: PlannerModalProps) {
  const [adding, setAdding] = useState<{ dayIndex: number; time: string } | null>(null);
  const [form, setForm] = useState({ title: '', category: 'academic' as Category, note: '', time: '09:00' });
  const [showAI, setShowAI] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const weekStart = getWeekStart(weekOffset);
  const wk = weekKey(weekStart);
  const todayIdx = getTodayIdx();

  // Re-load events when offset changes
  const [localEvents, setLocalEvents] = useState<WeekEvent[]>(events);
  useEffect(() => { setLocalEvents(loadEvents(wk)); }, [wk]);

  const saveLocal = (evts: WeekEvent[]) => {
    setLocalEvents(evts);
    saveEvents(wk, evts);
    onSave(evts);
  };

  const addEvent = () => {
    if (!form.title.trim()) return;
    const slot = adding ?? { dayIndex: todayIdx, time: form.time };
    const ev: WeekEvent = {
      id: String(Date.now()),
      dayIndex: slot.dayIndex,
      time: adding?.time ?? form.time,
      title: form.title.trim(),
      category: form.category,
      note: form.note.trim() || undefined,
    };
    saveLocal([...localEvents, ev]);
    setAdding(null);
    setForm({ title: '', category: 'academic', note: '', time: '09:00' });
  };

  const deleteEvent = (id: string) => { saveLocal(localEvents.filter(e => e.id !== id)); setEditingId(null); };
  const toggleDone = (id: string) => saveLocal(localEvents.map(e => e.id === id ? { ...e, done: !e.done } : e));

  const acceptAI = (s: Omit<WeekEvent, 'id'>) => {
    const ev: WeekEvent = { ...s, id: `ai-${Date.now()}` };
    const next = [...localEvents.filter(e => !(e.dayIndex === s.dayIndex && e.time === s.time && e.aiGenerated)), ev];
    saveLocal(next);
  };

  const eventsForSlot = (dayIndex: number, time: string) =>
    localEvents.filter(e => e.dayIndex === dayIndex && e.time === time);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,18,34,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: 1080, background: 'var(--bg-1)', borderRadius: 20, boxShadow: 'var(--sh-3)', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid var(--bd)', background: 'linear-gradient(135deg,rgba(109,74,255,0.05) 0%,transparent 100%)', flexShrink: 0 }}>
          <span style={{ fontSize: 18 }}>🗓</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>Week Planner</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{formatDate(weekStart)} – {formatDate(getDayDate(weekStart, 6))} · School hours 7 AM – 5 PM</div>
          </div>
          {/* AI toggle */}
          <button
            onClick={() => setShowAI(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, border: showAI ? '1px solid rgba(109,74,255,0.5)' : '1px solid var(--bd)', background: showAI ? 'var(--pu-soft)' : 'var(--bg-2)', color: showAI ? 'var(--pu)' : 'var(--ink-3)', cursor: 'pointer' }}
          >
            <Sparkles size={11} strokeWidth={2} />AI Suggestions
          </button>
          {/* Week nav */}
          <button onClick={() => onWeekChange(weekOffset - 1)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--bd)', background: 'var(--bg-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={13} color="var(--ink-3)" strokeWidth={2} />
          </button>
          <button onClick={() => onWeekChange(0)} style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 7, border: '1px solid var(--bd)', background: weekOffset === 0 ? 'var(--pu-soft)' : 'var(--bg-2)', color: weekOffset === 0 ? 'var(--pu)' : 'var(--ink-2)', cursor: 'pointer' }}>Today</button>
          <button onClick={() => onWeekChange(weekOffset + 1)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--bd)', background: 'var(--bg-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={13} color="var(--ink-3)" strokeWidth={2} />
          </button>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--bd)', background: 'var(--bg-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
            <X size={14} color="var(--ink-3)" strokeWidth={2} />
          </button>
        </div>

        {/* AI suggestion pills */}
        {showAI && (
          <div style={{ padding: '8px 16px 6px', borderBottom: '1px solid var(--bd)', background: 'rgba(109,74,255,0.025)', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={9} /> AI Suggestions for this week
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {AI_SUGGESTIONS.map((s, i) => {
                const c = CATEGORY_COLORS[s.category];
                const added = localEvents.some(e => e.dayIndex === s.dayIndex && e.time === s.time && e.title === s.title);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: c.bg, borderRadius: 8, border: `1px solid ${c.border}40`, opacity: added ? 0.4 : 1 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: c.text }}>{s.title}</span>
                    <span style={{ fontSize: 10, color: c.text, opacity: 0.7 }}>{DAY_LABELS[s.dayIndex]} · {s.time}</span>
                    {!added && <button onClick={() => acceptAI(s)} style={{ fontSize: 9.5, fontWeight: 700, color: c.text, background: 'rgba(255,255,255,0.7)', border: `1px solid ${c.border}60`, borderRadius: 5, padding: '1px 7px', cursor: 'pointer' }}>+ Add</button>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Day column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7,1fr)', borderBottom: '1px solid var(--bd)', background: 'var(--bg-2)', flexShrink: 0 }}>
          <div />
          {DAY_LABELS.map((label, idx) => {
            const d = getDayDate(weekStart, idx);
            const today = isToday(weekStart, idx);
            const dayEvts = localEvents.filter(e => e.dayIndex === idx);
            const doneCount = dayEvts.filter(e => e.done).length;
            return (
              <div key={idx} style={{ padding: '8px 4px', textAlign: 'center', borderLeft: '1px solid var(--bd)', background: today ? 'rgba(109,74,255,0.04)' : undefined }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: today ? 'var(--pu)' : 'var(--ink-3)' }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, width: 28, height: 28, borderRadius: '50%', margin: '2px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: today ? 'var(--pu)' : 'transparent', color: today ? '#fff' : idx >= 5 ? 'var(--ink-3)' : 'var(--ink-1)' }}>{d.getDate()}</div>
                {dayEvts.length > 0 && <div style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 2 }}>{doneCount}/{dayEvts.length}</div>}
                {/* Add button for the day */}
                <button
                  onClick={() => { setAdding({ dayIndex: idx, time: '09:00' }); setForm(f => ({ ...f, time: '09:00' })); }}
                  style={{ marginTop: 4, width: 20, height: 20, borderRadius: 5, border: '1px dashed var(--bd)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px auto 0' }}
                  title={`Add event on ${label}`}
                >
                  <Plus size={10} color="var(--ink-3)" strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div style={{ overflowY: 'auto', maxHeight: 440 }}>
          {HOUR_SLOTS.map(time => (
            <div key={time} style={{ display: 'grid', gridTemplateColumns: '52px repeat(7,1fr)', minHeight: 44, borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 9.5, color: 'var(--ink-3)', padding: '5px 8px 0', fontVariantNumeric: 'tabular-nums', borderRight: '1px solid var(--bd)', background: 'var(--bg-2)' }}>{time}</div>
              {DAY_LABELS.map((_, dayIdx) => {
                const slotEvents = eventsForSlot(dayIdx, time);
                const isWeekend = dayIdx >= 5;
                const today = isToday(weekStart, dayIdx);
                const aiSuggestion = showAI ? AI_SUGGESTIONS.find(s => s.dayIndex === dayIdx && s.time === time) : null;
                const aiAlreadyAdded = aiSuggestion ? localEvents.some(e => e.dayIndex === dayIdx && e.time === time && e.title === aiSuggestion.title) : false;
                return (
                  <div
                    key={dayIdx}
                    style={{ borderLeft: '1px solid var(--bd)', padding: '3px 4px', minHeight: 44, background: today ? 'rgba(109,74,255,0.015)' : isWeekend ? 'rgba(0,0,0,0.015)' : undefined, position: 'relative', cursor: 'pointer' }}
                    onDoubleClick={() => { setAdding({ dayIndex: dayIdx, time }); setForm(f => ({ ...f, time })); }}
                  >
                    {/* AI ghost */}
                    {aiSuggestion && !aiAlreadyAdded && (
                      <div style={{ fontSize: 9.5, padding: '2px 5px', borderRadius: 4, background: 'rgba(109,74,255,0.07)', border: '1px dashed rgba(109,74,255,0.3)', color: 'rgba(109,74,255,0.55)', marginBottom: 2, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => acceptAI(aiSuggestion)}>
                        ✦ {aiSuggestion.title}
                      </div>
                    )}
                    {slotEvents.map(ev => {
                      const c = CATEGORY_COLORS[ev.category];
                      const isOverdue = !ev.done && getDayDate(weekStart, ev.dayIndex) <= new Date() && ev.time < new Date().toTimeString().slice(0, 5);
                      return (
                        <div key={ev.id}>
                          <div
                            style={{ fontSize: 9.5, padding: '2px 6px', borderRadius: 4, background: ev.done ? '#D1FAE5' : (isOverdue ? '#FEE2E2' : c.bg), border: `1px solid ${ev.done ? '#22C55E40' : (isOverdue ? '#E0463A40' : c.border + '50')}`, color: ev.done ? '#065F46' : (isOverdue ? '#991B1B' : c.text), marginBottom: 2, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3, textDecoration: ev.done ? 'line-through' : 'none' }}
                            title={ev.note || ev.title}
                            onClick={() => setEditingId(ev.id === editingId ? null : ev.id)}
                          >
                            {ev.done ? <Check size={8} strokeWidth={3} /> : ev.aiGenerated ? <span style={{ fontSize: 8 }}>✦</span> : null}
                            {ev.title}
                          </div>
                          {/* Expanded detail */}
                          {editingId === ev.id && (
                            <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, background: 'var(--bg-1)', border: `1px solid ${c.border}80`, borderRadius: 10, padding: '10px 12px', minWidth: 180, maxWidth: 220, boxShadow: 'var(--sh-3)' }} onClick={e => e.stopPropagation()}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 2 }}>{ev.title}</div>
                              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 4 }}>{DAY_LABELS[ev.dayIndex]} · {ev.time}</div>
                              {ev.note && <div style={{ fontSize: 10.5, color: 'var(--ink-2)', marginBottom: 6 }}>{ev.note}</div>}
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => toggleDone(ev.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: ev.done ? '#D97706' : '#059669', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                  <Check size={10} /> {ev.done ? 'Undo' : 'Mark done'}
                                </button>
                                <button onClick={() => deleteEvent(ev.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: '#E0463A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                  <Trash2 size={10} /> Remove
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* + hover button */}
                    {slotEvents.length === 0 && !aiSuggestion && (
                      <button
                        onClick={() => { setAdding({ dayIndex: dayIdx, time }); setForm(f => ({ ...f, time })); }}
                        style={{ width: '100%', height: '100%', minHeight: 30, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s', borderRadius: 4 }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                      >
                        <Plus size={11} color="var(--ink-3)" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Add event form */}
        {adding && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--bd)', background: 'rgba(109,74,255,0.03)', flexShrink: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--pu)', marginBottom: 8 }}>
              Add event — {DAY_LABELS[adding.dayIndex]} · {adding.time}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'end' }}>
              <input
                autoFocus
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') addEvent(); if (e.key === 'Escape') setAdding(null); }}
                placeholder="Event title…"
                style={{ fontSize: 13, padding: '7px 12px', border: '1px solid var(--bd)', borderRadius: 8, background: 'var(--bg-1)', color: 'var(--ink-1)', outline: 'none' }}
              />
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
                style={{ fontSize: 12, padding: '7px 10px', border: '1px solid var(--bd)', borderRadius: 8, background: 'var(--bg-1)', color: 'var(--ink-1)', outline: 'none' }}
              >
                {Object.keys(CATEGORY_COLORS).map(cat => (
                  <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setAdding(null)} style={{ fontSize: 12, padding: '7px 14px', border: '1px solid var(--bd)', borderRadius: 8, background: 'none', cursor: 'pointer', color: 'var(--ink-2)' }}>Cancel</button>
                <button onClick={addEvent} style={{ fontSize: 12, padding: '7px 16px', border: 'none', borderRadius: 8, background: 'var(--pu)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Add</button>
              </div>
            </div>
            <input
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Notes (optional)…"
              style={{ marginTop: 8, width: '100%', fontSize: 12, padding: '6px 10px', border: '1px solid var(--bd)', borderRadius: 8, background: 'var(--bg-1)', color: 'var(--ink-1)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', borderTop: '1px solid var(--bd)', background: 'var(--bg-2)', flexWrap: 'wrap', flexShrink: 0 }}>
          {Object.entries(CATEGORY_COLORS).map(([cat, c]) => (
            <span key={cat} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--ink-3)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot }} />{cat}
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#22C55E' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E' }} />done</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#F59E0B' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B' }} />pending</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#E0463A' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E0463A' }} />overdue</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-3)' }}>Double-click cell to add · Click event to view/edit</span>
        </div>
      </div>
    </div>
  );
}
