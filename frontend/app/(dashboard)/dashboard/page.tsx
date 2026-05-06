'use client';
import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Users, UserCheck, CreditCard, UserPlus, TrendingUp, AlertCircle, BookOpen, Clock } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface KPIData {
  total_students?: number;
  attendance_today?: string;
  fees_collected_mtd?: string;
  open_admissions?: number;
  total_staff?: number;
  library_books?: number;
  pending_homework?: number;
  exams_this_week?: number;
}

function KPICard({ label, value, delta, deltaUp, icon: Icon, ic, bg }: {
  label: string; value: string; delta: string; deltaUp: boolean;
  icon: React.ElementType; ic: string; bg: string;
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--bd)',
      borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 4
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={15} color={ic} strokeWidth={1.5} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      </div>
      <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink-1)', lineHeight: 1.2 }}>{value}</span>
      <span style={{ fontSize: 11, color: deltaUp ? '#15803d' : '#dc2626' }}>
        {deltaUp ? '↑ ' : '↓ '}{delta}
      </span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ width: '60%', height: 10, background: '#f0f0f0', borderRadius: 4, marginBottom: 12 }} />
      <div style={{ width: '40%', height: 28, background: '#f0f0f0', borderRadius: 4, marginBottom: 8 }} />
      <div style={{ width: '70%', height: 10, background: '#f0f0f0', borderRadius: 4 }} />
    </div>
  );
}

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(`${API_BASE_URL}/api/dashboard/kpis/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setKpi(data);
        }
      } catch { /* graceful fallback */ }
      finally { setLoading(false); }
    };
    fetchKPIs();
  }, []);

  const cards = [
    { label: 'Total Students', value: kpi?.total_students != null ? kpi.total_students.toLocaleString() : '—', delta: 'enrolled this year', deltaUp: true, icon: Users, ic: '#B42318', bg: '#FEF3F2' },
    { label: "Today's Attendance", value: kpi?.attendance_today ?? '—', delta: 'vs yesterday', deltaUp: true, icon: UserCheck, ic: '#B45309', bg: '#FFFBEB' },
    { label: 'Fees Collected MTD', value: kpi?.fees_collected_mtd ?? '—', delta: 'of monthly target', deltaUp: true, icon: CreditCard, ic: '#0E7490', bg: '#ECFEFF' },
    { label: 'Open Admissions', value: kpi?.open_admissions != null ? String(kpi.open_admissions) : '—', delta: 'awaiting review', deltaUp: false, icon: UserPlus, ic: '#047857', bg: '#ECFDF5' },
    { label: 'Total Staff', value: kpi?.total_staff != null ? String(kpi.total_staff) : '—', delta: 'active staff members', deltaUp: true, icon: TrendingUp, ic: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Library Books', value: kpi?.library_books != null ? kpi.library_books.toLocaleString() : '—', delta: 'in collection', deltaUp: true, icon: BookOpen, ic: '#BE185D', bg: '#FDF2F8' },
    { label: 'Pending Homework', value: kpi?.pending_homework != null ? String(kpi.pending_homework) : '—', delta: 'to be evaluated', deltaUp: false, icon: AlertCircle, ic: '#C2410C', bg: '#FFF7ED' },
    { label: 'Exams This Week', value: kpi?.exams_this_week != null ? String(kpi.exams_this_week) : '—', delta: 'scheduled', deltaUp: true, icon: Clock, ic: '#A21CAF', bg: '#FDF4FF' },
  ];

  return (
    <div>
      <PageHeader
        module={{ name: 'Dashboard', path: '/dashboard' }}
        title="School"
        titleAccent="Overview"
        description="Live KPIs and key metrics across all school operations"
      />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px 40px' }}>
        {/* KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 32 }}>
          {loading ? Array(8).fill(0).map((_, i) => <SkeletonCard key={i} />) : cards.map(c => <KPICard key={c.label} {...c} />)}
        </div>

        {/* Quick links section */}
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Quick Actions
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Mark Attendance', path: '/attendance/student', color: '#B45309', bg: '#FFFBEB' },
            { label: 'Collect Fees', path: '/fees/payments', color: '#0E7490', bg: '#ECFEFF' },
            { label: 'Add Student', path: '/students/list', color: '#B42318', bg: '#FEF3F2' },
            { label: 'Exam Schedule', path: '/exams/schedule', color: '#A21CAF', bg: '#FDF4FF' },
            { label: 'Staff Payroll', path: '/hr/payroll', color: '#DC2626', bg: '#FEF2F2' },
            { label: 'Library Issues', path: '/library/issues', color: '#BE185D', bg: '#FDF2F8' },
          ].map(a => (
            <a key={a.path} href={a.path} style={{
              padding: '8px 16px', borderRadius: 20, border: `1px solid ${a.color}22`,
              background: a.bg, color: a.color, fontSize: 13, fontWeight: 500,
              textDecoration: 'none', transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.opacity = '0.8')}
            onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.opacity = '1')}>
              {a.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

