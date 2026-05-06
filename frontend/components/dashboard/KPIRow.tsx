'use client';
import { useState, useEffect } from 'react';
import { Users, UserCheck, CreditCard, UserPlus } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface KPIData {
  total_students?: number;
  attendance_today?: string;
  fees_collected_mtd?: string;
  open_admissions?: number;
}

export function KPIRow() {
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(`${API_BASE_URL}/api/dashboard/kpis/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) setKpi(await res.json());
      } catch { /* graceful */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const cards = [
    { label: 'TOTAL STUDENTS', value: loading ? '…' : (kpi?.total_students != null ? kpi.total_students.toLocaleString() : '—'), delta: 'enrolled students', deltaUp: true, icon: Users, ic: '#B42318', bg: '#FEF3F2' },
    { label: "TODAY'S ATTENDANCE", value: loading ? '…' : (kpi?.attendance_today ?? '—'), delta: 'present today', deltaUp: true, icon: UserCheck, ic: '#B45309', bg: '#FFFBEB' },
    { label: 'FEES COLLECTED MTD', value: loading ? '…' : (kpi?.fees_collected_mtd ?? '—'), delta: 'this month', deltaUp: true, icon: CreditCard, ic: '#0E7490', bg: '#ECFEFF' },
    { label: 'OPEN ADMISSIONS', value: loading ? '…' : (kpi?.open_admissions != null ? String(kpi.open_admissions) : '—'), delta: 'awaiting review', deltaUp: false, icon: UserPlus, ic: '#047857', bg: '#ECFDF5' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 12 }}>
      {cards.map(k => (
        <div key={k.label} style={{
          background: 'var(--bg-1)', border: '1px solid var(--bd)',
          borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4,
          opacity: loading ? 0.6 : 1, transition: 'opacity 0.3s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <k.icon size={14} color={k.ic} strokeWidth={1.5} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</span>
          </div>
          <span style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink-1)', lineHeight: 1.2 }}>{k.value}</span>
          <span style={{ fontSize: 11, color: k.deltaUp ? '#15803d' : 'var(--ink-3)' }}>{k.deltaUp ? '↑ ' : ''}{k.delta}</span>
        </div>
      ))}
    </div>
  );
}

