import { NextResponse } from 'next/server';
import { getBackendBaseUrl } from '@/lib/server-api';

export async function GET(req: Request) {
  const DJANGO = getBackendBaseUrl(req);
  const auth = req.headers.get('authorization') || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = auth;

  const upstream = await fetch(
    `${DJANGO}/api/v1/access-control/login-permission/meta/`,
    { headers, cache: 'no-store' }
  );

  const data = upstream.ok
    ? await upstream.json()
    : { roles: [], classes: [], sections: [] };

  return NextResponse.json(data, { status: upstream.ok ? 200 : upstream.status });
}
