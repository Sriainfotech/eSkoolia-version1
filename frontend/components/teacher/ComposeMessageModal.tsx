'use client';

/**
 * ComposeMessageModal
 *
 * There's no "recipient directory" endpoint on the teacher portal yet, so
 * composing a fresh message resolves a recipient the only scope-safe way
 * available: pick one of the teacher's own students (from their own
 * classes), then resolve that student's guardian portal-account id via
 * fetchStudentCredentials(). A reply skips all of this — the recipient is
 * already known from the message being replied to.
 */

import { useEffect, useState } from 'react';
import { X, Send, Loader2, Search } from 'lucide-react';
import {
  fetchMyClasses, fetchStudentList, fetchStudentCredentials, sendTeacherMessage,
  type MyClass, type StudentListItem, type InAppMessageItem,
} from '@/lib/api/teacher';

interface ReplyTo { recipientId: number; recipientName: string; subject: string }

interface Props {
  replyTo?: ReplyTo;
  onClose: () => void;
  onSent: (message: InAppMessageItem) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--bd)',
  fontSize: 13.5, color: 'var(--ink-1)', background: 'var(--bg-1)', outline: 'none',
};

export default function ComposeMessageModal({ replyTo, onClose, onSent }: Props) {
  const [classes, setClasses] = useState<MyClass[]>([]);
  const [classKey, setClassKey] = useState('');
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [resolvedRecipientId, setResolvedRecipientId] = useState<number | null>(replyTo?.recipientId ?? null);
  const [resolvedRecipientName, setResolvedRecipientName] = useState(replyTo?.recipientName ?? '');
  const [resolving, setResolving] = useState<number | null>(null);

  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (replyTo) return;
    fetchMyClasses().then(setClasses).catch(() => setClasses([]));
  }, [replyTo]);

  useEffect(() => {
    if (!classKey) { setStudents([]); return; }
    const [classId, sectionId] = classKey.split(':').map(Number);
    fetchStudentList(classId, sectionId).then(setStudents).catch(() => setStudents([]));
  }, [classKey]);

  async function pickStudent(student: StudentListItem) {
    setResolving(student.id);
    setError(null);
    try {
      const creds = await fetchStudentCredentials(student.id);
      if (!creds.parent.has_account || !creds.parent.id) {
        setError(`${student.name}'s guardian has no portal account to message yet.`);
        return;
      }
      setResolvedRecipientId(creds.parent.id);
      setResolvedRecipientName(`${student.name}'s guardian`);
    } catch {
      setError('Could not look up this student\'s guardian. Please try again.');
    } finally {
      setResolving(null);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvedRecipientId || !subject.trim() || !body.trim()) {
      setError('Choose a recipient, then fill in a subject and message.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const message = await sendTeacherMessage({ recipient_id: resolvedRecipientId, subject: subject.trim(), body: body.trim() });
      onSent(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send this message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const filteredStudents = students.filter((s) => s.name.toLowerCase().includes(studentQuery.toLowerCase()));

  return (
    <div role="dialog" aria-modal="true" aria-label={replyTo ? 'Reply' : 'New message'}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,18,34,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSend}
        style={{ background: 'var(--bg-1)', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--sh-3)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 24px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F0F9FF', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <Send size={16} color="#0369A1" strokeWidth={2} />
          </div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink-1)', flex: 1 }}>{replyTo ? 'Reply' : 'New Message'}</h3>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'var(--bg-2)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-3)' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ background: 'var(--danger-soft)', border: '1px solid transparent', borderRadius: 9, padding: '10px 13px', color: 'var(--danger)', fontSize: 12.5 }}>{error}</div>
          )}

          {!replyTo && !resolvedRecipientId && (
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Message about which student?
              </label>
              <select style={{ ...inputStyle, marginBottom: 8 }} value={classKey} onChange={(e) => setClassKey(e.target.value)}>
                <option value="">Choose a class</option>
                {classes.map((c) => <option key={`${c.class_id}:${c.section_id}`} value={`${c.class_id}:${c.section_id}`}>{c.class_name} {c.section_name}</option>)}
              </select>
              {classKey && (
                <>
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <Search size={13} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--ink-3)' }} />
                    <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="Search student…" value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} />
                  </div>
                  <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 9 }}>
                    {filteredStudents.map((s) => (
                      <button key={s.id} type="button" onClick={() => pickStudent(s)} disabled={resolving === s.id}
                        style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--bd)', cursor: 'pointer', fontSize: 13, color: 'var(--ink-1)', textAlign: 'left' }}>
                        {s.name} {resolving === s.id && <Loader2 size={13} className="spin" />}
                      </button>
                    ))}
                    {filteredStudents.length === 0 && <div style={{ padding: 12, fontSize: 12.5, color: 'var(--ink-3)' }}>No students found.</div>}
                  </div>
                </>
              )}
            </div>
          )}

          {resolvedRecipientId && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--pu-soft)', border: '1px solid transparent', borderRadius: 9, padding: '9px 13px' }}>
              <span style={{ fontSize: 13, color: 'var(--pu)', fontWeight: 600 }}>To: {resolvedRecipientName}</span>
              {!replyTo && (
                <button type="button" onClick={() => { setResolvedRecipientId(null); setResolvedRecipientName(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--pu)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Change</button>
              )}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subject</label>
            <input style={inputStyle} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Message</label>
            <textarea style={{ ...inputStyle, minHeight: 110, resize: 'vertical', fontFamily: 'inherit' }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--bd)' }}>
          <button type="button" onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg-1)', color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={sending || !resolvedRecipientId}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 9, border: 'none', background: '#0369A1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: sending ? 'default' : 'pointer', opacity: sending || !resolvedRecipientId ? 0.6 : 1 }}>
            {sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
            Send
          </button>
        </div>
      </form>
      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
