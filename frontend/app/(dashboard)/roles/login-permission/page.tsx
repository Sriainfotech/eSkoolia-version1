'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { loginPermissionApi } from '@/lib/login-permission/api';
import type {
  Role,
  RoleOption,
  StatusFilter,
  BulkAction,
  BulkTarget,
  PageResult,
  LPUser,
  ToastItem,
  ClassOption,
  SectionOption,
} from '@/lib/login-permission/types';

import { Hero }            from '@/components/login-permission/Hero';
import { StatsRow }        from '@/components/login-permission/StatsRow';
import { FilterBar }       from '@/components/login-permission/FilterBar';
import { UsersTable }      from '@/components/login-permission/UsersTable';
import { Pagination }      from '@/components/login-permission/Pagination';
import { BulkActionBar }   from '@/components/login-permission/BulkActionBar';
import { CredentialDrawer }from '@/components/login-permission/CredentialDrawer';
import { ConfirmModal }    from '@/components/login-permission/ConfirmModal';
import { Toast }           from '@/components/login-permission/Toast';

export default function LoginPermissionPage() {
  // ── Filter state ────────────────────────────────────────────────────────────
  const [role, setRole]             = useState<Role | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus]         = useState<StatusFilter>('all');
  const [classFilter, setClassFilter]   = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(25);

  // ── Data state ───────────────────────────────────────────────────────────────
  const [result, setResult]   = useState<PageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [classOptions, setClassOptions]   = useState<ClassOption[]>([]);
  const [sectionOptions, setSectionOptions] = useState<SectionOption[]>([]);

  // Derived: is the currently selected role a student role?
  const isStudentRole =
    roleOptions.find((r) => r.name.toLowerCase() === role.toLowerCase())?.isStudent ??
    role.toLowerCase().includes('student');

  // ── Selection state ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]             = useState<Set<string>>(new Set());
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);

  // ── UI overlay state ─────────────────────────────────────────────────────────
  const [toasts, setToasts]       = useState<ToastItem[]>([]);
  const [drawerUser, setDrawerUser] = useState<LPUser | null>(null);
  const [confirm, setConfirm]     = useState<{ action: BulkAction; target: BulkTarget } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // ── Debounce search input ────────────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    try {
      const data = await loginPermissionApi.listUsers({
        role,
        page,
        pageSize,
        search: debouncedSearch || undefined,
        status: status === 'all' ? undefined : status,
        classFilter:   classFilter   || undefined,
        sectionFilter: sectionFilter || undefined,
      });
      setResult(data);
      setSelectedIds(new Set());
      setAllMatchingSelected(false);
    } catch {
      addToast('error', 'Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [role, page, pageSize, debouncedSearch, status, classFilter, sectionFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Load meta (roles + classes/sections) once on mount ──────────────────────
  useEffect(() => {
    loginPermissionApi.fetchMeta().then((meta) => {
      setRoleOptions(meta.roles);
      setClassOptions(meta.classes);
      setSectionOptions(meta.sections);
    }).catch(() => {});
  }, []);

  // ── Toast helper ─────────────────────────────────────────────────────────────
  function addToast(type: 'success' | 'error', message: string) {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
  }

  // ── Filter handlers ──────────────────────────────────────────────────────────
  function handleRoleChange(r: Role) {
    setRole(r);
    setPage(1);
    // Reset student-specific filters when switching to a non-student role
    const nextIsStudent =
      (roleOptions.find((opt) => opt.name.toLowerCase() === r.toLowerCase())?.isStudent ??
        r.toLowerCase().includes('student'));
    if (!nextIsStudent) {
      setClassFilter('');
      setSectionFilter('');
    }
  }

  function handleStatusChange(s: StatusFilter) {
    setStatus(s);
    setPage(1);
  }

  function handleSearch() {
    setPage(1);
    setDebouncedSearch(searchInput);
  }

  function handleReset() {
    setSearchInput('');
    setDebouncedSearch('');
    setStatus('all');
    setClassFilter('');
    setSectionFilter('');
    setPage(1);
  }

  async function handleExport() {
    try {
      await loginPermissionApi.exportUsers(role, debouncedSearch || undefined, status === 'all' ? undefined : status);
    } catch {
      addToast('error', 'Export failed');
    }
  }

  // ── Toggle single user ───────────────────────────────────────────────────────
  async function handleToggleAccess(id: string, value: boolean) {
    try {
      await loginPermissionApi.toggleAccess(id, value);
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          results: prev.results.map((u) =>
            u.id === id ? { ...u, loginAccess: value } : u
          ),
          counts: {
            ...prev.counts,
            active:   prev.counts.active   + (value ? 1 : -1),
            disabled: prev.counts.disabled + (value ? -1 : 1),
          },
        };
      });
      addToast('success', `Login access ${value ? 'enabled' : 'disabled'}`);
    } catch {
      addToast('error', 'Failed to update login access');
    }
  }

  // ── Selection handlers ───────────────────────────────────────────────────────
  function handleSelectPage(checked: boolean) {
    if (!result) return;
    if (checked) {
      setSelectedIds(new Set(result.results.map((u) => u.id)));
    } else {
      setSelectedIds(new Set());
      setAllMatchingSelected(false);
    }
  }

  function handleSelectRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
    if (!checked) setAllMatchingSelected(false);
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
    setAllMatchingSelected(false);
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────────
  function buildBulkTarget(): BulkTarget {
    return {
      allMatching:   allMatchingSelected,
      ids:           [...selectedIds],
      search:        debouncedSearch,
      status,
      filteredCount: result?.filteredCount ?? 0,
    };
  }

  function openConfirm(action: BulkAction) {
    setConfirm({ action, target: buildBulkTarget() });
  }

  async function handleConfirmBulk() {
    if (!confirm || !role) return;
    setConfirmLoading(true);
    try {
      const { action, target } = confirm;
      const payload = {
        role,
        allMatching: target.allMatching,
        ids:         target.allMatching ? undefined : target.ids,
        search:      target.search || undefined,
        status:      target.status === 'all' ? undefined : target.status,
      };

      if (action === 'reset') {
        const res = await loginPermissionApi.bulkReset(payload);
        addToast('success', `Password reset for ${res.affected.toLocaleString()} users`);
      } else {
        const res = await loginPermissionApi.bulkAccess({
          ...payload,
          login_access: action === 'enable',
        });
        addToast(
          'success',
          `${action === 'enable' ? 'Enabled' : 'Disabled'} ${res.affected.toLocaleString()} users`
        );
      }

      handleClearSelection();
      await fetchUsers();
    } catch {
      addToast('error', 'Bulk action failed. Please try again.');
    } finally {
      setConfirmLoading(false);
      setConfirm(null);
    }
  }

  // ── Derived values ───────────────────────────────────────────────────────────
  const selectedCount   = allMatchingSelected ? (result?.filteredCount ?? 0) : selectedIds.size;
  const allPageSelected =
    !!result && result.results.length > 0 && result.results.every((u) => selectedIds.has(u.id));
  const showSelectAllBanner =
    allPageSelected &&
    !allMatchingSelected &&
    !!result &&
    result.filteredCount > result.results.length;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-0,#f8fafc)] pb-20">
      <Hero role={role} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-3">
        <StatsRow counts={result?.counts ?? null} loading={loading && !result} role={role} />

        <FilterBar
          role={role}
          onRoleChange={handleRoleChange}
          roleOptions={roleOptions}
          isStudentRole={isStudentRole}
          search={searchInput}
          onSearchChange={setSearchInput}
          status={status}
          onStatusChange={handleStatusChange}
          classFilter={classFilter}
          onClassFilterChange={(v) => { setClassFilter(v); setSectionFilter(''); setPage(1); }}
          sectionFilter={sectionFilter}
          onSectionFilterChange={(v) => { setSectionFilter(v); setPage(1); }}
          classOptions={classOptions}
          sectionOptions={sectionOptions}
          onSearch={handleSearch}
          onReset={handleReset}
          onExport={role ? handleExport : undefined}
        />

        <UsersTable
          result={result}
          loading={loading}
          selectedIds={selectedIds}
          allMatchingSelected={allMatchingSelected}
          allPageSelected={allPageSelected}
          showSelectAllBanner={showSelectAllBanner}
          role={role}
          onSelectPage={handleSelectPage}
          onSelectRow={handleSelectRow}
          onSelectAllMatching={() => setAllMatchingSelected(true)}
          onToggleAccess={handleToggleAccess}
          onOpenDrawer={setDrawerUser}
        />

        {result && result.totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={result.totalPages}
            pageSize={pageSize}
            filteredCount={result.filteredCount}
            onPageChange={setPage}
            onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
          />
        )}
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onEnable={() => openConfirm('enable')}
        onDisable={() => openConfirm('disable')}
        onReset={() => openConfirm('reset')}
        onClear={handleClearSelection}
      />

      {/* Credential drawer */}
      {drawerUser && (
        <CredentialDrawer
          user={drawerUser}
          onClose={() => setDrawerUser(null)}
          onSuccess={(msg) => {
            addToast('success', msg);
            setDrawerUser(null);
            fetchUsers();
          }}
          onError={(msg) => addToast('error', msg)}
        />
      )}

      {/* Confirm modal */}
      {confirm && (
        <ConfirmModal
          open
          action={confirm.action}
          target={confirm.target}
          loading={confirmLoading}
          onConfirm={handleConfirmBulk}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Toasts */}
      <Toast
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}

