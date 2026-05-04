'use client';

import React, { useMemo, useState } from 'react';
import { inspireHubStore } from './inspireHubStore';

/**
 * DashboardPanel — innovative analytics across all finalised events.
 *  • Top KPIs (events, participants, reviews, gold medals)
 *  • House leaderboard (real names + colors)
 *  • Best-in-category cards (Top student / Top group / Most active month)
 *  • Recent wins ticker
 *  • Sparkline of monthly events
 */
export default function DashboardPanel({ houses = [], clubs = [] }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const agg = useMemo(() => inspireHubStore.aggregates({ year }), [year]);

  const houseColor = (h) => houses.find((x) => x.id === String(h.id) || x.name === h.name)?.color || '#7C3AED';
  const houseEmoji = (h) => houses.find((x) => x.id === String(h.id) || x.name === h.name)?.emoji || '🏛';
  const groupEmoji = (g) => clubs.find((x) => x.id === String(g.id) || x.name === g.name)?.emoji || '🎯';

  const totalHousePoints = agg.houses.reduce((s, h) => s + h.points, 0) || 1;
  const goldCount = agg.events.reduce((s, c) => s + (c.results || []).filter((r) => r.position === '1st').length, 0);
  const peakMonthIdx = agg.monthly.indexOf(Math.max(...agg.monthly));

  const bestStudent = agg.students[0];
  const bestGroup = agg.groups[0];
  const bestHouse = agg.houses[0];

  return (
    <div className="px-5 md:px-7 py-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end gap-3 pb-1">
        <div className="flex-1 min-w-[200px]">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500">Overview</div>
          <h3 className="text-[22px] font-extrabold text-slate-900 tracking-tight leading-tight">A snapshot of school spirit</h3>
          <p className="text-[12px] text-slate-500 mt-0.5">{agg.eventCount} finalised · {agg.participantCount} participations · {agg.reviewCount} AI reviews</p>
        </div>
        <YearPicker year={year} onChange={setYear} />
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Events"         value={agg.eventCount}       hint="finalised this year" accent="indigo"
          tooltip={`Total competitions you've finalised in ${year}. A draft becomes an event once you click "Finalise" in Compose. Includes all types: academic, sports, cultural, arts, debate, and STEM.`}
          icon={<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>} />
        <Kpi label="Participations" value={agg.participantCount} hint="across all events"   accent="rose"
          tooltip="Total student-event entries. A student who appears in 3 events counts 3 times. Useful for measuring how widely students are engaging across the school year."
          icon={<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
        <Kpi label="Gold Medals"    value={goldCount}            hint="1st place finishes"  accent="amber"
          tooltip="Number of 1st-place positions awarded across all finalised events. Each event can award multiple golds (e.g. team events with co-winners)."
          icon={<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="14" r="6"/><path d="M8 2l4 6 4-6M9 14l3 2 3-2"/></svg>} />
        <Kpi label="AI Reviews"     value={agg.reviewCount}      hint="generated & saved"   accent="emerald"
          tooltip="Personalised AI-written feedback notes that are saved against each participant. You can edit them inline before finalising."
          icon={<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l1.6 4.6L18 8l-4.4 1.4L12 14l-1.6-4.6L6 8l4.4-1.4L12 2zM19 14l.8 2.4L22 17l-2.2.6L19 20l-.8-2.4L16 17l2.2-.6L19 14z"/></svg>} />
      </div>

      {/* Best-in-category strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <BestCard
          title="Best House"
          name={bestHouse ? `${houseEmoji(bestHouse)} ${bestHouse.name}` : '—'}
          subtitle={bestHouse ? `${bestHouse.points} pts · ${bestHouse.wins} gold${bestHouse.wins === 1 ? '' : 's'}` : 'No data yet'}
          color={bestHouse ? houseColor(bestHouse) : '#7C3AED'}
          tooltip="The house with the highest cumulative points across all finalised events this year. Points come from podium positions (1st=10, 2nd=7, 3rd=5) and are configurable per-card."
          icon={<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V8l9-5 9 5v13M9 21V12h6v9"/></svg>}
        />
        <BestCard
          title="Top Student"
          name={bestStudent ? bestStudent.name : '—'}
          subtitle={bestStudent ? `${bestStudent.points} pts${bestStudent.class_name ? ' · ' + bestStudent.class_name : ''}` : 'No data yet'}
          color="#0EA5E9"
          tooltip="The single student with the highest individual points total this year, summed across every event they participated in."
          icon={<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.42M12 14L5.84 10.58M12 14v7"/></svg>}
        />
        <BestCard
          title="Top Group / Club"
          name={bestGroup ? `${groupEmoji(bestGroup)} ${bestGroup.name}` : '—'}
          subtitle={bestGroup ? `${bestGroup.points} pts · ${bestGroup.wins} win${bestGroup.wins === 1 ? '' : 's'}` : 'No data yet'}
          color="#10B981"
          tooltip="The student group / club whose members have collectively earned the most points this year. Helps recognise high-performing co-curricular communities."
          icon={<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="4"/><path d="M21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>}
        />
      </div>

      {/* House leaderboard + monthly chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-white p-5 ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-[14px] font-extrabold text-slate-900 tracking-tight">House Leaderboard</h4>
              <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">cumulative points across all events</p>
            </div>
            {agg.houses[0] && <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Leading: <span className="text-slate-900">{agg.houses[0].name}</span></span>}
          </div>
          {agg.houses.length === 0 ? (
            <EmptyState text="No house points yet — finalise events to see the leaderboard." />
          ) : (
            <ul className="space-y-2.5">
              {agg.houses.map((h, i) => {
                const pct = Math.max(4, Math.round((h.points / totalHousePoints) * 100));
                return (
                  <li key={(h.id || h.name) + i} className="flex items-center gap-3">
                    <span className="w-5 text-center text-[12px] font-bold text-slate-500">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[13px] font-bold text-slate-900 truncate">{houseEmoji(h)} {h.name}</span>
                        <span className="text-[11.5px] font-bold text-slate-700">{h.points} pts · {h.wins}🥇</span>
                      </div>
                      <div className="mt-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: pct + '%', background: `linear-gradient(90deg, ${houseColor(h)}, ${houseColor(h)}cc)` }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-[14px] font-extrabold text-slate-900 tracking-tight">Activity Pulse</h4>
              <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">events held per month · {year}</p>
            </div>
          </div>
          <MonthlyBars data={agg.monthly} peakIdx={peakMonthIdx} />
          <p className="mt-3 text-[11px] text-slate-500">
            Peak: <span className="font-bold text-slate-900">{MONTHS[peakMonthIdx] || '—'}</span> · {agg.monthly[peakMonthIdx] || 0} event{agg.monthly[peakMonthIdx] === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Recent wins */}
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/70">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-[14px] font-extrabold text-slate-900 tracking-tight">Recent Wins</h4>
            <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">latest podium finishes across the school</p>
          </div>
        </div>
        {agg.recent.length === 0 ? (
          <EmptyState text="No podium finishes yet — finalise an event to populate recent wins." />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {agg.recent.map((r, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 ring-1 ring-slate-200/70 px-3 py-2.5">
                <span className="text-2xl">{medalIcon(r.position)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-extrabold text-slate-900 truncate">{r.student}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {r.event}{r.comp_type ? ' · ' + r.comp_type : ''}{r.class_name ? ' · ' + r.class_name : ''}
                  </div>
                </div>
                <span className="text-[10.5px] font-semibold text-slate-400">{r.date ? fmtDate(r.date) : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function Kpi({ label, value, hint, accent = 'slate', icon, tooltip }) {
  const accents = {
    indigo:  { ring: 'ring-indigo-200',  chip: 'bg-gradient-to-br from-indigo-500 to-violet-600',  num: 'from-indigo-700 to-violet-700',  bg: 'from-indigo-50 via-white to-white' },
    rose:    { ring: 'ring-rose-200',    chip: 'bg-gradient-to-br from-rose-500 to-pink-600',      num: 'from-rose-700 to-pink-700',      bg: 'from-rose-50 via-white to-white' },
    amber:   { ring: 'ring-amber-200',   chip: 'bg-gradient-to-br from-amber-400 to-orange-500',   num: 'from-amber-600 to-orange-700',   bg: 'from-amber-50 via-white to-white' },
    emerald: { ring: 'ring-emerald-200', chip: 'bg-gradient-to-br from-emerald-500 to-teal-600',   num: 'from-emerald-700 to-teal-700',   bg: 'from-emerald-50 via-white to-white' },
    slate:   { ring: 'ring-slate-200',   chip: 'bg-gradient-to-br from-slate-500 to-slate-700',    num: 'from-slate-800 to-slate-900',    bg: 'from-slate-50 via-white to-white' },
  }[accent] || {};
  return (
    <div className={'group relative overflow-visible rounded-2xl bg-gradient-to-br ' + accents.bg + ' p-4 ring-1 ' + accents.ring + ' hover:shadow-md transition'}
         tabIndex={0} role="button" aria-label={`${label}: ${value}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={'inline-flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-md ' + accents.chip}>
          {icon}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</span>
          {tooltip && <InfoDot />}
        </div>
      </div>
      <div className={'relative mt-2 text-[30px] font-black leading-none tracking-tight bg-gradient-to-br bg-clip-text text-transparent ' + accents.num}>{value}</div>
      <div className="relative mt-1.5 text-[10.5px] text-slate-500 font-medium">{hint}</div>
      {tooltip && <Tooltip text={tooltip} title={label} />}
    </div>
  );
}
function BestCard({ title, name, subtitle, color, icon, tooltip }) {
  return (
    <div className="group relative rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 hover:shadow-lg hover:-translate-y-0.5 transition overflow-visible"
         tabIndex={0} role="button" aria-label={`${title}: ${name}`}>
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: color }} />
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-15 blur-2xl pointer-events-none" style={{ background: color }} />
      <div className="relative flex items-center justify-between">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-md" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
          {icon}
        </span>
        <div className="flex items-center gap-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{title}</div>
          {tooltip && <InfoDot />}
        </div>
      </div>
      <div className="relative mt-2.5 text-[18px] font-extrabold text-slate-900 tracking-tight truncate">{name}</div>
      <div className="relative text-[11.5px] text-slate-500 mt-0.5">{subtitle}</div>
      <div className="relative mt-3 h-px w-full bg-slate-100" />
      <div className="relative mt-2 flex items-center justify-between text-[10.5px] text-slate-400 font-medium">
        <span>this academic year</span>
        <span className="font-semibold opacity-0 group-hover:opacity-100 transition" style={{ color }}>View →</span>
      </div>
      {tooltip && <Tooltip text={tooltip} title={title} />}
    </div>
  );
}
function InfoDot() {
  return (
    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-200 text-slate-600 text-[8.5px] font-extrabold cursor-help"
          aria-label="More info">i</span>
  );
}
function Tooltip({ title, text }) {
  // CSS-only tooltip — appears on group-hover/focus, vanishes on leave/blur.
  return (
    <div role="tooltip"
         className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-64
                    opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0
                    group-focus-within:opacity-100 group-focus-within:translate-y-0
                    transition-all duration-150
                    rounded-xl bg-slate-900 text-white shadow-2xl ring-1 ring-black/10 px-3 py-2.5">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-300 mb-1">{title}</div>
      <div className="text-[11.5px] leading-snug text-slate-100">{text}</div>
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-slate-900" />
    </div>
  );
}
function MonthlyBars({ data, peakIdx }) {
  const max = Math.max(1, ...data);
  return (
    <div className="flex items-end gap-1 h-28">
      {data.map((v, i) => {
        const h = (v / max) * 100;
        const isPeak = i === peakIdx && v > 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
            <div className={'w-full rounded-md transition-all duration-700 ' +
              (isPeak ? 'bg-gradient-to-t from-fuchsia-600 to-indigo-500 shadow-md' : (v > 0 ? 'bg-gradient-to-t from-indigo-300 to-indigo-200 hover:from-indigo-400 hover:to-indigo-300' : 'bg-slate-100'))}
              style={{ height: Math.max(4, h) + '%' }} title={`${MONTHS[i]}: ${v}`} />
            <span className={'text-[9.5px] font-semibold ' + (isPeak ? 'text-fuchsia-700' : 'text-slate-500')}>{MONTHS[i][0]}</span>
          </div>
        );
      })}
    </div>
  );
}
function YearPicker({ year, onChange }) {
  const cur = new Date().getFullYear();
  return (
    <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {[cur - 2, cur - 1, cur].map((y) => (
        <button key={y} onClick={() => onChange(y)}
          className={'px-3 py-1 rounded-lg text-[12px] font-bold transition ' + (y === year ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50')}>
          {y}
        </button>
      ))}
    </div>
  );
}
function EmptyState({ text }) {
  return <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-[12px] text-slate-500">{text}</div>;
}
function medalIcon(p) { return p === '1st' ? '🥇' : p === '2nd' ? '🥈' : p === '3rd' ? '🥉' : '🎖'; }
function fmtDate(d) { try { return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }); } catch { return d; } }
