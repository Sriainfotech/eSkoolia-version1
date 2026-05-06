'use client';
import { useEffect, useState } from 'react';
import { Calendar, ChevronRight } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface CalEvent { title: string; type: 'exam' | 'submission' | 'comms' | 'ops'; link?: string; }
interface DayData { date: string; events: CalEvent[]; }

const EVENT_COLORS = {
  exam:       { color: '#6D4AFF', bg: '#EEEAFF' },
  submission: { color: '#22C55E', bg: '#D1FAE5' },
  comms:      { color: '#3B82F6', bg: '#DBEAFE' },
  ops:        { color: '#F59E0B', bg: '#FEF3C7' },
};

const WEEKDAYS = ['S','M','T','W','T','F','S'];

function buildMockWeek(): DayData[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const events: CalEvent[] = [];
    if (i === 1) events.push({ title: 'Class 10 Math', type: 'exam' });
    if (i === 2) events.push({ title: 'Results due', type: 'submission' }, { title: 'Parent SMS', type: 'comms' });
    if (i === 4) events.push({ title: 'Fire drill', type: 'ops' });
    if (i === 5) events.push({ title: 'Class 8 Science', type: 'exam' });
    return { date: d.toISOString(), events };
  });
}

interface ExamReadiness {
  daysLeft: number;
  pct: number;
  label: string;
  checks: Array<{ label: string; ok: boolean }>;
}

const MOCK_READINESS: ExamReadiness = {
  daysLeft: 12,
  pct: 64,
  label: 'Term 1 exams begin',
  checks: [
    { label: 'Schedule', ok: true },
    { label: 'Admit cards', ok: true },
    { label: 'Syllabus 64%', ok: false },
    { label: 'Results template', ok: false },
  ],
};

export function AcademicStrip() {
  const [week, setWeek] = useState<DayData[]>(buildMockWeek());
  const [readiness, setReadiness] = useState<ExamReadiness>(MOCK_READINESS);

  useEffect(() => {
    const token = getAccessToken();
    Promise.all([
      fetch(`${API_BASE_URL}/api/calendar/week-ahead/`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE_URL}/api/exams/readiness/`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(r => r.ok ? r.json() : null),
    ]).then(([w, r]) => {
      if (Array.isArray(w)) setWeek(w);
      if (r) setReadiness(r);
    }).catch(() => {});
  }, []);

  const today = new Date();

  return (
    <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, padding: 14, boxShadow: 'var(--sh-1)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Calendar size={13} color="#6D4AFF" strokeWidth={1.8} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>Week Ahead</span>
        <ChevronRight size={12} color="var(--ink-3)" style={{ marginLeft: 'auto' }} />
      </div>

      {/* 7-day strip */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
        {week.map((day, i) => {
          const d = new Date(day.date);
          const isToday = d.toDateString() === today.toDateString();
          const visible = day.events.slice(0, 2);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 9.5, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--pu)' : 'var(--ink-3)' }}>
                {WEEKDAYS[d.getDay()]}
              </span>
              <span style={{
                width: 26, height: 26, borderRadius: 8, fontSize: 11, fontWeight: isToday ? 700 : 400,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isToday ? 'var(--pu)' : 'transparent',
                color: isToday ? '#fff' : 'var(--ink-1)',
              }}>
                {d.getDate()}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
                {visible.map((ev, j) => {
                  const ec = EVENT_COLORS[ev.type];
                  return (
                    <div key={j} style={{ height: 4, borderRadius: 2, background: ec.color, width: '100%' }} title={ev.title} />
                  );
                })}
                {day.events.length > 2 && (
                  <span style={{ fontSize: 8, color: 'var(--ink-3)', textAlign: 'center' }}>+{day.events.length - 2}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Readiness bar */}
      <div style={{ borderTop: '1px solid var(--bg-2)', paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-1)' }}>
            📋 {readiness.label} in {readiness.daysLeft} days
          </span>
        </div>
        <div style={{ height: 5, background: '#EEEAFF', borderRadius: 3, overflow: 'hidden', marginBottom: 7 }}>
          <div style={{ height: '100%', width: `${readiness.pct}%`, background: 'var(--pu)', borderRadius: 3, transition: 'width 0.8s ease' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {readiness.checks.map((c, i) => (
            <span key={i} style={{ fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 3, color: c.ok ? '#059669' : '#E0463A' }}>
              {c.ok ? '✓' : '✗'} {c.label}
            </span>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {Object.entries(EVENT_COLORS).map(([type, ec]) => (
          <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5, color: 'var(--ink-3)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: ec.color }} />
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}
