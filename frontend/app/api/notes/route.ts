import { NextResponse } from "next/server";

// Stub — sticky notes are stored in localStorage client-side via PageNotesPanel.
// Returns empty list so the panel falls back to localStorage gracefully.
export async function GET() {
  return NextResponse.json([], { status: 200 });
}

export async function POST() {
  return NextResponse.json({ id: null, ok: true }, { status: 201 });
}
