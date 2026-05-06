'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import type { ModuleRoute } from '@/lib/routes';

export function OverflowMenu({ mods }: { mods: ModuleRoute[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 8, border: 'none',
          background: open ? 'var(--bg-2)' : 'transparent',
          color: 'var(--ink-2)', cursor: 'pointer',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-2)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-1)';
        }}
        onMouseLeave={e => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-2)';
          }
        }}
        title="More modules"
      >
        <MoreHorizontal size={16} strokeWidth={1.5} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 4px)',
          minWidth: 240, background: '#fff', border: '1px solid var(--bd)',
          borderRadius: 12, padding: 6, zIndex: 200,
          boxShadow: '0 14px 32px -10px rgba(14,16,32,0.18)',
          animation: 'fadeIn 140ms ease-out',
        }}>
          <div style={{
            padding: '6px 10px 8px', fontSize: 10.5, fontWeight: 600,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--ink-3)', borderBottom: '1px solid var(--bd)', marginBottom: 4,
          }}>
            More
          </div>
          {mods.map(m => (
            <Link
              key={m.id}
              href={m.path}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                height: 36, padding: '0 10px', borderRadius: 8,
                fontSize: 12.5, color: 'var(--ink-1)', textDecoration: 'none',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-2)')}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = 'transparent')}
            >
              <span style={{
                width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <m.icon size={14} strokeWidth={1.5} style={{ color: m.ic }} />
              </span>
              <span style={{ flex: 1 }}>{m.name}</span>
              {m.sub.length > 0 && (
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--ink-3)' }}>
                  {m.sub.length}p
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
