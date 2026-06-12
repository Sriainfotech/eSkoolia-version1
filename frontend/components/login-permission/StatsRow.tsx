'use client';

import { Users, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { RoleCounts, PortalTab } from '@/lib/login-permission/types';

const TAB_LABELS: Record<PortalTab, string> = {
  teacher:   'Teachers',
  principal: 'Principals',
  student:   'Students',
  parent:    'Parents',
  driver:    'Drivers',
  staff:     'Staff',
};

interface Props {
  counts: RoleCounts | null;
  loading: boolean;
  role: string;
  roleCount?: number;
  activeTab?: PortalTab;
}

function Shimmer() {
  return (
    <div className="h-8 w-20 rounded-lg bg-[length:200%_100%] bg-gradient-to-r from-[var(--bd,#dbe4f0)] via-white to-[var(--bd,#dbe4f0)] animate-[shimmer_1.4s_ease-in-out_infinite]" />
  );
}

export function StatsRow({ counts, loading, role: _role, roleCount, activeTab }: Props) {
  const label = activeTab ? TAB_LABELS[activeTab] : '';
  const pct =
    counts && counts.total > 0
      ? Math.round((counts.active / counts.total) * 100)
      : null;

  const newCount = counts?.neverLoggedIn ?? (counts ? counts.total - counts.active - counts.disabled : null);

  const cards = [
    {
      label:   'TOTAL',
      value:   counts?.total ?? null,
      sub:     label ? `In ${label}` : '–',
      Icon:    Users,
      iconCls: 'text-[var(--pu,#6D4AFF)]',
      loading: loading && counts === null,
    },
    {
      label:   'ACTIVE ACCESS',
      value:   counts?.active ?? null,
      sub:     pct !== null ? `${pct}% have access` : '–',
      Icon:    CheckCircle2,
      iconCls: 'text-[var(--ok,#0E9F6E)]',
      loading: loading && counts === null,
    },
    {
      label:   'DISABLED',
      value:   counts?.disabled ?? null,
      sub:     counts?.disabled ? `Login blocked` : 'None blocked',
      Icon:    XCircle,
      iconCls: 'text-[var(--err,#E0463A)]',
      loading: loading && counts === null,
    },
    {
      label:   'NEVER LOGGED IN',
      value:   newCount !== null && newCount >= 0 ? newCount : null,
      sub:     'Awaiting first login',
      Icon:    Clock,
      iconCls: 'text-[var(--warn,#A65D08)]',
      loading: loading && counts === null,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ label: cardLabel, value, sub, Icon, iconCls, loading: isLoading }) => (
        <div
          key={cardLabel}
          className="rounded-xl border border-[var(--bd,#dbe4f0)] bg-white px-4 py-3"
        >
          <div className="flex items-start justify-between mb-1.5">
            <span className="text-[9px] font-semibold tracking-widest text-[var(--ink-3,#64748b)] uppercase leading-tight">
              {cardLabel}
            </span>
            <Icon size={14} className={iconCls} />
          </div>

          {isLoading ? (
            <Shimmer />
          ) : (
            <p className="text-2xl font-bold text-[var(--ink-1,#0f172a)] leading-none mb-0.5">
              {value !== null ? value.toLocaleString() : '–'}
            </p>
          )}

          <p className="text-[11px] text-[var(--ink-3,#64748b)] mt-1">{sub}</p>
        </div>
      ))}
    </div>
  );
}
