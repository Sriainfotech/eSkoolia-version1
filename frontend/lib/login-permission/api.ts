import type {
  ListParams,
  PageResult,
  LPUser,
  BulkPayload,
  CredentialResult,
  CredentialAction,
  MetaResult,
  StatusFilter,
} from './types';
import { genTempPassword } from './utils';
import { MOCK_STUDENTS, MOCK_TEACHERS, MOCK_PARENTS, MOCK_META } from './mock-data';
import { API_BASE_URL } from '@/lib/api';

// ── Mock mode ─────────────────────────────────────────────────────────────────
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

// In-memory overrides persist for the browser session
const overrides = new Map<string, Partial<LPUser>>();

function getDataset(role: string): LPUser[] {
  const r = role.toLowerCase();
  if (r.includes('student')) return MOCK_STUDENTS;
  if (r.includes('teacher')) return MOCK_TEACHERS;
  if (r.includes('parent'))  return MOCK_PARENTS;
  return [];
}

function applyOverrides(users: LPUser[]): LPUser[] {
  return users.map((u) => ({ ...u, ...overrides.get(u.id) }));
}

function mockListUsers(params: ListParams): PageResult {
  let users = applyOverrides(getDataset(params.role));

  // Search filter
  if (params.search) {
    const q = params.search.toLowerCase();
    users = users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.staffId.toLowerCase().includes(q)
    );
  }

  // Status filter
  if (params.status && params.status !== 'all') {
    if (params.status === 'active')   users = users.filter((u) => u.loginAccess && u.lastLogin);
    if (params.status === 'inactive') users = users.filter((u) => !u.loginAccess);
    if (params.status === 'new')      users = users.filter((u) => !u.lastLogin);
  }

  // Student class/section filter
  if (params.classFilter) {
    const cls = MOCK_META.classes.find((c) => c.id === params.classFilter);
    if (cls) users = users.filter((u) => u.role.includes(cls.name));
  }
  if (params.sectionFilter && params.classFilter) {
    const sec = MOCK_META.sections.find((s) => s.id === params.sectionFilter);
    if (sec) {
      const cls = MOCK_META.classes.find((c) => c.id === params.classFilter);
      if (cls) users = users.filter((u) => u.role.includes(`${cls.name}-${sec.name}`));
    }
  }

  const filteredCount = users.length;
  const total = applyOverrides(getDataset(params.role)).length;
  const allUsers = applyOverrides(getDataset(params.role));
  const active   = allUsers.filter((u) => u.loginAccess && u.lastLogin).length;
  const disabled = allUsers.filter((u) => !u.loginAccess).length;

  const start = (params.page - 1) * params.pageSize;
  const results = users.slice(start, start + params.pageSize);

  return {
    results,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(filteredCount / params.pageSize)),
    filteredCount,
    counts: { total, active, disabled },
  };
}

// ── Auth helper ───────────────────────────────────────────────────────────────
function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const token = localStorage.getItem('school_erp_access_token') || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

const API_BASE = `${API_BASE_URL}/api/v1/access-control`;

// ── Public API ────────────────────────────────────────────────────────────────
export const loginPermissionApi = {
  // 0. Fetch roles, classes, sections for filter dropdowns
  async fetchMeta(): Promise<MetaResult> {
    if (USE_MOCK) return Promise.resolve(MOCK_META);

    const res = await fetch(`${API_BASE}/login-permission/meta/`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to load meta (${res.status})`);
    return res.json() as Promise<MetaResult>;
  },

  // 1. List users (paginated)
  async listUsers(params: ListParams): Promise<PageResult> {
    if (USE_MOCK) return Promise.resolve(mockListUsers(params));

    const qs = new URLSearchParams({
      role: params.role,
      page: String(params.page),
      page_size: String(params.pageSize),
      ...(params.search ? { search: params.search } : {}),
      ...(params.status && params.status !== 'all'
        ? { status: params.status }
        : {}),
      ...(params.classFilter ? { class_id: params.classFilter } : {}),
      ...(params.sectionFilter ? { section_id: params.sectionFilter } : {}),
    });

    const res = await fetch(`${API_BASE}/login-permission/users/?${qs}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list users (${res.status})`);
    return res.json() as Promise<PageResult>;
  },

  // 2. Toggle single user login access
  async toggleAccess(
    id: string,
    loginAccess: boolean
  ): Promise<{ id: string; loginAccess: boolean }> {
    if (USE_MOCK) {
      overrides.set(id, { ...overrides.get(id), loginAccess });
      return Promise.resolve({ id, loginAccess });
    }

    const res = await fetch(`${API_BASE}/login-permission/toggle/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ id, loginAccess }),
    });
    if (!res.ok) throw new Error(`Failed to toggle access (${res.status})`);
    return res.json();
  },

  // 3. Single user credential action (reset temp password)
  async singleCredential(
    id: string,
    _action: CredentialAction,
    _initialPassword?: string
  ): Promise<CredentialResult> {
    if (USE_MOCK) {
      return Promise.resolve({
        ok: true,
        passwordBackup: genTempPassword(),
        message: 'Password reset successfully. Share the backup password with the user.',
      });
    }

    const res = await fetch(`${API_BASE}/login-permission/reset-password/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      return {
        ok: false,
        passwordBackup: genTempPassword(),
        message: `Error: ${res.status}`,
      };
    }
    return res.json() as Promise<CredentialResult>;
  },

  // 3b. Set initial password (default 123456 or manual) — only for users who never logged in
  async setInitialPassword(
    id: string,
    mode: 'default' | 'manual',
    password?: string
  ): Promise<CredentialResult> {
    if (USE_MOCK) {
      const pw = mode === 'manual' && password ? password : '123456';
      overrides.set(id, { ...overrides.get(id), mustChange: true });
      return Promise.resolve({
        ok: true,
        passwordBackup: pw,
        message: 'Initial password set. Share it with the user.',
      });
    }

    const body: Record<string, string> = { id, mode };
    if (mode === 'manual' && password) body.password = password;
    const res = await fetch(`${API_BASE}/login-permission/set-initial-password/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({})) as CredentialResult & { detail?: string };
    if (!res.ok) {
      return { ok: false, passwordBackup: '', message: data.detail || `Error: ${res.status}` };
    }
    return data;
  },

  // 4. Bulk toggle login access
  async bulkAccess(payload: BulkPayload): Promise<{ affected: number }> {
    if (USE_MOCK) {
      const dataset = applyOverrides(getDataset(payload.role));
      let targets: LPUser[];
      if (payload.allMatching) {
        targets = dataset;
      } else {
        const ids = new Set(payload.ids ?? []);
        targets = dataset.filter((u) => ids.has(u.id));
      }
      targets.forEach((u) =>
        overrides.set(u.id, { ...overrides.get(u.id), loginAccess: payload.login_access ?? false })
      );
      return Promise.resolve({ affected: targets.length });
    }

    const res = await fetch(`${API_BASE}/login-permission/bulk-access/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Bulk access failed (${res.status})`);
    return res.json();
  },

  // 5. Bulk password reset
  async bulkReset(
    payload: Omit<BulkPayload, 'login_access'>
  ): Promise<{ affected: number; csvUrl?: string }> {
    if (USE_MOCK) {
      const dataset = applyOverrides(getDataset(payload.role));
      const count = payload.allMatching
        ? dataset.length
        : (payload.ids?.length ?? 0);
      return Promise.resolve({ affected: count });
    }

    const res = await fetch(`${API_BASE}/login-permission/bulk-reset/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Bulk reset failed (${res.status})`);
    return res.json();
  },

  // 6. Export CSV — client-side from current page data
  async exportUsers(
    role: string,
    search?: string,
    status?: string,
    pageData?: LPUser[]
  ): Promise<void> {
    if (pageData && pageData.length > 0) {
      const rows = [
        'Staff ID,Name,Email,Role,Login Access,Last Login',
        ...pageData.map(
          (u) =>
            `${u.staffId},"${u.name}",${u.email},"${u.role}",${u.loginAccess},${
              u.lastLogin ?? 'Never'
            }`
        ),
      ].join('\n');
      const blob = new Blob([rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `login-permission-${role}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    // Fallback: fetch up to 200 records and export
    try {
      const result = await loginPermissionApi.listUsers({
        role: role as import('./types').Role,
        page: 1,
        pageSize: 200,
        search,
        status: status as StatusFilter,
      });
      await loginPermissionApi.exportUsers(role, search, status, result.results);
    } catch {
      // Silent — no download
    }
  },
};
