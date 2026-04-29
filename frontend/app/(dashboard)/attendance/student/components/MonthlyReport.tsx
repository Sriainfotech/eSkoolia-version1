'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { getToken } from '../utils/attendanceHelpers';
import type { ClassInfo } from '../types';

interface DailyRecord {
  id: number;
  student: number;
  attendance_date: string;
  attendance_type: 'P' | 'A' | 'L' | 'F' | 'H';
  class_id?: number;
  section_id?: number;
}

interface StudentTotal {
  student_id?: number;
  name?: string;
  admission_no?: string;
  present?: number;
  absent?: number;
  late?: number;
}

interface ReasonInsight {
  reason: string;
  count: number;
}

interface WeeklyInsight {
  week: number;
  present: number;
  absent: number;
  late: number;
  present_pct: number;
}

interface ReportInsights {
  weekly: WeeklyInsight[];
  top_absent_reasons: ReasonInsight[];
  top_late_reasons: ReasonInsight[];
}

interface WeekCard {
  week: number;
  label: string;
  dateRange: string;
  present: number;
  absent: number;
  total: number;
  presentPct: number;
}

interface ActiveFilters {
  classId: number | '';
  sectionId: number | '';
  month: number;
  year: number;
  acadYear: string;
}

interface MonthlyReportProps {
  selectedDate: string;
  classes: ClassInfo[];
}

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

function getAcademicYears(): string[] {
  const yr = new Date().getFullYear();
  const years: string[] = [];
  for (let y = yr + 1; y >= yr - 3; y--) years.push(`${y - 1}-${String(y).slice(2)}`);
  return years;
}

function getWeekRanges(month: number, year: number) {
  // Issue #6: Calendar weeks aligned to Sunday → Saturday inside the month.
  // Partial leading/trailing weeks are kept (e.g. month starts Wed → week 1
  // is Wed–Sat). Each entry's start/end are clamped to the month.
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthAbbr = new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'short' });
  const ranges: { week: number; label: string; dateRange: string; start: number; end: number }[] = [];
  let weekIdx = 0;
  let cursor = 1;
  while (cursor <= daysInMonth) {
    const dow = new Date(year, month - 1, cursor).getDay(); // 0=Sun, 6=Sat
    const remainingInWeek = 6 - dow;                         // days until Sat
    const end = Math.min(cursor + remainingInWeek, daysInMonth);
    weekIdx += 1;
    ranges.push({
      week: weekIdx,
      label: `Week ${weekIdx}`,
      dateRange: `${monthAbbr} ${cursor}–${end}`,
      start: cursor,
      end,
    });
    cursor = end + 1;
  }
  return ranges;
}

function pctColor(pct: number) { return pct >= 75 ? '#0A8C5A' : pct >= 50 ? '#B4721B' : '#C2264E'; }
function pctBg(pct: number) { return pct >= 75 ? '#E4F6ED' : pct >= 50 ? '#FEF3C7' : '#FCE8EE'; }

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
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize={11} fontWeight="700" fill={color}>{pct}%</text>
    </svg>
  );
}

/** Fetch all pages of a paginated endpoint, following `next` links */
async function fetchAllPages<T>(url: string, headers: Record<string, string>): Promise<T[]> {
  let results: T[] = [];
  let nextUrl: string | null = url;
  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { headers });
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const msg = errBody?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }
    const data: { results?: T[]; next?: string | null } | T[] = await res.json();
    const page: T[] = Array.isArray(data) ? data : (data.results ?? []);
    results = [...results, ...page];
    nextUrl = Array.isArray(data) ? null : (data.next ?? null);
  }
  return results;
}

/** Generate and trigger download of a CSV file */
function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function MonthlyReport({ selectedDate, classes }: MonthlyReportProps) {
  const todayDate = new Date();

  // ── Pending filter state (dropdowns) ──────────────────────────
  const [pendingAcadYear, setPendingAcadYear] = useState<string>(() => {
    const m = todayDate.getMonth() + 1;
    const y = todayDate.getFullYear();
    return m >= 6 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
  });
  const [pendingMonth, setPendingMonth] = useState<number>(todayDate.getMonth() + 1);
  const [pendingClassId, setPendingClassId] = useState<number | ''>('');
  const [pendingSectionId, setPendingSectionId] = useState<number | ''>('');

  // ── Active filters (what's actually loaded) ────────────────────
  const [active, setActive] = useState<ActiveFilters>(() => ({
    classId: '',
    sectionId: '',
    month: todayDate.getMonth() + 1,
    year: todayDate.getFullYear(),
    acadYear: (() => {
      const m = todayDate.getMonth() + 1; const y = todayDate.getFullYear();
      return m >= 6 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
    })(),
  }));

  // ── Data state ─────────────────────────────────────────────────
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [reportRows, setReportRows] = useState<StudentTotal[]>([]);
  const [insights, setInsights] = useState<ReportInsights>({ weekly: [], top_absent_reasons: [], top_late_reasons: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const academicYears = useMemo(() => getAcademicYears(), []);

  const pendingSections = useMemo(() => {
    if (!pendingClassId) return [];
    return classes.find((c) => c.id === pendingClassId)?.sections ?? [];
  }, [pendingClassId, classes]);

  // Auto-select first section when pending class changes
  useEffect(() => {
    setPendingSectionId(pendingSections[0]?.id ?? '');
  }, [pendingSections]);

  // Derive year from academic year + month
  function deriveYear(acadYear: string, month: number) {
    const startYear = parseInt(acadYear.split('-')[0], 10);
    return month >= 6 ? startYear : startYear + 1;
  }

  // ── Fetch data based on active filters ─────────────────────────
  const fetchData = useCallback(async (filters: ActiveFilters) => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const classParam = filters.classId ? `&class_id=${filters.classId}` : '';
      const sectionParam = filters.classId && filters.sectionId ? `&section_id=${filters.sectionId}` : '';
      const base = `month=${filters.month}&year=${filters.year}${classParam}${sectionParam}`;

      // Always fetch all daily records (paginated)
      const records = await fetchAllPages<DailyRecord>(
        `${API_BASE_URL}/api/v1/attendance/student-attendance/?${base}&page_size=100`,
        headers,
      );

      // Student-level report only when class+section selected
      let rows: StudentTotal[] = [];
      let nextInsights: ReportInsights = { weekly: [], top_absent_reasons: [], top_late_reasons: [] };
      if (filters.classId && filters.sectionId) {
        const reportRes = await fetch(
          `${API_BASE_URL}/api/v1/attendance/student-attendance/report/?${base}`,
          { headers },
        );
        if (reportRes.ok) {
          const rp = await reportRes.json();
          rows = Array.isArray(rp) ? rp : (rp.results ?? rp.data ?? []);
        }
      }

      const insightsRes = await fetch(
        `${API_BASE_URL}/api/v1/attendance/student-attendance/report-insights/?${base}`,
        { headers },
      );
      if (insightsRes.ok) {
        const insightData = await insightsRes.json();
        nextInsights = {
          weekly: Array.isArray(insightData?.weekly) ? insightData.weekly : [],
          top_absent_reasons: Array.isArray(insightData?.top_absent_reasons) ? insightData.top_absent_reasons : [],
          top_late_reasons: Array.isArray(insightData?.top_late_reasons) ? insightData.top_late_reasons : [],
        };
      }

      setDailyRecords(records);
      setReportRows(rows);
      setInsights(nextInsights);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount (school-wide current month)
  useEffect(() => { void fetchData(active); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate handler ────────────────────────────────────────────
  const handleGenerate = () => {
    const year = deriveYear(pendingAcadYear, pendingMonth);
    const filters: ActiveFilters = {
      classId: pendingClassId,
      sectionId: pendingClassId ? pendingSectionId : '',
      month: pendingMonth,
      year,
      acadYear: pendingAcadYear,
    };
    setActive(filters);
    void fetchData(filters);
  };

  // ── Download handler ────────────────────────────────────────────
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const classParam = active.classId ? `&class_id=${active.classId}` : '';
      const sectionParam = active.classId && active.sectionId ? `&section_id=${active.sectionId}` : '';
      const base = `month=${active.month}&year=${active.year}${classParam}${sectionParam}`;

      // Use the styled XLSX export (two sheets, color-coded, autofilter, summary).
      const exportRes = await fetch(
        `${API_BASE_URL}/api/v1/attendance/student-attendance/export/?${base}&format=xlsx`,
        { headers },
      );
      if (!exportRes.ok) throw new Error(`Export failed (${exportRes.status})`);

      const cd = exportRes.headers.get('Content-Disposition') || '';
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
      const monthName = MONTHS.find((m) => m.value === active.month)?.label ?? String(active.month);
      const selectedClass = classes.find((c) => c.id === active.classId);
      const selectedSection = selectedClass?.sections.find((s) => s.id === active.sectionId);
      const scope = selectedClass && selectedSection
        ? `${selectedClass.display_label}_Section_${selectedSection.name}`
        : selectedClass ? selectedClass.display_label : 'All_Classes';
      const fallbackName = `Attendance_${scope}_${monthName}_${active.year}.xlsx`;
      const filename = match ? decodeURIComponent(match[1]) : fallbackName;

      const blob = await exportRes.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch {
      // silently fail download
    } finally {
      setDownloading(false);
    }
  };

  // ── Derived display data ────────────────────────────────────────
  const weekRanges = useMemo(() => getWeekRanges(active.month, active.year), [active.month, active.year]);

  const weekCards: WeekCard[] = useMemo(() => {
    return weekRanges.map(({ week, label, dateRange, start, end }) => {
      const apiWeek = insights.weekly.find((item) => item.week === week);
      if (apiWeek) {
        const present = (apiWeek.present ?? 0) + (apiWeek.late ?? 0);
        const absent = apiWeek.absent ?? 0;
        const total = present + absent;
        return { week, label, dateRange, present, absent, total, presentPct: total > 0 ? Math.round((present / total) * 100) : 0 };
      }

      const weekRecs = dailyRecords.filter((r) => {
        const day = new Date(`${r.attendance_date}T00:00:00`).getDate();
        return day >= start && day <= end;
      });
      const present = weekRecs.filter((r) => r.attendance_type === 'P' || r.attendance_type === 'L').length;
      const absent = weekRecs.filter((r) => r.attendance_type === 'A').length;
      const total = weekRecs.length;
      return { week, label, dateRange, present, absent, total, presentPct: total > 0 ? Math.round((present / total) * 100) : 0 };
    });
  }, [dailyRecords, insights.weekly, weekRanges]);

  const weeksWithData = weekCards.filter((w) => w.total > 0);
  const overallPresent = dailyRecords.filter((r) => r.attendance_type === 'P' || r.attendance_type === 'L').length;
  const overallTotal = dailyRecords.length;
  const overallPresentPct = overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;
  const avgPresentPct = weeksWithData.length > 0
    ? Math.round(weeksWithData.reduce((s, w) => s + w.presentPct, 0) / weeksWithData.length) : 0;

  const reportPresentTotal = reportRows.reduce((s, r) => s + (r.present ?? 0), 0);
  const reportAbsentTotal = reportRows.reduce((s, r) => s + (r.absent ?? 0), 0);
  const reportLateTotal = reportRows.reduce((s, r) => s + (r.late ?? 0), 0);
  const reportTotal = reportPresentTotal + reportAbsentTotal + reportLateTotal;
  const reportPct = reportTotal > 0 ? Math.round((reportPresentTotal / reportTotal) * 100) : 0;

  const activeClass = classes.find((c) => c.id === active.classId);
  const activeSections = activeClass?.sections ?? [];
  const activeSection = activeSections.find((s) => s.id === active.sectionId);
  const monthLabel = new Date(active.year, active.month - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  const reportTitle = activeClass && activeSection
    ? `${activeClass.display_label} · Section ${activeSection.name}`
    : activeClass ? activeClass.display_label : 'All Classes';

  return (
    <div className="mt-6 bg-white rounded-2xl border border-[#E6E6EC] overflow-hidden">
      {/* ── Header + Filter Row ── */}
      <div className="px-5 py-3.5 border-b border-[#F0F0F6] bg-[#FAFAFD]">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-[13px] font-semibold text-[#0B0B14]">Monthly Attendance Report</h2>
            <p className="text-[11px] text-[#9CA0AE] mt-0.5">{reportTitle} · {monthLabel}</p>
          </div>

          {/* Filter row */}
          <div className="flex items-end gap-2 flex-wrap">
            {/* Academic Year */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-[#9CA0AE] uppercase tracking-wide px-0.5">Acad. Year</label>
              <select value={pendingAcadYear} onChange={(e) => setPendingAcadYear(e.target.value)}
                className="h-8 px-2.5 text-[11px] font-medium bg-white border border-[#E6E6EC] rounded-lg text-[#0B0B14] outline-none cursor-pointer">
                {academicYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {/* Month */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-[#9CA0AE] uppercase tracking-wide px-0.5">Month</label>
              <select value={pendingMonth} onChange={(e) => setPendingMonth(Number(e.target.value))}
                className="h-8 px-2.5 text-[11px] font-medium bg-white border border-[#E6E6EC] rounded-lg text-[#0B0B14] outline-none cursor-pointer">
                {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            {/* Class */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-[#9CA0AE] uppercase tracking-wide px-0.5">Class</label>
              <select value={pendingClassId} onChange={(e) => setPendingClassId(e.target.value ? Number(e.target.value) : '')}
                className="h-8 px-2.5 text-[11px] font-medium bg-white border border-[#E6E6EC] rounded-lg text-[#0B0B14] outline-none cursor-pointer">
                <option value="">All Classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.display_label}</option>)}
              </select>
            </div>
            {/* Section */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold text-[#9CA0AE] uppercase tracking-wide px-0.5">Section</label>
              <select value={pendingSectionId} onChange={(e) => setPendingSectionId(e.target.value ? Number(e.target.value) : '')}
                disabled={!pendingClassId || pendingSections.length === 0}
                className="h-8 px-2.5 text-[11px] font-medium bg-white border border-[#E6E6EC] rounded-lg text-[#0B0B14] outline-none cursor-pointer disabled:opacity-40">
                <option value="">All Sections</option>
                {pendingSections.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
              </select>
            </div>

            {/* Generate button */}
            <button onClick={handleGenerate} disabled={loading}
              className="h-8 px-4 text-[11px] font-semibold bg-[#4729F4] text-white rounded-lg hover:bg-[#3B21D4] disabled:opacity-50 transition-colors flex items-center gap-1.5">
              {loading ? (
                <><svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={3} strokeDasharray="30 70" /></svg>Loading</>
              ) : (
                <><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>Generate</>
              )}
            </button>

            {/* Download button */}
            <button onClick={() => { void handleDownload(); }} disabled={downloading || loading}
              className="h-8 px-4 text-[11px] font-semibold bg-white border border-[#E6E6EC] text-[#0B0B14] rounded-lg hover:bg-[#F8F8FF] disabled:opacity-50 transition-colors flex items-center gap-1.5">
              {downloading ? (
                <><svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={3} strokeDasharray="30 70" /></svg>Downloading</>
              ) : (
                <><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4M3 20h18" /></svg>Download</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-5">
        {loading ? (
          <div className="flex gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex-1 h-[148px] rounded-2xl bg-[#F0F0F5] animate-pulse" style={{ opacity: 1 - i * 0.12 }} />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-between gap-2.5 p-3.5 rounded-xl bg-[#FFF0F3] border border-[#FBCFE8]">
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-[#C2264E] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx={12} cy={12} r={10} /><path d="M12 8v4m0 4h.01" />
              </svg>
              <div>
                <p className="text-[12px] text-[#C2264E] font-medium">{error}</p>
                {(error.includes('503') || error.includes('502') || error.includes('unavailable')) && (
                  <p className="text-[10px] text-[#C2264E] opacity-75 mt-0.5">The database may be waking up. Please wait a moment and retry.</p>
                )}
              </div>
            </div>
            <button onClick={() => void fetchData(active)}
              className="shrink-0 h-7 px-3 text-[10px] font-semibold bg-[#C2264E] text-white rounded-lg hover:bg-[#A31E42] transition-colors flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* ── Week cards + Monthly Avg ── */}
            <div className="flex gap-3 overflow-x-auto pb-1 mb-5">
              {weekCards.map((wk) => (
                <div key={wk.week}
                  className={`flex-1 min-w-[110px] rounded-2xl border p-3 flex flex-col gap-2 ${wk.total > 0 ? 'bg-white border-[#E6E6EC]' : 'bg-[#FAFAFD] border-[#F0F0F6] opacity-50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#0B0B14]">{wk.label}</span>
                    {wk.total > 0 && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: pctBg(wk.presentPct), color: pctColor(wk.presentPct) }}>
                        {wk.presentPct >= 75 ? 'Good' : wk.presentPct >= 50 ? 'Avg' : 'Low'}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-[#9CA0AE] -mt-1.5">{wk.dateRange}</p>
                  {wk.total > 0 ? (
                    <>
                      <div className="flex justify-center"><DonutRing pct={wk.presentPct} size={60} /></div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[9px]">
                          <span className="text-[#6B6B7B] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#0A8C5A] inline-block" />Present</span>
                          <span className="font-bold text-[#0A8C5A]">{wk.present}</span>
                        </div>
                        <div className="flex items-center justify-between text-[9px]">
                          <span className="text-[#6B6B7B] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#C2264E] inline-block" />Absent</span>
                          <span className="font-bold text-[#C2264E]">{wk.absent}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center flex-1 py-3 gap-1">
                      <svg className="w-4 h-4 text-[#C8C8D4]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <circle cx={12} cy={12} r={9} /><path d="M12 8v4m0 4h.01" />
                      </svg>
                      <p className="text-[9px] text-[#C8C8D4]">No data</p>
                    </div>
                  )}
                </div>
              ))}

              {/* Monthly Avg card */}
              <div className="flex-1 min-w-[110px] rounded-2xl border-2 border-[#4729F4] bg-gradient-to-b from-[#F8F6FF] to-[#EDE9FE] p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#4729F4]">Monthly</span>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[#EDE9FE] text-[#4729F4]">Avg</span>
                </div>
                <p className="text-[9px] text-[#9CA0AE] -mt-1.5">{weeksWithData.length} wk{weeksWithData.length !== 1 ? 's' : ''} data</p>
                {overallTotal > 0 ? (
                  <>
                    <div className="flex justify-center"><DonutRing pct={avgPresentPct} size={60} /></div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9px]">
                        <span className="text-[#6B6B7B] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#0A8C5A] inline-block" />Present</span>
                        <span className="font-bold text-[#0A8C5A]">{overallPresentPct}%</span>
                      </div>
                      <div className="flex items-center justify-between text-[9px]">
                        <span className="text-[#6B6B7B] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#C2264E] inline-block" />Absent</span>
                        <span className="font-bold text-[#C2264E]">{Math.round(100 - overallPresentPct)}%</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 py-3 gap-1">
                    <svg className="w-4 h-4 text-[#C8C8D4]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <circle cx={12} cy={12} r={9} /><path d="M12 8v4m0 4h.01" />
                    </svg>
                    <p className="text-[9px] text-[#C8C8D4]">No data yet</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              <div className="rounded-2xl border border-[#E6E6EC] bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[12px] font-semibold text-[#0B0B14]">Top Absent Reasons</p>
                    <p className="text-[10px] text-[#9CA0AE]">Ranked from attendance notes for the selected period.</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF0F3] text-[#C2264E]">
                    {insights.top_absent_reasons.length}
                  </span>
                </div>
                {insights.top_absent_reasons.length > 0 ? (
                  <div className="space-y-2">
                    {insights.top_absent_reasons.slice(0, 5).map((item, index) => (
                      <div key={`${item.reason}-${index}`} className="flex items-start justify-between gap-3 rounded-xl bg-[#FFF7F9] px-3 py-2">
                        <div>
                          <p className="text-[11px] font-medium text-[#3A3A4A]">{item.reason}</p>
                          <p className="text-[9px] text-[#9CA0AE]">Absent note pattern #{index + 1}</p>
                        </div>
                        <span className="text-[11px] font-bold text-[#C2264E]">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[#9CA0AE]">No absent-note insights for the selected filters.</p>
                )}
              </div>

              <div className="rounded-2xl border border-[#E6E6EC] bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[12px] font-semibold text-[#0B0B14]">Top Late Reasons</p>
                    <p className="text-[10px] text-[#9CA0AE]">Frequent late-arrival reasons captured during attendance.</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF8ED] text-[#B4721B]">
                    {insights.top_late_reasons.length}
                  </span>
                </div>
                {insights.top_late_reasons.length > 0 ? (
                  <div className="space-y-2">
                    {insights.top_late_reasons.slice(0, 5).map((item, index) => (
                      <div key={`${item.reason}-${index}`} className="flex items-start justify-between gap-3 rounded-xl bg-[#FFF9F1] px-3 py-2">
                        <div>
                          <p className="text-[11px] font-medium text-[#3A3A4A]">{item.reason}</p>
                          <p className="text-[9px] text-[#9CA0AE]">Late note pattern #{index + 1}</p>
                        </div>
                        <span className="text-[11px] font-bold text-[#B4721B]">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[#9CA0AE]">No late-note insights for the selected filters.</p>
                )}
              </div>
            </div>

            {/* ── Per-student summary table (class+section only) ── */}
            {active.classId && active.sectionId && reportRows.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA0AE] mb-2.5">Student Summary</p>
                <div className="overflow-x-auto rounded-xl border border-[#F0F0F6]">
                  <table className="w-full text-sm border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-[#FAFAFD]">
                        {['Student', 'Present', 'Absent', 'Late', 'Attendance %'].map((h, i) => (
                          <th key={h} className={`px-4 py-2.5 text-[10px] uppercase tracking-wide text-[#9CA0AE] font-semibold border-b border-[#F0F0F6] ${i === 0 ? 'text-left' : 'text-center'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows.map((row, idx) => {
                        const t = (row.present ?? 0) + (row.absent ?? 0) + (row.late ?? 0);
                        const pct = t > 0 ? Math.round(((row.present ?? 0) / t) * 100) : 0;
                        return (
                          <tr key={row.student_id ?? idx} className="border-t border-[#F0F0F6] hover:bg-[#FAFAFD] transition-colors">
                            <td className="px-4 py-2.5">
                              <p className="text-[12px] font-semibold text-[#0B0B14]">{row.name ?? '-'}</p>
                              {row.admission_no && <p className="text-[10px] text-[#9CA0AE]">{row.admission_no}</p>}
                            </td>
                            <td className="px-4 py-2.5 text-center"><span className="text-[12px] font-semibold text-[#0A8C5A]">{row.present ?? 0}</span></td>
                            <td className="px-4 py-2.5 text-center"><span className="text-[12px] font-semibold text-[#C2264E]">{row.absent ?? 0}</span></td>
                            <td className="px-4 py-2.5 text-center"><span className="text-[12px] font-semibold text-[#B4721B]">{row.late ?? 0}</span></td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ background: pctBg(pct), color: pctColor(pct) }}>{pct}%</span>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-[#E6E6EC] bg-[#FAFAFD]">
                        <td className="px-4 py-2.5 text-[11px] font-bold text-[#3A3A4A]">Total</td>
                        <td className="px-4 py-2.5 text-center text-[12px] font-bold text-[#0A8C5A]">{reportPresentTotal}</td>
                        <td className="px-4 py-2.5 text-center text-[12px] font-bold text-[#C2264E]">{reportAbsentTotal}</td>
                        <td className="px-4 py-2.5 text-center text-[12px] font-bold text-[#B4721B]">{reportLateTotal}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: pctBg(reportPct), color: pctColor(reportPct) }}>{reportPct}%</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* No data state */}
            {overallTotal === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-10 h-10 rounded-2xl bg-[#F8F6FF] flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-[#9CA0AE]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx={12} cy={12} r={10} /><path d="M12 8v4m0 4h.01" />
                  </svg>
                </div>
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
