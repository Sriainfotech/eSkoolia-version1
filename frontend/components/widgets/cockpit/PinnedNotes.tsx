'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StickyNote, Pin, ChevronRight } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface NoteItem {
  id: string;
  route: string;
  color: 'yellow' | 'pink' | 'green' | 'blue' | 'purple';
  text: string;
  updatedAt: string;
  pinned: boolean;
}

const NOTE_COLORS = {
  yellow: { bg: '#FEF3C7', border: '#F59E0B' },
  pink:   { bg: '#FCE7F3', border: '#DB2777' },
  green:  { bg: '#D1FAE5', border: '#059669' },
  blue:   { bg: '#DBEAFE', border: '#3B82F6' },
  purple: { bg: '#EDE9FE', border: '#7C3AED' },
};

const MOCK: NoteItem[] = [
  { id: '1', route: '/fees/payments', color: 'blue', text: 'Follow up with accounts on the Dec batch remittance before Friday', updatedAt: new Date(Date.now() - 3600000).toISOString(), pinned: true },
  { id: '2', route: '/students/list', color: 'pink', text: 'Aarav Sharma parent meeting scheduled — bring syllabus report', updatedAt: new Date(Date.now() - 7200000).toISOString(), pinned: true },
];

function routeLabel(route: string) {
  return route.replace(/^\//, '').replace(/\//g, ' › ') || 'Home';
}

export function PinnedNotes() {
  const [notes, setNotes] = useState<NoteItem[]>(MOCK);

  useEffect(() => {
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/notes/?pinned=true&limit=3`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d)) setNotes(d); })
      .catch(() => {});
  }, []);

  if (notes.length === 0) return null;

  return (
    <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, padding: 14, boxShadow: 'var(--sh-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Pin size={13} color="#F59E0B" strokeWidth={2} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>Pinned Notes</span>
        <Link href="#all-notes" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, color: 'var(--pu)', textDecoration: 'none' }}>
          All <ChevronRight size={11} />
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {notes.map(n => {
          const nc = NOTE_COLORS[n.color];
          return (
            <Link key={n.id} href={n.route} style={{ textDecoration: 'none' }}>
              <div style={{
                background: nc.bg, border: `1px solid ${nc.border}30`,
                borderLeft: `3px solid ${nc.border}`,
                borderRadius: 8, padding: '8px 10px',
                transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <StickyNote size={9} color={nc.border} strokeWidth={2} />
                  <span style={{ fontSize: 9.5, color: nc.border, fontWeight: 600 }}>{routeLabel(n.route)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-1)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {n.text}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
