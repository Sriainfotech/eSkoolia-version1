'use client';

import React from 'react';

export type StatusFilter = 'all' | 'pending' | 'promote' | 'not_promoted';
export type ClassOption = { key: string; classLabel: string };
export type SectionOption = { key: string; label: string };

interface Props {
  classOptions: ClassOption[];
  sectionOptions: SectionOption[];
  classKey: string;
  sectionKey: string;
  status: StatusFilter;
  search: string;
  onClassChange: (key: string) => void;
  onSectionChange: (key: string) => void;
  onStatusChange: (s: StatusFilter) => void;
  onSearchChange: (s: string) => void;
  onSearchSubmit: () => void;
  onReset: () => void;
}

const STATUS_PILLS: { value: StatusFilter; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'pending',      label: 'Pending' },
  { value: 'promote',      label: 'Promote' },
  { value: 'not_promoted', label: 'Not Promoted' },
];

export default function PromoteSmartFilter({
  classOptions,
  sectionOptions,
  classKey,
  sectionKey,
  status,
  search,
  onClassChange,
  onSectionChange,
  onStatusChange,
  onSearchChange,
  onSearchSubmit,
  onReset,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Class */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-[#6B6B80] whitespace-nowrap">Class</label>
        <select
          value={classKey}
          onChange={(e) => onClassChange(e.target.value)}
          className="text-sm border border-[#E6E6EC] rounded-lg px-3 py-1.5 bg-white text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4729F4]"
        >
          <option value="all">All classes</option>
          {classOptions.map((c) => (
            <option key={c.key} value={c.key}>{c.classLabel}</option>
          ))}
        </select>
      </div>

      {/* Section */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-[#6B6B80] whitespace-nowrap">Section</label>
        <select
          value={sectionKey}
          onChange={(e) => onSectionChange(e.target.value)}
          disabled={sectionOptions.length === 0}
          className="text-sm border border-[#E6E6EC] rounded-lg px-3 py-1.5 bg-white text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4729F4] disabled:bg-[#F4F4F8] disabled:text-[#9CA0AE]"
        >
          <option value="all">All sections</option>
          {sectionOptions.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Status pills */}
      <div className="flex gap-1.5">
        {STATUS_PILLS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onStatusChange(value)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              status === value
                ? 'bg-[#4729F4] text-white'
                : 'bg-white border border-[#E6E6EC] text-[#6B6B80] hover:bg-[#F5F5FA]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
        <div className="relative flex-1">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA0AE]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearchSubmit(); }}
            placeholder="Search student name or admission no…"
            className="w-full text-sm border border-[#E6E6EC] rounded-lg pl-8 pr-3 py-1.5 bg-white text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4729F4]"
          />
        </div>
        <button
          onClick={onSearchSubmit}
          className="bg-[#4729F4] text-white h-9 px-4 text-sm font-semibold rounded-lg cursor-pointer hover:bg-[#3a21d4] transition-colors"
        >
          Search
        </button>
        <button
          onClick={onReset}
          className="bg-white border border-[#E6E6EC] h-9 px-3 text-sm font-medium text-[#3A3A4A] rounded-lg cursor-pointer hover:bg-[#F4F4F8] transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
