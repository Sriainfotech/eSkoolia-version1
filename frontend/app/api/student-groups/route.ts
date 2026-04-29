import { NextResponse } from "next/server";
import { asList, forwardError, proxyRequest, readJson } from "@/lib/student-groups-proxy";

type RawGroup = {
  id: number;
  name: string;
  type: "HOUSE" | "CLUB" | "CUSTOM" | string;
  emoji?: string;
  description?: string | null;
  color?: string;
  bg_color?: string;
  bgColor?: string;
  capacity?: number;
  students_count?: number;
  studentCount?: number;
};

function normalizeGroup(g: RawGroup) {
  const normalizedType = String(g.type || "CUSTOM").toUpperCase();
  return {
    id: g.id,
    name: g.name,
    type:
      normalizedType === "HOUSE" || normalizedType === "CLUB" || normalizedType === "CUSTOM"
        ? normalizedType
        : "CUSTOM",
    emoji: g.emoji || "📌",
    description: g.description ?? null,
    color: g.color || "#00b894",
    bgColor: g.bgColor || g.bg_color || "#e6f9f5",
    capacity: Number(g.capacity || 40),
    studentCount: Number(g.studentCount ?? g.students_count ?? 0),
  };
}

export async function GET(req: Request) {
  const upstream = await proxyRequest(req, "/api/v1/students/groups/?page_size=1000");
  if (!upstream.ok) return forwardError(upstream, "Unable to load groups");
  const payload = await readJson(upstream);
  const groups = asList<RawGroup>(payload).map(normalizeGroup);
  return NextResponse.json(groups);
}

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const upstream = await proxyRequest(req, "/api/v1/students/groups/", {
    method: "POST",
    body: {
      name: body.name,
      type: body.type,
      emoji: body.emoji,
      description: body.description,
      color: body.color,
      bg_color: body.bgColor,
      capacity: body.capacity,
    },
  });

  if (!upstream.ok) return forwardError(upstream, "Unable to create group");
  const payload = (await readJson(upstream)) as RawGroup;
  return NextResponse.json(normalizeGroup(payload), { status: 201 });
}
