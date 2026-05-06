'use client';
import { useEffect, useState, useCallback } from 'react';
import { UserMinus, CheckCircle2, AlertCircle, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface LeaveEntry {
  staffId: string;
  name: string;
  role: string;
  classCovered: string;
  substituteAssigned: boolean;
  substituteName?: string;
}

const MOCK: LeaveEntry[] = [
  { staffId: '1', name: 'Mrs. Kavitha R.', role: 'Math Teacher', classCovered: 'Class 9A', substituteAssigned: true, substituteName: 'Mr. Ramesh' },
  { staffId: '2', name: 'Mr. Anand K.', role: 'Science Teacher', classCovered: 'Class 7B', substituteAssigned: false },
];

const LS_KEY = 'eskoolia_staff_leave';

function loadLS(): LeaveEntry[] {
  try { const d = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); return Array.isArray(d) && d.length ? d : MOCK; } catch { return MOCK; }
}
function saveLS(d: LeaveEntry[]) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {} }

const PASTEL_COLORS = ['#EEEAFF', '#FEE2E2', '#D1FAE5', '#FEF3C7', '#DBEAFE', '#FCE7F3'];
const PASTEL_INKS   = ['#6D4AFF', '#E0463A', '#059669', '#D97706', '#3B82F6', '#DB2777'];

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export function StaffLeave() {
  const [entries, setEntries] = useState<LeaveEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSub, setEditSub] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', role: '', classCovered: '', substituteName: '' });

  const fetchData = useCallback(() => {
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/hr/today-leave/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (Array.isArray(d) && d.length) { setEntries(d); saveLS(d); }
        else setEntries(loadLS());
      })
      .catch(() => setEntries(loadLS()));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveAll = (next: LeaveEntry[]) => { setEntries(next); saveLS(next); };

  const updateSub = (staffId: string, subName: string) => {
    const next = entries.map(e => e.staffId === staffId ? { ...e, substituteAssigned: !!subName.trim(), substituteName: subName.trim() || undefined } : e);
    saveAll(next);
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/hr/today-leave/${staffId}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ substituteAssigned: !!subName.trim(), substituteName: subName.trim() }),
    }).catch(() => {});
  };

  const deleteEntry = (staffId: string) => {
    saveAll(entries.filter(e => e.staffId !== staffId));
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/hr/today-leave/${staffId}/`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
  };

  const addEntry = () => {
    if (!addForm.name.trim() || !addForm.role.trim()) return;
    const newEntry: LeaveEntry = {
      staffId: `local-${Date.now()}`,
      name: addForm.name.trim(),
      role: addForm.role.trim(),
      classCovered: addForm.classCovered.trim() || 'N/A',
      substituteAssigned: !!addForm.substituteName.trim(),
      substituteName: addForm.substituteName.trim() || undefined,
    };
    saveAll([...entries, newEntry]);
    setAddForm({ name: '', role: '', classCovered: '', substituteName: '' });
    setShowAddForm(false);
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/hr/today-leave/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(newEntry),
    }).catch(() => {});
  };

  return (
    <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, padding: 14, boxShadow: 'var(--sh-1)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: '#FCE7F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserMinus size={11} color="#DB2777" strokeWidth={2} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Staff Leave Today</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, background: '#FCE7F3', color: '#DB2777', padding: '2px 6px', borderRadius: 20 }}>{entries.length}</span>
          <button
            onClick={() => setShowAddForm(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: showAddForm ? '#fff' : '#DB2777', background: showAddForm ? '#DB2777' : '#FCE7F3', border: 'none', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}
          >
            {showAddForm ? <X size={9} strokeWidth={2.5} /> : <Plus size={9} strokeWidth={2.5} />}
            {showAddForm ? 'Cancel' : 'Add'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div style={{ background: 'var(--bg-0)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>Add staff on leave</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { key: 'name', placeholder: 'Staff name *', label: 'name' },
              { key: 'role', placeholder: 'Role / subject *', label: 'role' },
              { key: 'classCovered', placeholder: 'Class covered', label: 'classCovered' },
              { key: 'substituteName', placeholder: 'Substitute name (optional)', label: 'substituteName' },
            ].map(f => (
              <input
                key={f.key}
                value={addForm[f.key as keyof typeof addForm]}
                onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{ fontSize: 11.5, padding: '5px 8px', border: '1px solid var(--bd)', borderRadius: 7, outline: 'none', color: 'var(--ink-1)' }}
              />
            ))}
            <button
              onClick={addEntry}
              style={{ alignSelf: 'flex-end', fontSize: 11.5, fontWeight: 600, padding: '5px 14px', border: 'none', borderRadius: 8, background: 'var(--pu)', color: '#fff', cursor: 'pointer' }}
            >Add entry</button>
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 12, color: 'var(--ink-3)' }}>
          No staff on leave today 🎉
        </div>
      )}

      {entries.map((e, i) => {
        const bg = PASTEL_COLORS[i % PASTEL_COLORS.length];
        const ink = PASTEL_INKS[i % PASTEL_INKS.length];
        const isEditing = editingId === e.staffId;
        return (
          <div key={e.staffId} style={{ padding: '8px 0', borderBottom: i < entries.length - 1 ? '1px solid var(--bg-2)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              {/* Avatar */}
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: ink }}>{getInitials(e.name)}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{e.role} · {e.classCovered}</div>
              </div>
              {/* Substitute status */}
              {!isEditing && (e.substituteAssigned ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <CheckCircle2 size={12} color="#22C55E" strokeWidth={2} />
                  <span style={{ fontSize: 10, color: '#059669', maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.substituteName}</span>
                </div>
              ) : (
                <span style={{ fontSize: 10, color: '#D97706', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 5, padding: '2px 6px' }}>
                  <AlertCircle size={8} strokeWidth={2.5} style={{ display: 'inline', marginRight: 2, verticalAlign: 'middle' }} />No sub
                </span>
              ))}
              {/* Edit / Delete */}
              <button
                onClick={() => { setEditingId(isEditing ? null : e.staffId); setEditSub(e.substituteName || ''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', display: 'flex', padding: 3, borderRadius: 5 }}
                title="Edit substitute"
              >
                {isEditing ? <X size={11} strokeWidth={2} /> : <Pencil size={11} strokeWidth={2} />}
              </button>
              <button
                onClick={() => deleteEntry(e.staffId)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E0463A', display: 'flex', padding: 3, borderRadius: 5 }}
                title="Remove entry"
              >
                <Trash2 size={11} strokeWidth={2} />
              </button>
            </div>

            {/* Inline edit form */}
            {isEditing && (
              <div style={{ display: 'flex', gap: 6, marginTop: 7, paddingLeft: 39 }}>
                <input
                  autoFocus
                  value={editSub}
                  onChange={e => setEditSub(e.target.value)}
                  placeholder="Substitute name (empty to unassign)…"
                  style={{ flex: 1, fontSize: 11, padding: '4px 8px', border: '1px solid var(--bd)', borderRadius: 7, outline: 'none', color: 'var(--ink-1)' }}
                  onKeyDown={ev => { if (ev.key === 'Enter') { updateSub(e.staffId, editSub); setEditingId(null); } if (ev.key === 'Escape') setEditingId(null); }}
                />
                <button
                  onClick={() => { updateSub(e.staffId, editSub); setEditingId(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 600, color: '#fff', background: '#22C55E', border: 'none', borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}
                >
                  <Check size={10} strokeWidth={2.5} />Save
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

