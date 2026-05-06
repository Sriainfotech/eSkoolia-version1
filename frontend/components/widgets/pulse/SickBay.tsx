'use client';
import { useEffect, useState, useCallback } from 'react';
import { Thermometer, CheckCircle2, Phone, Plus, Trash2, Pencil, X, Check, ChevronRight } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface SickEntry {
  id: string;
  studentName: string;
  class: string;
  section: string;
  complaint: string;
  loggedAt: string;
  status: 'in_care' | 'contacted' | 'en_route' | 'sent_home' | 'recovered';
  parentContact: string;
}

type Status = SickEntry['status'];

const STATUS_ORDER: Status[] = ['in_care', 'contacted', 'en_route', 'sent_home', 'recovered'];

const STATUS_CONFIG: Record<Status, { label: string; bg: string; text: string; dot: string; next: string }> = {
  in_care:   { label: 'In care',          bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B', next: 'Contact parent' },
  contacted: { label: 'Contacted',        bg: '#FFEDD5', text: '#9A3412', dot: '#F97316', next: 'En route'       },
  en_route:  { label: 'En route',         bg: '#DBEAFE', text: '#1E40AF', dot: '#3B82F6', next: 'Sent home'      },
  sent_home: { label: 'Sent home',        bg: '#D1FAE5', text: '#065F46', dot: '#22C55E', next: 'Recovered'      },
  recovered: { label: 'Recovered',        bg: '#E5E7EB', text: '#374151', dot: '#9CA3AF', next: ''               },
};

const MOCK_ENTRIES: SickEntry[] = [
  { id: '1', studentName: 'Aarav Sharma', class: '5', section: 'A', complaint: 'Headache', loggedAt: '10:42 AM', status: 'contacted', parentContact: '+91-9876543210' },
  { id: '2', studentName: 'Priya Patel',  class: '7', section: 'B', complaint: 'Stomach ache', loggedAt: '11:15 AM', status: 'in_care', parentContact: '+91-9876543211' },
];

const LS_KEY = 'eskoolia_sickbay';
function loadLS(): SickEntry[] {
  try { const d = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); return Array.isArray(d) && d.length ? d : MOCK_ENTRIES; } catch { return MOCK_ENTRIES; }
}
function saveLS(d: SickEntry[]) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {} }

function formatTime(iso: string) {
  try {
    if (iso.includes(':') && !iso.includes('T')) return iso;
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return iso; }
}

export function SickBay() {
  const [entries, setEntries] = useState<SickEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ studentName: '', class: '', section: '', complaint: '', parentContact: '' });
  const [editForm, setEditForm] = useState<Partial<SickEntry>>({});

  const fetchData = useCallback(() => {
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/sickbay/active/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const data = Array.isArray(d) && d.length ? d : loadLS();
        setEntries(data); saveLS(data); setLoading(false);
      })
      .catch(() => { setEntries(loadLS()); setLoading(false); });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveAll = (next: SickEntry[]) => { setEntries(next); saveLS(next); };

  const advanceStatus = (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const idx = STATUS_ORDER.indexOf(entry.status);
    const nextStatus = STATUS_ORDER[idx + 1];
    if (!nextStatus) return;
    const next = nextStatus === 'recovered'
      ? entries.filter(e => e.id !== id)
      : entries.map(e => e.id === id ? { ...e, status: nextStatus } : e);
    saveAll(next);
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/sickbay/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ status: nextStatus }),
    }).catch(() => {});
  };

  const deleteEntry = (id: string) => {
    saveAll(entries.filter(e => e.id !== id));
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/sickbay/${id}/`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
  };

  const addEntry = () => {
    if (!addForm.studentName.trim() || !addForm.complaint.trim()) return;
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const entry: SickEntry = {
      id: `local-${Date.now()}`,
      studentName: addForm.studentName.trim(),
      class: addForm.class.trim() || '-',
      section: addForm.section.trim() || '-',
      complaint: addForm.complaint.trim(),
      loggedAt: now,
      status: 'in_care',
      parentContact: addForm.parentContact.trim(),
    };
    saveAll([...entries, entry]);
    setAddForm({ studentName: '', class: '', section: '', complaint: '', parentContact: '' });
    setShowAddForm(false);
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/sickbay/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(entry),
    }).catch(() => {});
  };

  const startEdit = (e: SickEntry) => {
    setEditingId(e.id);
    setEditForm({ studentName: e.studentName, class: e.class, section: e.section, complaint: e.complaint, parentContact: e.parentContact, status: e.status });
  };

  const saveEdit = (id: string) => {
    saveAll(entries.map(e => e.id === id ? { ...e, ...editForm } : e));
    setEditingId(null);
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/sickbay/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(editForm),
    }).catch(() => {});
  };

  const visible = showAll ? entries : entries.slice(0, 3);

  return (
    <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, padding: 14, boxShadow: 'var(--sh-1)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Thermometer size={11} color="#E0463A" strokeWidth={2} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sick Bay</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {entries.length > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, background: '#FEE2E2', color: '#E0463A', padding: '2px 6px', borderRadius: 20 }}>
              {entries.length}
            </span>
          )}
          <button
            onClick={() => setShowAddForm(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: showAddForm ? '#fff' : '#E0463A', background: showAddForm ? '#E0463A' : '#FEE2E2', border: 'none', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}
          >
            {showAddForm ? <X size={9} strokeWidth={2.5} /> : <Plus size={9} strokeWidth={2.5} />}
            {showAddForm ? 'Cancel' : 'Add'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div style={{ background: 'var(--bg-0)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>New sick bay entry</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 6 }}>
              <input value={addForm.studentName} onChange={e => setAddForm(f => ({ ...f, studentName: e.target.value }))} placeholder="Student name *" style={{ fontSize: 11.5, padding: '5px 8px', border: '1px solid var(--bd)', borderRadius: 7, outline: 'none' }} />
              <input value={addForm.class} onChange={e => setAddForm(f => ({ ...f, class: e.target.value }))} placeholder="Class" style={{ fontSize: 11.5, padding: '5px 8px', border: '1px solid var(--bd)', borderRadius: 7, outline: 'none' }} />
              <input value={addForm.section} onChange={e => setAddForm(f => ({ ...f, section: e.target.value }))} placeholder="Sec" style={{ fontSize: 11.5, padding: '5px 8px', border: '1px solid var(--bd)', borderRadius: 7, outline: 'none' }} />
            </div>
            <input value={addForm.complaint} onChange={e => setAddForm(f => ({ ...f, complaint: e.target.value }))} placeholder="Complaint / reason *" style={{ fontSize: 11.5, padding: '5px 8px', border: '1px solid var(--bd)', borderRadius: 7, outline: 'none' }} />
            <input value={addForm.parentContact} onChange={e => setAddForm(f => ({ ...f, parentContact: e.target.value }))} placeholder="Parent contact (optional)" style={{ fontSize: 11.5, padding: '5px 8px', border: '1px solid var(--bd)', borderRadius: 7, outline: 'none' }} />
            <button onClick={addEntry} style={{ alignSelf: 'flex-end', fontSize: 11.5, fontWeight: 600, padding: '5px 14px', border: 'none', borderRadius: 8, background: '#E0463A', color: '#fff', cursor: 'pointer' }}>Add entry</button>
          </div>
        </div>
      )}

      {loading && <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0' }}>Loading…</div>}

      {!loading && entries.length === 0 && (
        <div style={{ textAlign: 'center', padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <CheckCircle2 size={20} color="#22C55E" strokeWidth={1.5} />
          <span style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 500 }}>No students in care today</span>
        </div>
      )}

      {!loading && visible.map(entry => {
        const s = STATUS_CONFIG[entry.status];
        const isEditing = editingId === entry.id;
        return (
          <div key={entry.id} style={{ borderRadius: 10, marginBottom: 6 }}>
            {isEditing ? (
              <div style={{ background: 'var(--bg-0)', border: '1px solid var(--bd)', borderRadius: 10, padding: '9px 10px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 7 }}>Edit entry</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 5 }}>
                    <input value={editForm.studentName || ''} onChange={e => setEditForm(f => ({ ...f, studentName: e.target.value }))} placeholder="Name" style={{ fontSize: 11, padding: '4px 7px', border: '1px solid var(--bd)', borderRadius: 6, outline: 'none' }} />
                    <input value={editForm.class || ''} onChange={e => setEditForm(f => ({ ...f, class: e.target.value }))} placeholder="Class" style={{ fontSize: 11, padding: '4px 7px', border: '1px solid var(--bd)', borderRadius: 6, outline: 'none' }} />
                    <input value={editForm.section || ''} onChange={e => setEditForm(f => ({ ...f, section: e.target.value }))} placeholder="Sec" style={{ fontSize: 11, padding: '4px 7px', border: '1px solid var(--bd)', borderRadius: 6, outline: 'none' }} />
                  </div>
                  <input value={editForm.complaint || ''} onChange={e => setEditForm(f => ({ ...f, complaint: e.target.value }))} placeholder="Complaint" style={{ fontSize: 11, padding: '4px 7px', border: '1px solid var(--bd)', borderRadius: 6, outline: 'none' }} />
                  <input value={editForm.parentContact || ''} onChange={e => setEditForm(f => ({ ...f, parentContact: e.target.value }))} placeholder="Parent contact" style={{ fontSize: 11, padding: '4px 7px', border: '1px solid var(--bd)', borderRadius: 6, outline: 'none' }} />
                  <select value={editForm.status || 'in_care'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as Status }))} style={{ fontSize: 11, padding: '4px 7px', border: '1px solid var(--bd)', borderRadius: 6, outline: 'none' }}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingId(null)} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid var(--bd)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--ink-2)' }}>Cancel</button>
                    <button onClick={() => saveEdit(entry.id)} style={{ fontSize: 11, fontWeight: 600, padding: '3px 12px', border: 'none', borderRadius: 6, background: '#E0463A', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Check size={10} strokeWidth={2.5} />Save
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Compact single-row entry */
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 8px', background: 'var(--bg-0)', border: '1px solid var(--bd)', borderRadius: 10 }}>
                {/* Status dot */}
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />

                {/* Name + complaint */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-1)' }}>{entry.studentName}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>{entry.class}{entry.section}</span>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.complaint} · {formatTime(entry.loggedAt)}
                  </div>
                </div>

                {/* Status badge — click to advance */}
                {s.next ? (
                  <button
                    onClick={() => advanceStatus(entry.id)}
                    title={`Advance to: ${s.next}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: s.bg, color: s.text, border: 'none', cursor: 'pointer', flexShrink: 0 }}
                  >
                    {s.label}
                    <ChevronRight size={8} strokeWidth={2.5} />
                  </button>
                ) : (
                  <span style={{ fontSize: 9.5, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: s.bg, color: s.text, flexShrink: 0 }}>
                    {s.label}
                  </span>
                )}

                {/* Actions */}
                {entry.parentContact && (
                  <a href={`tel:${entry.parentContact}`} onClick={e => e.stopPropagation()} title="Call parent" style={{ display: 'flex', padding: 3, color: '#3B82F6', textDecoration: 'none', borderRadius: 4, flexShrink: 0 }}>
                    <Phone size={11} strokeWidth={2} />
                  </a>
                )}
                <button onClick={() => startEdit(entry)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', display: 'flex', padding: 3, borderRadius: 4, flexShrink: 0 }}>
                  <Pencil size={10} strokeWidth={2} />
                </button>
                <button onClick={() => deleteEntry(entry.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E0463A', display: 'flex', padding: 3, borderRadius: 4, flexShrink: 0 }}>
                  <Trash2 size={10} strokeWidth={2} />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {entries.length > 3 && (
        <button onClick={() => setShowAll(v => !v)} style={{ fontSize: 11, color: 'var(--pu)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', width: '100%', textAlign: 'center' }}>
          {showAll ? '▲ Show less' : `+${entries.length - 3} more`}
        </button>
      )}
    </div>
  );
}
