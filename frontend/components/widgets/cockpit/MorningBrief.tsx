'use client';
import { useEffect, useState } from 'react';
import { Sparkles, X, RefreshCw } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface Brief {
  headline: string;
  bullets: string[];
  generatedAt: string;
  slot: string;
}

const SLOT_COLORS: Record<string, { from: string; to: string }> = {
  morning: { from: '#150d3a', to: '#3a2a82' },
  midday:  { from: '#0c2746', to: '#1d5587' },
  eod:     { from: '#1a0c20', to: '#5b1a6b' },
};

const BULLET_DOTS = ['#7C5BFF', '#22C55E', '#F59E0B', '#3B82F6'];

function getSlot(): string {
  const h = new Date().getHours();
  if (h >= 7 && h < 12) return 'morning';
  if (h >= 12 && h < 15) return 'midday';
  if (h >= 17 && h < 20) return 'eod';
  return '';
}

const MOCK_BRIEF: Brief = {
  headline: 'School running smoothly — 2 items need your attention today.',
  bullets: [
    'Attendance at 92.4% · 2 sections yet to mark (Class 6B, 7A)',
    '₹2.14L collected today · 18% above Tuesday average',
    'Term 1 exams in 12 days · Syllabus at 64% for Class 10',
    '1 active sick bay case · Parent contacted for Aarav Sharma',
  ],
  generatedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  slot: 'morning',
};

export function MorningBrief() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const slot = getSlot();

  const fetchBrief = (force = false) => {
    if (!slot && !force) return;
    setLoading(true);
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/ai/brief/?slot=${slot || 'morning'}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setBrief(d || MOCK_BRIEF); setLoading(false); })
      .catch(() => { setBrief(MOCK_BRIEF); setLoading(false); });
  };

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('eskoolia_brief_dismissed') : null;
    const today = new Date().toDateString();
    if (saved === today) { setDismissed(true); return; }
    fetchBrief();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('eskoolia_brief_dismissed', new Date().toDateString());
    }
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/user/dismissed-briefs/today/`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
  };

  if (!slot || dismissed || (!brief && !loading)) return null;
  const colors = SLOT_COLORS[slot] || SLOT_COLORS.morning;
  const slotLabel = slot === 'morning' ? 'Morning Brief' : slot === 'midday' ? 'Midday Sync' : 'End-of-Day Wrap';

  return (
    <div style={{
      background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)`,
      borderRadius: 16, padding: 14, color: '#fff',
      boxShadow: '0 4px 16px -4px rgba(88,54,224,0.4)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={13} color="#a78bfa" strokeWidth={2} />
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {slotLabel} · {brief?.generatedAt || '—'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => { setDismissed(false); fetchBrief(true); }}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Refresh brief"
          >
            <RefreshCw size={11} color="rgba(255,255,255,0.7)" className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={dismiss} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={11} color="rgba(255,255,255,0.7)" />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', padding: '8px 0' }}>Generating brief…</div>
      ) : brief && (
        <>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: '#fff', margin: '0 0 10px', lineHeight: 1.4 }}>{brief.headline}</p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {brief.bullets.slice(0, 4).map((b, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 11.5, color: 'rgba(255,255,255,0.82)', lineHeight: 1.4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: BULLET_DOTS[i % BULLET_DOTS.length], flexShrink: 0, marginTop: 3 }} />
                {b}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={9} strokeWidth={1.5} />
            Generated by AI · tap refresh to regenerate
          </div>
        </>
      )}
    </div>
  );
}
