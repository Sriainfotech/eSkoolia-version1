import type {
  BotAction, BotContext, BotEntityResult, BotModuleManifest,
  DisambiguationResult, IntentResolver, ResolvedIntent,
} from '@/types/bot';
import { API_BASE_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { ALL_MANIFESTS, getFilteredManifests } from '../manifestLoader';

function normalize(q: string): string {
  return q.toLowerCase().trim().replace(/[?.!]+$/, '').replace(/\s+/g, ' ');
}

const LOOKUP_VERBS = /^(find|search|lookup|show|who is|get|look up)\s+/i;
// Ported from the previous report-absence detection in lib/aiBotIntent.ts —
// module-specific extraction now lives in the attendance manifest's
// resolver step, not in a shared/generic file.
const ABSENCE_TRIGGER = /\b(report\s+abs[e]?nce|mark\s+(\w+\s+){0,2}abs[e]?nt|child\s+is\s+(sick|ill|unwell)|child\s+(won'?t|cannot|can'?t)\s+(come|attend)|not\s+coming\s+today|sick\s+today|home\s+sick|abs[e]?nt\s+today)\b/i;
const REASON_WORDS: Record<string, string> = {
  sick: 'Sick', ill: 'Unwell', unwell: 'Unwell',
};

// Filler words that surround a name in natural absence phrasing
// ("Rahul is sick today", "mark Priya absent") — stripped only on the
// attendance manifest's action-trigger path so the remainder is just the
// name to search for.
const ABSENCE_FILLER_WORDS = /\b(mark|report|is|was|won'?t|cannot|can'?t|come|attend|today|home|absent|sick|ill|unwell)\b/gi;

function extractResidualQuery(norm: string, manifest: BotModuleManifest, stripFillerWords = false): string {
  let residual = norm.replace(LOOKUP_VERBS, '');
  for (const kw of manifest.keywords) residual = residual.replace(kw.toLowerCase(), '');
  if (stripFillerWords) residual = residual.replace(ABSENCE_FILLER_WORDS, '');
  return residual.replace(/^(student[s]?|for|about)\s+/i, '').replace(/\s+/g, ' ').trim();
}

// Ported from the previous student-lookup heuristic in lib/aiBotIntent.ts:
// a lookup verb ("find X"), or short alphabetic text that isn't a page/
// module keyword, reads as a name rather than a command. Checked against
// EVERY manifest's keywords (not just RBAC/ABAC-filtered ones) — "fees
// due" on a plan without fees_enabled is still a fees query, not a name,
// even though the fees manifest itself was filtered out upstream.
function looksLikeNameQuery(norm: string): boolean {
  const matchesAnyManifestKeyword = ALL_MANIFESTS.some(m => m.keywords.some(kw => norm.includes(kw.toLowerCase())));
  if (matchesAnyManifestKeyword) return false;
  if (LOOKUP_VERBS.test(norm)) return true;
  return /^[a-z][\w\s\-']+$/i.test(norm) && norm.split(/\s+/).length <= 4;
}

function extractAbsenceReason(norm: string): string {
  for (const [word, label] of Object.entries(REASON_WORDS)) {
    if (norm.includes(word)) return label;
  }
  return 'Reported via Ask eSkoolia';
}

async function searchEntities(manifest: BotModuleManifest, params: Record<string, string>): Promise<BotEntityResult[]> {
  const token = getAccessToken();
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${API_BASE_URL}${manifest.entity.endpoint}?${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows: Record<string, unknown>[] = Array.isArray(data) ? data : (data.results ?? []);
    return rows.map(row => ({
      id: row.id as string | number,
      displayLabel: manifest.entity.displayFields
        .map(f => row[f])
        .filter(Boolean)
        .slice(0, 1)
        .join(' ') || String(row.id),
      subtitle: manifest.entity.displayFields.slice(1).map(f => row[f]).filter(Boolean).join(' · '),
      raw: row,
    }));
  } catch {
    return [];
  }
}

/** Builds the student-name display label the way the students/attendance
 *  entity rows actually shape it (first_name + last_name), since
 *  displayFields[0] alone ('fullName') already covers this for the
 *  students endpoint's raw shape. Kept simple for the pilot set. */
function studentDisplayLabel(row: Record<string, unknown>): string {
  const first = (row.first_name as string) ?? '';
  const last = (row.last_name as string) ?? '';
  return `${first} ${last}`.trim() || String(row.id);
}

/**
 * Wraps the manifest set behind the same fuzzy-keyword-scoring approach
 * lib/aiSearch.ts used for page navigation, generalized to route across
 * whatever manifests getFilteredManifests() (RBAC/ABAC) allows for this
 * user/tenant, instead of a hand-written per-module if-chain.
 */
export class ManifestFuzzyResolver implements IntentResolver {
  resolverType = 'manifest-fuzzy';

  async resolve(query: string, context: BotContext): Promise<ResolvedIntent | DisambiguationResult | null> {
    const norm = normalize(query);
    const manifests = getFilteredManifests(context);

    const scored = manifests
      .map(m => ({
        manifest: m,
        score: m.keywords.reduce((acc, kw) => norm.includes(kw.toLowerCase()) ? acc + kw.length : acc, 0),
      }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      // No manifest keyword matched — but a bare/lookup-verb'd name
      // ("find rahul", "Rahul Sharma") should still route to the students
      // manifest, same as the previous looksLikeName heuristic in
      // lib/aiBotIntent.ts. Names can't be enumerated as keywords, so this
      // is a students-specific fallback, not a generic scoring path.
      const studentsManifest = manifests.find(m => m.id === 'students');
      if (studentsManifest && looksLikeNameQuery(norm)) {
        return this.resolveWithManifest(norm, query, studentsManifest, context);
      }
      return null;
    }

    // Two manifests scored the query equally well — ask rather than guess.
    if (scored.length > 1 && scored[0].score === scored[1].score) {
      const tied = scored.filter(s => s.score === scored[0].score);
      return {
        kind: 'disambiguation',
        prompt: `I can look that up in a couple of places — which did you mean?`,
        options: tied.map(t => ({
          label: t.manifest.label,
          // A chosen disambiguation option must resolve directly to a
          // ResolvedIntent or null (no nested disambiguation) — if this
          // manifest itself would need a further entity disambiguation,
          // fall back to null rather than nesting.
          resolve: async () => {
            const r = await this.resolveWithManifest(norm, query, t.manifest, context);
            return r?.kind === 'resolved' ? r : null;
          },
        })),
      };
    }

    return this.resolveWithManifest(norm, query, scored[0].manifest, context);
  }

  private async resolveWithManifest(
    norm: string, rawQuery: string, manifest: BotModuleManifest, context: BotContext,
  ): Promise<ResolvedIntent | DisambiguationResult | null> {
    const action = manifest.actions[0]; // pilot set: at most one action per manifest
    const isActionTrigger = manifest.id === 'attendance' && ABSENCE_TRIGGER.test(norm);

    if (manifest.entity.searchFields.includes('search')) {
      const residual = extractResidualQuery(norm, manifest, isActionTrigger);

      // No name in the query — fall back to lastViewedEntity for an
      // action-trigger ("mark him absent"); otherwise let it fall through
      // (matches the previous "find student" with no name → fuzzy fallback).
      if (!residual || residual.length < 2) {
        if (isActionTrigger && action && context.lastViewedEntity?.type === 'student') {
          return this.buildActionIntent(manifest, action, context.lastViewedEntity.id, context.lastViewedEntity.label, norm);
        }
        return null;
      }

      const results = await searchEntities(manifest, { search: residual, limit: '8' });
      const withLabels = results.map(r => ({ ...r, displayLabel: studentDisplayLabel(r.raw) }));

      if (isActionTrigger && action) {
        if (withLabels.length === 1) {
          return this.buildActionIntent(manifest, action, withLabels[0].id, withLabels[0].displayLabel, norm);
        }
        if (withLabels.length > 1) {
          return {
            kind: 'disambiguation',
            prompt: `Found ${withLabels.length} students matching "${residual}" — which one?`,
            options: withLabels.map(r => ({
              label: r.displayLabel,
              description: r.subtitle,
              resolve: async () => this.buildActionIntent(manifest, action, r.id, r.displayLabel, norm),
            })),
          };
        }
        return { kind: 'resolved', manifest, entityResults: [] };
      }

      return { kind: 'resolved', manifest, entityResults: withLabels };
    }

    // Id-keyed lookup (e.g. fees, filtered by student id) — needs a
    // recently-viewed entity from this session; otherwise fall through so
    // the FAQ path can answer generically instead.
    if (context.lastViewedEntity?.type === 'student') {
      const results = await searchEntities(manifest, { student: String(context.lastViewedEntity.id) });
      return { kind: 'resolved', manifest, entityResults: results };
    }
    return null;
  }

  private buildActionIntent(
    manifest: BotModuleManifest, action: BotAction,
    studentId: string | number, studentLabel: string, norm: string,
  ): ResolvedIntent {
    return {
      kind: 'resolved',
      manifest,
      action,
      params: {
        student_id: studentId,
        attendance_date: new Date().toISOString().slice(0, 10),
        notes: extractAbsenceReason(norm),
        _studentLabel: studentLabel, // display-only, not sent to execute()'s API call
      },
    };
  }
}
