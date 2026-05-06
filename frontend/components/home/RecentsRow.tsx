'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { MODULES, FLAT_INDEX } from '@/lib/routes';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';
import { loadRecentsLS } from '@/lib/recentsStore';

interface RecentItem {
  path: string;
  visited_at: string;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins || 1}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export function RecentsRow() {
  const [recents, setRecents] = useState<RecentItem[]>([]);

  useEffect(() => {
    // Show localStorage recents immediately
    const local = loadRecentsLS().slice(0, 8);
    if (local.length) setRecents(local);

    // Try to merge with API data
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/user/recents/?limit=8`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: RecentItem[] | null) => {
        if (Array.isArray(data) && data.length) setRecents(data);
      })
      .catch(() => {}); // keep showing localStorage data on API failure
  }, []);

  // Filter to only paths that exist in FLAT_INDEX
  const validRecents = recents.filter(r => FLAT_INDEX.some(f => f.path === r.path)).slice(0, 8);

  if (validRecents.length === 0) return null;

  return (
    <>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 22, marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={11} strokeWidth={2} color="var(--ink-3)" />
          <span style={{
            fontSize: 10.5, fontWeight: 600, color: 'var(--ink-2)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>Recently Visited</span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))',
        gap: 10, marginBottom: 4,
      }}>
        {validRecents.map(r => {
          const entry = FLAT_INDEX.find(f => f.path === r.path);
          if (!entry) return null;
          const Icon = entry.icon;
          const mod = MODULES.find(m => m.id === entry.modId);
          const modName = mod?.name ?? '';
          return (
            <Link key={r.path} href={r.path} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  background: '#fff', border: '1px solid var(--bd)',
                  borderRadius: 12, padding: '10px 12px',
                  display: 'flex', flexDirection: 'row', alignItems: 'center',
                  gap: 10, cursor: 'pointer',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = '0 2px 10px -2px rgba(15,18,34,0.08)';
                  el.style.borderColor = 'rgba(124,91,255,0.25)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = 'none';
                  el.style.borderColor = 'var(--bd)';
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: entry.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {Icon && <Icon size={17} color={entry.ic} strokeWidth={1.75} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--ink-1)',
                    lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
                    {modName}{modName ? ' · ' : ''}{relativeTime(r.visited_at)}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
