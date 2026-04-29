'use client';
import React, { useState, useRef, useEffect } from 'react';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Props {
  selectedDate: string;
  onDateChange: (date: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  sectionFilter: string;
  onSectionFilterChange: (v: string) => void;
  onMarkAllVisible: (status: 'present' | 'absent' | 'late') => void;
  allVisibleMarked?: boolean;
}

function getWeekDates(centerDate: string): Date[] {
  const date = new Date(`${centerDate}T00:00:00`);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day === 0 ? 7 : day) - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day === 0 ? 7 : day) - 1));
  return d;
}

function monthOptions(selectedDate: string): Array<{ value: string; label: string }> {
  const base = new Date(selectedDate);
  const y = base.getFullYear();
  const opts: Array<{ value: string; label: string }> = [];
  for (let m = 0; m < 12; m += 1) {
    const d = new Date(y, m, 1);
    opts.push({ value: `${y}-${String(m + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) });
  }
  return opts;
}

function weekOptionsForMonth(monthValue: string): Array<{ value: string; label: string }> {
  const [yearText, monthText] = monthValue.split('-');
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const options: Array<{ value: string; label: string }> = [];
  let cursor = getMonday(firstDay);
  let idx = 1;

  while (cursor <= lastDay || cursor.getMonth() === month) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const inMonthStart = weekStart.getMonth() === month ? weekStart : firstDay;
    const inMonthEnd = weekEnd.getMonth() === month ? weekEnd : lastDay;

    options.push({
      value: fmt(weekStart),
      label: `Week ${idx} (${inMonthStart.getDate()}-${inMonthEnd.getDate()})`,
    });

    cursor.setDate(cursor.getDate() + 7);
    idx += 1;
    if (idx > 7) break;
  }

  return options;
}

export default function GlobalControls({
  selectedDate,
  onDateChange,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sectionFilter,
  onSectionFilterChange,
  onMarkAllVisible,
  allVisibleMarked = false,
}: Props) {
  const dateStrip = getWeekDates(selectedDate);
  const today = fmt(new Date());
  const todayDate = new Date();
  const selectedMonth = selectedDate.slice(0, 7);
  const months = monthOptions(selectedDate);
  const weeks = weekOptionsForMonth(selectedMonth);
  const selectedWeekStart = fmt(getMonday(new Date(`${selectedDate}T00:00:00`)));

  const [confirmAbsent, setConfirmAbsent] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); };
  }, []);

  const chipState = (d: Date): 'today' | 'done' | 'future' => {
    const ds = fmt(d);
    if (ds === today) return 'today';
    if (ds < today) return 'done';
    return 'future';
  };

  const chipClass = (state: ReturnType<typeof chipState>, isSelected: boolean, isToday: boolean) => {
    if (isSelected && isToday) {
      return 'bg-[#4729F4] text-white border border-[#4729F4] shadow-[0_0_0_1px_rgba(71,41,244,0.35)]';
    }
    if (isSelected && !isToday) {
      return 'bg-[#FFF4D6] text-[#9A5C00] border border-[#F4DCA7] ring-2 ring-[#F59E0B]/30';
    }
    if (state === 'today') {
      return 'bg-white text-[#4729F4] border-2 border-[#4729F4] font-semibold';
    }
    if (state === 'done') return 'bg-[#F6F4FF] text-[#4729F4] border border-[#4729F4]/20';
    return 'bg-white text-[#9CA0AE] border border-[#E6E6EC] hover:border-[#4729F4] hover:text-[#4729F4]';
  };

  const stripLabel = (() => {
    const first = dateStrip[0];
    const last = dateStrip[6];
    return `Week of ${first.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  })();

  const moveWeek = (direction: -1 | 1) => {
    const current = new Date(`${selectedDate}T00:00:00`);
    current.setDate(current.getDate() + direction * 7);
    onDateChange(fmt(current));
  };

  return (
    <div className="bg-white rounded-xl border border-[#E6E6EC] overflow-hidden mb-3">
      {/* Row 1 — Date strip */}
      <div className="flex items-center gap-1.5 px-5 py-2.5 bg-[#FAFAFD] border-b border-[#F0F0F6] overflow-x-auto">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap mr-1 flex-shrink-0">
          {stripLabel}:
        </span>
        <select
          value={selectedMonth}
          onChange={(e) => {
            const [yearText, monthText] = e.target.value.split('-');
            const nextDate = new Date(Number(yearText), Number(monthText) - 1, 1);
            onDateChange(fmt(nextDate));
          }}
          className="h-[30px] px-2 text-[11px] border border-[#E6E6EC] rounded-lg bg-white outline-none focus:border-[#4729F4] cursor-pointer"
          title="Choose month"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <button
          onClick={() => moveWeek(-1)}
          className="h-[30px] px-2 text-[11px] font-bold bg-white text-[#3A3A4A] rounded-lg border border-[#E6E6EC] cursor-pointer hover:bg-[#F4F4F8] transition-colors"
          title="Previous week"
        >
          ←
        </button>
        <select
          value={weeks.some((w) => w.value === selectedWeekStart) ? selectedWeekStart : (weeks[0]?.value ?? selectedDate)}
          onChange={(e) => onDateChange(e.target.value)}
          className="h-[30px] px-2 text-[11px] border border-[#E6E6EC] rounded-lg bg-white outline-none focus:border-[#4729F4] cursor-pointer"
          title="Choose calendar week"
        >
          {weeks.map((w) => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
        <button
          onClick={() => moveWeek(1)}
          className="h-[30px] px-2 text-[11px] font-bold bg-white text-[#3A3A4A] rounded-lg border border-[#E6E6EC] cursor-pointer hover:bg-[#F4F4F8] transition-colors"
          title="Next week"
        >
          →
        </button>
        <button
          onClick={() => onDateChange(today)}
          disabled={selectedDate === today}
          className="h-[30px] px-2.5 text-[11px] font-bold bg-[#E4F6ED] text-[#0A8C5A] rounded-lg border border-[#BDE9D0] cursor-pointer hover:bg-[#d2f0df] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Return to current date"
        >
          Today
        </button>
        {dateStrip.map((d) => {
          const ds = fmt(d);
          const state = chipState(d);
          const isSelected = ds === selectedDate;
          const isToday = d.getDate() === todayDate.getDate() && d.getMonth() === todayDate.getMonth() && d.getFullYear() === todayDate.getFullYear();
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <button
              key={ds}
              onClick={() => {
                if (isSelected) {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  onDateChange(ds);
                }
              }}
              title={isWeekend ? 'Weekend' : undefined}
              className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[46px] h-[38px] px-3 rounded-lg text-[11px] font-medium cursor-pointer border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${chipClass(state, isSelected, isToday)} ${isWeekend && !isSelected ? 'opacity-50' : ''}`}
            >
              <span className={`text-[9px] block mb-0.5 leading-none ${isToday ? 'opacity-95 font-semibold' : 'opacity-60'}`}>{DAY_NAMES[(d.getDay() + 6) % 7]}</span>
              <span className="text-[13px] font-semibold leading-none">{d.getDate()}</span>
              {isToday && (
                <span className={`text-[8px] font-bold tracking-wider uppercase block leading-none rounded px-1 py-px mt-1 ${isSelected ? 'text-white bg-white/20' : 'text-[#0A8C5A] bg-[#DDF5EA]'}`}>Today</span>
              )}
            </button>
          );
        })}
        <span className="ml-auto flex-shrink-0 flex items-center gap-1.5 text-[11px] text-[#8B8B9E] whitespace-nowrap">
          <span className="w-1.5 h-1.5 bg-[#0A8C5A] rounded-full animate-pulse inline-block" />
          Auto-saving
        </span>
      </div>

      {/* Row 2 — Search + filters */}
      <div className="flex items-center gap-2.5 px-5 py-2.5 bg-white overflow-x-auto">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA0AE] pointer-events-none"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <circle cx={11} cy={11} r={8} />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search students…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-9 pl-9 pr-8 text-[12px] border border-[#E6E6EC] rounded-lg bg-[#FAFAFD] focus:border-[#4729F4] focus:bg-white outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA0AE] hover:text-[#0B0B14] text-[16px] leading-none cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="h-9 px-2.5 text-[11px] border border-[#E6E6EC] rounded-lg bg-[#FAFAFD] flex-shrink-0 min-w-[120px] outline-none focus:border-[#4729F4] cursor-pointer"
        >
          <option value="all">All students</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="late">Late</option>
          <option value="unmarked">Unmarked</option>
        </select>

        {/* Section filter */}
        <select
          value={sectionFilter}
          onChange={(e) => onSectionFilterChange(e.target.value)}
          className="h-9 px-2.5 text-[11px] border border-[#E6E6EC] rounded-lg bg-[#FAFAFD] flex-shrink-0 min-w-[100px] outline-none focus:border-[#4729F4] cursor-pointer"
        >
          <option value="all">All sections</option>
          <option value="A">Section A</option>
          <option value="B">Section B</option>
          <option value="C">Section C</option>
        </select>

        {/* Mark all visible */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
          <span className="text-[10px] uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap font-bold">
            Mark all visible:
          </span>
          <button
            onClick={() => onMarkAllVisible('present')}
            disabled={allVisibleMarked}
            title={allVisibleMarked ? 'All visible students already marked' : 'Mark all visible present'}
            className="h-[30px] px-2.5 text-[11px] font-bold bg-[#E4F6ED] text-[#0A8C5A] rounded-lg border-none cursor-pointer hover:bg-[#0A8C5A] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#E4F6ED] disabled:hover:text-[#0A8C5A]"
          >
            P
          </button>
          <button
            onClick={() => {
              if (confirmAbsent) {
                onMarkAllVisible('absent');
                setConfirmAbsent(false);
                if (confirmTimer.current) clearTimeout(confirmTimer.current);
              } else {
                setConfirmAbsent(true);
                confirmTimer.current = setTimeout(() => setConfirmAbsent(false), 2000);
              }
            }}
            title="Click twice to confirm marking ALL students absent"
            className={`h-[30px] px-2.5 text-[11px] font-bold bg-[#FCE8EE] text-[#C2264E] rounded-lg border-none cursor-pointer hover:bg-[#C2264E] hover:text-white transition-colors ${confirmAbsent ? 'ring-2 ring-red-500 animate-pulse' : ''}`}
          >
            A
          </button>
          <button
            onClick={() => onMarkAllVisible('late')}
            className="h-[30px] px-2.5 text-[11px] font-bold bg-[#FDF1DC] text-[#B4721B] rounded-lg border-none cursor-pointer hover:bg-[#B4721B] hover:text-white transition-colors"
          >
            L
          </button>
        </div>
      </div>
    </div>
  );
}
