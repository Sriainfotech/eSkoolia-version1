'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, Search, StickyNote, Pin, Archive, ArrowRight } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Note {
  id: number;
  route: string;
  color: 'yellow' | 'pink' | 'green' | 'blue' | 'purple';
  text: string;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

const COLOR_BG: Record<string, string> = {
  yellow: '#FEF3C7', pink: '#FCE7F3', green: '#D1FAE5', blue: '#DBEAFE', purple: '#EDE9FE',
};
const COLOR_BORDER: Record<string, string> = {
  yellow: '#FDE68A', pink: '#F9A8D4', green: '#6EE7B7', blue: '#93C5FD', purple: '#C4B5FD',
};

function routeLabel(r: string) {
  if (!r || r === '/') return 'Home';
  return r.split('/').filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' › ');
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const MOCK_NOTES: Note[] = [
  { id: 1, route: '/students/list', color: 'blue', text: 'Follow up with Class 5A attendance next week', pinned: true, archived: false, created_at: new Date(Date.now() - 3e6).toISOString(), updated_at: new Date(Date.now() - 3e6).toISOString() },
  { id: 2, route: '/fees/payments', color: 'pink', text: 'Check overdue fees for Class 8 — 5 parents to call', pinned: true, archived: false, created_at: new Date(Date.now() - 7e6).toISOString(), updated_at: new Date(Date.now() - 7e6).toISOString() },
  { id: 3, route: '/attendance/student', color: 'yellow', text: 'Annual Day prep meeting scheduled for Friday 4pm', pinned: false, archived: false, created_at: new Date(Date.now() - 1.5e7).toISOString(), updated_at: new Date(Date.now() - 1.5e7).toISOString() },
  { id: 4, route: '/transport/bus-tracking', color: 'green', text: 'Route 7 maintenance done ✓', pinned: false, archived: false, created_at: new Date(Date.now() - 4e7).toISOString(), updated_at: new Date(Date.now() - 4e7).toISOString() },
  { id: 5, route: '/hr/staff', color: 'purple', text: 'AI: 3 staff leave requests pending approval', pinned: false, archived: false, created_at: new Date(Date.now() - 2e7).toISOString(), updated_at: new Date(Date.now() - 2e7).toISOString() },
];

export function AllNotes({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    const token = getAccessToken();
    try {
      const params = new URLSearchParams();
      if (showArchived) params.set('archived', 'true');
      const r = await fetch(`${API_BASE_URL}/api/notes/?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (r.ok) setNotes(await r.json());
      else setNotes(MOCK_NOTES);
    } catch { setNotes(MOCK_NOTES); }
    setLoading(false);
  }, [showArchived]);

  useEffect(() => { if (open) fetchNotes(); }, [open, fetchNotes]);

  // Keyboard close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  if (!open) return null;

  const filtered = notes.filter(n => {
    if (!showArchived && n.archived) return false;
    if (filterColor && n.color !== filterColor) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return n.text.toLowerCase().includes(q) || n.route.toLowerCase().includes(q);
    }
    return true;
  });

  function goToNote(note: Note) {
    onClose();
    router.push(note.route || '/');
  }

  async function togglePin(id: number) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
    const token = getAccessToken();
    try {
      await fetch(`${API_BASE_URL}/api/notes/${id}/`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ pinned: !note.pinned }),
      });
    } catch { /* silently fail */ }
  }

  async function archiveNote(id: number) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, archived: true } : n));
    const token = getAccessToken();
    try {
      await fetch(`${API_BASE_URL}/api/notes/${id}/`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ archived: true }),
      });
    } catch { /* silently fail */ }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,18,34,0.55)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 900, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px -16px rgba(14,16,32,0.28)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <StickyNote size={18} color="var(--pu)" strokeWidth={2} />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-1)', flex: 1 }}>All Notes</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>⌘⇧N</span>
          <button onClick={onClose} style={{ background: 'var(--bg-2)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} color="var(--ink-2)" />
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: '10px 22px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0, background: 'var(--bg-1)' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={13} color="var(--ink-3)" strokeWidth={2} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search notes…"
              autoFocus
              style={{ width: '100%', height: 32, paddingLeft: 28, paddingRight: 10, border: '1px solid var(--bd)', borderRadius: 8, fontSize: 12.5, color: 'var(--ink-1)', background: 'var(--bg-0)', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          {/* Color filters */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>Color</span>
            {(['yellow', 'pink', 'green', 'blue', 'purple'] as const).map(c => (
              <button
                key={c}
                onClick={() => setFilterColor(filterColor === c ? null : c)}
                style={{ width: 20, height: 20, borderRadius: '50%', background: COLOR_BG[c], border: filterColor === c ? `2px solid ${COLOR_BORDER[c]}` : '2px solid transparent', cursor: 'pointer', outline: filterColor === c ? `2px solid ${COLOR_BORDER[c]}` : 'none', outlineOffset: 1 }}
              />
            ))}
          </div>
          {/* Archived toggle */}
          <button
            onClick={() => setShowArchived(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: showArchived ? 'var(--pu)' : 'var(--ink-2)', background: showArchived ? 'var(--pu-soft)' : 'var(--bg-2)', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer' }}
          >
            <Archive size={11} strokeWidth={2} />Archived
          </button>
        </div>

        {/* Masonry notes grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontSize: 12.5 }}>Loading notes…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <StickyNote size={32} color="var(--ink-3)" strokeWidth={1.2} style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 }}>{searchQ || filterColor ? 'No notes match your filters' : 'No notes yet'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>Press ⌘N on any page to add a note</div>
            </div>
          ) : (
            <div style={{ columns: 3, gap: 12 }}>
              {filtered.map(n => (
                <div
                  key={n.id}
                  style={{
                    breakInside: 'avoid', marginBottom: 12,
                    background: COLOR_BG[n.color] || '#FEF3C7',
                    border: `1px solid ${COLOR_BORDER[n.color] || '#FDE68A'}`,
                    borderRadius: 14, padding: '12px 14px',
                    boxShadow: '0 2px 8px -2px rgba(15,18,34,0.08)',
                    position: 'relative',
                  }}
                >
                  {/* Page context pill */}
                  <button
                    onClick={() => goToNote(n)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 20, padding: '2px 8px', cursor: 'pointer', maxWidth: '100%' }}
                  >
                    <ArrowRight size={9} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {routeLabel(n.route)}
                    </span>
                  </button>

                  {/* Note text */}
                  <p style={{ margin: 0, fontSize: 13, color: 'rgba(0,0,0,0.8)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {n.text || <em style={{ opacity: 0.5 }}>Empty note</em>}
                  </p>

                  {/* Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.4)' }}>{timeAgo(n.updated_at)}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => togglePin(n.id)}
                        title={n.pinned ? 'Unpin' : 'Pin'}
                        style={{ background: n.pinned ? 'rgba(109,74,255,0.12)' : 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 6, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <Pin size={10} strokeWidth={2.5} color={n.pinned ? 'var(--pu)' : 'rgba(0,0,0,0.4)'} />
                      </button>
                      <button
                        onClick={() => archiveNote(n.id)}
                        title="Archive"
                        style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 6, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <Archive size={10} strokeWidth={2.5} color="rgba(0,0,0,0.4)" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
