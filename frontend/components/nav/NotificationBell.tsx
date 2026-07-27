'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface NotificationItem {
  id: number;
  title: string;
  body: string;
  notification_type: string;
  link_url?: string | null;
  is_read: boolean;
  created_at: string;
}

const BASE = `${API_BASE_URL}/api/v1/utilities/communication/notifications`;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchUnreadCount = useCallback(() => {
    fetch(`${BASE}/?is_read=false&page_size=1`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.count === 'number') setUnreadCount(d.count); })
      .catch(() => {});
  }, [authHeaders]);

  const fetchList = useCallback(() => {
    setLoading(true);
    fetch(`${BASE}/?page_size=10&ordering=-created_at`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setItems(d.results ?? d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleOpen = () => {
    setOpen(v => {
      const next = !v;
      if (next) fetchList();
      return next;
    });
  };

  const markRead = (id: number) => {
    setItems(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount(c => Math.max(0, c - 1));
    fetch(`${BASE}/${id}/mark-read/`, { method: 'POST', headers: authHeaders() }).catch(() => {});
  };

  const markAllRead = () => {
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    fetch(`${BASE}/mark-all-read/`, { method: 'POST', headers: authHeaders() }).catch(() => {});
  };

  const openItem = (n: NotificationItem) => {
    if (!n.is_read) markRead(n.id);
    if (n.link_url) window.location.href = n.link_url;
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={toggleOpen}
        title="Notifications"
        style={{
          position: 'relative', width: 34, height: 34, borderRadius: 8, border: 'none',
          background: open ? 'var(--pu-soft)' : 'transparent', color: open ? 'var(--pu)' : 'var(--ink-2)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <Bell size={17} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 3, right: 3,
            minWidth: 15, height: 15, padding: '0 3px', borderRadius: 20,
            background: 'var(--danger, #DC2626)', color: '#fff', fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'var(--bg-1)', border: '1px solid var(--bd)',
          borderRadius: 14, boxShadow: 'var(--sh-3)',
          zIndex: 300, width: 340, maxHeight: 440, overflowY: 'auto',
          animation: 'fadeIn 0.15s ease both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--bd)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--pu)', fontWeight: 600 }}
              >
                <CheckCheck size={12} strokeWidth={2} /> Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>No notifications yet</div>
          ) : (
            items.map(n => (
              <div
                key={n.id}
                onClick={() => openItem(n)}
                style={{
                  display: 'flex', gap: 8, padding: '10px 14px', cursor: 'pointer',
                  background: n.is_read ? 'transparent' : 'var(--pu-soft)',
                  borderBottom: '1px solid var(--bd)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = n.is_read ? 'var(--bg-2)' : 'var(--pu-soft)')}
                onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? 'transparent' : 'var(--pu-soft)')}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: n.is_read ? 'transparent' : 'var(--pu)', marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: n.is_read ? 500 : 700, color: 'var(--ink-1)' }}>{n.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.body}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 3 }}>{timeAgo(n.created_at)}</div>
                </div>
                {!n.is_read && (
                  <button
                    onClick={e => { e.stopPropagation(); markRead(n.id); }}
                    title="Mark as read"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', flexShrink: 0, display: 'flex', alignItems: 'flex-start', padding: 2 }}
                  >
                    <Check size={13} strokeWidth={2} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
