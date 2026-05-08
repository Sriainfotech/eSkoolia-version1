'use client';
import { useState } from 'react';

export type IssueType = 'bus' | 'lunch' | 'emergency';

interface IssueFlowProps {
  type: IssueType;
  onComplete: (note: string) => void;
  onCancel: () => void;
}

const ISSUE_CONFIG: Record<IssueType, {
  icon: string; label: string; color: string; bg: string; placeholder: string;
}> = {
  bus: {
    icon: '🚌',
    label: 'Bus Issue',
    color: '#d97706',
    bg: 'rgba(217,119,6,0.06)',
    placeholder: 'e.g., Bus 12 delayed by 30 mins, breakdown near highway turnoff…',
  },
  lunch: {
    icon: '🍱',
    label: 'Lunch Concern',
    color: '#16a34a',
    bg: 'rgba(22,163,74,0.06)',
    placeholder: 'e.g., Riya in 4-B forgot her lunch box, nut allergy — please remind teacher…',
  },
  emergency: {
    icon: '🚨',
    label: 'Emergency Pickup',
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.06)',
    placeholder: 'e.g., Father will pick up Rahul (5-A) at 1 pm — medical appointment…',
  },
};

export function IssueFlow({ type, onComplete, onCancel }: IssueFlowProps) {
  const [note, setNote] = useState('');
  const cfg = ISSUE_CONFIG[type];

  return (
    <div style={{ width: '100%', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-0)' }}>
      <div style={{
        padding: '10px 12px', background: cfg.bg, borderBottom: '1px solid var(--bd)',
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, fontWeight: 600, color: cfg.color,
      }}>
        {cfg.icon} {cfg.label}
        <button onClick={onCancel} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)', lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>Describe the issue:</div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={cfg.placeholder}
          rows={3}
          autoFocus
          style={{
            width: '100%', padding: '7px 10px', border: '1px solid var(--bd)', borderRadius: 8,
            fontSize: 12.5, background: 'var(--bg-2)', outline: 'none', resize: 'none',
            boxSizing: 'border-box', fontFamily: 'inherit', color: 'var(--ink-1)',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '7px', border: '1px solid var(--bd)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)' }}
          >Cancel</button>
          <button
            onClick={() => { if (note.trim()) onComplete(note.trim()); }}
            disabled={!note.trim()}
            style={{
              flex: 2, padding: '7px', border: 'none', borderRadius: 8,
              background: cfg.color, color: '#fff', cursor: note.trim() ? 'pointer' : 'default',
              fontSize: 12.5, fontWeight: 600, opacity: note.trim() ? 1 : 0.5,
            }}
          >✓ Log {cfg.label}</button>
        </div>
      </div>
    </div>
  );
}
