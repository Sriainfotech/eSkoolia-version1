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

export function compareAcademicsClasses<T extends ClassLike>(a: T, b: T): number {
  const orderA = parseNumber(a.numeric_order);
  const orderB = parseNumber(b.numeric_order);

  if (orderA !== null && orderB !== null && orderA !== orderB) {
    return orderA - orderB;
  }

  if (orderA !== null && orderB === null) return -1;
  if (orderA === null && orderB !== null) return 1;

  const nameA = normalizedName(a.name);
  const nameB = normalizedName(b.name);

  const classNumA = parseClassNumberFromName(nameA);
  const classNumB = parseClassNumberFromName(nameB);

  if (classNumA !== null && classNumB !== null && classNumA !== classNumB) {
    return classNumA - classNumB;
  }

  const textCompare = nameA.localeCompare(nameB, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (textCompare !== 0) return textCompare;

  const idA = parseNumber(a.id);
  const idB = parseNumber(b.id);
  if (idA !== null && idB !== null) return idA - idB;

  return 0;
}

export function sortAcademicsClasses<T extends ClassLike>(items: T[]): T[] {
  return [...(items || [])].sort(compareAcademicsClasses);
}
