import { NextResponse } from "next/server";
import { forwardError, proxyRequest, readJson } from "@/lib/student-groups-proxy";

export async function POST(req: Request) {
  const body = (await req.json()) as { studentId?: number; clubId?: number; role?: string };
  const upstream = await proxyRequest(req, "/api/v1/students/groups/club-assign/", {
    method: "POST",
    body: { studentId: body.studentId, clubId: body.clubId, role: body.role ?? "member" },
  });
  if (!upstream.ok) return forwardError(upstream, "Unable to assign student to club");
  const data = await readJson(upstream);
  return NextResponse.json(data);
}
