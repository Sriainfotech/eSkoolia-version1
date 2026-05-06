'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X, Send, ExternalLink } from 'lucide-react';
import { exactMatch, localFuzzySearch } from '@/lib/aiSearch';
import { FLAT_INDEX } from '@/lib/routes';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';
import { parseIntent } from '@/lib/aiBotIntent';
import { StudentLookupResults, type StudentResult } from './aibot/StudentLookupResults';
import { StudentProfilePopup } from './aibot/StudentProfilePopup';

/** Shape returned by /api/v1/students/students/ list endpoint */
interface RawStudentAPI {
  id: number;
  first_name: string;
  last_name: string;
  admission_no?: string;
  roll_no?: string;
  current_class?: { id: number; name: string } | number | null;
  current_class_name?: string | null;
  current_section?: { id: number; name: string } | number | null;
  current_section_name?: string | null;
  status?: string;
  photo?: string;
}

function normalizeStudent(s: RawStudentAPI): import('./aibot/StudentLookupResults').StudentResult {
  // Prefer explicit name fields; fall back to nested object; fall back to ''
  const className = s.current_class_name
    ?? (typeof s.current_class === 'object' && s.current_class ? s.current_class.name : '')
    ?? '';
  const section = s.current_section_name
    ?? (typeof s.current_section === 'object' && s.current_section ? s.current_section.name : '')
    ?? '';
  return {
    id: s.id,
    fullName: `${s.first_name} ${s.last_name}`.trim(),
    admissionNo: s.admission_no,
    rollNo: s.roll_no,
    className,
    section,
    status: s.status,
    photoUrl: s.photo,
  };
}

const PARENT_FAQ: Record<string, string> = {
  'fees due': 'You can check outstanding fees by going to **Fees → Fees Due**. You can also generate a statement from the Fees Collection page. For urgent queries, please contact the accounts office.',
  'fee': 'Fees can be paid online or at the school office. Visit **Fees → Fees Collection** to check payment status. For fee structure details, see **Fees → Fees Master**.',
  'attendance': "Your child's attendance can be viewed under **Reports → Student Attendance**. For today's attendance, check with the class teacher or visit the attendance section.",
  'exam': 'Upcoming exam schedules are listed under **Examination → Exam Schedule**. Results are published under **Examination → Result Publish** once available.',
  'result': 'Exam results are published under **Examination → Result Publish**. You can also view historical results in **Reports → Exam Result**.',
  'homework': 'Assigned homework is listed under **Academics → Homework List**. Completed homework evaluations are in **Academics → Homework Evaluation**.',
  'school timing': 'Please visit **Settings → General Settings** for official school timings. You can also contact the school office for the latest schedule.',
  'holiday': 'Holiday lists are published under **Academics → Class Routine**. Please check the school notice board or contact administration for updates.',
  'transport': 'Bus routes and vehicle assignments are in **Transport → Routes** and **Transport → Assign Vehicles**. For live bus tracking, visit **Transport → Live Tracking**.',
  'library': 'Library books and issue status can be checked under **Library → Book Issues**. Contact the librarian for book reservations.',
  'certificate': 'Certificates (bonafide, character, etc.) can be generated from **Administration → Generate Certificate**. Submit a request to the school office.',
  'id card': 'Student ID cards can be generated from **Administration → Generate ID Card**. Contact administration if your child has lost their ID card.',
  'complaint': 'Complaints can be registered at **Administration → Complaint**. You can also contact the school principal directly.',
  'admission': 'Admission queries can be submitted at **Admissions → Admission Query**. Our team typically responds within 2 business days.',
};

function findFAQAnswer(q: string): string | null {
  const lower = q.toLowerCase();
  for (const [key, answer] of Object.entries(PARENT_FAQ)) {
    if (lower.includes(key)) return answer;
  }
  return null;
}

async function searchStudents(q: string): Promise<Array<{ id: number; name: string; class_name?: string; roll_no?: string }>> {
  try {
    const token = getAccessToken();
    const res = await fetch(`${API_BASE_URL}/api/v1/students/students/?search=${encodeURIComponent(q)}&limit=5`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.results ?? []);
  } catch { return []; }
}

type FlatEntry = (typeof FLAT_INDEX)[0];

interface Msg {
  id: string;
  role: 'user' | 'bot';
  text?: string;
  results?: FlatEntry[];
  studentResults?: StudentResult[];
  studentQuery?: string;
  redirect?: FlatEntry;
  collapsed?: boolean;
  collapsedCount?: number;
  isTyping?: boolean;
}

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

const ENDPOINT = process.env.NEXT_PUBLIC_ASSISTANT_ENDPOINT;

async function remoteSearch(q: string): Promise<{ pages?: FlatEntry[]; reply?: string } | null> {
  if (!ENDPOINT) return null;
  try {
    const token = getAccessToken();
    const res = await fetch(`${API_BASE_URL}${ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ q }),
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ pages?: FlatEntry[]; reply?: string }>;
  } catch { return null; }
}

let _id = 0;
const uid = () => String(++_id);

export function AIBot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileStudent, setProfileStudent] = useState<StudentResult | null>(null);
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    try {
      const saved = localStorage.getItem('eskoolia_todos');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showTodos, setShowTodos] = useState(false);
  const [todoInput, setTodoInput] = useState('');
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { localStorage.setItem('eskoolia_todos', JSON.stringify(todos)); } catch { /* ignore */ }
  }, [todos]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const addMsg = useCallback((m: Omit<Msg, 'id'>) => {
    setMsgs(prev => [...prev, { ...m, id: uid() }]);
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(true);
    if (msgs.length === 0) {
      addMsg({ role: 'bot', text: "Hi — I'm your eskoolia assistant. I can find students, navigate pages, answer parent questions, compose messages, and add tasks to your planner. Try 'find Priya Sharma', 'add wednesday 10am staff meeting', or 'compose message about fees'." });
    } else {
      setMsgs(prev => {
        const resultCount = prev.filter(m => m.results || m.redirect).length;
        if (resultCount === 0) return prev;
        const collapsed = prev.map(m =>
          m.results || m.redirect ? { ...m, collapsed: true } : m
        );
        return [...collapsed, { id: uid(), role: 'bot' as const, text: '', collapsedCount: resultCount, collapsed: false }];
      });
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [msgs.length, addMsg]);

  const handleClose = useCallback(() => setOpen(false), []);

  const ask = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setInput('');
    addMsg({ role: 'user', text: q });

    const intent = parseIntent(q);

    // Navigate intent
    if (intent.kind === 'navigate') {
      const exact = exactMatch(q);
      if (exact) {
        addMsg({ role: 'bot', redirect: exact, text: `Navigating to ${exact.label}…` });
        setTimeout(() => { router.push(exact.path); setOpen(false); }, 680);
      } else {
        addMsg({ role: 'bot', text: `Navigating to ${intent.label}…` });
        setTimeout(() => { router.push(intent.path); setOpen(false); }, 680);
      }
      return;
    }

    // Student lookup
    if (intent.kind === 'student-lookup') {
      setLoading(true);
      addMsg({ role: 'bot', isTyping: true, text: '' });
      const token = getAccessToken();
      let students: StudentResult[] = [];
      try {
        // Correct URL: /api/v1/students/students/ (DRF router doubles the prefix)
        const res = await fetch(`${API_BASE_URL}/api/v1/students/students/?search=${encodeURIComponent(intent.query)}&limit=8`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const d = await res.json();
          const raw: RawStudentAPI[] = Array.isArray(d) ? d : (d.results ?? []);
          students = raw.map(normalizeStudent);
        }
      } catch { /* silently fail */ }
      setLoading(false);
      setMsgs(prev => {
        const withoutTyping = prev.filter(m => !m.isTyping);
        return [...withoutTyping, { id: uid(), role: 'bot' as const, text: '', studentResults: students, studentQuery: intent.query }];
      });
      return;
    }

    // Parent Q&A
    if (intent.kind === 'parent-qa') {
      const faqAnswer = findFAQAnswer(q);
      if (faqAnswer) { addMsg({ role: 'bot', text: faqAnswer }); return; }
    }

    // Planner task
    if (intent.kind === 'planner-task') {
      const DAY_MAP: Record<string, number> = {
        mon: 0, monday: 0, tue: 1, tuesday: 1, wed: 2, wednesday: 2,
        thu: 3, thursday: 3, fri: 4, friday: 4, sat: 5, saturday: 5, sun: 6, sunday: 6,
      };
      const dayIndex = DAY_MAP[intent.day.toLowerCase()] ?? 0;
      // Parse time: "12pm" → "12:00", "9:30am" → "09:30", "14:00" → "14:00"
      const timeRaw = intent.time.toLowerCase().trim();
      let timeFormatted = '09:00';
      const tMatch = timeRaw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
      if (tMatch) {
        let h = parseInt(tMatch[1]);
        const m2 = tMatch[2] ? parseInt(tMatch[2]) : 0;
        const mer = tMatch[3];
        if (mer === 'pm' && h < 12) h += 12;
        if (mer === 'am' && h === 12) h = 0;
        timeFormatted = `${String(h).padStart(2, '0')}:${String(m2).padStart(2, '0')}`;
      }
      // Determine current week key (Monday date)
      const now = new Date();
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      monday.setHours(0, 0, 0, 0);
      const wk = monday.toISOString().slice(0, 10);
      const LS_KEY = 'eskoolia_week_events_v2';
      const lsKey = `${LS_KEY}_${wk}`;
      let existing: unknown[] = [];
      try { existing = JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch { existing = []; }
      const newEvent = {
        id: `bot-${Date.now()}`,
        dayIndex,
        time: timeFormatted,
        title: intent.title,
        category: 'meeting',
        aiGenerated: true,
      };
      existing.push(newEvent);
      try { localStorage.setItem(lsKey, JSON.stringify(existing)); } catch { /* ignore */ }
      // Notify WeekAhead widget to reload
      window.dispatchEvent(new CustomEvent('eskoolia-planner-updated', { detail: { weekKey: wk } }));
      const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      addMsg({ role: 'bot', text: `✅ Added to your planner: **${intent.title}** on **${DAY_LABELS[dayIndex]}** at **${timeFormatted}**. Check the Week Ahead widget on your home screen.` });
      return;
    }

    // Compose message
    if (intent.kind === 'compose-message') {
      const topic = intent.topic.toLowerCase();
      let template = '';
      if (topic.includes('fee') || topic.includes('payment')) {
        template = `Dear Parent,\n\nThis is a gentle reminder that your child's school fees for the current term are due. Kindly clear the outstanding amount at your earliest convenience to avoid any inconvenience.\n\nFor any queries regarding the fee structure or payment, please contact our accounts office.\n\nThank you for your cooperation.\n\nWarm regards,\n[School Name] Administration`;
      } else if (topic.includes('attendance') || topic.includes('absent')) {
        template = `Dear Parent,\n\nWe wish to inform you that your child's attendance has been below the required 75% threshold. Regular attendance is essential for academic progress.\n\nKindly ensure your child attends school regularly. If there are any concerns, please meet with the class teacher at your earliest convenience.\n\nRegards,\n[School Name] Administration`;
      } else if (topic.includes('exam') || topic.includes('result') || topic.includes('mark')) {
        template = `Dear Parent,\n\nWe are pleased to inform you that the exam results have been published. You can view your child's results by visiting our school portal or contacting the class teacher.\n\nFor result-related queries, please visit the school office during working hours.\n\nBest regards,\n[School Name] Academic Team`;
      } else if (topic.includes('meeting') || topic.includes('parent teacher')) {
        template = `Dear Parent,\n\nYou are cordially invited to attend the Parent-Teacher Meeting scheduled on [DATE] at [TIME] in [VENUE].\n\nYour presence is important as we will discuss your child's academic progress, attendance, and overall development.\n\nKindly confirm your attendance by [RSVP DATE].\n\nLooking forward to meeting you.\n\nRegards,\n[School Name] Administration`;
      } else {
        template = `Dear Parent,\n\nWe would like to bring to your attention an important matter regarding ${intent.topic}.\n\n[Please add your specific message here]\n\nFor any queries, please contact the school office.\n\nThank you.\n\nRegards,\n[School Name] Administration`;
      }
      addMsg({ role: 'bot', text: `📝 Here's a draft message about **${intent.topic}**:\n\n---\n\n${template}\n\n---\n\n_Copy and customize as needed._` });
      return;
    }

    // FAQ fallback check
    const faqAnswer = findFAQAnswer(q);
    if (faqAnswer) {
      addMsg({ role: 'bot', text: faqAnswer });
      return;
    }

    setLoading(true);
    addMsg({ role: 'bot', isTyping: true, text: '' });

    let pages: FlatEntry[] = [];
    let reply = '';
    const remote = await remoteSearch(q);
    if (remote?.pages?.length) {
      pages = remote.pages;
      reply = remote.reply || '';
    } else {
      pages = localFuzzySearch(q) as FlatEntry[];
    }

    setLoading(false);
    setMsgs(prev => {
      const withoutTyping = prev.filter(m => !m.isTyping);
      const botReply: Msg = {
        id: uid(),
        role: 'bot',
        text: reply || (pages.length > 0
          ? `Found ${pages.length} result${pages.length > 1 ? 's' : ''} for "${q}":`
          : `No results found for "${q}". Try a different keyword.`),
        results: pages.length > 0 ? pages : undefined,
      };
      return [...withoutTyping, botReply];
    });
  }, [addMsg, router]);

  return (
    <>
      {/* Launcher */}
      <button
        onClick={handleOpen}
        aria-label="Open AI assistant"
        style={{
          position: 'fixed', right: 22, bottom: 22, zIndex: 450,
          width: 58, height: 58, borderRadius: '50%', cursor: 'pointer',
          border: 'none', padding: 0,
          background: 'radial-gradient(circle at 30% 28%, #3a2a82 0%, #150d3a 60%, #0a0820 100%)',
          boxShadow: '0 14px 32px -10px rgba(88,54,224,0.55), 0 2px 4px rgba(14,16,32,0.1), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -8px 18px rgba(124,91,255,0.18)',
          transition: 'transform 0.22s, box-shadow 0.22s',
          overflow: 'hidden',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px) scale(1.05)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}
      >
        {/* Halo */}
        <span style={{
          position: 'absolute', inset: -2, borderRadius: '50%', pointerEvents: 'none',
          background: 'conic-gradient(from 0deg, transparent 0%, #7c5bff 25%, #a78bfa 40%, transparent 60%, #5836e0 80%, transparent 100%)',
          animation: 'aiSpin 4s linear infinite', opacity: 0.85, filter: 'blur(0.5px)',
        }} />
        {/* Inner mask */}
        <span style={{
          position: 'absolute', inset: 1, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 28%, #3a2a82 0%, #150d3a 60%, #0a0820 100%)',
        }} />
        {/* Sparkle */}
        <svg style={{ position: 'relative', zIndex: 10, width: 30, height: 30, display: 'block', margin: 'auto' }} viewBox="0 0 32 32">
          <defs>
            <linearGradient id="aig1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff"/>
              <stop offset="50%" stopColor="#e9defb"/>
              <stop offset="100%" stopColor="#a78bfa"/>
            </linearGradient>
          </defs>
          <g style={{ animation: 'aiPulse 2.4s ease-in-out infinite', transformOrigin: 'center' }}>
            <path d="M16 3 L18.4 12.2 L27.6 14.6 L18.4 17 L16 26.2 L13.6 17 L4.4 14.6 L13.6 12.2 Z" fill="url(#aig1)" style={{ filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.6))' }}/>
          </g>
          <circle cx="25" cy="7" r="1.6" fill="#fff" opacity="0.9"/>
          <circle cx="6" cy="24" r="1.1" fill="#fff" opacity="0.7"/>
        </svg>
        {/* Orbiting particle */}
        <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', animation: 'aiSpin 5.5s linear infinite reverse' }}>
          <span style={{
            position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)',
            width: 6, height: 6, borderRadius: '50%', background: 'white',
            boxShadow: '0 0 8px rgba(255,255,255,0.95), 0 0 14px rgba(167,139,250,0.7)',
          }}/>
        </span>
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: 'fixed', right: 22, bottom: 92, zIndex: 460,
            width: 380, maxHeight: 540, borderRadius: 22,
            background: 'var(--bg-1)', border: '1px solid var(--bd)',
            boxShadow: '0 20px 60px -10px rgba(14,16,32,0.25)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'aiBotOpen 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 16px 12px', borderBottom: '1px solid var(--bd)',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'radial-gradient(circle at 30% 28%, #3a2a82 0%, #150d3a 60%, #0a0820 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 32 32">
                <defs>
                  <linearGradient id="aig2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fff"/>
                    <stop offset="100%" stopColor="#a78bfa"/>
                  </linearGradient>
                </defs>
                <path d="M16 3 L18.4 12.2 L27.6 14.6 L18.4 17 L16 26.2 L13.6 17 L4.4 14.6 L13.6 12.2 Z" fill="url(#aig2)"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)' }}>Ask eskoolia</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}/>
                Online · navigate by keyword
              </div>
            </div>
            <button onClick={handleClose} style={{
              width: 28, height: 28, borderRadius: 8, border: '1px solid var(--bd)',
              background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={14} color="var(--ink-3)" />
            </button>
          </div>

          {/* Todo Widget */}
          <div style={{ borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
            <button
              onClick={() => setShowTodos(t => !t)}
              style={{
                width: '100%', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>
                ✓ To-Do ({todos.filter(t => !t.done).length} pending)
              </span>
              <span style={{ fontSize: 11, color: 'var(--pu)' }}>{showTodos ? '▲' : '▼'}</span>
            </button>
            {showTodos && (
              <div style={{ padding: '0 16px 10px' }}>
                {todos.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '8px 0' }}>No tasks yet</div>
                )}
                {todos.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--bd)' }}>
                    <input
                      type="checkbox" checked={t.done}
                      onChange={() => setTodos(prev => prev.map(x => x.id === t.id ? { ...x, done: !x.done } : x))}
                      style={{ cursor: 'pointer', accentColor: 'var(--pu)' }}
                    />
                    <span style={{ flex: 1, fontSize: 12, color: t.done ? 'var(--ink-3)' : 'var(--ink-1)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                    <button
                      onClick={() => setTodos(prev => prev.filter(x => x.id !== t.id))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 14, lineHeight: 1 }}
                    >×</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input
                    value={todoInput} onChange={e => setTodoInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && todoInput.trim()) {
                        setTodos(prev => [...prev, { id: String(Date.now()), text: todoInput.trim(), done: false }]);
                        setTodoInput('');
                      }
                    }}
                    placeholder="Add task…" style={{
                      flex: 1, fontSize: 12, padding: '5px 10px',
                      border: '1px solid var(--bd)', borderRadius: 8, background: 'var(--bg-2)', outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => {
                      if (todoInput.trim()) {
                        setTodos(prev => [...prev, { id: String(Date.now()), text: todoInput.trim(), done: false }]);
                        setTodoInput('');
                      }
                    }}
                    style={{
                      padding: '5px 10px', background: 'var(--pu)', color: '#fff',
                      border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                    }}
                  >+</button>
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.map(m => {
              if (m.collapsedCount) {
                return (
                  <div key={m.id} style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => setMsgs(prev => prev.map(x => ({ ...x, collapsed: false })).filter(x => !x.collapsedCount))}
                      style={{
                        fontSize: 11, color: 'var(--pu)', background: 'none', border: '1px solid var(--bd)',
                        borderRadius: 20, padding: '3px 12px', cursor: 'pointer',
                      }}
                    >
                      {m.collapsedCount} previous result{m.collapsedCount > 1 ? 's' : ''} — show
                    </button>
                  </div>
                );
              }
              if (m.collapsed) return null;
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {m.isTyping ? (
                    <div style={{
                      padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 12,
                      fontSize: 13, color: 'var(--ink-3)',
                    }}>…</div>
                  ) : (
                    <>
                      {m.text && (
                        <div style={{
                          padding: '8px 12px', maxWidth: '80%',
                          background: m.role === 'user' ? 'var(--pu)' : 'var(--bg-2)',
                          color: m.role === 'user' ? '#fff' : 'var(--ink-1)',
                          borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                          fontSize: 13, lineHeight: '1.5',
                        }}>
                          {m.text}
                        </div>
                      )}
                      {m.redirect && (
                        <div style={{
                          width: '100%', padding: '10px 12px',
                          background: 'linear-gradient(135deg, rgba(124,91,255,0.08), rgba(88,54,224,0.04))',
                          border: '1px solid rgba(124,91,255,0.2)', borderRadius: 12,
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 8,
                            background: m.redirect.bg, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {m.redirect.icon && <m.redirect.icon size={14} color={m.redirect.ic} strokeWidth={1.5}/>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>{m.redirect.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{m.redirect.path}</div>
                          </div>
                          <ExternalLink size={13} color="var(--pu)" />
                        </div>
                      )}
                      {m.results && !m.collapsed && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                          {m.results.slice(0, 5).map(r => (
                            <Link key={r.path} href={r.path} onClick={handleClose} style={{ textDecoration: 'none' }}>
                              <div
                                style={{
                                  padding: '8px 10px', background: 'var(--bg-1)',
                                  border: '1px solid var(--bd)', borderRadius: 10,
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  transition: 'border-color 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(124,91,255,0.3)')}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--bd)')}
                              >
                                <div style={{
                                  width: 24, height: 24, borderRadius: 6,
                                  background: r.bg, flexShrink: 0,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {r.icon && <r.icon size={12} color={r.ic} strokeWidth={1.5}/>}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{r.path}</div>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                      {m.studentResults && (
                        <div style={{ width: '100%' }}>
                          <StudentLookupResults
                            students={m.studentResults}
                            query={m.studentQuery || ''}
                            onViewProfile={(student) => setProfileStudent(student)}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid var(--bd)',
            display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }}
              placeholder="Type a page or student name…"
              disabled={loading}
              style={{
                flex: 1, height: 36, borderRadius: 10, border: '1px solid var(--bd)',
                background: 'var(--bg-2)', padding: '0 12px', fontSize: 13,
                color: 'var(--ink-1)', outline: 'none',
              }}
            />
            <button
              onClick={() => ask(input)}
              disabled={loading || !input.trim()}
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: 'var(--pu)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: (!input.trim() || loading) ? 0.5 : 1,
              }}
            >
              <Send size={14} color="#fff" />
            </button>
            </div>
            <p style={{ fontSize: 10.5, color: 'var(--ink-3)', margin: '0 0 4px', padding: '0 4px', textAlign: 'center' }}>
              Tip — find students by name, navigate to pages, add planner tasks, or compose messages
            </p>
            {/* Smart quick-action chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', marginBottom: 2 }}>
              {/* Navigation chips — go directly */}
              {[
                { label: '📋 Attendance', q: 'student attendance' },
                { label: '💰 Fee dues', q: 'fees due' },
                { label: '🚌 Live bus', q: 'live bus tracking' },
                { label: '📅 Exam schedule', q: 'exam schedule' },
                { label: '📝 Marks', q: 'marks register' },
                { label: '🏥 Sick bay', q: 'sick bay' },
                { label: '📢 Broadcast', q: 'send broadcast' },
              ].map(c => (
                <button
                  key={c.q}
                  onClick={() => ask(c.q)}
                  style={{
                    fontSize: 10.5, padding: '3px 9px', border: '1px solid var(--bd)',
                    borderRadius: 20, background: 'var(--bg-2)', cursor: 'pointer',
                    color: 'var(--ink-2)', transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--pu-soft)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--pu)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-2)'; }}
                >
                  {c.label}
                </button>
              ))}
              {/* Student search chip — prompts user to type a name */}
              <button
                onClick={() => { setInput('find '); setTimeout(() => inputRef.current?.focus(), 50); }}
                style={{
                  fontSize: 10.5, padding: '3px 9px',
                  border: '1px solid rgba(109,74,255,0.4)',
                  borderRadius: 20, background: 'var(--pu-soft)', cursor: 'pointer',
                  color: 'var(--pu)', fontWeight: 600, transition: 'all 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--pu)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--pu-soft)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--pu)'; }}
              >
                🎓 Find student…
              </button>
              {/* Planner chip */}
              <button
                onClick={() => { setInput('add wednesday 10am '); setTimeout(() => inputRef.current?.focus(), 50); }}
                style={{
                  fontSize: 10.5, padding: '3px 9px',
                  border: '1px solid rgba(59,130,246,0.4)',
                  borderRadius: 20, background: '#DBEAFE', cursor: 'pointer',
                  color: '#1E40AF', fontWeight: 600, transition: 'all 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#3B82F6'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#DBEAFE'; (e.currentTarget as HTMLButtonElement).style.color = '#1E40AF'; }}
              >
                📅 Add to planner…
              </button>
              {/* Compose chip */}
              <button
                onClick={() => { setInput('compose message about '); setTimeout(() => inputRef.current?.focus(), 50); }}
                style={{
                  fontSize: 10.5, padding: '3px 9px',
                  border: '1px solid rgba(5,150,105,0.4)',
                  borderRadius: 20, background: '#D1FAE5', cursor: 'pointer',
                  color: '#065F46', fontWeight: 600, transition: 'all 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#059669'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#D1FAE5'; (e.currentTarget as HTMLButtonElement).style.color = '#065F46'; }}
              >
                ✍️ Compose message…
              </button>
            </div>
          </div>
        </div>
      )}
      {profileStudent && (
        <StudentProfilePopup student={profileStudent} onClose={() => setProfileStudent(null)} />
      )}
    </>
  );
}
