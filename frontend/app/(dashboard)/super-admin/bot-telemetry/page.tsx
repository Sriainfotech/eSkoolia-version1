'use client';

import { useEffect, useState } from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import {
  getBotTelemetry, getBotTelemetrySummary,
  type BotTelemetryRow, type BotTelemetrySummaryRow,
} from '@/lib/api/super-admin/botTelemetry';

/**
 * "Ask eSkoolia" recognition-rate dashboard — one row per resolver_type
 * (manifest-fuzzy today; an LLM resolver would appear here the moment
 * it's switched on in lib/featureFlags.ts, with directly comparable
 * recognition rates against the same query log).
 */
export default function BotTelemetryPage() {
  const [summary, setSummary] = useState<BotTelemetrySummaryRow[]>([]);
  const [rows, setRows] = useState<BotTelemetryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryData, page] = await Promise.all([
        getBotTelemetrySummary(),
        getBotTelemetry({ page: 1 }),
      ]);
      setSummary(summaryData);
      setRows(page.results ?? []);
    } catch {
      setError('Could not load bot telemetry — please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-[var(--pu)]" />
          <div>
            <h1 className="text-lg font-semibold text-[var(--ink-1)]">Ask eSkoolia — Bot Telemetry</h1>
            <p className="text-sm text-[var(--ink-3)]">Recognition rate per resolver, across every school.</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg-2)] px-3 py-1.5 text-sm font-medium text-[var(--ink-2)] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {/* Recognition-rate summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summary.length === 0 && !loading && (
          <div className="col-span-full rounded-lg border border-[var(--bd)] bg-[var(--bg-0)] p-4 text-sm text-[var(--ink-3)]">
            No telemetry recorded yet.
          </div>
        )}
        {summary.map(s => (
          <div key={s.resolver_type} className="rounded-xl border border-[var(--bd)] bg-[var(--bg-0)] p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">{s.resolver_type}</div>
            <div className="mt-1 text-2xl font-bold text-[var(--ink-1)]">{Math.round(s.recognition_rate * 100)}%</div>
            <div className="text-xs text-[var(--ink-3)]">{s.resolved} resolved of {s.total} queries</div>
          </div>
        ))}
      </div>

      {/* Recent queries */}
      <div className="overflow-x-auto rounded-xl border border-[var(--bd)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--bg-2)] text-xs uppercase text-[var(--ink-3)]">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">School</th>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Query</th>
              <th className="px-4 py-2">Resolver</th>
              <th className="px-4 py-2">Resolved as</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-[var(--bd)]">
                <td className="px-4 py-2 text-[var(--ink-3)]">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-2">{r.school_name ?? r.school_id}</td>
                <td className="px-4 py-2">{r.username ?? r.user_id}</td>
                <td className="px-4 py-2">{r.query}</td>
                <td className="px-4 py-2">{r.resolver_type}</td>
                <td className="px-4 py-2">
                  {r.resolved_intent_id === 'unrecognized' ? (
                    <span className="text-amber-600">unrecognized</span>
                  ) : (
                    <span className="text-emerald-600">{r.resolved_intent_id}</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--ink-3)]">No queries logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
