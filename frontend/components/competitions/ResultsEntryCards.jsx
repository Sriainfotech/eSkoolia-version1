'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import AIReviewPanel from './AIReviewPanel';

/**
 * ResultsEntryCards — the centerpiece composer.
 *
 *  ★ Podium auto-sort: cards visually re-order by position rank in real time.
 *  ★ Position chips with color, icon, ring, and a soft top accent stripe per card.
 *  ★ Keyboard shortcuts: ↑↓ navigate, 1/2/3/C/P/X assign, G generate AI.
 *  ★ Smart "💡 suggest" pre-fills contribution text relevant to the position+context.
 *  ★ Sticky toolbar: search · position filter · select-all · bulk position · bulk AI.
 *  ★ Confetti micro-celebration when a 1st place is assigned (no extra deps).
 *  ★ Demo students appear if the parent didn't pass any, so the modal feels alive.
 */

const POSITIONS = [
  { v: '1st',  short: '1st', icon: '🥇', pts: 10, hot: 'bg-amber-100 text-amber-900 border-amber-300 ring-amber-300/60',  stripe: 'from-amber-300 to-orange-300' },
  { v: '2nd',  short: '2nd', icon: '🥈', pts: 7,  hot: 'bg-slate-100 text-slate-800 border-slate-300 ring-slate-300/60',  stripe: 'from-slate-300 to-zinc-200' },
  { v: '3rd',  short: '3rd', icon: '🥉', pts: 5,  hot: 'bg-orange-100 text-orange-900 border-orange-300 ring-orange-300/60', stripe: 'from-orange-300 to-amber-200' },
  { v: 'Consolation',     short: 'Cons.', icon: '🎖', pts: 3, hot: 'bg-teal-100 text-teal-900 border-teal-300 ring-teal-300/60', stripe: 'from-teal-300 to-cyan-200' },
  { v: 'Participation',   short: 'Part.', icon: '✅', pts: 1, hot: 'bg-emerald-100 text-emerald-900 border-emerald-300 ring-emerald-300/60', stripe: 'from-emerald-300 to-green-200' },
  { v: 'Not Participated',short: 'N/P',   icon: '🚫', pts: 0, hot: 'bg-rose-100 text-rose-900 border-rose-300 ring-rose-300/60', stripe: 'from-rose-300 to-pink-200' },
];
const RANK = { '1st': 0, '2nd': 1, '3rd': 2, 'Consolation': 3, 'Participation': 4, 'Not Participated': 5 };
const KEY_TO_POS = { '1': '1st', '2': '2nd', '3': '3rd', 'c': 'Consolation', 'p': 'Participation', 'x': 'Not Participated' };

// Team mode is auto-detected for sports events at school-level (intra/inter/district+).
// In team mode every participant gets a `team_role` field and a single Team Control Bar
// sets the position/points for the whole team in one tap.
const TEAM_LEVELS = new Set(['intra_school','inter_school','district','state','national','international']);
function deriveTeamMode(comp) {
  if (!comp) return false;
  return comp.comp_type === 'sports' && TEAM_LEVELS.has(comp.level);
}
function rolePresets(comp) {
  const sport = (comp?.sport_type || comp?.name || '').toLowerCase();
  const generic = ['Captain','Vice-Captain','Member'];
  if (/cricket/.test(sport))   return ['Captain','Vice-Captain','Wicket-Keeper','Bowler','Batter','All-Rounder'];
  if (/foot|soccer/.test(sport)) return ['Captain','Vice-Captain','Goalkeeper','Defender','Midfielder','Forward'];
  if (/basket/.test(sport))    return ['Captain','Vice-Captain','Point Guard','Shooting Guard','Forward','Center'];
  if (/hockey/.test(sport))    return ['Captain','Vice-Captain','Goalkeeper','Defender','Midfielder','Forward'];
  if (/volley/.test(sport))    return ['Captain','Vice-Captain','Setter','Libero','Hitter','Blocker'];
  if (/relay|athl|track/.test(sport)) return ['Captain','Vice-Captain','Runner-1','Runner-2','Runner-3','Runner-4'];
  return generic;
}

const SMART_HINTS = {
  '1st':  'Demonstrated outstanding mastery and confidence throughout the competition.',
  '2nd':  'Showed strong skill and composure, finishing among the top performers.',
  '3rd':  'Performed with consistent skill, securing a podium finish.',
  'Consolation':   'Showed notable spirit and effort that the judges recognised.',
  'Participation': 'Took part with enthusiasm and a positive learning attitude.',
  'Not Participated': '',
};

export default function ResultsEntryCards({ competition, students = [], results, onChange, onAiBusyChange }) {
  // === Smart picker state — start empty, teachers add who they need ===
  const [pickerQuery, setPickerQuery] = useState('');
  const [pasteMode, setPasteMode]     = useState(false);
  const [pasteText, setPasteText]     = useState('');
  const [showAllScope, setShowAllScope] = useState(false); // escape hatch
  const pickerInputRef = useRef(null);

  const addedIds = useMemo(() => new Set(results.map((r) => r.student_id)), [results]);

  // === Scope-aware candidate pool ===
  // Filters the school roster down to ONLY the students who can validly compete in this event,
  // based on the level + scope chosen on the form (inter-house houses, inter-class classes, etc.).
  // Teachers can press "Show entire school" to override if they really need an off-scope add.
  const scopeInfo = useMemo(() => buildScopeInfo(competition, students), [competition, students]);
  const candidatePool = (showAllScope || !scopeInfo.active) ? students : scopeInfo.pool;

  // Search: name, admission no, class+section, initials. Limit to 8 visible at a time.
  const matches = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q || candidatePool.length === 0) return [];
    const isNumeric = /^\d/.test(q);
    return candidatePool
      .filter((s) => {
        if (addedIds.has(s.id)) return false;
        const hay = [
          s.full_name, s.admission_no, s.class_name, s.section,
          (s.full_name || '').split(' ').map((w) => w[0]).join(''), // initials
        ].filter(Boolean).join(' ').toLowerCase();
        if (isNumeric) return (s.admission_no || '').toLowerCase().startsWith(q) || hay.includes(q);
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [pickerQuery, candidatePool, addedIds]);

  const isTeamMode = useMemo(() => deriveTeamMode(competition), [competition]);
  const roleOptions = useMemo(() => rolePresets(competition), [competition]);

  // Multi-team state for sports events with multiple competing teams (cross-play allowed).
  // Each team: { id, name, color, members:[{student_id,role}], position, points }
  const [teams, setTeams] = useState([]);
  const teamColors = ['#EF4444','#3B82F6','#10B981','#F59E0B','#A855F7','#EC4899','#06B6D4','#84CC16'];
  function newTeamId() { return 'tm_' + Math.random().toString(36).slice(2, 8); }

  function addTeam(seedName) {
    const idx = teams.length;
    const t = {
      id: newTeamId(),
      name: seedName || `Team ${String.fromCharCode(65 + idx)}`,
      color: teamColors[idx % teamColors.length],
      members: [],
      position: '',
      points: 0,
    };
    setTeams((arr) => [...arr, t]);
  }
  function removeTeam(tid) {
    setTeams((arr) => arr.filter((t) => t.id !== tid));
    // Also strip team_id from results that referenced this team
    onChange(results.map((r) => r._team_id === tid ? { ...r, _team_id: null, _team_name: null } : r));
  }
  function renameTeam(tid, name) {
    setTeams((arr) => arr.map((t) => t.id === tid ? { ...t, name } : t));
  }
  function addTeamMember(tid, student) {
    setTeams((arr) => arr.map((t) => {
      if (t.id !== tid) return t;
      if (t.members.some((m) => m.student_id === student.id)) return t;
      const role = t.members.length === 0 ? 'Captain' : (t.members.length === 1 ? 'Vice-Captain' : 'Member');
      return { ...t, members: [...t.members, { student_id: student.id, role, _student: student }] };
    }));
    // Ensure a result row exists for this student (so AI reviews can be generated)
    if (!results.some((r) => r.student_id === student.id)) {
      onChange([...results, { student_id: student.id, _student: student, position: '', points: 0, personal_contribution: '', ai_response: '', ai_meta: null, _team_id: tid }]);
    }
  }
  function removeTeamMember(tid, studentId) {
    setTeams((arr) => arr.map((t) => t.id === tid ? { ...t, members: t.members.filter((m) => m.student_id !== studentId) } : t));
  }
  function setTeamRole(tid, studentId, role) {
    setTeams((arr) => arr.map((t) => t.id === tid ? { ...t, members: t.members.map((m) => m.student_id === studentId ? { ...m, role } : m) } : t));
  }
  function setTeamResult(tid, pos, anchorEl) {
    const def = POSITIONS.find((p) => p.v === pos);
    const pts = def?.pts ?? 0;
    setTeams((arr) => arr.map((t) => t.id === tid ? { ...t, position: pos, points: pts } : t));
    // Fan out to results: every team member's row gets this position+pts (but if student is on
    // multiple teams with different positions, the higher rank wins).
    const team = teams.find((t) => t.id === tid);
    if (!team) return;
    const next = [...results];
    team.members.forEach((m) => {
      const idx = next.findIndex((r) => r.student_id === m.student_id);
      const newRank = RANK[pos] ?? 99;
      if (idx === -1) {
        next.push({ student_id: m.student_id, _student: m._student, position: pos, points: pts, personal_contribution: '', ai_response: '', ai_meta: null, _team_id: tid, _team_name: team.name });
      } else {
        const oldRank = next[idx].position ? (RANK[next[idx].position] ?? 99) : 99;
        if (newRank <= oldRank) next[idx] = { ...next[idx], position: pos, points: pts, _team_id: tid, _team_name: team.name };
      }
    });
    onChange(next);
    if (pos === '1st' && anchorEl) {
      const r = anchorEl.getBoundingClientRect();
      setConfetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, ts: Date.now() });
      setTimeout(() => setConfetti(null), 1400);
    }
  }
  function setTeamPoints(tid, pts) {
    const n = Number.isFinite(pts) ? pts : 0;
    setTeams((arr) => arr.map((t) => t.id === tid ? { ...t, points: n } : t));
    const team = teams.find((t) => t.id === tid);
    if (!team) return;
    onChange(results.map((r) => team.members.some((m) => m.student_id === r.student_id) ? { ...r, points: n } : r));
  }

  // Bulk apply for Step 4 — Other Outcomes
  function bulkAddByFilter(filterFn, position) {
    const def = POSITIONS.find((p) => p.v === position);
    const pts = def?.pts ?? 0;
    const existingIds = new Set(results.map((r) => r.student_id));
    const next = [...results];
    const additions = candidatePool.filter((s) => filterFn(s) && !existingIds.has(s.id));
    additions.forEach((s) => {
      next.push({ student_id: s.id, _student: s, position, points: pts, personal_contribution: '', ai_response: '', ai_meta: null });
    });
    onChange(next);
    return additions.length;
  }

  function addStudent(s) {
    if (addedIds.has(s.id)) return;
    const base = { student_id: s.id, _student: s, position: '', points: 0, personal_contribution: '', ai_response: '', ai_meta: null };
    if (isTeamMode) base.team_role = results.length === 0 ? 'Captain' : (results.length === 1 ? 'Vice-Captain' : 'Member');
    onChange([...results, base]);
    setPickerQuery('');
    setTimeout(() => pickerInputRef.current?.focus(), 30);
  }

  function removeStudent(idx) {
    const next = [...results]; next.splice(idx, 1); onChange(next);
  }

  function bulkAddFromPaste() {
    const tokens = pasteText.split(/[\n,;]+/).map((t) => t.trim()).filter(Boolean);
    const found = []; const missing = [];
    const pool = (showAllScope || !scopeInfo.active) ? students : scopeInfo.pool;
    tokens.forEach((tok) => {
      const lower = tok.toLowerCase();
      const hit = pool.find((s) =>
        !addedIds.has(s.id) && (
          (s.admission_no || '').toLowerCase() === lower ||
          (s.full_name || '').toLowerCase() === lower
        )
      ) || pool.find((s) =>
        !addedIds.has(s.id) && (
          (s.admission_no || '').toLowerCase().includes(lower) ||
          (s.full_name || '').toLowerCase().includes(lower)
        )
      );
      if (hit && !found.some((f) => f.id === hit.id)) found.push(hit);
      else if (!hit) missing.push(tok);
    });
    if (found.length > 0) {
      onChange([
        ...results,
        ...found.map((s) => ({ student_id: s.id, _student: s, position: '', points: 0, personal_contribution: '', ai_response: '', ai_meta: null })),
      ]);
    }
    setPasteText(missing.length ? missing.join('\n') : '');
    if (found.length === 0 && missing.length > 0) {
      // keep text so user can correct
    } else if (missing.length === 0) {
      setPasteMode(false);
    }
  }

  function onPickerKey(e) {
    if (e.key === 'ArrowDown' && matches[0]) {
      e.preventDefault();
      const el = document.getElementById('pickopt-0');
      el?.focus();
    } else if (e.key === 'Enter' && matches.length === 1) {
      e.preventDefault();
      addStudent(matches[0]);
    }
  }

  // === Existing results state (filter, select, kbd) ===
  const [query, setQuery]       = useState('');
  const [filterPos, setFilterPos] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [active, setActive]     = useState(0);
  const [confetti, setConfetti] = useState(null);
  const containerRef = useRef(null);

  const sorted = useMemo(() => {
    const list = (results || []).map((r, i) => ({ ...r, _idx: i }));
    list.sort((a, b) => {
      const ra = a.position ? RANK[a.position] : 99;
      const rb = b.position ? RANK[b.position] : 99;
      if (ra !== rb) return ra - rb;
      return (a._student?.full_name || '').localeCompare(b._student?.full_name || '');
    });
    return list;
  }, [results]);

  // Step 3 only shows the podium / consolation tier cards.
  // Participation + Not-Participated live in Step 4 to keep huge rosters out of the way.
  const PODIUM_POSITIONS = new Set(['1st','2nd','3rd','Consolation','']);
  const sortedPodium = useMemo(() => sorted.filter((r) => PODIUM_POSITIONS.has(r.position)), [sorted]);

  const visible = sortedPodium.filter((r) => {
    if (filterPos && r.position !== filterPos) return false;
    if (query) {
      const q = query.toLowerCase();
      const n = (r._student?.full_name || '').toLowerCase();
      const c = (r._student?.class_name || '').toLowerCase();
      if (!n.includes(q) && !c.includes(q)) return false;
    }
    return true;
  });

  function update(idx, patch) {
    const next = [...results];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }

  function setPosition(idx, pos, anchorEl) {
    const def = POSITIONS.find((p) => p.v === pos);
    update(idx, { position: pos, points: def?.pts ?? 0 });
    if (pos === '1st' && anchorEl) {
      const r = anchorEl.getBoundingClientRect();
      setConfetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, ts: Date.now() });
      setTimeout(() => setConfetti(null), 1400);
    }
  }

  function applySuggestion(idx) {
    const r = results[idx];
    const hint = SMART_HINTS[r.position] || '';
    if (!hint) return;
    update(idx, { personal_contribution: r.personal_contribution ? r.personal_contribution : hint });
  }

  function bulkSet(pos) {
    const next = results.map((r, i) => selected.has(i) ? { ...r, position: pos, points: POSITIONS.find((p) => p.v === pos)?.pts ?? 0 } : r);
    onChange(next);
  }

  function setRole(idx, role) {
    update(idx, { team_role: role });
  }

  function applyTeamPosition(pos, anchorEl) {
    const def = POSITIONS.find((p) => p.v === pos);
    const next = results.map((r) => ({ ...r, position: pos, points: def?.pts ?? 0 }));
    onChange(next);
    if (pos === '1st' && anchorEl) {
      const r = anchorEl.getBoundingClientRect();
      setConfetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, ts: Date.now() });
      setTimeout(() => setConfetti(null), 1400);
    }
  }
  function applyTeamPoints(pts) {
    const n = Number.isFinite(pts) ? pts : 0;
    onChange(results.map((r) => ({ ...r, points: n })));
  }

  function toggleSelect(i) {
    setSelected((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r._idx));
  function toggleSelectAll() {
    setSelected((s) => {
      const n = new Set(s);
      if (allVisibleSelected) visible.forEach((r) => n.delete(r._idx));
      else visible.forEach((r) => n.add(r._idx));
      return n;
    });
  }

  // Keyboard shortcuts on the container
  useEffect(() => {
    function onKey(e) {
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(visible.length - 1, a + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      else {
        const k = e.key.toLowerCase();
        if (KEY_TO_POS[k] && visible[active]) {
          e.preventDefault();
          setPosition(visible[active]._idx, KEY_TO_POS[k]);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, active, results]);

  const reviewedCount = results.filter((r) => r.ai_response).length;

  return (
    <section ref={containerRef} className="space-y-4">
      {/* === Smart Participant Picker (always at the top) === */}
      <ParticipantPicker
        pickerInputRef={pickerInputRef}
        pickerQuery={pickerQuery}
        setPickerQuery={setPickerQuery}
        matches={matches}
        addStudent={addStudent}
        onPickerKey={onPickerKey}
        results={results}
        students={candidatePool}
        scopeInfo={scopeInfo}
        showAllScope={showAllScope}
        setShowAllScope={setShowAllScope}
        pasteMode={pasteMode}
        setPasteMode={setPasteMode}
        pasteText={pasteText}
        setPasteText={setPasteText}
        bulkAddFromPaste={bulkAddFromPaste}
      />

      {results.length === 0 && <EmptyRoster studentsAvailable={students.length} />}

      {results.length > 0 && (<>
      {/* === Sticky toolbar === */}
      <div className="sticky top-0 z-30 -mx-1 px-1 py-2 backdrop-blur bg-white/85 border-b border-slate-200/80">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-purple-100 text-purple-700 text-[11px] font-extrabold">3</div>
          <h3 className="text-[13.5px] font-extrabold text-slate-900">Mark results</h3>
          <span className="text-[11px] text-slate-500">{results.length} participants · {reviewedCount} reviewed</span>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter participants…"
                     className="w-[180px] rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-purple-300" />
            </div>
            <select value={filterPos} onChange={(e) => setFilterPos(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-purple-300">
              <option value="">All positions</option>
              {POSITIONS.map((p) => <option key={p.v} value={p.v}>{p.icon} {p.v}</option>)}
            </select>
            <button onClick={toggleSelectAll}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 hover:bg-slate-50">
              {allVisibleSelected ? 'Clear' : 'Select all'}
            </button>
          </div>
        </div>

        {/* Bulk actions tray */}
        {selected.size > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-purple-50/80 border border-purple-200 px-3 py-2">
            <span className="text-[11.5px] font-bold text-purple-900">{selected.size} selected · apply position</span>
            {POSITIONS.map((p) => (
              <button key={p.v} onClick={() => bulkSet(p.v)}
                      className={'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold ' + p.hot}>
                <span aria-hidden>{p.icon}</span>{p.short}
              </button>
            ))}
            <button onClick={() => setSelected(new Set())}
                    className="ml-auto text-[11px] font-bold text-purple-700 hover:text-purple-900">Clear</button>
          </div>
        )}
      </div>

      {/* === Multi-Team Builder (sports + multi-team levels) === */}
      {isTeamMode && (
        <MultiTeamBuilder
          competition={competition}
          teams={teams}
          candidatePool={candidatePool}
          allStudents={students}
          onAddTeam={addTeam}
          onRemoveTeam={removeTeam}
          onRenameTeam={renameTeam}
          onAddMember={addTeamMember}
          onRemoveMember={removeTeamMember}
          onSetRole={setTeamRole}
          onSetPosition={setTeamResult}
          onSetPoints={setTeamPoints}
          roleOptions={roleOptions}
        />
      )}

      {/* === Cards grid (auto-sorted, animated) === */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map((r, vIdx) => {
          const isActive = vIdx === active;
          return (
            <StudentCard
              key={r.student_id}
              row={r}
              active={isActive}
              isSelected={selected.has(r._idx)}
              onSelect={() => toggleSelect(r._idx)}
              onActivate={() => setActive(vIdx)}
              onPosition={(pos, el) => setPosition(r._idx, pos, el)}
              onPoints={(pts) => update(r._idx, { points: pts })}
              onContribution={(t) => update(r._idx, { personal_contribution: t })}
              onSuggest={() => applySuggestion(r._idx)}
              onAi={(resp, meta) => update(r._idx, { ai_response: resp, ai_meta: meta })}
              onAiBusyChange={onAiBusyChange}
              onRemove={() => removeStudent(r._idx)}
              onRole={(role) => setRole(r._idx, role)}
              roleOptions={roleOptions}
              isTeamMode={isTeamMode}
              competition={competition}
            />
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-[13px] text-slate-500">
          No participants match your filters.
        </div>
      )}

      {/* Hint if items have been moved to Step 4 */}
      {(() => {
        const moved = results.filter((r) => r.position === 'Participation' || r.position === 'Not Participated').length;
        if (moved === 0) return null;
        return (
          <p className="text-[11px] text-slate-500 italic mt-1">
            {moved} student{moved === 1 ? '' : 's'} marked as Participation / Not Participated — see <b className="text-slate-700">Step 4 below</b>.
          </p>
        );
      })()}
      </>)}

      {/* === Step 4 — Other Outcomes (collapsed until Step 3 has at least one podium award) === */}
      <OtherOutcomesSection
        results={results}
        candidatePool={candidatePool}
        scopeInfo={scopeInfo}
        showAllScope={showAllScope}
        allStudents={students}
        onChange={onChange}
        bulkAddByFilter={bulkAddByFilter}
      />

      {/* === Step 5 — Encourage (intelligent: students with zero participation this year) === */}
      <EncourageSection
        results={results}
        allStudents={students}
        onChange={onChange}
        competition={competition}
      />

      {/* Confetti mini-pop */}
      {confetti && <ConfettiPop x={confetti.x} y={confetti.y} key={confetti.ts} />}
    </section>
  );
}

/* ---------------- Smart Participant Picker ---------------- */
function ParticipantPicker({
  pickerInputRef, pickerQuery, setPickerQuery, matches, addStudent, onPickerKey,
  results, students, pasteMode, setPasteMode, pasteText, setPasteText, bulkAddFromPaste,
  scopeInfo, showAllScope, setShowAllScope,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-purple-100 text-purple-700 text-[11px] font-extrabold">2</span>
        <h3 className="text-[13.5px] font-extrabold text-slate-900">Add participants</h3>
        <span className="text-[11px] text-slate-500 hidden sm:inline">{results.length} added · {students.length || '—'} eligible</span>
        <button
          type="button"
          onClick={() => setPasteMode((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-2 py-1 text-[11px] font-bold transition"
          title="Paste a list of admission IDs or names — one per line, comma, or semicolon"
        >
          {pasteMode ? '🔍 Search mode' : '📋 Paste a list'}
        </button>
      </div>

      {/* Scope chip — tells the teacher exactly which slice of the school is in the picker */}
      {scopeInfo?.active && (
        <div className={'mb-3 flex items-center gap-2 flex-wrap rounded-xl px-3 py-2 border ' + scopeInfo.tone}>
          <span className="text-[14px]">{scopeInfo.icon}</span>
          <span className="text-[12px] font-bold text-slate-900">{scopeInfo.label}</span>
          <span className="text-[11px] text-slate-600">· showing {students.length} student{students.length === 1 ? '' : 's'}</span>
          <button type="button" onClick={() => setShowAllScope((v) => !v)}
                  className="ml-auto text-[11px] font-bold text-slate-600 hover:text-slate-900 underline-offset-2 hover:underline">
            {showAllScope ? '↺ Re-apply scope' : 'Show entire school'}
          </button>
        </div>
      )}

      {!pasteMode && (
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input
            ref={pickerInputRef}
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
            onKeyDown={onPickerKey}
            placeholder="Type a name, admission ID, or class…  e.g. ‘Aarav’ or ‘1234’ or ‘5-A’"
            className="block w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-3 text-[13.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition"
            aria-label="Search students to add"
            autoComplete="off"
          />
          {pickerQuery && (
            <button onClick={() => setPickerQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}

          {pickerQuery && (
            <div className="absolute z-40 left-0 right-0 mt-1 rounded-xl border border-slate-200 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.18)] overflow-hidden">
              {matches.length === 0 ? (
                <div className="px-4 py-5 text-center text-[12.5px] text-slate-500">
                  No match for <b className="text-slate-700">&ldquo;{pickerQuery}&rdquo;</b>{students.length === 0 && <> — open from a Student Group page so the school roster is available.</>}
                </div>
              ) : (
                <ul role="listbox">
                  {matches.map((s, i) => {
                    const grad = avatarGradient(s.full_name || '?');
                    const initials = (s.full_name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                    return (
                      <li key={s.id}>
                        <button
                          id={`pickopt-${i}`}
                          type="button"
                          onClick={() => addStudent(s)}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') { e.preventDefault(); document.getElementById(`pickopt-${i + 1}`)?.focus(); }
                            else if (e.key === 'ArrowUp') { e.preventDefault();
                              if (i === 0) pickerInputRef.current?.focus();
                              else document.getElementById(`pickopt-${i - 1}`)?.focus();
                            }
                            else if (e.key === 'Enter') { e.preventDefault(); addStudent(s); }
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-purple-50/70 focus:bg-purple-50 focus:outline-none transition text-left"
                        >
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white text-[12px] font-extrabold shadow-inner shrink-0" style={{ background: grad }}>{initials}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-bold text-slate-900 truncate">
                              <Highlight text={s.full_name || '—'} q={pickerQuery} />
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              <span className="font-mono"><Highlight text={s.admission_no || '—'} q={pickerQuery} /></span>
                              {s.class_name && <> · {s.class_name}{s.section && s.section !== '-' ? ` · Sec ${s.section}` : ''}</>}
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-600 text-white px-2 py-0.5 text-[10.5px] font-extrabold">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M12 5v14M5 12h14" /></svg>
                            Add
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {matches.length === 8 && (
                    <li className="px-3 py-1.5 text-[10.5px] text-slate-400 bg-slate-50 border-t border-slate-100">Showing first 8 — keep typing to narrow down</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {pasteMode && (
        <div className="space-y-2">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={'Paste admission IDs or names — one per line, comma, or semicolon\ne.g.\nADM1234\nADM1235\nAarav Sharma'}
            className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12.5px] font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-300 min-h-[120px] resize-y"
          />
          <div className="flex items-center gap-2">
            <button onClick={bulkAddFromPaste} disabled={!pasteText.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#7C3AED,#EC4899)] px-3.5 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(124,58,237,0.5)] disabled:opacity-50 transition">
              ⚡ Match &amp; add
            </button>
            <span className="text-[11px] text-slate-500">Exact admission IDs match first; names are fuzzy-matched.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyRoster({ studentsAvailable }) {
  return (
    <div className="rounded-2xl border border-dashed border-purple-200/80 bg-white/60 backdrop-blur p-8 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 text-[22px]">👋</div>
      <h4 className="mt-3 text-[14px] font-extrabold text-slate-900">No participants yet</h4>
      <p className="mt-1 text-[12px] text-slate-500">
        Use the search above to find a student by name or admission ID.
        {studentsAvailable === 0 && <> The school roster isn't loaded — open InspireHub from a Student Groups page to access it.</>}
      </p>
    </div>
  );
}

function Highlight({ text = '', q = '' }) {
  if (!q) return <>{text}</>;
  const i = String(text).toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-amber-200/70 text-slate-900 rounded px-0.5">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/* ---------------- Card ---------------- */
function StudentCard({ row, active, isSelected, onSelect, onActivate, onPosition, onPoints, onContribution, onSuggest, onAi, onAiBusyChange, onRemove, onRole, roleOptions, isTeamMode, competition }) {
  const s = row._student || {};
  const def = POSITIONS.find((p) => p.v === row.position);
  const initials = (s.full_name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const grad = avatarGradient(s.full_name || '?');

  return (
    <article
      onMouseEnter={onActivate}
      tabIndex={0}
      className={
        'group relative overflow-hidden rounded-2xl border bg-white transition-all duration-300 ' +
        'shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] hover:shadow-[0_10px_28px_-8px_rgba(15,23,42,0.12)] ' +
        (active ? 'border-purple-300 ring-2 ring-purple-200' : 'border-slate-200') +
        (isSelected ? ' ring-2 ring-purple-400' : '')
      }
    >
      {/* Top stripe based on position */}
      <div className={'h-[3px] w-full ' + (def ? 'bg-gradient-to-r ' + def.stripe : 'bg-slate-100')} />

      {/* Remove button — appears on hover/focus */}
      <button
        onClick={onRemove}
        aria-label="Remove participant"
        className="absolute top-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>

      <div className="p-4">
        <header className="flex items-start gap-3">
          <button
            onClick={onSelect}
            aria-pressed={isSelected}
            className={'mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border-2 transition ' +
              (isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 hover:border-purple-400 bg-white')}
            aria-label="Select for bulk action"
          >
            {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5}><path d="M5 12l5 5L20 7" /></svg>}
          </button>

          <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-white text-[13px] font-extrabold shadow-inner shrink-0"
                style={{ background: grad }}>
            {initials}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-[13.5px] font-extrabold text-slate-900 truncate">{s.full_name || '—'}</h4>
              {s._demo && <span className="inline-flex items-center rounded-md bg-slate-100 text-slate-500 text-[9.5px] font-bold px-1.5 py-0.5 border border-slate-200">demo</span>}
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {s.admission_no && <span className="font-mono text-slate-600">{s.admission_no}</span>}
              {s.admission_no && (s.class_name || s.section) && <span className="mx-1 text-slate-300">·</span>}
              {s.class_name}{s.section && s.section !== '-' ? ` · Sec ${s.section}` : ''}
            </p>
          </div>

          {def && (
            <label
              className={'mr-7 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold cursor-text ' + def.hot}
              title="Click to edit points (type directly — no buttons needed)"
            >
              <span aria-hidden>{def.icon}</span>
              <span aria-hidden>+</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={Number.isFinite(row.points) ? row.points : 0}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  const n = raw === '' ? 0 : parseInt(raw, 10);
                  onPoints?.(Number.isFinite(n) ? n : 0);
                }}
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.stopPropagation()}
                className="w-14 bg-transparent text-center font-bold focus:outline-none focus:ring-1 focus:ring-current rounded-sm"
                aria-label="Points (type a number)"
              />
            </label>
          )}
        </header>

        {/* Team role (only in team mode) */}
        {isTeamMode && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Role</span>
            {(roleOptions || []).map((rname) => {
              const on = (row.team_role || 'Member') === rname;
              const isCap = rname === 'Captain';
              const isVc  = rname === 'Vice-Captain';
              return (
                <button
                  key={rname}
                  type="button"
                  onClick={() => onRole?.(rname)}
                  className={
                    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-bold transition ' +
                    (on
                      ? (isCap ? 'bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-300/60'
                        : isVc ? 'bg-sky-100 text-sky-900 border-sky-300 ring-1 ring-sky-300/60'
                        : 'bg-purple-100 text-purple-900 border-purple-300 ring-1 ring-purple-300/60')
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')
                  }
                  title={isCap ? 'Captain — leads the team' : isVc ? 'Vice-Captain — supports the captain' : `Set role: ${rname}`}
                >
                  {isCap && <span aria-hidden>👑</span>}
                  {isVc && <span aria-hidden>🎖</span>}
                  {rname}
                </button>
              );
            })}
          </div>
        )}

        {/* Position chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {POSITIONS.map((p) => {
            const on = row.position === p.v;
            return (
              <button
                key={p.v}
                onClick={(e) => onPosition(p.v, e.currentTarget)}
                className={
                  'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition-all duration-150 ' +
                  (on ? p.hot + ' ring-2 scale-[1.04] shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50')
                }
                aria-pressed={on}
              >
                <span aria-hidden>{p.icon}</span>{p.short}
              </button>
            );
          })}
        </div>

        {/* Contribution */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-slate-500">Personal contribution</span>
            <button
              type="button"
              onClick={onSuggest}
              disabled={!row.position || row.position === 'Not Participated'}
              className="text-[10.5px] font-bold text-purple-700 hover:text-purple-900 disabled:text-slate-300 disabled:cursor-not-allowed inline-flex items-center gap-1"
              title="Pre-fill from a smart hint"
            >
              💡 Suggest
            </button>
          </div>
          <textarea
            value={row.personal_contribution}
            onChange={(e) => onContribution(e.target.value)}
            placeholder="One or two lines about what this student did…"
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12.5px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-300 min-h-[60px] resize-y"
          />
        </div>

        {/* AI panel */}
        <AIReviewPanel
          row={row}
          competition={competition}
          onAi={onAi}
          onAiBusyChange={onAiBusyChange}
        />
      </div>
    </article>
  );
}

/* ---------------- Helpers ---------------- */
function TeamControlBar({ competition, results, onPosition, onPoints }) {
  const sharedPos = results.length > 0 ? results[0].position : '';
  const sharedPts = results.length > 0 ? results[0].points : 0;
  const allSamePos = results.every((r) => r.position === sharedPos);
  const allSamePts = results.every((r) => r.points === sharedPts);
  const captain = results.find((r) => r.team_role === 'Captain');
  const vc      = results.find((r) => r.team_role === 'Vice-Captain');
  const teamName = competition?.scope_label || competition?.name || 'The team';

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 p-4 shadow-[0_2px_12px_-4px_rgba(79,70,229,0.18)]">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 text-[12px]" aria-hidden>🏟️</span>
        <h3 className="text-[13.5px] font-extrabold text-slate-900">Team result</h3>
        <span className="text-[11px] text-slate-500">{results.length} member{results.length === 1 ? '' : 's'}</span>
        <span className="ml-auto inline-flex items-center gap-2 text-[11px] text-slate-500">
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-bold text-slate-700">{teamName}</span>
          {captain && (
            <span title="Captain" className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-bold text-amber-900">
              👑 {(captain._student?.full_name || '').split(' ')[0]}
            </span>
          )}
          {vc && (
            <span title="Vice-Captain" className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 font-bold text-sky-900">
              🎖 {(vc._student?.full_name || '').split(' ')[0]}
            </span>
          )}
        </span>
      </div>
      <p className="text-[11.5px] text-slate-600 mb-3">
        Set the position once — every member of the team gets the same result and points.
        Tweak individual cards below if a member earned bonus points.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {POSITIONS.map((p) => {
          const on = sharedPos === p.v && allSamePos;
          return (
            <button
              key={p.v}
              type="button"
              onClick={(e) => onPosition(p.v, e.currentTarget)}
              className={
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-all duration-150 ' +
                (on ? p.hot + ' ring-2 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50')
              }
            >
              <span aria-hidden>{p.icon}</span>{p.short}
            </button>
          );
        })}

        <label className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]">
          <span className="font-bold text-slate-600">Points</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={Number.isFinite(sharedPts) ? sharedPts : 0}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, '');
              onPoints(raw === '' ? 0 : parseInt(raw, 10));
            }}
            onFocus={(e) => e.target.select()}
            className={'w-16 bg-transparent text-center font-extrabold focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded ' + (allSamePts ? 'text-slate-900' : 'text-amber-700')}
            aria-label="Team points (applies to every member)"
          />
          {!allSamePts && <span className="text-[10px] font-bold text-amber-700" title="Some members were given custom points">mixed</span>}
        </label>
      </div>
    </div>
  );
}

function avatarGradient(seed = '?') {
  const palettes = [
    'linear-gradient(135deg,#7C3AED,#EC4899)',
    'linear-gradient(135deg,#0EA5E9,#22D3EE)',
    'linear-gradient(135deg,#F59E0B,#EF4444)',
    'linear-gradient(135deg,#10B981,#3B82F6)',
    'linear-gradient(135deg,#8B5CF6,#06B6D4)',
    'linear-gradient(135deg,#F472B6,#FB923C)',
  ];
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}

function ConfettiPop({ x, y }) {
  const pieces = Array.from({ length: 18 });
  return (
    <div className="pointer-events-none fixed inset-0 z-[1100]">
      <style>{`
        @keyframes confettiFly { to { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0 } }
      `}</style>
      {pieces.map((_, i) => {
        const angle = (Math.PI * 2 * i) / pieces.length;
        const dist  = 60 + Math.random() * 70;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const colors = ['#FCD34D', '#F472B6', '#A78BFA', '#34D399', '#60A5FA', '#FB923C'];
        const c = colors[i % colors.length];
        return (
          <span key={i}
            style={{
              position: 'absolute', left: x, top: y, width: 8, height: 8,
              background: c, borderRadius: 2,
              animation: 'confettiFly 1.1s cubic-bezier(.2,.7,.2,1) forwards',
              ['--dx']: dx + 'px', ['--dy']: dy + 'px', ['--rot']: (Math.random() * 720 - 360) + 'deg',
            }} />
        );
      })}
    </div>
  );
}


/* ---------- Scope inference: which slice of the school is eligible ---------- */
function buildScopeInfo(competition, students) {
  const lv = competition?.level;
  if (!competition || !lv || !Array.isArray(students)) return { active: false, pool: students || [] };

  if (lv === 'inter_house') {
    const ids = [competition.house_a, competition.house_b].filter(Boolean);
    if (ids.length < 2) return { active: false, pool: students };
    const pool = students.filter((s) => ids.includes(s.house_id) || ids.includes(s.house_name));
    const names = ids.map((id) => {
      const hit = students.find((s) => s.house_id === id);
      return hit?.house_name || id;
    });
    return {
      active: true, pool,
      icon: '🏠',
      label: `Inter-House: ${names.join(' vs ')}`,
      tone: 'bg-purple-50/60 border-purple-200',
    };
  }

  if (lv === 'inter_class') {
    const cls = Array.isArray(competition.classes) ? competition.classes.filter(Boolean) : [];
    if (cls.length < 1) return { active: false, pool: students };
    const pool = students.filter((s) => cls.includes(s.class_name));
    return {
      active: true, pool,
      icon: '🎓',
      label: `Inter-Class: ${cls.join(' · ')}`,
      tone: 'bg-sky-50/60 border-sky-200',
    };
  }

  if (lv === 'intra_class') {
    if (!competition.class_name) return { active: false, pool: students };
    const secs = Array.isArray(competition.sections) ? competition.sections.filter(Boolean) : [];
    const pool = students.filter((s) =>
      s.class_name === competition.class_name &&
      (secs.length === 0 || secs.includes(s.section))
    );
    return {
      active: true, pool,
      icon: '🏫',
      label: secs.length
        ? `Intra-Class ${competition.class_name} · Sec ${secs.join(', ')}`
        : `Intra-Class ${competition.class_name}`,
      tone: 'bg-emerald-50/60 border-emerald-200',
    };
  }

  return { active: false, pool: students };
}

/* ============================================================================
 * MultiTeamBuilder
 * ----------------
 * Sports often have multiple competing teams (e.g. 6 cricket teams in a school
 * tournament). A student may even cross-play across teams in different rounds.
 * This builder lets the admin spin up N teams, assign players (with role badges)
 * and award positions/points per team — fanning out to individual result rows
 * automatically. Higher rank wins on cross-play conflicts.
 * ==========================================================================*/
function MultiTeamBuilder({
  competition, teams, candidatePool, allStudents,
  onAddTeam, onRemoveTeam, onRenameTeam,
  onAddMember, onRemoveMember, onSetRole,
  onSetPosition, onSetPoints, roleOptions,
}) {
  const [openId, setOpenId] = React.useState(null);
  const [pickerQuery, setPickerQuery] = React.useState('');
  const sport = competition?.sport_type || 'sport';

  function autoBalance(n) {
    // Quick helper: spin up N teams; teacher can rename freely.
    for (let i = teams.length; i < n; i++) onAddTeam();
  }

  return (
    <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 p-4 md:p-5 shadow-[0_2px_12px_-4px_rgba(79,70,229,0.18)]">
      <header className="flex flex-wrap items-center gap-2 mb-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 text-[11px] font-extrabold">3a</span>
        <h3 className="text-[13.5px] font-extrabold text-slate-900">Build teams</h3>
        <span className="text-[11px] text-slate-500">{teams.length} team{teams.length === 1 ? '' : 's'} · {sport}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {teams.length === 0 && (
            <>
              <button type="button" onClick={() => autoBalance(2)}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-white text-indigo-700 px-2.5 py-1 text-[11.5px] font-bold hover:bg-indigo-50">
                ⚡ 2 teams
              </button>
              <button type="button" onClick={() => autoBalance(4)}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-white text-indigo-700 px-2.5 py-1 text-[11.5px] font-bold hover:bg-indigo-50">
                ⚡ 4 teams
              </button>
              <button type="button" onClick={() => autoBalance(6)}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-white text-indigo-700 px-2.5 py-1 text-[11.5px] font-bold hover:bg-indigo-50">
                ⚡ 6 teams
              </button>
            </>
          )}
          <button type="button" onClick={() => onAddTeam()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-white px-3 py-1.5 text-[12px] font-bold shadow-[0_4px_14px_-4px_rgba(79,70,229,0.5)] hover:brightness-110">
            <span aria-hidden>＋</span> New team
          </button>
        </div>
      </header>

      {teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-indigo-300 bg-white/60 py-8 text-center text-[12.5px] text-slate-600">
          <div className="text-[20px]" aria-hidden>🏟️</div>
          <p className="mt-1 font-bold text-slate-700">No teams yet</p>
          <p className="text-[11.5px] text-slate-500">Spin up multiple teams — players can cross-play across teams across rounds.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {teams.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              isOpen={openId === t.id}
              onToggle={() => setOpenId((id) => id === t.id ? null : t.id)}
              candidatePool={candidatePool}
              pickerQuery={pickerQuery}
              setPickerQuery={setPickerQuery}
              onAddMember={(s) => onAddMember(t.id, s)}
              onRemoveMember={(sid) => onRemoveMember(t.id, sid)}
              onSetRole={(sid, role) => onSetRole(t.id, sid, role)}
              onRename={(name) => onRenameTeam(t.id, name)}
              onRemove={() => onRemoveTeam(t.id)}
              onSetPosition={(pos, el) => onSetPosition(t.id, pos, el)}
              onSetPoints={(pts) => onSetPoints(t.id, pts)}
              roleOptions={roleOptions}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TeamCard({ team, isOpen, onToggle, candidatePool, pickerQuery, setPickerQuery,
  onAddMember, onRemoveMember, onSetRole, onRename, onRemove, onSetPosition, onSetPoints, roleOptions }) {
  const captain = team.members.find((m) => m.role === 'Captain');
  const vc      = team.members.find((m) => m.role === 'Vice-Captain');
  const def = POSITIONS.find((p) => p.v === team.position);
  const memberIds = new Set(team.members.map((m) => m.student_id));
  const matches = React.useMemo(() => {
    const q = (pickerQuery || '').trim().toLowerCase();
    if (!q || !isOpen) return [];
    return candidatePool
      .filter((s) => !memberIds.has(s.id))
      .filter((s) => {
        const hay = [s.full_name, s.admission_no, s.class_name, s.section].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 6);
  }, [pickerQuery, candidatePool, memberIds, isOpen]);

  return (
    <article className="rounded-xl border-2 bg-white shadow-sm overflow-hidden transition-all"
      style={{ borderColor: team.color + '55' }}>
      {/* Header band with team color */}
      <div className="relative px-3 py-2.5 flex items-center gap-2"
        style={{ background: `linear-gradient(90deg, ${team.color}22, ${team.color}08)` }}>
        <span className="inline-block h-3.5 w-3.5 rounded-full ring-2 ring-white shadow"
          style={{ background: team.color }} aria-hidden />
        <input value={team.name} onChange={(e) => onRename(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent text-[13px] font-extrabold text-slate-900 focus:outline-none focus:ring-1 focus:ring-current rounded px-1" />
        <button onClick={onRemove} aria-label="Remove team"
          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded p-1 transition">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="px-3 py-3 space-y-2.5">
        {/* Stat row */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
            👥 {team.members.length}
          </span>
          {captain && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-900" title="Captain">
              👑 {(captain._student?.full_name || '').split(' ')[0]}
            </span>
          )}
          {vc && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 font-bold text-sky-900" title="Vice-Captain">
              🎖 {(vc._student?.full_name || '').split(' ')[0]}
            </span>
          )}
          {def && (
            <span className={'ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ' + def.hot}>
              <span aria-hidden>{def.icon}</span>{def.short}
            </span>
          )}
        </div>

        {/* Position chips */}
        <div className="flex flex-wrap gap-1">
          {POSITIONS.filter((p) => ['1st','2nd','3rd','Consolation','Participation'].includes(p.v)).map((p) => {
            const on = team.position === p.v;
            return (
              <button key={p.v} type="button" onClick={(e) => onSetPosition(p.v, e.currentTarget)}
                className={'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-bold transition ' +
                  (on ? p.hot + ' ring-1 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
                <span aria-hidden>{p.icon}</span>{p.short}
              </button>
            );
          })}
          <label className="ml-auto inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px]">
            <span className="font-bold text-slate-500">Pts</span>
            <input type="text" inputMode="numeric" pattern="[0-9]*"
              value={Number.isFinite(team.points) ? team.points : 0}
              onChange={(e) => onSetPoints(parseInt(e.target.value.replace(/[^0-9]/g, '') || '0', 10))}
              onFocus={(e) => e.target.select()}
              className="w-12 bg-transparent text-center font-extrabold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded" />
          </label>
        </div>

        {/* Members + add */}
        <button type="button" onClick={onToggle}
          className="w-full flex items-center justify-between text-[11.5px] font-bold text-slate-600 hover:text-slate-900 py-1">
          <span>Roster {team.members.length > 0 && <span className="text-slate-400">({team.members.length})</span>}</span>
          <span className={'text-[10px] transition-transform ' + (isOpen ? 'rotate-180' : '')}>▾</span>
        </button>

        {isOpen && (
          <div className="space-y-2">
            {team.members.length > 0 && (
              <ul className="space-y-1">
                {team.members.map((m) => (
                  <li key={m.student_id} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5">
                    <span className="text-[11.5px] font-bold text-slate-800 flex-1 truncate">
                      {m._student?.full_name}
                      <span className="ml-1 text-[10px] text-slate-500">{m._student?.class_name}{m._student?.section && m._student.section !== '-' ? ` · ${m._student.section}` : ''}</span>
                    </span>
                    <select value={m.role} onChange={(e) => onSetRole(m.student_id, e.target.value)}
                      className="text-[10.5px] font-bold rounded border border-slate-200 bg-white px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300">
                      {(roleOptions || ['Captain','Vice-Captain','Member']).map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <button onClick={() => onRemoveMember(m.student_id)} aria-label="Remove player"
                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded p-1 transition">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="relative">
              <input value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Search by name or admission ID…"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              {matches.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {matches.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => { onAddMember(s); setPickerQuery(''); }}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-indigo-50 text-[12px] flex items-center gap-2">
                        <span className="font-bold text-slate-900 truncate">{s.full_name}</span>
                        <span className="text-[10.5px] text-slate-500 truncate">{s.admission_no} · {s.class_name}{s.section && s.section !== '-' ? `-${s.section}` : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

/* ============================================================================
 * OtherOutcomesSection (Step 4)
 * ----------------
 * Quick bulk-mark for participation / non-participation. Avoids overwhelming
 * Step 3 with 80-row class lists. Locked & dimmed until Step 3 has at least
 * one podium award. Bulk targets: whole scope, by class, by house.
 * ==========================================================================*/
function OtherOutcomesSection({ results, candidatePool, scopeInfo, showAllScope, allStudents, onChange, bulkAddByFilter }) {
  const hasPodium = results.some((r) => ['1st','2nd','3rd'].includes(r.position));
  const [open, setOpen] = React.useState(false);
  const [tab, setTab]   = React.useState('part'); // 'part' | 'np'

  React.useEffect(() => { if (!hasPodium) setOpen(false); }, [hasPodium]);

  const partCount = results.filter((r) => r.position === 'Participation').length;
  const npCount   = results.filter((r) => r.position === 'Not Participated').length;
  const targetPos = tab === 'part' ? 'Participation' : 'Not Participated';
  const tone = tab === 'part'
    ? { ring: 'ring-emerald-200', chip: 'bg-emerald-100 text-emerald-900 border-emerald-300', dot: 'bg-emerald-500' }
    : { ring: 'ring-rose-200',    chip: 'bg-rose-100 text-rose-900 border-rose-300',          dot: 'bg-rose-500' };

  // Group eligible (scoped) candidates by class for one-tap class bulk-mark.
  const byClass = React.useMemo(() => {
    const map = new Map();
    candidatePool.forEach((s) => {
      const k = s.class_name || '—';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [candidatePool]);

  const byHouse = React.useMemo(() => {
    const map = new Map();
    candidatePool.forEach((s) => {
      const k = s.house_name || s.house_id || null;
      if (!k) return;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [candidatePool]);

  return (
    <section className={'rounded-2xl border bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] transition-all ' + (hasPodium ? 'border-slate-200' : 'border-slate-200 opacity-70')}>
      <button type="button" onClick={() => hasPodium && setOpen((v) => !v)}
        disabled={!hasPodium}
        className="w-full flex items-center gap-2 px-4 py-3 text-left disabled:cursor-not-allowed">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-700 text-[11px] font-extrabold">4</span>
        <h3 className="text-[13.5px] font-extrabold text-slate-900 flex-1">Other outcomes</h3>
        <span className="hidden sm:inline text-[11px] text-slate-500">
          {hasPodium ? <>✅ {partCount} · 🚫 {npCount}</> : <>🔒 award a podium first to unlock</>}
        </span>
        <span className={'text-[11px] text-slate-400 transition-transform ' + (open ? 'rotate-180' : '')}>▾</span>
      </button>
      {open && hasPodium && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          {/* Tab switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11.5px] font-bold">
            <button type="button" onClick={() => setTab('part')}
              className={'px-3 py-1 rounded-md transition ' + (tab === 'part' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-600')}>
              ✅ Participation <span className="text-[10px] text-slate-400">({partCount})</span>
            </button>
            <button type="button" onClick={() => setTab('np')}
              className={'px-3 py-1 rounded-md transition ' + (tab === 'np' ? 'bg-white shadow-sm text-rose-700' : 'text-slate-600')}>
              🚫 Not Participated <span className="text-[10px] text-slate-400">({npCount})</span>
            </button>
          </div>

          <p className="text-[11.5px] text-slate-600">
            One tap to mark a whole class, house, or the entire {scopeInfo?.active ? 'event scope' : 'school'} as <b>{targetPos}</b>.
            Already-awarded students are skipped automatically.
          </p>

          {/* Bulk: entire scope */}
          <button type="button"
            onClick={() => {
              const added = bulkAddByFilter((s) => !results.some((r) => r.student_id === s.id), targetPos);
              if (added === 0) alert('Everyone in the eligible pool already has a result.');
            }}
            className={'inline-flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-[12px] font-extrabold ' + tone.chip}>
            <span aria-hidden>⚡</span> Mark all {candidatePool.length - results.length} remaining as {targetPos}
          </button>

          {/* By class */}
          {byClass.length > 1 && (
            <div>
              <h4 className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-slate-500 mb-1.5">By class</h4>
              <div className="flex flex-wrap gap-1.5">
                {byClass.map(([cls, list]) => {
                  const remaining = list.filter((s) => !results.some((r) => r.student_id === s.id)).length;
                  return (
                    <button key={cls} type="button"
                      disabled={remaining === 0}
                      onClick={() => bulkAddByFilter((s) => s.class_name === cls, targetPos)}
                      className={'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11.5px] font-bold transition ' +
                        (remaining === 0 ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50')}>
                      <span className="font-extrabold">{cls}</span>
                      <span className="text-[10px] text-slate-500">+{remaining}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* By house */}
          {byHouse.length > 0 && (
            <div>
              <h4 className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-slate-500 mb-1.5">By house</h4>
              <div className="flex flex-wrap gap-1.5">
                {byHouse.map(([h, list]) => {
                  const remaining = list.filter((s) => !results.some((r) => r.student_id === s.id)).length;
                  return (
                    <button key={h} type="button"
                      disabled={remaining === 0}
                      onClick={() => bulkAddByFilter((s) => (s.house_name || s.house_id) === h, targetPos)}
                      className={'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11.5px] font-bold transition ' +
                        (remaining === 0 ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50')}>
                      <span aria-hidden>🏠</span>{h}
                      <span className="text-[10px] text-slate-500">+{remaining}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Existing list (collapsible) */}
          {results.filter((r) => r.position === targetPos).length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11.5px] font-bold text-slate-600 hover:text-slate-900">
                {tab === 'part' ? partCount : npCount} already in {targetPos} — view / remove
              </summary>
              <ul className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-50/50 divide-y divide-slate-100">
                {results.map((r, idx) => r.position === targetPos && (
                  <li key={r.student_id} className="flex items-center gap-2 px-2.5 py-1.5 text-[11.5px]">
                    <span className={'inline-block h-1.5 w-1.5 rounded-full ' + tone.dot} />
                    <span className="font-bold text-slate-800 flex-1 truncate">{r._student?.full_name}</span>
                    <span className="text-[10.5px] text-slate-500">{r._student?.class_name}{r._student?.section && r._student.section !== '-' ? `-${r._student.section}` : ''}</span>
                    <button onClick={() => { const next = [...results]; next.splice(idx, 1); onChange(next); }}
                      className="text-slate-400 hover:text-rose-600">×</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

/* ============================================================================
 * EncourageSection (Step 5)
 * ----------------
 * Intelligent: pulls from inspireHubStore to find students with ZERO competition
 * activity in the current academic year and groups them class-wise. One tap to
 * include them in this event as Participation (gets them on the board).
 * Locked until Step 3 has a podium award.
 * ==========================================================================*/
function EncourageSection({ results, allStudents, onChange, competition }) {
  const hasPodium = results.some((r) => ['1st','2nd','3rd'].includes(r.position));
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { if (!hasPodium) setOpen(false); }, [hasPodium]);

  // Find students who have NEVER been in a competition this academic year.
  const inactive = React.useMemo(() => {
    if (!Array.isArray(allStudents) || allStudents.length === 0) return [];
    let activeIds = new Set();
    try {
      const raw = localStorage.getItem('inspirehub:competitions:v1');
      if (raw) {
        const yearStart = new Date(); yearStart.setMonth(3, 1); // Apr 1 (Indian academic year start)
        if (yearStart > new Date()) yearStart.setFullYear(yearStart.getFullYear() - 1);
        const list = JSON.parse(raw);
        (list || []).forEach((c) => {
          const d = c.date ? new Date(c.date) : null;
          if (d && d >= yearStart) {
            (c.results || []).forEach((r) => {
              if (r.position && r.position !== 'Not Participated') activeIds.add(r.student_id);
            });
          }
        });
      }
    } catch (e) { /* localStorage may be blocked */ }
    // Also count current-event participants
    results.forEach((r) => { if (r.position && r.position !== 'Not Participated') activeIds.add(r.student_id); });
    return allStudents.filter((s) => !activeIds.has(s.id));
  }, [allStudents, results]);

  const byClass = React.useMemo(() => {
    const map = new Map();
    inactive.forEach((s) => {
      const k = s.class_name || '—';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [inactive]);

  const [openClass, setOpenClass] = React.useState(null);

  function addAsParticipation(s) {
    if (results.some((r) => r.student_id === s.id)) return;
    const def = POSITIONS.find((p) => p.v === 'Participation');
    onChange([...results, { student_id: s.id, _student: s, position: 'Participation', points: def?.pts ?? 1, personal_contribution: '', ai_response: '', ai_meta: null }]);
  }
  function addClassBulk(list) {
    const existingIds = new Set(results.map((r) => r.student_id));
    const def = POSITIONS.find((p) => p.v === 'Participation');
    const next = [...results];
    list.forEach((s) => {
      if (!existingIds.has(s.id)) {
        next.push({ student_id: s.id, _student: s, position: 'Participation', points: def?.pts ?? 1, personal_contribution: '', ai_response: '', ai_meta: null });
      }
    });
    onChange(next);
  }

  return (
    <section className={'rounded-2xl border bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] transition-all ' + (hasPodium ? 'border-amber-200' : 'border-slate-200 opacity-70')}>
      <button type="button" onClick={() => hasPodium && setOpen((v) => !v)}
        disabled={!hasPodium}
        className="w-full flex items-center gap-2 px-4 py-3 text-left disabled:cursor-not-allowed">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-100 text-amber-700 text-[11px] font-extrabold">5</span>
        <h3 className="text-[13.5px] font-extrabold text-slate-900 flex-1">
          Encourage <span className="text-slate-500 font-medium">— students with zero events this year</span>
        </h3>
        <span className="hidden sm:inline text-[11px] text-slate-500">
          {hasPodium ? <>{inactive.length} student{inactive.length === 1 ? '' : 's'} · {byClass.length} class{byClass.length === 1 ? '' : 'es'}</> : <>🔒 unlocks after first podium</>}
        </span>
        <span className={'text-[11px] text-slate-400 transition-transform ' + (open ? 'rotate-180' : '')}>▾</span>
      </button>
      {open && hasPodium && (
        <div className="border-t border-amber-100 px-4 py-3">
          {inactive.length === 0 ? (
            <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-4 text-center">
              <div className="text-[20px]" aria-hidden>🌟</div>
              <p className="mt-1 text-[12.5px] font-extrabold text-emerald-900">Wonderful — every student has joined at least one event this year!</p>
            </div>
          ) : (
            <>
              <p className="text-[11.5px] text-slate-600 mb-3">
                These students haven&apos;t taken part in any competition or club event this academic year.
                Adding them as <b>Participation</b> here is a gentle nudge — gets them on the board.
              </p>
              <ul className="space-y-1.5">
                {byClass.map(([cls, list]) => {
                  const isOpen = openClass === cls;
                  return (
                    <li key={cls} className="rounded-lg border border-amber-200/70 bg-amber-50/40">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button onClick={() => setOpenClass((c) => c === cls ? null : cls)}
                          className="flex items-center gap-2 flex-1 text-left">
                          <span className={'text-[10px] transition-transform ' + (isOpen ? 'rotate-90' : '')}>▶</span>
                          <span className="text-[12px] font-extrabold text-slate-900">{cls}</span>
                          <span className="text-[11px] text-slate-500">{list.length} student{list.length === 1 ? '' : 's'}</span>
                        </button>
                        <button type="button" onClick={() => addClassBulk(list)}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[10.5px] font-bold text-amber-800 hover:bg-amber-100 transition">
                          ⚡ Add all as Participation
                        </button>
                      </div>
                      {isOpen && (
                        <ul className="border-t border-amber-200/60 max-h-48 overflow-auto divide-y divide-amber-100/60">
                          {list.map((s) => {
                            const already = results.some((r) => r.student_id === s.id);
                            return (
                              <li key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-[11.5px]">
                                <span className="font-bold text-slate-800 flex-1 truncate">{s.full_name}</span>
                                <span className="text-[10.5px] text-slate-500">{s.admission_no}{s.section && s.section !== '-' ? ` · Sec ${s.section}` : ''}</span>
                                <button onClick={() => addAsParticipation(s)}
                                  disabled={already}
                                  className={'rounded-md px-2 py-0.5 text-[10.5px] font-bold transition ' +
                                    (already ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-amber-500 text-white hover:bg-amber-600')}>
                                  {already ? '✓ Added' : '+ Add'}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
