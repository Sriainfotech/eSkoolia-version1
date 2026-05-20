'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Download, RefreshCw, Search, Shield } from 'lucide-react';
import { getAuditEvents, exportAuditCsv, downloadAuditCsv } from '@/lib/api/super-admin/audit';
import type { AuditEvent } from '@/types/super-admin';

// -- Severity helpers -------------------------------------------------------
type SevKey = 'info' | 'warning' | 'error';
const SEV: Record<SevKey, { label: string; cls: string; dotCls: string }> = {
  info:    { label: 'Info',    cls: 'bg-[var(--info-soft)] text-[var(--info)] border-[#BAE6FD]',    dotCls: 'bg-sky-400'   },
  warning: { label: 'Warning', cls: 'bg-[var(--warn-soft)] text-[#92400E] border-[#FDE68A]',         dotCls: 'bg-amber-400' },
  error:   { label: 'Error',   cls: 'bg-[var(--danger-soft)] text-[var(--danger)] border-[#FCA5A5]', dotCls: 'bg-red-400'   },
};
function normalizeSev(s: string): SevKey {
  if (s === 'critical' || s === 'error' || s === 'failed') return 'error';
  if (s === 'warning'  || s === 'partial')                 return 'warning';
  return 'info';
}

// -- Action badge -----------------------------------------------------------
const ACTION_CLS: Record<string, string> = {
  'school.provision':   'bg-[var(--pu-tint)] text-[var(--pu-deep)] border-[var(--pu-soft)]',
  'school.update':      'bg-[var(--pu-tint)] text-[var(--pu-deep)] border-[var(--pu-soft)]',
  'school.archive':     'bg-[var(--danger-soft)] text-[var(--danger)] border-[#FCA5A5]',
  'auth.login':         'bg-[var(--ok-soft)] text-[#0A6638] border-[#BBF7D0]',
  'auth.logout':        'bg-[var(--bg-3)] text-[var(--ink-2)] border-[var(--bd-2)]',
  'auth.impersonate':   'bg-[var(--warn-soft)] text-[#92400E] border-[#FDE68A]',
  'plan.upgrade':       'bg-[var(--ok-soft)] text-[#0A6638] border-[#BBF7D0]',
  'plan.downgrade':     'bg-[var(--warn-soft)] text-[#92400E] border-[#FDE68A]',
  'invoice.generated':  'bg-[var(--info-soft)] text-[var(--info)] border-[#BAE6FD]',
  'invoice.sent':       'bg-[var(--info-soft)] text-[var(--info)] border-[#BAE6FD]',
  'invoice.overdue':    'bg-[var(--danger-soft)] text-[var(--danger)] border-[#FCA5A5]',
  'api_key.rotate':     'bg-[var(--warn-soft)] text-[#92400E] border-[#FDE68A]',
  'policy.updated':     'bg-[var(--warn-soft)] text-[#92400E] border-[#FDE68A]',
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_CLS[action] ?? 'bg-[var(--bg-3)] text-[var(--ink-2)] border-[var(--bd-2)]';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-[550] leading-none ${cls}`}>
      {action}
    </span>
  );
}

function SevChip({ severity }: { severity: string }) {
  const key = normalizeSev(severity);
  const { label, cls, dotCls } = SEV[key];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-[550] leading-none ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
      {label}
    </span>
  );
}

function fmtTs(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  };
}
function relTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// -- Main page -------------------------------------------------------------
export default function SchoolAuditPage({ params }: { params: { tenantId: string } }) {
  const { tenantId } = params;
  const router = useRouter();

  const [events,    setEvents]    = useState<AuditEvent[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [exporting, setExporting] = useState(false);
  const [selected,  setSelected]  = useState<AuditEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditEvents({ tenant_id: tenantId, page: 1, page_size: 200 });
      setEvents(res.results);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return events;
    const q = search.toLowerCase();
    return events.filter(e =>
      e.actor.toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q) ||
      e.detail.toLowerCase().includes(q) ||
      (e.actor_ip?.toLowerCase().includes(q) ?? false),
    );
  }, [events, search]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportAuditCsv({ tenant_id: tenantId });
      downloadAuditCsv(blob);
    } catch {
      // silent — CSV export is best-effort
    } finally {
      setExporting(false);
    }
  };

  const criticalCount = useMemo(() => events.filter(e => normalizeSev(e.severity) === 'error').length, [events]);

  return (
    <div className="space-y-6 p-6">

      {/* ── Back + Header ──────────────────────────────────────────────── */}
      <div>
        <button
          onClick={() => router.back()}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-[550] text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
        >
          <ArrowLeft size={13} />
          Back to Schools
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-[550] uppercase tracking-widest text-[var(--ink-3)]">
              <span className="font-serif italic font-light">School Tenancy</span> · Audit
            </p>
            <h1 className="mt-0.5 text-2xl font-bold text-[var(--ink-1)]">Audit Log</h1>
            <p className="mt-1 text-sm text-[var(--ink-3)]">
              Activity trail for <span className="font-[550] text-[var(--ink-2)]">{tenantId}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg-2)] px-3 py-2 text-xs font-[550] text-[var(--ink-2)] hover:bg-[var(--bg-3)] disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || events.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg-2)] px-3 py-2 text-xs font-[550] text-[var(--ink-2)] hover:bg-[var(--bg-3)] disabled:opacity-50"
            >
              <Download size={13} />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="sa-panel flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--pu-tint)]">
            <Shield className="h-4 w-4 text-[var(--pu-deep)]" />
          </div>
          <div>
            <p className="text-[10px] font-[550] uppercase tracking-wider text-[var(--ink-3)]">Total Events</p>
            <p className="mt-0.5 font-serif text-xl font-bold tabular-nums text-[var(--ink-1)]">
              {loading ? '—' : events.length}
            </p>
          </div>
        </div>

        <div className="sa-panel flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--danger-soft)]">
            <Shield className="h-4 w-4 text-[var(--danger)]" />
          </div>
          <div>
            <p className="text-[10px] font-[550] uppercase tracking-wider text-[var(--ink-3)]">Errors / Failed</p>
            <p className="mt-0.5 font-serif text-xl font-bold tabular-nums text-[var(--ink-1)]">
              {loading ? '—' : criticalCount}
            </p>
          </div>
        </div>

        <div className="sa-panel flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--ok-soft)]">
            <Clock className="h-4 w-4 text-[#0A6638]" />
          </div>
          <div>
            <p className="text-[10px] font-[550] uppercase tracking-wider text-[var(--ink-3)]">Last 24 h</p>
            <p className="mt-0.5 font-serif text-xl font-bold tabular-nums text-[var(--ink-1)]">
              {loading ? '—' : events.filter(e => Date.now() - new Date(e.timestamp).getTime() < 86400000).length}
            </p>
          </div>
        </div>
      </div>

      {/* ── Search + Table ─────────────────────────────────────────────── */}
      <div className="sa-panel overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[var(--bd)] px-4 py-3">
          <Search size={14} className="text-[var(--ink-3)]" />
          <input
            type="text"
            placeholder="Search events…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[var(--ink-1)] placeholder:text-[var(--ink-3)] outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-xs text-[var(--ink-3)] hover:text-[var(--ink-1)]">
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-[var(--ink-3)]">Loading audit events…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--ink-3)]">
            {events.length === 0 ? 'No audit events recorded for this school yet.' : 'No events match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--bd)] bg-[var(--bg-2)]">
                  <th className="px-4 py-2.5 text-left text-[11px] font-[600] uppercase tracking-wider text-[var(--ink-3)]">Timestamp</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-[600] uppercase tracking-wider text-[var(--ink-3)]">Action</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-[600] uppercase tracking-wider text-[var(--ink-3)]">Actor</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-[600] uppercase tracking-wider text-[var(--ink-3)]">Detail</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-[600] uppercase tracking-wider text-[var(--ink-3)]">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--bd)]">
                {filtered.map(ev => {
                  const ts = fmtTs(ev.timestamp);
                  return (
                    <tr
                      key={ev.id}
                      onClick={() => setSelected(ev)}
                      className="cursor-pointer hover:bg-[var(--bg-2)] transition-colors"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="font-[550] text-[var(--ink-1)]">{ts.date}</p>
                        <p className="text-[11px] text-[var(--ink-3)]">{ts.time} · {relTime(ev.timestamp)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={ev.action} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-[550] text-[var(--ink-1)]">{ev.actor}</p>
                        {ev.actor_ip && <p className="text-[11px] text-[var(--ink-3)]">{ev.actor_ip}</p>}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-[var(--ink-2)]">
                        <p className="line-clamp-2 text-xs">{ev.detail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <SevChip severity={ev.severity} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail drawer ──────────────────────────────────────────────── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 sm:items-start"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-[var(--bd)] bg-[var(--bg-1)] p-6 shadow-xl sm:m-4 sm:rounded-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-[var(--ink-1)]">Event Detail</h3>
              <button onClick={() => setSelected(null)} className="text-xs text-[var(--ink-3)] hover:text-[var(--ink-1)]">Close</button>
            </div>
            <dl className="space-y-3 text-sm">
              {[
                ['ID',        selected.id],
                ['Timestamp', `${fmtTs(selected.timestamp).date} ${fmtTs(selected.timestamp).time}`],
                ['Action',    selected.action],
                ['Actor',     selected.actor],
                ['IP',        selected.actor_ip ?? '—'],
                ['Detail',    selected.detail],
                ['Status',    selected.status ?? '—'],
              ].map(([label, val]) => (
                <div key={label} className="flex gap-2">
                  <dt className="w-24 flex-shrink-0 font-[550] text-[var(--ink-3)]">{label}</dt>
                  <dd className="flex-1 break-words text-[var(--ink-1)]">{val}</dd>
                </div>
              ))}
              {selected.before_values && Object.keys(selected.before_values as object).length > 0 && (
                <div className="flex gap-2">
                  <dt className="w-24 flex-shrink-0 font-[550] text-[var(--ink-3)]">Before</dt>
                  <dd className="flex-1 break-words font-mono text-[11px] text-[var(--ink-1)]">
                    {JSON.stringify(selected.before_values, null, 2)}
                  </dd>
                </div>
              )}
              {selected.after_values && Object.keys(selected.after_values as object).length > 0 && (
                <div className="flex gap-2">
                  <dt className="w-24 flex-shrink-0 font-[550] text-[var(--ink-3)]">After</dt>
                  <dd className="flex-1 break-words font-mono text-[11px] text-[var(--ink-1)]">
                    {JSON.stringify(selected.after_values, null, 2)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
