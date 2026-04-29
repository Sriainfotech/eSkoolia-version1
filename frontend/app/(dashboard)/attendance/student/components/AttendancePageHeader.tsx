'use client';

import React from 'react';

interface AttendancePageHeaderProps {
  onImport: () => void;
  onExport: () => void;
  onDownloadSample: () => void;
}

export default function AttendancePageHeader({ onImport, onExport, onDownloadSample }: AttendancePageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
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
            Attendance
          </span>
        </h1>
        <p className="text-sm text-[#6B6B80] mt-0.5">Track and manage daily student attendance</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onDownloadSample}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E6E6EC] bg-white text-sm font-medium text-[#1A1A2E] hover:bg-[#F5F5FA] transition"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M7.5 1v7m0 0L4.5 5m3 3L10.5 5M2 12h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download Sample
        </button>
        <button
          onClick={onImport}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E6E6EC] bg-white text-sm font-medium text-[#1A1A2E] hover:bg-[#F5F5FA] transition"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M7.5 1v9m0 0L4.5 7m3 3L10.5 7M2 12h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Import
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E6E6EC] bg-white text-sm font-medium text-[#1A1A2E] hover:bg-[#F5F5FA] transition"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M7.5 10V1m0 0L4.5 4m3-3L10.5 4M2 12h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Export
        </button>
      </div>
    </div>
  );
}
