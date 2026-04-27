'use client';

import React from 'react';

interface AttendanceAlertProps {
  count: number;
}

export default function AttendanceAlert({ count }: AttendanceAlertProps) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-xl bg-[#FFF4E5] border border-[#F5A623]">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M9 1.5L1.5 15h15L9 1.5z" stroke="#F5A623" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M9 7v4M9 12.5v.5" stroke="#F5A623" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="text-sm text-[#8B5E08] font-medium">
        {count} student{count > 1 ? 's are' : ' is'} at risk of missing RTE attendance threshold.
      </span>
    </div>
  );
}
