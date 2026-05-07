'use client';
import Link from 'next/link';
import { MODULES } from '@/lib/routes';
import { useModuleStore } from '@/lib/moduleStore';

export function ModuleGrid() {
  const { isEnabled } = useModuleStore();
  const visibleModules = MODULES.filter(m => isEnabled(m.id));

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))',
      gap: 8,
    }}>
      {visibleModules.map(mod => (
        <Link
          key={mod.id}
          href={mod.path}
          style={{ textDecoration: 'none' }}
          className="group"
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
              el.style.borderColor = 'rgba(124,91,255,0.35)';
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
        </Link>
      ))}
    </div>
  );
}


