import { API_BASE_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

/** Fire-and-forget — never blocks or breaks the bot's response on failure.
 *  resolverType is always recorded so a future LLM resolver's recognition
 *  rate can be compared directly against this one, per apps/super_admin's
 *  BotTelemetryListView/BotTelemetrySummaryView. */
export function logBotQuery(query: string, resolverType: string, resolvedIntentId: string | 'unrecognized') {
  const token = getAccessToken();
  fetch(`${API_BASE_URL}/api/v1/assistant/telemetry/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, resolver_type: resolverType, resolved_intent_id: resolvedIntentId }),
  }).catch(() => { /* telemetry is best-effort */ });
}
