'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { StickyNote, ChevronDown, ChevronUp } from 'lucide-react';
import { StickyNoteCard, NoteData } from './StickyNoteCard';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

const LS_KEY = (route: string) => `eskoolia_notes_${route.replace(/\//g, '_')}`;

function loadLocalNotes(route: string): NoteData[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY(route)) || '[]'); } catch { return []; }
}
function saveLocalNotes(route: string, notes: NoteData[]) {
  try { localStorage.setItem(LS_KEY(route), JSON.stringify(notes)); } catch {}
}

export function PageNotesPanel() {
  const pathname = usePathname();
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [expanded, setExpanded] = useState(false);

  const fetchNotes = useCallback(() => {
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/notes/?route=${encodeURIComponent(pathname)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (Array.isArray(d) && d.length > 0) {
          setNotes(d);
          saveLocalNotes(pathname, d);
        } else {
          // Fall back to localStorage
          const local = loadLocalNotes(pathname);
          setNotes(local);
        }
      })
      .catch(() => {
        const local = loadLocalNotes(pathname);
        setNotes(local);
      });
  }, [pathname]);

  useEffect(() => {
    setNotes([]);
    fetchNotes();
  }, [pathname, fetchNotes]);

  // Handle locally-created notes (optimistic, no API round-trip)
  useEffect(() => {
    const onCreated = (e: Event) => {
      const note = (e as CustomEvent<NoteData>).detail;
      if (!note) { fetchNotes(); return; }
      if (note.route !== pathname) return;
      setNotes(prev => {
        const next = [...prev, note];
        saveLocalNotes(pathname, next);
        return next;
      });
      setExpanded(true);
    };
    const onSynced = (e: Event) => {
      const d = (e as CustomEvent<NoteData & { localId: string }>).detail;
      if (!d) return;
      setNotes(prev => {
        const next = prev.map(n => n.id === d.localId ? { ...n, ...d, id: d.id } : n);
        saveLocalNotes(pathname, next);
        return next;
      });
    };
    window.addEventListener('eskoolia:note-created', onCreated);
    window.addEventListener('eskoolia:note-synced', onSynced);
    return () => {
      window.removeEventListener('eskoolia:note-created', onCreated);
      window.removeEventListener('eskoolia:note-synced', onSynced);
    };
  }, [pathname, fetchNotes]);

  const updateNote = useCallback((id: string, patch: Partial<NoteData>) => {
    setNotes(prev => {
      const next = prev.map(n => n.id === id ? { ...n, ...patch } : n);
      saveLocalNotes(pathname, next);
      return next;
    });
  }, [pathname]);

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => {
      const next = prev.filter(n => n.id !== id);
      saveLocalNotes(pathname, next);
      return next;
    });
  }, [pathname]);

  if (notes.length === 0) return null;

  return (
    <>
      {/* Toggle pill */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          position: 'fixed', right: 88, bottom: 22, zIndex: 450,
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#fff', border: '1px solid var(--bd)',
          borderRadius: 24, padding: '6px 14px',
          boxShadow: 'var(--sh-2)', cursor: 'pointer',
          transition: 'all 0.15s',
          fontSize: 12, fontWeight: 600, color: 'var(--ink-1)',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(109,74,255,0.4)'; e.currentTarget.style.boxShadow = 'var(--sh-3)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.boxShadow = 'var(--sh-2)'; }}
      >
        <StickyNote size={13} color="#F59E0B" strokeWidth={2} />
        <span>{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
        {expanded ? <ChevronDown size={12} color="var(--ink-3)" /> : <ChevronUp size={12} color="var(--ink-3)" />}
      </button>

      {/* Notes layer */}
      {expanded && notes.map((note, i) => (
        <StickyNoteCard
          key={note.id}
          note={note}
          index={i}
          onDelete={deleteNote}
          onUpdate={updateNote}
        />
      ))}
    </>
  );
}


