'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronRight, Megaphone } from 'lucide-react';
import { fetchParentNotices, type NoticeItem } from '@/lib/api/parent';

export function ParentNoticesWidget() {
  const router = useRouter();
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchParentNotices()
      .then((data) => setNotices(data.slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isNew = (publishOn: string) => {
    const diff = (new Date().getTime() - new Date(publishOn + 'T00:00:00').getTime()) / 86400000;
    return diff <= 3;
  };

  const relativeDate = (publishOn: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(publishOn + 'T00:00:00').getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff <= 6) return `${diff} days ago`;
    return new Date(publishOn + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={12} color="#0284C7" strokeWidth={1.8} />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}>Notice Board</span>
        </div>
        <button onClick={() => router.push('/parent/notices')}
          style={{ fontSize: 11, color: 'var(--pu)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontWeight: 500 }}>
          All <ChevronRight size={11} strokeWidth={2} />
        </button>
      </div>

      <div style={{ padding: '8px 6px', minHeight: 60 }}>
        {loading && (
          <div style={{ padding: '12px 10px', textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>Loading…</div>
        )}
        {!loading && notices.length === 0 && (
          <div style={{ padding: '12px 10px', textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>No notices yet.</div>
        )}
        {!loading && notices.map((n, i) => (
          <div key={n.id}
            style={{ display: 'flex', gap: 10, padding: '9px 10px', borderRadius: 9, cursor: 'pointer', borderBottom: i < notices.length - 1 ? '1px solid var(--bd)' : 'none', transition: 'background 0.12s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            onClick={() => router.push('/parent/notices')}
          >
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <Megaphone size={13} color="#0284C7" strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                {isNew(n.publish_on) && (
                  <span style={{ padding: '1px 6px', borderRadius: 20, background: 'rgba(2,132,199,0.12)', color: '#0284C7', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>NEW</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{relativeDate(n.publish_on)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
