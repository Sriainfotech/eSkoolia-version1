import { NextResponse } from "next/server";

// Stub — recents are stored in localStorage client-side via recentsStore.ts.
// This endpoint accepts POST silently so the browser console stays clean.
export async function POST() {
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function GET() {
  return NextResponse.json([], { status: 200 });
}
