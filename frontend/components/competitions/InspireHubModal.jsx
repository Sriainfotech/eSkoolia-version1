'use client';

import React, { useEffect, useRef, useState } from 'react';
import CompetitionForm from './CompetitionForm';
import ResultsEntryCards from './ResultsEntryCards';
import MiniDashboard from './MiniDashboard';
import ExportControls from './ExportControls';
import HistoryPanel from './HistoryPanel';
import DashboardPanel from './DashboardPanel';
import { inspireHubStore } from './inspireHubStore';

/**
 * InspireHubModal — tabbed canvas with full draft/CRUD lifecycle.
 *  Tabs: Compose · History · Dashboard
 *  Auto-saves to localStorage; explicit Save & Exit / Finalise / Delete.
 *  Bottom progress bar reflects real workflow completion.
 */
export default function InspireHubModal({ isOpen, onClose, students = [], houses = [], clubs = [], schoolId }) {
  const [tab, setTabState] = useState('dashboard');
  const [history, setHistory] = useState(['dashboard']); // navigation stack
  const [histIdx, setHistIdx] = useState(0);
  const [competition, setCompetition] = useState(null);
  const [results, setResults] = useState([]);
  const [aiBusy, setAiBusy] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmNav, setConfirmNav] = useState(null); // { target, kind: 'tab'|'back'|'forward' }
  const [confirmDelete, setConfirmDelete] = useState(false);
  const shellRef = useRef(null);
  const bodyRef = useRef(null);
  const autoSaveTimer = useRef(null);
  const prevCompId = useRef(null);

  // Always start fresh on Dashboard whenever the modal is (re)opened.
  // Without this, the modal stays mounted and reopens to whichever tab the teacher
  // last touched — surprising, and easy to mistake for a stuck state.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setTabState('dashboard');
      setHistory(['dashboard']);
      setHistIdx(0);
      setCompetition(null);
      setResults([]);
      setDirty(false);
      setSavedAt(null);
      setConfirmClose(false);
      setConfirmNav(null);
      setConfirmDelete(false);
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') tryClose();
      // Alt+Left / Alt+Right for back/forward
      if (e.altKey && e.key === 'ArrowLeft')  { e.preventDefault(); goBack(); }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goForward(); }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    setTimeout(() => shellRef.current?.focus(), 50);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, history, histIdx, dirty, competition]);

  useEffect(() => { if (competition) setDirty(true); }, [results, competition]);

  useEffect(() => {
    const id = competition?.id || null;
    if (id && id !== prevCompId.current) {
      requestAnimationFrame(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; });
    }
    prevCompId.current = id;
  }, [competition?.id]);

  useEffect(() => {
    if (!competition || !dirty) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const saved = inspireHubStore.saveDraft({ ...competition, results });
      setCompetition(saved);
      setSavedAt(new Date());
      setDirty(false);
    }, 1500);
    return () => clearTimeout(autoSaveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competition, results, dirty]);

  // -- Navigation helpers (guarded)
  // A "draft" is dirty (unsaved typing) OR a never-saved compose with content
  const hasUnsavedWork = dirty && competition;
  // A compose with edits but no saved competition row = needs guarding too
  const hasUnsavedNewCompose = !competition && (results.length > 0);

  function commitTab(t) {
    setTabState(t);
    setHistory((h) => {
      const trimmed = h.slice(0, histIdx + 1);
      if (trimmed[trimmed.length - 1] === t) return trimmed;
      const next = [...trimmed, t];
      setHistIdx(next.length - 1);
      return next;
    });
    requestAnimationFrame(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; });
  }

  function setTab(t) {
    if (t === tab) return;
    // Only guard when leaving compose with unsaved work
    const leavingCompose = tab === 'compose' && (hasUnsavedWork || hasUnsavedNewCompose);
    if (leavingCompose) { setConfirmNav({ target: t, kind: 'tab' }); return; }
    commitTab(t);
  }

  function goBack() {
    if (histIdx <= 0) return;
    const target = history[histIdx - 1];
    const leavingCompose = tab === 'compose' && (hasUnsavedWork || hasUnsavedNewCompose) && target !== 'compose';
    if (leavingCompose) { setConfirmNav({ target, kind: 'back' }); return; }
    setHistIdx(histIdx - 1); setTabState(target);
    requestAnimationFrame(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; });
  }
  function goForward() {
    if (histIdx >= history.length - 1) return;
    const target = history[histIdx + 1];
    const leavingCompose = tab === 'compose' && (hasUnsavedWork || hasUnsavedNewCompose) && target !== 'compose';
    if (leavingCompose) { setConfirmNav({ target, kind: 'forward' }); return; }
    setHistIdx(histIdx + 1); setTabState(target);
    requestAnimationFrame(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; });
  }

  // Outcomes from the nav-confirm dialog
  function navSaveAndContinue() {
    if (competition) {
      const saved = inspireHubStore.saveDraft({ ...competition, results });
      setCompetition(saved); setSavedAt(new Date());
    }
    setDirty(false);
    const nav = confirmNav; setConfirmNav(null);
    if (nav?.kind === 'back')      { setHistIdx((i) => Math.max(0, i - 1)); setTabState(nav.target); }
    else if (nav?.kind === 'forward') { setHistIdx((i) => Math.min(history.length - 1, i + 1)); setTabState(nav.target); }
    else if (nav?.target)           commitTab(nav.target);
    requestAnimationFrame(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; });
  }
  function navDiscardAndContinue() {
    setDirty(false);
    if (!competition) { setResults([]); }
    const nav = confirmNav; setConfirmNav(null);
    if (nav?.kind === 'back')      { setHistIdx((i) => Math.max(0, i - 1)); setTabState(nav.target); }
    else if (nav?.kind === 'forward') { setHistIdx((i) => Math.min(history.length - 1, i + 1)); setTabState(nav.target); }
    else if (nav?.target)           commitTab(nav.target);
    requestAnimationFrame(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; });
  }
  function navCancel() { setConfirmNav(null); }

  function tryClose() {
    if ((dirty && competition) || hasUnsavedNewCompose) { setConfirmClose(true); return; }
    onClose?.();
  }
  function saveAndExit() {
    clearTimeout(autoSaveTimer.current);
    if (competition) {
      const saved = inspireHubStore.saveDraft({ ...competition, results });
      setSavedAt(new Date());
      setCompetition(saved);
    }
    setDirty(false); setConfirmClose(false);
    // Reset to Dashboard so next open is clean.
    setTabState('dashboard'); setHistory(['dashboard']); setHistIdx(0);
    requestAnimationFrame(() => onClose?.());
  }
  function discardAndExit() {
    setConfirmClose(false); setDirty(false);
    setTabState('dashboard'); setHistory(['dashboard']); setHistIdx(0);
    setCompetition(null); setResults([]);
    onClose?.();
  }
  function finalizeNow() {
    if (!competition) return;
    const finalised = inspireHubStore.finalize({ ...competition, results });
    setCompetition(finalised); setSavedAt(new Date()); setDirty(false);
    // Bring the teacher back to the Dashboard to admire what they just published.
    commitTab('dashboard');
    // Clear the working copy so reopening the modal is clean too.
    setTimeout(() => { setCompetition(null); setResults([]); }, 80);
  }
  function deleteCurrent() {
    if (!competition?.id) return;
    setConfirmDelete(true);
  }
  function reallyDelete() {
    if (!competition?.id) { setConfirmDelete(false); return; }
    inspireHubStore.remove(competition.id);
    setCompetition(null); setResults([]); setDirty(false); setConfirmDelete(false);
    // After deleting, take the teacher to the Dashboard (not History) — clean canvas.
    commitTab('dashboard');
  }
  function startNew() { setCompetition(null); setResults([]); setDirty(false); commitTab('compose'); }
  function loadFromHistory(c) {
    setCompetition(c); setResults(c.results || []); setDirty(false);
    setSavedAt(c.updated_at ? new Date(c.updated_at) : null);
    commitTab('compose');
  }

  if (!isOpen) return null;

  const total = results.length;
  const positioned = results.filter((r) => r.position).length;
  const reviewed = results.filter((r) => r.ai_response).length;
  const stages = [
    { label: 'Competition saved', done: !!competition?.id, weight: 1 },
    { label: 'Participants added', done: total > 0, weight: 1, detail: `${total}` },
    { label: 'Positions marked', done: total > 0 && positioned === total, partial: total ? positioned / total : 0, weight: 2, detail: `${positioned}/${total}` },
    { label: 'AI reviews', done: total > 0 && reviewed === total, partial: total ? reviewed / total : 0, weight: 2, detail: `${reviewed}/${total}` },
    { label: 'Finalised', done: competition?.status === 'final', weight: 1 },
  ];
  const percent = Math.round(
    (stages.reduce((s, st) => s + (st.done ? 1 : (st.partial || 0)) * st.weight, 0) /
     stages.reduce((s, st) => s + st.weight, 0)) * 100
  );

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="inspirehub-title"
      onClick={tryClose}
      className="fixed inset-0 z-[1000] flex items-stretch md:items-center justify-center bg-slate-950/70 backdrop-blur-md"
      style={{ animation: 'inspireFadeIn 220ms ease-out' }}>
      <style>{`
        @keyframes inspireFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes inspireSlideUp { from{opacity:0;transform:translateY(24px) scale(.985)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes orbDrift { 0%,100%{transform:translate(0,0)} 33%{transform:translate(60px,-30px)} 66%{transform:translate(-40px,40px)} }
        @keyframes inspirePulseDot { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.55)} 70%{box-shadow:0 0 0 10px rgba(34,197,94,0)} }
      `}</style>

      <div ref={shellRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}
        className="relative w-full md:w-[94vw] md:max-w-[1360px] md:rounded-[24px] flex flex-col max-h-screen md:max-h-[94vh] overflow-hidden shadow-[0_30px_90px_-20px_rgba(2,6,23,0.55)] bg-white outline-none ring-1 ring-slate-900/5"
        style={{ animation: 'inspireSlideUp 320ms cubic-bezier(.2,.8,.2,1)' }}>

        <header className="relative bg-white border-b border-slate-200/70">
          <div className="absolute -top-32 -left-20 h-72 w-72 rounded-full opacity-20 blur-3xl pointer-events-none"
               style={{ background: 'radial-gradient(circle, #6366F1 0%, transparent 65%)' }} />
          <div className="absolute -bottom-28 right-0 h-64 w-64 rounded-full opacity-15 blur-3xl pointer-events-none"
               style={{ background: 'radial-gradient(circle, #EC4899 0%, transparent 65%)' }} />

          {/* Row 1 — brand · back/forward · close (always clean, never crowded) */}
          <div className="relative flex items-center gap-3 px-5 md:px-7 pt-3.5 pb-2">
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 ring-1 ring-slate-900/10 shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l1.6 4.6L18 8l-4.4 1.4L12 14l-1.6-4.6L6 8l4.4-1.4L12 2z" />
                <path d="M19 14l.8 2.4L22 17l-2.2.6L19 20l-.8-2.4L16 17l2.2-.6L19 14z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="inspirehub-title" className="text-[16px] md:text-[17px] font-extrabold tracking-tight leading-none text-slate-900">
                Inspire<span className="text-indigo-600">Hub</span>
              </h2>
              <p className="text-[10.5px] text-slate-500 mt-0.5 hidden sm:block">Competitions · AI reviews · Insights</p>
            </div>

            {/* Back / Forward navigation */}
            <div className="hidden sm:inline-flex items-center rounded-lg ring-1 ring-slate-200 bg-white shadow-sm shrink-0">
              <button onClick={goBack} disabled={histIdx <= 0}
                aria-label="Go back (Alt+←)" title="Back · Alt+←"
                className="inline-flex h-8 w-8 items-center justify-center rounded-l-lg text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <span className="h-5 w-px bg-slate-200" />
              <button onClick={goForward} disabled={histIdx >= history.length - 1}
                aria-label="Go forward (Alt+→)" title="Forward · Alt+→"
                className="inline-flex h-8 w-8 items-center justify-center rounded-r-lg text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>

            {dirty && competition && (
              <span className="hidden md:inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-full px-2 py-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                Unsaved changes
              </span>
            )}

            <button onClick={tryClose} aria-label="Close InspireHub" title="Close · Esc"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Row 2 — full-width tab strip; never overlaps Row 1 controls */}
          <nav className="relative flex items-center gap-1 px-5 md:px-7 pb-2.5" role="tablist">
            {[
              ['dashboard','Dashboard','M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z','from-indigo-500 to-violet-500','text-indigo-600'],
              ['compose','Compose','M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z','from-fuchsia-500 to-rose-500','text-fuchsia-600'],
              ['history','History','M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2','from-amber-500 to-orange-500','text-amber-600'],
            ].map(([k,l,d,grad,txt]) => {
              const on = tab === k;
              return (
                <button key={k} onClick={() => setTab(k)} role="tab" aria-selected={on}
                  className={'group relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12.5px] font-bold transition-all ' +
                    (on ? 'text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50')}>
                  {on && <span className={'absolute inset-0 rounded-xl bg-gradient-to-r ' + grad} aria-hidden />}
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={'relative ' + (on ? '' : txt)}>
                    <path d={d} />
                  </svg>
                  <span className="relative">{l}</span>
                  {k === 'compose' && competition && !on && (
                    <span className="relative ml-1 inline-block h-1.5 w-1.5 rounded-full bg-fuchsia-500" title="Active competition in Compose" />
                  )}
                </button>
              );
            })}
            <span className="ml-auto hidden md:inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <kbd className="rounded border border-slate-200 bg-white px-1 py-px text-[9.5px] text-slate-500">Alt</kbd>
              <span>+</span>
              <kbd className="rounded border border-slate-200 bg-white px-1 py-px text-[9.5px] text-slate-500">←/→</kbd>
              <span>navigate</span>
            </span>
          </nav>
        </header>

        <div ref={bodyRef} className="flex-1 overflow-y-auto bg-slate-50/40">
          {tab === 'compose' && (
            <div className="px-5 md:px-7 py-5 space-y-5">
              <CompetitionForm schoolId={schoolId} value={competition} houses={houses} students={students} onSaved={(c) => setCompetition(c)} />
              {!competition && <EmptyHero onSeeHistory={() => setTab('history')} />}
              {competition && (
                <>
                  <ResultsEntryCards competition={competition} students={students} results={results} onChange={setResults} onAiBusyChange={setAiBusy} />
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2"><MiniDashboard results={results} houses={houses} /></div>
                    <div className="lg:col-span-1"><ExportControls competition={competition} results={results} /></div>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'history'   && <HistoryPanel onEdit={loadFromHistory} onNew={startNew} />}
          {tab === 'dashboard' && <DashboardPanel houses={houses} clubs={clubs} />}
        </div>

        <footer className="relative border-t border-slate-200 bg-white">
          <div className="px-5 md:px-7 pt-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
              <span className="flex items-center gap-2">
                <span className="text-slate-900">Progress</span>
                <span className="text-slate-700">{percent}%</span>
                {aiBusy > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1.5 text-emerald-700">
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" style={{ animation: 'inspirePulseDot 1.6s infinite' }} />
                    Generating {aiBusy}…
                  </span>
                )}
              </span>
              <span className="text-slate-400 font-medium">
                {competition?.status === 'final' && <span className="mr-2 inline-flex items-center gap-1 text-emerald-700"><span>✓</span>Finalised</span>}
                {savedAt ? <>Auto-saved {timeAgo(savedAt)}</> : (competition ? 'Not saved yet' : '')}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-slate-900 transition-all duration-500" style={{ width: percent + '%' }} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px]">
              {stages.map((s) => (
                <span key={s.label} className={'inline-flex items-center gap-1 ' + (s.done ? 'text-emerald-700' : 'text-slate-500')}>
                  <span className={'inline-block h-1.5 w-1.5 rounded-full ' + (s.done ? 'bg-emerald-500' : (s.partial ? 'bg-amber-400' : 'bg-slate-300'))} />
                  {s.label}{s.detail ? ` · ${s.detail}` : ''}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-5 md:px-7 py-3 mt-2 border-t border-slate-100 bg-slate-50/60">
            {competition && (
              <button onClick={deleteCurrent}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 px-3 py-1.5 text-[12px] font-bold transition">🗑 Delete</button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={tryClose}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-3 py-1.5 text-[12px] font-bold transition">Close</button>
              {competition && (
                <>
                  <button onClick={saveAndExit}
                    className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-white text-purple-700 hover:bg-purple-50 px-3 py-1.5 text-[12px] font-bold transition">💾 Save &amp; exit</button>
                  <button onClick={finalizeNow} disabled={competition?.status === 'final' || total === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-1.5 text-[12px] font-bold text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    {competition?.status === 'final' ? '✓ Finalised' : 'Finalise →'}
                  </button>
                </>
              )}
            </div>
          </div>
        </footer>

        {confirmClose && <ConfirmDialog onCancel={() => setConfirmClose(false)} onDiscard={discardAndExit} onSave={saveAndExit} />}
        {confirmDelete && <ConfirmDeleteDialog name={competition?.name} onCancel={() => setConfirmDelete(false)} onConfirm={reallyDelete} />}
        {confirmNav && (
          <ConfirmNavDialog
            target={confirmNav.target}
            onCancel={navCancel}
            onDiscard={navDiscardAndContinue}
            onSave={navSaveAndContinue}
          />
        )}
      </div>
    </div>
  );
}

function EmptyHero({ onSeeHistory }) {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-8 md:p-10 text-center">
      <div className="relative mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l1.6 4.6L18 8l-4.4 1.4L12 14l-1.6-4.6L6 8l4.4-1.4L12 2z" />
        </svg>
      </div>
      <h3 className="relative mt-4 text-[15px] font-extrabold text-slate-900 tracking-tight">Begin a new competition</h3>
      <p className="relative mt-1 text-[12.5px] text-slate-500 max-w-md mx-auto">
        Tap a quick-start preset above or fill the form. Your work auto-saves continuously — return any time from the History tab.
      </p>
      <button onClick={onSeeHistory} className="relative mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-slate-700 hover:text-slate-900 underline-offset-4 hover:underline">
        Browse past events →
      </button>
    </div>
  );
}

function ConfirmDialog({ onCancel, onDiscard, onSave }) {
  return (
    <div className="absolute inset-0 z-[10] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="w-[90%] max-w-md rounded-2xl bg-white shadow-2xl p-5">
        <h3 className="text-[15px] font-extrabold text-slate-900">Save your progress?</h3>
        <p className="mt-1 text-[12.5px] text-slate-600">You have unsaved changes. Save them as a draft so you can finish later, or discard.</p>
        <div className="mt-4 flex items-center gap-2 justify-end">
          <button onClick={onCancel}  className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-3 py-1.5 text-[12px] font-bold">Keep editing</button>
          <button onClick={onDiscard} className="rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 px-3 py-1.5 text-[12px] font-bold">Discard</button>
          <button onClick={onSave}    className="rounded-lg bg-slate-900 text-white px-3.5 py-1.5 text-[12px] font-bold shadow-sm">Save &amp; exit</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteDialog({ name, onCancel, onConfirm }) {
  // Replaces the browser's native window.confirm() (which anchors to the top of the page,
  // way out of the teacher's gaze). This is centred over the modal with a clear destructive
  // tone, escape-to-cancel, and the competition name echoed back so they can double-check.
  React.useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onCancel?.();
      if (e.key === 'Enter')  onConfirm?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="absolute inset-0 z-[20] flex items-center justify-center bg-slate-900/55 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
      role="alertdialog" aria-modal="true" aria-labelledby="cdt"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
    >
      <div className="w-[90%] max-w-md rounded-2xl bg-white shadow-[0_24px_64px_-12px_rgba(15,23,42,0.4)] overflow-hidden">
        <div className="flex items-start gap-3 p-5">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-700 shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="cdt" className="text-[15.5px] font-extrabold text-slate-900 leading-tight">Delete this competition?</h3>
            {name && (
              <p className="mt-1 text-[12.5px] text-slate-600">
                <b className="text-slate-900">&ldquo;{name}&rdquo;</b> and every result inside it will be permanently removed.
              </p>
            )}
            <p className="mt-1 text-[11.5px] text-rose-700 font-bold">This cannot be undone.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 justify-end px-5 py-3 bg-slate-50 border-t border-slate-100">
          <button onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 px-3.5 py-1.5 text-[12.5px] font-bold transition">
            Cancel
          </button>
          <button onClick={onConfirm} autoFocus
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white px-4 py-1.5 text-[12.5px] font-extrabold shadow-[0_6px_16px_-6px_rgba(225,29,72,0.6)] transition">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            Delete forever
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmNavDialog({ target, onCancel, onDiscard, onSave }) {
  const labels = { dashboard: 'Dashboard', compose: 'Compose', history: 'History' };
  return (
    <div className="absolute inset-0 z-[10] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" role="alertdialog" aria-modal="true">
      <div className="w-[90%] max-w-md rounded-2xl bg-white shadow-2xl p-5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <div>
            <h3 className="text-[15px] font-extrabold text-slate-900 leading-tight">Leave Compose with unsaved work?</h3>
            <p className="text-[11.5px] text-slate-500 mt-0.5">You're about to switch to <b className="text-slate-700">{labels[target] || target}</b>.</p>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] text-slate-600">Save your progress as a draft so you can return later — or discard the changes you've just made.</p>
        <div className="mt-4 flex items-center gap-2 justify-end flex-wrap">
          <button onClick={onCancel}  className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-3 py-1.5 text-[12px] font-bold">Stay here</button>
          <button onClick={onDiscard} className="rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 px-3 py-1.5 text-[12px] font-bold">Discard &amp; go</button>
          <button onClick={onSave}    className="rounded-lg bg-slate-900 text-white px-3.5 py-1.5 text-[12px] font-bold shadow-sm inline-flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>
            Save &amp; continue
          </button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(d) {
  const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
