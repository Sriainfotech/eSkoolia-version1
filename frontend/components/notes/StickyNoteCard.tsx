'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Pin, MoreHorizontal, GripHorizontal } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

const NOTE_COLORS = {
  yellow: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  pink:   { bg: '#FCE7F3', border: '#DB2777', text: '#831843' },
  green:  { bg: '#D1FAE5', border: '#059669', text: '#065F46' },
  blue:   { bg: '#DBEAFE', border: '#3B82F6', text: '#1E3A5F' },
  purple: { bg: '#EDE9FE', border: '#7C3AED', text: '#3B0764' },
};

export interface NoteData {
  id: string;
  route: string;
  color: keyof typeof NOTE_COLORS;
  text: string;
  position_x: number;
  position_y: number;
  pinned: boolean;
  updated_at?: string;
  author_initials?: string;
}

interface Props {
  note: NoteData;
  index: number;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<NoteData>) => void;
}

const COLOR_SWATCHES = Object.entries(NOTE_COLORS).map(([key]) => key as keyof typeof NOTE_COLORS);

export function StickyNoteCard({ note, index, onDelete, onUpdate }: Props) {
  const [text, setText] = useState(note.text);
  const [pos, setPos] = useState({ x: note.position_x, y: note.position_y });
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const nc = NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow;
  const rotation = (index % 2 === 0 ? -1 : 1) * ((index % 3) * 0.8);

  // Set initial text content once on mount — never let React manage contentEditable children
  useEffect(() => {
    if (bodyRef.current && bodyRef.current.textContent !== note.text) {
      bodyRef.current.textContent = note.text;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — only run once on mount

  const save = useCallback((patch: Partial<NoteData>) => {
    onUpdate(note.id, patch);
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/notes/${note.id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }, [note.id, onUpdate]);


  // Drag logic
  const startDrag = (e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    setDragging(true);
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };

    const move = (me: MouseEvent) => {
      const nx = me.clientX - dragOffset.current.x;
      const ny = me.clientY - dragOffset.current.y;
      setPos({ x: nx, y: ny });
    };
    const up = () => {
      setDragging(false);
      setPos(p => {
        save({ position_x: p.x, position_y: p.y });
        return p;
      });
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const changeColor = (color: keyof typeof NOTE_COLORS) => {
    save({ color });
    setMenuOpen(false);
  };

  const togglePin = () => save({ pinned: !note.pinned });

  const deleteNote = () => {
    onDelete(note.id);
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/notes/${note.id}/`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
  };

  return (
    <div
      ref={cardRef}
      style={{
        position: 'fixed',
        left: pos.x, top: pos.y,
        width: 240, minHeight: 160,
        background: nc.bg,
        border: `1px solid ${nc.border}40`,
        borderRadius: 14,
        boxShadow: '0 8px 24px rgba(15,18,34,0.12)',
        transform: `rotate(${rotation}deg)`,
        zIndex: dragging ? 410 : 400,
        transition: dragging ? 'none' : 'box-shadow 0.15s, transform 0.15s',
        userSelect: dragging ? 'none' : 'auto',
        cursor: dragging ? 'grabbing' : 'default',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => { if (!dragging) (e.currentTarget.style.transform = `rotate(0deg) scale(1.02)`); }}
      onMouseLeave={e => { if (!dragging) (e.currentTarget.style.transform = `rotate(${rotation}deg)`); }}
    >
      {/* Top bar */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px 4px', cursor: 'grab' }}
        onMouseDown={startDrag}
      >
        <GripHorizontal size={12} color={nc.border} strokeWidth={2} style={{ flexShrink: 0 }} />

        {/* Color swatches */}
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {COLOR_SWATCHES.map(c => (
            <button
              key={c}
              onClick={() => changeColor(c)}
              style={{
                width: 12, height: 12, borderRadius: '50%',
                background: NOTE_COLORS[c].bg,
                border: `1.5px solid ${NOTE_COLORS[c].border}`,
                cursor: 'pointer', padding: 0,
                transform: note.color === c ? 'scale(1.3)' : 'scale(1)',
                transition: 'transform 0.15s',
              }}
            />
          ))}
        </div>

        <button onClick={togglePin} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: note.pinned ? 1 : 0.4 }}>
          <Pin size={12} color={nc.border} strokeWidth={2} fill={note.pinned ? nc.border : 'none'} />
        </button>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
            <MoreHorizontal size={13} color={nc.text} strokeWidth={2} />
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: '100%',
              background: '#fff', border: '1px solid var(--bd)',
              borderRadius: 9, boxShadow: 'var(--sh-3)', padding: 4, zIndex: 420, width: 130,
            }}
              onClick={e => e.stopPropagation()}
            >
              {['Archive', 'Delete'].map(action => (
                <button
                  key={action}
                  onClick={() => { if (action === 'Delete') deleteNote(); setMenuOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '6px 10px',
                    border: 'none', background: 'none', cursor: 'pointer', fontSize: 12,
                    color: action === 'Delete' ? 'var(--err)' : 'var(--ink-1)',
                    borderRadius: 6,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >{action}</button>
              ))}
            </div>
          )}
        </div>

        <button onClick={deleteNote} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <X size={12} color={nc.text} strokeWidth={2} />
        </button>
      </div>

      {/* Text body */}
      <div
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        onInput={e => {
          const newText = (e.currentTarget as HTMLDivElement).textContent ?? '';
          setText(newText);
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => save({ text: newText }), 600);
        }}
        style={{
          flex: 1, padding: '4px 12px 8px',
          fontSize: 12.5, lineHeight: 1.5, color: nc.text,
          outline: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          minHeight: 80,
        }}
        onFocus={e => { (e.currentTarget.parentElement as HTMLDivElement).style.boxShadow = `0 12px 32px rgba(15,18,34,0.2), 0 0 0 2px ${nc.border}40`; }}
        onBlur={e => { (e.currentTarget.parentElement as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(15,18,34,0.12)'; }}
      />

      {/* Resize handle (visual only) */}
      <div style={{
        position: 'absolute', right: 4, bottom: 4, width: 10, height: 10,
        borderRight: `2px solid ${nc.border}80`, borderBottom: `2px solid ${nc.border}80`,
        cursor: 'se-resize', borderRadius: 1,
      }} />

      {/* Footer */}
      <div style={{ padding: '0 10px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9.5, fontFamily: 'monospace', color: `${nc.text}80` }}>
          {note.updated_at ? new Date(note.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Unsaved'}
        </span>
        {note.author_initials && (
          <span style={{
            width: 18, height: 18, borderRadius: '50%', background: `${nc.border}30`,
            color: nc.border, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{note.author_initials}</span>
        )}
      </div>
    </div>
  );
}
