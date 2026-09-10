'use client';

/**
 * Teacher Portal — Lesson Plans (Phase 1)
 *
 * List + create/edit against /api/v1/teacher/lessons/, filterable by the
 * 5-stage workflow_status. class/section/subject names come straight off
 * LessonPlannerSerializer (unlike Homework, it does include *_name fields).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, FileText, Calendar, Loader2 } from 'lucide-react';
import { fetchTeacherMe, fetchLessonPlans, updateLessonPlan, type TeacherMe, type LessonPlanItem, type LessonWorkflowStatus } from '@/lib/api/teacher';
import { flattenScope } from '@/lib/teacherScope';
import LessonPlanFormModal from '@/components/teacher/LessonPlanFormModal';

function Skeleton({ h = 16 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 8, background: 'var(--bg-2)' }} />;
}

const STAGES: { key: LessonWorkflowStatus; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'revision_requested', label: 'Revision Requested' },
];
const STAGE_INDEX: Record<LessonWorkflowStatus, number> = { draft: 0, submitted: 1, under_review: 2, approved: 3, revision_requested: 1 };
const STAGE_COLOR: Record<LessonWorkflowStatus, string> = {
  draft: 'var(--ink-3)', submitted: 'var(--info)', under_review: 'var(--warn)', approved: 'var(--ok)', revision_requested: 'var(--danger)',
};

function WorkflowStepper({ status }: { status: LessonWorkflowStatus }) {
  if (status === 'revision_requested') {
    return <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', background: 'var(--danger-soft)', padding: '3px 9px', borderRadius: 20 }}>Revision Requested</span>;
  }
  const current = STAGE_INDEX[status];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {STAGES.slice(0, 4).map((s, i) => (
        <div key={s.key} title={s.label} style={{ width: 18, height: 5, borderRadius: 3, background: i <= current ? STAGE_COLOR[status] : 'var(--bd)' }} />
      ))}
      <span style={{ fontSize: 11, fontWeight: 600, color: STAGE_COLOR[status], marginLeft: 4 }}>{STAGES[current]?.label}</span>
    </div>
  );
}

export default function TeacherLessonsPage() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('workflow_status') as LessonWorkflowStatus | null;

  const [me, setMe] = useState<TeacherMe | null>(null);
  const [items, setItems] = useState<LessonPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<'all' | LessonWorkflowStatus>(initialFilter ?? 'all');
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; item?: LessonPlanItem } | null>(null);
  const [submitting, setSubmitting] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([fetchTeacherMe(), fetchLessonPlans()])
      .then(([meData, list]) => { setMe(meData); setItems(list); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const scope = useMemo(() => flattenScope(me?.subject_assignments ?? []), [me]);
  const visible = useMemo(() => (filter === 'all' ? items : items.filter((p) => p.workflow_status === filter)), [items, filter]);

  async function handleSubmitForReview(plan: LessonPlanItem) {
    setSubmitting(plan.id);
    try {
      const updated = await updateLessonPlan(plan.id, { workflow_status: 'submitted' });
      setItems((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
    } catch {
      alert('Could not submit this plan for review.');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--bd)', borderRadius: 18, boxShadow: 'var(--sh-1)', padding: '28px 30px' }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22, paddingBottom: 20, borderBottom: '1px solid var(--bd)' }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 600, color: 'var(--ink-1)', margin: '0 0 5px', lineHeight: 1.05, letterSpacing: '-0.03em', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            Lesson{' '}
            <em style={{ fontFamily: 'var(--font-instrument-serif,\'Instrument Serif\',Georgia,serif)', fontWeight: 400, fontStyle: 'italic', color: '#A21CAF', fontSize: 38, letterSpacing: '-0.02em' }}>
              Plans
            </em>
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.55 }}>
            Plan lessons and track them through review.
          </p>
        </div>
        <button onClick={() => setModalState({ mode: 'create' })}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: '#A21CAF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} /> New Lesson Plan
        </button>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-soft)', border: '1px solid transparent', borderRadius: 10, padding: '12px 16px', color: 'var(--danger)', fontSize: 13, marginBottom: 20 }}>
          Could not load lesson plans. Please refresh.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')}
          style={{ padding: '7px 16px', borderRadius: 24, border: `1.5px solid ${filter === 'all' ? '#A21CAF' : 'var(--bd)'}`, background: filter === 'all' ? '#FDF4FF' : '#fff', color: filter === 'all' ? '#A21CAF' : 'var(--ink-2)', fontSize: 13, fontWeight: filter === 'all' ? 600 : 400, cursor: 'pointer' }}>
          All
        </button>
        {STAGES.map((s) => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            style={{ padding: '7px 16px', borderRadius: 24, border: `1.5px solid ${filter === s.key ? '#A21CAF' : 'var(--bd)'}`, background: filter === s.key ? '#FDF4FF' : '#fff', color: filter === s.key ? '#A21CAF' : 'var(--ink-2)', fontSize: 13, fontWeight: filter === s.key ? 600 : 400, cursor: 'pointer' }}>
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} h={84} />)}
        </div>
      ) : visible.length === 0 ? (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--bd)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <FileText size={28} color="var(--ink-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>No lesson plans here yet</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Create one to start tracking it through review.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map((p) => (
            <div key={p.id} style={{ border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 18px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FDF4FF', display: 'grid', placeItems: 'center', flex: 'none' }}>
                <FileText size={18} color="#A21CAF" strokeWidth={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-1)' }}>{p.lesson_detail_name}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{p.subject_name} · {p.class_name} {p.section_name}</span>
                </div>
                {p.sub_topic && <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--ink-2)' }}>{p.sub_topic}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--ink-3)' }}><Calendar size={12} /> {new Date(p.lesson_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  <WorkflowStepper status={p.workflow_status} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                {p.workflow_status === 'draft' && (
                  <button onClick={() => handleSubmitForReview(p)} disabled={submitting === p.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--info)', background: 'var(--info-soft)', color: 'var(--info)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {submitting === p.id && <Loader2 size={12} className="spin" />} Submit for Review
                  </button>
                )}
                <button onClick={() => setModalState({ mode: 'edit', item: p })}
                  style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg-1)', color: 'var(--ink-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalState && (
        <LessonPlanFormModal
          scope={scope}
          initial={modalState.mode === 'edit' ? modalState.item : null}
          onClose={() => setModalState(null)}
          onSaved={(saved) => {
            setItems((prev) => (modalState.mode === 'edit' ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]));
            setModalState(null);
          }}
        />
      )}
      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
