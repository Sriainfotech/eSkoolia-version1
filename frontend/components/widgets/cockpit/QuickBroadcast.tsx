'use client';
import { useEffect, useState } from 'react';
import { X, Users, Send, Clock, Mail, MessageSquare, Smartphone, AlertCircle, History, CheckCircle2, XCircle, CalendarClock } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

const TEMPLATES = [
  { id: 'bus_delay',    emoji: '🚌', label: 'Bus delay',     msg: 'Dear Parent, Bus Route {route} is running approximately {minutes} minutes late today. We apologize for the inconvenience.' },
  { id: 'closure',     emoji: '🌧',  label: 'Closure',      msg: 'Dear Parent, school will remain closed tomorrow due to {reason}. Regular classes will resume on {date}.' },
  { id: 'exam_remind', emoji: '📋', label: 'Exam reminder', msg: 'Dear Parent, {exam} is scheduled on {date}. Please ensure your child carries their admit card and stationery.' },
  { id: 'event',       emoji: '🎉', label: 'Event',         msg: 'Dear Parent, {event_name} is scheduled on {date} at {time}. We look forward to your participation.' },
  { id: 'fee_due',     emoji: '💰', label: 'Fee due',       msg: 'Dear Parent, the fee for {term} is due by {due_date}. Please pay at the school office or online portal.' },
  { id: 'custom',      emoji: '✏️', label: 'Custom',        msg: '' },
];

const AUDIENCE_LABELS: Record<string, string> = {
  all_parents: 'All Parents',
  class_parents: 'Class Parents',
  teachers: 'Teachers',
  all_staff: 'All Staff (incl. drivers)',
};

const CHANNEL_OPTIONS = [
  { key: 'push',  label: 'App / Web notification', icon: Smartphone, color: '#6D4AFF', bg: '#EEEAFF' },
  { key: 'sms',   label: 'SMS',                     icon: MessageSquare, color: '#3B82F6', bg: '#DBEAFE' },
  { key: 'email', label: 'Email',                    icon: Mail, color: '#059669', bg: '#D1FAE5' },
];

interface AudienceOptions {
  is_teacher: boolean;
  audience_types: string[];
  classes: { id: number; name: string }[];
}

interface SendResult {
  ok: boolean;
  message: string;
}

interface BroadcastHistoryItem {
  id: number;
  template: string;
  message: string;
  audience_label: string;
  channels: string[];
  status: 'scheduled' | 'sent' | 'failed';
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number;
  error: string;
  created_by_name: string;
  created_at: string;
}

const STATUS_META: Record<BroadcastHistoryItem['status'], { icon: typeof CheckCircle2; color: string; label: string }> = {
  sent:       { icon: CheckCircle2,  color: '#059669', label: 'Sent' },
  failed:     { icon: XCircle,       color: '#DC2626', label: 'Failed' },
  scheduled:  { icon: CalendarClock, color: '#D97706', label: 'Scheduled' },
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

// A slow/cold DB connection can make the synchronous send path take a long
// time; bound the wait so the user gets real feedback instead of an
// indefinite spinner that looks identical to "broken".
const SEND_TIMEOUT_MS = 25000;

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Schedule window: today .. exactly 1 year from today.
function scheduleDateBounds() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oneYearOut = new Date(today);
  oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
  return { min: toDateInputValue(today), max: toDateInputValue(oneYearOut) };
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function QuickBroadcast() {
  const [modal, setModal] = useState<typeof TEMPLATES[0] | null>(null);
  const [msg, setMsg] = useState('');
  const [options, setOptions] = useState<AudienceOptions | null>(null);
  const [audienceType, setAudienceType] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [channels, setChannels] = useState<string[]>(['push']);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<BroadcastHistoryItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { min: scheduleMinDate, max: scheduleMaxDate } = scheduleDateBounds();

  const loadHistory = () => {
    setHistoryLoading(true);
    fetch(`${API_BASE_URL}/api/v1/utilities/communication/broadcast/`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : []))
      .then((d: BroadcastHistoryItem[]) => setHistory(Array.isArray(d) ? d : []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  };

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next && history === null) loadHistory();
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/utilities/communication/broadcast/audience-options/`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then((d: AudienceOptions | null) => {
        if (!d) return;
        setOptions(d);
        setAudienceType(d.audience_types[0] || '');
        if (d.is_teacher) setSelectedClassIds(d.classes.map(c => c.id));
      })
      .catch(() => {});
  }, []);

  const openTemplate = (t: typeof TEMPLATES[0]) => {
    setModal(t);
    setMsg(t.msg);
    setResult(null);
    setScheduleMode(false);
    setScheduleDate('');
    setScheduleTime('');
  };

  const toggleClass = (id: number) => {
    setSelectedClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleChannel = (c: string) => {
    setChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const send = async () => {
    if (!msg.trim()) { setResult({ ok: false, message: 'Write a message first.' }); return; }
    if (audienceType === 'class_parents' && selectedClassIds.length === 0) {
      setResult({ ok: false, message: 'Select at least one class.' });
      return;
    }
    let scheduledAtIso: string | undefined;
    if (scheduleMode) {
      if (!scheduleDate || !scheduleTime) { setResult({ ok: false, message: 'Pick a date and time to schedule.' }); return; }
      if (scheduleDate < scheduleMinDate || scheduleDate > scheduleMaxDate) {
        setResult({ ok: false, message: 'Scheduled date must be between today and 1 year from today.' });
        return;
      }
      const local = new Date(`${scheduleDate}T${scheduleTime}:00`);
      const oneYearOut = new Date();
      oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
      if (isNaN(local.getTime()) || local.getTime() <= Date.now()) {
        setResult({ ok: false, message: 'Scheduled time must be in the future.' });
        return;
      }
      if (local.getTime() > oneYearOut.getTime()) {
        setResult({ ok: false, message: 'Scheduled date must be within 1 year from today.' });
        return;
      }
      scheduledAtIso = local.toISOString();
    }

    setSending(true);
    setResult(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/utilities/communication/broadcast/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        signal: controller.signal,
        body: JSON.stringify({
          template: modal?.id,
          message: msg,
          audience_type: audienceType,
          class_ids: selectedClassIds,
          channels,
          scheduled_at: scheduledAtIso,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data?.error || 'Failed to send broadcast.' });
      } else {
        setResult({ ok: true, message: data.message });
        setHistory(null); // stale — refetch next time the history panel opens
        if (historyOpen) loadHistory();
        if (data.status === 'sent') {
          setTimeout(() => { setModal(null); setResult(null); }, 1800);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setResult({
          ok: false,
          message: "This is taking much longer than usual — the server may still be processing it. Check History in a moment before sending again, so you don't send it twice.",
        });
      } else {
        setResult({ ok: false, message: 'Network error — could not reach the server.' });
      }
    } finally {
      clearTimeout(timeoutId);
      setSending(false);
    }
  };

  return (
    <>
      <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, padding: 14, boxShadow: 'var(--sh-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Send size={13} color="#22C55E" strokeWidth={2} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>Quick Broadcast</span>
          </div>
          <button onClick={toggleHistory} style={{
            display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none',
            cursor: 'pointer', fontSize: 11, fontWeight: 600, color: historyOpen ? 'var(--pu)' : 'var(--ink-3)', padding: 2,
          }}>
            <History size={12} strokeWidth={2} /> History
          </button>
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

        {historyOpen && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bd)', maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {historyLoading && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', textAlign: 'center', padding: 8 }}>Loading…</div>}
            {!historyLoading && history?.length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', textAlign: 'center', padding: 8 }}>Nothing sent yet.</div>
            )}
            {!historyLoading && history?.map(item => {
              const meta = STATUS_META[item.status];
              const StatusIcon = meta.icon;
              return (
                <div key={item.id} style={{ border: '1px solid var(--bd)', borderRadius: 9, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                      <StatusIcon size={12} color={meta.color} strokeWidth={2} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>· {item.audience_label}</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>
                      {formatWhen(item.sent_at || item.scheduled_at || item.created_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.message}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
                    {item.status === 'sent' ? `${item.recipient_count} recipient${item.recipient_count === 1 ? '' : 's'}` : ''}
                    {item.status === 'failed' && item.error ? item.error : ''}
                    {item.created_by_name ? ` · by ${item.created_by_name}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,18,34,0.55)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 26, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--sh-3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24 }}>{modal.emoji}</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-1)' }}>{modal.label}</span>
              </div>
              <button onClick={() => setModal(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} color="var(--ink-3)" />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Left column — message + schedule */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Message</div>
                <textarea
                  value={msg}
                  onChange={e => setMsg(e.target.value)}
                  rows={7}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--bd)', borderRadius: 10, fontSize: 13, resize: 'vertical', outline: 'none', lineHeight: 1.5, boxSizing: 'border-box' }}
                />

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Channels</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {CHANNEL_OPTIONS.map(c => {
                      const Icon = c.icon;
                      const active = channels.includes(c.key);
                      return (
                        <button key={c.key} onClick={() => toggleChannel(c.key)} style={{
                          display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600,
                          padding: '6px 10px', borderRadius: 9, border: '1px solid', cursor: 'pointer', textAlign: 'left',
                          background: active ? c.bg : 'var(--bg-2)',
                          color: active ? c.color : 'var(--ink-3)',
                          borderColor: active ? c.color : 'var(--bd)',
                        }}>
                          <Icon size={13} strokeWidth={2} /> {c.label}
                        </button>
                      );
                    })}
                  </div>
                  {channels.includes('sms') && (
                    <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start', marginTop: 6, fontSize: 10.5, color: 'var(--ink-3)' }}>
                      <AlertCircle size={11} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                      SMS is logged for the school&apos;s records but not yet dispatched through an SMS provider — recipients will only be notified via the other selected channels.
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 14 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={scheduleMode} onChange={e => setScheduleMode(e.target.checked)} />
                    <Clock size={13} strokeWidth={2} /> Schedule for later
                  </label>
                  {scheduleMode && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input type="date" value={scheduleDate} min={scheduleMinDate} max={scheduleMaxDate} onChange={e => setScheduleDate(e.target.value)}
                        style={{ flex: 1, height: 34, padding: '0 10px', border: '1px solid var(--bd)', borderRadius: 8, fontSize: 12.5, outline: 'none' }} />
                      <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                        style={{ flex: 1, height: 34, padding: '0 10px', border: '1px solid var(--bd)', borderRadius: 8, fontSize: 12.5, outline: 'none' }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Right column — audience */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Users size={11} strokeWidth={2} /> Audience
                </div>

                {!options ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Loading…</div>
                ) : options.is_teacher ? (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginBottom: 10, lineHeight: 1.5 }}>
                    As a class teacher, you can broadcast to parents of the class(es) you&apos;re assigned to.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                    {options.audience_types.map(a => (
                      <button key={a} onClick={() => { setAudienceType(a); if (a !== 'class_parents') setSelectedClassIds([]); }} style={{
                        fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 20,
                        border: '1px solid', cursor: 'pointer',
                        background: audienceType === a ? 'var(--pu)' : 'var(--bg-2)',
                        color: audienceType === a ? '#fff' : 'var(--ink-2)',
                        borderColor: audienceType === a ? 'var(--pu)' : 'var(--bd)',
                      }}>{AUDIENCE_LABELS[a] || a}</button>
                    ))}
                  </div>
                )}

                {audienceType === 'class_parents' && options && (
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>
                      {options.classes.length === 0 ? 'No classes available.' : 'Select classes'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
                      {options.classes.map(c => (
                        <button key={c.id} onClick={() => toggleClass(c.id)} style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                          border: '1px solid', cursor: 'pointer',
                          background: selectedClassIds.includes(c.id) ? 'var(--pu-soft)' : 'var(--bg-2)',
                          color: selectedClassIds.includes(c.id) ? 'var(--pu-deep, #4C35BE)' : 'var(--ink-2)',
                          borderColor: selectedClassIds.includes(c.id) ? 'var(--pu)' : 'var(--bd)',
                        }}>{c.name}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {result && (
              <div style={{
                marginTop: 16, padding: '9px 12px', borderRadius: 9, fontSize: 12, fontWeight: 500,
                background: result.ok ? '#D1FAE5' : '#FEF2F2',
                color: result.ok ? '#065F46' : '#B91C1C',
              }}>
                {result.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={send} disabled={sending} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '11px', border: 'none', borderRadius: 10, cursor: sending ? 'default' : 'pointer',
                background: 'var(--pu)', color: '#fff', fontWeight: 700, fontSize: 13,
                opacity: sending ? 0.7 : 1, transition: 'all 0.2s',
              }}>
                {sending ? 'Sending…' : scheduleMode ? <><Clock size={13} strokeWidth={2.5} /> Schedule</> : <><Send size={13} strokeWidth={2.5} /> Send Now</>}
              </button>
              <button onClick={() => setModal(null)} disabled={sending} style={{
                padding: '11px 16px', border: '1px solid var(--bd)', borderRadius: 10, cursor: 'pointer',
                background: 'var(--bg-0)', color: 'var(--ink-2)', fontWeight: 600, fontSize: 12.5,
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
