'use client';

/**
 * LessonPlanFormModal
 *
 * Create/edit a lesson plan. class → section → subject cascades from
 * subject_assignments (same as HomeworkFormModal). The lesson_detail_id
 * a plan belongs to is picked from that scope's Lesson groups
 * (fetchLessonGroups) — with an inline "+ new title" escape hatch via
 * createLessonGroups, since a teacher may be starting a brand-new topic
 * with no existing Lesson group yet.
 */

import { useEffect, useMemo, useState } from 'react';
import { X, FileText, Loader2, Plus } from 'lucide-react';
import {
  createLessonPlan, updateLessonPlan, fetchLessonGroups, createLessonGroups,
  type LessonPlanItem, type LessonPlanFormInput, type LessonGroupItem,
} from '@/lib/api/teacher';
import type { ScopeTriplet } from '@/lib/teacherScope';

interface Props {
  scope: ScopeTriplet[];
  initial?: LessonPlanItem | null;
  onClose: () => void;
  onSaved: (plan: LessonPlanItem) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--bd)',
  fontSize: 13.5, color: 'var(--ink-1)', background: 'var(--bg-1)', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.04em',
};

export default function LessonPlanFormModal({ scope, initial, onClose, onSaved }: Props) {
  const isEdit = Boolean(initial);
  const [classId, setClassId] = useState<number | ''>(initial?.class_id ?? '');
  const [sectionId, setSectionId] = useState<number | ''>(initial?.section_id ?? '');
  const [subjectId, setSubjectId] = useState<number | ''>(initial?.subject_id ?? '');
  const [lessonDetailId, setLessonDetailId] = useState<number | ''>(initial?.lesson_detail_id ?? '');
  const [lessonGroups, setLessonGroups] = useState<LessonGroupItem[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [lessonDate, setLessonDate] = useState(initial?.lesson_date ?? '');
  const [subTopic, setSubTopic] = useState(initial?.sub_topic ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [showMore, setShowMore] = useState(false);
  const [teachingMethod, setTeachingMethod] = useState(initial?.teaching_method ?? '');
  const [objectives, setObjectives] = useState(initial?.general_objectives ?? '');

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
    scope.filter((s) => s.class_id === classId && (sectionId === '' || s.section_id === sectionId)).forEach((s) => seen.set(s.subject_id, s.subject_name));
    return [...seen.entries()];
  }, [scope, classId, sectionId]);

  useEffect(() => {
    if (!classId || !subjectId) { setLessonGroups([]); return; }
    fetchLessonGroups({ class_id: Number(classId), section_id: sectionId ? Number(sectionId) : undefined, subject_id: Number(subjectId) })
      .then(setLessonGroups)
      .catch(() => setLessonGroups([]));
  }, [classId, sectionId, subjectId]);

  async function handleAddGroup() {
    if (!newTitle.trim() || !classId || !subjectId) return;
    setCreatingGroup(true);
    try {
      const created = await createLessonGroups({ class_id: Number(classId), section_id: sectionId ? Number(sectionId) : null, subject_id: Number(subjectId), lesson: newTitle.trim() });
      setLessonGroups((prev) => [...prev, ...created]);
      if (created[0]) setLessonDetailId(created[0].id);
      setNewTitle('');
    } catch {
      setError('Could not create that lesson title. Please try again.');
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!classId || !subjectId || !lessonDetailId || !lessonDate) {
      setError('Class, subject, a lesson title, and the lesson date are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload: LessonPlanFormInput = {
      class_id: Number(classId),
      section_id: sectionId === '' ? null : Number(sectionId),
      subject_id: Number(subjectId),
      lesson_detail_id: Number(lessonDetailId),
      lesson_date: lessonDate,
      sub_topic: subTopic || undefined,
      teaching_method: teachingMethod || undefined,
      general_objectives: objectives || undefined,
      note: note || undefined,
    };
    try {
      const saved = isEdit ? await updateLessonPlan(initial!.id, payload) : await createLessonPlan(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this lesson plan. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit lesson plan' : 'New lesson plan'}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,18,34,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}
        style={{ background: 'var(--bg-1)', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--sh-3)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#FDF4FF', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <FileText size={17} color="#A21CAF" strokeWidth={2} />
          </div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink-1)', flex: 1 }}>
            {isEdit ? 'Edit Lesson Plan' : 'New Lesson Plan'}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'var(--bg-2)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-3)' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ background: 'var(--danger-soft)', border: '1px solid transparent', borderRadius: 9, padding: '10px 13px', color: 'var(--danger)', fontSize: 12.5 }}>{error}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Class</label>
              <select style={inputStyle} value={classId} disabled={isEdit}
                onChange={(e) => { setClassId(e.target.value ? Number(e.target.value) : ''); setSectionId(''); setSubjectId(''); setLessonDetailId(''); }}>
                <option value="">Select</option>
                {classes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Section</label>
              <select style={inputStyle} value={sectionId} disabled={isEdit || !classId}
                onChange={(e) => { setSectionId(e.target.value ? Number(e.target.value) : ''); setLessonDetailId(''); }}>
                <option value="">Whole class</option>
                {sections.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Subject</label>
              <select style={inputStyle} value={subjectId} disabled={isEdit || !classId}
                onChange={(e) => { setSubjectId(e.target.value ? Number(e.target.value) : ''); setLessonDetailId(''); }}>
                <option value="">Select</option>
                {subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Lesson</label>
            <select style={inputStyle} value={lessonDetailId} disabled={isEdit || !subjectId}
              onChange={(e) => setLessonDetailId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">{subjectId ? 'Select a lesson title' : 'Choose a subject first'}</option>
              {lessonGroups.map((g) => <option key={g.id} value={g.id}>{g.lesson_name}</option>)}
            </select>
            {!isEdit && subjectId && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Or type a new lesson title…" style={{ ...inputStyle, flex: 1 }} />
                <button type="button" onClick={handleAddGroup} disabled={creatingGroup || !newTitle.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg-1)', color: 'var(--pu)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {creatingGroup ? <Loader2 size={13} className="spin" /> : <Plus size={13} />} Add
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Lesson Date</label>
              <input type="date" style={inputStyle} value={lessonDate} onChange={(e) => setLessonDate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Sub-topic</label>
              <input type="text" style={inputStyle} value={subTopic} onChange={(e) => setSubTopic(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <button type="button" onClick={() => setShowMore((v) => !v)}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--pu)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            {showMore ? '− Fewer details' : '+ More details (teaching method, objectives, notes)'}
          </button>

          {showMore && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Teaching Method</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} value={teachingMethod} onChange={(e) => setTeachingMethod(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Objectives</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} value={objectives} onChange={(e) => setObjectives(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Note</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--bd)' }}>
          <button type="button" onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg-1)', color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 9, border: 'none', background: '#A21CAF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving && <Loader2 size={14} className="spin" />}
            {isEdit ? 'Save Changes' : 'Create Plan'}
          </button>
        </div>
      </form>
      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
