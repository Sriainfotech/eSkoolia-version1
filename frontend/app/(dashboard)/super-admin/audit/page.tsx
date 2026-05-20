'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  Activity, AlertTriangle, Clock, Download, Filter,
  Info, RefreshCw, Search, Shield, Users, XCircle,
} from 'lucide-react';
import { getAuditEvents, exportAuditCsv, downloadAuditCsv } from '@/lib/api/super-admin/audit';
import type { AuditAction, AuditEvent, AuditFilters, AuditSeverity } from '@/types/super-admin';

// -- Severity config --------------------------------------------------------
type SevKey = 'info' | 'warning' | 'error';
const SEV: Record<SevKey, { label: string; cls: string; dotCls: string }> = {
  info:    { label: 'Info',    cls: 'bg-[var(--info-soft)] text-[var(--info)] border-[#BAE6FD]',     dotCls: 'bg-sky-400'   },
  warning: { label: 'Warning', cls: 'bg-[var(--warn-soft)] text-[#92400E] border-[#FDE68A]',          dotCls: 'bg-amber-400' },
  error:   { label: 'Error',   cls: 'bg-[var(--danger-soft)] text-[var(--danger)] border-[#FCA5A5]',  dotCls: 'bg-red-400'   },
};
function normalizeSev(s: string): SevKey {
  if (s === 'critical' || s === 'error' || s === 'failed') return 'error';
  if (s === 'warning' || s === 'partial') return 'warning';
  return 'info';
}

// -- Action badge -----------------------------------------------------------
const ACTION_CLS: Record<string, string> = {
  'auth.login':         'bg-[var(--ok-soft)] text-[#0A6638] border-[#BBF7D0]',
  'auth.logout':        'bg-[var(--bg-3)] text-[var(--ink-2)] border-[var(--bd-2)]',
  'auth.impersonate':   'bg-[var(--warn-soft)] text-[#92400E] border-[#FDE68A]',
  'school.provision':   'bg-[var(--pu-tint)] text-[var(--pu-deep)] border-[var(--pu-soft)]',
  'school.update':      'bg-[var(--pu-tint)] text-[var(--pu-deep)] border-[var(--pu-soft)]',
  'school.archive':     'bg-[var(--danger-soft)] text-[var(--danger)] border-[#FCA5A5]',
  'plan.upgrade':       'bg-[var(--ok-soft)] text-[#0A6638] border-[#BBF7D0]',
  'plan.downgrade':     'bg-[var(--warn-soft)] text-[#92400E] border-[#FDE68A]',
  'invoice.generated':  'bg-[var(--info-soft)] text-[var(--info)] border-[#BAE6FD]',
  'invoice.sent':       'bg-[var(--info-soft)] text-[var(--info)] border-[#BAE6FD]',
  'invoice.overdue':    'bg-[var(--danger-soft)] text-[var(--danger)] border-[#FCA5A5]',
  'api_key.rotate':     'bg-[var(--warn-soft)] text-[#92400E] border-[#FDE68A]',
  'policy.updated':     'bg-[var(--warn-soft)] text-[#92400E] border-[#FDE68A]',
  'migration.start':    'bg-[var(--info-soft)] text-[var(--info)] border-[#BAE6FD]',
  'migration.complete': 'bg-[var(--ok-soft)] text-[#0A6638] border-[#BBF7D0]',
  'migration.rollback': 'bg-[var(--danger-soft)] text-[var(--danger)] border-[#FCA5A5]',
  'backup.complete':    'bg-[var(--ok-soft)] text-[#0A6638] border-[#BBF7D0]',
};
function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_CLS[action] ?? 'bg-[var(--bg-3)] text-[var(--ink-2)] border-[var(--bd-2)]';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-[550] leading-none ${cls}`}>
      {action}
    </span>
  );
}

// -- Severity chip ----------------------------------------------------------
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

// -- Format helpers ---------------------------------------------------------
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

// -- KPI Card --------------------------------------------------------------
function KpiCard({
  label, value, sub, iconBgCls, iconColorCls, Icon, pulse,
}: {
  label: string; value: string | number; sub?: string;
  iconBgCls?: string; iconColorCls?: string; Icon: React.ElementType; pulse?: boolean;
}) {
  return (
    <div className="sa-panel flex items-start gap-4 p-5">
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${iconBgCls ?? 'bg-[var(--bg-3)]'}`}>
        <Icon className={`h-5 w-5 ${iconColorCls ?? 'text-[var(--ink-2)]'}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-[550] uppercase tracking-wider text-[var(--ink-3)]">{label}</p>
        <p className={`mt-0.5 font-serif text-2xl font-bold tabular-nums text-[var(--ink-1)] ${pulse ? 'animate-pulse' : ''}`}>
          {value}
        </p>
        {sub && <p className="mt-0.5 text-[11px] text-[var(--ink-3)]">{sub}</p>}
      </div>
    </div>
  );
}

// -- Filter toggle button --------------------------------------------------
function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-[550] transition-colors ${
        active
          ? 'border-[var(--pu-soft)] bg-[var(--pu-tint)] text-[var(--pu-deep)]'
          : 'border-[var(--bd)] bg-[var(--bg-2)] text-[var(--ink-2)] hover:bg-[var(--bg-3)]'
      }`}
    >
      {label}
    </button>
  );
}

// -- Demo data -------------------------------------------------------------
const DEMO: AuditEvent[] = [
  { id: 'ev-001', timestamp: new Date(Date.now() - 4*60000).toISOString(),     actor: 'superadmin@eskoolia.com', actor_ip: '103.27.8.14',   action: 'school.provision',   detail: 'Provisioned Delhi Public School (schema: dps_noida)',           severity: 'info',    tenant_id: 'ten-dps', school_name: 'Delhi Public School',  status: 'success' },
  { id: 'ev-002', timestamp: new Date(Date.now() - 18*60000).toISOString(),    actor: 'superadmin@eskoolia.com', actor_ip: '103.27.8.14',   action: 'invoice.generated',  detail: 'Invoice INV-2026-0045 generated for Ryan International (₹9,999)', severity: 'info',   tenant_id: 'ten-ryan', school_name: 'Ryan International', status: 'success' },
  { id: 'ev-003', timestamp: new Date(Date.now() - 45*60000).toISOString(),    actor: 'admin@ryan.edu',          actor_ip: '49.207.193.22', action: 'auth.impersonate',   detail: 'Super admin impersonated school admin at Ryan International',   severity: 'warning', tenant_id: 'ten-ryan', school_name: 'Ryan International', status: 'success' },
  { id: 'ev-004', timestamp: new Date(Date.now() - 2*3600000).toISOString(),   actor: 'superadmin@eskoolia.com', actor_ip: '103.27.8.14',   action: 'policy.updated',     detail: 'GST rate changed from 9% to 18% (key: gst.default_rate)',      severity: 'warning', tenant_id: undefined, school_name: undefined,            status: 'success' },
  { id: 'ev-005', timestamp: new Date(Date.now() - 3*3600000).toISOString(),   actor: 'system',                  actor_ip: '127.0.0.1',     action: 'invoice.overdue',    detail: 'Invoice INV-2026-0031 (Sunrise Academy) marked overdue — ₹2,999', severity: 'critical', tenant_id: 'ten-sun', school_name: 'Sunrise Academy',   status: 'failed' },
  { id: 'ev-006', timestamp: new Date(Date.now() - 5*3600000).toISOString(),   actor: 'superadmin@eskoolia.com', actor_ip: '103.27.8.14',   action: 'api_key.rotate',     detail: 'API key rotated for The Heritage School',                      severity: 'warning', tenant_id: 'ten-her', school_name: 'The Heritage School', status: 'success' },
  { id: 'ev-007', timestamp: new Date(Date.now() - 8*3600000).toISOString(),   actor: 'superadmin@eskoolia.com', actor_ip: '103.27.8.14',   action: 'plan.upgrade',       detail: 'Plan upgraded Starter → Premium for Kendriya Vidyalaya',       severity: 'info',    tenant_id: 'ten-kv',  school_name: 'Kendriya Vidyalaya',  status: 'success' },
  { id: 'ev-008', timestamp: new Date(Date.now() - 11*3600000).toISOString(),  actor: 'superadmin@eskoolia.com', actor_ip: '103.27.8.14',   action: 'backup.complete',    detail: 'Nightly backup completed — 47 schemas, 2.4 GB',                severity: 'info',    tenant_id: undefined, school_name: undefined,            status: 'success' },
  { id: 'ev-009', timestamp: new Date(Date.now() - 14*3600000).toISOString(),  actor: 'system',                  actor_ip: '127.0.0.1',     action: 'migration.complete', detail: 'Schema migration v11→v12 completed for all 47 tenants',        severity: 'info',    tenant_id: undefined, school_name: undefined,            status: 'success' },
  { id: 'ev-010', timestamp: new Date(Date.now() - 20*3600000).toISOString(),  actor: 'ops@eskoolia.com',        actor_ip: '49.36.51.109',  action: 'school.archive',     detail: 'School archived: Little Angels (license expired)',              severity: 'critical', tenant_id: 'ten-la', school_name: 'Little Angels',       status: 'success' },
  { id: 'ev-011', timestamp: new Date(Date.now() - 22*3600000).toISOString(),  actor: 'superadmin@eskoolia.com', actor_ip: '103.27.8.14',   action: 'auth.login',         detail: 'Super admin login from 103.27.8.14',                           severity: 'info',    tenant_id: undefined, school_name: undefined,            status: 'success' },
  { id: 'ev-012', timestamp: new Date(Date.now() - 25*3600000).toISOString(),  actor: 'superadmin@eskoolia.com', actor_ip: '103.27.8.14',   action: 'invoice.sent',       detail: 'Invoice INV-2026-0044 sent to Delhi Public School',            severity: 'info',    tenant_id: 'ten-dps', school_name: 'Delhi Public School', status: 'success' },
];

const ACTION_OPTIONS: Array<{ value: AuditAction | '__all__'; label: string }> = [
  { value: '__all__',          label: 'All actions'        },
  { value: 'auth.login',       label: 'auth.login'         },
  { value: 'auth.impersonate', label: 'auth.impersonate'   },
  { value: 'school.provision', label: 'school.provision'   },
  { value: 'school.archive',   label: 'school.archive'     },
  { value: 'plan.upgrade',     label: 'plan.upgrade'       },
  { value: 'plan.downgrade',   label: 'plan.downgrade'     },
  { value: 'invoice.generated',label: 'invoice.generated'  },
  { value: 'invoice.overdue',  label: 'invoice.overdue'    },
  { value: 'api_key.rotate',   label: 'api_key.rotate'     },
  { value: 'policy.updated',   label: 'policy.updated'     },
  { value: 'backup.complete',  label: 'backup.complete'    },
  { value: 'migration.complete',label:'migration.complete' },
  { value: 'migration.rollback',label:'migration.rollback' },
];

const SEV_OPTS: Array<{ value: AuditSeverity | '__all__'; label: string }> = [
  { value: '__all__', label: 'All'      },
  { value: 'info',    label: 'Info'     },
  { value: 'warning', label: 'Warning'  },
  { value: 'critical',label: 'Critical' },
];

// -- Main page -------------------------------------------------------------
export default function SuperAdminAuditPage() {
  const [events,        setEvents]        = useState<AuditEvent[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [useLiveData,   setUseLiveData]   = useState(false);
  const [search,        setSearch]        = useState('');
  const [actionFilter,  setActionFilter]  = useState<AuditAction | '__all__'>('__all__');
  const [sevFilter,     setSevFilter]     = useState<AuditSeverity | '__all__'>('__all__');
  const [showActions,   setShowActions]   = useState(false);
  const [exporting,     setExporting]     = useState(false);
  const [selected,      setSelected]      = useState<AuditEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditEvents({ page: 1, page_size: 200 });
      setEvents(res.results);
      setUseLiveData(true);
    } catch {
      setEvents(DEMO);
      setUseLiveData(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // KPIs
  const kpis = useMemo(() => {
    const h24 = 24 * 3600000;
    return {
      total:       events.length,
      critical:    events.filter(e => normalizeSev(e.severity) === 'error').length,
      actors:      new Set(events.map(e => e.actor)).size,
      last24h:     events.filter(e => Date.now() - new Date(e.timestamp).getTime() < h24).length,
    };
  }, [events]);

  // Filtered rows
  const filtered = useMemo(() => {
    let r = events;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(e =>
        e.actor.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        (e.school_name?.toLowerCase().includes(q) ?? false) ||
        (e.actor_ip?.toLowerCase().includes(q) ?? false)
      );
    }
    if (actionFilter !== '__all__') r = r.filter(e => e.action === actionFilter);
    if (sevFilter !== '__all__') {
      r = r.filter(e => {
        const k = normalizeSev(e.severity);
        if (sevFilter === 'critical') return k === 'error';
        if (sevFilter === 'warning')  return k === 'warning';
        return k === 'info';
      });
    }
    return r;
  }, [events, search, actionFilter, sevFilter]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportAuditCsv();
      downloadAuditCsv(blob);
    } catch {
      toast.error('Export failed — try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-[550] uppercase tracking-widest text-[var(--ink-3)]">
            <span className="font-serif italic font-light">Super Admin</span> · Audit
          </p>
          <h1 className="mt-0.5 text-2xl font-bold text-[var(--ink-1)]">Audit Log</h1>
          <p className="mt-1 text-sm text-[var(--ink-3)]">Immutable record of all platform-level actions</p>
        </div>
        <div className="flex items-center gap-2">
          {!useLiveData && (
            <span className="rounded-full border border-[#FDE68A] bg-[var(--warn-soft)] px-2.5 py-1 text-[11px] font-[550] text-[#92400E]">
              Demo data
            </span>
          )}
          <button
            onClick={load} disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg-2)] px-3 py-2 text-xs font-[550] text-[var(--ink-2)] hover:bg-[var(--bg-3)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg-2)] px-3 py-2 text-xs font-[550] text-[var(--ink-2)] hover:bg-[var(--bg-3)] disabled:opacity-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* ── KPI row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Events"     value={loading ? '—' : kpis.total.toLocaleString()} sub="in loaded window" iconBgCls="bg-purple-50" iconColorCls="text-purple-600" Icon={Activity} pulse={loading} />
        <KpiCard label="Critical / Error" value={loading ? '—' : kpis.critical}              sub="failed actions"   iconBgCls="bg-red-50"    iconColorCls="text-red-500"    Icon={XCircle}  pulse={loading} />
        <KpiCard label="Unique Actors"    value={loading ? '—' : kpis.actors}                sub="distinct users"   iconBgCls="bg-sky-50"    iconColorCls="text-sky-500"    Icon={Users}    pulse={loading} />
        <KpiCard label="Last 24 Hours"    value={loading ? '—' : kpis.last24h}               sub="recent activity"  iconBgCls="bg-emerald-50" iconColorCls="text-emerald-600" Icon={Clock}   pulse={loading} />
      </div>

      {/* ── Log table + detail panel ───────────────────────────────── */}
      <div className="flex gap-5">

        {/* Table */}
        <div className="min-w-0 flex-1">
          <div className="sa-panel overflow-hidden">

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--bd)] p-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--ink-3)]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search actor, action, school, IP…"
                  className="w-full rounded-lg border border-[var(--bd)] bg-[var(--bg-2)] py-2 pl-8 pr-3 text-xs text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--pu-tint)]"
                />
              </div>

              {/* Severity chips */}
              <div className="flex gap-1">
                {SEV_OPTS.map(f => (
                  <FilterBtn key={f.value} label={f.label} active={sevFilter === f.value} onClick={() => setSevFilter(f.value)} />
                ))}
              </div>

              {/* Action filter toggle */}
              <button
                onClick={() => setShowActions(v => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-[550] transition-colors ${
                  showActions || actionFilter !== '__all__'
                    ? 'border-[var(--pu-soft)] bg-[var(--pu-tint)] text-[var(--pu-deep)]'
                    : 'border-[var(--bd)] bg-[var(--bg-2)] text-[var(--ink-2)] hover:bg-[var(--bg-3)]'
                }`}
              >
                <Filter className="h-3 w-3" />
                {actionFilter !== '__all__' ? actionFilter : 'Action'}
              </button>

              <span className="ml-auto text-xs text-[var(--ink-3)]">
                {filtered.length} event{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Action filter dropdown */}
            {showActions && (
              <div className="flex flex-wrap gap-1.5 border-b border-[var(--bd)] px-4 py-3">
                {ACTION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setActionFilter(opt.value as AuditAction | '__all__'); setShowActions(false); }}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-[550] transition-colors ${
                      actionFilter === opt.value
                        ? 'border-[var(--pu-soft)] bg-[var(--pu-tint)] text-[var(--pu-deep)]'
                        : 'border-[var(--bd)] bg-[var(--bg-2)] text-[var(--ink-2)] hover:bg-[var(--bg-3)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Column headers */}
            <div className="flex items-center gap-3 border-b border-[var(--bd)] bg-[var(--bg-2)] px-4 py-2 text-[10px] font-[600] uppercase tracking-wider text-[var(--ink-3)]">
              <div className="w-2 flex-shrink-0" />
              <div className="w-[90px] flex-shrink-0">Time</div>
              <div className="w-[150px] flex-shrink-0">Actor</div>
              <div className="w-[160px] flex-shrink-0">Action</div>
              <div className="min-w-0 flex-1">Detail</div>
              <div className="w-[110px] flex-shrink-0">IP Address</div>
              <div className="w-[72px] flex-shrink-0">Severity</div>
            </div>

            {/* Rows */}
            {loading ? (
              <div className="divide-y divide-[var(--bd)]">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-2 w-2 rounded-full bg-[var(--bg-3)] animate-pulse" />
                    <div className="h-3 w-20 rounded bg-[var(--bg-3)] animate-pulse" />
                    <div className="h-3 w-28 rounded bg-[var(--bg-3)] animate-pulse" />
                    <div className="h-5 w-32 rounded-full bg-[var(--bg-3)] animate-pulse" />
                    <div className="h-3 flex-1 rounded bg-[var(--bg-3)] animate-pulse" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16">
                <Shield className="h-8 w-8 text-[var(--ink-3)]" />
                <p className="text-sm font-[550] text-[var(--ink-2)]">No events match the current filter</p>
                <button
                  onClick={() => { setSearch(''); setActionFilter('__all__'); setSevFilter('__all__'); }}
                  className="text-xs text-[var(--pu-deep)] hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--bd)]">
                {filtered.map(ev => {
                  const { date, time } = fmtTs(ev.timestamp);
                  const sevKey = normalizeSev(ev.severity);
                  const isSelected = selected?.id === ev.id;
                  return (
                    <div
                      key={ev.id}
                      onClick={() => setSelected(isSelected ? null : ev)}
                      className={`flex cursor-pointer items-start gap-3 px-4 py-3 text-xs transition-colors ${
                        isSelected ? 'bg-[var(--pu-tint)]' : 'hover:bg-[var(--bg-2)]'
                      }`}
                    >
                      <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${SEV[sevKey].dotCls}`} />
                      <div className="w-[90px] flex-shrink-0 text-[var(--ink-3)]">
                        <div className="font-[550]">{time}</div>
                        <div>{date}</div>
                      </div>
                      <div className="w-[150px] flex-shrink-0 truncate font-[550] text-[var(--ink-1)]">{ev.actor}</div>
                      <div className="w-[160px] flex-shrink-0"><ActionBadge action={ev.action} /></div>
                      <div className="min-w-0 flex-1 truncate text-[var(--ink-2)]">{ev.detail}</div>
                      <div className="w-[110px] flex-shrink-0 font-mono text-[var(--ink-3)]">{ev.actor_ip ?? '—'}</div>
                      <div className="w-[72px] flex-shrink-0"><SevChip severity={ev.severity} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 flex-shrink-0">
            <div className="sa-panel sticky top-6 space-y-4 p-5 text-sm">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-[550] uppercase tracking-wider text-[var(--ink-3)]">Event Detail</p>
                  <p className="mt-0.5 font-mono text-xs text-[var(--ink-3)]">#{selected.id}</p>
                </div>
                <button
                  aria-label="Close detail panel"
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-1.5 text-[var(--ink-3)] hover:bg-[var(--bg-3)] transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <SevChip severity={selected.severity} />
                <ActionBadge action={selected.action} />
              </div>

              {/* Timestamp */}
              <div className="rounded-lg border border-[var(--bd)] bg-[var(--bg-2)] px-3 py-2.5 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--ink-3)]">Timestamp</span>
                  <span className="font-[550] text-[var(--ink-1)]">{relTime(selected.timestamp)}</span>
                </div>
                <p className="text-xs text-[var(--ink-2)]">{new Date(selected.timestamp).toLocaleString('en-IN')}</p>
              </div>

              {/* Actor */}
              <div className="space-y-0.5">
                <p className="text-[11px] font-[550] uppercase tracking-wider text-[var(--ink-3)]">Actor</p>
                <p className="font-[550] text-[var(--ink-1)]">{selected.actor}</p>
                {selected.actor_ip && <p className="font-mono text-xs text-[var(--ink-3)]">{selected.actor_ip}</p>}
              </div>

              {/* School */}
              {selected.school_name && (
                <div className="space-y-0.5">
                  <p className="text-[11px] font-[550] uppercase tracking-wider text-[var(--ink-3)]">School</p>
                  <p className="font-[550] text-[var(--ink-1)]">{selected.school_name}</p>
                  {selected.tenant_id && <p className="font-mono text-xs text-[var(--ink-3)]">{selected.tenant_id}</p>}
                </div>
              )}

              {/* Detail */}
              <div className="space-y-0.5">
                <p className="text-[11px] font-[550] uppercase tracking-wider text-[var(--ink-3)]">Detail</p>
                <p className="text-sm leading-relaxed text-[var(--ink-2)]">{selected.detail}</p>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <p className="text-[11px] font-[550] uppercase tracking-wider text-[var(--ink-3)]">Status</p>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-[550] ${
                  selected.status === 'success'
                    ? 'bg-[var(--ok-soft)] text-[#0A6638] border-[#BBF7D0]'
                    : selected.status === 'partial'
                    ? 'bg-[var(--warn-soft)] text-[#92400E] border-[#FDE68A]'
                    : 'bg-[var(--danger-soft)] text-[var(--danger)] border-[#FCA5A5]'
                }`}>
                  {selected.status}
                </span>
              </div>

              {/* Error */}
              {selected.error_message && (
                <div className="rounded-lg border border-[#FCA5A5] bg-[var(--danger-soft)] px-3 py-2.5">
                  <p className="text-[11px] font-[550] uppercase tracking-wider text-[var(--danger)]">Error</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--danger)]">{selected.error_message}</p>
                </div>
              )}

              {/* Affected fields diff */}
              {selected.affected_fields && selected.affected_fields.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-[550] uppercase tracking-wider text-[var(--ink-3)]">Changed Fields</p>
                  {selected.affected_fields.map(field => (
                    <div key={field} className="rounded-lg border border-[var(--bd)] bg-[var(--bg-2)] px-3 py-1.5 text-xs">
                      <p className="font-mono font-[550] text-[var(--ink-1)]">{field}</p>
                      {selected.before_values?.[field] !== undefined && (
                        <p className="text-[var(--danger)] line-through">{String(selected.before_values[field])}</p>
                      )}
                      {selected.after_values?.[field] !== undefined && (
                        <p className="text-[#0A6638]">{String(selected.after_values[field])}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}