'use client';

import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronRight } from 'lucide-react';
import type { ChildDetail } from '@/lib/api/parent';

interface Props {
  childName: string | null;
  detail: ChildDetail | null;
  loading: boolean;
}

function AttRing({ pct }: { pct: number }) {
  const color = pct >= 85 ? 'var(--ok)' : pct >= 70 ? '#D97706' : '#DC2626';
  const r = 30, circ = 2 * Math.PI * r, dash = (pct / 100) * circ;
  return (
    <svg width={76} height={76} viewBox="0 0 76 76" style={{ flexShrink: 0 }}>
      <circle cx={38} cy={38} r={r} fill="none" stroke="var(--line,#dbe4f0)" strokeWidth={6} />
      <circle cx={38} cy={38} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform="rotate(-90 38 38)" />
      <text x={38} y={35} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={700} fill={color}>{pct}%</text>
      <text x={38} y={50} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="var(--ink-3)">attended</text>
    </svg>
  );
}

function Skeleton({ h = 14 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 6, background: 'var(--line,#dbe4f0)', animation: 'shimmer 1.4s ease-in-out infinite', backgroundImage: 'linear-gradient(90deg,var(--line,#dbe4f0) 25%,var(--bg-2) 50%,var(--line,#dbe4f0) 75%)', backgroundSize: '200% 100%' }} />;
}

export function ParentAttendanceWidget({ childName, detail, loading }: Props) {
  const router = useRouter();
  const att = detail?.attendance;

  return (
    <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 14, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--pu-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CalendarDays size={12} color="var(--pu)" strokeWidth={1.8} />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}>Attendance</span>
        </div>
        <button
          onClick={() => router.push('/parent/attendance')}
          style={{ fontSize: 11, color: 'var(--pu)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontWeight: 500 }}
        >
          Calendar <ChevronRight size={11} strokeWidth={2} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '14px' }}>
        {loading && !detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton h={76} /><Skeleton h={14} /><Skeleton h={14} />
          </div>
        )}

        {!loading && !detail && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0' }}>No child selected</div>
        )}

        {att && (
          <>
            {/* Child name */}
            {childName && (
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                {childName}
              </div>
            )}

            {/* Ring + stats */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <AttRing pct={att.pct ?? 0} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { label: 'Present', val: att.present + att.late, color: 'var(--ok)' },
                  { label: 'Absent',  val: att.absent,             color: '#DC2626'    },
                  { label: 'Late',    val: att.late,               color: '#D97706'    },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color, lineHeight: 1, minWidth: 22 }}>{val}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            {att.total > 0 && (
              <>
                <div style={{ height: 4, borderRadius: 99, background: 'var(--line,#dbe4f0)', marginBottom: 5 }}>
                  <div style={{ height: '100%', width: `${att.pct ?? 0}%`, background: (att.pct ?? 0) >= 85 ? 'var(--ok)' : '#DC2626', borderRadius: 99, transition: 'width 0.6s' }} />
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
                  {(att.pct ?? 0) >= 85 ? '✓ Good standing' : '⚠ Below 85% threshold'}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
