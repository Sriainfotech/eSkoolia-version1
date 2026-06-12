'use client';

import { Filter, RotateCcw, Search as SearchIcon, Download } from 'lucide-react';
import type { Role, RoleOption, StatusFilter, ClassOption, SectionOption } from '@/lib/login-permission/types';

const STATUS_PILLS: { value: StatusFilter; label: string; dot?: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'active',   label: 'Active',         dot: 'bg-emerald-500' },
  { value: 'inactive', label: 'Disabled',        dot: 'bg-red-400'    },
  { value: 'new',      label: 'Never logged in', dot: 'bg-amber-400'  },
];

const INPUT_CLS = [
  'w-full h-10 px-3 rounded-lg border border-[var(--bd,#dbe4f0)]',
  'bg-white text-sm text-[var(--ink-1,#0f172a)] outline-none',
  'focus:ring-2 focus:ring-[var(--pu,#6D4AFF)] focus:border-[var(--pu,#6D4AFF)]',
  'placeholder:text-[var(--ink-3,#94a3b8)]',
].join(' ');

const LABEL_CLS =
  'block text-[10px] font-semibold tracking-widest text-[var(--ink-3,#64748b)] uppercase mb-1.5';

interface Props {
  role: Role | '';
  onRoleChange: (r: Role) => void;
  roleOptions: RoleOption[];
  isStudentRole: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  status: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  classFilter: string;
  onClassFilterChange: (v: string) => void;
  sectionFilter: string;
  onSectionFilterChange: (v: string) => void;
  classOptions: ClassOption[];
  sectionOptions: SectionOption[];
  onSearch: () => void;
  onReset: () => void;
  onExport?: () => void;
}

export function FilterBar({
  role,
  onRoleChange,
  roleOptions,
  isStudentRole,
  search,
  onSearchChange,
  status,
  onStatusChange,
  classFilter,
  onClassFilterChange,
  sectionFilter,
  onSectionFilterChange,
  classOptions,
  sectionOptions,
  onSearch,
  onReset,
  onExport,
}: Props) {
  const isDirty =
    search !== '' || status !== 'all' || classFilter !== '' || sectionFilter !== '';

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onSearch();
  }

  const showSubRole = roleOptions.length > 1;

  return (
    <div className="rounded-xl border border-[var(--bd,#dbe4f0)] bg-white px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[var(--pu-soft,#EEEAFF)] shrink-0">
          <Filter size={12} className="text-[var(--pu,#6D4AFF)]" />
        </div>
        <p className="text-xs font-semibold text-[var(--ink-2,#475569)]">
          Filter Users
          <span className="font-normal text-[var(--ink-3,#64748b)] ml-1.5">
            — narrow by {showSubRole ? 'sub-role, ' : ''}name, email, or status
          </span>
        </p>
      </div>

      <div className={`grid gap-3 ${showSubRole ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {/* Sub-role selector — only when tab has multiple roles */}
        {showSubRole && (
          <div>
            <label className={LABEL_CLS}>Role</label>
            <select
              value={role}
              onChange={(e) => onRoleChange(e.target.value as Role)}
              className={INPUT_CLS}
            >
              {roleOptions.map((r) => (
                <option key={r.id} value={r.name.toLowerCase()}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search */}
        <div>
          <label className={LABEL_CLS}>Search</label>
          <div className="relative">
            <SearchIcon
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3,#94a3b8)] pointer-events-none"
            />
            <input
              type="text"
              placeholder="Name, email, or ID…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleKey}
              className={INPUT_CLS + ' pl-8'}
            />
          </div>
        </div>

        {/* Login Status */}
        <div>
          <label className={LABEL_CLS}>Login Status</label>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
            className={INPUT_CLS}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Disabled</option>
            <option value="new">Never logged in</option>
          </select>
        </div>
      </div>

      {/* Student-only: Class & Section filters */}
      {isStudentRole && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLS}>Class</label>
            <select
              value={classFilter}
              onChange={(e) => onClassFilterChange(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="">All Classes</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Section</label>
            <select
              value={sectionFilter}
              onChange={(e) => onSectionFilterChange(e.target.value)}
              className={INPUT_CLS}
              disabled={!classFilter}
            >
              <option value="">All Sections</option>
              {sectionOptions
                .filter((s) => !classFilter || s.classId === classFilter)
                .map((s) => (
                  <option key={s.id} value={s.id}>Section {s.name}</option>
                ))}
            </select>
          </div>
        </div>
      )}

      {/* Status pills + action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_PILLS.map((t) => (
          <button
            key={t.value}
            onClick={() => onStatusChange(t.value)}
            className={[
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors',
              status === t.value
                ? 'bg-[var(--pu,#6D4AFF)] text-white'
                : 'border border-[var(--bd,#dbe4f0)] text-[var(--ink-2,#475569)] hover:border-[var(--pu,#6D4AFF)] hover:text-[var(--pu,#6D4AFF)]',
            ].join(' ')}
          >
            {t.dot && (
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.dot} ${status === t.value ? 'opacity-0' : ''}`}
              />
            )}
            {t.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {onExport && role && (
            <button
              onClick={onExport}
              className="h-9 px-3 rounded-lg text-sm text-[var(--ink-2,#475569)] border border-[var(--bd,#dbe4f0)] hover:bg-[var(--bg-0,#f8fafc)] transition-colors flex items-center gap-1.5"
            >
              <Download size={13} />
              Export
            </button>
          )}

          {isDirty && (
            <button
              onClick={onReset}
              className="h-9 px-4 rounded-lg text-sm font-medium text-[var(--ink-2,#475569)] border border-[var(--bd,#dbe4f0)] hover:bg-[var(--bg-0,#f8fafc)] transition-colors flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          )}

          <button
            onClick={onSearch}
            className="h-9 px-5 rounded-lg text-sm font-semibold text-white transition-opacity flex items-center gap-1.5"
            style={{ background: 'var(--pu,#6D4AFF)' }}
          >
            <SearchIcon size={13} />
            Search
          </button>
        </div>
      </div>
    </div>
  );
}
