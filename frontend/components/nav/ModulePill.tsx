'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ModuleRoute } from '@/lib/routes';

export function ModulePill({ mod }: { mod: ModuleRoute }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const seg = mod.path.split('/')[1];
  const active = Boolean(seg && pathname.startsWith(`/${seg}`)) ||
    (mod.path === '/dashboard' && (pathname === '/dashboard' || pathname === '/'));

  const handleEnter = () => {
    clearTimeout(leaveTimer.current);
    enterTimer.current = setTimeout(() => setOpen(true), 180);
  };
  const handleLeave = () => {
    clearTimeout(enterTimer.current);
    leaveTimer.current = setTimeout(() => setOpen(false), 140);
  };

  return (
    <div style={{ position: 'relative' }} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <Link
        href={mod.path}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 12px', height: 36, borderRadius: 8, fontSize: 12.5, fontWeight: 500,
          textDecoration: 'none', whiteSpace: 'nowrap', transition: 'color 0.15s, background 0.15s',
          color: active ? 'var(--ink-1)' : 'var(--ink-2)',
        }}
        onMouseEnter={e => {
          if (!active) (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-1)';
        }}
        onMouseLeave={e => {
          if (!active) (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-2)';
        }}
      >
        <mod.icon size={14} strokeWidth={1.6} />
        {mod.name}
        {active && (
          <span style={{
            position: 'absolute', left: 12, right: 12, bottom: 0,
            height: 2, background: 'var(--pu)', borderRadius: '2px 2px 0 0',
          }} />
        )}
      </Link>

      {open && mod.sub.length > 0 && (
        <div
          style={{
            position: 'absolute', left: 0, top: 'calc(100% + 4px)',
            minWidth: 260, maxWidth: 320,
            background: '#fff', border: '1px solid var(--bd)', borderRadius: 12,
            padding: 6, zIndex: 200,
            boxShadow: '0 14px 32px -10px rgba(14,16,32,0.18)',
            animation: 'fadeIn 140ms ease-out',
          }}
        >
          <div style={{
            padding: '8px 10px', fontSize: 10.5, fontWeight: 600,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--ink-3)', borderBottom: '1px solid var(--bd)',
            marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{mod.name}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{mod.sub.length} pages</span>
          </div>
          {mod.sub.map(s => {
            const SubIcon = s.icon ?? mod.icon;
            return (
              <Link
                key={s.path}
                href={s.path}
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
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: mod.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <SubIcon size={13} strokeWidth={1.75} style={{ color: mod.ic }} />
                </span>
                <span style={{ flex: 1 }}>{s.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
