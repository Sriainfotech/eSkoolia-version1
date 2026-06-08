'use client';

import { useRouter } from 'next/navigation';
import { BookOpen, ChevronRight } from 'lucide-react';
import type { ChildDetail } from '@/lib/api/parent';

interface Props {
  childName: string | null;
  detail: ChildDetail | null;
  loading: boolean;
}

function Skeleton({ h = 14 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 6, backgroundImage: 'linear-gradient(90deg,var(--line,#dbe4f0) 25%,var(--bg-2) 50%,var(--line,#dbe4f0) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />;
}

export function ParentResultsWidget({ childName, detail, loading }: Props) {
  const router = useRouter();
  const marks = detail?.recent_marks?.slice(-5).reverse() ?? [];

  return (
    <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 14, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--pu-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={12} color="var(--pu)" strokeWidth={1.8} />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}>Recent Results</span>
        </div>
        <button
          onClick={() => router.push('/parent/results')}
          style={{ fontSize: 11, color: 'var(--pu)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontWeight: 500 }}
        >
          All <ChevronRight size={11} strokeWidth={2} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        {loading && !detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3].map(i => <Skeleton key={i} h={36} />)}
          </div>
        )}

        {!loading && !detail && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0' }}>No child selected</div>
        )}

        {detail && marks.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0' }}>No exam records yet</div>
        )}

        {detail && marks.length > 0 && (
          <>
            {childName && (
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pu)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                {childName}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {marks.map((m, i) => {
                const pct = m.full_marks > 0 ? Math.round(m.obtained / m.full_marks * 100) : 0;
                const color = pct >= 75 ? 'var(--ok)' : pct >= 50 ? '#D97706' : '#DC2626';
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-1)', lineHeight: 1.2 }}>{m.subject}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{m.exam_name}</div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color, flexShrink: 0, marginLeft: 8 }}>
                        {m.absent ? 'Absent' : `${pct}%`}
                      </span>
                    </div>
                    {!m.absent && (
                      <div style={{ height: 3, borderRadius: 99, background: 'var(--line,#dbe4f0)' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.5s' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
