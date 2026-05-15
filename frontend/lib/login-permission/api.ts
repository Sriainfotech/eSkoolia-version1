import type {
  ListParams,
  PageResult,
  LPUser,
  BulkPayload,
  CredentialResult,
  CredentialAction,
  MetaResult,
} from './types';
import { genTempPassword } from './utils';

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

const API_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE) ||
  '/api';

// ── Public API ────────────────────────────────────────────────────────────────
export const loginPermissionApi = {
  // 0. Fetch roles, classes, sections for filter dropdowns
  async fetchMeta(): Promise<MetaResult> {
    const res = await fetch(`${API_BASE}/login-permission/meta/`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to load meta (${res.status})`);
    return res.json() as Promise<MetaResult>;
  },

  // 1. List users (paginated)
  async listUsers(params: ListParams): Promise<PageResult> {
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
        'Staff ID,Name,Email,Login Access,Last Login',
        ...pageData.map(
          (u) =>
            `${u.staffId},"${u.name}",${u.email},${u.loginAccess},${
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
        status: status as import('./types').StatusFilter,
      });
      await loginPermissionApi.exportUsers(role, search, status, result.results);
    } catch {
      // Silent — no download
    }
  },
};
