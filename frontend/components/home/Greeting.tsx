'use client';
import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface MeData { first_name?: string; last_name?: string; username?: string; }

function getTimeWord() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function getFormattedDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '8px 14px', background: '#fff', border: '1px solid var(--bd)', borderRadius: 9,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-1)' }}>{value}</span>
    </div>
  );
}

export function Greeting() {
  const [name, setName] = useState('');
  const [attentionCount, setAttentionCount] = useState<number | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetch(`${API_BASE_URL}/api/v1/auth/me/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((d: MeData) => {
        const n = d.first_name
          ? `${d.first_name}${d.last_name ? ' ' + d.last_name : ''}`
          : (d.username || '');
        setName(n);
      })
      .catch(() => {});

    fetch(`${API_BASE_URL}/api/dashboard/attention-count/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((d: { count?: number }) => setAttentionCount(d.count ?? null))
      .catch(() => {});
  }, []);

  return (
    <section style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      gap: 24, flexWrap: 'wrap', marginBottom: 22,
    }}>
      <div>
        <h1 style={{
          fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em',
          color: 'var(--ink-1)', margin: '0 0 3px', lineHeight: 1.25,
        }}>
          Good {getTimeWord()}{name ? ', ' : ''}
          {name && <span style={{ color: 'var(--pu)' }}>{name}</span>}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0, lineHeight: 1.5 }}>
          {getFormattedDate()}
          {attentionCount !== null && attentionCount > 0 && (
            <> · <span style={{ color: 'var(--ink-1)', fontWeight: 500 }}>{attentionCount} things need your attention today</span></>
          )}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexShrink: 0 }}>
        <Chip label="Academic Year" value="2025–26" />
        <Chip label="School" value="Eskoolia Public" />
      </div>
    </section>
  );
}
