'use client';

import React from 'react';
import type { PromotionKpi } from '@/lib/promotion-api';

interface Props {
  kpi: PromotionKpi | null;
}

interface CardProps {
  label: string;
  value: number | string;
  sub?: string;
  badgeText: string;
  badgeBg: string;
  badgeColor: string;
}

function KPICard({ label, value, sub, badgeText, badgeBg, badgeColor }: CardProps) {
  return (
    <article className="min-w-0 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">{label}</span>
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold"
          style={{ background: badgeBg, color: badgeColor }}
        >
          {badgeText}
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between">
        <span className="text-[40px] font-bold leading-none text-[#111827]">{value}</span>
      </div>
      {sub ? <span className="mt-2 block text-xs text-[#64748B]">{sub}</span> : null}
    </article>
  );
}

export default function PromoteKPICards({ kpi }: Props) {
  if (!kpi) {
    return (
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-[#E6E6EC] bg-white" />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KPICard
        label="Total Students"
        value={kpi.total}
        sub={`${kpi.completion_percentage}% decisions completed`}
        badgeText="TS"
        badgeBg="#EEF2FF"
        badgeColor="#4729F4"
      />
      <KPICard
        label="Marked to Promote"
        value={kpi.promoted}
        sub={kpi.total ? `${Math.round((kpi.promoted / kpi.total) * 100)}% of class` : '—'}
        badgeText="PR"
        badgeBg="#ECFDF5"
        badgeColor="#16A34A"
      />
      <KPICard
        label="Not Promoted"
        value={kpi.not_promoted}
        sub={kpi.not_promoted ? 'Retention reason captured' : 'No retentions yet'}
        badgeText="NP"
        badgeBg="#FFF1F2"
        badgeColor="#E11D48"
      />
      <KPICard
        label="Pending Decisions"
        value={kpi.pending}
        sub={kpi.pending ? 'Awaiting review' : 'All reviewed'}
        badgeText="PD"
        badgeBg="#FFFBEB"
        badgeColor="#D97706"
      />
    </div>
  );
}
