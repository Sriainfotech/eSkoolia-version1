import { NextResponse } from "next/server";
import { forwardError, proxyRequest, readJson, asList } from "@/lib/student-groups-proxy";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clubId = searchParams.get("clubId");
  const params = new URLSearchParams();
  if (clubId) params.set("clubId", clubId);
  const cls = searchParams.get("class");
  if (cls) params.set("class", cls);
  const sec = searchParams.get("section");
  if (sec) params.set("section", sec);

  const upstream = await proxyRequest(
    req,
    `/api/v1/students/groups/club-members/?${params.toString()}`
  );
  if (!upstream.ok) return forwardError(upstream, "Unable to load club members");
  const data = await readJson(upstream);
  return NextResponse.json(asList(data));
}
