'use client';

import React from 'react';
import type { LevelFilter } from '../types';

interface AttendanceFilterBarProps {
  academicYear: string;
  levelFilter: LevelFilter;
  onYearChange: (year: string) => void;
  onLevelChange: (level: LevelFilter) => void;
}

const ACADEMIC_YEARS = ['2025-26', '2024-25', '2023-24'];
const LEVELS: { value: LevelFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'primary', label: 'Primary' },
  { value: 'middle', label: 'Middle' },
  { value: 'secondary', label: 'Secondary' },
];

export default function AttendanceFilterBar({
  academicYear,
  levelFilter,
  onYearChange,
  onLevelChange,
}: AttendanceFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Academic year */}
      <div className="flex items-center gap-2">
        <label htmlFor="academic-year-select" className="text-sm font-medium text-[#6B6B80] whitespace-nowrap">
          Academic Year
        </label>
        <select
          id="academic-year-select"
          value={academicYear}
          onChange={(e) => onYearChange(e.target.value)}
          className="text-sm border border-[#E6E6EC] rounded-lg px-3 py-1.5 bg-white text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4729F4]"
        >
          {ACADEMIC_YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Level filter pills */}
      <div className="flex gap-1.5">
        {LEVELS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onLevelChange(value)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              levelFilter === value
                ? 'bg-[#4729F4] text-white'
                : 'bg-white border border-[#E6E6EC] text-[#6B6B80] hover:bg-[#F5F5FA]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
