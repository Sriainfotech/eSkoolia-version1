/**
 * Super Admin Policies API Client
 * 
 * Handles global policies and configuration management.
 */

import { GlobalPolicy, PolicyGroup, UpdatePoliciesRequest } from '@/types/super-admin';
import { downloadFile } from './billing';
import { apiRequestWithRefresh, apiRequestWithRefreshResponse } from '@/lib/api-auth';

/**
 * Fetch all policies grouped by category
 */
export async function getPolicies(): Promise<PolicyGroup[]> {
  try {
    return await apiRequestWithRefresh<PolicyGroup[]>('/api/super-admin/policies/');
  } catch (error) {
    console.error('Error fetching policies:', error);
    throw error;
  }
}

/**
 * Update one or more policies
 */
export async function updatePolicies(updates: UpdatePoliciesRequest): Promise<void> {
  try {
    await apiRequestWithRefresh('/api/super-admin/policies/', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  } catch (error) {
    console.error('Error updating policies:', error);
    throw error;
  }
}

/**
 * Export policies as JSON or YAML
 */
export async function exportPolicies(format: 'json' | 'yaml' = 'json'): Promise<Blob> {
  try {
    const res = await apiRequestWithRefreshResponse(`/api/super-admin/policies/export/?format=${format}`, {
      method: 'GET',
    });
    return await res.blob();
  } catch (error) {
    console.error('Error exporting policies:', error);
    throw error;
  }
}

/**
 * Fetch platform system settings (read-only)
 */
export async function getPolicySettings(): Promise<Record<string, Record<string, unknown>>> {
  try {
    return await apiRequestWithRefresh<Record<string, Record<string, unknown>>>('/api/super-admin/policies/settings/');
  } catch (error) {
    console.error('Error fetching policy settings:', error);
    throw error;
  }
}

/**
 * Download exported policies
 */
export function downloadPoliciesConfig(blob: Blob, format: 'json' | 'yaml' = 'json') {
  const extension = format === 'json' ? 'json' : 'yaml';
  const timestamp = new Date().toISOString().split('T')[0];
  downloadFile(blob, `policies-${timestamp}.${extension}`);
}
