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

function getTimeEmoji() {
  const h = new Date().getHours();
  if (h < 12) return '☀️';
  if (h < 17) return '🌤️';
  return '🌙';
}

function getFormattedDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow transition-shadow">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

export function Greeting() {
  const [name, setName] = useState('');
  const [attentionCount, setAttentionCount] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const t = setTimeout(() => setVisible(true), 50);

    const token = getAccessToken();
    if (!token) return () => clearTimeout(t);

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

    return () => clearTimeout(t);
  }, []);

  return (
    <section
      className="flex items-end justify-between gap-6 flex-wrap mb-5 transition-all duration-500"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(8px)' }}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-0.5 leading-tight">
          <span className="mr-2">{getTimeEmoji()}</span>
          Good {getTimeWord()}{name ? ', ' : ''}
          {name && <span className="text-[#1a56db]">{name}</span>}
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          {getFormattedDate()}
          {attentionCount !== null && attentionCount > 0 && (
            <>
              {' · '}
              <span className="text-gray-800 font-medium">
                {attentionCount} {attentionCount === 1 ? 'item' : 'items'} need your attention
              </span>
            </>
          )}
        </p>
      </div>
      <div className="flex gap-3 items-center flex-shrink-0 flex-wrap">
        <Chip label="Academic Year" value="2025–26" />
        <Chip label="School" value="Eskoolia Public" />
      </div>
    </section>
  );
}
