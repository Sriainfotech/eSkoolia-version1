import type { FAQProvider } from '@/types/bot';
import { API_BASE_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

interface FAQRow {
  topic_key: string;
  keywords: string[];
  answer: string;
}

let _cache: FAQRow[] | null = null;
let _cacheAt = 0;
let _inflight: Promise<FAQRow[]> | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadEntries(): Promise<FAQRow[]> {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS) return _cache;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/assistant/faq/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const rows: FAQRow[] = res.ok ? await res.json() : [];
      _cache = rows;
      _cacheAt = Date.now();
      return rows;
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

/** Clears the cached FAQ list — call on logout, same as clearPermissionsCache(). */
export function clearFAQCache() {
  _cache = null;
  _cacheAt = 0;
  _inflight = null;
}

/**
 * Backs both classify() and lookup() from one tenant-scoped table
 * (apps/assistant/models.py::FAQEntry), replacing the previously
 * disconnected PARENT_FAQ (components/AIBot.tsx) and QA_TOPICS
 * (lib/aiBotIntent.ts) dicts — classify() and lookup() now share the same
 * topic_key, so a classified topic always has a matching answer.
 */
export class BackendFAQProvider implements FAQProvider {
  providerType = 'backend-table';
  private entries: FAQRow[] = [];

  private async ensureLoaded() {
    this.entries = await loadEntries();
  }

  classify(query: string): string | null {
    const norm = query.toLowerCase();
    // Longer keyword matches win (e.g. "fees due" over "fee") so a more
    // specific phrase isn't shadowed by a shorter generic one.
    let best: { topicKey: string; len: number } | null = null;
    for (const entry of this.entries) {
      for (const kw of entry.keywords) {
        if (norm.includes(kw.toLowerCase()) && (!best || kw.length > best.len)) {
          best = { topicKey: entry.topic_key, len: kw.length };
        }
      }
    }
    return best?.topicKey ?? null;
  }

  async lookup(topicKey: string): Promise<string | null> {
    await this.ensureLoaded();
    return this.entries.find(e => e.topic_key === topicKey)?.answer ?? null;
  }

  /** classify() needs entries loaded first — call once before use (AIBot.tsx
   *  does this on open, same pattern as usePermissions' initial fetch). */
  async preload(): Promise<void> {
    await this.ensureLoaded();
  }
}
