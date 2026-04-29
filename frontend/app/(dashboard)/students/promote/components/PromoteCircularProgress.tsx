'use client';

import React from 'react';

interface Props {
  promoted: number;
  total: number;
  size?: number;
}

export default function PromoteCircularProgress({ promoted, total, size = 34 }: Props) {
  const pct = total > 0 ? Math.round((promoted / total) * 100) : 0;
  const r = (size / 2) - 3;
  const circ = 2 * Math.PI * r;
  const filled = (circ * pct) / 100;
  const color = pct >= 80 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626';

  return (
    <div className="flex items-center flex-shrink-0" title={`${promoted}/${total} promoted`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={3} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={3}
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
          fontSize={9}
          fontWeight={800}
          style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px` }}
        >
          {pct}%
        </text>
      </svg>
    </div>
  );
}
