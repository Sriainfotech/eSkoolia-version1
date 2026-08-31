"use client";

/**
 * Teacher Portal — Timetable Screen
 *
 * Displays the teacher's weekly timetable from /teacher/timetable/.
 * Scope-enforced on the backend — only the requesting teacher's slots.
 * Cells are colour-coded by subject (same hash function as TeacherDayPlanner).
 */

import { useEffect, useState } from "react";
import { AlertCircle, Calendar, Clock, RefreshCw } from "lucide-react";
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
  if (slot.is_break) {
    return (
      <div style={{
        padding: '6px 8px', borderRadius: 8,
        background: 'var(--bg-2, #F5F5FB)',
        border: '1px dashed var(--line, #dbe4f0)',
        fontSize: 10, color: 'var(--muted, #5B5E72)',
        textAlign: 'center',
      }}>
        Break
      </div>
    );
  }

  const col = subjectColor(slot.subject);
  return (
    <div style={{
      padding: '7px 9px', borderRadius: 8,
      background: col.bg,
      border: `1px solid ${col.border}`,
      position: 'relative',
      outline: slot.is_now ? `2px solid ${col.border}` : 'none',
      outlineOffset: 1,
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

// ── Empty cell ────────────────────────────────────────────────────────────────

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

  // All unique time slots across the week, sorted by start time. Rows are
  // keyed by (from, to) rather than `period` — `period`/class_period_id is a
  // deprecated legacy field (apps/academics/models.py::ClassRoutineSlot) and
  // is null for any school that hasn't configured ClassPeriod rows, which
  // would otherwise make every slot invisible despite real data existing.
  const allTimeSlots = Array.from(
    new Map(
      data.days.flatMap(d => d.periods.map(p => [`${p.from}-${p.to}`, { from: p.from, to: p.to }]))
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

      {/* ── KPI row ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <KpiCard
          label="Periods this week"
          value={data.kpis.total_periods}
          sub="Teaching slots"
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
          value={data.kpis.free_periods}
          sub="For grading & prep"
          icon={<Clock size={15} />}
        />
        <KpiCard
          label="Cover assignments"
          value={data.kpis.cover_assignments}
          sub="This week"
          icon={<Calendar size={15} />}
        />
      </div>

      {/* ── Timetable grid ────────────────────────────────────────────── */}
      {allTimeSlots.length === 0 ? (
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
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2,#F5F5FB)', borderBottom: '1px solid var(--line,#dbe4f0)' }}>
                <th style={{
                  width: 70, padding: '10px 14px', textAlign: 'left',
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--muted,#5B5E72)',
                }}>
                  Time
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
              {allTimeSlots.map((time) => (
                <tr key={`${time.from}-${time.to}`} style={{ borderBottom: '1px solid var(--line,#dbe4f0)' }}>
                  {/* Time range */}
                  <td style={{
                    padding: '8px 14px',
                    fontSize: 11, fontWeight: 700,
                    color: 'var(--muted,#5B5E72)',
                    background: 'var(--bg-2,#F5F5FB)',
                    borderRight: '1px solid var(--line,#dbe4f0)',
                    whiteSpace: 'nowrap',
                  }}>
                    {time.from}
                  </td>
                  {/* Day cells */}
                  {data.days.map(d => {
                    const slot = d.periods.find(p => p.from === time.from && p.to === time.to);
                    return (
                      <td key={d.day_key} style={{
                        padding: '6px 8px',
                        background: d.is_today ? 'rgba(238,234,255,0.3)' : 'transparent',
                        verticalAlign: 'top',
                        minWidth: 110,
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
