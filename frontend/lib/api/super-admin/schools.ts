/**
 * Super Admin Schools API Client
 * 
 * Handles all API calls related to school management and provisioning.
 */

import {
  SchoolTenant,
  PaginatedResponse,
  SchoolFilters,
  ProvisionSchoolRequest,
  ProvisionSchoolResponse,
} from '@/types/super-admin';
import { apiRequestWithRefresh } from '@/lib/api-auth';

/**
 * Fetch list of schools with pagination and filtering
 */
export async function getSchools(filters?: SchoolFilters): Promise<PaginatedResponse<SchoolTenant>> {
  try {
    const params = new URLSearchParams();

    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.page_size) params.append('page_size', filters.page_size.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.board) params.append('board', filters.board);
    if (filters?.plan) params.append('plan', filters.plan);
    if (filters?.region) params.append('region', filters.region);
    if (filters?.state) params.append('state', filters.state);
    if (filters?.health_flag) params.append('health_flag', filters.health_flag);

    const queryString = params.toString();
    const url = `/api/super-admin/schools/${queryString ? '?' + queryString : ''}`;

    const payload = await apiRequestWithRefresh<PaginatedResponse<SchoolTenant>>(url.replace(/^https?:\/\/[^/]+/, ''));
    return {
      ...payload,
      results: payload.results.map((item) => ({
        ...item,
        udiseCode: item.udiseCode ?? (item as unknown as { udise_code?: string }).udise_code,
      })),
    };
  } catch (error) {
    console.error('Error fetching schools:', error);
    throw error;
  }
}

/**
 * Provision a new school tenant
 */
export async function provisionSchool(data: ProvisionSchoolRequest): Promise<ProvisionSchoolResponse> {
  try {
    return await apiRequestWithRefresh<ProvisionSchoolResponse>('/api/super-admin/schools/provision/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('Error provisioning school:', error);
    throw error;
  }
}

/**
 * Update an existing school tenant
 */
export async function updateSchool(tenantId: string, data: Partial<SchoolTenant>): Promise<SchoolTenant> {
  try {
    return await apiRequestWithRefresh<SchoolTenant>(`/api/super-admin/schools/${tenantId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('Error updating school:', error);
    throw error;
  }
}

/**
 * Delete/archive a school tenant
 */
export async function deleteSchool(tenantId: string): Promise<void> {
  try {
    await apiRequestWithRefresh<void>(`/api/super-admin/schools/${tenantId}/`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Error deleting school:', error);
    throw error;
  }
}

/**
 * Get a single school by tenant ID
 */
export async function getSchool(tenantId: string): Promise<SchoolTenant> {
  try {
    return await apiRequestWithRefresh<SchoolTenant>(`/api/super-admin/schools/${tenantId}/`);
  } catch (error) {
    console.error('Error fetching school:', error);
    throw error;
  }
}

export interface ImpersonateResponse {
  tenant_id: string;
  username: string;
  access: string;
  refresh: string;
  handoff_url: string;
  expires_in: number;
}

/**
 * Mint a short-lived impersonation token + handoff URL for a tenant.
 */
export async function impersonateSchool(tenantId: string): Promise<ImpersonateResponse> {
  return apiRequestWithRefresh<ImpersonateResponse>(
    `/api/super-admin/schools/${tenantId}/impersonate/`,
    { method: 'POST' }
  );
}

export interface ResetAdminPasswordResponse {
  admin_username: string;
  admin_password: string;
  message: string;
}

/**
 * Generate a new secure password for the school's admin account and apply it
 * immediately. The password is returned ONCE and is never stored server-side.
 */
export async function resetSchoolAdminPassword(tenantId: string): Promise<ResetAdminPasswordResponse> {
  return apiRequestWithRefresh<ResetAdminPasswordResponse>(
    `/api/super-admin/schools/${tenantId}/reset-admin-password/`,
    { method: 'POST' }
  );
}

/**
 * Upload a logo image for a school tenant.
 * Returns the stored logo URL.
 */
export async function uploadSchoolLogo(tenantId: string, file: File): Promise<{ logo_url: string }> {
  const formData = new FormData();
  formData.append('logo', file);
  return apiRequestWithRefresh<{ logo_url: string }>(
    `/api/super-admin/schools/${tenantId}/logo/`,
    { method: 'POST', body: formData }
  );
}

/** Shape returned by GET /api/super-admin/llm/schools/ */
export interface LLMSchoolState {
  id: number;
  name: string;
  code: string;
  tenant_id: string;
  llm_enabled: boolean;
  llm_enabled_at: string | null;
  is_active: boolean;
}

/**
 * Fetch LLM enabled/disabled status for all schools.
 * Returns a Map keyed by school code (matches SchoolTenant.short_code).
 */
export async function getLLMStates(): Promise<Map<string, LLMSchoolState>> {
  const data = await apiRequestWithRefresh<{ count: number; results: LLMSchoolState[] }>(
    '/api/super-admin/llm/schools/'
  );
  const map = new Map<string, LLMSchoolState>();
  for (const s of data.results) {
    if (s.tenant_id) map.set(s.tenant_id, s);
  }
  return map;
}

/**
 * Toggle LLM access for a school.
 * @param schoolId  Integer primary key of the School object.
 * @param enabled   New state.
 */
export async function toggleSchoolLLM(
  schoolId: number,
  enabled: boolean
): Promise<{ llm_enabled: boolean }> {
  return apiRequestWithRefresh<{ llm_enabled: boolean }>(
    `/api/super-admin/llm/schools/${schoolId}/`,
    { method: 'POST', body: JSON.stringify({ enabled }) }
  );
}
