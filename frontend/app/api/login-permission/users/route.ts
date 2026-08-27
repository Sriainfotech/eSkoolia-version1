import { NextResponse } from 'next/server';
import { getBackendBaseUrl } from '@/lib/server-api';

export async function GET(req: Request) {
  const DJANGO = getBackendBaseUrl(req);
  const auth = req.headers.get('authorization') || '';
  const headers: Record<string, string> = {};
  if (auth) headers['Authorization'] = auth;

  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();

  const upstream = await fetch(
    `${DJANGO}/api/v1/access-control/login-permission/users/${qs ? `?${qs}` : ''}`,
    { headers, cache: 'no-store' }
  );

  const body = await upstream.json().catch(() => ({ detail: 'Upstream error' }));
  return NextResponse.json(body, { status: upstream.status });
}
