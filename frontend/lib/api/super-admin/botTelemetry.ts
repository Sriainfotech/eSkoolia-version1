/**
 * Super Admin Bot Telemetry API Client
 *
 * "Ask eSkoolia" query log + recognition-rate summary per resolver_type —
 * lets recognition rates be compared directly once an LLM resolver exists
 * alongside the manifest-fuzzy one.
 */
import { apiRequestWithRefresh } from '@/lib/api-auth';

export interface BotTelemetryRow {
  id: number;
  school_id: number;
  school_name: string | null;
  user_id: number;
  username: string | null;
  query: string;
  resolver_type: string;
  resolved_intent_id: string;
  created_at: string;
}

export interface BotTelemetryPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: BotTelemetryRow[];
}

export interface BotTelemetrySummaryRow {
  resolver_type: string;
  total: number;
  resolved: number;
  recognition_rate: number;
}

export async function getBotTelemetry(params?: { resolver_type?: string; school_id?: number; page?: number }): Promise<BotTelemetryPage> {
  const qs = new URLSearchParams();
  if (params?.resolver_type) qs.set('resolver_type', params.resolver_type);
  if (params?.school_id) qs.set('school_id', String(params.school_id));
  if (params?.page) qs.set('page', String(params.page));
  const query = qs.toString();
  return apiRequestWithRefresh<BotTelemetryPage>(`/api/super-admin/bot-telemetry/${query ? `?${query}` : ''}`);
}

export async function getBotTelemetrySummary(): Promise<BotTelemetrySummaryRow[]> {
  return apiRequestWithRefresh<BotTelemetrySummaryRow[]>('/api/super-admin/bot-telemetry/summary/');
}
