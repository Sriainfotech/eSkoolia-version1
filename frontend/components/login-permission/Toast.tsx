'use client';

import { useEffect } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';
import type { ToastItem } from '@/lib/login-permission/types';

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function Toast({ toasts, onDismiss }: Props) {
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => onDismiss(t.id), 4000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            'pointer-events-auto flex items-center gap-3 px-4 py-3',
            'rounded-xl shadow-xl text-sm font-medium text-white',
            'animate-[fadeIn_.2s_ease] min-w-[280px] max-w-[380px]',
            t.type === 'success' ? 'bg-emerald-600' : 'bg-red-600',
          ].join(' ')}
        >
          {t.type === 'success' ? (
            <CheckCircle2 size={16} className="shrink-0" />
          ) : (
            <XCircle size={16} className="shrink-0" />
          )}
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
