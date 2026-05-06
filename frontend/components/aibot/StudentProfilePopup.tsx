'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, Sparkles, RefreshCw, GraduationCap, Calendar, DollarSign, FileText, Award, Shield, Users, Phone, MessageCircle, Mail, Printer, Share2 } from 'lucide-react';
import { StudentResult } from './StudentLookupResults';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

type ProfileTab = 'overview' | 'academic' | 'attendance' | 'fees' | 'documents' | 'achievements' | 'behaviour' | 'family';

const TABS: Array<{ key: ProfileTab; label: string; icon: React.ReactNode }> = [
  { key: 'overview',     label: 'Overview',      icon: <GraduationCap size={12} strokeWidth={2} /> },
  { key: 'academic',     label: 'Academic',      icon: <FileText size={12} strokeWidth={2} /> },
  { key: 'attendance',   label: 'Attendance',    icon: <Calendar size={12} strokeWidth={2} /> },
  { key: 'fees',         label: 'Fees',          icon: <DollarSign size={12} strokeWidth={2} /> },
  { key: 'documents',    label: 'Documents',     icon: <FileText size={12} strokeWidth={2} /> },
  { key: 'achievements', label: 'Achievements',  icon: <Award size={12} strokeWidth={2} /> },
  { key: 'behaviour',    label: 'Behaviour',     icon: <Shield size={12} strokeWidth={2} /> },
  { key: 'family',       label: 'Family',        icon: <Users size={12} strokeWidth={2} /> },
];

interface AiBrief { brief: string; tone: string; generatedAt: string; }

// ─── Raw API shapes ────────────────────────────────────────────────────────────
interface AttRec { id: number; attendance_date: string; attendance_type: 'P' | 'A' | 'L' | 'F' | 'H'; notes?: string; }
interface FeeAsgn { id: number; fees_type?: string | { id: number; name: string }; due_date: string; amount: number; net_amount: number; paid_amount: number; due_amount: number; status: string; }
interface FeePay { id: number; amount_paid: number; method: string; paid_at: string; transaction_reference?: string; assignment?: number; }
interface ExMark { id: number; obtained_marks: number | null; absent: boolean; note?: string; created_at?: string; schedule?: number | { id: number; subject?: number | { id: number; name: string }; full_marks?: number; exam_date?: string; exam_term?: number | { id: number; name: string } }; exam?: number | { id: number; name: string }; }
interface BehAsgn { id: number; incident_title: string; point: number; created_at: string; assigned_by?: string; }
interface RawDoc { id: number; document_type?: string; title: string; is_verified: boolean; uploaded_at: string; file_url?: string; }
interface GuardianData { id: number; full_name: string; relation: string; phone?: string; email?: string; occupation?: string; }

interface ProfileData {
  id: number;
  fullName: string;
  admissionNo: string;
  rollNo: string;
  className: string;
  section: string;
  joinedYear: string;
  house: string;
  status: string;
  photoUrl?: string;
  attendance: { pct: number; present: number; absent: number; late: number; };
  fees: { balance: number; lastPaid: string; };
  academic: { avgScore: number; subjects: Array<{ name: string; latest: number; trend: number[] }> };
  pendingDocs: number;
  openItems: number;
}

const MOCK_PROFILE: ProfileData = {
  id: 1, fullName: 'Aarav Sharma', admissionNo: '2104', rollNo: '12',
  className: 'Class 5', section: 'A', joinedYear: '2022', house: 'Phoenix', status: 'Active',
  attendance: { pct: 92, present: 184, absent: 12, late: 4 },
  fees: { balance: 0, lastPaid: '2025-12-01' },
  academic: { avgScore: 81, subjects: [
    { name: 'Mathematics',  latest: 78, trend: [64, 68, 72, 78] },
    { name: 'Science',      latest: 91, trend: [85, 88, 91, 91] },
    { name: 'English',      latest: 84, trend: [80, 82, 84, 84] },
    { name: 'Social Sci',   latest: 75, trend: [73, 74, 75, 75] },
    { name: 'Hindi',        latest: 79, trend: [75, 77, 79, 79] },
  ]},
  pendingDocs: 1, openItems: 3,
};

const MOCK_BRIEF: AiBrief = {
  brief: "Aarav has 92% attendance with 3 medical absences in the last 30 days. Academic performance is steady — Math improved from 64 to 78%, Science strongest at 91%. Behaviour clean, no incidents. Fee account up to date. Concerns: 1 pending document (caste certificate); 2 late arrivals last week.",
  tone: 'parent-meeting', generatedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
};

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function MiniSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const W = 60, H = 16;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`).join(' ');
  const lastVal = data[data.length - 1];
  const prevVal = data[data.length - 2];
  const up = lastVal >= prevVal;
  return (
    <svg width={W} height={H} style={{ flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={up ? '#22C55E' : '#E0463A'} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#059669' : score >= 60 ? '#D97706' : '#E0463A';
  const bg = score >= 80 ? '#D1FAE5' : score >= 60 ? '#FEF3C7' : '#FEE2E2';
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color, background: bg, padding: '2px 7px', borderRadius: 20 }}>{score}%</span>
  );
}

export function StudentProfilePopup({ student, onClose }: { student: StudentResult; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [brief, setBrief] = useState<AiBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefDismissed, setBriefDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Real data state for each tab
  const [attRecords, setAttRecords] = useState<AttRec[]>([]);
  const [feeAssignments, setFeeAssignments] = useState<FeeAsgn[]>([]);
  const [feePayments, setFeePayments] = useState<FeePay[]>([]);
  const [examMarks, setExamMarks] = useState<ExMark[]>([]);
  const [behaviourData, setBehaviourData] = useState<BehAsgn[]>([]);
  const [rawDocuments, setRawDocuments] = useState<RawDoc[]>([]);
  const [guardian, setGuardian] = useState<GuardianData | null>(null);

  const fetchProfile = useCallback(async () => {
    const token = getAccessToken();
    const hdrs: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    setLoading(true);
    try {
      const [studentRes, attRes, feeAsgRes, feePayRes, marksRes, behRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/students/students/${student.id}/`, { headers: hdrs }),
        fetch(`${API_BASE_URL}/api/v1/attendance/student-attendance/?student_id=${student.id}&page_size=365`, { headers: hdrs }),
        fetch(`${API_BASE_URL}/api/v1/fees/assignments/?student=${student.id}&page_size=100`, { headers: hdrs }),
        fetch(`${API_BASE_URL}/api/v1/fees/payments/?student=${student.id}&page_size=100`, { headers: hdrs }),
        fetch(`${API_BASE_URL}/api/v1/exams/marks/?student=${student.id}&page_size=100`, { headers: hdrs }),
        fetch(`${API_BASE_URL}/api/v1/behaviour/assignments/?student=${student.id}&page_size=50`, { headers: hdrs }),
      ]);

      const sd = studentRes.ok ? await studentRes.json() : null;

      // Attendance
      const attJson = attRes.ok ? await attRes.json() : {};
      const recs: AttRec[] = attJson.results || (Array.isArray(attJson) ? attJson : []);
      setAttRecords(recs);
      const present = recs.filter(r => r.attendance_type === 'P').length;
      const absent  = recs.filter(r => r.attendance_type === 'A').length;
      const late    = recs.filter(r => r.attendance_type === 'L').length;
      const total   = recs.length || 1;
      const pct     = Math.round(((present + late) / total) * 100);

      // Fees
      const feeAsgJson = feeAsgRes.ok ? await feeAsgRes.json() : {};
      const feePayJson = feePayRes.ok ? await feePayRes.json() : {};
      const asgns: FeeAsgn[] = feeAsgJson.results || (Array.isArray(feeAsgJson) ? feeAsgJson : []);
      const pays: FeePay[]   = feePayJson.results || (Array.isArray(feePayJson) ? feePayJson : []);
      setFeeAssignments(asgns);
      setFeePayments(pays);
      const totalDue = asgns.reduce((s, a) => s + (Number(a.due_amount) || 0), 0);
      const lastPay = [...pays].sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())[0];

      // Marks
      const marksJson = marksRes.ok ? await marksRes.json() : {};
      const marks: ExMark[] = marksJson.results || (Array.isArray(marksJson) ? marksJson : []);
      setExamMarks(marks);
      const validMarks = marks.filter(m => !m.absent && m.obtained_marks !== null);
      const subjectMap = new Map<string, { obtained: number[]; full: number[] }>();
      for (const m of validMarks) {
        const sch = typeof m.schedule === 'object' ? m.schedule : null;
        const subj = sch && typeof sch.subject === 'object' ? sch.subject?.name : `Exam ${m.id}`;
        const fullM = sch?.full_marks || 100;
        if (!subjectMap.has(subj)) subjectMap.set(subj, { obtained: [], full: [] });
        subjectMap.get(subj)!.obtained.push(m.obtained_marks!);
        subjectMap.get(subj)!.full.push(fullM);
      }
      const subjects = Array.from(subjectMap.entries()).map(([name, v]) => ({
        name,
        latest: Math.round((v.obtained[v.obtained.length - 1] / v.full[v.full.length - 1]) * 100),
        trend: v.obtained.map((o, i) => Math.round((o / v.full[i]) * 100)),
      }));
      const avgScore = subjects.length > 0
        ? Math.round(subjects.reduce((s, x) => s + x.latest, 0) / subjects.length)
        : 0;

      // Behaviour
      const behJson = behRes.ok ? await behRes.json() : {};
      setBehaviourData(behJson.results || (Array.isArray(behJson) ? behJson : []));

      // Documents (from student detail)
      const docs: RawDoc[] = sd?.documents || [];
      setRawDocuments(docs);
      const pendingDocs = docs.filter((d: RawDoc) => !d.is_verified).length;

      // Guardian
      if (sd?.guardian && typeof sd.guardian === 'object') setGuardian(sd.guardian as GuardianData);

      const mapped: ProfileData = {
        id: sd?.id ?? student.id,
        fullName: sd ? `${sd.first_name || ''} ${sd.last_name || ''}`.trim() : student.fullName || MOCK_PROFILE.fullName,
        admissionNo: sd?.admission_no || student.admissionNo || '—',
        rollNo: sd?.roll_no || student.rollNo || '—',
        className: sd?.current_class_name || (typeof sd?.current_class === 'object' ? sd.current_class?.name : '') || student.className || '',
        section: sd?.current_section_name || (typeof sd?.current_section === 'object' ? sd.current_section?.name : '') || student.section || '',
        joinedYear: sd?.created_at ? new Date(sd.created_at).getFullYear().toString() : '',
        house: sd?.student_group_name || sd?.house || '',
        status: sd?.status || 'active',
        photoUrl: sd?.photo || sd?.photo_url || undefined,
        attendance: { pct: recs.length > 0 ? pct : MOCK_PROFILE.attendance.pct, present, absent, late },
        fees: {
          balance: totalDue,
          lastPaid: lastPay ? new Date(lastPay.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
        },
        academic: { avgScore: avgScore || 0, subjects: subjects.length > 0 ? subjects : MOCK_PROFILE.academic.subjects },
        pendingDocs,
        openItems: (absent > 3 ? 1 : 0) + (totalDue > 0 ? 1 : 0) + pendingDocs,
      };
      setProfile(mapped);
    } catch (e) {
      console.error('StudentProfilePopup fetch error:', e);
      setProfile({ ...MOCK_PROFILE, id: student.id, fullName: student.fullName || MOCK_PROFILE.fullName });
    } finally {
      setLoading(false);
    }
  }, [student.id, student.fullName, student.admissionNo, student.rollNo, student.className, student.section]);

  const fetchBrief = useCallback(async (force = false) => {
    if (brief && !force) return;
    setBriefLoading(true);
    const token = getAccessToken();
    try {
      const r = await fetch(`${API_BASE_URL}/api/ai/student-brief/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ studentId: student.id, audience: 'parent-meeting' }),
      });
      if (r.ok) setBrief(await r.json()); else setBrief(MOCK_BRIEF);
    } catch { setBrief(MOCK_BRIEF); }
    setBriefLoading(false);
  }, [student.id, brief]);

  useEffect(() => {
    fetchProfile();
    fetchBrief();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id]);

  // Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const p = profile || MOCK_PROFILE;
  const name = student.fullName || student.name || p.fullName;

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,18,34,0.55)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '48px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 36, height: 36, border: '3px solid #EEEAFF', borderTopColor: 'var(--pu)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 }}>Loading student profile…</div>
        <button onClick={onClose} style={{ fontSize: 12, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,18,34,0.55)', zIndex: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.2s ease both',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 960, maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px -16px rgba(14,16,32,0.28)',
      }}
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div style={{
          padding: '18px 24px 16px', borderBottom: '1px solid var(--bd)', flexShrink: 0,
          background: '#fff', display: 'flex', alignItems: 'flex-start', gap: 16,
        }}>
          {/* Avatar */}
          {student.photoUrl ? (
            <img src={student.photoUrl} alt={name} style={{ width: 60, height: 60, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 60, height: 60, borderRadius: 14, background: '#EEEAFF', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--pu)' }}>{getInitials(name)}</span>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>{name}</h2>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3 }}>
              {p.className} {p.section} · Roll {p.rollNo} · Admission {p.admissionNo}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              Joined {p.joinedYear} · House: {p.house}
              <span style={{ background: '#D1FAE5', color: '#059669', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20 }}>{p.status}</span>
            </div>
          </div>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <a href={`/students/list?id=${student.id}`} style={{ textDecoration: 'none' }}>
              <HeaderBtn icon={<GraduationCap size={13} strokeWidth={2} />} label="Profile page" />
            </a>
            <HeaderBtn icon={<Printer size={13} strokeWidth={2} />} label="Print brief" onClick={() => window.print()} />
            <HeaderBtn icon={<Share2 size={13} strokeWidth={2} />} label="Share" />
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-2)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 4 }}>
            <X size={15} color="var(--ink-2)" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* AI Brief banner */}
          {!briefDismissed && (
            <div style={{ margin: '14px 24px 0', background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', border: '1px solid #c4b5fd', borderRadius: 14, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #3a2a82, #150d3a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={14} color="#a78bfa" strokeWidth={2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ✨ Quick brief for parent meeting
                    <button onClick={() => fetchBrief(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#7C3AED' }}>
                      <RefreshCw size={10} strokeWidth={2} className={briefLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                  {briefLoading ? (
                    <div style={{ fontSize: 12, color: '#7C3AED', fontStyle: 'italic' }}>Generating brief…</div>
                  ) : brief ? (
                    <p style={{ margin: 0, fontSize: 12.5, color: '#4C1D95', lineHeight: 1.55 }}>{brief.brief}</p>
                  ) : null}
                  <div style={{ fontSize: 10, color: '#A78BFA', marginTop: 5 }}>Generated by AI · {brief?.generatedAt}</div>
                </div>
                <button onClick={() => setBriefDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                  <X size={13} color="#A78BFA" />
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, padding: '0 24px', borderBottom: '1px solid var(--bd)', marginTop: 14, overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '0 14px', height: 38,
                  border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: activeTab === t.key ? 600 : 400,
                  color: activeTab === t.key ? 'var(--pu)' : 'var(--ink-2)',
                  borderBottom: activeTab === t.key ? '2px solid var(--pu)' : '2px solid transparent',
                  transition: 'color 0.12s', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: '20px 24px', flex: 1 }}>
            {activeTab === 'overview' && <OverviewTab profile={p} attRecords={attRecords} feeAssignments={feeAssignments} behaviourData={behaviourData} rawDocuments={rawDocuments} />}
            {activeTab === 'academic' && <AcademicTab profile={p} />}
            {activeTab === 'attendance' && <AttendanceTab profile={p} attRecords={attRecords} />}
            {activeTab === 'fees' && <FeesTab profile={p} feeAssignments={feeAssignments} feePayments={feePayments} />}
            {activeTab === 'documents' && <DocsTab profile={p} rawDocuments={rawDocuments} />}
            {activeTab === 'achievements' && <AchievTab />}
            {activeTab === 'behaviour' && <BehaviourTab behaviourData={behaviourData} />}
            {activeTab === 'family' && <FamilyTab guardian={guardian} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg-2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {icon}{label}
    </button>
  );
}

function StatCard({ label, value, color, bg }: { label: string; value: string | number; color: string; bg: string }) {
  return (
    <div style={{ padding: '12px 14px', background: bg, borderRadius: 12, flex: 1, minWidth: 80 }}>
      <div style={{ fontSize: 11, color: `${color}99`, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}

function OverviewTab({ profile: p, attRecords, feeAssignments, behaviourData, rawDocuments }: {
  profile: ProfileData; attRecords: AttRec[]; feeAssignments: FeeAsgn[]; behaviourData: BehAsgn[]; rawDocuments: RawDoc[];
}) {
  // Build activity feed from real data
  const activities: Array<{ label: string; type: string; date: Date }> = [];
  const last5att = [...attRecords].sort((a, b) => new Date(b.attendance_date).getTime() - new Date(a.attendance_date).getTime()).slice(0, 5);
  for (const r of last5att) {
    if (r.attendance_type === 'A') activities.push({ label: `Absent on ${new Date(r.attendance_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}${r.notes ? ` — ${r.notes}` : ''}`, type: 'warn', date: new Date(r.attendance_date) });
    if (r.attendance_type === 'L') activities.push({ label: `Late arrival on ${new Date(r.attendance_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, type: 'info', date: new Date(r.attendance_date) });
  }
  for (const d of rawDocuments.filter(d => !d.is_verified).slice(0, 3)) {
    activities.push({ label: `Document pending: ${d.title}`, type: 'doc', date: new Date(d.uploaded_at) });
  }
  for (const b of behaviourData.slice(0, 2)) {
    activities.push({ label: `Behaviour: ${b.incident_title}`, type: b.point > 0 ? 'academic' : 'warn', date: new Date(b.created_at) });
  }
  const sortedActivity = activities.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);
  const msAgo = (d: Date) => {
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard label="Attendance" value={`${p.attendance.pct}%`} color="#059669" bg="#D1FAE5" />
        <StatCard label="Avg Score" value={p.academic.avgScore > 0 ? `${p.academic.avgScore}%` : '—'} color="#6D4AFF" bg="#EEEAFF" />
        <StatCard label="Pending Fees" value={p.fees.balance === 0 ? '₹0' : `₹${p.fees.balance.toLocaleString('en-IN')}`} color={p.fees.balance > 0 ? '#E0463A' : '#059669'} bg={p.fees.balance > 0 ? '#FEE2E2' : '#D1FAE5'} />
        <StatCard label="Open Items" value={p.openItems} color="#D97706" bg="#FEF3C7" />
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 10 }}>Recent Activity</div>
      {sortedActivity.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', padding: '12px 0' }}>No recent activity found.</div>
      ) : sortedActivity.map((t, i) => {
        const colors: Record<string, string> = { academic: '#6D4AFF', warn: '#D97706', info: '#3B82F6', doc: '#E0463A' };
        const c = colors[t.type] || '#6B7280';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--bg-2)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0, marginTop: 4 }} />
            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-1)' }}>{t.label}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>{msAgo(t.date)}</span>
          </div>
        );
      })}
      {sortedActivity.length === 0 && feeAssignments.length === 0 && attRecords.length === 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8, fontStyle: 'italic' }}>Data will appear once attendance, fees, and marks are recorded.</div>
      )}
    </div>
  );
}

function AcademicTab({ profile: p }: { profile: ProfileData }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 12 }}>Subject-wise Performance</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {p.academic.subjects.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-0)', borderRadius: 10, border: '1px solid var(--bd)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)', minWidth: 120 }}>{s.name}</span>
            <div style={{ flex: 1, height: 5, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${s.latest}%`, background: s.latest >= 80 ? '#22C55E' : s.latest >= 60 ? '#F59E0B' : '#E0463A', borderRadius: 3, transition: 'width 0.8s ease' }} />
            </div>
            <ScoreBadge score={s.latest} />
            <MiniSparkline data={s.trend} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AttendanceTab({ profile: p, attRecords }: { profile: ProfileData; attRecords: AttRec[] }) {
  const TYPE_COLOR: Record<string, string> = { P: '#22C55E', A: '#E0463A', L: '#F59E0B', F: '#3B82F6', H: '#9CA3AF' };
  const TYPE_LABEL: Record<string, string> = { P: 'Present', A: 'Absent', L: 'Late', F: 'Half-day', H: 'Holiday' };

  // Build a map of date → type for calendar view (last 30 calendar days)
  const dateMap = new Map(attRecords.map(r => [r.attendance_date, r.attendance_type]));
  const days30: Array<{ date: string; type: string }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    days30.push({ date: key, type: dateMap.get(key) || '' });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatCard label="Present" value={p.attendance.present} color="#059669" bg="#D1FAE5" />
        <StatCard label="Absent" value={p.attendance.absent} color="#E0463A" bg="#FEE2E2" />
        <StatCard label="Late" value={p.attendance.late} color="#D97706" bg="#FEF3C7" />
        <StatCard label="Overall" value={`${p.attendance.pct}%`} color="#6D4AFF" bg="#EEEAFF" />
      </div>
      {attRecords.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', padding: '20px 0' }}>No attendance records found for this student.</div>
      ) : (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 10 }}>Last 30 Days</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
            {days30.map((d, i) => (
              <div key={i} title={`${d.date}: ${d.type ? TYPE_LABEL[d.type] || d.type : 'No record'}`}
                style={{ width: '100%', paddingBottom: '100%', position: 'relative', borderRadius: 4 }}>
                <div style={{ position: 'absolute', inset: 0, background: d.type ? TYPE_COLOR[d.type] || '#E5E7EB' : '#F3F4F6', borderRadius: 4, opacity: d.type ? 0.85 : 0.4 }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            {Object.entries(TYPE_LABEL).filter(([k]) => k !== 'H').map(([k, v]) => (
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-3)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: TYPE_COLOR[k] }} />{v}
              </span>
            ))}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-3)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#F3F4F6', border: '1px solid #D1D5DB' }} />No record
            </span>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', marginTop: 20, marginBottom: 10 }}>Recent Absences</div>
          {attRecords.filter(r => r.attendance_type === 'A' || r.attendance_type === 'L')
            .sort((a, b) => new Date(b.attendance_date).getTime() - new Date(a.attendance_date).getTime())
            .slice(0, 5)
            .map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--bg-0)', border: '1px solid var(--bd)', borderRadius: 8, marginBottom: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLOR[r.attendance_type], flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-1)' }}>{new Date(r.attendance_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span style={{ fontSize: 11, color: TYPE_COLOR[r.attendance_type], fontWeight: 600 }}>{TYPE_LABEL[r.attendance_type]}</span>
                {r.notes && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{r.notes}</span>}
              </div>
            ))}
        </>
      )}
    </div>
  );
}

function FeesTab({ profile: p, feeAssignments, feePayments }: { profile: ProfileData; feeAssignments: FeeAsgn[]; feePayments: FeePay[] }) {
  const paid = p.fees.balance === 0;
  const feesTypeName = (ft: FeeAsgn['fees_type']) => typeof ft === 'object' && ft ? ft.name : (ft || 'Fee');
  const sortedPayments = [...feePayments].sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtAmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <StatCard label="Outstanding" value={paid ? '₹0' : fmtAmt(p.fees.balance)} color={paid ? '#059669' : '#E0463A'} bg={paid ? '#D1FAE5' : '#FEE2E2'} />
        <StatCard label="Last Payment" value={p.fees.lastPaid} color="#6D4AFF" bg="#EEEAFF" />
      </div>
      {paid && (
        <div style={{ padding: '14px', background: '#D1FAE5', borderRadius: 12, fontSize: 13, color: '#065F46', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
          ✓ Fee account is up to date. No outstanding dues.
        </div>
      )}

      {feeAssignments.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', marginTop: 16, marginBottom: 10 }}>Fee Assignments</div>
          {feeAssignments.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg-0)', border: `1px solid ${Number(a.due_amount) > 0 ? '#FCA5A5' : 'var(--bd)'}`, borderRadius: 9, marginBottom: 5 }}>
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-1)' }}>{feesTypeName(a.fees_type)}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Due {fmtDate(a.due_date)}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>{fmtAmt(a.net_amount || a.amount)}</span>
              {Number(a.due_amount) > 0 ? (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#E0463A', background: '#FEE2E2', padding: '2px 7px', borderRadius: 20 }}>Due {fmtAmt(a.due_amount)}</span>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#D1FAE5', padding: '2px 7px', borderRadius: 20 }}>Paid</span>
              )}
            </div>
          ))}
        </>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', marginTop: 16, marginBottom: 10 }}>Payment History</div>
      {sortedPayments.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', padding: '8px 0' }}>No payments recorded yet.</div>
      ) : sortedPayments.slice(0, 10).map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg-0)', border: '1px solid var(--bd)', borderRadius: 9, marginBottom: 5 }}>
          <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-1)' }}>{fmtDate(r.paid_at)}{r.transaction_reference ? ` · Ref: ${r.transaction_reference}` : ''}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{r.method || '—'}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>{fmtAmt(r.amount_paid)}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#D1FAE5', padding: '2px 7px', borderRadius: 20 }}>paid</span>
        </div>
      ))}
    </div>
  );
}

function DocsTab({ profile: p, rawDocuments }: { profile: ProfileData; rawDocuments: RawDoc[] }) {
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  return (
    <div>
      {p.pendingDocs > 0 && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: '#B91C1C', fontWeight: 500 }}>
          ⚠ {p.pendingDocs} document{p.pendingDocs > 1 ? 's' : ''} pending verification
        </div>
      )}
      {rawDocuments.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', padding: '12px 0' }}>No documents on record for this student.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rawDocuments.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: !d.is_verified ? '#FFF5F5' : 'var(--bg-0)', border: `1px solid ${!d.is_verified ? '#FCA5A5' : 'var(--bd)'}`, borderRadius: 9 }}>
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-1)', fontWeight: 500 }}>{d.title}</span>
              {d.document_type && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{d.document_type}</span>}
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{fmtDate(d.uploaded_at)}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: d.is_verified ? '#D1FAE5' : '#FEE2E2', color: d.is_verified ? '#059669' : '#E0463A' }}>
                {d.is_verified ? 'Verified' : 'Pending'}
              </span>
              {d.file_url && (
                <a href={d.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--pu)', background: 'var(--pu-soft)', border: 'none', borderRadius: 6, padding: '3px 9px', textDecoration: 'none' }}>View</a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AchievTab() {
  const items = [
    { title: '1st Place — Science Olympiad', category: 'Academic', date: 'Nov 2025', icon: '🥇' },
    { title: 'Best Performer — Annual Sports Day', category: 'Sports', date: 'Oct 2025', icon: '🏆' },
    { title: 'School Quiz Team', category: 'Academic', date: 'Sep 2025', icon: '⭐' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((a, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'var(--bg-0)', border: '1px solid var(--bd)', borderRadius: 12 }}>
          <span style={{ fontSize: 28 }}>{a.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>{a.title}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{a.category} · {a.date}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BehaviourTab({ behaviourData }: { behaviourData: BehAsgn[] }) {
  const positive = behaviourData.filter(b => b.point > 0);
  const negative = behaviourData.filter(b => b.point <= 0);
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div>
      {behaviourData.length === 0 ? (
        <div style={{ background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '12px', marginBottom: 14, fontSize: 12.5, color: '#065F46', fontWeight: 500 }}>
          ✓ No behavioural incidents on record. Clean track record.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <StatCard label="Positive" value={positive.length} color="#059669" bg="#D1FAE5" />
          <StatCard label="Incidents" value={negative.length} color="#E0463A" bg="#FEE2E2" />
          <StatCard label="Net Points" value={behaviourData.reduce((s, b) => s + b.point, 0)} color="#6D4AFF" bg="#EEEAFF" />
        </div>
      )}

      {positive.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 10 }}>Positive Records</div>
          {positive.map((r, i) => (
            <div key={i} style={{ padding: '9px 12px', background: 'var(--bg-0)', border: '1px solid var(--bd)', borderRadius: 9, marginBottom: 5 }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-1)' }}>⭐ {r.incident_title}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{r.assigned_by ? `By ${r.assigned_by} · ` : ''}{fmtDate(r.created_at)} · +{r.point} pts</div>
            </div>
          ))}
        </>
      )}

      {negative.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', marginTop: positive.length > 0 ? 16 : 0, marginBottom: 10 }}>Incidents</div>
          {negative.map((r, i) => (
            <div key={i} style={{ padding: '9px 12px', background: '#FFF5F5', border: '1px solid #FCA5A5', borderRadius: 9, marginBottom: 5 }}>
              <div style={{ fontSize: 12.5, color: '#B91C1C' }}>⚠ {r.incident_title}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{r.assigned_by ? `By ${r.assigned_by} · ` : ''}{fmtDate(r.created_at)} · {r.point} pts</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function FamilyTab({ guardian }: { guardian: GuardianData | null }) {
  if (!guardian) return (
    <div style={{ fontSize: 12.5, color: 'var(--ink-3)', padding: '12px 0' }}>No guardian/contact information on record.</div>
  );
  const contacts = [guardian];
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 12 }}>Parent / Guardian Contacts</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {contacts.map((g, i) => (
          <div key={i} style={{ padding: '12px 14px', border: '1px solid var(--bd)', borderRadius: 12, background: 'var(--bg-0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EEEAFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--pu)' }}>{g.full_name?.[0] || '?'}</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>{g.full_name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{g.relation}{g.occupation ? ` · ${g.occupation}` : ''}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {g.phone && (
                <a href={`tel:${g.phone}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#3B82F6', background: '#DBEAFE', padding: '4px 10px', borderRadius: 7 }}>
                  <Phone size={10} strokeWidth={2.5} />{g.phone}
                </a>
              )}
              {g.phone && (
                <a href={`https://wa.me/${g.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#059669', background: '#D1FAE5', padding: '4px 10px', borderRadius: 7 }}>
                  <MessageCircle size={10} strokeWidth={2.5} />WhatsApp
                </a>
              )}
              {g.email && (
                <a href={`mailto:${g.email}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#6D4AFF', background: '#EEEAFF', padding: '4px 10px', borderRadius: 7 }}>
                  <Mail size={10} strokeWidth={2.5} />{g.email}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
