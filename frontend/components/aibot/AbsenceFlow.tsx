'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface StudentOption {
  id: number;
  name: string;
  className: string;
  sectionName: string;
  admissionNo?: string;
}

export interface AbsenceResult {
  studentId: number;
  studentName: string;
  className: string;
  sectionName: string;
  date: string;
  notes: string;
}

interface AbsenceFlowProps {
  prefillName?: string;
  onComplete: (result: AbsenceResult) => void;
  onCancel: () => void;
}

type Step = 'search' | 'confirm' | 'loading';

const ABSENCE_REASONS = [
  { value: 'sick', label: '🤒 Sick / Unwell' },
  { value: 'appointment', label: '🏥 Medical Appointment' },
  { value: 'family', label: '👨‍👩‍👧 Family Emergency' },
  { value: 'travel', label: '✈️ Travel / Out of Town' },
  { value: 'other', label: '📝 Other' },
];

export function AbsenceFlow({ prefillName, onComplete, onCancel }: AbsenceFlowProps) {
  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState(prefillName || '');
  const [searchResults, setSearchResults] = useState<StudentOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [reason, setReason] = useState('sick');
  const [customNote, setCustomNote] = useState('');
  const [absenceDate, setAbsenceDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const doSearch = async (q: string) => {
    if (!q.trim() || q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const token = getAccessToken();
      const res = await fetch(
        `${API_BASE_URL}/api/v1/students/students/?search=${encodeURIComponent(q)}&limit=6`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) { setSearchResults([]); return; }
      const d = await res.json();
      const raw = Array.isArray(d) ? d : (d.results ?? []);
      setSearchResults(raw.map((s: Record<string, unknown>) => ({
        id: s.id as number,
        name: `${s.first_name} ${s.last_name}`.trim(),
        className: (s.current_class_name as string | undefined)
          ?? (typeof s.current_class === 'object' && s.current_class ? (s.current_class as { name: string }).name : '')
          ?? '',
        sectionName: (s.current_section_name as string | undefined)
          ?? (typeof s.current_section === 'object' && s.current_section ? (s.current_section as { name: string }).name : '')
          ?? '',
        admissionNo: s.admission_no as string | undefined,
      })));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => doSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const submit = async () => {
    if (!selectedStudent) return;
    setStep('loading');
    setError('');
    try {
      const token = getAccessToken();
      const reasonLabel = ABSENCE_REASONS.find(r => r.value === reason)?.label.replace(/^[\S]+ /, '') || reason;
      const notes = customNote.trim() ? `${reasonLabel} — ${customNote.trim()}` : reasonLabel;
      const res = await fetch(`${API_BASE_URL}/api/v1/attendance/student-attendance/chatbot-mark/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          student_id: selectedStudent.id,
          attendance_type: 'A',
          notes,
          attendance_date: absenceDate,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError((err as { detail?: string }).detail || 'Failed to mark attendance. Please try again.');
        setStep('confirm');
        return;
      }
      const data = await res.json() as {
        student_id: number; student_name: string; class_name: string;
        section_name: string; attendance_date: string; notes: string;
      };
      onComplete({
        studentId: data.student_id,
        studentName: data.student_name,
        className: data.class_name,
        sectionName: data.section_name,
        date: data.attendance_date,
        notes: data.notes,
      });
    } catch {
      setError('Network error. Please try again.');
      setStep('confirm');
    }
  };

  const cardStyle: React.CSSProperties = {
    width: '100%', border: '1px solid var(--bd)', borderRadius: 12,
    overflow: 'hidden', background: 'var(--bg-0)',
  };
  const headerStyle: React.CSSProperties = {
    padding: '10px 12px', background: 'rgba(220,38,38,0.06)',
    borderBottom: '1px solid var(--bd)',
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 13, fontWeight: 600, color: '#dc2626',
  };
  const bodyStyle: React.CSSProperties = { padding: 12 };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: '1px solid var(--bd)',
    borderRadius: 8, fontSize: 12.5, background: 'var(--bg-2)',
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4,
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        🏥 Report Absence
        <button onClick={onCancel} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)', lineHeight: 1 }}>×</button>
      </div>

      {step === 'search' && (
        <div style={bodyStyle}>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>Which student is absent today?</div>
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Type student name…"
            style={inputStyle}
          />
          {searching && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>Searching…</div>}
          {searchResults.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
              {searchResults.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedStudent(s); setStep('confirm'); }}
                  style={{
                    textAlign: 'left', padding: '8px 10px', border: '1px solid var(--bd)',
                    borderRadius: 8, background: 'var(--bg-1)', cursor: 'pointer',
                    transition: 'border-color 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(220,38,38,0.4)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--bd)')}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {[s.className, s.sectionName].filter(Boolean).join(' – ')}
                    {s.admissionNo && ` · ${s.admissionNo}`}
                  </div>
                </button>
              ))}
            </div>
          )}
          {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8, textAlign: 'center' }}>
              No students found for &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      )}

      {step === 'confirm' && selectedStudent && (
        <div style={bodyStyle}>
          <div style={{ padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>{selectedStudent.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {[selectedStudent.className, selectedStudent.sectionName].filter(Boolean).join(' – ')}
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={labelStyle}>Reason</div>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ ...inputStyle, padding: '6px 8px' }}
            >
              {ABSENCE_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={labelStyle}>Date</div>
            <input
              type="date"
              value={absenceDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setAbsenceDate(e.target.value)}
              style={{ ...inputStyle, padding: '6px 8px' }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={labelStyle}>Additional note (optional)</div>
            <input
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
              placeholder="e.g., fever, will return tomorrow"
              style={{ ...inputStyle, padding: '6px 8px' }}
            />
          </div>

          {error && <div style={{ fontSize: 11.5, color: '#dc2626', marginBottom: 8 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setSelectedStudent(null); setStep('search'); setError(''); }}
              style={{ flex: 1, padding: '7px', border: '1px solid var(--bd)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)' }}
            >← Back</button>
            <button
              onClick={submit}
              style={{ flex: 2, padding: '7px', border: 'none', borderRadius: 8, background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}
            >✓ Mark Absent</button>
          </div>
        </div>
      )}

      {step === 'loading' && (
        <div style={{ padding: 16, textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)' }}>
          Marking attendance…
        </div>
      )}
    </div>
  );
}
