"use client";

/**
 * Teacher Portal — Timetable Screen
 *
 * Displays the teacher's weekly timetable from /teacher/timetable/. Every
 * row is a real period from the school's ClassPeriod grid (when configured)
 * — teaching, break, or genuinely free — not just whichever slots happen to
 * have data. A day with gaps between classes previously rendered as blank
 * grid cells with a permanently-0 "free periods" KPI; both are fixed here.
 *
 * Falls back to a slots-only view (has_period_grid: false) for schools that
 * haven't configured periods yet — there, "free" can't be inferred, so we
 * say so instead of guessing.
 */

import { useEffect, useState } from "react";
import { AlertCircle, Calendar, Clock, Coffee, RefreshCw, Sparkles, LayoutGrid } from "lucide-react";
import { fetchTeacherTimetable, type TeacherTimetable, type TimetableSlot } from "@/lib/api/teacher";

// ── Subject colour (deterministic hash) ──────────────────────────────────────

const SUBJECT_COLORS = [
  { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' },
  { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  { bg: '#FDF4FF', text: '#A21CAF', border: '#E9D5FF' },
  { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
];

function subjectColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % SUBJECT_COLORS.length;
  return SUBJECT_COLORS[hash];
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon }: { label: string; value: number | string; sub: string; icon: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--line, #dbe4f0)',
      borderRadius: 12, padding: '14px 16px',
      boxShadow: 'var(--shadow, 0 4px 12px -4px rgba(15,18,34,0.08))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted, #5B5E72)' }}>
          {label}
        </span>
        <span style={{ color: 'var(--muted, #5B5E72)', opacity: 0.7 }}>{icon}</span>
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink, #15172A)', lineHeight: 1, margin: 0 }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: 'var(--muted, #5B5E72)', marginTop: 4 }}>{sub}</p>
    </div>
  );
}

// ── Timetable cell ────────────────────────────────────────────────────────────

function PeriodCell({ slot }: { slot: TimetableSlot }) {
  if (slot.status === 'break') {
    return (
      <div style={{
        padding: '7px 9px', borderRadius: 8, minHeight: 52,
        background: 'var(--bg-2, #F5F5FB)',
        border: '1px dashed var(--line, #dbe4f0)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      }}>
        <Coffee size={11} color="var(--muted,#5B5E72)" />
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted, #5B5E72)' }}>Break</span>
      </div>
    );
  }

  if (slot.status === 'free') {
    return (
      <div style={{
        padding: '7px 9px', borderRadius: 8, minHeight: 52,
        background: '#fff',
        border: '1px dashed #D6D7E0',
        outline: slot.is_now ? '2px solid #D6D7E0' : 'none',
        outlineOffset: 1,
        position: 'relative',
      }}>
        {slot.is_now && (
          <span style={{
            position: 'absolute', top: -5, right: 4,
            width: 7, height: 7, borderRadius: '50%',
            background: '#22C55E',
            boxShadow: '0 0 0 2px rgba(34,197,94,0.3)',
          }} />
        )}
        <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted,#5B5E72)', margin: 0 }}>Free</p>
        {slot.from && (
          <p style={{ fontSize: 9, color: 'var(--muted,#5B5E72)', opacity: 0.75, margin: '2px 0 0' }}>
            {slot.from}–{slot.to}
          </p>
        )}
      </div>
    );
  }

  const col = subjectColor(slot.subject);
  return (
    <div style={{
      padding: '7px 9px', borderRadius: 8, minHeight: 52,
      background: col.bg,
      border: `1px solid ${col.border}`,
      position: 'relative',
      outline: slot.is_now ? `2px solid ${col.border}` : 'none',
      outlineOffset: 1,
      opacity: slot.is_done ? 0.6 : 1,
    }}>
      {slot.is_now && (
        <span style={{
          position: 'absolute', top: -5, right: 4,
          width: 7, height: 7, borderRadius: '50%',
          background: '#22C55E',
          boxShadow: '0 0 0 2px rgba(34,197,94,0.3)',
        }} />
      )}
      <p style={{ fontSize: 11, fontWeight: 700, color: col.text, margin: 0, lineHeight: 1.3 }}>
        {slot.subject}
      </p>
      <p style={{ fontSize: 10, color: col.text, opacity: 0.8, margin: '2px 0 0' }}>
        {slot.class_name}-{slot.section_name}
        {slot.room ? ` · ${slot.room}` : ''}
      </p>
      {slot.from && (
        <p style={{ fontSize: 9, color: col.text, opacity: 0.65, margin: '2px 0 0' }}>
          {slot.from}–{slot.to}
        </p>
      )}
    </div>
  );
}

// ── Empty cell (no data for this day+time at all — fallback mode only) ───────

function EmptyCell() {
  return (
    <div style={{
      padding: '6px', borderRadius: 8,
      background: 'transparent',
      border: '1px dashed transparent',
      minHeight: 52,
    }} />
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ w = '100%', h = 14 }: { w?: string | number; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 6,
      backgroundImage: 'linear-gradient(90deg, var(--line,#dbe4f0) 25%, var(--bg-2,#f5f5fb) 50%, var(--line,#dbe4f0) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeacherTimetablePage() {
  const [data, setData] = useState<TeacherTimetable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetchTeacherTimetable()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <Skeleton w={160} h={11} />
          <div style={{ marginTop: 8 }}><Skeleton w={280} h={24} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--line,#dbe4f0)' }}>
              <Skeleton w="60%" h={9} />
              <div style={{ marginTop: 10 }}><Skeleton w="40%" h={24} /></div>
            </div>
          ))}
        </div>
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid var(--line,#dbe4f0)' }}>
          <Skeleton h={200} />
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div style={{
        maxWidth: 480, margin: '60px auto', textAlign: 'center',
        background: '#fff', border: '1px solid var(--line,#dbe4f0)',
        borderRadius: 14, padding: '40px 24px',
      }}>
        <AlertCircle size={32} color="var(--red,#E0463A)" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink,#15172A)', marginBottom: 6 }}>
          Could not load timetable
        </p>
        <p style={{ fontSize: 13, color: 'var(--muted,#5B5E72)', marginBottom: 16 }}>
          {error ?? 'Unexpected error.'}
        </p>
        <button
          onClick={load}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--soft,#EEEAFF)', color: 'var(--brand,#6D4AFF)',
            border: '1px solid #ddd6fe', cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  // When the school has a period grid, every day carries an identical set of
  // period rows (teaching/break/free) — use the first non-empty day as the
  // row template rather than re-deriving it. Without a grid, fall back to a
  // union of whatever real times exist anywhere in the week (old behaviour),
  // since there's nothing else to build rows from.
  const templateDay = data.days.find(d => d.periods.length > 0);
  const rows: { from: string; to: string; period_label: string }[] = data.has_period_grid && templateDay
    ? templateDay.periods.map(p => ({ from: p.from, to: p.to, period_label: p.period_label }))
    : Array.from(
        new Map(
          data.days.flatMap(d => d.periods.map(p => [`${p.from}-${p.to}`, { from: p.from, to: p.to, period_label: p.period_label }]))
        ).values()
      ).sort((a, b) => a.from.localeCompare(b.from));

  return (
    <div>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--muted,#5B5E72)', marginBottom: 4,
        }}>
          Teacher Portal &nbsp;·&nbsp; Timetable
        </p>
        <h1 style={{
          fontSize: 26, fontWeight: 700,
          fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)",
          color: 'var(--ink,#15172A)', margin: 0, lineHeight: 1.15,
        }}>
          My <em style={{ fontWeight: 400, color: 'var(--brand,#6D4AFF)', fontStyle: 'italic' }}>Timetable</em>
        </h1>
        <p style={{ fontSize: 12, color: 'var(--muted,#5B5E72)', marginTop: 4 }}>
          Week of {data.week_of} &nbsp;·&nbsp; Mon–Sat
        </p>
      </div>

      {/* ── No period grid — explain why free periods aren't shown ──────── */}
      {!data.has_period_grid && rows.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
          padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400E',
        }}>
          <Sparkles size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Your school hasn&rsquo;t set up period times yet, so only your assigned classes are shown below —
            free periods between them can&rsquo;t be worked out until periods are configured.
          </span>
        </div>
      )}

      {/* ── KPI row ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <KpiCard
          label="Teaching periods"
          value={data.kpis.total_periods}
          sub="This week"
          icon={<Clock size={15} />}
        />
        <KpiCard
          label="Teaching days"
          value={data.kpis.teaching_days}
          sub="Days with classes"
          icon={<Calendar size={15} />}
        />
        <KpiCard
          label="Free periods"
          value={data.has_period_grid ? data.kpis.free_periods : '—'}
          sub={data.has_period_grid ? 'For grading & prep' : 'Needs period setup'}
          icon={<Clock size={15} />}
        />
        <KpiCard
          label="Sections taught"
          value={data.kpis.sections_taught}
          sub="Distinct class-sections"
          icon={<LayoutGrid size={15} />}
        />
      </div>

      {/* ── Timetable grid ────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div style={{
          background: '#fff', border: '1.5px dashed var(--line,#dbe4f0)',
          borderRadius: 14, padding: '56px 24px', textAlign: 'center',
        }}>
          <Calendar size={32} color="var(--muted,#5B5E72)" style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink,#15172A)', marginBottom: 6 }}>
            No timetable configured yet
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted,#5B5E72)' }}>
            Ask your administrator to set up the class timetable.
          </p>
        </div>
      ) : (
        <div style={{
          background: '#fff', border: '1px solid var(--line,#dbe4f0)',
          borderRadius: 14, overflow: 'auto',
          boxShadow: 'var(--shadow,0 4px 12px -4px rgba(15,18,34,0.08))',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2,#F5F5FB)', borderBottom: '1px solid var(--line,#dbe4f0)' }}>
                <th style={{
                  width: 90, padding: '10px 14px', textAlign: 'left',
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--muted,#5B5E72)',
                }}>
                  Period
                </th>
                {data.days.map(d => (
                  <th key={d.day_key} style={{
                    padding: '10px 10px', textAlign: 'left',
                    fontSize: 11, fontWeight: d.is_today ? 700 : 600,
                    color: d.is_today ? 'var(--brand,#6D4AFF)' : 'var(--ink,#15172A)',
                    background: d.is_today ? 'var(--soft,#EEEAFF)' : 'transparent',
                    borderRadius: d.is_today ? '8px 8px 0 0' : 0,
                  }}>
                    {d.day}
                    {d.is_today && (
                      <span style={{
                        marginLeft: 6, fontSize: 9, fontWeight: 700,
                        padding: '1px 5px', borderRadius: 4,
                        background: 'var(--brand,#6D4AFF)', color: '#fff',
                      }}>Today</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.from}-${row.to}`} style={{ borderBottom: '1px solid var(--line,#dbe4f0)' }}>
                  {/* Period + time */}
                  <td style={{
                    padding: '8px 14px',
                    background: 'var(--bg-2,#F5F5FB)',
                    borderRight: '1px solid var(--line,#dbe4f0)',
                    whiteSpace: 'nowrap',
                  }}>
                    {row.period_label && (
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink,#15172A)', margin: 0 }}>{row.period_label}</p>
                    )}
                    <p style={{ fontSize: 10, fontWeight: row.period_label ? 500 : 700, color: 'var(--muted,#5B5E72)', margin: row.period_label ? '1px 0 0' : 0 }}>
                      {row.from}
                    </p>
                  </td>
                  {/* Day cells */}
                  {data.days.map(d => {
                    const slot = d.periods.find(p => p.from === row.from && p.to === row.to);
                    return (
                      <td key={d.day_key} style={{
                        padding: '6px 8px',
                        background: d.is_today ? 'rgba(238,234,255,0.3)' : 'transparent',
                        verticalAlign: 'top',
                        minWidth: 118,
                      }}>
                        {slot ? <PeriodCell slot={slot} /> : <EmptyCell />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
