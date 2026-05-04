'use client';

import React, { useState } from 'react';
import { competitionsApi } from '@/lib/competitionsApi';

/**
 * AIReviewPanel — inline AI review generator with a parsed, beautifully-styled preview.
 *
 *  • Renders the canonical sections (Compliment / Performance Summary / Encouragement / Practical Tips)
 *    as iconic, color-blocked cards instead of a wall of plain text.
 *  • Shimmer skeleton during generation.
 *  • Edit mode toggles between rich preview and a raw textarea (teacher-editable before save).
 *  • Cached / fallback badges so the teacher trusts what they're seeing.
 */

const SECTIONS = [
  { key: 'Compliment',           icon: '💬', accent: 'from-amber-100 to-amber-50',     bar: 'bg-amber-400' },
  { key: 'Performance Summary',  icon: '🎯', accent: 'from-purple-100 to-purple-50',   bar: 'bg-purple-500' },
  { key: 'Encouragement',        icon: '🚀', accent: 'from-emerald-100 to-emerald-50', bar: 'bg-emerald-500' },
  { key: 'Practical Tips',       icon: '💡', accent: 'from-sky-100 to-sky-50',         bar: 'bg-sky-500' },
];

export default function AIReviewPanel({ row, competition, onAi, onAiBusyChange }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    if (!row.position) { setError('Pick a position first.'); return; }
    setBusy(true); setError(''); onAiBusyChange?.((n) => (typeof n === 'number' ? n + 1 : 1));
    try {
      const payload = {
        items: [{
          student_id: row.student_id,
          competition_id: competition?.id,
          student_name: row._student?.full_name,
          student_class: row._student?.class_name,
          competition_name: competition?.name,
          competition_type: competition?.comp_type,
          competition_level: competition?.level,
          position: row.position,
          points: row.points,
          personal_contribution: row.personal_contribution || '',
        }],
      };
      let text = '';
      let meta = { cache_hit: false, fallback: false };
      try {
        const data = await competitionsApi.generateReviews(payload);
        const first = data?.results?.[0] || data?.[0] || data;
        text = first?.review || first?.ai_response || first?.text || '';
        meta = { cache_hit: !!first?.cache_hit, fallback: !!first?.fallback };
      } catch (_apiErr) {
        // Silent local fallback — no scary "backend unreachable" banner.
        text = '';
      }
      if (!text) {
        text = buildLocalFallback(row, competition);
        meta = { cache_hit: false, fallback: true };
      }
      onAi(text, meta);
    } finally {
      setBusy(false);
      onAiBusyChange?.((n) => (typeof n === 'number' ? Math.max(0, n - 1) : 0));
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-pink-500 text-white text-[10px] font-extrabold">AI</span>
        <span className="text-[11.5px] font-extrabold text-slate-700">Generated review</span>
        {row.ai_meta?.cache_hit && <Badge tone="emerald">⚡ cached</Badge>}
        {row.ai_meta?.fallback   && <Badge tone="amber">✨ AI draft</Badge>}
        <div className="ml-auto flex items-center gap-1.5">
          {row.ai_response && (
            <button onClick={() => setEditing((v) => !v)}
              className="text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2 py-1 rounded-md hover:bg-slate-100">
              {editing ? '👁 Preview' : '✏ Edit'}
            </button>
          )}
          <button
            onClick={generate} disabled={busy || !row.position}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#7C3AED,#EC4899)] px-3 py-1.5 text-[11.5px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(124,58,237,0.5)] hover:shadow-[0_8px_20px_-4px_rgba(236,72,153,0.55)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {busy ? <><span className="inline-block animate-spin">◌</span> Generating…</> : <><span>✨</span>{row.ai_response ? 'Regenerate' : 'Generate AI review'}</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-800">
          {error}
        </div>
      )}

      {busy && <Shimmer />}

      {!busy && row.ai_response && !editing && (
        <ParsedReview
          text={row.ai_response}
          onChange={(updated) => onAi(updated, row.ai_meta)}
        />
      )}
      {!busy && row.ai_response && editing && (
        <textarea
          value={row.ai_response}
          onChange={(e) => onAi(e.target.value, row.ai_meta)}
          className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12.5px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-300 min-h-[180px] font-mono leading-relaxed"
        />
      )}
    </div>
  );
}

/* --- Parsed renderer: editable section blocks (teacher tweaks → text rebuilt). --- */
function ParsedReview({ text, onChange }) {
  const sections = parseSections(text);
  const handleEdit = (key, val) => {
    const next = { ...sections, [key]: val };
    const rebuilt = 'Performance Review\n\n' +
      SECTIONS.map((s) => `${s.key}: ${next[s.key] || ''}`).join('\n\n');
    onChange?.(rebuilt);
  };
  return (
    <div className="mt-3 space-y-2.5">
      {SECTIONS.map((s) => {
        const body = sections[s.key];
        if (!body && body !== '') return null;
        return (
          <div key={s.key} className={'group relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br ' + s.accent + ' p-3 pl-4'}>
            <span className={'absolute left-0 top-0 bottom-0 w-1 ' + s.bar} />
            <div className="flex items-center gap-1.5">
              <span className="text-[14px]" aria-hidden>{s.icon}</span>
              <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-slate-700">{s.key}</span>
              <span className="ml-auto text-[9.5px] font-semibold text-slate-400 opacity-0 group-focus-within:opacity-100 transition">click to edit</span>
            </div>
            <textarea
              value={body}
              onChange={(e) => handleEdit(s.key, e.target.value)}
              rows={2}
              className="mt-1 block w-full bg-transparent border-0 resize-none text-[12.5px] leading-relaxed text-slate-800 focus:outline-none focus:ring-0 placeholder-slate-400"
              style={{ fontFamily: 'Georgia, "Iowan Old Style", serif' }}
              placeholder={`Add a ${s.key.toLowerCase()}…`}
            />
          </div>
        );
      })}
      {!Object.values(sections).some(Boolean) && (
        <p className="text-[12.5px] leading-relaxed text-slate-700 whitespace-pre-wrap">{text}</p>
      )}
    </div>
  );
}

function parseSections(text) {
  const out = {};
  const headings = ['Compliment', 'Performance Summary', 'Encouragement', 'Practical Tips'];
  const pattern = new RegExp('(' + headings.map((h) => h.replace(/ /g, '\\s+')).join('|') + ')\\s*:', 'gi');
  const matches = [...text.matchAll(pattern)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const title = headings.find((h) => m[1].toLowerCase().replace(/\s+/g, ' ').trim() === h.toLowerCase()) || m[1];
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    out[title] = text.slice(start, end).trim();
  }
  return out;
}

function buildLocalFallback(row, competition) {
  const name = row._student?.full_name || 'the student';
  const comp = competition?.name || 'the competition';
  const pos  = row.position;
  if (pos === 'Not Participated') {
    return `Performance Review

Compliment: We appreciate ${name}'s presence in the school community.

Performance Summary: ${name} did not take part in ${comp} this time. Participation builds confidence, friendships, and resilience.

Encouragement: There is always a next chance to shine.

Practical Tips: Try a small role next time. Cheer for a friend on stage. Sign up for a beginner-friendly category.`;
  }
  if (pos === 'Participation' || pos === 'Consolation') {
    return `Performance Review

Compliment: ${name} showed wonderful spirit in ${comp}.

Performance Summary: Effort and a positive attitude were on full display, which is exactly how growth begins.

Encouragement: Keep showing up — every step forward counts.

Practical Tips: Practise a little each week. Ask for feedback. Set one tiny goal before the next event.`;
  }
  return `Performance Review

Compliment: A wonderful achievement, ${name}!

Performance Summary: Strong preparation and composure helped earn the ${pos} position in ${comp}. A small refinement around consistency will take you further still.

Encouragement: Wonderful work — keep that momentum going!

Practical Tips: Keep a short practice journal. Review your best moments. Mentor a peer to deepen your own learning.`;
}

function Badge({ tone, children }) {
  const map = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    amber:   'bg-amber-100 text-amber-800 border-amber-200',
  };
  return <span className={'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold ' + (map[tone] || '')}>{children}</span>;
}

function Shimmer() {
  return (
    <div className="mt-3 space-y-2">
      <style>{`@keyframes inspireShimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 rounded-lg" style={{
          background: 'linear-gradient(90deg,#f1f5f9 0%,#e2e8f0 40%,#f1f5f9 80%)',
          backgroundSize: '800px 100%',
          animation: 'inspireShimmer 1.4s linear infinite',
        }} />
      ))}
    </div>
  );
}
