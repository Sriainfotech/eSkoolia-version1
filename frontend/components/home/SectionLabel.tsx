'use client';
import { Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon?: LucideIcon;
  title: string;
  count?: number;
  pinned?: number;
  action?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function SectionLabel({ icon: Icon, title, count, pinned, action, onAction }: Props) {
  const rightText = count !== undefined
    ? String(count)
    : pinned !== undefined
    ? `${pinned} PINNED`
    : undefined;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 22, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {Icon
          ? <Icon size={11} strokeWidth={2} style={{ color: 'var(--ink-3)' }} />
          : pinned !== undefined
          ? <Star size={11} strokeWidth={2} color="var(--ink-3)" />
          : null
        }
        <span style={{
          fontSize: 10.5, fontWeight: 600, color: 'var(--ink-2)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>{title}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {rightText && (
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
            {rightText}
          </span>
        )}
        {action && (
          <button
            onClick={onAction}
            style={{ fontSize: 11, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--pu)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
          >
            {action} →
          </button>
        )}
      </div>
    </div>
  );
}
