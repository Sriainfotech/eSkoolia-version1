'use client';
import Link from 'next/link';
import { X } from 'lucide-react';
import { MODULES, FLAT_INDEX } from '@/lib/routes';
import type { PinItem } from '@/lib/userPrefs';

function getIconAndColors(path: string) {
  const entry = FLAT_INDEX.find(f => f.path === path);
  if (!entry) return { Icon: null, bg: '#EEF2FF', ic: '#4F46E5', modName: '' };
  const mod = MODULES.find(m => m.id === entry.modId);
  return { Icon: entry.icon, bg: entry.bg, ic: entry.ic, modName: mod?.name ?? '' };
}

interface Props {
  pins: PinItem[];
  onRemove: (path: string) => void;
}

export function QuickAccessGrid({ pins, onRemove }: Props) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))',
      gap: 10, marginBottom: 4,
    }}>
      {pins.map(pin => {
        const { Icon, bg, ic, modName } = getIconAndColors(pin.path);
        return (
          <div key={pin.path} style={{ position: 'relative' }}>
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
