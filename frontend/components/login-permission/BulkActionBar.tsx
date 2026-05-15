'use client';

import { CheckCheck, ShieldOff, KeyRound, X } from 'lucide-react';
import type { BulkAction } from '@/lib/login-permission/types';

interface Props {
  selectedCount: number;
  onEnable: () => void;
  onDisable: () => void;
  onReset: () => void;
  onClear: () => void;
}

export function BulkActionBar({
  selectedCount,
  onEnable,
  onDisable,
  onReset,
  onClear,
}: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] flex justify-center pb-4 pointer-events-none">
      <div
        className={[
          'pointer-events-auto flex items-center gap-3 px-5 py-3',
          'rounded-2xl shadow-2xl border border-[var(--bd,#dbe4f0)]',
          'bg-[var(--bg-1,#fff)] text-sm',
          'animate-[fadeIn_.15s_ease]',
        ].join(' ')}
      >
        {/* Count badge */}
        <div className="flex items-center gap-1.5 font-semibold text-[var(--ink-1,#0f172a)]">
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
            style={{ background: 'var(--pu,#3b5bdb)' }}
          >
            {selectedCount.toLocaleString()}
          </span>
          selected
        </div>

        <span className="w-px h-5 bg-[var(--bd,#dbe4f0)]" />

        <button
          onClick={onEnable}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-medium transition-colors"
        >
          <CheckCheck size={14} />
          Enable All
        </button>

        <button
          onClick={onDisable}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 font-medium transition-colors"
        >
          <ShieldOff size={14} />
          Disable All
        </button>

        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 font-medium transition-colors"
        >
          <KeyRound size={14} />
          Reset Passwords
        </button>

        <span className="w-px h-5 bg-[var(--bd,#dbe4f0)]" />

        <button
          onClick={onClear}
          title="Clear selection"
          className="p-1.5 rounded-lg text-[var(--ink-3,#64748b)] hover:bg-[var(--bg-0,#f8fafc)] transition-colors"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
