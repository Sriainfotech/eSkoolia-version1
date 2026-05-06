'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Users, Clock, CheckCircle2, ChevronRight, Bell } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface AttendanceSummary {
  percent: number;
  present: number;
  total: number;
  absent: number;
  leave: number;
  late: number;
  markedAt: string;
  teachersCovered: number;
  totalTeachers: number;
  pendingClasses: Array<{ name: string; sectionId: string }>;
  last5days: number[];
}

const MOCK: AttendanceSummary = {
  percent: 92.4,
  present: 1153,
  total: 1248,
  absent: 78,
  leave: 16,
  late: 7,
  markedAt: '8:14 AM',
  teachersCovered: 38,
  totalTeachers: 40,
  pendingClasses: [],
  last5days: [89, 91, 88, 93, 92],
};

function DonutChart({ pct }: { pct: number }) {
  const r = 40, cx = 48, cy = 48;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={96} height={96} viewBox="0 0 96 96">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EEEAFF" strokeWidth={10} />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke="#6D4AFF" strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)' }}
      />
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#15172A" letterSpacing="-0.03em">{pct.toFixed(1)}%</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="#9A9DB0">present</text>
    </svg>
  );
}

function MiniBar({ val, max, highlight }: { val: number; max: number; highlight: boolean }) {
  const h = Math.max(4, (val / max) * 28);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ width: 6, height: 28, display: 'flex', alignItems: 'flex-end' }}>
        <div style={{
          width: 6, height: h,
          background: highlight ? 'var(--pu)' : 'var(--pu-soft)',
          borderRadius: 3, transition: 'height 0.6s ease',
        }} />
      </div>
      <span style={{ fontSize: 9, color: 'var(--ink-3)' }}>{val}</span>
    </div>
  );
}

export function AttendanceSnapshot() {
  const [data, setData] = useState<AttendanceSummary>(MOCK);
  const [nudging, setNudging] = useState(false);
  const router = useRouter();

  const fetchData = useCallback(() => {
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/attendance/student/today/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
    const onFocus = () => fetchData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchData]);

  const now = new Date().getHours();
  const showPendingBanner = data.pendingClasses.length > 0 && now >= 10;
  const maxBar = Math.max(...data.last5days, 1);

  const nudge = async () => {
    if (nudging || !data.pendingClasses.length) return;
    setNudging(true);
    const token = getAccessToken();
    await fetch(`${API_BASE_URL}/api/attendance/nudge/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ section_ids: data.pendingClasses.map(c => c.sectionId) }),
    }).catch(() => {});
    setNudging(false);
  };

  return (
    <div
      onClick={() => router.push('/attendance/student')}
      style={{
        background: '#fff', border: '1px solid var(--bd)', borderRadius: 16,
        padding: '14px', boxShadow: 'var(--sh-1)', cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-2)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(109,74,255,0.25)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-1)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--bd)';
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: '#EEEAFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={11} color="var(--pu)" strokeWidth={2} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Student Attendance</span>
        </div>
        <ChevronRight size={13} color="var(--ink-3)" />
      </div>

      {/* Donut + stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <DonutChart pct={data.percent} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <StatRow label="Present" value={data.present} color="#22C55E" />
          <StatRow label="Absent" value={data.absent} color="#E0463A" />
          <StatRow label="Leave" value={data.leave} color="#F59E0B" />
          <StatRow label="Late" value={data.late} color="#94A3B8" />
        </div>
      </div>

      {/* Pending banner */}
      {showPendingBanner && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            marginTop: 10, background: '#FFFBEB', borderLeft: '3px solid #F59E0B',
            borderRadius: 8, padding: '8px 10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <AlertTriangle size={12} color="#D97706" strokeWidth={2} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#92400E' }}>
              {data.pendingClasses.length} section{data.pendingClasses.length > 1 ? 's' : ''} haven&apos;t marked yet
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: '#92400E', marginBottom: 6 }}>
            {data.pendingClasses.map(c => c.name).join(', ')}
          </div>
          <button
            onClick={nudge}
            disabled={nudging}
            style={{
              fontSize: 10, fontWeight: 600, color: '#D97706', background: '#FEF3C7',
              border: '1px solid #F59E0B', borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Bell size={10} strokeWidth={2} />
            {nudging ? 'Sending…' : 'Nudge teachers'}
          </button>
        </div>
      )}

      {/* 5-day sparkbar */}
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'flex-end', gap: 4, justifyContent: 'center' }}>
        {data.last5days.map((v, i) => (
          <MiniBar key={i} val={v} max={maxBar} highlight={i === data.last5days.length - 1} />
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        <Clock size={10} color="var(--ink-3)" strokeWidth={1.5} />
        <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>
          Marked at {data.markedAt} · {data.teachersCovered}/{data.totalTeachers} teachers
        </span>
        {data.teachersCovered === data.totalTeachers && (
          <CheckCircle2 size={10} color="#22C55E" strokeWidth={2} style={{ marginLeft: 2 }} />
        )}
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: 'var(--ink-3)', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-1)' }}>{value}</span>
    </div>
  );
}
