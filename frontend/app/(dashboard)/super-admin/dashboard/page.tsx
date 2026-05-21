'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link'; // Fix #4 #9
import { useRouter } from 'next/navigation'; // Fix #2
import {
  AlertTriangle, CheckCircle2, Mail, XCircle, Download, Plus, RefreshCw,
} from 'lucide-react';
import { getDashboard } from '@/lib/api/super-admin/dashboard';
import type { DashboardData } from '@/types/super-admin';

// ── Activity icon ──────────────────────────────────────────────────────────
function ActivityIcon({ action, severity }: { action: string; severity: string }) {
  const a = action.toLowerCase();
  const isOk      = a.includes('provision') || a.includes('created') || a.includes('activated');
  const isUpgrade = a.includes('upgrade') || a.includes('plan') || a.includes('migrat');
  const isWarn    = severity === 'warning' || a.includes('threshold') || a.includes('storage');
  const isDanger  = severity === 'error' || severity === 'critical' || a.includes('overdue') || a.includes('suspend');

  if (isDanger)  return <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><XCircle size={14} color="#DC2626" /></span>;
  if (isWarn)    return <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AlertTriangle size={14} color="#D97706" /></span>;
  if (isUpgrade) return <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Mail size={14} color="#6D28D9" /></span>;
  return           <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CheckCircle2 size={14} color="#15803D" /></span>;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string { // Fix #16 – show date for events older than 7 days
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d <= 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function fmtINR(n: number): string {
  if (n >= 100000) return `\u20b9${(n / 100000).toFixed(2)}L`;
  if (n >= 1000)   return `\u20b9${(n / 1000).toFixed(0)}K`;
  return `\u20b9${n}`;
}

function fmtStudents(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

const ACTION_LABELS: Record<string, string> = {
  'school.provision':   'School provisioned',
  'school.archive':     'School archived',
  'school.update':      'School updated',
  'school.suspend':     'School suspended',
  'school.activate':    'School activated',
  'plan.upgrade':       'Plan upgraded',
  'plan.downgrade':     'Plan downgraded',
  'storage.threshold':  'Storage threshold exceeded',
  'invoice.overdue':    'Invoice overdue',
  'invoice.paid':       'Invoice paid',
  'auth.impersonate':   'Admin impersonation',
  'api_key.rotate':     'API key rotated',
  'backup.complete':    'Backup completed',
  'policy.update':      'Policy updated',
  'provision_failed':   'Provisioning failed',
  'seeding_completed':  'Data seeding completed',
  'migrations_ran':     'Migrations ran',
};

function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return action.replace(/_/g, ' ').replace(/\./g, ' \u00b7 ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Export helper ────────────────────────────────────────────────────────
// Fix #1 – wire Export button to generate a CSV from current dashboard state
function exportDashboardCsv(d: DashboardData) {
  const rows: (string | number)[][] = [
    ['Metric', 'Value'],
    ['Total Schools', d.totalSchools],
    ['Active Schools', d.activeSchools],
    ['Total Students', d.totalStudents],
    ['Active Students', d.activeStudents ?? ''],
    ['Inactive Students', d.inactiveStudents ?? ''],
    ['Total Staff', d.totalStaff],
    ['MRR (INR)', d.mrr.current],
    ['MRR Trend (%)', d.mrr.trend],
    ['Alert Count', d.alertCount],
    ['Overdue Invoices', d.overdueCount ?? ''],
    ['Blocked Tenants', d.blockedCount ?? ''],
  ];
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eskoolia-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Constants ──────────────────────────────────────────────────────────────
const FALLBACK: DashboardData = {
  totalSchools: 0,
  activeSchools: 0,
  totalStudents: 0,
  activeStudents: 0,
  inactiveStudents: 0,
  totalStaff: 0,
  mrr: { current: 0, previous: 0, trend: 0 },
  alertCount: 0,
  boardBreakdown: [],
  trends: { students: 0, mrr: 0 },
  recentEvents: [],
};

const STATE_COLOR: Record<string, string> = {
  'Telangana': '#5836E0',   'Andhra Pradesh': '#A65D08',
  'Karnataka': '#0369A1',   'Tamil Nadu': '#059669',
  'Maharashtra': '#6D28D9', 'Delhi': '#DC2626',
};

const PLAN_COLOR: Record<string, string> = {
  'Enterprise': '#5836E0', 'Premium': '#4F46E5',
  'Standard': '#6D28D9',   'Starter': '#8B5CF6', 'Trial': '#9CA3AF',
};

const BOARD_COLOR: Record<string, string> = {
  CBSE:     '#5836E0',
  ICSE:     '#0369A1',
  'SSC AP': '#A65D08',
  SSC_AP:   '#A65D08',
  'SSC TG': '#B42318',
  SSC_TG:   '#B42318',
  OTHER:    '#6B7280',
};

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skel({ h = 16, w = '100%' }: { h?: number; w?: number | string }) {
  return <div style={{ height: h, width: w, borderRadius: 8, background: '#F3F4F6' }} className="animate-pulse" />;
}
function DashboardSkeleton() {
  const card = { background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: 20 };
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><Skel h={32} w={280} /><Skel h={16} w={420} /></div>
        <div style={{ display: 'flex', gap: 8 }}><Skel h={36} w={90} /><Skel h={36} w={110} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {[0,1,2,3].map(i => <div key={i} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}><Skel h={12} w={100} /><Skel h={38} w={80} /><Skel h={12} w={120} /></div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {[0,1].map(i => <div key={i} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}><Skel h={18} w={160} />{[0,1,2,3].map(j => <Skel key={j} h={28} />)}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {[0,1].map(i => <div key={i} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}><Skel h={18} w={160} />{[0,1,2,3].map(j => <Skel key={j} h={28} />)}</div>)}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function SuperAdminDashboardPage() {
  const router = useRouter(); // Fix #2
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null); // Fix #18
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState(''); // Fix #18

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboard();
      setData(res);
      setLastUpdated(new Date()); // Fix #18 – record last successful load time
    } catch (err) {
      // Fix #8 – do not populate zero-filled fallback; let the error state render instead
      setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  // Fix #18 – auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => { void loadDashboard(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  // Fix #18 – update "Last updated" label every minute
  useEffect(() => {
    if (!lastUpdated) return;
    const update = () => {
      const mins = Math.round((Date.now() - lastUpdated.getTime()) / 60000);
      setLastUpdatedLabel(mins < 1 ? 'just now' : `${mins} min ago`);
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, [lastUpdated]);

  if (loading && data === null) return <DashboardSkeleton />;

  // Fix #8 – show an explicit error state instead of zero-filled KPI cards
  if (error && data === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 16 }}>
        <AlertTriangle size={36} color="#D97706" />
        <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>Unable to load dashboard data</p>
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0, maxWidth: 400, textAlign: 'center' }}>{error}</p>
        <button
          type="button"
          onClick={() => { void loadDashboard(); }}
          style={{ marginTop: 8, height: 36, padding: '0 20px', borderRadius: 9, border: 'none', background: '#6D28D9', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  const d         = data ?? FALLBACK;
  const boardRows = d.boardBreakdown ?? [];
  const events    = d.recentEvents ?? [];
  const maxBoard    = Math.max(...boardRows.map(b => b.count), 1);
  const stateRows   = (d.stateBreakdown && d.stateBreakdown.length > 0) ? d.stateBreakdown : [];
  const planRows    = (d.planBreakdown  && d.planBreakdown.length  > 0) ? d.planBreakdown  : [];
  const maxState    = Math.max(...stateRows.map(s => s.count), 1);
  const planMrrTotal = planRows.reduce((sum, p) => sum + p.mrr, 0);
  const effectiveMrr = d.mrr.current > 0 ? d.mrr.current : planMrrTotal;
  const revenueRows = planRows.filter(p => p.mrr > 0); // Fix #14 – exclude ₹0 Trial plans from the MRR chart
  const maxPlan     = Math.max(...revenueRows.map(p => p.mrr), 1); // Fix #14
  const mrrTrend  = d.mrr.trend != null ? `${d.mrr.trend > 0 ? '+' : ''}${d.mrr.trend.toFixed(1)}%` : '\u2014'; // Fix #11 – show 0.0% when trend is exactly 0, not —
  const gstAmt    = Math.round(effectiveMrr * 0.18);

  // shared card style
  const card: React.CSSProperties = {
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #E5E7EB',
    padding: 24,
  };

  return (
    <div style={{ padding: '8px 20px 20px' }}>

      {/* ── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0 6px', margin: 0, lineHeight: 1.2 }}>
            <span style={{ fontSize: 34, fontWeight: 600, color: '#0F1222', letterSpacing: '-1px' }}>Super Admin</span>
            <span style={{ fontSize: 38, fontWeight: 400, fontStyle: 'italic', color: '#6D4AFF', fontFamily: 'var(--font-instrument-serif), serif', letterSpacing: '-0.5px' }}>Dashboard</span>
          </h1>
          <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: '#4B5563', maxWidth: 560 }}>
            Cross-tenant overview of every school on the Eskoolia platform.
            {' \u00b7 '}<strong style={{ color: '#111827', fontWeight: 600 }}>{d.totalSchools} schools</strong>
            {' \u00b7 '}<strong style={{ color: '#111827', fontWeight: 600 }}>{d.totalStudents.toLocaleString('en-IN')} students</strong>
            {' served across India \u00b7 GST-compliant billing & full data isolation.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          {/* Fix #8 – removed misleading "Showing cached data" banner */}
          {lastUpdated && (
            <span style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>Updated {lastUpdatedLabel}</span>
          )} {/* Fix #18 – last updated label */}
          <button
            type="button"
            onClick={() => { void loadDashboard(); }} // Fix #18 – manual refresh
            disabled={loading}
            title="Refresh dashboard"
            style={{ height: 36, width: 36, borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}
          >
            <RefreshCw size={14} color="#374151" />
          </button>
          <button
            type="button"
            onClick={() => exportDashboardCsv(d)} // Fix #1 – wire Export to CSV download
            style={{ height: 36, padding: '0 14px', borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <Download size={14} /> Export
          </button>
          <button
            type="button"
            onClick={() => router.push('/super-admin/schools?add=1')} // Fix #2 – navigate with ?add=1 to auto-open the Add School accordion
            style={{ height: 36, padding: '0 14px', borderRadius: 9, border: 'none', background: '#6D28D9', fontSize: 13, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <Plus size={14} /> Add school
          </button>
        </div>
      </div>

      {/* ── KPI ROW ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>

        {/* Total Schools */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '18px 20px' }}>
          <div style={{ marginBottom: 6 }}>{/* Fix #3 – sparkline removed (was hardcoded fake data) */}
            <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', lineHeight: 1, margin: 0 }}>Total Schools</p>
          </div>
          <p style={{ fontSize: 50, fontFamily: 'var(--font-instrument-serif), serif', fontWeight: 400, lineHeight: 0.95, letterSpacing: '-1.5px', color: '#111827', margin: '0 0 8px' }}>
            {d.totalSchools}
          </p>
          <p style={{ fontSize: 11.5, fontWeight: 600, color: '#059669', margin: '0 0 2px' }}>
            {'\u25cf'} {d.activeSchools} active
          </p>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{stateRows.length > 0 ? stateRows.map(s => s.state).join(' \u00b7 ') : 'Pan-India'}</p>
        </div>

        {/* Students Served */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '18px 20px' }}>
          <div style={{ marginBottom: 6 }}>{/* Fix #3 – sparkline removed */}
            <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', lineHeight: 1, margin: 0 }}>Students Served</p>
          </div>
          <p style={{ fontSize: 50, fontFamily: 'var(--font-instrument-serif), serif', fontWeight: 400, lineHeight: 0.95, letterSpacing: '-1.5px', color: '#111827', margin: '0 0 8px' }}>
            {fmtStudents(d.activeStudents ?? d.totalStudents)}
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#059669', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 999, padding: '2px 8px' }}>
              {(d.activeStudents ?? d.totalStudents).toLocaleString('en-IN')} active
            </span>
            {(d.inactiveStudents ?? 0) > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 999, padding: '2px 8px' }}>
                {(d.inactiveStudents ?? 0).toLocaleString('en-IN')} inactive
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{d.totalStudents.toLocaleString('en-IN')} total {'\u00b7'} {d.totalStaff} staff</p>
        </div>

        {/* Monthly Recurring */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '18px 20px' }}>
          <div style={{ marginBottom: 6 }}>{/* Fix #3 – sparkline removed */}
            <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', lineHeight: 1, margin: 0 }}>Monthly Recurring</p>
          </div>
          <p style={{ fontSize: 50, fontFamily: 'var(--font-instrument-serif), serif', fontWeight: 400, lineHeight: 0.95, letterSpacing: '-1.5px', color: '#111827', margin: '0 0 8px' }}>
            {fmtINR(effectiveMrr)}
          </p>
          <p style={{ fontSize: 11.5, fontWeight: 600, color: '#059669', margin: '0 0 2px' }}>
            {mrrTrend}
          </p>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>GST collected this month {'\u00b7'} {fmtINR(gstAmt)}</p>
        </div>

        {/* Needs Attention – Fix #4: card navigates to overdue billing; Fix #3: sparkline removed */}
        <Link href="/super-admin/billing?status=overdue" style={{ textDecoration: 'none' }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '18px 20px', cursor: 'pointer' }}>
            <div style={{ marginBottom: 6 }}>
              <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', lineHeight: 1, margin: 0 }}>Needs Attention</p>
            </div>
            <p style={{ fontSize: 50, fontFamily: 'var(--font-instrument-serif), serif', fontWeight: 400, lineHeight: 0.95, letterSpacing: '-1.5px', color: '#111827', margin: '0 0 8px' }}>
              {d.alertCount}
            </p>
            <p style={{ fontSize: 11.5, fontWeight: 600, color: d.alertCount > 0 ? '#DC2626' : '#9CA3AF', margin: '0 0 2px' }}>
              {d.alertCount > 0 ? `\u2299 ${d.overdueCount ?? 0} billing \u00b7 ${d.blockedCount ?? 0} blocked` : '\u2014 All clear'}
            </p>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Open across all tenants</p>
          </div>
        </Link>

      </div>

      {/* ── ROW 2: Schools by board + Geographic distribution ──────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Schools by board */}
        <div style={card}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 4px', letterSpacing: '-0.1px' }}>Schools by board</h2>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Affiliation mix across active tenants</p>
          </div>
          {boardRows.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: '#9CA3AF' }}>No schools provisioned yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {boardRows.map(item => {
                const pct   = item.percent > 0 ? item.percent : Math.round((item.count / maxBoard) * 100);
                const color = BOARD_COLOR[item.board] ?? '#6B7280';
                return (
                  <div key={item.board}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: 13, fontWeight: 550, color: '#111827' }}>{item.board}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16, fontFamily: 'var(--font-instrument-serif), serif', color: '#111827' }}>{item.count}</span>
                        <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>{'·'} {Math.round(pct)}%</span>
                      </div>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: '#F3F4F6', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, background: color, width: `${Math.max(2, pct)}%`, transition: 'width 0.7s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {boardRows.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed #E5E7EB', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {boardRows.map(item => (
                <span key={item.board} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, border: '1px solid #E5E7EB', color: '#6B7280' }}>
                  {item.board} {'\u00b7'} {item.count}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Geographic distribution */}
        <div style={card}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 4px', letterSpacing: '-0.1px' }}>Geographic distribution</h2>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Schools by Indian state</p>
          </div>
          {stateRows.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: '#9CA3AF' }}>No geographic data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {stateRows.map(s => {
                const color = STATE_COLOR[s.state] ?? '#6B7280';
                return (
                  <div key={s.code || s.state} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 130, flexShrink: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 550, color: '#111827', margin: 0, lineHeight: 1.2 }}>{s.state}</p>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 7, borderRadius: 999, background: '#F3F4F6', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 999, background: color, width: `${Math.round((s.count / maxState) * 100)}%`, transition: 'width 0.7s ease' }} />
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 80 }}>
                      <span style={{ fontSize: 16, fontFamily: 'var(--font-instrument-serif), serif', color: '#111827' }}>{s.count}</span>
                      <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 3 }}>{'·'} {fmtStudents(s.students)} st.</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {stateRows.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px dashed #E5E7EB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#9CA3AF' }}>Place of supply (GST)</span>
                {/* Fix #13 – show first 3 states + "+N more"; full list in title tooltip */}
                {(() => {
                  const full = stateRows.map(s => `${s.code}-${s.state}`).join(', ');
                  const shown = stateRows.slice(0, 3).map(s => s.state).join(', ');
                  const extra = stateRows.length > 3 ? ` +${stateRows.length - 3} more` : '';
                  return (
                    <span style={{ color: '#374151', fontWeight: 500 }} title={full}>
                      {shown}{extra}
                    </span>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── ROW 3: Plan revenue (MRR) + Recent activity ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Plan revenue (MRR) */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 4px', letterSpacing: '-0.1px' }}>Plan revenue (MRR)</h2>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Excluding GST {'\u00b7'} in INR</p>
            </div>
            <span style={{ background: '#DCFCE7', color: '#15803D', borderRadius: 999, padding: '3px 10px', fontSize: 11.5, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {mrrTrend} MoM
            </span>
          </div>
          {revenueRows.length === 0 ? ( // Fix #14 – only show paid plans in MRR chart
            <p style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: '#9CA3AF' }}>No revenue data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {revenueRows.map(p => { // Fix #14
                const color  = PLAN_COLOR[p.plan] ?? '#6B7280';
                const barPct = Math.max(2, Math.round((p.mrr / maxPlan) * 100));
                return (
                  <div key={p.plan}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 550, color: '#111827' }}>{p.plan}</span>
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>{'\u00b7'} {p.count}</span>
                      </div>
                      <span style={{ fontSize: 15, fontFamily: 'var(--font-instrument-serif), serif', color: '#111827' }}>{fmtINR(p.mrr)}</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: '#F3F4F6', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, background: color, width: `${barPct}%`, transition: 'width 0.7s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 4px', letterSpacing: '-0.1px' }}>Recent activity</h2>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Cross-tenant audit events</p>
            </div>
            <Link href="/super-admin/audit" style={{ fontSize: 12, fontWeight: 600, color: '#6D28D9', textDecoration: 'none', flexShrink: 0 }}>View all {'\u2192'}</Link> {/* Fix #9 – replaced <a> with Next.js <Link> */}
          </div>
          {events.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: '#9CA3AF' }}>No recent activity.</p>
          ) : (
            <div>
              {events.slice(0, 5).map((ev, i) => (
                <Link
                  key={ev.id}
                  href={`/super-admin/audit?event=${ev.id}`} // Fix #15 – activity items navigate to audit detail
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <div
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 0',
                      borderBottom: i < Math.min(events.length, 5) - 1 ? '1px solid #F9FAFB' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0, minWidth: 32, paddingTop: 8, lineHeight: 1 }}>
                      {relativeTime(ev.timestamp)}
                    </span>
                    <ActivityIcon action={ev.action} severity={ev.severity} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: '#111827', lineHeight: 1.3, margin: '0 0 2px' }}>
                        {actionLabel(ev.action)}{ev.schoolName ? ` \u00b7 ${ev.schoolName}` : ''} {/* Fix #19 – use schoolName not raw UUID */}
                      </p>
                      <p style={{ fontSize: 11.5, color: '#9197AE', margin: 0, lineHeight: 1.4 }}>
                        {ev.schoolName || (ev.detail !== ev.action ? ev.detail : '')}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
