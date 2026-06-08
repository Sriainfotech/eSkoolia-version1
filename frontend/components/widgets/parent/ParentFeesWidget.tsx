'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, ChevronRight, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useParentChild } from '@/contexts/ParentChildContext';
import { fetchChildFees, type FeeItem } from '@/lib/api/parent';

const STATUS_CONFIG = {
  paid:    { icon: CheckCircle, color: 'var(--ok)', bg: 'rgba(34,197,94,0.1)', label: 'Paid' },
  partial: { icon: Clock,       color: '#D97706',   bg: '#FFF7ED',             label: 'Partial' },
  unpaid:  { icon: AlertCircle, color: '#DC2626',   bg: '#FEF2F2',             label: 'Unpaid' },
} as const;

export function ParentFeesWidget() {
  const router = useRouter();
  const { selectedChild } = useParentChild();
  const [items, setItems] = useState<FeeItem[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedChild) return;
    setLoading(true);
    fetchChildFees(selectedChild.id)
      .then((data) => {
        const allItems = data.groups.flatMap(g => g.items).slice(0, 4);
        setItems(allItems);
        setTotalDue(data.summary.total_due);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedChild?.id]);

  const fmtCurrency = (n: number) =>
    '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={12} color="#D97706" strokeWidth={1.8} />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}>Fee Status</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {totalDue > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 20, padding: '2px 7px' }}>
              {fmtCurrency(totalDue)} due
            </span>
          )}
          <button onClick={() => router.push('/parent/fees')}
            style={{ fontSize: 11, color: 'var(--pu)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontWeight: 500 }}>
            Details <ChevronRight size={11} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div style={{ padding: '8px 6px', minHeight: 60 }}>
        {loading && (
          <div style={{ padding: '12px 10px', textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>Loading…</div>
        )}
        {!loading && items.length === 0 && (
          <div style={{ padding: '12px 10px', textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>No fee records found.</div>
        )}
        {!loading && items.map((f, i) => {
          const cfg = STATUS_CONFIG[f.status];
          const Icon = cfg.icon;
          const dueLabel = new Date(f.due_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          return (
            <div key={f.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, cursor: 'pointer', borderBottom: i < items.length - 1 ? '1px solid var(--bd)' : 'none', transition: 'background 0.12s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              onClick={() => router.push('/parent/fees')}
            >
              <div style={{ width: 28, height: 28, borderRadius: 7, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={13} color={cfg.color} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fee_name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}>Due {dueLabel}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: cfg.color }}>{fmtCurrency(f.net_amount)}</div>
                <div style={{ fontSize: 10, color: cfg.color, fontWeight: 600 }}>{cfg.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
