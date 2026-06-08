'use client';

/**
 * TeacherDayPlanner widget
 *
 * Shows today's period-by-period schedule in a compact vertical timeline.
 * Current period is highlighted with a live pulse dot.
 * Used in the left rail of the teacher portal home screen.
 *
 * Data comes from TeacherMe.todays_periods — no separate API call needed.
 */

import type { TodayPeriod } from '@/lib/api/teacher';

interface Props {
  periods: TodayPeriod[];
  loading?: boolean;
}

// Subject → colour mapping (deterministic, based on subject name hash)
const SUBJECT_COLORS = [
  { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' },
  { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  { bg: '#FDF4FF', text: '#A21CAF', border: '#E9D5FF' },
  { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
];

function subjectColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % SUBJECT_COLORS.length;
  return SUBJECT_COLORS[hash];
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: 12 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--line)', marginTop: 5, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 11, borderRadius: 4, background: 'var(--line)', width: '60%', marginBottom: 5 }} />
        <div style={{ height: 9, borderRadius: 4, background: 'var(--line)', width: '40%' }} />
      </div>
    </div>
  );
}

export function TeacherDayPlanner({ periods, loading }: Props) {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  const livePeriod = periods.find(p => p.is_now);

  return (
    <div style={{
      background: 'var(--bg-1, #fff)',
      border: '1px solid var(--line, #dbe4f0)',
      borderRadius: 14,
      padding: '14px 16px',
      boxShadow: 'var(--shadow, 0 4px 12px -4px rgba(15,18,34,0.08))',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted, #5B5E72)', margin: 0 }}>
            Today's Schedule
          </p>
          <p style={{ fontSize: 11, color: 'var(--muted, #5B5E72)', marginTop: 2 }}>{today}</p>
        </div>
        {livePeriod && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#22C55E',
              boxShadow: '0 0 0 3px rgba(34,197,94,0.25)',
              animation: 'hr-pulse-brand 1.5s infinite',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#15803D' }}>Live</span>
          </div>
        )}
      </div>

      {/* Periods list */}
      {loading ? (
        <div>{[1, 2, 3].map(i => <SkeletonRow key={i} />)}</div>
      ) : periods.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--muted, #5B5E72)', textAlign: 'center', padding: '16px 0' }}>
          No periods scheduled today
        </p>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Timeline line */}
          <div style={{
            position: 'absolute', left: 3, top: 6, bottom: 6,
            width: 1, background: 'var(--line, #dbe4f0)',
          }} />

          {periods.map((p, idx) => {
            const col = subjectColor(p.subject);
            return (
              <div
                key={idx}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  paddingBottom: idx < periods.length - 1 ? 12 : 0,
                  position: 'relative',
                  opacity: p.is_done ? 0.5 : 1,
                }}
              >
                {/* Timeline dot */}
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  marginTop: 5, zIndex: 1,
                  background: p.is_now ? '#22C55E' : p.is_done ? 'var(--line, #dbe4f0)' : col.border,
                  boxShadow: p.is_now ? '0 0 0 3px rgba(34,197,94,0.25)' : 'none',
                }} />

                {/* Period content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 12, fontWeight: p.is_now ? 700 : 600,
                      color: p.is_now ? 'var(--ink, #15172A)' : p.is_done ? 'var(--muted, #5B5E72)' : 'var(--ink, #15172A)',
                    }}>
                      P{p.period} · {p.subject}
                    </span>
                    {p.is_now && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 6px',
                        borderRadius: 4, background: '#dcfce7', color: '#15803D',
                      }}>
                        NOW
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--muted, #5B5E72)', margin: '2px 0 0' }}>
                    {p.class_name}-{p.section_name}
                    {p.room ? ` · Room ${p.room}` : ''}
                    {p.from ? ` · ${p.from}–${p.to}` : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
