'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { MODULES } from '@/lib/routes';
import { useModuleStore } from '@/lib/moduleStore';

// Modules that are visible but show Coming Soon tooltip on hover
const COMING_SOON_IDS = new Set(['attendance', 'fees', 'exam', 'reports', 'hr']);

export function ModuleGrid() {
  const { isEnabled } = useModuleStore();
  const visibleModules = MODULES.filter(m => isEnabled(m.id));
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))',
      gap: 8,
    }}>
      {visibleModules.map(mod => {
        const comingSoon = COMING_SOON_IDS.has(mod.id);
        return (
          <Link
            key={mod.id}
            href={mod.path}
            style={{ textDecoration: 'none', position: 'relative', display: 'block' }}
            className="group"
            onMouseEnter={() => setHoveredId(mod.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 6, padding: '12px 8px',
                background: '#fff', border: '1px solid var(--bd)',
                borderRadius: 12, minHeight: 80, textAlign: 'center',
                transition: 'transform 0.18s, box-shadow 0.18s, border-color 0.18s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'translateY(-2px)';
                el.style.boxShadow = '0 4px 12px -4px rgba(15,18,34,0.10)';
                el.style.borderColor = comingSoon ? 'rgba(124,91,255,0.35)' : 'rgba(124,91,255,0.35)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'none';
                el.style.boxShadow = 'none';
                el.style.borderColor = 'var(--bd)';
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: mod.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <mod.icon size={17} strokeWidth={1.5} style={{ color: mod.ic }} />
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-1)', lineHeight: 1.25, wordBreak: 'break-word' }}>
                {mod.name}
              </div>
            </div>

            {/* Coming Soon tooltip on hover */}
            {comingSoon && hoveredId === mod.id && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--bg-1)', border: '1px solid var(--bd)', borderRadius: 10,
                padding: '8px 12px', zIndex: 50, whiteSpace: 'nowrap',
                boxShadow: '0 8px 24px -6px rgba(14,16,32,0.15)',
                display: 'flex', alignItems: 'center', gap: 8,
                animation: 'fadeIn 140ms ease-out',
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                  background: 'var(--pu-soft, #EDE9FE)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Clock size={13} strokeWidth={1.75} style={{ color: 'var(--pu, #6D28D9)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-1)' }}>Coming Soon</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}>Under development</div>
                </div>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}


