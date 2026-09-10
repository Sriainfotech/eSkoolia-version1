'use client';

/**
 * HomeworkFormModal
 *
 * Create/edit form for a homework assignment. Class → section → subject
 * selects are cascaded from the teacher's own subject_assignments
 * (flattenScope) — options outside that scope are never offered, since the
 * backend would 403 them anyway.
 */

import { useMemo, useState } from 'react';
import { X, BookOpen, Loader2 } from 'lucide-react';
import { createHomework, updateHomework, type HomeworkItem, type HomeworkFormInput } from '@/lib/api/teacher';
import { flattenScope, type ScopeTriplet } from '@/lib/teacherScope';

interface Props {
  scope: ScopeTriplet[];
  initial?: HomeworkItem | null;
  onClose: () => void;
  onSaved: (homework: HomeworkItem) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--bd)',
  fontSize: 13.5, color: 'var(--ink-1)', background: 'var(--bg-1)', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.04em',
};

export default function HomeworkFormModal({ scope, initial, onClose, onSaved }: Props) {
  const isEdit = Boolean(initial);
  const [classId, setClassId] = useState<number | ''>(initial?.class_id ?? '');
  const [sectionId, setSectionId] = useState<number | ''>(initial?.section_id ?? '');
  const [subjectId, setSubjectId] = useState<number | ''>(initial?.subject_id ?? '');
  const [homeworkDate, setHomeworkDate] = useState(initial?.homework_date ?? '');
  const [submissionDate, setSubmissionDate] = useState(initial?.submission_date ?? '');
  const [evaluationDate, setEvaluationDate] = useState(initial?.evaluation_date ?? '');
  const [marks, setMarks] = useState<string>(initial?.marks ? String(initial.marks) : '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classes = useMemo(() => {
    const seen = new Map<number, string>();
    scope.forEach((s) => seen.set(s.class_id, s.class_name));
    return [...seen.entries()];
  }, [scope]);

  const sections = useMemo(() => {
    const seen = new Map<number, string>();
    scope.filter((s) => s.class_id === classId).forEach((s) => seen.set(s.section_id, s.section_name));
    return [...seen.entries()];
  }, [scope, classId]);

  const subjects = useMemo(() => {
    const seen = new Map<number, string>();
    scope
      .filter((s) => s.class_id === classId && (sectionId === '' || s.section_id === sectionId))
      .forEach((s) => seen.set(s.subject_id, s.subject_name));
    return [...seen.entries()];
  }, [scope, classId, sectionId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!classId || !subjectId || !homeworkDate || !submissionDate || !description.trim()) {
      setError('Class, subject, both dates, and a description are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload: HomeworkFormInput = {
      class_id: Number(classId),
      section_id: sectionId === '' ? null : Number(sectionId),
      subject_id: Number(subjectId),
      homework_date: homeworkDate,
      submission_date: submissionDate,
      evaluation_date: evaluationDate || null,
      marks: marks ? Number(marks) : undefined,
      description: description.trim(),
    };
    try {
      const saved = isEdit ? await updateHomework(initial!.id, payload) : await createHomework(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this homework. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit homework' : 'New homework'}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,18,34,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}
        style={{ background: 'var(--bg-1)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--sh-3)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F0FDF4', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <BookOpen size={17} color="#15803D" strokeWidth={2} />
          </div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink-1)', flex: 1 }}>
            {isEdit ? 'Edit Homework' : 'New Homework'}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'var(--bg-2)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-3)' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ background: 'var(--danger-soft)', border: '1px solid transparent', borderRadius: 9, padding: '10px 13px', color: 'var(--danger)', fontSize: 12.5 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Class</label>
              <select style={inputStyle} value={classId} disabled={isEdit}
                onChange={(e) => { setClassId(e.target.value ? Number(e.target.value) : ''); setSectionId(''); setSubjectId(''); }}>
                <option value="">Select</option>
                {classes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Section</label>
              <select style={inputStyle} value={sectionId} disabled={isEdit || !classId}
                onChange={(e) => { setSectionId(e.target.value ? Number(e.target.value) : ''); setSubjectId(''); }}>
                <option value="">Whole class</option>
                {sections.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Subject</label>
              <select style={inputStyle} value={subjectId} disabled={isEdit || !classId}
                onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Select</option>
                {subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Assigned On</label>
              <input type="date" style={inputStyle} value={homeworkDate} onChange={(e) => setHomeworkDate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input type="date" style={inputStyle} value={submissionDate} onChange={(e) => setSubmissionDate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Full Marks</label>
              <input type="number" min={0} style={inputStyle} value={marks} onChange={(e) => setMarks(e.target.value)} placeholder="e.g. 10" />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }}
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What should students do for this assignment?" />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--bd)' }}>
          <button type="button" onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg-1)', color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 9, border: 'none', background: 'var(--pu)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving && <Loader2 size={14} className="spin" />}
            {isEdit ? 'Save Changes' : 'Create Homework'}
          </button>
        </div>
      </form>
      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
