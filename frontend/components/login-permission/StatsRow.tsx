'use client';

import { Users, CheckCircle2, XCircle, Settings2 } from 'lucide-react';
import type { RoleCounts } from '@/lib/login-permission/types';

const ROLE_LABELS: Record<string, string> = {
  staff:       'Staff',
  parent:      'Parents',
  student:     'Students',
  admin:       'Admins',
  accountant:  'Accountants',
  librarian:   'Librarians',
};

interface Props {
  counts: RoleCounts | null;
  loading: boolean;
  role: string;
}

function Shimmer() {
  return (
    <div className="h-10 w-24 rounded-lg bg-[length:200%_100%] bg-gradient-to-r from-gray-100 via-white to-gray-100 animate-[shimmer_1.4s_ease-in-out_infinite]" />
  );
}

export function StatsRow({ counts, loading, role }: Props) {
  const roleName = role ? (ROLE_LABELS[role] ?? role) : '';
  const pct =
    counts && counts.total > 0
      ? Math.round((counts.active / counts.total) * 100)
      : null;

  const cards = [
    {
      label:   'TOTAL USERS',
      value:   counts?.total ?? null,
      sub:     roleName ? `In ${roleName}` : '–',
      Icon:    Users,
      iconCls: 'text-[var(--pu,#3b5bdb)]',
    },
    {
      label:   'ACTIVE LOGIN ACCESS',
      value:   counts?.active ?? null,
      sub:     pct !== null ? `${pct}% of role` : '–',
      Icon:    CheckCircle2,
      iconCls: 'text-emerald-500',
    },
    {
      label:   'DISABLED ACCESS',
      value:   counts?.disabled ?? null,
      sub:     counts ? `${counts.disabled} blocked` : '–',
      Icon:    XCircle,
      iconCls: 'text-red-400',
    },
    {
      label:   'ROLES AVAILABLE',
      value:   6 as number | null,
      sub:     'Across the system',
      Icon:    Settings2,
      iconCls: 'text-teal-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ label, value, sub, Icon, iconCls }) => (
        <div
          key={label}
          className="rounded-xl border border-[var(--bd,#dbe4f0)] bg-white px-4 py-3"
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-[9px] font-semibold tracking-widest text-[var(--ink-3,#64748b)] uppercase leading-tight">
              {label}
            </span>
            <Icon size={15} className={iconCls} />
          </div>

          {loading && label !== 'ROLES AVAILABLE' && value === null ? (
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
