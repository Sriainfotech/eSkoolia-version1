'use client';
import { useEffect, useState } from 'react';
import { FileText, ExternalLink, Send } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface Draft {
  id: string;
  title: string;
  preview: string;
  type: 'sms' | 'email' | 'notice';
  updatedAt: string;
}

const MOCK: Draft[] = [
  { id: '1', title: 'Fee Reminder — December 2025', preview: 'Dear Parent, this is a reminder that the fee for…', type: 'sms', updatedAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: '2', title: 'Annual Day Programme — Final', preview: 'We are pleased to inform you that the Annual Day…', type: 'email', updatedAt: new Date(Date.now() - 86400000).toISOString() },
];

const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  sms:    { color: '#3B82F6', bg: '#DBEAFE' },
  email:  { color: '#6D4AFF', bg: '#EEEAFF' },
  notice: { color: '#059669', bg: '#D1FAE5' },
};

function relAge(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const h = Math.floor(d / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function DraftsPending() {
  const [drafts, setDrafts] = useState<Draft[]>(MOCK);

  useEffect(() => {
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/comms/drafts/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d)) setDrafts(d); })
      .catch(() => {});
  }, []);

  if (drafts.length === 0) return null;

  return (
    <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, padding: 14, boxShadow: 'var(--sh-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <FileText size={13} color="var(--ink-2)" strokeWidth={1.8} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>Drafts Pending</span>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--ink-3)' }}>{drafts.length} unsent</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {drafts.map(d => {
          const tc = TYPE_COLORS[d.type] || TYPE_COLORS.sms;
          return (
            <div key={d.id} style={{ padding: '8px 10px', background: 'var(--bg-0)', border: '1px solid var(--bd)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: tc.color, background: tc.bg, padding: '1px 6px', borderRadius: 20 }}>{d.type}</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                <span style={{ fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>{relAge(d.updatedAt)}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 7 }}>{d.preview}</div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: 'var(--pu)', background: 'var(--pu-soft)', border: 'none', borderRadius: 6, padding: '3px 9px', cursor: 'pointer' }}>
                  <ExternalLink size={10} strokeWidth={2.5} />Open
                </button>
                <button style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: '#059669', background: '#D1FAE5', border: 'none', borderRadius: 6, padding: '3px 9px', cursor: 'pointer' }}>
                  <Send size={10} strokeWidth={2.5} />Send now
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
