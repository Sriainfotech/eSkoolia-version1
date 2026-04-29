'use client';

import React from 'react';

interface Props {
  promoted: number;
  total: number;
  size?: number;
}

export default function PromoteCircularProgress({ promoted, total, size = 44 }: Props) {
  const pct = total > 0 ? Math.round((promoted / total) * 100) : 0;
  const r = (size / 2) - 4;
  const circ = 2 * Math.PI * r;
  const filled = (circ * pct) / 100;
  const color = pct >= 80 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626';

  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={3.5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray={`${filled.toFixed(1)} ${(circ - filled).toFixed(1)}`}
          style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s' }}
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize={size < 44 ? 8 : 9}
          fontWeight={800}
          style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px` }}
        >
          {pct}%
        </text>
      </svg>
      <span className="text-[10px] font-bold" style={{ color }}>
        {promoted}/{total}
      </span>
      <span className="text-[9px] text-[#9CA0AE]">promoted</span>
    </div>
  );
}
