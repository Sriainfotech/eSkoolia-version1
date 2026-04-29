import { NextResponse } from "next/server";
import { forwardError, proxyRequest, readJson } from "@/lib/student-groups-proxy";

type SortwellResponse = {
  assigned?: number;
  distribution?: Array<{ groupId: number; groupName: string; count: number }>;
};

export async function POST(req: Request) {
  const body = (await req.json()) as { method?: string; scope?: string };
  const upstream = await proxyRequest(req, "/api/v1/students/groups/sortwell/", {
    method: "POST",
    body: {
      method: body.method || "random",
      scope: body.scope || "unassigned",
    },
  });

  if (!upstream.ok) return forwardError(upstream, "Unable to run Sortwell");

  const payload = (await readJson(upstream)) as SortwellResponse;
  return NextResponse.json({
    assigned: Number(payload?.assigned || 0),
    distribution: payload?.distribution || [],
  });
}
