import { NextResponse } from 'next/server';

const DJANGO = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function GET(req: Request) {
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
