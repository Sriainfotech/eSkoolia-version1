'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import type { ModuleRoute } from '@/lib/routes';

export function OverflowMenu({ mods }: { mods: ModuleRoute[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(t) &&
        dropRef.current && !dropRef.current.contains(t)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.right - 240 });
    }
    setOpen(v => !v);
  };

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 8, border: 'none',
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
        <MoreHorizontal size={15} strokeWidth={1.5} />
      </button>

      {open && (
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: Math.max(8, pos.left),
            minWidth: 240,
            background: 'var(--bg-1)',
            border: '1px solid var(--bd)',
            borderRadius: 12, padding: 6, zIndex: 500,
            boxShadow: '0 14px 32px -10px rgba(14,16,32,0.18)',
            animation: 'fadeIn 140ms ease-out',
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto',
          }}
        >
          <div style={{
            padding: '6px 10px 8px', fontSize: 10.5, fontWeight: 600,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--ink-3)', borderBottom: '1px solid var(--bd)', marginBottom: 4,
          }}>
            More modules
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
