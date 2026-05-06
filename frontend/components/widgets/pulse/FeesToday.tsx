'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IndianRupee, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface FeesSummary {
  collectedAmount: number;
  transactionCount: number;
  vsAvgPercent: number;
  vsAvgDay: string;
  sparkline7d: number[];
}

const MOCK: FeesSummary = {
  collectedAmount: 214800,
  transactionCount: 48,
  vsAvgPercent: 18,
  vsAvgDay: 'Tue',
  sparkline7d: [158000, 174000, 143000, 198000, 211000, 189000, 214800],
};

function formatINR(n: number) {
  if (n >= 100000) {
    return '₹' + (n / 100000).toFixed(2).replace(/\.?0+$/, '') + 'L';
  }
  return '₹' + n.toLocaleString('en-IN');
}

function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 200, H = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');
  const area = `M0,${H} L${pts.split(' ').map(p => `L${p}`).join(' ')} L${W},${H} Z`;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ marginTop: 8 }}>
      <defs>
        <linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6D4AFF" stopOpacity={0.15} />
          <stop offset="100%" stopColor="#6D4AFF" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#feeGrad)" />
      <polyline points={pts} fill="none" stroke="#6D4AFF" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* Highlight last point */}
      {(() => {
        const last = data[data.length - 1];
        const x = W, y = H - ((last - min) / range) * H;
        return <circle cx={x} cy={y} r={2.5} fill="#6D4AFF" />;
      })()}
    </svg>
  );
}

export function FeesToday() {
  const [data, setData] = useState<FeesSummary>(MOCK);
  const router = useRouter();

  const fetchData = useCallback(() => {
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/fees/today-summary/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const positive = data.vsAvgPercent >= 0;

  return (
    <div
      onClick={() => router.push('/fees/payments')}
      style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, padding: 14, boxShadow: 'var(--sh-1)', cursor: 'pointer', transition: 'box-shadow 0.15s, border-color 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-2)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(109,74,255,0.25)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-1)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--bd)'; }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IndianRupee size={11} color="#059669" strokeWidth={2} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today&apos;s Fees</span>
        </div>
        <ChevronRight size={13} color="var(--ink-3)" />
      </div>

      {/* Big number */}
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {formatINR(data.collectedAmount)}
      </div>

      {/* Subline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
        <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
          {data.transactionCount} transactions
        </span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 3,
          fontSize: 10.5, fontWeight: 600,
          color: positive ? '#059669' : '#E0463A',
          background: positive ? '#D1FAE5' : '#FEE2E2',
          padding: '2px 6px', borderRadius: 20,
        }}>
          {positive ? <TrendingUp size={9} strokeWidth={2} /> : <TrendingDown size={9} strokeWidth={2} />}
          {positive ? '+' : ''}{data.vsAvgPercent}% vs avg {data.vsAvgDay}
        </span>
      </div>

      <Sparkline data={data.sparkline7d} />
    </div>
  );
}
