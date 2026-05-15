'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { paginationWindow } from '@/lib/login-permission/utils';

interface Props {
  page: number;
  totalPages: number;
  pageSize: number;
  filteredCount: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (ps: number) => void;
}

const PAGE_SIZES = [25, 50, 100];

export function Pagination({
  page,
  totalPages,
  pageSize,
  filteredCount,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const window = paginationWindow(page, totalPages);
  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, filteredCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pb-4">
      {/* Left: rows per page + info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-[var(--ink-2,#475569)]">
          <span>Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 px-2 rounded-lg border border-[var(--bd,#dbe4f0)] bg-[var(--bg-1,#fff)] text-sm text-[var(--ink-1,#0f172a)] outline-none focus:ring-2 focus:ring-[var(--pu,#3b5bdb)]"
          >
            {PAGE_SIZES.map((ps) => (
              <option key={ps} value={ps}>
                {ps}
              </option>
            ))}
          </select>
        </div>
        <span className="text-sm text-[var(--ink-3,#64748b)]">
          {start.toLocaleString()}–{end.toLocaleString()} of{' '}
          {filteredCount.toLocaleString()}
        </span>
      </div>

      {/* Right: page buttons */}
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--bd,#dbe4f0)] text-[var(--ink-2,#475569)] hover:bg-[var(--bg-0,#f8fafc)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={15} />
        </button>

        {window.map((item, idx) =>
          item === '...' ? (
            <span
              key={`ellipsis-${idx}`}
              className="w-8 text-center text-sm text-[var(--ink-3,#64748b)]"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item as number)}
              className={[
                'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                item === page
                  ? 'bg-[var(--pu,#3b5bdb)] text-white'
                  : 'border border-[var(--bd,#dbe4f0)] text-[var(--ink-2,#475569)] hover:bg-[var(--bg-0,#f8fafc)]',
              ].join(' ')}
            >
              {item}
            </button>
          )
        )}

        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--bd,#dbe4f0)] text-[var(--ink-2,#475569)] hover:bg-[var(--bg-0,#f8fafc)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
