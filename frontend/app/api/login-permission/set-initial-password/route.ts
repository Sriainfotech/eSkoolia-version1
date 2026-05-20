import { NextResponse } from 'next/server';

const DJANGO = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = auth;

  const body = await req.json().catch(() => ({}));
  const upstream = await fetch(
    `${DJANGO}/api/v1/access-control/login-permission/set-initial-password/`,
    { method: 'POST', headers, body: JSON.stringify(body) }
  );

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
