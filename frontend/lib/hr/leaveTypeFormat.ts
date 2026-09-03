/**
 * Small presentational helpers for leave-type badges/meta text — shared
 * between the Leave Setup wizard (/hr/leave/setup) and the Applications
 * table on /hr/leave, so both render the same abbreviation/color for a
 * given leave type name.
 */
import type { LeaveType } from "@/types/hr";

const LEAVE_ABBREV: Record<string, string> = {
  "Casual Leave": "CL", "Sick Leave": "SL", "Earned Leave": "EL", "Medical Leave": "ML",
  "Maternity Leave": "MAT", "On Duty": "OD", "Compensatory Off": "COMP", "Loss of Pay": "LOP",
};
const LEAVE_COLORS: Record<string, { bg: string; fg: string }> = {
  CL: { bg: "#ede9fe", fg: "#6d28d9" }, SL: { bg: "#dbeafe", fg: "#1d4ed8" },
  EL: { bg: "#dcfce7", fg: "#15803d" }, ML: { bg: "#fef3c7", fg: "#b45309" },
  MAT: { bg: "#fce7f3", fg: "#be185d" }, OD: { bg: "#e0e7ff", fg: "#4338ca" },
  COMP: { bg: "#ccfbf1", fg: "#0f766e" }, LOP: { bg: "#fee2e2", fg: "#b91c1c" },
};
const FALLBACK_LEAVE_COLORS = [
  { bg: "#ede9fe", fg: "#6d28d9" }, { bg: "#dbeafe", fg: "#1d4ed8" },
  { bg: "#dcfce7", fg: "#15803d" }, { bg: "#fef3c7", fg: "#b45309" },
];

export function leaveTypeAbbrev(name: string) {
  if (LEAVE_ABBREV[name]) return LEAVE_ABBREV[name];
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join("").toUpperCase();
}

export function leaveTypeColor(abbrev: string, index: number) {
  return LEAVE_COLORS[abbrev] ?? FALLBACK_LEAVE_COLORS[index % FALLBACK_LEAVE_COLORS.length];
}

export function leaveMetaLine(lt: LeaveType): string {
  const parts: string[] = [];
  parts.push(lt.can_carry_forward ? `Carry ${lt.max_carry_forward_days}d` : "No carry");
  if (lt.allow_half_day) parts.push("½ day");
  if (lt.minimum_notice_period > 0) parts.push(`${lt.minimum_notice_period}d notice`);
  if (lt.max_encashment_days > 0) parts.push(`Encash ${lt.max_encashment_days}d`);
  return parts.join(" · ");
}
