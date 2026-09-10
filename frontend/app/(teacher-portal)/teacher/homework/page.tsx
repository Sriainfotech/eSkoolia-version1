'use client';

/**
 * Teacher Portal — Homework (Phase 1)
 *
 * List + create/edit/delete against /api/v1/teacher/homework/. Class tabs
 * are derived from the teacher's own subject_assignments (via
 * flattenScope/distinctClassSections) so a subject-only teacher (e.g. Art
 * across every class) still gets a sensible tab per section they teach —
 * not just their class-teacher section.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, BookOpen, Calendar, ClipboardList, Pencil, Trash2, Users } from 'lucide-react';
import { fetchTeacherMe, fetchHomeworkList, deleteHomework, type TeacherMe, type HomeworkItem } from '@/lib/api/teacher';
import { flattenScope, distinctClassSections, resolveScopeName, type ScopeTriplet } from '@/lib/teacherScope';
import HomeworkFormModal from '@/components/teacher/HomeworkFormModal';

function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: string | number }) {
  return <div style={{ height: h, width: w, borderRadius: 8, background: 'var(--bg-2)' }} />;
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function DueBadge({ submissionDate }: { submissionDate: string }) {
  const days = Math.ceil((new Date(submissionDate + 'T00:00:00').getTime() - Date.now()) / 86400000);
  let label = `Due ${fmtDate(submissionDate)}`;
  let color = 'var(--ink-3)', bg = 'var(--bg-2)';
  if (days < 0) { label = 'Overdue'; color = 'var(--danger)'; bg = 'var(--danger-soft)'; }
  else if (days === 0) { label = 'Due today'; color = 'var(--warn)'; bg = 'var(--warn-soft)'; }
  else if (days <= 2) { label = `Due in ${days}d`; color = 'var(--warn)'; bg = 'var(--warn-soft)'; }
  return <span style={{ fontSize: 11, fontWeight: 600, color, background: bg, padding: '3px 9px', borderRadius: 20 }}>{label}</span>;
}

export default function TeacherHomeworkPage() {
  const [me, setMe] = useState<TeacherMe | null>(null);
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; item?: HomeworkItem } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([fetchTeacherMe(), fetchHomeworkList()])
      .then(([meData, list]) => { setMe(meData); setItems(list); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const scope: ScopeTriplet[] = useMemo(() => flattenScope(me?.subject_assignments ?? []), [me]);
  const tabs = useMemo(() => distinctClassSections(scope), [scope]);

  const visibleItems = useMemo(() => {
    if (activeTab === 'all') return items;
    const [classId, sectionId] = activeTab.split(':').map(Number);
    return items.filter((h) => h.class_id === classId && (h.section_id === sectionId || h.section_id === null));
  }, [items, activeTab]);

  async function handleDelete(id: number) {
    if (!confirm('Delete this homework? Students will no longer see it.')) return;
    setDeletingId(id);
    try {
      await deleteHomework(id);
      setItems((prev) => prev.filter((h) => h.id !== id));
    } catch {
      alert('Could not delete this homework. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--bd)', borderRadius: 18, boxShadow: 'var(--sh-1)', padding: '28px 30px' }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22, paddingBottom: 20, borderBottom: '1px solid var(--bd)' }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 600, color: 'var(--ink-1)', margin: '0 0 5px', lineHeight: 1.05, letterSpacing: '-0.03em', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            Homework{' '}
            <em style={{ fontFamily: 'var(--font-instrument-serif,\'Instrument Serif\',Georgia,serif)', fontWeight: 400, fontStyle: 'italic', color: '#15803D', fontSize: 38, letterSpacing: '-0.02em' }}>
              Assignments
            </em>
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.55 }}>
            Create, track, and grade homework across your classes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/teacher/homework/submissions"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg-1)', color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            <ClipboardList size={15} /> Submissions
          </Link>
          <button onClick={() => setModalState({ mode: 'create' })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--pu)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={15} /> New Homework
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-soft)', border: '1px solid transparent', borderRadius: 10, padding: '12px 16px', color: 'var(--danger)', fontSize: 13, marginBottom: 20 }}>
          Could not load homework. Please refresh.
        </div>
      )}

      {!loading && tabs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('all')}
            style={{ padding: '7px 16px', borderRadius: 24, border: `1.5px solid ${activeTab === 'all' ? 'var(--pu)' : 'var(--bd)'}`, background: activeTab === 'all' ? 'var(--pu-soft)' : '#fff', color: activeTab === 'all' ? 'var(--pu)' : 'var(--ink-2)', fontSize: 13, fontWeight: activeTab === 'all' ? 600 : 400, cursor: 'pointer' }}>
            All Classes
          </button>
          {tabs.map((t) => {
            const key = `${t.class_id}:${t.section_id}`;
            const sel = activeTab === key;
            return (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{ padding: '7px 16px', borderRadius: 24, border: `1.5px solid ${sel ? 'var(--pu)' : 'var(--bd)'}`, background: sel ? 'var(--pu-soft)' : '#fff', color: sel ? 'var(--pu)' : 'var(--ink-2)', fontSize: 13, fontWeight: sel ? 600 : 400, cursor: 'pointer' }}>
                {t.class_name} {t.section_name}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} h={92} />)}
        </div>
      ) : visibleItems.length === 0 ? (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--bd)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <BookOpen size={28} color="var(--ink-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>No homework yet</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Create your first assignment for this class.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibleItems.map((h) => {
            const names = resolveScopeName(scope, h.class_id, h.section_id, h.subject_id);
            const graded = h.evaluations.filter((s) => s.complete_status === 'C').length;
            return (
              <div key={h.id} style={{ border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 18px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F0FDF4', display: 'grid', placeItems: 'center', flex: 'none' }}>
                  <BookOpen size={18} color="#15803D" strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-1)' }}>{names.subject_name}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{names.class_name} {names.section_name}</span>
                    <DueBadge submissionDate={h.submission_date} />
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {h.description}
                  </p>
                  <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--ink-3)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> Assigned {fmtDate(h.homework_date)}</span>
                    {h.evaluations.length > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12} /> {graded}/{h.evaluations.length} graded</span>
                    )}
                    {h.marks > 0 && <span>{h.marks} marks</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                  <Link href={`/teacher/homework/submissions?homework_id=${h.id}`} title="View submissions"
                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--bd)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}>
                    <ClipboardList size={15} />
                  </Link>
                  <button onClick={() => setModalState({ mode: 'edit', item: h })} title="Edit"
                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg-1)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', cursor: 'pointer' }}>
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => handleDelete(h.id)} disabled={deletingId === h.id} title="Delete"
                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg-1)', display: 'grid', placeItems: 'center', color: 'var(--danger)', cursor: 'pointer', opacity: deletingId === h.id ? 0.5 : 1 }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalState && (
        <HomeworkFormModal
          scope={scope}
          initial={modalState.mode === 'edit' ? modalState.item : null}
          onClose={() => setModalState(null)}
          onSaved={(saved) => {
            setItems((prev) => (modalState.mode === 'edit' ? prev.map((h) => (h.id === saved.id ? saved : h)) : [saved, ...prev]));
            setModalState(null);
          }}
        />
      )}
    </div>
  );
}
