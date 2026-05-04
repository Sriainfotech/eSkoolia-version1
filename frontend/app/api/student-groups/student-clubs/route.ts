import { NextResponse } from "next/server";
import { forwardError, proxyRequest, readJson, asList } from "@/lib/student-groups-proxy";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  if (!studentId) return NextResponse.json([]);

  const upstream = await proxyRequest(
    req,
    `/api/v1/students/groups/student-clubs/?studentId=${studentId}`
  );
  if (!upstream.ok) return forwardError(upstream, "Unable to load student clubs");
  const data = await readJson(upstream);
  return NextResponse.json(asList(data));
}
