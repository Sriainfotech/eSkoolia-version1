'use client';

import React from 'react';
import type { PromotionKpi } from '@/lib/promotion-api';

interface Props {
  kpi: PromotionKpi;
  targetYearName: string;
  onConfirm: () => void;
  onCancel: () => void;
  submitting?: boolean;
}

export default function ConfirmBatchModal({ kpi, targetYearName, onConfirm, onCancel, submitting }: Props) {
  const canConfirm = kpi.pending === 0;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#F0F0F6]">
          <h3 className="text-[16px] font-bold text-[#0B0B14] m-0">Confirm &amp; Promote</h3>
          <p className="text-[12px] text-[#6B6B7B] mt-1 m-0">
            Promote students to <strong>{targetYearName}</strong>. This will commit all decisions.
          </p>
        </div>
        <div className="px-6 py-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-[#E6E6EC] p-3 text-center">
            <div className="text-2xl font-bold text-[#16A34A]">{kpi.promoted}</div>
            <div className="text-[10px] uppercase tracking-wide text-[#6B6B7B] mt-1">Promote</div>
          </div>
          <div className="rounded-lg border border-[#E6E6EC] p-3 text-center">
            <div className="text-2xl font-bold text-[#DC2626]">{kpi.not_promoted}</div>
            <div className="text-[10px] uppercase tracking-wide text-[#6B6B7B] mt-1">Not Promoted</div>
          </div>
          <div className="rounded-lg border border-[#E6E6EC] p-3 text-center">
            <div className="text-2xl font-bold text-[#D97706]">{kpi.pending}</div>
            <div className="text-[10px] uppercase tracking-wide text-[#6B6B7B] mt-1">Pending</div>
          </div>
        </div>
        {!canConfirm && (
          <div className="mx-6 mb-3 p-2 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[11px] text-[#92400E]">
            Resolve all pending decisions before confirming.
          </div>
        )}
        <div className="flex items-center justify-end gap-2 px-6 py-3 bg-[#FAFAFD] border-t border-[#F0F0F6]">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="h-9 px-4 text-[12px] font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg hover:bg-[#F4F4F8] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting || !canConfirm}
            className="h-9 px-5 text-[12px] font-bold text-white bg-[#4729F4] rounded-lg hover:bg-[#3a21d4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Confirming…' : '✓ Confirm & Promote'}
          </button>
        </div>
      </div>
    </div>
  );
}
