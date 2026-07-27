'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, ChevronRight } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface Notification {
  id: string;
  text: string;
  type: 'info' | 'warn' | 'error' | 'success';
  createdAt: string;
  read: boolean;
  link?: string;
}

interface ApiNotification {
  id: number;
  title: string;
  body: string;
  notification_type: 'system' | 'announcement' | 'reminder' | 'message';
  link_url?: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_COLORS = {
  info:    '#3B82F6',
  warn:    '#F59E0B',
  error:   '#E0463A',
  success: '#22C55E',
};

const NOTIFICATION_TYPE_MAP: Record<ApiNotification['notification_type'], Notification['type']> = {
  system: 'info',
  announcement: 'success',
  reminder: 'warn',
  message: 'info',
};

function mapNotification(n: ApiNotification): Notification {
  return {
    id: String(n.id),
    text: n.title || n.body,
    type: NOTIFICATION_TYPE_MAP[n.notification_type] ?? 'info',
    createdAt: n.created_at,
    read: n.is_read,
    link: n.link_url || undefined,
  };
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m || 1}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationsInbox() {
  const [notifs, setNotifs] = useState<Notification[]>([]);

  useEffect(() => {
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/v1/utilities/communication/notifications/?page_size=3&ordering=-created_at`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then((d: ApiNotification[] | { results?: ApiNotification[] } | null) => {
        const rows = Array.isArray(d) ? d : (d?.results ?? []);
        setNotifs(rows.map(mapNotification));
      })
      .catch(() => {});
  }, []);

  const unread = notifs.filter(n => !n.read).length;

  if (notifs.length === 0) return null;

  return (
    <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, padding: 14, boxShadow: 'var(--sh-1)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ position: 'relative' }}>
            <Bell size={14} color="var(--ink-2)" strokeWidth={1.8} />
            {unread > 0 && <span style={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, borderRadius: '50%', background: '#E0463A', border: '1.5px solid #fff' }} />}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>Notifications</span>
        </div>
        <Link href="/notifications" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, color: 'var(--pu)', textDecoration: 'none' }}>
          View all <ChevronRight size={11} />
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {notifs.map(n => (
          <div
            key={n.id}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 6px', borderRadius: 8,
              background: n.read ? 'transparent' : 'rgba(109,74,255,0.03)',
              transition: 'background 0.15s',
              cursor: n.link ? 'pointer' : 'default',
            }}
            onClick={() => n.link && (window.location.href = n.link)}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-0)')}
            onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(109,74,255,0.03)')}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: TYPE_COLORS[n.type], flexShrink: 0, marginTop: 4 }} />
            <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-1)', lineHeight: 1.4 }}>{n.text}</span>
            <span style={{ fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>{relativeTime(n.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
