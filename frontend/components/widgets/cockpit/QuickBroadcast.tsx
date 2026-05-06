'use client';
import { useState } from 'react';
import { X, Users, Send, Clock } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

const TEMPLATES = [
  { id: 'bus_delay',    emoji: '🚌', label: 'Bus delay',     category: 'ops',   msg: 'Dear Parent, Bus Route {route} is running approximately {minutes} minutes late today. We apologize for the inconvenience.' },
  { id: 'closure',     emoji: '🌧',  label: 'Closure',      category: 'ops',   msg: 'Dear Parent, school will remain closed tomorrow due to {reason}. Regular classes will resume on {date}.' },
  { id: 'exam_remind', emoji: '📋', label: 'Exam reminder', category: 'exam',  msg: 'Dear Parent, {exam} is scheduled on {date}. Please ensure your child carries their admit card and stationery.' },
  { id: 'event',       emoji: '🎉', label: 'Event',         category: 'event', msg: 'Dear Parent, {event_name} is scheduled on {date} at {time}. We look forward to your participation.' },
  { id: 'fee_due',     emoji: '💰', label: 'Fee due',       category: 'fee',   msg: 'Dear Parent, the fee for {term} is due by {due_date}. Please pay at the school office or online portal.' },
  { id: 'custom',      emoji: '✏️', label: 'Custom',        category: 'misc',  msg: '' },
];

const AUDIENCE_OPTIONS = ['All Parents', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Custom'];
const CHANNEL_OPTIONS = [
  { key: 'sms',   label: 'SMS',        color: '#3B82F6', bg: '#DBEAFE' },
  { key: 'push',  label: 'App Push',   color: '#6D4AFF', bg: '#EEEAFF' },
  { key: 'email', label: 'Email',      color: '#059669', bg: '#D1FAE5' },
];

export function QuickBroadcast() {
  const [modal, setModal] = useState<typeof TEMPLATES[0] | null>(null);
  const [msg, setMsg] = useState('');
  const [audience, setAudience] = useState<string[]>(['All Parents']);
  const [channels, setChannels] = useState<string[]>(['sms', 'push']);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const openTemplate = (t: typeof TEMPLATES[0]) => {
    setModal(t);
    setMsg(t.msg);
    setSent(false);
  };

  const toggleAudience = (a: string) => {
    setAudience(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  };
  const toggleChannel = (c: string) => {
    setChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const send = async (scheduled?: boolean) => {
    setSending(true);
    const token = getAccessToken();
    await fetch(`${API_BASE_URL}/api/comms/broadcast/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ template: modal?.id, message: msg, audience, channels, scheduledAt: scheduled ? new Date(Date.now() + 3600000).toISOString() : null }),
    }).catch(() => {});
    setSending(false);
    setSent(true);
    setTimeout(() => { setModal(null); setSent(false); }, 1500);
  };

  return (
    <>
      <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, padding: 14, boxShadow: 'var(--sh-1)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Send size={13} color="#22C55E" strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>Quick Broadcast</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => openTemplate(t)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '10px 6px', border: '1px solid var(--bd)', borderRadius: 10,
                background: 'var(--bg-0)', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(109,74,255,0.3)'; e.currentTarget.style.background = 'var(--pu-soft)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.background = 'var(--bg-0)'; }}
            >
              <span style={{ fontSize: 20 }}>{t.emoji}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-2)', textAlign: 'center', lineHeight: 1.3 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,18,34,0.55)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 22, width: '100%', maxWidth: 420, boxShadow: 'var(--sh-3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>{modal.emoji}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>{modal.label}</span>
              </div>
              <button onClick={() => setModal(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={16} color="var(--ink-3)" />
              </button>
            </div>

            {/* Message */}
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--bd)', borderRadius: 10, fontSize: 13, resize: 'vertical', outline: 'none', lineHeight: 1.5 }}
            />

            {/* Audience */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Users size={11} strokeWidth={2} /> Audience
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {AUDIENCE_OPTIONS.slice(0, 6).map(a => (
                  <button key={a} onClick={() => toggleAudience(a)} style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                    border: '1px solid', cursor: 'pointer',
                    background: audience.includes(a) ? 'var(--pu)' : 'var(--bg-2)',
                    color: audience.includes(a) ? '#fff' : 'var(--ink-2)',
                    borderColor: audience.includes(a) ? 'var(--pu)' : 'var(--bd)',
                  }}>{a}</button>
                ))}
              </div>
            </div>

            {/* Channels */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Channels</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {CHANNEL_OPTIONS.map(c => (
                  <button key={c.key} onClick={() => toggleChannel(c.key)} style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, border: '1px solid', cursor: 'pointer',
                    background: channels.includes(c.key) ? c.bg : 'var(--bg-2)',
                    color: channels.includes(c.key) ? c.color : 'var(--ink-3)',
                    borderColor: channels.includes(c.key) ? c.color : 'var(--bd)',
                  }}>{c.label}</button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => send()} disabled={sending || sent} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px', border: 'none', borderRadius: 10, cursor: 'pointer',
                background: sent ? '#D1FAE5' : 'var(--pu)', color: sent ? '#059669' : '#fff', fontWeight: 700, fontSize: 13,
                transition: 'all 0.2s',
              }}>
                {sent ? '✓ Sent!' : sending ? 'Sending…' : <><Send size={13} strokeWidth={2.5} /> Send Now</>}
              </button>
              <button onClick={() => send(true)} disabled={sending} style={{
                padding: '10px 14px', border: '1px solid var(--bd)', borderRadius: 10, cursor: 'pointer',
                background: 'var(--bg-0)', color: 'var(--ink-2)', fontWeight: 600, fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Clock size={12} strokeWidth={2} /> Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
