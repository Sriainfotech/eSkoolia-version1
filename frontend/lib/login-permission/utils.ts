export function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function paginationWindow(
  page: number,
  totalPages: number,
  size = 7
): (number | '...')[] {
  if (totalPages <= size) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const half = Math.floor(size / 2);
  let start = Math.max(1, page - half);
  let end = Math.min(totalPages, start + size - 1);
  if (end - start < size - 1) start = Math.max(1, end - size + 1);

  const pages: (number | '...')[] = [];
  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('...');
  }
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }
  return pages;
}

export function cn(
  ...classes: (string | false | null | undefined)[]
): string {
  return classes.filter(Boolean).join(' ');
}

/** Generates a random-looking password string for mock purposes */
export function genTempPassword(): string {
  const chars =
    'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from(
    { length: 12 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}
