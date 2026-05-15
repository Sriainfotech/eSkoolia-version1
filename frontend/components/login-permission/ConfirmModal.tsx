'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import type { BulkAction, BulkTarget } from '@/lib/login-permission/types';

interface Props {
  open: boolean;
  action: BulkAction;
  target: BulkTarget;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const MESSAGES: Record<BulkAction, { title: string; desc: (n: number, all: boolean) => string; confirm: string; variant: 'danger' | 'warning' | 'primary' }> = {
  enable: {
    title:   'Enable Login Access',
    desc:    (n, all) => `You are about to enable login access for ${all ? 'all matching' : n.toLocaleString()} user${n !== 1 ? 's' : ''}. They will be able to sign in immediately.`,
    confirm: 'Enable',
    variant: 'primary',
  },
  disable: {
    title:   'Disable Login Access',
    desc:    (n, all) => `You are about to disable login access for ${all ? 'all matching' : n.toLocaleString()} user${n !== 1 ? 's' : ''}. They will not be able to sign in until re-enabled.`,
    confirm: 'Disable',
    variant: 'danger',
  },
  reset: {
    title:   'Reset Passwords',
    desc:    (n, all) => `You are about to force-reset passwords for ${all ? 'all matching' : n.toLocaleString()} user${n !== 1 ? 's' : ''}. Each user will receive a temporary password by email and must change it on next login.`,
    confirm: 'Reset Passwords',
    variant: 'warning',
  },
};

export function ConfirmModal({
  open,
  action,
  target,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  const { title, desc, confirm, variant } = MESSAGES[action];
  const count = target.allMatching ? target.filteredCount : target.ids.length;

  const confirmCls = {
    primary: 'bg-[var(--pu,#3b5bdb)] hover:opacity-90 text-white',
    danger:  'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
  }[variant];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--bg-1,#fff)] border border-[var(--bd,#dbe4f0)] shadow-2xl p-6 animate-[fadeIn_.15s_ease]">
        {/* Icon */}
        <div
          className={[
            'w-12 h-12 rounded-xl flex items-center justify-center mb-4',
            variant === 'danger'  ? 'bg-red-50'   : '',
            variant === 'warning' ? 'bg-amber-50'  : '',
            variant === 'primary' ? 'bg-[var(--pu-soft,#e0eaff)]' : '',
          ].join(' ')}
        >
          <AlertTriangle
            size={22}
            className={
              variant === 'danger'
                ? 'text-red-600'
                : variant === 'warning'
                ? 'text-amber-500'
                : 'text-[var(--pu,#3b5bdb)]'
            }
          />
        </div>

        <h2 className="text-lg font-semibold text-[var(--ink-1,#0f172a)] mb-2">
          {title}
        </h2>
        <p className="text-sm text-[var(--ink-2,#475569)] leading-relaxed mb-6">
          {desc(count, target.allMatching)}
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-[var(--bd,#dbe4f0)] text-sm font-medium text-[var(--ink-2,#475569)] hover:bg-[var(--bg-0,#f8fafc)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-opacity flex items-center gap-2 disabled:opacity-60 ${confirmCls}`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
