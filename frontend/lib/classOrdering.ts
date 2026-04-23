type ClassLike = {
  id?: number | string;
  name?: string | null;
  numeric_order?: number | string | null;
};

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseClassNumberFromName(name: string): number | null {
  const match = name.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Mirror of backend Class.resolve_numeric_order() — Nursery=1, LKG=2, UKG=3, Grade N = N+3 */
function nameToNumericOrder(name: string): number | null {
  const upper = name.trim().toUpperCase();
  if (upper === "NURSERY") return 1;
  if (upper === "LKG") return 2;
  if (upper === "UKG") return 3;
  // "Grade 6", "6", "GRADE 6"
  const m = upper.match(/^(?:GRADE\s*)?([1-9]|1[0-2])$/);
  if (m) return parseInt(m[1], 10) + 3;
  return null;
}

export function compareAcademicsClasses<T extends ClassLike>(a: T, b: T): number {
  // Treat 0 as unset — Django uses default=0 before numeric_order is computed
  const rawA = parseNumber(a.numeric_order);
  const rawB = parseNumber(b.numeric_order);
  // Prefer DB numeric_order when valid; fall back to computing from name
  const orderA = (rawA !== null && rawA > 0) ? rawA : nameToNumericOrder(normalizedName(a.name)) ?? 9999;
  const orderB = (rawB !== null && rawB > 0) ? rawB : nameToNumericOrder(normalizedName(b.name)) ?? 9999;

  if (orderA !== orderB) return orderA - orderB;

  const idA = parseNumber(a.id);
  const idB = parseNumber(b.id);
  if (idA !== null && idB !== null) return idA - idB;

  return 0;
}

export function sortAcademicsClasses<T extends ClassLike>(items: T[]): T[] {
  return [...(items || [])].sort(compareAcademicsClasses);
}
