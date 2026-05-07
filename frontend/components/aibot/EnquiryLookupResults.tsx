'use client';
import { useRouter } from 'next/navigation';
import { ExternalLink, Phone, Calendar, Star } from 'lucide-react';

/* ─── Types ─── */
export interface EnquiryResult {
  id: number;
  student_name: string;
  parent_name: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  class_applied: string;
  status: string;
  query_date: string | null;
  follow_up_date: string | null;
  next_follow_up_date: string | null;
  assigned: string;
  source_name: string;
  lead_score: number;
  documents_status: string;
  last_contacted_at?: string;
  note: string;
  no_of_child: number;
  family_id?: number;
  sibling_ids?: number[];
}

/* ─── Static mock data (replace with API call when ready) ─── */
export const MOCK_ENQUIRIES: EnquiryResult[] = [
  {
    id: 1,
    student_name: 'Aarav Mehta',
    parent_name: 'Rakesh Mehta',
    phone: '9876543210',
    email: 'rakesh.mehta@gmail.com',
    address: '12, Shanti Nagar, Bangalore – 560001',
    description: 'Father is a software engineer relocating from Hyderabad. Keen on CBSE board. Wants to enroll both children simultaneously. Visited campus on 15 Apr.',
    class_applied: 'Class 5',
    status: 'visited',
    query_date: '2026-04-10',
    follow_up_date: '2026-04-15',
    next_follow_up_date: '2026-05-08',
    assigned: 'Mrs. Priya Sundaram',
    source_name: 'Website',
    lead_score: 78,
    documents_status: 'birth_cert:received,tc:pending,photo:received,address_proof:missing',
    last_contacted_at: '2026-04-28',
    note: 'Family seemed very interested. Father confirmed campus visit. Mother specifically asked about bus facility for Whitefield route.',
    no_of_child: 2,
    family_id: 1,
    sibling_ids: [2],
  },
  {
    id: 2,
    student_name: 'Riya Mehta',
    parent_name: 'Rakesh Mehta',
    phone: '9876543210',
    email: 'rakesh.mehta@gmail.com',
    address: '12, Shanti Nagar, Bangalore – 560001',
    description: 'Younger daughter of Rakesh Mehta. Applying for Class 3 alongside elder brother Aarav. Joint family enquiry.',
    class_applied: 'Class 3',
    status: 'visited',
    query_date: '2026-04-10',
    follow_up_date: '2026-04-15',
    next_follow_up_date: '2026-05-08',
    assigned: 'Mrs. Priya Sundaram',
    source_name: 'Website',
    lead_score: 78,
    documents_status: 'birth_cert:received,tc:missing,photo:received,address_proof:missing',
    last_contacted_at: '2026-04-28',
    note: 'Sibling enquiry with Aarav Mehta (ID #1). Joint family visit confirmed. TC from previous school still pending.',
    no_of_child: 2,
    family_id: 1,
    sibling_ids: [1],
  },
  {
    id: 3,
    student_name: 'Priya Kapoor',
    parent_name: 'Suresh Kapoor',
    phone: '9845012345',
    email: 'suresh.kapoor@yahoo.com',
    address: '45, MG Road, Bangalore – 560025',
    description: 'Single child. Parents are looking for a school with strong academics and sports facilities. Currently enrolled in another CBSE school.',
    class_applied: 'Class 8',
    status: 'applied',
    query_date: '2026-03-22',
    follow_up_date: '2026-04-01',
    next_follow_up_date: '2026-05-10',
    assigned: 'Mr. Arjun Sharma',
    source_name: 'Reference',
    lead_score: 85,
    documents_status: 'birth_cert:received,tc:received,photo:received,address_proof:received,report_card:received',
    last_contacted_at: '2026-05-01',
    note: 'Very keen family. All documents complete. Father personally met principal last week. Likely to confirm admission.',
    no_of_child: 1,
    family_id: 3,
    sibling_ids: [],
  },
  {
    id: 4,
    student_name: 'Arjun Nair',
    parent_name: 'Vijay Nair',
    phone: '9900112233',
    email: 'vijay.nair@outlook.com',
    address: '8, Koramangala, Bangalore – 560034',
    description: 'Boy applying for Class 6. Father is a doctor. Parents prefer English medium with emphasis on extracurricular activities.',
    class_applied: 'Class 6',
    status: 'new',
    query_date: '2026-05-02',
    follow_up_date: null,
    next_follow_up_date: '2026-05-09',
    assigned: 'Mrs. Kavya Reddy',
    source_name: 'Walk-in',
    lead_score: 62,
    documents_status: 'birth_cert:pending,tc:pending,photo:pending,address_proof:pending',
    note: 'Fresh enquiry. Initial details collected at front desk. First follow-up call not yet made.',
    no_of_child: 1,
    family_id: 4,
    sibling_ids: [],
  },
  {
    id: 5,
    student_name: 'Sneha Verma',
    parent_name: 'Anita Verma',
    phone: '9123456789',
    email: 'anita.verma@gmail.com',
    address: '23, Whitefield, Bangalore – 560066',
    description: 'Girl applying for LKG. Mother is a school teacher herself. Interested in play-based learning and holistic child development.',
    class_applied: 'LKG',
    status: 'contacted',
    query_date: '2026-04-25',
    follow_up_date: '2026-04-30',
    next_follow_up_date: '2026-05-07',
    assigned: 'Mrs. Priya Sundaram',
    source_name: 'Social Media',
    lead_score: 70,
    documents_status: 'birth_cert:received,photo:received,address_proof:pending',
    last_contacted_at: '2026-04-30',
    note: 'Mother spoke at length with admission coordinator. Wants detailed curriculum information and school hour schedule.',
    no_of_child: 1,
    family_id: 5,
    sibling_ids: [],
  },
  {
    id: 6,
    student_name: 'Ravi',
    parent_name: 'Ravi (Parent)',
    phone: '9869966969',
    email: '',
    address: '',
    description: 'Enquiry for Class 10. Source: Instagram. Follow-up overdue.',
    class_applied: 'Class 10',
    status: 'new',
    query_date: '2026-04-20',
    follow_up_date: null,
    next_follow_up_date: '2026-05-07',
    assigned: 'Ramya',
    source_name: 'Instagram',
    lead_score: 55,
    documents_status: 'birth_cert:pending,tc:pending,photo:pending',
    note: 'Initial enquiry via Instagram. Follow-up overdue by 17 days.',
    no_of_child: 1,
    family_id: 6,
    sibling_ids: [],
  },
  {
    id: 7,
    student_name: 'Rina',
    parent_name: 'Rina (Parent)',
    phone: '9110751586',
    email: '',
    address: '',
    description: 'Enquiry for Class 10. Source: Word of Mouth. Follow-up overdue.',
    class_applied: 'Class 10',
    status: 'new',
    query_date: '2026-04-14',
    follow_up_date: null,
    next_follow_up_date: '2026-05-07',
    assigned: 'Ramya',
    source_name: 'Word of Mouth',
    lead_score: 50,
    documents_status: 'birth_cert:pending,tc:pending,photo:pending',
    note: 'Enquiry came through word of mouth. Follow-up overdue by 21 days.',
    no_of_child: 1,
    family_id: 7,
    sibling_ids: [],
  },
  {
    id: 8,
    student_name: 'Kavya',
    parent_name: 'Kavya (Parent)',
    phone: '9874563210',
    email: '',
    address: '',
    description: 'Enquiry via Phone Call. Grade not yet specified. Follow-up overdue.',
    class_applied: 'Not specified',
    status: 'new',
    query_date: '2026-04-14',
    follow_up_date: null,
    next_follow_up_date: '2026-05-07',
    assigned: 'Sharma',
    source_name: 'Phone Call',
    lead_score: 45,
    documents_status: 'birth_cert:pending,tc:pending,photo:pending',
    note: 'Enquiry received via phone call. Grade not yet confirmed. Follow-up overdue by 22 days.',
    no_of_child: 1,
    family_id: 8,
    sibling_ids: [],
  },
];

/* Search mock enquiries by student name, parent name, or phone */
export function searchMockEnquiries(query: string): EnquiryResult[] {
  const q = query.toLowerCase().trim();
  if (!q || q.length < 2) return [];
  return MOCK_ENQUIRIES.filter(e =>
    e.student_name.toLowerCase().includes(q) ||
    e.parent_name.toLowerCase().includes(q) ||
    e.phone.includes(q) ||
    e.class_applied.toLowerCase().includes(q)
  );
}

/* ─── Helpers ─── */
const STATUS_CONFIG: Record<string, { label: string; bg: string; ink: string }> = {
  new:        { label: 'New',       bg: '#DBEAFE', ink: '#1D4ED8' },
  contacted:  { label: 'Contacted', bg: '#FEF3C7', ink: '#D97706' },
  visited:    { label: 'Visited',   bg: '#EDE9FE', ink: '#7C3AED' },
  applied:    { label: 'Applied',   bg: '#D1FAE5', ink: '#059669' },
  enrolled:   { label: 'Enrolled',  bg: '#DCFCE7', ink: '#16A34A' },
  waitlisted: { label: 'Waitlist',  bg: '#FEF9C3', ink: '#A16207' },
  cold:       { label: 'Cold',      bg: '#F3F4F6', ink: '#6B7280' },
};

const PASTEL = [
  { bg: '#EEEAFF', ink: '#6D4AFF' }, { bg: '#FEE2E2', ink: '#E0463A' },
  { bg: '#D1FAE5', ink: '#059669' }, { bg: '#FEF3C7', ink: '#D97706' },
  { bg: '#DBEAFE', ink: '#3B82F6' }, { bg: '#FCE7F3', ink: '#DB2777' },
];

function getInitials(name: string) {
  const w = name.trim().split(/\s+/);
  if (w.length === 1) return (w[0][0] ?? '?').toUpperCase();
  return `${w[0][0]}${w[w.length - 1][0]}`.toUpperCase();
}

function fmt(date: string | null | undefined) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ─── Component ─── */
interface Props {
  enquiries: EnquiryResult[];
  query: string;
  onViewReport: (e: EnquiryResult) => void;
}

export function EnquiryLookupResults({ enquiries, query, onViewReport }: Props) {
  const router = useRouter();

  if (enquiries.length === 0) {
    return (
      <div style={{ padding: '12px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 22, marginBottom: 6 }}>🔍</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
          No enquiries found for &quot;{query}&quot;
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>
          Try a parent name, student name or phone number
        </div>
        <button
          onClick={() => router.push('/admissions/command-center')}
          style={{
            marginTop: 8, fontSize: 11, fontWeight: 600, color: 'var(--pu)',
            background: 'var(--pu-soft)', border: 'none', borderRadius: 7,
            padding: '4px 12px', cursor: 'pointer',
          }}
        >
          Open Admissions →
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginBottom: 2 }}>
        Found <strong>{enquiries.length}</strong> enquir{enquiries.length > 1 ? 'ies' : 'y'} matching &quot;{query}&quot;
      </div>

      {enquiries.map((e, i) => {
        const p = PASTEL[i % PASTEL.length];
        const sc = STATUS_CONFIG[e.status] ?? STATUS_CONFIG.new;
        const scoreColor = e.lead_score >= 75 ? '#16A34A' : e.lead_score >= 50 ? '#D97706' : '#DC2626';

        return (
          <div
            key={e.id}
            style={{
              padding: '9px 10px', border: '1px solid var(--bd)', borderRadius: 10,
              background: 'var(--bg-0)', transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={ev => {
              ev.currentTarget.style.borderColor = 'rgba(109,74,255,0.3)';
              ev.currentTarget.style.boxShadow = '0 2px 8px -2px rgba(15,18,34,0.08)';
            }}
            onMouseLeave={ev => {
              ev.currentTarget.style.borderColor = 'var(--bd)';
              ev.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              {/* Avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: 9, background: p.bg,
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: p.ink }}>{getInitials(e.student_name)}</span>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}>{e.student_name}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: sc.ink, background: sc.bg,
                    padding: '1px 7px', borderRadius: 10,
                  }}>{sc.label}</span>
                  {e.sibling_ids && e.sibling_ids.length > 0 && (
                    <span style={{
                      fontSize: 10, color: '#7C3AED', background: '#EDE9FE',
                      padding: '1px 6px', borderRadius: 10,
                    }}>+{e.sibling_ids.length} sibling</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>
                  🎓 {e.class_applied} &nbsp;·&nbsp; 👤 {e.parent_name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Phone size={9} strokeWidth={2} color="var(--ink-3)" />
                    <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{e.phone}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Calendar size={9} strokeWidth={2} color="var(--ink-3)" />
                    <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{fmt(e.query_date)}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Star size={9} strokeWidth={2} color={scoreColor} />
                    <span style={{ fontSize: 10.5, color: scoreColor, fontWeight: 600 }}>{e.lead_score}</span>
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => router.push(`/admissions/command-center?inquiry=${e.id}`)}
                  style={{
                    fontSize: 10.5, fontWeight: 600, color: 'var(--pu)',
                    background: 'var(--pu-soft)', border: 'none', borderRadius: 7,
                    padding: '4px 8px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}
                >
                  <ExternalLink size={9} strokeWidth={2.5} /> View
                </button>
                <button
                  onClick={() => onViewReport(e)}
                  style={{
                    fontSize: 10.5, fontWeight: 600, color: '#059669',
                    background: '#D1FAE5', border: 'none', borderRadius: 7,
                    padding: '4px 8px', cursor: 'pointer',
                  }}
                >
                  📋 Report
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <button
        onClick={() => router.push('/admissions/command-center')}
        style={{
          fontSize: 11, color: 'var(--pu)', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'center', marginTop: 2, fontWeight: 600,
        }}
      >
        Open full admissions →
      </button>
    </div>
  );
}
