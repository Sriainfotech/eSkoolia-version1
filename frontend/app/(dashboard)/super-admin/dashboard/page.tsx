'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Mail, XCircle, Download, Plus,
} from 'lucide-react';
import { getDashboard } from '@/lib/api/super-admin/dashboard';
import type { DashboardData } from '@/types/super-admin';

// ── Sparkline ──────────────────────────────────────────────────────────────
function Spark({ color = '#6D4AFF', down }: { color?: string; down?: boolean }) {
  const pts = (down
    ? [14, 11, 13, 9, 12, 8, 10, 7, 9, 6, 8, 5, 7, 4]
    : [4, 7, 5, 9, 6, 11, 8, 10, 9, 13, 10, 12, 11, 14]
  ).map((y, i) => `${i * 9},${16 - y}`).join(' ');
  return (
    <svg width="118" height="32" viewBox="0 0 118 32" fill="none">
      <polyline points={pts} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

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
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);


  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboard();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      setData(FALLBACK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  if (loading && data === null) return <DashboardSkeleton />;

  const d         = data ?? FALLBACK;
  const boardRows = d.boardBreakdown ?? [];
  const events    = d.recentEvents ?? [];
  const maxBoard    = Math.max(...boardRows.map(b => b.count), 1);
  const stateRows   = (d.stateBreakdown && d.stateBreakdown.length > 0) ? d.stateBreakdown : [];
  const planRows    = (d.planBreakdown  && d.planBreakdown.length  > 0) ? d.planBreakdown  : [];
  const maxState    = Math.max(...stateRows.map(s => s.count), 1);
  const planMrrTotal = planRows.reduce((sum, p) => sum + p.mrr, 0);
  const effectiveMrr = d.mrr.current > 0 ? d.mrr.current : planMrrTotal;
  const maxPlan     = Math.max(...planRows.map(p => p.mrr > 0 ? p.mrr : p.count), 1);
  const mrrTrend  = d.mrr.trend !== 0 ? `${d.mrr.trend > 0 ? '+' : ''}${d.mrr.trend.toFixed(1)}%` : '\u2014';
  const studentsMoM = d.trends?.students;
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
          {error && (
            <span style={{ fontSize: 12, color: '#92400E', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={13} /> Showing cached data
            </span>
          )}
          <button
            type="button"
            style={{ height: 36, padding: '0 14px', borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <Download size={14} /> Export
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = '/super-admin/schools'; }}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', lineHeight: 1, margin: 0 }}>Total Schools</p>
            <span style={{ opacity: 0.65, flexShrink: 0, marginTop: -4 }}><Spark color="#5836E0" /></span>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', lineHeight: 1, margin: 0 }}>Students Served</p>
            <span style={{ opacity: 0.65, flexShrink: 0, marginTop: -4 }}><Spark color="#0E9F6E" /></span>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', lineHeight: 1, margin: 0 }}>Monthly Recurring</p>
            <span style={{ opacity: 0.65, flexShrink: 0, marginTop: -4 }}><Spark color="#0369A1" /></span>
          </div>
          <p style={{ fontSize: 50, fontFamily: 'var(--font-instrument-serif), serif', fontWeight: 400, lineHeight: 0.95, letterSpacing: '-1.5px', color: '#111827', margin: '0 0 8px' }}>
            {fmtINR(effectiveMrr)}
          </p>
          <p style={{ fontSize: 11.5, fontWeight: 600, color: '#059669', margin: '0 0 2px' }}>
            {mrrTrend}
          </p>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>GST collected this month {'\u00b7'} {fmtINR(gstAmt)}</p>
        </div>

        {/* Needs Attention */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', lineHeight: 1, margin: 0 }}>Needs Attention</p>
            <span style={{ opacity: 0.65, flexShrink: 0, marginTop: -4 }}><Spark color="#E0463A" down /></span>
          </div>
          <p style={{ fontSize: 50, fontFamily: 'var(--font-instrument-serif), serif', fontWeight: 400, lineHeight: 0.95, letterSpacing: '-1.5px', color: '#111827', margin: '0 0 8px' }}>
            {d.alertCount}
          </p>
          <p style={{ fontSize: 11.5, fontWeight: 600, color: d.alertCount > 0 ? '#DC2626' : '#9CA3AF', margin: '0 0 2px' }}>
            {d.alertCount > 0 ? `\u2299 ${d.overdueCount ?? 0} billing \u00b7 ${d.blockedCount ?? 0} blocked` : '\u2014 All clear'}
          </p>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Open across all tenants</p>
        </div>

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
                <span style={{ color: '#374151', fontWeight: 500 }}>
                  {stateRows.map(s => `${s.code}-${s.state}`).join(' \u00b7 ')}
                </span>
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
          {planRows.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: '#9CA3AF' }}>No plan data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {planRows.map(p => {
                const color  = PLAN_COLOR[p.plan] ?? '#6B7280';
                const barPct = Math.max(2, Math.round(((p.mrr > 0 ? p.mrr : p.count) / maxPlan) * 100));
                return (
                  <div key={p.plan}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 550, color: '#111827' }}>{p.plan}</span>
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>{'\u00b7'} {p.count}</span>
                      </div>
                      <span style={{ fontSize: 15, fontFamily: 'var(--font-instrument-serif), serif', color: '#111827' }}>{p.mrr > 0 ? fmtINR(p.mrr) : 'Trial'}</span>
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
            <a href="/super-admin/audit" style={{ fontSize: 12, fontWeight: 600, color: '#6D28D9', textDecoration: 'none', flexShrink: 0 }}>View all {'\u2192'}</a>
          </div>
          {events.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: '#9CA3AF' }}>No recent activity.</p>
          ) : (
            <div>
              {events.slice(0, 5).map((ev, i) => (
                <div
                  key={ev.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 0',
                    borderBottom: i < Math.min(events.length, 5) - 1 ? '1px solid #F9FAFB' : 'none',
                  }}
                >
                  <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0, minWidth: 32, paddingTop: 8, lineHeight: 1 }}>
                    {relativeTime(ev.timestamp)}
                  </span>
                  <ActivityIcon action={ev.action} severity={ev.severity} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: '#111827', lineHeight: 1.3, margin: '0 0 2px' }}>
                      {actionLabel(ev.action)}{ev.tenantId ? ` \u00b7 ${ev.tenantId}` : ''}
                    </p>
                    <p style={{ fontSize: 11.5, color: '#9197AE', margin: 0, lineHeight: 1.4 }}>
                      {ev.schoolName || (ev.detail !== ev.action ? ev.detail : '')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
