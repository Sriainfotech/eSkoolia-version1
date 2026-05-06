'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bus, ChevronRight, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface BusRoute {
  routeNo: string;
  status: 'on_time' | 'delayed' | 'breakdown' | 'arrived';
  etaMin: number;
  studentsAboard: number;
  lastPing: string;
}

const STATUS_MAP = {
  on_time:   { label: 'On time',    color: '#22C55E', bg: '#D1FAE5' },
  delayed:   { label: 'Delayed',    color: '#F59E0B', bg: '#FEF3C7' },
  breakdown: { label: 'Breakdown',  color: '#E0463A', bg: '#FEE2E2' },
  arrived:   { label: 'Arrived',    color: '#6B7280', bg: '#F3F4F6' },
} as const;

const MOCK: BusRoute[] = [
  { routeNo: '7', status: 'delayed', etaMin: 8, studentsAboard: 23, lastPing: '2 min ago' },
  { routeNo: '3', status: 'on_time', etaMin: 2, studentsAboard: 31, lastPing: '1 min ago' },
  { routeNo: '11', status: 'arrived', etaMin: 0, studentsAboard: 18, lastPing: '8 min ago' },
];

export function BusFleet() {
  const [routes, setRoutes] = useState<BusRoute[]>(MOCK);
  const router = useRouter();

  const fetchData = useCallback(() => {
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/transport/fleet-status/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d)) setRoutes(d); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalStudents = routes.reduce((s, r) => s + r.studentsAboard, 0);
  const delayedCount = routes.filter(r => r.status === 'delayed' || r.status === 'breakdown').length;

  return (
    <div
      onClick={() => router.push('/transport/bus-tracking')}
      style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, padding: 14, boxShadow: 'var(--sh-1)', cursor: 'pointer', transition: 'box-shadow 0.15s, border-color 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-2)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(109,74,255,0.25)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-1)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--bd)'; }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bus size={11} color="#D97706" strokeWidth={2} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bus Fleet</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {delayedCount > 0 && (
            <span style={{ fontSize: 10, fontWeight: 600, background: '#FEE2E2', color: '#E0463A', padding: '1px 6px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}>
              <AlertCircle size={9} strokeWidth={2} />{delayedCount} alert
            </span>
          )}
          <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{totalStudents} students</span>
          <ChevronRight size={13} color="var(--ink-3)" />
        </div>
      </div>

      {routes.slice(0, 3).map(r => {
        const s = STATUS_MAP[r.status];
        return (
          <div key={r.routeNo} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--bg-2)' }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {r.status === 'breakdown' ? <AlertCircle size={12} color={s.color} strokeWidth={2} />
                : r.status === 'arrived' ? <CheckCircle2 size={12} color={s.color} strokeWidth={2} />
                : <Bus size={12} color={s.color} strokeWidth={2} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-1)' }}>Route {r.routeNo}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={9} strokeWidth={1.5} />
                {r.status === 'arrived' ? 'Arrived' : r.status === 'breakdown' ? 'Breakdown reported' : `ETA ${r.etaMin} min`}
                {' · '}{r.studentsAboard} aboard
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ width: 36, height: 4, background: 'var(--bg-2)', borderRadius: 2, flexShrink: 0 }}>
              <div style={{
                height: 4, borderRadius: 2, background: s.color,
                width: r.status === 'arrived' ? '100%' : `${Math.max(10, 100 - r.etaMin * 5)}%`,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--ink-3)', textAlign: 'right' }}>
        {routes.length} routes active · tap to view map
      </div>
    </div>
  );
}
