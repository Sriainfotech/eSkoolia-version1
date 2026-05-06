'use client';
import { useEffect, useState, useCallback } from 'react';
import { Phone, MessageCircle, Check, AlertTriangle, Plus, FileText, X, CheckCheck, Trash2 } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface CallEntry {
  id: string;
  name: string;
  role: string;
  reason: string;
  phone: string;
  urgency: 'low' | 'normal' | 'high' | 'emergency';
  sourceLink?: string;
  isEmergency: boolean;
  notes?: string;
  done?: boolean;
}

const MOCK: CallEntry[] = [
  { id: '1', name: 'Mrs. Sharma', role: 'Parent', reason: "Aarav's Math performance (52%)", phone: '+919876543210', urgency: 'high', isEmergency: false, sourceLink: '/students/list' },
  { id: '2', name: 'Raj Medical', role: 'Vendor', reason: 'Invoice #2847 pending for 14 days', phone: '+919811234567', urgency: 'normal', isEmergency: false },
  { id: '3', name: 'Mr. Khan', role: 'Parent', reason: 'Aarav in sick bay – awaiting pickup', phone: '+919988776655', urgency: 'emergency', isEmergency: true, sourceLink: '/utilities/sick-bay/1' },
];

const LS_KEY = 'eskoolia_calls_queue';
function loadLS(): CallEntry[] {
  try { const d = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); return Array.isArray(d) && d.length ? d : MOCK; } catch { return MOCK; }
}
function saveLS(d: CallEntry[]) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {} }

const URGENCY = {
  low:       { bg: '#F3F4F6', text: '#6B7280' },
  normal:    { bg: '#DBEAFE', text: '#1D4ED8' },
  high:      { bg: '#FEF3C7', text: '#92400E' },
  emergency: { bg: '#FEE2E2', text: '#B91C1C' },
};

export function CallsQueue() {
  const [calls, setCalls] = useState<CallEntry[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<Record<string, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', role: 'Parent', reason: '', phone: '', urgency: 'normal' as CallEntry['urgency'] });

  const fetchData = useCallback(() => {
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/ai/calls-queue/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d) && d.length) { setCalls(d); saveLS(d); } else setCalls(loadLS()); })
      .catch(() => setCalls(loadLS()));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveAll = (next: CallEntry[]) => { setCalls(next); saveLS(next); };

  const markDone = (id: string) => {
    saveAll(calls.map(c => c.id === id ? { ...c, done: true } : c));
    setTimeout(() => saveAll(calls.filter(c => c.id !== id)), 800);
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/ai/calls-queue/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ called: true }),
    }).catch(() => {});
  };

  const deleteCall = (id: string) => {
    saveAll(calls.filter(c => c.id !== id));
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/ai/calls-queue/${id}/`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
  };

  const saveNote = (id: string) => {
    const note = (draftNote[id] || '').trim();
    saveAll(calls.map(c => c.id === id ? { ...c, notes: note || undefined } : c));
    setExpandedNotes(null);
  };

  const addCall = () => {
    if (!addForm.name.trim() || !addForm.reason.trim()) return;
    const entry: CallEntry = {
      id: `local-${Date.now()}`,
      name: addForm.name.trim(),
      role: addForm.role,
      reason: addForm.reason.trim(),
      phone: addForm.phone.trim(),
      urgency: addForm.urgency,
      isEmergency: addForm.urgency === 'emergency',
    };
    saveAll([...calls, entry]);
    setAddForm({ name: '', role: 'Parent', reason: '', phone: '', urgency: 'normal' });
    setShowAddForm(false);
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/ai/calls-queue/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(entry),
    }).catch(() => {});
  };

  const activeCalls = calls.filter(c => !c.done);

  return (
    <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, padding: 14, boxShadow: 'var(--sh-1)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Phone size={13} color="#3B82F6" strokeWidth={2} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>Calls Queue</span>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 600, background: '#DBEAFE', color: '#1D4ED8', padding: '2px 7px', borderRadius: 20 }}>{activeCalls.length}</span>
        <button
          onClick={() => setShowAddForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: showAddForm ? '#fff' : '#3B82F6', background: showAddForm ? '#3B82F6' : '#DBEAFE', border: 'none', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}
        >
          {showAddForm ? <X size={9} strokeWidth={2.5} /> : <Plus size={9} strokeWidth={2.5} />}
          {showAddForm ? 'Cancel' : 'Add'}
        </button>
      </div>

      {/* Add call form */}
      {showAddForm && (
        <div style={{ background: 'var(--bg-0)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>New call entry</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="Name *" style={{ fontSize: 11.5, padding: '5px 8px', border: '1px solid var(--bd)', borderRadius: 7, outline: 'none' }} />
              <select value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))} style={{ fontSize: 11.5, padding: '5px 8px', border: '1px solid var(--bd)', borderRadius: 7, outline: 'none' }}>
                {['Parent', 'Vendor', 'Staff', 'Student', 'Other'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <input value={addForm.reason} onChange={e => setAddForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason *" style={{ fontSize: 11.5, padding: '5px 8px', border: '1px solid var(--bd)', borderRadius: 7, outline: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone (optional)" style={{ fontSize: 11.5, padding: '5px 8px', border: '1px solid var(--bd)', borderRadius: 7, outline: 'none' }} />
              <select value={addForm.urgency} onChange={e => setAddForm(f => ({ ...f, urgency: e.target.value as CallEntry['urgency'] }))} style={{ fontSize: 11.5, padding: '5px 8px', border: '1px solid var(--bd)', borderRadius: 7, outline: 'none' }}>
                {(['low', 'normal', 'high', 'emergency'] as const).map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
              </select>
            </div>
            <button onClick={addCall} style={{ alignSelf: 'flex-end', fontSize: 11.5, fontWeight: 600, padding: '5px 14px', border: 'none', borderRadius: 8, background: '#3B82F6', color: '#fff', cursor: 'pointer' }}>Add to queue</button>
          </div>
        </div>
      )}

      {activeCalls.length === 0 && (
        <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 12, color: 'var(--ink-3)' }}>No pending calls 🎉</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {calls.map(c => {
          const ug = URGENCY[c.urgency];
          const showNotes = expandedNotes === c.id;
          return (
            <div
              key={c.id}
              style={{ borderRadius: 10, padding: '9px 10px', background: c.done ? '#F0FDF4' : 'var(--bg-0)', borderLeft: c.isEmergency ? '3px solid #E0463A' : '3px solid transparent', border: c.isEmergency ? '1px solid #FEE2E2' : '1px solid var(--bd)', opacity: c.done ? 0.6 : 1, transition: 'opacity 0.4s' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ flex: 1 }}>
                  {c.isEmergency && !c.done && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                      <AlertTriangle size={10} color="#E0463A" strokeWidth={2.5} />
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: '#E0463A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emergency</span>
                    </div>
                  )}
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: c.done ? '#6B7280' : 'var(--ink-1)', textDecoration: c.done ? 'line-through' : 'none' }}>
                    {c.name} <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 11 }}>· {c.role}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>Re: {c.reason}</div>
                  {c.notes && <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3, background: '#FEF3C7', borderRadius: 4, padding: '2px 6px' }}>📝 {c.notes}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 600, background: ug.bg, color: ug.text, padding: '2px 7px', borderRadius: 20 }}>{c.urgency}</span>
                  <button onClick={() => deleteCall(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E0463A', display: 'flex', padding: 2 }} title="Remove">
                    <Trash2 size={10} strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              {!c.done && (
                <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                  {c.phone && (
                    <a href={`tel:${c.phone}`} style={{ textDecoration: 'none' }}>
                      <ActionBtn icon={<Phone size={10} strokeWidth={2.5} />} label="Call" color="#3B82F6" bg="#DBEAFE" />
                    </a>
                  )}
                  {c.phone && (
                    <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                      <ActionBtn icon={<MessageCircle size={10} strokeWidth={2.5} />} label="WhatsApp" color="#22C55E" bg="#D1FAE5" />
                    </a>
                  )}
                  <ActionBtn
                    icon={<FileText size={10} strokeWidth={2.5} />}
                    label="Notes"
                    color={showNotes ? '#6D4AFF' : '#6B7280'}
                    bg={showNotes ? '#EEEAFF' : '#F3F4F6'}
                    onClick={() => { setExpandedNotes(showNotes ? null : c.id); setDraftNote(d => ({ ...d, [c.id]: c.notes || '' })); }}
                  />
                  <ActionBtn
                    icon={<CheckCheck size={10} strokeWidth={2.5} />}
                    label="Mark done"
                    color="#059669"
                    bg="#D1FAE5"
                    onClick={() => markDone(c.id)}
                  />
                </div>
              )}

              {/* Notes textarea */}
              {showNotes && !c.done && (
                <div style={{ marginTop: 7 }}>
                  <textarea
                    autoFocus
                    value={draftNote[c.id] || ''}
                    onChange={e => setDraftNote(d => ({ ...d, [c.id]: e.target.value }))}
                    placeholder="Add call notes…"
                    rows={3}
                    style={{ width: '100%', fontSize: 11.5, padding: '6px 8px', border: '1px solid var(--bd)', borderRadius: 7, outline: 'none', resize: 'vertical', color: 'var(--ink-1)', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button onClick={() => setExpandedNotes(null)} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid var(--bd)', borderRadius: 7, background: 'none', cursor: 'pointer', color: 'var(--ink-2)' }}>Cancel</button>
                    <button onClick={() => saveNote(c.id)} style={{ fontSize: 11, fontWeight: 600, padding: '3px 12px', border: 'none', borderRadius: 7, background: 'var(--pu)', color: '#fff', cursor: 'pointer' }}>Save</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, color, bg, onClick }: { icon: React.ReactNode; label: string; color: string; bg: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color, background: bg, border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
    >{icon}{label}</button>
  );
}

