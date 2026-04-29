import { NextResponse } from "next/server";
import { forwardError, proxyRequest } from "@/lib/student-groups-proxy";

export async function POST(req: Request) {
  const body = (await req.json()) as { studentId?: number; groupId?: number | null };
  const upstream = await proxyRequest(req, "/api/v1/students/groups/assign/", {
    method: "POST",
    body: {
      studentId: body.studentId,
      groupId: body.groupId ?? null,
    },
  });

  if (!upstream.ok) return forwardError(upstream, "Unable to assign student");
  return NextResponse.json({ studentId: body.studentId, groupId: body.groupId ?? null });
}
