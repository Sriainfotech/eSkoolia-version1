'use client';
import { useRouter } from 'next/navigation';
import { Users, GraduationCap, ExternalLink } from 'lucide-react';

export interface StudentResult {
  id: number;
  fullName?: string;
  name?: string;
  admissionNo?: string;
  rollNo?: string;
  className?: string;
  class_name?: string;
  section?: string;
  photoUrl?: string;
  status?: string;
  attendancePct?: number;
}

interface Props {
  students: StudentResult[];
  query: string;
  onViewProfile: (student: StudentResult) => void;
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const PASTEL = [
  { bg: '#EEEAFF', ink: '#6D4AFF' }, { bg: '#FEE2E2', ink: '#E0463A' },
  { bg: '#D1FAE5', ink: '#059669' }, { bg: '#FEF3C7', ink: '#D97706' },
  { bg: '#DBEAFE', ink: '#3B82F6' }, { bg: '#FCE7F3', ink: '#DB2777' },
];

export function StudentLookupResults({ students, query, onViewProfile }: Props) {
  const router = useRouter();

  const goToList = (s: StudentResult) => {
    router.push(`/students/list?highlight=${s.id}&search=${encodeURIComponent(s.fullName || s.name || '')}`);
  };

  if (students.length === 0) {
    return (
      <div style={{ padding: '12px 0', textAlign: 'center' }}>
        <Users size={24} color="var(--ink-3)" strokeWidth={1.2} style={{ margin: '0 auto 6px' }} />
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>No students found for &quot;{query}&quot;</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>Try a different name or admission number</div>
        <button
          onClick={() => router.push(`/students/list?search=${encodeURIComponent(query)}`)}
          style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: 'var(--pu)', background: 'var(--pu-soft)', border: 'none', borderRadius: 7, padding: '4px 12px', cursor: 'pointer' }}
        >
          Search in full student list →
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginBottom: 2 }}>
        Found <strong>{students.length}</strong> student{students.length > 1 ? 's' : ''} matching &quot;{query}&quot;
      </div>

      {students.map((s, i) => {
        const name = s.fullName || s.name || 'Unknown';
        const cls = s.className || s.class_name || '';
        const sec = s.section ? ` ${s.section}` : '';
        const p = PASTEL[i % PASTEL.length];
        const admNo = s.admissionNo || '—';
        const roll = s.rollNo || '—';
        const att = s.attendancePct;

        return (
          <div
            key={s.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
              border: '1px solid var(--bd)', borderRadius: 10, background: 'var(--bg-0)',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(109,74,255,0.3)'; e.currentTarget.style.boxShadow = '0 2px 8px -2px rgba(15,18,34,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            {/* Avatar / Photo */}
            {s.photoUrl ? (
              <img src={s.photoUrl} alt={name} style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 38, height: 38, borderRadius: 10, background: p.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: p.ink }}>{getInitials(name)}</span>
              </div>
            )}

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)', lineHeight: 1.3 }}>{name}</div>
              {/* Class + section on its own line so it's prominent */}
              {(cls || sec) && (
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginTop: 1 }}>
                  🎓 {cls}{sec}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                <GraduationCap size={10} strokeWidth={2} />
                {roll !== '—' ? `Roll ${roll}` : ''}{roll !== '—' && admNo !== '—' ? ' · ' : ''}Adm {admNo}
              </div>
              {att !== undefined && (
                <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ height: 3, width: 48, background: '#E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${att}%`, background: att >= 75 ? '#22C55E' : '#F59E0B', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 10, color: att >= 75 ? '#059669' : '#D97706', fontWeight: 600 }}>{att}% attendance</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={() => goToList(s)}
                style={{
                  fontSize: 10.5, fontWeight: 600, color: 'var(--pu)',
                  background: 'var(--pu-soft)', border: 'none', borderRadius: 7,
                  padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <ExternalLink size={9} strokeWidth={2.5} />List
              </button>
              <button
                onClick={() => onViewProfile(s)}
                style={{
                  fontSize: 10.5, fontWeight: 600, color: '#059669',
                  background: '#D1FAE5', border: 'none', borderRadius: 7,
                  padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                📄 Report
              </button>
            </div>
          </div>
        );
      })}

      <button
        onClick={() => router.push(`/students/list?search=${encodeURIComponent(query)}`)}
        style={{ fontSize: 11, color: 'var(--pu)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', marginTop: 2, fontWeight: 600 }}
      >
        Open full student list →
      </button>
    </div>
  );
}
