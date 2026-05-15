import { NextResponse } from 'next/server';

const DJANGO = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function GET(req: Request) {
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
