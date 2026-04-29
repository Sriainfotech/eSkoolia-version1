import { NextResponse } from "next/server";
import { asList, forwardError, proxyRequest, readJson } from "@/lib/student-groups-proxy";

type StatsPayload = {
  totalStudents?: number;
  total_students?: number;
  assigned?: number;
  unassigned?: number;
  houseCount?: number;
  house_count?: number;
  clubCount?: number;
  club_count?: number;
};

export async function GET(req: Request) {
  const [statsUpstream, groupsUpstream] = await Promise.all([
    proxyRequest(req, "/api/v1/students/groups/stats/"),
    proxyRequest(req, "/api/v1/students/groups/?page_size=1000"),
  ]);
  if (!statsUpstream.ok) return forwardError(statsUpstream, "Unable to load stats");

  const payload = (await readJson(statsUpstream)) as StatsPayload;
  const total = Number(payload.totalStudents ?? payload.total_students ?? 0);
  const assigned = Number(payload.assigned ?? 0);
  const houseCountRaw = Number(payload.houseCount ?? payload.house_count ?? 0);
  const clubCountRaw = Number(payload.clubCount ?? payload.club_count ?? 0);

  let derivedHouseCount = 0;
  let derivedClubCount = 0;
  if (groupsUpstream.ok) {
    const groupsPayload = await readJson(groupsUpstream);
    const groups = asList<{ type?: string }>(groupsPayload);
    derivedHouseCount = groups.filter((g) => String(g.type || "").toUpperCase() === "HOUSE").length;
    derivedClubCount = groups.filter((g) => String(g.type || "").toUpperCase() === "CLUB").length;
  }

  return NextResponse.json({
    totalStudents: total,
    assigned,
    unassigned: Number(payload.unassigned ?? total - assigned),
    houseCount: houseCountRaw > 0 ? houseCountRaw : derivedHouseCount,
    clubCount: clubCountRaw > 0 ? clubCountRaw : derivedClubCount,
  });
}
