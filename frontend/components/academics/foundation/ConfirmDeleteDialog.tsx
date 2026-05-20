"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect } from "react";

interface Props {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Eskoolia-style delete confirmation modal.
 * Shared by Foundation Setup panes (Academic Years, Classes, Sections, Rooms, Subjects).
 */
export default function ConfirmDeleteDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => !loading && onCancel()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        className="relative z-10 w-full max-w-[420px] rounded-2xl bg-white border border-[#E8ECEF] shadow-[0_10px_40px_rgba(0,0,0,0.18)] p-5"
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#FEE2E2] shrink-0">
            <AlertTriangle size={20} className="text-[#B91C1C]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              id="confirm-delete-title"
              className="text-[15px] font-bold text-[#1A1D1F] leading-tight"
            >
              {title}
            </h3>
            <p className="text-[12.5px] text-[#6F767E] mt-0.5">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="text-[13px] text-[#1A1D1F] leading-relaxed mb-5">
          {message}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-3.5 py-[7px] rounded-[10px] border border-[#E8ECEF] text-[13px] font-semibold text-[#6F767E] hover:bg-[#F0F2F5] transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[10px] bg-[#DC2626] text-white text-[13px] font-semibold hover:bg-[#B91C1C] transition-colors disabled:opacity-60"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
