'use client';

import React from 'react';
import type { KPIData } from '../types';

interface AttendanceKPIsProps {
  data: KPIData | null;
  selectedDate?: string;
  today?: string;
}

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  badgeText: string;
  badgeBg: string;
  badgeColor: string;
  trend?: string;
  trendColor?: string;
}

function KPICard({
  label,
  value,
  sub,
  badgeText,
  badgeBg,
  badgeColor,
  trend,
  trendColor = '#16A34A',
}: KPICardProps) {
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
        {trend ? <span className="text-xs font-semibold" style={{ color: trendColor }}>{trend}</span> : null}
      </div>
      {sub ? <span className="mt-2 block text-xs text-[#64748B]">{sub}</span> : null}
    </article>
  );
}

function ratioLabel(part: number, total: number): string {
  if (!total) return '0/0';
  return `${part}/${total}`;
}

export default function AttendanceKPIs({ data, selectedDate, today }: AttendanceKPIsProps) {
  if (!data) {
    return (
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-[#E6E6EC] bg-white" />
        ))}
      </div>
    );
  }

  const isToday = !selectedDate || !today || selectedDate === today;
  const dateLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '';
  const onText = isToday ? 'Today' : `on ${dateLabel}`;

  const presentTrend =
    data.delta_pct > 0
      ? `+${data.delta_pct}%`
      : data.delta_pct < 0
        ? `-${Math.abs(data.delta_pct)}%`
        : `+${data.present_pct}%`;

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KPICard
        label={`Present ${onText}`}
        value={ratioLabel(data.present_today, data.total_students)}
        sub={`${data.present_pct}% attendance ${onText.toLowerCase()}`}
        badgeText="PR"
        badgeBg="#ECFDF5"
        badgeColor="#16A34A"
        trend={presentTrend}
        trendColor="#16A34A"
      />

      <KPICard
        label={`Absent ${onText}`}
        value={data.absent_today}
        sub={data.absent_with_reason > 0 ? `${data.absent_with_reason} child${data.absent_with_reason === 1 ? '' : 'ren'} with reason` : 'No reason provided'}
        badgeText="AB"
        badgeBg="#FFF1F2"
        badgeColor="#E11D48"
        trend={`-${data.absent_today}`}
        trendColor="#E11D48"
      />

      <KPICard
        label="Late Arrivals"
        value={data.late_today}
        sub={
          data.late_student_name
            ? `${data.late_student_name}${data.late_minutes ? ` - ${data.late_minutes} min late` : ''}`
            : 'No late entries'
        }
        badgeText="LT"
        badgeBg="#FFFBEB"
        badgeColor="#D97706"
      />

      <KPICard
        label="RTE Compliance Risk"
        value={data.rte_at_risk}
        sub="below 75%"
        badgeText="RT"
        badgeBg="#F5F3FF"
        badgeColor="#7C3AED"
      />
    </div>
  );
}
