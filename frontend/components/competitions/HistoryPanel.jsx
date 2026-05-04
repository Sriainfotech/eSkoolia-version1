'use client';

import React, { useMemo, useState } from 'react';
import { inspireHubStore } from './inspireHubStore';

/**
 * HistoryPanel — browse all events with smart filters.
 *  Filters: search · status (drafts/final/all) · type · level · house · month · sort
 *  Each row: title + date + level + chips for participants/wins · click to edit.
 */
export default function HistoryPanel({ onEdit, onNew }) {
  const all = inspireHubStore.list();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('');
  const [level, setLevel] = useState('');
  const [month, setMonth] = useState('');
  const [sort, setSort] = useState('date_desc');
  const [tick, setTick] = useState(0); // force-refresh after delete
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    let rows = all.slice();
    if (status !== 'all') rows = rows.filter((r) => (r.status || 'draft') === status);
    if (q) {
      const t = q.toLowerCase();
      rows = rows.filter((r) =>
        (r.name || '').toLowerCase().includes(t) ||
        (r.location || '').toLowerCase().includes(t) ||
        (r.opponent || '').toLowerCase().includes(t) ||
        (r.notes || '').toLowerCase().includes(t)
      );
    }
    if (type)  rows = rows.filter((r) => (r.comp_type || '') === type);
    if (level) rows = rows.filter((r) => (r.level || '') === level);
    if (month !== '') rows = rows.filter((r) => r.date && new Date(r.date).getMonth() === Number(month));
    rows.sort((a, b) => {
      const ad = new Date(a.date || a.updated_at || 0).getTime();
      const bd = new Date(b.date || b.updated_at || 0).getTime();
      if (sort === 'date_asc') return ad - bd;
      if (sort === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sort === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      return bd - ad;
    });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, q, status, type, level, month, sort, tick]);

  const types = uniqVals(all, 'comp_type');
  const levels = uniqVals(all, 'level');
  const drafts = all.filter((r) => r.status === 'draft').length;

  function del(id, e) {
    e.stopPropagation();
    if (!window.confirm('Delete this event?')) return;
    inspireHubStore.remove(id); setTick((x) => x + 1);
  }
  function dup(c, e) {
    e.stopPropagation();
    const copy = { ...c, id: undefined, name: (c.name || '') + ' (copy)', status: 'draft' };
    delete copy.finalised_at;
    inspireHubStore.saveDraft(copy);
    setTick((x) => x + 1);
  }

  return (
    <div className="px-5 md:px-7 py-5 space-y-4">
      {/* Header strip */}
      <div className="flex flex-wrap items-end gap-3 pb-1">
        <div className="flex-1 min-w-[200px]">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500">Archive</div>
          <h3 className="text-[22px] font-extrabold text-slate-900 tracking-tight leading-tight">Past events &amp; drafts</h3>
          <p className="text-[12px] text-slate-500 mt-0.5">{all.length} events · {drafts} draft{drafts === 1 ? '' : 's'} · click any row to edit</p>
        </div>
        <button onClick={onNew} className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 text-[12px] font-bold shadow-sm transition">+ New event</button>
      </div>

      {/* Filter bar — labeled, chip-driven, with status pills + counts */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        {/* Search row */}
        <div>
          <Label>Search</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, location, opponent, notes…"
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-slate-200 bg-slate-50 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-300 focus:bg-white" />
            {q && (
              <button onClick={() => setQ('')} aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">×</button>
            )}
          </div>
        </div>

        {/* Status chip group — fastest filter, most-used, always visible */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Label>Status</Label>
            <div className="flex flex-wrap gap-1.5">
              <Chip on={status === 'all'}    onClick={() => setStatus('all')}    tone="slate">All <Count>{all.length}</Count></Chip>
              <Chip on={status === 'draft'}  onClick={() => setStatus('draft')}  tone="amber">Drafts <Count>{drafts}</Count></Chip>
              <Chip on={status === 'final'}  onClick={() => setStatus('final')}  tone="emerald">Finalised <Count>{all.length - drafts}</Count></Chip>
            </div>
          </div>
          <button type="button" onClick={() => setFiltersOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-700 hover:bg-slate-50">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
            More filters
            {(type || level || month !== '' || sort !== 'date_desc') && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-purple-600 text-white text-[10px] font-extrabold">
                {[type, level, month !== '' && month, sort !== 'date_desc' && sort].filter(Boolean).length}
              </span>
            )}
            <span className={'text-[10px] transition-transform ' + (filtersOpen ? 'rotate-180' : '')}>▾</span>
          </button>
        </div>

        {/* Collapsible advanced filters */}
        {filtersOpen && (
          <div className="pt-2 border-t border-slate-100 space-y-3 animate-[fadeIn_0.18s_ease-out]">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Field label="Type">
                <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
                  <option value="">Any type</option>
                  {types.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Level">
                <select value={level} onChange={(e) => setLevel(e.target.value)} className={selectCls}>
                  <option value="">Any level</option>
                  {levels.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Month">
                <select value={month} onChange={(e) => setMonth(e.target.value)} className={selectCls}>
                  <option value="">Any month</option>
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </Field>
              <Field label="Sort by">
                <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectCls}>
                  <option value="date_desc">Date · newest</option>
                  <option value="date_asc">Date · oldest</option>
                  <option value="name_asc">Name · A→Z</option>
                  <option value="name_desc">Name · Z→A</option>
                </select>
              </Field>
            </div>
          </div>
        )}

        {/* Active-filter summary */}
        {(q || status !== 'all' || type || level || month !== '' || sort !== 'date_desc') && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-500">
              Showing <b className="text-slate-800">{filtered.length}</b> of {all.length} · {[
                status !== 'all' && 'status',
                type && 'type',
                level && 'level',
                month !== '' && 'month',
                q && 'search',
                sort !== 'date_desc' && 'sort',
              ].filter(Boolean).length} active filter(s)
            </span>
            <button onClick={() => { setQ(''); setStatus('all'); setType(''); setLevel(''); setMonth(''); setSort('date_desc'); }}
              className="ml-auto rounded-full border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* In-list sort header — column-style click-to-sort */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 px-4 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
          <SortHeader label="Event"  field="name" sort={sort} setSort={setSort} className="flex-1" />
          <SortHeader label="Date"   field="date" sort={sort} setSort={setSort} className="w-32 hidden sm:block" />
          <span className="w-24 hidden md:block">Type</span>
          <span className="w-20 text-right">Status</span>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-[13px] font-semibold text-slate-700">No events match these filters yet.</p>
          <p className="text-[12px] text-slate-500 mt-1">Try clearing filters, or start a new event.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((c) => {
            const r = c.results || [];
            const wins = r.filter((x) => x.position === '1st').length;
            const reviewed = r.filter((x) => x.ai_response).length;
            const isDraft = (c.status || 'draft') === 'draft';
            return (
              <li key={c.id}>
                <button onClick={() => onEdit(c)}
                  className="group w-full text-left rounded-2xl bg-white ring-1 ring-slate-200/70 hover:ring-slate-900/30 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)] transition-all p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl ring-1 ring-slate-200">
                      {iconForType(c.comp_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-[14px] font-extrabold text-slate-900 truncate">{prettyName(c.name) || 'Untitled event'}</h4>
                        {isDraft
                          ? <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">DRAFT</span>
                          : <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">FINAL</span>}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-slate-500 flex items-center gap-2 flex-wrap">
                        {c.date && <span>📅 {fmtDate(c.date)}</span>}
                        {c.level && <span>· {c.level}</span>}
                        {c.comp_type && <span>· {c.comp_type}</span>}
                        {c.location && <span>· 📍 {c.location}</span>}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <Tag>{r.length} participant{r.length === 1 ? '' : 's'}</Tag>
                        {wins > 0 && <Tag tone="gold">🥇 {wins}</Tag>}
                        {reviewed > 0 && <Tag tone="purple">✨ {reviewed} review{reviewed === 1 ? '' : 's'}</Tag>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition">
                      <span onClick={(e) => dup(c, e)} className="cursor-pointer text-[10.5px] font-bold text-slate-500 hover:text-slate-900">⎘ Duplicate</span>
                      <span onClick={(e) => del(c.id, e)} className="cursor-pointer text-[10.5px] font-bold text-rose-500 hover:text-rose-700">🗑 Delete</span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function uniqVals(rows, k) { return Array.from(new Set(rows.map((r) => r[k]).filter(Boolean))).sort(); }
function fmtDate(d) { try { return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } }
function prettyName(s) {
  if (!s || typeof s !== 'string') return s;
  const small = new Set(['a','an','and','as','at','but','by','for','in','of','on','or','the','to','vs','via']);
  return s.trim().split(/\s+/).map((w, i) => {
    if (/^[A-Z]{2,}$/.test(w)) return w;
    if (i > 0 && small.has(w.toLowerCase())) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}
function iconForType(t) {
  const x = (t || '').toLowerCase();
  if (x.includes('sport') || x.includes('athlet')) return '🏆';
  if (x.includes('debate') || x.includes('quiz') || x.includes('academ')) return '🎓';
  if (x.includes('art') || x.includes('paint') || x.includes('craft')) return '🎨';
  if (x.includes('music') || x.includes('danc') || x.includes('cultur') || x.includes('drama')) return '🎭';
  if (x.includes('sci')) return '🔬';
  return '🏅';
}
function Pill({ children }) {
  return <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1.5">{children}</span>;
}
function Label({ children }) {
  return <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500 mb-1">{children}</div>;
}
function Field({ label, children }) {
  return <label className="block"><Label>{label}</Label>{children}</label>;
}
const selectCls =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400';
function Chip({ on, onClick, tone = 'slate', children }) {
  const tones = {
    slate:   on ? 'bg-slate-900 text-white border-slate-900'         : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400',
    amber:   on ? 'bg-amber-500 text-white border-amber-500'         : 'bg-white text-amber-800 border-amber-200 hover:border-amber-400',
    emerald: on ? 'bg-emerald-600 text-white border-emerald-600'     : 'bg-white text-emerald-800 border-emerald-200 hover:border-emerald-400',
  };
  return (
    <button type="button" onClick={onClick}
      className={'inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[11.5px] font-bold transition ' + tones[tone]}>
      {children}
    </button>
  );
}
function Count({ children }) {
  return <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-black/15 text-[10px] font-extrabold">{children}</span>;
}
function SortHeader({ label, field, sort, setSort, className = '' }) {
  const isActive = sort.startsWith(field);
  const isAsc = sort === field + '_asc';
  const next = isActive ? (isAsc ? field + '_desc' : field + '_asc') : field + '_desc';
  return (
    <button type="button" onClick={() => setSort(next)}
      className={'group inline-flex items-center gap-1 hover:text-slate-900 transition ' + className + (isActive ? ' text-slate-900' : '')}>
      {label}
      <span className={'text-[9px] ' + (isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-80')}>
        {isActive ? (isAsc ? '▲' : '▼') : '↕'}
      </span>
    </button>
  );
}
function Tag({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    gold: 'bg-amber-50 text-amber-800 border-amber-200',
    purple: 'bg-purple-50 text-purple-800 border-purple-200',
  };
  return <span className={'rounded-full border px-2 py-0.5 text-[10.5px] font-bold ' + tones[tone]}>{children}</span>;
}
