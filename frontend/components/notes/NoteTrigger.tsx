'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { StickyNote } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';
import { AllNotes } from './AllNotes';

const NOTE_COLORS = [
  { key: 'yellow', bg: '#FEF3C7', border: '#F59E0B', label: 'Reminder' },
  { key: 'pink',   bg: '#FCE7F3', border: '#DB2777', label: 'Urgent' },
  { key: 'green',  bg: '#D1FAE5', border: '#059669', label: 'Done / FYI' },
  { key: 'blue',   bg: '#DBEAFE', border: '#3B82F6', label: 'Follow-up' },
  { key: 'purple', bg: '#EDE9FE', border: '#7C3AED', label: 'AI / System' },
] as const;

type NoteColor = (typeof NOTE_COLORS)[number]['key'];

interface Props {
  pageNoteCount?: number;
  onNoteCreated?: () => void;
}

export function NoteTrigger({ pageNoteCount = 0, onNoteCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [allNotesOpen, setAllNotesOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const createNote = useCallback(async (color: NoteColor) => {
    setOpen(false);
    // Optimistic local note — shown immediately without waiting for API
    const localNote = {
      id: `local-${Date.now()}`,
      route: pathname,
      color,
      text: '',
      position_x: 80 + Math.floor(Math.random() * 120),
      position_y: 120 + Math.floor(Math.random() * 80),
      pinned: false,
      created_at: new Date().toISOString(),
    };
    window.dispatchEvent(new CustomEvent('eskoolia:note-created', { detail: localNote }));
    onNoteCreated?.();

    // Persist to backend if available
    const token = getAccessToken();
    try {
      const res = await fetch(`${API_BASE_URL}/api/notes/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ route: localNote.route, color, text: '', position_x: localNote.position_x, position_y: localNote.position_y, pinned: false }),
      });
      if (res.ok) {
        const saved = await res.json();
        // Replace local ID with server ID
        window.dispatchEvent(new CustomEvent('eskoolia:note-synced', { detail: { localId: localNote.id, ...saved } }));
      }
    } catch { /* local note already visible, backend unavailable */ }
  }, [pathname, onNoteCreated]);

  // Keyboard shortcut ⌘N and ⌘⇧N
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        setOpen(v => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'n') {
        e.preventDefault();
        setAllNotesOpen(v => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        id="note-trigger"
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label="Add sticky note (⌘N)"
        style={{
          position: 'relative',
          width: 36, height: 36, borderRadius: 8, border: 'none',
          background: open ? 'var(--pu-soft)' : 'transparent',
          color: open ? 'var(--pu)' : 'var(--ink-2)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        <StickyNote size={15} strokeWidth={1.6} />
        {pageNoteCount > 0 && (
          <span style={{
            position: 'absolute', top: -1, right: -1,
            minWidth: 16, height: 16, padding: '0 4px', borderRadius: 20,
            background: 'var(--pu)', color: '#fff', fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>
            {pageNoteCount}
          </span>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && !open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--ink-1)',
          color: '#fff', fontSize: 10.5, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 200,
          pointerEvents: 'none',
        }}>
          Sticky notes <kbd style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 3, padding: '1px 4px', fontSize: 9 }}>⌘N</kbd>
        </div>
      )}

      {/* Color picker popover */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'var(--bg-1)', border: '1px solid var(--bd)',
          borderRadius: 14, padding: '12px 14px', boxShadow: 'var(--sh-3)',
          zIndex: 200, width: 210,
          animation: 'fadeIn 0.15s ease both',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            New note for this page
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
            {NOTE_COLORS.map(c => (
              <button
                key={c.key}
                onClick={() => createNote(c.key)}
                title={c.label}
                style={{
                  width: 26, height: 26, borderRadius: '50%', border: `2px solid ${c.border}`,
                  background: c.bg, cursor: 'pointer', transition: 'transform 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              />
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={() => { setOpen(false); setAllNotesOpen(true); }}
              style={{ fontSize: 10.5, color: 'var(--pu)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Open all my notes →
            </button>
            <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>⌘⇧N</span>
          </div>
        </div>
      )}

      {/* All Notes modal */}
      <AllNotes open={allNotesOpen} onClose={() => setAllNotesOpen(false)} />
    </div>
  );
}
