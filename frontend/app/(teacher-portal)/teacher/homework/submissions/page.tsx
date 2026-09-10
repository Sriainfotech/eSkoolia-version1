'use client';

/**
 * Teacher Portal — Homework Submissions (Phase 1)
 *
 * Pick a homework assignment, grade each student's submission inline.
 * HomeworkSubmissionSerializer only returns raw student ids (no nested
 * name/roll_no) — names are resolved client-side against the class
 * roster (fetchStudentList) for the parent homework's class+section.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClipboardList, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import {
  fetchHomeworkList, fetchHomeworkSubmissions, gradeSubmission, fetchStudentList,
  type HomeworkItem, type HomeworkSubmissionItem, type StudentListItem,
} from '@/lib/api/teacher';

function Skeleton({ h = 16 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 8, background: 'var(--bg-2)' }} />;
}

const STATUS_CFG: Record<HomeworkSubmissionItem['complete_status'], { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  C: { label: 'Completed', color: 'var(--ok)', bg: 'var(--ok-soft)', icon: CheckCircle2 },
  I: { label: 'Incomplete', color: 'var(--warn)', bg: 'var(--warn-soft)', icon: AlertCircle },
  P: { label: 'Pending', color: 'var(--ink-3)', bg: 'var(--bg-2)', icon: Clock },
};

interface RowDraft { marks: string; complete_status: HomeworkSubmissionItem['complete_status']; note: string }

export default function HomeworkSubmissionsPage() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('homework_id');

  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(initialId ? Number(initialId) : null);
  const [submissions, setSubmissions] = useState<HomeworkSubmissionItem[]>([]);
  const [roster, setRoster] = useState<StudentListItem[]>([]);
  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchHomeworkList().then((list) => {
      setHomeworkList(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    }).catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedHomework = useMemo(() => homeworkList.find((h) => h.id === selectedId) ?? null, [homeworkList, selectedId]);

  const load = useCallback(() => {
    if (!selectedHomework) return;
    setLoading(true);
    setError(false);
    Promise.all([
      fetchHomeworkSubmissions(selectedHomework.id),
      selectedHomework.section_id
        ? fetchStudentList(selectedHomework.class_id, selectedHomework.section_id)
        : Promise.resolve([] as StudentListItem[]),
    ])
      .then(([subs, students]) => {
        setSubmissions(subs);
        setRoster(students);
        const nextDrafts: Record<number, RowDraft> = {};
        subs.forEach((s) => { nextDrafts[s.id] = { marks: String(s.marks ?? ''), complete_status: s.complete_status, note: s.note }; });
        setDrafts(nextDrafts);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [selectedHomework]);

  useEffect(() => { load(); }, [load]);

  const studentName = (studentId: number) => {
    const s = roster.find((r) => r.id === studentId);
    return s ? { name: s.name, roll: s.roll_no } : { name: `Student #${studentId}`, roll: '' };
  };

  async function handleSave(submissionId: number) {
    const draft = drafts[submissionId];
    if (!draft) return;
    setSaving(submissionId);
    try {
      const updated = await gradeSubmission(submissionId, {
        marks: draft.marks ? Number(draft.marks) : undefined,
        complete_status: draft.complete_status,
        note: draft.note,
      });
      setSubmissions((prev) => prev.map((s) => (s.id === submissionId ? updated : s)));
    } catch {
      alert('Could not save this grade. Please try again.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--bd)', borderRadius: 18, boxShadow: 'var(--sh-1)', padding: '28px 30px' }}>

      <div style={{ marginBottom: 22, paddingBottom: 20, borderBottom: '1px solid var(--bd)' }}>
        <h1 style={{ fontSize: 34, fontWeight: 600, color: 'var(--ink-1)', margin: '0 0 5px', lineHeight: 1.05, letterSpacing: '-0.03em', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          Grade{' '}
          <em style={{ fontFamily: 'var(--font-instrument-serif,\'Instrument Serif\',Georgia,serif)', fontWeight: 400, fontStyle: 'italic', color: '#15803D', fontSize: 38, letterSpacing: '-0.02em' }}>
            Submissions
          </em>
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.55 }}>
          Mark completion status and enter scores for each student.
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <select value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
          style={{ padding: '10px 14px', borderRadius: 9, border: '1px solid var(--bd)', fontSize: 13.5, color: 'var(--ink-1)', background: 'var(--bg-1)', minWidth: 320 }}>
          {homeworkList.length === 0 && <option value="">No homework yet</option>}
          {homeworkList.map((h) => (
            <option key={h.id} value={h.id}>{h.description.slice(0, 60)}{h.description.length > 60 ? '…' : ''} — due {h.submission_date}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-soft)', border: '1px solid transparent', borderRadius: 10, padding: '12px 16px', color: 'var(--danger)', fontSize: 13, marginBottom: 20 }}>
          Could not load submissions. Please refresh.
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} h={56} />)}
        </div>
      ) : submissions.length === 0 ? (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--bd)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <ClipboardList size={28} color="var(--ink-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>No submissions recorded yet</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Submission rows appear here once students turn work in.</div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--bd)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)' }}>
                {['Student', 'Status', 'Marks', 'Note', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-3)', borderBottom: '1px solid var(--bd)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissions.map((s, idx) => {
                const draft = drafts[s.id] ?? { marks: '', complete_status: s.complete_status, note: s.note };
                const { name, roll } = studentName(s.student);
                const cfg = STATUS_CFG[draft.complete_status];
                const Icon = cfg.icon;
                return (
                  <tr key={s.id} style={{ borderBottom: idx < submissions.length - 1 ? '1px solid var(--bd)' : 'none' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--ink-1)', fontWeight: 500 }}>
                      {name}{roll && <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> · Roll {roll}</span>}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <select value={draft.complete_status}
                        onChange={(e) => setDrafts((p) => ({ ...p, [s.id]: { ...draft, complete_status: e.target.value as HomeworkSubmissionItem['complete_status'] } }))}
                        style={{ padding: '5px 10px', borderRadius: 20, border: `1px solid ${cfg.color}33`, background: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 600 }}>
                        <option value="P">Pending</option>
                        <option value="I">Incomplete</option>
                        <option value="C">Completed</option>
                      </select>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <input type="number" min={0} value={draft.marks}
                        onChange={(e) => setDrafts((p) => ({ ...p, [s.id]: { ...draft, marks: e.target.value } }))}
                        style={{ width: 72, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--bd)', fontSize: 13 }} />
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <input type="text" value={draft.note} placeholder="Optional feedback"
                        onChange={(e) => setDrafts((p) => ({ ...p, [s.id]: { ...draft, note: e.target.value } }))}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid var(--bd)', fontSize: 13 }} />
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <button onClick={() => handleSave(s.id)} disabled={saving === s.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: 'none', background: 'var(--pu)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: saving === s.id ? 0.6 : 1 }}>
                        {saving === s.id ? <Loader2 size={12} className="spin" /> : <Icon size={12} />}
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
