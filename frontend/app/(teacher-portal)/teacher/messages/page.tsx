'use client';

/**
 * Teacher Portal — Messages (Phase 1)
 *
 * Inbox-style list against /api/v1/teacher/messages/, with a live push
 * layer on top (usePortalNotifications) — a new message triggers a
 * background refetch instead of a manual page reload. The WS push is a
 * nice-to-have; the initial fetch-on-mount is what actually guarantees
 * the data loads.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Send, Mail, MailOpen, Reply, Sparkles } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { usePortalNotifications } from '@/hooks/usePortalNotifications';
import { fetchTeacherMessages, type InAppMessageItem } from '@/lib/api/teacher';
import ComposeMessageModal from '@/components/teacher/ComposeMessageModal';

function Skeleton({ h = 16 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 8, background: 'var(--bg-2)' }} />;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function TeacherMessagesPage() {
  const { me } = usePermissions();
  const [messages, setMessages] = useState<InAppMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<InAppMessageItem | null>(null);
  const [composeReplyTo, setComposeReplyTo] = useState<{ recipientId: number; recipientName: string; subject: string } | undefined>(undefined);
  const [composeOpen, setComposeOpen] = useState(false);
  const [liveBanner, setLiveBanner] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchTeacherMessages()
      .then(setMessages)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  usePortalNotifications(
    useCallback((n) => {
      if (n.kind !== 'message') return;
      setLiveBanner(true);
      load();
      setTimeout(() => setLiveBanner(false), 4000);
    }, [load]),
  );

  const currentUserId = me?.id ?? null;

  const otherParty = useCallback((m: InAppMessageItem) => (m.sender.id === currentUserId ? m.recipient : m.sender), [currentUserId]);
  const partyName = (p: InAppMessageItem['sender']) => `${p.first_name} ${p.last_name}`.trim() || p.username;

  const unreadCount = useMemo(
    () => messages.filter((m) => m.recipient.id === currentUserId && !m.is_read).length,
    [messages, currentUserId],
  );

  function openCompose(replyTo?: { recipientId: number; recipientName: string; subject: string }) {
    setComposeReplyTo(replyTo);
    setComposeOpen(true);
  }

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--bd)', borderRadius: 18, boxShadow: 'var(--sh-1)', padding: '28px 30px' }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22, paddingBottom: 20, borderBottom: '1px solid var(--bd)' }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 600, color: 'var(--ink-1)', margin: '0 0 5px', lineHeight: 1.05, letterSpacing: '-0.03em', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            Messages
            {unreadCount > 0 && (
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--danger)', borderRadius: 20, padding: '2px 10px' }}>{unreadCount} new</span>
            )}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.55 }}>
            Messages with parents and staff — updates arrive live.
          </p>
        </div>
        <button onClick={() => openCompose(undefined)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: '#0369A1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Send size={15} /> New Message
        </button>
      </div>

      {liveBanner && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--info-soft)', border: '1px solid transparent', borderRadius: 9, padding: '9px 13px', color: 'var(--info)', fontSize: 12.5, marginBottom: 16 }}>
          <Sparkles size={13} /> New message just arrived.
        </div>
      )}
      {error && (
        <div style={{ background: 'var(--danger-soft)', border: '1px solid transparent', borderRadius: 10, padding: '12px 16px', color: 'var(--danger)', fontSize: 13, marginBottom: 20 }}>
          Could not load messages. Please refresh.
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} h={64} />)}
        </div>
      ) : messages.length === 0 ? (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--bd)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <Mail size={28} color="var(--ink-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>No messages yet</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Start a conversation with a parent using &ldquo;New Message&rdquo;.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map((m) => {
            const isOwnRecipientUnread = m.recipient.id === currentUserId && !m.is_read;
            const other = otherParty(m);
            const iAmSender = m.sender.id === currentUserId;
            return (
              <button key={m.id} onClick={() => setSelected(m)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', border: '1px solid var(--bd)', borderRadius: 12, padding: '13px 16px', background: isOwnRecipientUnread ? 'var(--pu-tint)' : 'var(--bg-1)', cursor: 'pointer' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: isOwnRecipientUnread ? 'var(--pu)' : 'var(--bg-2)', color: isOwnRecipientUnread ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                  {isOwnRecipientUnread ? <Mail size={15} /> : <MailOpen size={15} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: isOwnRecipientUnread ? 700 : 500, color: 'var(--ink-1)' }}>
                      {iAmSender ? `To: ${partyName(other)}` : partyName(other)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{timeAgo(m.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: isOwnRecipientUnread ? 600 : 400, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.subject} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>— {m.body}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(15,18,34,0.45)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-1)', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: 'var(--sh-3)', padding: 24 }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {partyName(selected.sender.id === currentUserId ? selected.recipient : selected.sender)} · {timeAgo(selected.created_at)}
            </div>
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: 'var(--ink-1)' }}>{selected.subject}</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.body}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setSelected(null)} style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg-1)', color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Close</button>
              <button onClick={() => {
                const other = selected.sender.id === currentUserId ? selected.recipient : selected.sender;
                openCompose({ recipientId: other.id, recipientName: partyName(other), subject: selected.subject });
                setSelected(null);
              }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 9, border: 'none', background: '#0369A1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Reply size={14} /> Reply
              </button>
            </div>
          </div>
        </div>
      )}

      {composeOpen && (
        <ComposeMessageModal
          replyTo={composeReplyTo}
          onClose={() => setComposeOpen(false)}
          onSent={(sent) => { setMessages((prev) => [sent, ...prev]); setComposeOpen(false); }}
        />
      )}
    </div>
  );
}
