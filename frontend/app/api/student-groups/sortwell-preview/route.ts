import { NextResponse } from "next/server";
import { forwardError, proxyRequest, readJson } from "@/lib/student-groups-proxy";

type PreviewPayload = {
  houses?: Array<{
    groupId: number;
    groupName: string;
    emoji: string;
    color: string;
    bgColor?: string;
    bg_color?: string;
    count: number;
  }>;
};

type HousePreview = {
  groupId: number;
  groupName: string;
  emoji: string;
  color: string;
  bgColor?: string;
  bg_color?: string;
  count: number;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "unassigned";

  const upstream = await proxyRequest(
    req,
    `/api/v1/students/groups/sortwell-preview/?scope=${encodeURIComponent(scope)}`
  );
  if (!upstream.ok) return forwardError(upstream, "Unable to load Sortwell preview");

  const payload = (await readJson(upstream)) as PreviewPayload | HousePreview[];
  const houses = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.houses)
      ? payload.houses
      : [];

  return NextResponse.json(
    houses.map((h) => ({
      groupId: h.groupId,
      groupName: h.groupName,
      emoji: h.emoji,
      color: h.color,
      bgColor: h.bgColor || h.bg_color || "#e6f9f5",
      count: h.count,
    }))
  );
}
