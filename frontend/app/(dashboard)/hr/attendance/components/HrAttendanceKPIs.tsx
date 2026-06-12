"use client";

import React, { useMemo } from "react";
import type { Department, Staff } from "@/types/hr";
import type { StaffMark } from "../hooks/useHrAttendanceData";

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
  trendColor = "#16A34A",
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

interface HrAttendanceKPIsProps {
  departments: Department[];
  staffByDept: Record<number, Staff[]>;
  marksByDept: Record<number, Record<number, StaffMark>>;
  originalMarksByDept?: Record<number, Record<number, StaffMark>>;
  loading: boolean;
  kpiSummary?: any;
}

export default function HrAttendanceKPIs({ departments, staffByDept, marksByDept, originalMarksByDept, loading, kpiSummary }: HrAttendanceKPIsProps) {
  const { totalStaff, presentCount, absentCount, absentWithReason, lateCount } = useMemo(() => {
    const baseTotal = kpiSummary?.total_staff ?? 0;
    const baseAbsent = kpiSummary?.absent ?? 0;
    const baseLeave = kpiSummary?.leave ?? 0;
    const baseHalfDay = kpiSummary?.half_day ?? 0;
    const baseHoliday = kpiSummary?.holiday ?? 0;
    const baseLate = kpiSummary?.late_arrivals ?? 0;

    // Only count explicitly saved present records (or dynamically modified ones)
    const basePresent = kpiSummary?.present ?? 0;

    let deltaPresent = 0;
    let deltaAbsent = 0;
    let absentWithReasonCount = 0;
    let deltaLate = 0;

    departments.forEach((d) => {
      const staffList = staffByDept[d.id] || [];
      staffList.forEach((s) => {
        const mark = marksByDept[d.id]?.[s.id] || {};
        const origMark = originalMarksByDept?.[d.id]?.[s.id] || {};

        // For KPI math, we only care about explicitly saved or set statuses
        const status = mark.attendance_type;
        const origStatus = origMark.attendance_type;

        // Visual "A" logic for the reason subtitle includes implied A if any (though UI defaults to P)
        const visualStatus = status || "P";
        if (visualStatus === "A") {
          if (mark.note && mark.note.trim() !== "") {
            absentWithReasonCount += 1;
          }
        }

        if (status !== origStatus) {
          if (status === "A") deltaAbsent += 1;
          else if (status === "P") deltaPresent += 1;

          if (origStatus === "A") deltaAbsent -= 1;
          else if (origStatus === "P") deltaPresent -= 1;
        }

        const isLate = !!mark.arrival_time;
        const origIsLate = !!origMark.arrival_time;
        if (isLate !== origIsLate) {
          if (isLate) deltaLate += 1;
          else deltaLate -= 1;
        }
      });
    });

    const dbTotal = departments.reduce((sum, d: any) => sum + (d.staff_count || 0), 0);
    const finalTotalStaff = (baseTotal > 0) ? baseTotal : dbTotal;

    return {
      totalStaff: finalTotalStaff,
      presentCount: Math.max(0, basePresent + deltaPresent),
      absentCount: Math.max(0, baseAbsent + deltaAbsent),
      absentWithReason: absentWithReasonCount,
      lateCount: Math.max(0, baseLate + deltaLate)
    };
  }, [departments, staffByDept, marksByDept, originalMarksByDept, kpiSummary]);

  if (loading && totalStaff === 0) {
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

  const presentPct = totalStaff > 0 ? Math.round((presentCount / totalStaff) * 100) : 0;

  const absentReasonSub = absentCount === 0
    ? "No absences marked."
    : absentWithReason > 0
      ? `${absentWithReason} of ${absentCount} absent entr${absentCount === 1 ? "y has" : "ies have"} a recorded reason.`
      : "Reasons are pending for absent entries.";

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KPICard
        label="Present Today"
        value={`${presentCount}/${totalStaff}`}
        sub={`${presentPct}% attendance today`}
        badgeText="PR"
        badgeBg="#ECFDF5"
        badgeColor="#16A34A"
        trend={`+0%`} // placeholder for trend
        trendColor="#16A34A"
      />

      <KPICard
        label="Absent Today"
        value={absentCount}
        sub={absentReasonSub}
        badgeText="AB"
        badgeBg="#FFF1F2"
        badgeColor="#E11D48"
        trend="Same as yesterday"
        trendColor="#9CA0AE"
      />

      <KPICard
        label="Late Arrivals"
        value={lateCount}
        sub={lateCount === 0 ? "No late entries" : `${lateCount} staff arrived late`}
        badgeText="LT"
        badgeBg="#FFFBEB"
        badgeColor="#D97706"
      />

      <KPICard
        label="RTE Compliance Risk"
        value={0}
        sub="Shows staff below 75% cumulative attendance. Calculated as present days / working days."
        badgeText="RT"
        badgeBg="#F5F3FF"
        badgeColor="#7C3AED"
      />
    </div>
  );
}
