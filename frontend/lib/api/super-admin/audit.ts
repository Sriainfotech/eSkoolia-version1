/**
 * Super Admin Audit API Client
 * 
 * Handles audit log retrieval and export.
 */

import { AuditEvent, AuditFilters, PaginatedResponse } from '@/types/super-admin';
import { downloadFile } from './billing';
import { apiRequestWithRefresh, apiRequestWithRefreshResponse } from '@/lib/api-auth';

/**
 * Fetch audit events with filtering and pagination
 */
export async function getAuditEvents(filters?: AuditFilters): Promise<PaginatedResponse<AuditEvent>> {
  try {
    const params = new URLSearchParams();

    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.page_size) params.append('page_size', filters.page_size.toString());
    if (filters?.actor) params.append('actor', filters.actor);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.tenant_id) params.append('tenant_id', filters.tenant_id);
    if (filters?.severity) params.append('severity', filters.severity);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);

    const queryString = params.toString();
    const url = `/api/super-admin/audit/${queryString ? '?' + queryString : ''}`;
    return await apiRequestWithRefresh<PaginatedResponse<AuditEvent>>(url);
  } catch (error) {
    console.error('Error fetching audit events:', error);
    throw error;
  }
}

/**
 * Export audit log as CSV
 */
export async function exportAuditCsv(filters?: AuditFilters): Promise<Blob> {
  try {
    const params = new URLSearchParams();

    if (filters?.actor) params.append('actor', filters.actor);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.tenant_id) params.append('tenant_id', filters.tenant_id);
    if (filters?.severity) params.append('severity', filters.severity);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);

    params.append('format', 'csv');

    const queryString = params.toString();
    const url = `/api/super-admin/audit/export/${queryString ? '?' + queryString : ''}`;
    const res = await apiRequestWithRefreshResponse(url, { method: 'GET' });
    return await res.blob();
  } catch (error) {
    console.error('Error exporting audit log:', error);
    throw error;
  }
}

/**
 * Download exported audit CSV
 */
export function downloadAuditCsv(blob: Blob) {
  const timestamp = new Date().toISOString().split('T')[0];
  downloadFile(blob, `audit-log-${timestamp}.csv`);
}
