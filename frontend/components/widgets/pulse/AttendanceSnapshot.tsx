'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Users, Clock, CheckCircle2, ChevronRight, Bell } from 'lucide-react';
import { useAttendanceDashboard } from '@/hooks/useAttendanceDashboard';

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
  const router = useRouter();
  const { data: dashboardData, loading, error, refetch } = useAttendanceDashboard({
    autoRefetch: true,
    refetchInterval: 300000, // 5 minutes
  });
  const [nudging, setNudging] = useState(false);

  // Transform backend data to component format
  const data: AttendanceSummary = dashboardData
    ? {
        percent: dashboardData.attendance_percentage,
        present: dashboardData.present,
        total: dashboardData.present + dashboardData.absent + dashboardData.leave + dashboardData.late,
        absent: dashboardData.absent,
        leave: dashboardData.leave,
        late: dashboardData.late,
        markedAt: dashboardData.last_updated,
        teachersCovered: dashboardData.marked_teachers,
        totalTeachers: dashboardData.total_teachers,
        pendingClasses: dashboardData.pending_classes || [],
        last5days: dashboardData.trend,
      }
    : null;

  const nudge = async () => {
    if (nudging || !data?.pendingClasses.length) return;
    setNudging(true);
    try {
      // Implement nudge API call when backend is ready
      await refetch();
    } catch {
      // Error handling
    } finally {
      setNudging(false);
    }
  };

  const now = new Date().getHours();
  const showPendingBanner = data && data.pendingClasses.length > 0 && now >= 10;
  const maxBar = data && data.last5days.length > 0 ? Math.max(...data.last5days, 1) : 1;

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div
      onClick={() => router.push('/attendance/student')}
      style={{
        background: '#fff', border: '1px solid var(--bd)', borderRadius: 16,
        padding: '14px', boxShadow: 'var(--sh-1)', cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        minHeight: 280,
      }}
      onMouseEnter={e => {
        if (!loading && !error) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-2)';
          (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(109,74,255,0.25)';
        }
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

      {/* Loading State */}
      {loading && !data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Skeleton donut */}
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                background: 'linear-gradient(90deg,#f0f0f6 25%,#e0e0e8 50%,#f0f0f6 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s ease-in-out infinite',
                flexShrink: 0,
              }}
            />
            {/* Skeleton stats */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  style={{
                    height: 16,
                    borderRadius: 6,
                    background: 'linear-gradient(90deg,#f0f0f6 25%,#e0e0e8 50%,#f0f0f6 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.4s ease-in-out infinite',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px',
            background: '#FEF2F2',
            borderRadius: 8,
            border: '1px solid #FDD8D8',
            minHeight: 200,
          }}
        >
          <AlertTriangle size={20} color="#C2264E" strokeWidth={2} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#C2264E', marginBottom: 4 }}>
              Failed to load attendance data
            </div>
            <div style={{ fontSize: 11, color: '#8B5D6F', marginBottom: 8 }}>
              {error.message}
            </div>
            <button
              onClick={e => {
                e.stopPropagation();
                refetch();
              }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#C2264E',
                background: '#FEF2F2',
                border: '1px solid #C2264E',
                borderRadius: 4,
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Data State */}
      {data && !loading && (
        <>
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
                borderRadius: 8, padding: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                <AlertTriangle size={12} color="#D97706" strokeWidth={2} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#92400E' }}>
                  Attendance pending
                </span>
              </div>
              
              {/* Class badges - show first 3 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {data.pendingClasses.slice(0, 3).map((c, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#D97706',
                      background: '#FEF3C7',
                      border: '1px solid #F59E0B',
                      borderRadius: 12,
                      padding: '3px 10px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.name}
                  </span>
                ))}
                
                {/* Show +X more if additional classes exist */}
                {data.pendingClasses.length > 3 && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#D97706',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      marginLeft: 4,
                    }}
                  >
                    +{data.pendingClasses.length - 3} more
                  </span>
                )}
              </div>
              
              <button
                onClick={nudge}
                disabled={nudging}
                style={{
                  fontSize: 10, fontWeight: 600, color: '#D97706', background: '#FEF3C7',
                  border: '1px solid #F59E0B', borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, transition: 'background 0.2s',
                  opacity: nudging ? 0.6 : 1,
                }}
                onMouseEnter={e => !nudging && (e.currentTarget.style.background = '#FDE68A')}
                onMouseLeave={e => (e.currentTarget.style.background = '#FEF3C7')}
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
        </>
      )}
      </div>
    </>
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
