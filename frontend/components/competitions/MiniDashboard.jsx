'use client';

import React, { useMemo, useState } from 'react';

/**
 * MiniDashboard — compact in-Compose snapshot.
 *  • Top row: 1st / 2nd / 3rd tiles each showing winner name(s) beside the medal
 *    (multiple winners → just names; single winner → name + class · sec)
 *  • Collapsible "Other outcomes" row for Consolation / Participation / Not Participated
 *    (these can balloon to dozens of rows in big events — hidden by default)
 *  • AI-review progress bar
 */
export default function MiniDashboard({ results = [], houses = [] }) {
  const [showOther, setShowOther] = useState(false);

  const groups = useMemo(() => {
    const g = { '1st': [], '2nd': [], '3rd': [], 'Consolation': [], 'Participation': [], 'Not Participated': [] };
    results.forEach((r) => { if (r.position && g[r.position]) g[r.position].push(r); });
    return g;
  }, [results]);

  const total       = results.length;
  const points      = results.reduce((s, r) => s + Number(r.points || 0), 0);
  const reviewed    = results.filter((r) => r.ai_response).length;
  const reviewedPct = total ? Math.round((reviewed / total) * 100) : 0;

  const houseLookup = (id, name) => houses.find((h) => h.id === id || h.id === String(id) || h.name === name);

  const podium = [
    { key: '1st', label: '1st place', icon: '🥇', tint: 'bg-amber-50 ring-amber-200',  badge: 'bg-gradient-to-br from-amber-300 to-orange-400', accent: 'text-amber-900' },
    { key: '2nd', label: '2nd place', icon: '🥈', tint: 'bg-slate-50 ring-slate-200',  badge: 'bg-gradient-to-br from-slate-300 to-zinc-400',   accent: 'text-slate-800' },
    { key: '3rd', label: '3rd place', icon: '🥉', tint: 'bg-orange-50 ring-orange-200', badge: 'bg-gradient-to-br from-orange-300 to-amber-400', accent: 'text-orange-900' },
  ];

  const others = [
    { key: 'Consolation',    label: 'Consolation',    icon: '🎖', tint: 'bg-teal-50 ring-teal-200',       accent: 'text-teal-900' },
    { key: 'Participation',  label: 'Participation',  icon: '✅', tint: 'bg-emerald-50 ring-emerald-200', accent: 'text-emerald-900' },
    { key: 'Not Participated', label: 'Not Participated', icon: '🚫', tint: 'bg-rose-50 ring-rose-200',  accent: 'text-rose-900' },
  ];
  const otherTotal = others.reduce((s, o) => s + groups[o.key].length, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white text-[11px] font-extrabold">3</span>
        <h3 className="text-[13.5px] font-extrabold text-slate-900">Snapshot</h3>
        <span className="ml-auto text-[11px] text-slate-500"><b className="text-slate-900">{points}</b> total points · {total} entries</span>
      </div>

      {/* Podium tiles — winner-aware */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {podium.map((p) => {
          const winners = groups[p.key];
          return (
            <div key={p.key} className={'rounded-xl ring-1 ' + p.tint + ' p-3'}>
              <div className="flex items-center gap-2.5">
                <span className={'inline-flex h-9 w-9 items-center justify-center rounded-xl text-[18px] shadow-sm ring-2 ring-white shrink-0 ' + p.badge}>
                  {p.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-600">{p.label}</div>
                    <div className={'text-[15px] font-black leading-none ' + p.accent}>{winners.length}</div>
                  </div>
                  {winners.length === 0 ? (
                    <div className="mt-1 text-[10.5px] text-slate-400 italic">— not assigned —</div>
                  ) : winners.length === 1 ? (
                    <WinnerLine row={winners[0]} houseLookup={houseLookup} compact />
                  ) : (
                    <div className="mt-1 space-y-0.5">
                      {winners.slice(0, 3).map((w, i) => (
                        <div key={(w.student_id || i) + '-' + i} className="text-[11px] font-bold text-slate-800 truncate">
                          {w._student?.full_name || '—'}
                        </div>
                      ))}
                      {winners.length > 3 && (
                        <div className="text-[10px] font-semibold text-slate-500">+{winners.length - 3} more</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Consolation pill — small inline indicator (Part/NP moved to dedicated section) */}
      {groups['Consolation'].length > 0 && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-teal-50 ring-1 ring-teal-200 px-3 py-1.5 text-[11.5px] font-bold text-teal-900">
          <span aria-hidden>🎖</span>
          <span>{groups['Consolation'].length} Consolation</span>
        </div>
      )}

      {/* AI Reviews progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-pink-500 text-white text-[8px] font-extrabold">AI</span>
            Reviews
          </span>
          <span>{reviewed}/{total} · {reviewedPct}%</span>
        </div>
        <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
               style={{ width: reviewedPct + '%' }} />
        </div>
      </div>
    </div>
  );
}

function WinnerLine({ row, houseLookup, compact }) {
  const s = row._student || {};
  const h = houseLookup(s.house_id, s.house_name);
  const houseColor = h?.color || '#7C3AED';
  return (
    <div className="mt-1 min-w-0">
      <div className="text-[12px] font-extrabold text-slate-900 truncate">{s.full_name || '—'}</div>
      <div className="mt-0.5 flex items-center gap-1 flex-wrap text-[10.5px] text-slate-500">
        {s.admission_no && <span className="font-mono">{s.admission_no}</span>}
        {s.class_name && <span>· {s.class_name}{s.section && s.section !== '-' ? `-${s.section}` : ''}</span>}
        {s.house_name && (
          <span className="inline-flex items-center gap-0.5 rounded-md px-1 py-0 text-[9.5px] font-bold ring-1"
                style={{ background: houseColor + '15', color: houseColor, borderColor: houseColor }}>
            <span className="inline-block h-1 w-1 rounded-full" style={{ background: houseColor }} />
            {s.house_name}
          </span>
        )}
      </div>
    </div>
  );
}
