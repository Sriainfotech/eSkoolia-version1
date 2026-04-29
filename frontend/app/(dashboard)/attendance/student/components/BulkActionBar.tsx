'use client';
import React from 'react';

interface Props {
  count: number;
  onClear: () => void;
  onMarkAll: (status: 'present' | 'absent' | 'late') => void;
  onSignInAll: () => void;
  onSignOutAll?: () => void;
}

export default function BulkActionBar({ count, onClear, onMarkAll, onSignInAll, onSignOutAll }: Props) {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2.5 flex-wrap px-5 py-2 bg-[#0B0B14] min-h-[40px]">
      <span className="w-5 h-5 rounded-full bg-[#4729F4] text-white text-[10px] font-bold flex items-center justify-center px-1 flex-shrink-0">
        {count}
      </span>
      <span className="text-[12px] font-semibold text-white">selected</span>

      <div className="flex gap-1.5 ml-2.5">
        <button
          onClick={onSignInAll}
          className="h-[28px] px-3 text-[11px] font-bold rounded-lg bg-[#0A8C5A] border border-[#0A8C5A] text-white hover:opacity-90 transition-opacity cursor-pointer"
          title="Sign in selected students and mark them present"
        >
          Sign in & mark present
        </button>
        <button
          onClick={() => onMarkAll('absent')}
          className="h-[28px] px-3 text-[11px] font-bold rounded-lg bg-[#C2264E] border border-[#C2264E] text-white hover:opacity-90 transition-opacity cursor-pointer"
        >
          Mark absent
        </button>
        <button
          onClick={() => onMarkAll('late')}
          className="h-[28px] px-3 text-[11px] font-bold rounded-lg bg-[#B4721B] border border-[#B4721B] text-white hover:opacity-90 transition-opacity cursor-pointer"
        >
          Mark late
        </button>
        {onSignOutAll && (
          <button
            onClick={onSignOutAll}
            className="h-[28px] px-3 text-[11px] font-bold rounded-lg bg-transparent border border-white/30 text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Sign out selected students"
          >
            Sign out
          </button>
        )}
      </div>

      <button
        onClick={onClear}
        className="ml-auto text-white/40 hover:text-white text-[18px] leading-none w-6 h-6 flex items-center justify-center cursor-pointer bg-transparent border-none"
        aria-label="Clear selection"
      >
        ×
      </button>
    </div>
  );
}
