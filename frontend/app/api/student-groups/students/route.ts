import { NextResponse } from "next/server";
import { asList, forwardError, proxyRequest, readJson } from "@/lib/student-groups-proxy";

type RawStudent = {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  admissionNo?: string;
  admission_no?: string;
  class?: string;
  class_name?: string;
  section?: string;
  classIndex?: number;
  class_index?: number;
  currentGroupId?: number | null;
  current_group_id?: number | null;
  student_group?: number | null;
  aiHint?: string | null;
  ai_hint?: string | null;
};

function fullName(s: RawStudent): string {
  if (s.name && s.name.trim()) return s.name;
  return `${s.first_name || ""} ${s.last_name || ""}`.trim() || "Student";
}

function normalizeStudent(s: RawStudent) {
  return {
    id: s.id,
    name: fullName(s),
    admissionNo: s.admissionNo || s.admission_no || "-",
    class: s.class || s.class_name || "-",
    section: s.section || "-",
    classIndex: Number(s.classIndex ?? s.class_index ?? 99),
    currentGroupId: s.currentGroupId ?? s.current_group_id ?? s.student_group ?? null,
    aiHint: s.aiHint ?? s.ai_hint ?? null,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const upstreamParams = new URLSearchParams();

  searchParams.getAll("class").forEach((v) => upstreamParams.append("class", v));
  searchParams.getAll("section").forEach((v) => upstreamParams.append("section", v));

  const groupId = searchParams.get("groupId");
  if (groupId) upstreamParams.set("groupId", groupId);

  const status = searchParams.get("status");
  if (status) upstreamParams.set("status", status.toLowerCase());

  const suffix = upstreamParams.toString();
  const upstream = await proxyRequest(
    req,
    `/api/v1/students/groups/students/${suffix ? `?${suffix}` : ""}`
  );

  if (!upstream.ok) return forwardError(upstream, "Unable to load students");
  const payload = await readJson(upstream);
  const students = asList<RawStudent>(payload).map(normalizeStudent);
  return NextResponse.json(students);
}
