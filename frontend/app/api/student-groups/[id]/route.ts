import { NextResponse } from "next/server";
import { forwardError, proxyRequest, readJson } from "@/lib/student-groups-proxy";

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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json()) as Record<string, unknown>;
  const upstream = await proxyRequest(req, `/api/v1/students/groups/${params.id}/`, {
    method: "PATCH",
    body: {
      name: body.name,
      emoji: body.emoji,
      description: body.description,
      capacity: body.capacity,
    },
  });

  if (!upstream.ok) return forwardError(upstream, "Unable to update group");
  const payload = (await readJson(upstream)) as RawGroup;
  return NextResponse.json(normalizeGroup(payload));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const upstream = await proxyRequest(req, `/api/v1/students/groups/${params.id}/`, {
    method: "DELETE",
  });

  if (!upstream.ok) return forwardError(upstream, "Unable to delete group");
  return NextResponse.json({ success: true });
}
