'use client';

import React, { useState } from 'react';

interface Props {
  selectedCount: number;
  totalRecords: number;
  isReadOnly?: boolean;
  onPromoteAll: () => void;
  onNotPromotedAll: () => void;
  onReset: () => void;
}

export default function BulkActionFooter({
  selectedCount,
  totalRecords,
  isReadOnly = false,
  onPromoteAll,
  onNotPromotedAll,
  onReset,
}: Props) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const scope = selectedCount > 0 ? `${selectedCount} selected` : `all ${totalRecords} students`;

  return (
    <div className="group/footer px-5 py-2.5 border-t border-[#F1F1F5] bg-[#FAFAFD] flex items-center justify-between flex-wrap gap-2 transition-colors hover:bg-[#F4F4F8]">
      <div className="text-[11px] text-[#6B6B7B] font-medium">
        Bulk actions on <span className="font-semibold text-[#0B0B14]">{scope}</span>
      </div>

      {isReadOnly ? (
        <span className="flex items-center gap-1.5 text-[11px] text-[#9CA0AE] italic">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Read-only
        </span>
      ) : (
        <div className="flex items-center gap-2 opacity-70 group-hover/footer:opacity-100 transition-opacity">
          <button
            onClick={onPromoteAll}
            className="bg-[#E4F6ED] text-[#0A8C5A] h-8 px-3 text-[11px] font-semibold rounded-lg border border-[#0A8C5A]/20 cursor-pointer hover:bg-[#c8edd8] transition-colors"
          >
            ✓ Promote All
          </button>
          <button
            onClick={onNotPromotedAll}
            className="bg-[#FCE8EE] text-[#C2264E] h-8 px-3 text-[11px] font-semibold rounded-lg border border-[#C2264E]/20 cursor-pointer hover:bg-[#f8d4de] transition-colors"
          >
            ✗ Not Promoted All
          </button>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="bg-white border border-[#E6E6EC] h-8 px-3 text-[11px] font-semibold text-[#3A3A4A] rounded-lg cursor-pointer hover:bg-[#F4F4F8] transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-[360px] max-w-[90vw] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#F0F0F6]">
              <h3 className="text-[14px] font-semibold text-[#0B0B14] m-0">Reset decisions?</h3>
              <p className="text-[12px] text-[#6B6B7B] mt-1 m-0">
                All {scope} will be set back to <strong>Pending</strong>. Retention reasons will be cleared.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-[#FAFAFD]">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="h-8 px-3 text-[11px] font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg cursor-pointer hover:bg-[#F4F4F8] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowResetConfirm(false); onReset(); }}
                className="h-8 px-4 text-[11px] font-semibold text-white bg-[#C2264E] rounded-lg cursor-pointer hover:bg-[#a81e40] transition-colors"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
