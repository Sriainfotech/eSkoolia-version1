'use client';

import { KeyRound, Clock } from 'lucide-react';
import { initials, formatDate } from '@/lib/login-permission/utils';
import type { LPUser, PageResult } from '@/lib/login-permission/types';

interface Props {
  result: PageResult | null;
  loading: boolean;
  selectedIds: Set<string>;
  allMatchingSelected: boolean;
  allPageSelected: boolean;
  showSelectAllBanner: boolean;
  role: string;
  onSelectPage: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectAllMatching: () => void;
  onToggleAccess: (id: string, value: boolean) => void;
  onOpenDrawer: (user: LPUser) => void;
}

/** Gradient avatar colours keyed by first letter */
const AVATAR_COLORS: Record<string, string> = {
  A: '#3b5bdb', B: '#7048e8', C: '#0ca678', D: '#e8590c',
  E: '#d6336c', F: '#1971c2', G: '#2f9e44', H: '#f76707',
  I: '#862e9c', J: '#364fc7', K: '#087f5b', L: '#a61e4d',
  M: '#c92a2a', N: '#5c7cfa', O: '#74c0fc', P: '#38d9a9',
  Q: '#e67700', R: '#5f3dc4', S: '#1864ab', T: '#099268',
  U: '#d9480f', V: '#495057', W: '#66a80f', X: '#0b7285',
  Y: '#6741d9', Z: '#e03131',
};

function avatarColor(name: string) {
  return AVATAR_COLORS[name[0]?.toUpperCase()] ?? '#3b5bdb';
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[var(--bd,#dbe4f0)]">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-[length:200%_100%] bg-gradient-to-r from-[var(--bd,#dbe4f0)] via-white to-[var(--bd,#dbe4f0)] animate-[shimmer_1.4s_ease-in-out_infinite]" />
        </td>
      ))}
    </tr>
  );
}

export function UsersTable({
  result,
  loading,
  selectedIds,
  allMatchingSelected,
  allPageSelected,
  showSelectAllBanner,
  role,
  onSelectPage,
  onSelectRow,
  onSelectAllMatching,
  onToggleAccess,
  onOpenDrawer,
}: Props) {
  if (!role) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-[var(--bd,#dbe4f0)] bg-[var(--bg-1,#fff)] text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--pu-soft,#e0eaff)] flex items-center justify-center mb-3">
          <KeyRound size={24} className="text-[var(--pu,#3b5bdb)]" />
        </div>
        <p className="font-semibold text-[var(--ink-1,#0f172a)]">
          Select a role to get started
        </p>
        <p className="text-sm text-[var(--ink-3,#64748b)] mt-1">
          Use the filter above to choose a user role.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--bd,#dbe4f0)] bg-[var(--bg-1,#fff)] overflow-hidden shadow-sm">
      {/* Select-all-matching banner */}
      {showSelectAllBanner && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--pu-soft,#e0eaff)] text-sm text-[var(--ink-1,#0f172a)] border-b border-[var(--bd,#dbe4f0)]">
          <span>
            All {result!.results.length} users on this page are selected.
          </span>
          <button
            onClick={onSelectAllMatching}
            className="font-semibold text-[var(--pu,#3b5bdb)] underline hover:no-underline"
          >
            Select all {result!.filteredCount.toLocaleString()} matching users
          </button>
        </div>
      )}

      {/* All-matching banner */}
      {allMatchingSelected && result && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--pu,#3b5bdb)] text-sm text-white border-b border-[var(--bd,#dbe4f0)]">
          All {result.filteredCount.toLocaleString()} matching users are
          selected.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--bd,#dbe4f0)] bg-[var(--bg-0,#f8fafc)]">
              <th className="w-10 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={(e) => onSelectPage(e.target.checked)}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink-2,#475569)]">
                User
              </th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink-2,#475569)]">
                Role / Class
              </th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink-2,#475569)]">
                Email
              </th>
              <th className="px-4 py-3 text-center font-semibold text-[var(--ink-2,#475569)]">
                Login Access
              </th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--ink-2,#475569)]">
                Last Login
              </th>
              <th className="px-4 py-3 text-center font-semibold text-[var(--ink-2,#475569)]">
                Credentials
              </th>
            </tr>
          </thead>

          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : result?.results.length === 0
              ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-[var(--ink-3,#64748b)]">
                    No users match the current filters.
                  </td>
                </tr>
              )
              : result?.results.map((user) => (
                <tr
                  key={user.id}
                  className={[
                    'border-b border-[var(--bd,#dbe4f0)] transition-colors',
                    selectedIds.has(user.id)
                      ? 'bg-[var(--pu-soft,#e0eaff)]'
                      : 'hover:bg-[var(--bg-0,#f8fafc)]',
                  ].join(' ')}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={(e) => onSelectRow(user.id, e.target.checked)}
                      className="rounded"
                    />
                  </td>

                  {/* Name + ID */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: avatarColor(user.name) }}
                      >
                        {initials(user.name)}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--ink-1,#0f172a)] leading-tight">
                          {user.name}
                        </p>
                        <p className="text-xs text-[var(--ink-3,#64748b)]">
                          {user.staffId}
                        </p>
                      </div>
                      {user.mustChange && (
                        <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">
                          Must change
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3 text-[var(--ink-2,#475569)]">
                    {user.role}
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3 text-[var(--ink-2,#475569)] max-w-[200px] truncate">
                    {user.email}
                  </td>

                  {/* Toggle */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() =>
                        onToggleAccess(user.id, !user.loginAccess)
                      }
                      className={[
                        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none',
                        user.loginAccess ? 'bg-emerald-500' : 'bg-[var(--bd,#dbe4f0)]',
                      ].join(' ')}
                      role="switch"
                      aria-checked={user.loginAccess}
                    >
                      <span
                        className={[
                          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                          user.loginAccess ? 'translate-x-4' : 'translate-x-0',
                        ].join(' ')}
                      />
                    </button>
                  </td>

                  {/* Last login */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {!user.lastLogin && (
                        <Clock size={12} className="text-amber-500 shrink-0" />
                      )}
                      <span
                        className={
                          !user.lastLogin
                            ? 'text-amber-600 text-xs font-medium'
                            : 'text-[var(--ink-2,#475569)]'
                        }
                      >
                        {formatDate(user.lastLogin)}
                      </span>
                    </div>
                  </td>

                  {/* Credentials */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onOpenDrawer(user)}
                      title="Manage credentials"
                      className="p-1.5 rounded-lg text-[var(--ink-3,#64748b)] hover:text-[var(--pu,#3b5bdb)] hover:bg-[var(--pu-soft,#e0eaff)] transition-colors"
                    >
                      <KeyRound size={15} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
