'use client';
import { useState, useEffect } from 'react';
import { X, Phone, Mail, MapPin, User, Star, ChevronRight } from 'lucide-react';
import type { EnquiryResult } from './EnquiryLookupResults';
import { MOCK_ENQUIRIES } from './EnquiryLookupResults';

/* ─── Document label map ─── */
const DOC_LABELS: Record<string, string> = {
  birth_cert:    'Birth Certificate',
  tc:            'Transfer Certificate',
  photo:         'Passport Photo',
  address_proof: 'Address Proof',
  report_card:   'Previous Report Card',
  id_proof:      'ID Proof',
  medical:       'Medical Records',
  caste_cert:    'Caste Certificate',
};

/* ─── Status config ─── */
const STATUS_CONFIG: Record<string, { label: string; bg: string; ink: string }> = {
  new:        { label: 'New',       bg: '#DBEAFE', ink: '#1D4ED8' },
  contacted:  { label: 'Contacted', bg: '#FEF3C7', ink: '#D97706' },
  visited:    { label: 'Visited',   bg: '#EDE9FE', ink: '#7C3AED' },
  applied:    { label: 'Applied',   bg: '#D1FAE5', ink: '#059669' },
  enrolled:   { label: 'Enrolled',  bg: '#DCFCE7', ink: '#16A34A' },
  waitlisted: { label: 'Waitlist',  bg: '#FEF9C3', ink: '#A16207' },
  cold:       { label: 'Cold',      bg: '#F3F4F6', ink: '#6B7280' },
};

const DOC_STATUS_CONFIG: Record<string, { icon: string; color: string }> = {
  received: { icon: '✓', color: '#16A34A' },
  pending:  { icon: '⏳', color: '#D97706' },
  missing:  { icon: '✗', color: '#DC2626' },
};

/* ─── Helpers ─── */
function parseDocStatus(raw: string): Array<{ key: string; label: string; status: string }> {
  if (!raw) return [];
  return raw.split(',').map(part => {
    const [key, status] = part.split(':');
    const k = key?.trim() ?? '';
    return { key: k, label: DOC_LABELS[k] ?? k, status: status?.trim() ?? 'pending' };
  }).filter(d => d.key);
}

function fmt(date: string | null | undefined) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysAgo(date: string | null | undefined) {
  if (!date) return null;
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  return `${diff} days ago`;
}

const TABS = ['Overview', 'Contact', 'Timeline', 'Documents', 'Notes'] as const;
type Tab = typeof TABS[number];

/* ─── Props ─── */
interface Props {
  enquiry: EnquiryResult;
  onClose: () => void;
}

export function EnquiryProfilePopup({ enquiry: initialEnquiry, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [activeEnquiry, setActiveEnquiry] = useState<EnquiryResult>(initialEnquiry);

  // Resolve family siblings from static data
  const allFamily: EnquiryResult[] = (() => {
    const sibIds = initialEnquiry.sibling_ids ?? [];
    if (sibIds.length === 0) return [initialEnquiry];
    const siblings = MOCK_ENQUIRIES.filter(e => sibIds.includes(e.id));
    return [initialEnquiry, ...siblings].sort((a, b) => a.id - b.id);
  })();

  // Reset to initial enquiry when popup reopens
  useEffect(() => {
    setActiveEnquiry(initialEnquiry);
    setActiveTab('Overview');
  }, [initialEnquiry]);

  // Keyboard close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const sc = STATUS_CONFIG[activeEnquiry.status] ?? STATUS_CONFIG.new;
  const docs = parseDocStatus(activeEnquiry.documents_status);
  const receivedCount = docs.filter(d => d.status === 'received').length;
  const scoreColor = activeEnquiry.lead_score >= 75 ? '#16A34A' : activeEnquiry.lead_score >= 50 ? '#D97706' : '#DC2626';
  const scoreBg = activeEnquiry.lead_score >= 75 ? '#D1FAE5' : activeEnquiry.lead_score >= 50 ? '#FEF3C7' : '#FEE2E2';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(10,10,20,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 560, maxHeight: '90vh',
        background: 'var(--bg-1)', borderRadius: 20,
        border: '1px solid var(--bd)',
        boxShadow: '0 24px 64px -12px rgba(14,16,32,0.35)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '16px 20px 0', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              {/* Enquiry ID + status + score */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontSize: 10.5, color: 'var(--ink-3)', fontFamily: 'monospace', background: 'var(--bg-2)', padding: '1px 7px', borderRadius: 6 }}>
                  ENQ-{String(activeEnquiry.id).padStart(4, '0')}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: sc.ink, background: sc.bg,
                  padding: '2px 9px', borderRadius: 10,
                }}>{sc.label}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: scoreColor, background: scoreBg,
                  padding: '2px 8px', borderRadius: 10,
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  <Star size={9} strokeWidth={2.5} /> {activeEnquiry.lead_score}
                </span>
              </div>
              {/* Student name */}
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)', lineHeight: 1.2 }}>
                {activeEnquiry.student_name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                {activeEnquiry.class_applied} &nbsp;·&nbsp; Parent: <strong>{activeEnquiry.parent_name}</strong>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: 8, border: '1px solid var(--bd)',
                background: 'none', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <X size={14} color="var(--ink-3)" />
            </button>
          </div>

          {/* Sibling toggle — shown only when family has 2+ children */}
          {allFamily.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, color: 'var(--ink-3)', flexShrink: 0 }}>Children:</span>
              {allFamily.map(sibling => (
                <button
                  key={sibling.id}
                  onClick={() => setActiveEnquiry(sibling)}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 11px',
                    borderRadius: 20, cursor: 'pointer', border: 'none',
                    background: activeEnquiry.id === sibling.id ? 'var(--pu)' : 'var(--bg-2)',
                    color: activeEnquiry.id === sibling.id ? '#fff' : 'var(--ink-2)',
                    transition: 'all 0.12s',
                  }}
                >
                  {sibling.student_name.split(' ')[0]}
                  <span style={{ opacity: 0.7, fontSize: 10, marginLeft: 3 }}>({sibling.class_applied})</span>
                </button>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: activeTab === t ? 600 : 400,
                  color: activeTab === t ? 'var(--pu)' : 'var(--ink-2)',
                  borderBottom: activeTab === t ? '2px solid var(--pu)' : '2px solid transparent',
                  transition: 'color 0.12s', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* OVERVIEW */}
          {activeTab === 'Overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Lead score gauge */}
              <div style={{ background: 'var(--bg-2)', borderRadius: 12, padding: 14 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10,
                }}>Lead Score</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${activeEnquiry.lead_score}%`,
                        background: `linear-gradient(90deg, ${scoreColor}99, ${scoreColor})`,
                        borderRadius: 4, transition: 'width 0.5s',
                      }} />
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 9.5, color: 'var(--ink-3)', marginTop: 4,
                    }}>
                      <span>Cold</span><span>Warm</span><span>Hot</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: scoreColor, flexShrink: 0, lineHeight: 1 }}>
                    {activeEnquiry.lead_score}
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}>/100</span>
                  </div>
                </div>
              </div>

              {/* Key metrics grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Class Applied',    value: activeEnquiry.class_applied,       icon: '🎓' },
                  { label: 'Source',            value: activeEnquiry.source_name || '—',  icon: '📌' },
                  { label: 'Assigned To',       value: activeEnquiry.assigned || '—',     icon: '👤' },
                  { label: 'No. of Children',   value: String(activeEnquiry.no_of_child), icon: '👨‍👩‍👧' },
                  { label: 'Documents',         value: `${receivedCount}/${docs.length} received`, icon: '📄' },
                  { label: 'Last Contacted',    value: daysAgo(activeEnquiry.last_contacted_at) ?? '—', icon: '📞' },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--bg-2)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 3 }}>{m.icon} {m.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Next follow-up callout */}
              {activeEnquiry.next_follow_up_date && (
                <div style={{
                  background: '#FFFBEB', border: '1px solid #FEF3C7',
                  borderRadius: 10, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 18 }}>⏰</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#D97706' }}>Next Follow-up</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>
                      {fmt(activeEnquiry.next_follow_up_date)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONTACT */}
          {activeTab === 'Contact' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: <User size={15} color="var(--pu)" strokeWidth={1.8} />,   label: 'Parent / Guardian', value: activeEnquiry.parent_name },
                { icon: <Phone size={15} color="var(--pu)" strokeWidth={1.8} />,  label: 'Phone',             value: activeEnquiry.phone },
                { icon: <Mail size={15} color="var(--pu)" strokeWidth={1.8} />,   label: 'Email',             value: activeEnquiry.email || '—' },
                { icon: <MapPin size={15} color="var(--pu)" strokeWidth={1.8} />, label: 'Address',           value: activeEnquiry.address || '—' },
              ].map(row => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex', gap: 12, padding: '11px 14px',
                    background: 'var(--bg-2)', borderRadius: 10,
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, background: 'var(--pu-soft)',
                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {row.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 2 }}>{row.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-1)', lineHeight: 1.4 }}>{row.value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TIMELINE */}
          {activeTab === 'Timeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { icon: '📅', label: 'Enquiry Date',    date: activeEnquiry.query_date,           note: 'Initial enquiry submitted',           upcoming: false },
                { icon: '📞', label: 'First Follow-up', date: activeEnquiry.follow_up_date,       note: 'Scheduled follow-up call',            upcoming: false },
                { icon: '📞', label: 'Last Contacted',  date: activeEnquiry.last_contacted_at,    note: 'Most recent contact made',            upcoming: false },
                { icon: '⏰', label: 'Next Follow-up',  date: activeEnquiry.next_follow_up_date,  note: 'Upcoming follow-up scheduled',        upcoming: true  },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex', gap: 12, padding: '12px 0',
                    borderBottom: '1px solid var(--bd)',
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: item.upcoming ? '#FEF3C7' : 'var(--bg-2)',
                    flexShrink: 0, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 15,
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{item.note}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: 12.5, fontWeight: 600,
                      color: item.upcoming ? '#D97706' : (item.date ? 'var(--ink-1)' : 'var(--ink-3)'),
                    }}>
                      {fmt(item.date)}
                    </div>
                    {item.date && !item.upcoming && (
                      <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>
                        {daysAgo(item.date)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* DOCUMENTS */}
          {activeTab === 'Documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>Checklist status</span>
                <strong style={{ color: receivedCount === docs.length && docs.length > 0 ? '#16A34A' : 'var(--ink-1)' }}>
                  {receivedCount}/{docs.length} received
                </strong>
              </div>
              {/* Progress bar */}
              <div style={{ height: 6, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{
                  height: '100%',
                  width: docs.length ? `${(receivedCount / docs.length) * 100}%` : '0%',
                  background: receivedCount === docs.length && docs.length > 0 ? '#22C55E' : 'var(--pu)',
                  borderRadius: 4, transition: 'width 0.4s',
                }} />
              </div>
              {docs.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', textAlign: 'center', padding: '20px 0' }}>
                  No document checklist set up for this enquiry
                </div>
              )}
              {docs.map(doc => {
                const ds = DOC_STATUS_CONFIG[doc.status] ?? DOC_STATUS_CONFIG.pending;
                return (
                  <div
                    key={doc.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', background: 'var(--bg-2)', borderRadius: 9,
                    }}
                  >
                    <span style={{
                      fontSize: 14, color: ds.color, fontWeight: 700,
                      width: 18, textAlign: 'center', flexShrink: 0,
                    }}>{ds.icon}</span>
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-1)' }}>{doc.label}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: ds.color,
                      textTransform: 'capitalize',
                    }}>{doc.status}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* NOTES */}
          {activeTab === 'Notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeEnquiry.description && (
                <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 14 }}>
                  <div style={{
                    fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)',
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
                  }}>Description</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-1)', lineHeight: 1.65 }}>
                    {activeEnquiry.description}
                  </div>
                </div>
              )}
              {activeEnquiry.note && (
                <div style={{
                  background: '#FFFBEB', border: '1px solid #FEF3C7',
                  borderRadius: 10, padding: 14,
                }}>
                  <div style={{
                    fontSize: 10.5, fontWeight: 600, color: '#D97706',
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
                  }}>📝 Staff Notes</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-1)', lineHeight: 1.65 }}>
                    {activeEnquiry.note}
                  </div>
                </div>
              )}
              {!activeEnquiry.description && !activeEnquiry.note && (
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', textAlign: 'center', padding: '28px 0' }}>
                  No notes added for this enquiry
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--bd)',
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <a
            href={`/admissions/command-center?inquiry=${activeEnquiry.id}`}
            style={{
              flex: 1, padding: '9px 16px',
              background: 'var(--pu)', color: '#fff',
              border: 'none', borderRadius: 10, cursor: 'pointer',
              fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            View in Admissions <ChevronRight size={13} strokeWidth={2.5} />
          </a>
          <button
            onClick={onClose}
            style={{
              padding: '9px 16px', background: 'var(--bg-2)', color: 'var(--ink-2)',
              border: '1px solid var(--bd)', borderRadius: 10, cursor: 'pointer',
              fontSize: 12.5, fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
