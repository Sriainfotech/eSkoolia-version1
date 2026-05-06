/** Tracks recently visited pages in localStorage, independent of backend API */

const LS_KEY = 'eskoolia_recents_v1';

export interface RecentEntry {
  path: string;
  visited_at: string;
}

/** Pages that should never appear in recents */
const SKIP_PATHS = new Set(['/', '/home', '/dashboard']);

export function shouldTrack(path: string) {
  return !SKIP_PATHS.has(path);
}

export function saveRecentLS(path: string) {
  if (!shouldTrack(path)) return;
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]') as RecentEntry[];
    const filtered = (Array.isArray(raw) ? raw : []).filter(r => r.path !== path).slice(0, 11);
    filtered.unshift({ path, visited_at: new Date().toISOString() });
    localStorage.setItem(LS_KEY, JSON.stringify(filtered.slice(0, 12)));
  } catch {}
}

export function loadRecentsLS(limit = 8): RecentEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    return Array.isArray(raw) ? raw.slice(0, limit) : [];
  } catch {
    return [];
  }
}
