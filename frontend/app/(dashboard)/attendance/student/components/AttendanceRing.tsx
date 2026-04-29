'use client';
import React from 'react';
import { ringColor } from '../utils/attendanceHelpers';

interface Props {
  pct: number;
  size?: number;
  strokeWidth?: number;
}

export default function AttendanceRing({ pct, size = 34, strokeWidth = 3 }: Props) {
  const r = (size / 2) - strokeWidth;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct === 0 ? '#D8D8E4' : ringColor(pct);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#F0F0F6"
          strokeWidth={strokeWidth}
        />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-[#0B0B14]">
        {pct === 0 ? '—' : `${pct}%`}
      </span>
    </div>
  );
}
