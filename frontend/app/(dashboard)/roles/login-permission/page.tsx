'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  GraduationCap, Crown, BookOpen, Users, Truck, ShieldCheck,
} from 'lucide-react';
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
  PortalTab,
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

// ── Portal tab definitions ──────────────────────────────────────────────────
interface TabDef {
  id: PortalTab;
  label: string;
  Icon: React.ElementType;
  portalTypes: string[];           // backend portal_type values that map to this tab
  nameKeywords?: string[];         // fallback: match role name
  activeColor: string;
  activeTextColor: string;
  activeBg: string;
}

const TABS: TabDef[] = [
  {
    id: 'teacher',
    label: 'Teachers',
    Icon: GraduationCap,
    portalTypes: ['teacher'],
    nameKeywords: ['teacher'],
    activeColor: 'border-[var(--pu,#6D4AFF)]',
    activeTextColor: 'text-[var(--pu,#6D4AFF)]',
    activeBg: 'bg-[var(--pu-soft,#EEEAFF)]',
  },
  {
    id: 'principal',
    label: 'Principals',
    Icon: Crown,
    portalTypes: [],
    nameKeywords: ['principal', 'vice principal', 'head of', 'hod', 'rector', 'headmaster', 'headmistress'],
    activeColor: 'border-indigo-600',
    activeTextColor: 'text-indigo-700',
    activeBg: 'bg-indigo-50',
  },
  {
    id: 'student',
    label: 'Students',
    Icon: BookOpen,
    portalTypes: ['student'],
    nameKeywords: ['student'],
    activeColor: 'border-sky-600',
    activeTextColor: 'text-sky-700',
    activeBg: 'bg-sky-50',
  },
  {
    id: 'parent',
    label: 'Parents',
    Icon: Users,
    portalTypes: ['parent'],
    nameKeywords: ['parent', 'guardian'],
    activeColor: 'border-rose-500',
    activeTextColor: 'text-rose-700',
    activeBg: 'bg-rose-50',
  },
  {
    id: 'driver',
    label: 'Drivers',
    Icon: Truck,
    portalTypes: [],
    nameKeywords: ['driver', 'transport'],
    activeColor: 'border-orange-500',
    activeTextColor: 'text-orange-700',
    activeBg: 'bg-orange-50',
  },
  {
    id: 'staff',
    label: 'Admin Staff',
    Icon: ShieldCheck,
    portalTypes: ['admin', 'custom'],
    nameKeywords: [],
    activeColor: 'border-slate-600',
    activeTextColor: 'text-slate-700',
    activeBg: 'bg-slate-100',
  },
];

/** Map a role to a portal tab — uses portalType first, then name-based keywords */
function getRoleTab(role: RoleOption): PortalTab {
  const name = (role.name || '').toLowerCase();
  const pt   = (role.portalType || '').toLowerCase();

  // Exact portal-type match first (most reliable)
  if (pt === 'teacher' || name.includes('teacher'))                         return 'teacher';
  if (pt === 'student' || role.isStudent || name.includes('student'))       return 'student';
  if (pt === 'parent'  || name.includes('parent') || name.includes('guardian')) return 'parent';

  // Name-based for roles that share 'admin' portal type
  if (
    name.includes('driver') ||
    name.includes('transport') ||
    name.includes('bus') ||
    name.includes('vehicle')
  ) return 'driver';

  if (
    name.includes('principal') ||
    name.includes('vice') ||
    name.includes('hod') ||
    name.includes('head of') ||
    name.includes('rector') ||
    name.includes('headmaster') ||
    name.includes('headmistress')
  ) return 'principal';

  return 'staff';
}

export default function LoginPermissionPage() {
  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<PortalTab>('teacher');

  // ── All roles from meta (ungrouped) ──────────────────────────────────────
  const [allRoles, setAllRoles]         = useState<RoleOption[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [sectionOptions, setSectionOptions] = useState<SectionOption[]>([]);
  const [metaLoaded, setMetaLoaded]     = useState(false);

  // ── Roles for the active tab ──────────────────────────────────────────────
  const tabRoles = allRoles.filter((r) => getRoleTab(r) === activeTab);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [role, setRole]               = useState<Role | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus]           = useState<StatusFilter>('all');
  const [classFilter, setClassFilter]     = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(25);

  // ── Data state ────────────────────────────────────────────────────────────
  const [result, setResult]   = useState<PageResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Derived: is the currently selected role a student role?
  const isStudentRole =
    allRoles.find((r) => r.name.toLowerCase() === (role as string).toLowerCase())?.isStudent ??
    (role as string).toLowerCase().includes('student');

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]             = useState<Set<string>>(new Set());
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);

  // ── UI overlay state ──────────────────────────────────────────────────────
  const [toasts, setToasts]         = useState<ToastItem[]>([]);
  const [drawerUser, setDrawerUser] = useState<LPUser | null>(null);
  const [confirm, setConfirm]       = useState<{ action: BulkAction; target: BulkTarget } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // ── Debounce search input ─────────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  // ── Fetch meta once on mount ──────────────────────────────────────────────
  useEffect(() => {
    loginPermissionApi.fetchMeta().then((meta) => {
      setAllRoles(meta.roles);
      setClassOptions(meta.classes);
      setSectionOptions(meta.sections);
      setMetaLoaded(true);
    }).catch(() => { setMetaLoaded(true); });
  }, []);

  // ── Auto-select role when tab changes or meta loads ───────────────────────
  useEffect(() => {
    if (!metaLoaded) return;
    const roles = allRoles.filter((r) => getRoleTab(r) === activeTab);
    if (roles.length > 0) {
      setRole(roles[0].name.toLowerCase() as Role);
    } else {
      setRole('');
      setResult(null);
    }
    setPage(1);
    setSearchInput('');
    setDebouncedSearch('');
    setStatus('all');
    setClassFilter('');
    setSectionFilter('');
    setSelectedIds(new Set());
    setAllMatchingSelected(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, metaLoaded]);

  // ── Fetch users ───────────────────────────────────────────────────────────
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

  // ── Toast helper ──────────────────────────────────────────────────────────
  function addToast(type: 'success' | 'error', message: string) {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
  }

  // ── Tab change ────────────────────────────────────────────────────────────
  function handleTabChange(tab: PortalTab) {
    setActiveTab(tab);
  }

  // ── Filter handlers ───────────────────────────────────────────────────────
  function handleRoleChange(r: Role) {
    setRole(r);
    setPage(1);
    if (!allRoles.find((opt) => opt.name.toLowerCase() === r.toLowerCase())?.isStudent) {
      setClassFilter('');
      setSectionFilter('');
    }
  }

  function handleStatusChange(s: StatusFilter) { setStatus(s); setPage(1); }
  function handleSearch() { setPage(1); setDebouncedSearch(searchInput); }
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
      await loginPermissionApi.exportUsers(role as string, debouncedSearch || undefined, status === 'all' ? undefined : status);
    } catch {
      addToast('error', 'Export failed');
    }
  }

  // ── Toggle single user ────────────────────────────────────────────────────
  async function handleToggleAccess(id: string, value: boolean) {
    try {
      await loginPermissionApi.toggleAccess(id, value);
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          results: prev.results.map((u) => u.id === id ? { ...u, loginAccess: value } : u),
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

  // ── Selection handlers ────────────────────────────────────────────────────
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

  // ── Bulk actions ──────────────────────────────────────────────────────────
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
        addToast('success', `${action === 'enable' ? 'Enabled' : 'Disabled'} ${res.affected.toLocaleString()} users`);
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedCount   = allMatchingSelected ? (result?.filteredCount ?? 0) : selectedIds.size;
  const allPageSelected =
    !!result && result.results.length > 0 && result.results.every((u) => selectedIds.has(u.id));
  const showSelectAllBanner =
    allPageSelected && !allMatchingSelected && !!result && result.filteredCount > result.results.length;

  const activeTabDef = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  // ── Tab counts (from allRoles grouping) ───────────────────────────────────
  function tabHasRoles(tab: PortalTab) {
    return allRoles.some((r) => getRoleTab(r) === tab);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-0,#f8fafc)] pb-20">
      <Hero activeTab={activeTab} />

      {/* ── Portal tab bar ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[var(--bd,#dbe4f0)] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end gap-1 overflow-x-auto hide-scrollbar">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const hasRoles = tabHasRoles(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  disabled={!hasRoles && metaLoaded}
                  className={[
                    'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 -mb-px',
                    isActive
                      ? `${tab.activeColor} ${tab.activeTextColor}`
                      : 'border-transparent text-[var(--ink-3,#64748b)] hover:text-[var(--ink-1,#0f172a)] hover:border-[var(--bd-2,#e3e3ec)]',
                    !hasRoles && metaLoaded ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <tab.Icon
                    size={15}
                    className={isActive ? tab.activeTextColor : 'text-[var(--ink-3,#64748b)]'}
                  />
                  {tab.label}
                  {isActive && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab.activeBg} ${tab.activeTextColor}`}
                    >
                      {tabRoles.length === 1 ? tabRoles[0].name : `${tabRoles.length}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-3">
        {/* Role has no users matching the tab */}
        {metaLoaded && tabRoles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-[var(--bd,#dbe4f0)] bg-white text-center">
            <div
              className={`w-14 h-14 rounded-2xl ${activeTabDef.activeBg} flex items-center justify-center mb-3`}
            >
              <activeTabDef.Icon size={24} className={activeTabDef.activeTextColor} />
            </div>
            <p className="font-semibold text-[var(--ink-1,#0f172a)]">
              No {activeTabDef.label} roles found
            </p>
            <p className="text-sm text-[var(--ink-3,#64748b)] mt-1 max-w-xs">
              Create a role with the correct portal type in Roles &amp; Permissions first.
            </p>
          </div>
        )}

        {tabRoles.length > 0 && (
          <>
            <StatsRow
              counts={result?.counts ?? null}
              loading={loading && !result}
              role={role as string}
              roleCount={tabRoles.length}
              activeTab={activeTab}
            />

            <FilterBar
              role={role}
              onRoleChange={handleRoleChange}
              roleOptions={tabRoles}
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
              role={role as string}
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
          </>
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
          onSuccess={(msg) => { addToast('success', msg); setDrawerUser(null); fetchUsers(); }}
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
