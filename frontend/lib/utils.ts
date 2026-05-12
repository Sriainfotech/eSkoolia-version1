import { AcademicYearStatus } from "./types";

/**
 * Format an ISO date string (YYYY-MM-DD) to "DD MMM YYYY" format.
 * E.g., "2026-07-04" → "04 Jul 2026"
 */
export function formatDate(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString + "T00:00:00Z"); // Ensure UTC parsing
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Derive an academic year name from start and end dates.
 * E.g., "2026-07-04" to "2027-07-03" → "2026–2027"
 */
export function deriveYearName(startIso: string, endIso: string): string {
  if (!startIso || !endIso) return "";
  const start = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";
  return `${start.getUTCFullYear()}–${end.getUTCFullYear()}`;
}

/**
 * Determine the status of an academic year.
 * - "active" if forceActive is true, or today is between start and end
 * - "upcoming" if today is before start
 * - "archived" if today is after end
 */
export function deriveStatus(
  startIso: string,
  endIso: string,
  forceActive: boolean
): AcademicYearStatus {
  if (forceActive) return "active";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "upcoming";

  if (today < start) return "upcoming";
  if (today > end) return "archived";
  return "active";
}
