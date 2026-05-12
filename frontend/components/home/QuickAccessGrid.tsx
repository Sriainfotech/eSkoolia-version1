'use client';
import { useState } from 'react';
import Link from 'next/link';
import { X, Clock } from 'lucide-react';
import { MODULES, FLAT_INDEX } from '@/lib/routes';
import type { PinItem } from '@/lib/userPrefs';

// Modules that show Coming Soon tooltip on hover
const COMING_SOON_IDS = new Set(['attendance', 'fees', 'exam', 'reports', 'hr']);

function getIconAndColors(path: string) {
  const entry = FLAT_INDEX.find(f => f.path === path);
  if (!entry) return { Icon: null, bg: '#EEF2FF', ic: '#4F46E5', modName: '', modId: '' };
  const mod = MODULES.find(m => m.id === entry.modId);
  return { Icon: entry.icon, bg: entry.bg, ic: entry.ic, modName: mod?.name ?? '', modId: entry.modId };
}

interface Props {
  pins: PinItem[];
  onRemove: (path: string) => void;
}

export function QuickAccessGrid({ pins, onRemove }: Props) {
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))',
      gap: 10, marginBottom: 4,
    }}>
      {pins.map(pin => {
        const { Icon, bg, ic, modName, modId } = getIconAndColors(pin.path);
        const comingSoon = COMING_SOON_IDS.has(modId);
        return (
          <div
            key={pin.path}
            style={{ position: 'relative' }}
            onMouseEnter={() => setHoveredPath(pin.path)}
            onMouseLeave={() => setHoveredPath(null)}
          >
            <Link href={pin.path} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  background: '#fff', border: '1px solid var(--bd)',
                  borderRadius: 12, padding: '10px 12px',
                  display: 'flex', flexDirection: 'row', alignItems: 'center',
                  gap: 10, cursor: 'pointer',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = '0 2px 10px -2px rgba(15,18,34,0.08)';
                  el.style.borderColor = 'rgba(124,91,255,0.25)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = 'none';
                  el.style.borderColor = 'var(--bd)';
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {Icon && <Icon size={17} strokeWidth={1.75} style={{ color: ic }} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--ink-1)',
                    lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {pin.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{modName}</div>
                </div>
              </div>
            </Link>

            {/* Coming Soon tooltip on hover */}
            {comingSoon && hoveredPath === pin.path && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 6px)', left: 12,
                background: 'var(--bg-1)', border: '1px solid var(--bd)', borderRadius: 10,
                padding: '8px 12px', zIndex: 50, whiteSpace: 'nowrap',
                boxShadow: '0 8px 24px -6px rgba(14,16,32,0.15)',
                display: 'flex', alignItems: 'center', gap: 8,
                animation: 'fadeIn 140ms ease-out',
                pointerEvents: 'none',
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

            <button
              onClick={() => onRemove(pin.path)}
              style={{
                position: 'absolute', top: 7, right: 7,
                width: 16, height: 16, borderRadius: 8,
                background: 'var(--bg-2)', border: '1px solid var(--bd)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0, opacity: 0,
                transition: 'opacity 0.15s',
              }}
              title="Unpin"
              className="pin-remove-btn"
            >
              <X size={9} color="var(--ink-3)" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
