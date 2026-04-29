import { NextResponse } from "next/server";
import { forwardError, proxyRequest } from "@/lib/student-groups-proxy";

export async function POST(req: Request) {
  const body = (await req.json()) as { studentIds?: number[]; groupId?: number };
  const ids = Array.isArray(body.studentIds) ? body.studentIds : [];

  const upstream = await proxyRequest(req, "/api/v1/students/groups/bulk-assign/", {
    method: "POST",
    body: {
      student_ids: ids,
      group_id: body.groupId,
    },
  });

  if (!upstream.ok) return forwardError(upstream, "Unable to bulk assign students");
  return NextResponse.json({ assigned: ids.length });
}
