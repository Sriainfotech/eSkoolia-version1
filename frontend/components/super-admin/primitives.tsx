'use client';

import type { ReactNode } from 'react';

interface BaseProps {
  className?: string;
}

interface SectionWrapperProps extends BaseProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function SectionWrapper({ title, subtitle, actions, children, className = '' }: SectionWrapperProps) {
  return (
    <section className={`sa-panel sa-section px-6 py-5 sm:px-8 sm:py-7 ${className}`.trim()}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="sa-section-title text-xl font-semibold text-[var(--ink-1)] tracking-tight">{title}</h2>
          {subtitle ? <p className="mt-1 text-[15px] text-[var(--ink-2)]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

interface KpiCardProps extends BaseProps {
  label: string;
  value: string;
  trend?: string;
  footnote?: string;
}

export function KpiCard({ label, value, trend, footnote, className = '' }: KpiCardProps) {
  return (
    <article className={`sa-panel sa-kpi px-6 py-5 ${className}`.trim()}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.13em] text-[var(--ink-2)] mb-2">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="sa-kpi-value text-4xl text-[var(--ink-1)] leading-[1.1]">{value}</p>
        {trend ? <p className="text-xs font-semibold text-[var(--ok)]">{trend}</p> : null}
      </div>
      {footnote ? <p className="mt-3 text-[13px] text-[var(--ink-2)]">{footnote}</p> : null}
    </article>
  );
}

interface FilterOption {
  label: string;
  value: string;
}

interface FilterBarProps extends BaseProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  chips?: FilterOption[];
  activeChip?: string;
  onChipChange?: (value: string) => void;
  actions?: ReactNode;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  chips,
  activeChip,
  onChipChange,
  actions,
  className = '',
}: FilterBarProps) {
  return (
    <div className={`sa-panel sa-filterbar px-5 py-4 sm:px-7 sm:py-5 ${className}`.trim()}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          {typeof searchValue === 'string' ? (
            <input
              value={searchValue}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-xl border border-[var(--bd)] bg-white px-4 text-[15px] text-[var(--ink-1)] outline-none ring-0 transition focus:border-[var(--pu)] sm:max-w-sm"
            />
          ) : null}

          {chips && chips.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => {
                const active = chip.value === activeChip;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => onChipChange?.(chip.value)}
                    className={`sa-chip ${active ? 'sa-chip--active' : ''}`.trim()}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface TableShellProps<T> extends BaseProps {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
}

export function TableShell<T>({ columns, rows, rowKey, className = '' }: TableShellProps<T>) {
  return (
    <div className={`sa-panel sa-table overflow-hidden ${className}`.trim()}>
      <div className="overflow-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-[var(--bg-2)]">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`border-b border-[var(--bd)] px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-2)] ${column.className ?? ''}`.trim()}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={rowKey(row, index)} className="bg-white even:bg-[var(--bg-2)]/50">
                {columns.map((column) => (
                  <td key={column.key} className="border-b border-[var(--bd)] px-4 py-3 text-[15px] text-[var(--ink-1)]">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface PaginationBlockProps extends BaseProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function PaginationBlock({ page, pageSize, total, onPageChange, className = '' }: PaginationBlockProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className={`sa-panel sa-pagination flex flex-wrap items-center justify-between gap-4 px-6 py-4 sm:px-8 sm:py-5 ${className}`.trim()}>
      <p className="text-[15px] text-[var(--ink-2)]">
        Showing {start}-{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-[var(--bd)] px-4 py-2 text-[15px] text-[var(--ink-1)] disabled:opacity-40 hover:bg-[var(--bg-2)] transition"
        >
          Previous
        </button>
        <span className="text-[15px] font-medium text-[var(--ink-1)]">
          Page {page} / {pages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="rounded-lg border border-[var(--bd)] px-4 py-2 text-[15px] text-[var(--ink-1)] disabled:opacity-40 hover:bg-[var(--bg-2)] transition"
        >
          Next
        </button>
      </div>
    </div>
  );
}

interface StateCardProps extends BaseProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

function StateCard({ title, description, actionLabel, onAction, className = '' }: StateCardProps) {
  return (
    <div className={`sa-panel flex min-h-[180px] flex-col items-center justify-center p-6 text-center ${className}`.trim()}>
      <h3 className="text-base font-semibold text-[var(--ink-1)]">{title}</h3>
      <p className="mt-2 max-w-lg text-sm text-[var(--ink-2)]">{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-xl bg-[var(--pu)] px-4 py-2 text-sm font-semibold text-white"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

interface LoadingStateProps extends BaseProps {
  label?: string;
}

export function LoadingState({ label = 'Loading data...', className = '' }: LoadingStateProps) {
  return (
    <div className={`sa-panel flex min-h-[180px] items-center justify-center gap-3 p-6 ${className}`.trim()}>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--pu-soft)] border-t-[var(--pu)]" />
      <p className="text-sm text-[var(--ink-2)]">{label}</p>
    </div>
  );
}

interface ErrorStateProps extends BaseProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Unable to load this section',
  description = 'Please retry in a moment.',
  onRetry,
  className = '',
}: ErrorStateProps) {
  return <StateCard title={title} description={description} actionLabel={onRetry ? 'Retry' : undefined} onAction={onRetry} className={className} />;
}

interface EmptyStateProps extends BaseProps {
  title?: string;
  description?: string;
}

export function EmptyState({
  title = 'No records available',
  description = 'Update your filters or check back later.',
  className = '',
}: EmptyStateProps) {
  return <StateCard title={title} description={description} className={className} />;
}
