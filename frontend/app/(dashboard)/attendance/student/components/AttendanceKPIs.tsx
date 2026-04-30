'use client';

import React from 'react';
import type { KPIData } from '../types';

interface AttendanceKPIsProps {
  data: KPIData | null;
  selectedDate?: string;
  today?: string;
  error?: string | null;
}

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
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

export default function AttendanceKPIs({ data, selectedDate, today, error }: AttendanceKPIsProps) {
  if (!data) {
    if (error) {
      // Bug 2: Render the 4 cards with a clear error placeholder rather than a blank box.
      return (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {['Present', 'Absent', 'Late Arrivals', 'RTE Compliance Risk'].map((label) => (
            <article key={label} className="rounded-2xl border border-[#E6E6EC] bg-white px-4 py-3">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">{label}</span>
              <span className="mt-2 block text-[40px] font-bold leading-none text-[#9CA0AE]">—</span>
              <span className="mt-2 block text-xs text-[#C2264E]">Failed to load. {error}</span>
            </article>
          ))}
        </div>
      );
    }
    // Bug 2: Detailed skeleton with shimmer bars instead of bare boxes.
    return (
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-[#E6E6EC] bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-1/3 rounded bg-gray-200" />
              <div className="h-7 w-7 rounded-lg bg-gray-200" />
            </div>
            <div className="mt-3 h-10 w-1/4 rounded bg-gray-200" />
            <div className="mt-3 h-3 w-2/3 rounded bg-gray-200" />
          </div>
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

  const absentReasonSub = data.absent_today === 0
    ? 'No absences marked.'
    : data.absent_with_reason > 0
      ? `${data.absent_with_reason} of ${data.absent_today} absent entr${data.absent_today === 1 ? 'y has' : 'ies have'} a recorded reason.`
      : 'Reasons are pending for absent entries.';

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

      {(() => {
        // Bug 7: derive a meaningful trend label/colour for absences.
        // Negative delta on absences = good (fewer absent than yesterday) → green.
        const absentDelta = typeof data.absent_delta === 'number' ? data.absent_delta : -data.absent_today;
        let absentTrend: string;
        let absentTrendColor: string;
        if (absentDelta < 0) {
          absentTrend = `↓ ${Math.abs(absentDelta)} vs yesterday`;
          absentTrendColor = '#16A34A';
        } else if (absentDelta > 0) {
          absentTrend = `↑ ${absentDelta} vs yesterday`;
          absentTrendColor = '#E11D48';
        } else {
          absentTrend = 'Same as yesterday';
          absentTrendColor = '#9CA0AE';
        }
        return (
          <KPICard
            label={`Absent ${onText}`}
            value={data.absent_today}
            sub={absentReasonSub}
            badgeText="AB"
            badgeBg="#FFF1F2"
            badgeColor="#E11D48"
            trend={absentTrend}
            trendColor={absentTrendColor}
          />
        );
      })()}

      <KPICard
        label="Late Arrivals"
        value={data.late_today}
        sub={(() => {
          // Bug 6: Subtext must be driven by lateCount, never contradict the headline number.
          if ((data.late_today ?? 0) === 0) return 'No late entries';
          if (data.late_student_name) {
            return `${data.late_student_name}${data.late_minutes ? ` - ${data.late_minutes} min late` : ''}`;
          }
          const n = data.late_today;
          return `${n} student${n === 1 ? '' : 's'} arrived late today`;
        })()}
        badgeText="LT"
        badgeBg="#FFFBEB"
        badgeColor="#D97706"
      />

      <KPICard
        label="RTE Compliance Risk"
        value={data.rte_at_risk}
        sub="Shows students below 75% cumulative attendance. Calculated as present days / working days."
        badgeText="RT"
        badgeBg="#F5F3FF"
        badgeColor="#7C3AED"
      />
    </div>
  );
}
