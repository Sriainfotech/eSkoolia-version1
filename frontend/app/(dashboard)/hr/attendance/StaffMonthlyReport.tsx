"use client";
/**
 * Staff Monthly Attendance Report — mirrors the student MonthlyReport: week donut
 * cards + monthly average, Top Absent / Top Leave reasons (mined from notes), and a
 * per-staff summary table. Data comes from /api/v1/hr/staff-attendance/monthly-report/.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchStaffMonthlyReport } from "@/hooks/useHrApi";
import type {
  StaffMonthlyRecord, StaffMonthlyRow, StaffReasonInsight,
} from "@/hooks/useHrApi";
import type { Department } from "@/types/hr";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
].map((label, i) => ({ value: i + 1, label }));

function pctColor(pct: number) { return pct >= 75 ? "#0A8C5A" : pct >= 50 ? "#B4721B" : "#C2264E"; }
function pctBg(pct: number) { return pct >= 75 ? "#E4F6ED" : pct >= 50 ? "#FEF3C7" : "#FCE8EE"; }

function DonutRing({ pct, size = 60 }: { pct: number; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pctColor(pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8E8F0" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize={11} fontWeight="700" fill={color}>{pct}%</text>
    </svg>
  );
}

function getWeekRanges(month: number, year: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthAbbr = new Date(year, month - 1, 1).toLocaleString("en-GB", { month: "short" });
  const ranges: { week: number; label: string; dateRange: string; start: number; end: number }[] = [];
  let weekIdx = 0;
  let cursor = 1;
  while (cursor <= daysInMonth) {
    const dow = new Date(year, month - 1, cursor).getDay();
    const end = Math.min(cursor + (6 - dow), daysInMonth);
    weekIdx += 1;
    ranges.push({ week: weekIdx, label: `Week ${weekIdx}`, dateRange: `${monthAbbr} ${cursor}–${end}`, start: cursor, end });
    cursor = end + 1;
  }
  return ranges;
}

function getAcademicYears(): string[] {
  const yr = new Date().getFullYear();
  const years: string[] = [];
  for (let y = yr + 1; y >= yr - 3; y--) years.push(String(y));
  return years;
}

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function StaffMonthlyReport({ departments }: { departments: Department[] }) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [deptId, setDeptId] = useState<number | "">("");

  const [pendingMonth, setPendingMonth] = useState(month);
  const [pendingYear, setPendingYear] = useState(year);
  const [pendingDept, setPendingDept] = useState<number | "">("");

  const [records, setRecords] = useState<StaffMonthlyRecord[]>([]);
  const [rows, setRows] = useState<StaffMonthlyRow[]>([]);
  const [absentReasons, setAbsentReasons] = useState<StaffReasonInsight[]>([]);
  const [leaveReasons, setLeaveReasons] = useState<StaffReasonInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const years = useMemo(() => getAcademicYears(), []);

  const load = useCallback(async (m: number, y: number, d: number | "") => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStaffMonthlyReport({ month: m, year: y, department: d || undefined });
      setRecords(data.records);
      setRows(data.rows);
      setAbsentReasons(data.insights.top_absent_reasons);
      setLeaveReasons(data.insights.top_leave_reasons);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(month, year, deptId); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = () => {
    setMonth(pendingMonth); setYear(pendingYear); setDeptId(pendingDept);
    void load(pendingMonth, pendingYear, pendingDept);
  };

  const weekRanges = useMemo(() => getWeekRanges(month, year), [month, year]);
  const weekCards = useMemo(() => weekRanges.map(({ week, label, dateRange, start, end }) => {
    const wr = records.filter((r) => {
      const day = new Date(`${r.attendance_date}T00:00:00`).getDate();
      return day >= start && day <= end;
    });
    const present = wr.filter((r) => r.attendance_type === "P").length;
    const absent = wr.filter((r) => r.attendance_type === "A").length;
    const total = wr.length;
    const days = new Set(wr.map((r) => r.attendance_date)).size;
    return { week, label, dateRange, present, absent, total, days, presentPct: total > 0 ? Math.round((present / total) * 100) : 0 };
  }), [records, weekRanges]);

  const overallPresent = records.filter((r) => r.attendance_type === "P").length;
  const overallTotal = records.length;
  const overallPct = overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;
  const schoolDays = new Set(records.map((r) => r.attendance_date)).size;
  const weeksWithData = weekCards.filter((w) => w.total > 0);

  const totals = rows.reduce(
    (a, r) => ({ p: a.p + r.present, ab: a.ab + r.absent, l: a.l + r.leave }),
    { p: 0, ab: 0, l: 0 },
  );
  const totalAll = totals.p + totals.ab + totals.l;
  const totalPct = totalAll > 0 ? Math.round((totals.p / totalAll) * 100) : 0;

  const monthLabel = new Date(year, month - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
  const deptLabel = deptId ? (departments.find((d) => d.id === deptId)?.name ?? "Department") : "All Departments";

  const handleDownload = () => {
    const out: string[][] = [["Staff No", "Name", "Department", "Present", "Absent", "Leave", "Attendance %"]];
    for (const r of rows) {
      const t = r.present + r.absent + r.leave;
      out.push([r.staff_no, r.name, r.department_name, String(r.present), String(r.absent), String(r.leave), `${t ? Math.round((r.present / t) * 100) : 0}%`]);
    }
    downloadCSV(out, `staff-attendance-report-${monthLabel.replace(/\s/g, "-")}.csv`);
  };

  return (
    <div className="mt-6 bg-white rounded-2xl border border-[#E6E6EC] overflow-hidden">
      {/* Header + filters */}
      <div className="px-5 py-3.5 border-b border-[#F0F0F6] bg-[#FAFAFD]">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-[13px] font-semibold text-[#0B0B14]">Monthly Attendance Report</h2>
            <p className="text-[11px] text-[#9CA0AE] mt-0.5">{deptLabel} · {monthLabel}</p>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-[#9CA0AE] uppercase tracking-wide px-0.5">Year</label>
              <select value={pendingYear} onChange={(e) => setPendingYear(Number(e.target.value))} className="h-8 px-2.5 text-[11px] font-medium bg-white border border-[#E6E6EC] rounded-lg text-[#0B0B14] outline-none cursor-pointer">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-[#9CA0AE] uppercase tracking-wide px-0.5">Month</label>
              <select value={pendingMonth} onChange={(e) => setPendingMonth(Number(e.target.value))} className="h-8 px-2.5 text-[11px] font-medium bg-white border border-[#E6E6EC] rounded-lg text-[#0B0B14] outline-none cursor-pointer">
                {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-[#9CA0AE] uppercase tracking-wide px-0.5">Department</label>
              <select value={pendingDept} onChange={(e) => setPendingDept(e.target.value ? Number(e.target.value) : "")} className="h-8 px-2.5 text-[11px] font-medium bg-white border border-[#E6E6EC] rounded-lg text-[#0B0B14] outline-none cursor-pointer">
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <button onClick={handleGenerate} disabled={loading} className="h-8 px-4 text-[11px] font-semibold bg-[#4729F4] text-white rounded-lg hover:bg-[#3B21D4] disabled:opacity-50 transition-colors">
              {loading ? "Loading…" : "Generate"}
            </button>
            <button onClick={handleDownload} disabled={loading || rows.length === 0} className="h-8 px-4 text-[11px] font-semibold bg-white border border-[#E6E6EC] text-[#0B0B14] rounded-lg hover:bg-[#F8F8FF] disabled:opacity-50 transition-colors">
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {loading ? (
          <div className="flex gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="flex-1 h-[148px] rounded-2xl bg-[#F0F0F5] animate-pulse" style={{ opacity: 1 - i * 0.12 }} />)}
          </div>
        ) : error ? (
          <div className="flex items-center justify-between gap-2.5 p-3.5 rounded-xl bg-[#FFF0F3] border border-[#FBCFE8]">
            <p className="text-[12px] text-[#C2264E] font-medium">{error}</p>
            <button onClick={() => void load(month, year, deptId)} className="shrink-0 h-7 px-3 text-[10px] font-semibold bg-[#C2264E] text-white rounded-lg hover:bg-[#A31E42] transition-colors">Retry</button>
          </div>
        ) : (
          <>
            {/* Week cards + monthly avg */}
            <div className="flex gap-3 overflow-x-auto pb-1 mb-5">
              {weekCards.map((wk) => (
                <div key={wk.week} className={`flex-1 min-w-[110px] rounded-2xl border p-3 flex flex-col gap-2 ${wk.total > 0 ? "bg-white border-[#E6E6EC]" : "bg-[#FAFAFD] border-[#F0F0F6] opacity-50"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#0B0B14]">{wk.label}</span>
                    {wk.total > 0 && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: pctBg(wk.presentPct), color: pctColor(wk.presentPct) }}>
                        {wk.presentPct >= 75 ? "Good" : wk.presentPct >= 50 ? "Avg" : "Low"}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-[#9CA0AE] -mt-1.5">{wk.dateRange}</p>
                  {wk.total > 0 ? (
                    <>
                      <div className="flex justify-center"><DonutRing pct={wk.presentPct} /></div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[9px]"><span className="text-[#9CA0AE]">{wk.days} {wk.days === 1 ? "day" : "days"}</span></div>
                        <div className="flex items-center justify-between text-[9px]"><span className="text-[#6B6B7B] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#0A8C5A] inline-block" />Present</span><span className="font-bold text-[#0A8C5A]">{wk.present}</span></div>
                        <div className="flex items-center justify-between text-[9px]"><span className="text-[#6B6B7B] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#C2264E] inline-block" />Absent</span><span className="font-bold text-[#C2264E]">{wk.absent}</span></div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center flex-1 py-3 gap-1"><p className="text-[9px] text-[#C8C8D4]">No data</p></div>
                  )}
                </div>
              ))}
              <div className="flex-1 min-w-[110px] rounded-2xl border-2 border-[#4729F4] bg-gradient-to-b from-[#F8F6FF] to-[#EDE9FE] p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#4729F4]">Monthly</span>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[#EDE9FE] text-[#4729F4]">Avg</span>
                </div>
                <p className="text-[9px] text-[#9CA0AE] -mt-1.5">{weeksWithData.length} wk{weeksWithData.length !== 1 ? "s" : ""} · {schoolDays} {schoolDays === 1 ? "day" : "days"}</p>
                {overallTotal > 0 ? (
                  <>
                    <div className="flex justify-center"><DonutRing pct={overallPct} /></div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9px]"><span className="text-[#6B6B7B] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#0A8C5A] inline-block" />Present</span><span className="font-bold text-[#0A8C5A]">{overallPct}%</span></div>
                      <div className="flex items-center justify-between text-[9px]"><span className="text-[#6B6B7B] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#C2264E] inline-block" />Absent</span><span className="font-bold text-[#C2264E]">{Math.round(100 - overallPct)}%</span></div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 py-3 gap-1"><p className="text-[9px] text-[#C8C8D4]">No data yet</p></div>
                )}
              </div>
            </div>

            {/* Top reasons */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              <div className="rounded-2xl border border-[#E6E6EC] bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[12px] font-semibold text-[#0B0B14]">Top Absent Reasons</p>
                    <p className="text-[10px] text-[#9CA0AE]">Ranked from attendance notes for the selected period.</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF0F3] text-[#C2264E]">{absentReasons.length}</span>
                </div>
                {absentReasons.length > 0 ? (
                  <div className="space-y-2">
                    {absentReasons.map((item, i) => (
                      <div key={`${item.reason}-${i}`} className="flex items-start justify-between gap-3 rounded-xl bg-[#FFF7F9] px-3 py-2">
                        <p className="text-[11px] font-medium text-[#3A3A4A]">{item.reason}</p>
                        <span className="text-[11px] font-bold text-[#C2264E]">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-[11px] text-[#9CA0AE]">No absent-note insights for the selected filters.</p>}
              </div>
              <div className="rounded-2xl border border-[#E6E6EC] bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[12px] font-semibold text-[#0B0B14]">Top Leave Reasons</p>
                    <p className="text-[10px] text-[#9CA0AE]">Frequent leave reasons captured during attendance.</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EFF6FF] text-[#2563EB]">{leaveReasons.length}</span>
                </div>
                {leaveReasons.length > 0 ? (
                  <div className="space-y-2">
                    {leaveReasons.map((item, i) => (
                      <div key={`${item.reason}-${i}`} className="flex items-start justify-between gap-3 rounded-xl bg-[#F5F9FF] px-3 py-2">
                        <p className="text-[11px] font-medium text-[#3A3A4A]">{item.reason}</p>
                        <span className="text-[11px] font-bold text-[#2563EB]">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-[11px] text-[#9CA0AE]">No leave-note insights for the selected filters.</p>}
              </div>
            </div>

            {/* Per-staff summary */}
            {rows.length > 0 ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA0AE] mb-2.5">Staff Summary</p>
                <div className="overflow-x-auto rounded-xl border border-[#F0F0F6]">
                  <table className="w-full text-sm border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-[#FAFAFD]">
                        {["Staff", "Present", "Absent", "Leave", "Attendance %"].map((h, i) => (
                          <th key={h} className={`px-4 py-2.5 text-[10px] uppercase tracking-wide text-[#9CA0AE] font-semibold border-b border-[#F0F0F6] ${i === 0 ? "text-left" : "text-center"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const t = r.present + r.absent + r.leave;
                        const pct = t > 0 ? Math.round((r.present / t) * 100) : 0;
                        return (
                          <tr key={r.staff_id} className="border-t border-[#F0F0F6] hover:bg-[#FAFAFD] transition-colors">
                            <td className="px-4 py-2.5">
                              <p className="text-[12px] font-semibold text-[#0B0B14]">{r.name || "—"}</p>
                              <p className="text-[10px] text-[#9CA0AE]">{r.staff_no}{r.department_name ? ` · ${r.department_name}` : ""}</p>
                            </td>
                            <td className="px-4 py-2.5 text-center"><span className="text-[12px] font-semibold text-[#0A8C5A]">{r.present}</span></td>
                            <td className="px-4 py-2.5 text-center"><span className="text-[12px] font-semibold text-[#C2264E]">{r.absent}</span></td>
                            <td className="px-4 py-2.5 text-center"><span className="text-[12px] font-semibold text-[#2563EB]">{r.leave}</span></td>
                            <td className="px-4 py-2.5 text-center"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: pctBg(pct), color: pctColor(pct) }}>{pct}%</span></td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-[#E6E6EC] bg-[#FAFAFD]">
                        <td className="px-4 py-2.5 text-[11px] font-bold text-[#3A3A4A]">Total</td>
                        <td className="px-4 py-2.5 text-center text-[12px] font-bold text-[#0A8C5A]">{totals.p}</td>
                        <td className="px-4 py-2.5 text-center text-[12px] font-bold text-[#C2264E]">{totals.ab}</td>
                        <td className="px-4 py-2.5 text-center text-[12px] font-bold text-[#2563EB]">{totals.l}</td>
                        <td className="px-4 py-2.5 text-center"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: pctBg(totalPct), color: pctColor(totalPct) }}>{totalPct}%</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : overallTotal === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-[13px] font-medium text-[#3A3A4A]">No attendance data for {monthLabel}</p>
                <p className="text-[11px] text-[#9CA0AE] mt-1">No records found for the selected filters.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
