'use client';
import React, { useEffect, useState } from 'react';

export type ConfirmTone = 'info' | 'warn' | 'danger' | 'success';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  // When defined the dialog renders a textarea for an optional note.
  // The submitted value is passed as the 2nd arg of the resolved promise.
  noteLabel?: string;
  notePlaceholder?: string;
  noteRequired?: boolean;
  initialNote?: string;
  hideCancel?: boolean;
}

interface DialogState extends ConfirmDialogOptions {
  resolve: (result: { ok: boolean; note?: string }) => void;
}

let openDialog: ((opts: ConfirmDialogOptions) => Promise<{ ok: boolean; note?: string }>) | null = null;

export function confirmDialog(opts: ConfirmDialogOptions): Promise<{ ok: boolean; note?: string }> {
  if (!openDialog) {
    if (typeof window === 'undefined') return Promise.resolve({ ok: false });
    // Fallback to native confirm so we never block silently.
    const ok = window.confirm(`${opts.title}\n\n${opts.message}`);
    return Promise.resolve({ ok });
  }
  return openDialog(opts);
}

const TONE_STYLE: Record<ConfirmTone, { ring: string; iconBg: string; iconColor: string; confirmBg: string; confirmHover: string }> = {
  info:    { ring: 'border-[#C5BEFF]', iconBg: 'bg-[#EDE9FE]', iconColor: 'text-[#5B21B6]', confirmBg: 'bg-[#4729F4]', confirmHover: 'hover:bg-[#3a21d4]' },
  warn:    { ring: 'border-[#F4DCA7]', iconBg: 'bg-[#FDF1DC]', iconColor: 'text-[#B4721B]', confirmBg: 'bg-[#B4721B]', confirmHover: 'hover:bg-[#975e14]' },
  danger:  { ring: 'border-[#F9A8B4]', iconBg: 'bg-[#FCE8EE]', iconColor: 'text-[#C2264E]', confirmBg: 'bg-[#C2264E]', confirmHover: 'hover:bg-[#a81e40]' },
  success: { ring: 'border-[#A7E3C2]', iconBg: 'bg-[#E4F6ED]', iconColor: 'text-[#0A8C5A]', confirmBg: 'bg-[#0A8C5A]', confirmHover: 'hover:bg-[#087a4f]' },
};

export default function ConfirmDialogHost() {
  const [state, setState] = useState<DialogState | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    openDialog = (opts) =>
      new Promise((resolve) => {
        setNote(opts.initialNote ?? '');
        setState({ ...opts, resolve });
      });
    return () => { openDialog = null; };
  }, []);

  if (!state) return null;
  const tone = TONE_STYLE[state.tone ?? 'info'];

  const close = (ok: boolean) => {
    const trimmed = note.trim();
    if (ok && state.noteLabel && state.noteRequired && !trimmed) return;
    state.resolve({ ok, note: state.noteLabel ? trimmed : undefined });
    setState(null);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      onClick={() => close(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-white rounded-2xl shadow-2xl w-[440px] max-w-full overflow-hidden border ${tone.ring}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <span className={`w-9 h-9 shrink-0 rounded-full ${tone.iconBg} flex items-center justify-center`}>
              <svg className={`w-5 h-5 ${tone.iconColor}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx={12} cy={12} r={10} />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-semibold text-[#0B0B14] m-0 leading-snug">{state.title}</h3>
              <p className="text-[13px] text-[#4B4B5A] mt-1.5 m-0 leading-relaxed whitespace-pre-line">{state.message}</p>
            </div>
          </div>
          {state.noteLabel && (
            <div className="mt-4">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#9CA0AE] mb-1.5">
                {state.noteLabel}{state.noteRequired ? ' *' : ' (optional)'}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={state.notePlaceholder ?? ''}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-[#E6E6EC] text-[13px] text-[#0B0B14] placeholder:text-[#9CA0AE] outline-none focus:border-[#4729F4] resize-none"
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-3 bg-[#FAFAFD] border-t border-[#F0F0F6]">
          {!state.hideCancel && (
            <button
              type="button"
              onClick={() => close(false)}
              className="h-9 px-4 text-[12px] font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg hover:bg-[#F4F4F8] transition-colors"
            >
              {state.cancelLabel ?? 'Cancel'}
            </button>
          )}
          <button
            type="button"
            onClick={() => close(true)}
            disabled={!!(state.noteLabel && state.noteRequired && !note.trim())}
            className={`h-9 px-4 text-[12px] font-semibold text-white ${tone.confirmBg} ${tone.confirmHover} rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {state.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
