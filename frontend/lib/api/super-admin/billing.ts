/**
 * Super Admin Billing API Client
 * 
 * Handles billing, invoicing, and financial metrics.
 */

import { Invoice, MrrData, InvoiceFilters, PaginatedResponse } from '@/types/super-admin';
import { apiRequestWithRefresh, apiRequestWithRefreshResponse } from '@/lib/api-auth';

/**
 * Fetch list of invoices with filtering and pagination
 */
export async function getInvoices(filters?: InvoiceFilters): Promise<PaginatedResponse<Invoice>> {
  try {
    const params = new URLSearchParams();

    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.page_size) params.append('page_size', filters.page_size.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.school_name) params.append('school_name', filters.school_name);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);

    const queryString = params.toString();
    const url = `/api/super-admin/billing/invoices/${queryString ? '?' + queryString : ''}`;
    return await apiRequestWithRefresh<PaginatedResponse<Invoice>>(url);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }
}

/**
 * Create a new invoice
 */
export async function createInvoice(data: Partial<Invoice>): Promise<Invoice> {
  try {
    return await apiRequestWithRefresh<Invoice>('/api/super-admin/billing/invoices/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
}

/**
 * Fetch MRR and billing metrics
 */
export async function getMrr(): Promise<MrrData> {
  try {
    return await apiRequestWithRefresh<MrrData>('/api/super-admin/billing/mrr/');
  } catch (error) {
    console.error('Error fetching MRR:', error);
    throw error;
  }
}

/**
 * Export GSTR-1 report as CSV/Excel
 */
export async function exportGstr1(): Promise<Blob> {
  try {
    const res = await apiRequestWithRefreshResponse('/api/super-admin/billing/export/gstr1/', {
      method: 'GET',
    });
    return await res.blob();
  } catch (error) {
    console.error('Error exporting GSTR-1:', error);
    throw error;
  }
}

/**
 * Trigger download of exported file
 */
export function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Mark an invoice as paid.
 */
export async function markInvoicePaid(invoiceId: string): Promise<Invoice> {
  return apiRequestWithRefresh<Invoice>(
    `/api/super-admin/billing/invoices/${invoiceId}/mark-paid/`,
    { method: 'POST' }
  );
}

/**
 * Send (record) a payment reminder for an invoice.
 */
export async function sendInvoiceReminder(
  invoiceId: string
): Promise<{ invoice_number: string; status: string; reminder_recorded: boolean }> {
  return apiRequestWithRefresh(
    `/api/super-admin/billing/invoices/${invoiceId}/reminder/`,
    { method: 'POST' }
  );
}
