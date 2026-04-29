'use client';

import React from 'react';

export type AcademicYearOption = { id: number; name: string };

interface Props {
  fromYears: AcademicYearOption[];
  toYears: AcademicYearOption[];
  fromYearId: string;
  toYearId: string;
  onFromYearChange: (id: string) => void;
  onToYearChange: (id: string) => void;
  onLoad: () => void;
  loading?: boolean;
  totalStudents?: number;
}

export default function PromoteHeader({
  fromYears,
  toYears,
  fromYearId,
  toYearId,
  onFromYearChange,
  onToYearChange,
  onLoad,
  loading = false,
  totalStudents,
}: Props) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
      <div className="min-w-0">
        <h1
          style={{
            margin: 0,
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: '50px',
            fontWeight: 500,
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            color: '#181817',
          }}
        >
          Student{' '}
          <span
            style={{
              color: '#5b3df5',
              fontFamily: '"Playfair Display", Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 600,
            }}
          >
            Promote
          </span>
        </h1>
        <p className="text-sm text-[#6B6B80] mt-0.5">
          Manage year-end promotions
          {typeof totalStudents === 'number' ? ` · ${totalStudents} students` : ''}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-[#6B6B80] whitespace-nowrap">From</label>
          <select
            value={fromYearId}
            onChange={(e) => onFromYearChange(e.target.value)}
            className="text-sm border border-[#E6E6EC] rounded-lg px-3 py-1.5 bg-white text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4729F4]"
          >
            <option value="">Select year</option>
            {fromYears.map((y) => (
              <option key={y.id} value={String(y.id)}>{y.name}</option>
            ))}
          </select>
        </div>

        <svg className="w-4 h-4 text-[#9CA0AE]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6" />
        </svg>

        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-[#6B6B80] whitespace-nowrap">To</label>
          <select
            value={toYearId}
            onChange={(e) => onToYearChange(e.target.value)}
            className="text-sm border border-[#E6E6EC] rounded-lg px-3 py-1.5 bg-white text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4729F4]"
          >
            <option value="">Select year</option>
            {toYears.map((y) => (
              <option key={y.id} value={String(y.id)}>{y.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={onLoad}
          disabled={loading || !fromYearId || !toYearId}
          className="bg-[#4729F4] text-white h-9 px-4 text-sm font-semibold rounded-lg cursor-pointer hover:bg-[#3a21d4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading…' : 'Load batch'}
        </button>
      </div>
    </div>
  );
}
