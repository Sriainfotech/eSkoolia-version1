/**
 * Super Admin API client smoke tests.
 *
 * These tests stub `fetch` and `localStorage` to verify each Super Admin
 * API client points at the correct backend endpoint, sends the JWT
 * bearer header, and parses responses.
 */

import { getDashboard } from '@/lib/api/super-admin/dashboard';
import {
  getSchools,
  provisionSchool,
  impersonateSchool,
} from '@/lib/api/super-admin/schools';
import {
  getInvoices,
  getMrr,
  exportGstr1,
  markInvoicePaid,
  sendInvoiceReminder,
} from '@/lib/api/super-admin/billing';
import { getAuditEvents, exportAuditCsv } from '@/lib/api/super-admin/audit';
import { getPolicies, updatePolicies } from '@/lib/api/super-admin/policies';

const ACCESS = 'test-access-token';
const REFRESH = 'test-refresh-token';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const text = JSON.stringify(body);
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Map([['Content-Type', 'application/json']]) as unknown as Headers,
    text: () => Promise.resolve(text),
    json: () => Promise.resolve(JSON.parse(text)),
    blob: () => Promise.resolve(new Blob([text], { type: 'application/json' })),
    clone() {
      return jsonResponse(body, init);
    },
    ...init,
  } as unknown as Response;
}

function blobResponse(text: string, contentType: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Map([['Content-Type', contentType]]) as unknown as Headers,
    text: () => Promise.resolve(text),
    json: () => Promise.reject(new Error('not json')),
    blob: () => Promise.resolve(new Blob([text], { type: contentType })),
    clone() {
      return blobResponse(text, contentType);
    },
  } as unknown as Response;
}

describe('Super Admin API clients', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('school_erp_access_token', ACCESS);
    window.localStorage.setItem('school_erp_refresh_token', REFRESH);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function lastCall(): { url: string; init: RequestInit } {
    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    return { url: String(url), init: (init ?? {}) as RequestInit };
  }

  function authHeader(init: RequestInit): string | undefined {
    const headers = (init.headers ?? {}) as Record<string, string>;
    return headers.Authorization;
  }

  test('dashboard: GET /api/super-admin/dashboard/ with bearer token', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        active_schools_count: 1,
        new_schools_today: 0,
        suspended_schools_count: 0,
        mrr: 0,
        outstanding_amount: 0,
        api_uptime_percent: 99.9,
      })
    );

    const result = await getDashboard();
    const { url, init } = lastCall();
    expect(url).toContain('/api/super-admin/dashboard/');
    expect(init.method ?? 'GET').toBe('GET');
    expect(authHeader(init)).toBe(`Bearer ${ACCESS}`);
    expect(result.active_schools_count).toBe(1);
  });

  test('schools list: GET /api/super-admin/schools/ with filters', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        count: 0,
        next: null,
        previous: null,
        results: [],
      })
    );

    await getSchools({ page: 2, page_size: 5, search: 'acme', status: 'active' });
    const { url, init } = lastCall();
    expect(url).toContain('/api/super-admin/schools/');
    expect(url).toContain('page=2');
    expect(url).toContain('page_size=5');
    expect(url).toContain('search=acme');
    expect(url).toContain('status=active');
    expect(authHeader(init)).toBe(`Bearer ${ACCESS}`);
  });

  test('schools provision: POST /api/super-admin/schools/provision/', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        tenant_id: 't1',
        name: 'Acme',
        subdomain_url: 'acme',
        status: 'onboarding',
      })
    );

    await provisionSchool({
      name: 'Acme',
      subdomain_url: 'acme',
      state: 'AP',
      board: 'CBSE',
      plan: 'trial',
      shard_region: '',
      storage_region: '',
    });

    const { url, init } = lastCall();
    expect(url).toContain('/api/super-admin/schools/provision/');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({ name: 'Acme', subdomain_url: 'acme' });
  });

  test('schools impersonate: POST /api/super-admin/schools/:id/impersonate/', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        tenant_id: 'tnt-1',
        username: 'admin',
        access: 'a',
        refresh: 'r',
        handoff_url: 'http://acme.localhost/login?impersonate=1',
        expires_in: 300,
      })
    );

    const data = await impersonateSchool('tnt-1');
    const { url, init } = lastCall();
    expect(url).toContain('/api/super-admin/schools/tnt-1/impersonate/');
    expect(init.method).toBe('POST');
    expect(data.handoff_url).toContain('impersonate=1');
  });

  test('billing list: GET /api/super-admin/billing/invoices/', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ count: 0, next: null, previous: null, results: [] })
    );
    await getInvoices({ page: 1, status: 'paid' });
    const { url } = lastCall();
    expect(url).toContain('/api/super-admin/billing/invoices/');
    expect(url).toContain('status=paid');
  });

  test('billing mrr: GET /api/super-admin/billing/mrr/', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        current_mrr: 1,
        previous_mrr: 0,
        gst_collected: 0,
        outstanding_amount: 0,
        at_risk_amount: 0,
        trend_percent: 0,
      })
    );
    const data = await getMrr();
    const { url } = lastCall();
    expect(url).toContain('/api/super-admin/billing/mrr/');
    expect(data.current_mrr).toBe(1);
  });

  test('billing export: GET /api/super-admin/billing/export/gstr1/ returns blob', async () => {
    fetchMock.mockResolvedValue(blobResponse('a,b,c', 'text/csv'));
    const blob = await exportGstr1();
    const { url } = lastCall();
    expect(url).toContain('/api/super-admin/billing/export/gstr1/');
    expect(blob).toBeInstanceOf(Blob);
  });

  test('billing mark paid: POST /api/super-admin/billing/invoices/:id/mark-paid/', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: '7', invoice_number: 'INV-1', status: 'paid' })
    );
    const result = await markInvoicePaid('7');
    const { url, init } = lastCall();
    expect(url).toContain('/api/super-admin/billing/invoices/7/mark-paid/');
    expect(init.method).toBe('POST');
    expect(result.status).toBe('paid');
  });

  test('billing reminder: POST /api/super-admin/billing/invoices/:id/reminder/', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ invoice_number: 'INV-1', status: 'sent', reminder_recorded: true })
    );
    const result = await sendInvoiceReminder('7');
    const { url, init } = lastCall();
    expect(url).toContain('/api/super-admin/billing/invoices/7/reminder/');
    expect(init.method).toBe('POST');
    expect(result.reminder_recorded).toBe(true);
  });

  test('audit list: GET /api/super-admin/audit/', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ count: 0, next: null, previous: null, results: [] })
    );
    await getAuditEvents({ page: 1, action: 'auth.login' });
    const { url } = lastCall();
    expect(url).toContain('/api/super-admin/audit/');
    expect(url).toContain('action=auth.login');
  });

  test('audit export: GET /api/super-admin/audit/export/ returns blob', async () => {
    fetchMock.mockResolvedValue(blobResponse('event,actor', 'text/csv'));
    const blob = await exportAuditCsv({});
    const { url } = lastCall();
    expect(url).toContain('/api/super-admin/audit/export/');
    expect(blob).toBeInstanceOf(Blob);
  });

  test('policies: GET /api/super-admin/policies/', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        password_policy: {},
        session_policy: {},
        feature_flags: {},
        notification_policy: {},
      })
    );
    await getPolicies();
    const { url } = lastCall();
    expect(url).toContain('/api/super-admin/policies/');
  });

  test('policies update: PATCH /api/super-admin/policies/', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        password_policy: {},
        session_policy: {},
        feature_flags: {},
        notification_policy: {},
      })
    );
    await updatePolicies({ password_min_length: 12 });
    const { url, init } = lastCall();
    expect(url).toContain('/api/super-admin/policies/');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ password_min_length: 12 });
  });
});
