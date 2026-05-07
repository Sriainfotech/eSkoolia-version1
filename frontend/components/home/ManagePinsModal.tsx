'use client';
import { useState, useMemo } from 'react';
import { X, Pin, PinOff, Search, Star } from 'lucide-react';
import { MODULES, FLAT_INDEX } from '@/lib/routes';
import type { PinItem } from '@/lib/userPrefs';

interface Props {
  pins: PinItem[];
  onAdd: (item: PinItem) => void;
  onRemove: (path: string) => void;
  onClose: () => void;
}

const MAX_PINS = 12;

export function ManagePinsModal({ pins, onAdd, onRemove, onClose }: Props) {
  const [query, setQuery] = useState('');

  const pinnedPaths = new Set(pins.map(p => p.path));

  const filteredPages = useMemo(() => {
    const q = query.toLowerCase().trim();
    return FLAT_INDEX.filter(entry => {
      if (!q) return true;
      const mod = MODULES.find(m => m.id === entry.modId);
      return (
        entry.label.toLowerCase().includes(q) ||
        (mod?.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [query]);

  // Group filtered pages by module
  const grouped = useMemo(() => {
    const map = new Map<string, { modName: string; entries: typeof filteredPages }>();
    for (const entry of filteredPages) {
      const mod = MODULES.find(m => m.id === entry.modId);
      const modName = mod?.name ?? entry.modId;
      if (!map.has(entry.modId)) map.set(entry.modId, { modName, entries: [] });
      map.get(entry.modId)!.entries.push(entry);
    }
    return Array.from(map.values());
  }, [filteredPages]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,18,34,0.45)',
          zIndex: 600, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(680px, 95vw)', maxHeight: '85vh',
        background: '#fff', borderRadius: 18,
        boxShadow: '0 24px 64px -12px rgba(15,18,34,0.3)',
        zIndex: 601, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px', borderBottom: '1px solid var(--bd)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Star size={15} strokeWidth={2} color="var(--pu)" />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>Manage Quick Access</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '3px 0 0 22px' }}>
              Pin up to {MAX_PINS} pages for fast access · {pins.length}/{MAX_PINS} pinned
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8, color: 'var(--ink-3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Current pins */}
        {pins.length > 0 && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              Current Pins
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {pins.map(pin => {
                const entry = FLAT_INDEX.find(f => f.path === pin.path);
                const Icon = entry?.icon;
                return (
                  <div
                    key={pin.path}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'var(--pu-soft)', border: '1px solid rgba(109,74,255,0.2)',
                      borderRadius: 8, padding: '4px 10px 4px 7px',
                    }}
                  >
                    {Icon && <Icon size={12} strokeWidth={2} color="var(--pu)" />}
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--pu)' }}>{pin.label}</span>
                    <button
                      onClick={() => onRemove(pin.path)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--pu)', opacity: 0.6 }}
                      title="Unpin"
                    >
                      <X size={11} strokeWidth={2.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ padding: '12px 20px 8px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: '1px solid var(--bd)', borderRadius: 10, padding: '7px 12px',
            background: 'var(--bg-0)',
          }}>
            <Search size={13} color="var(--ink-3)" strokeWidth={2} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search pages to pin…"
              style={{
                flex: 1, border: 'none', outline: 'none', fontSize: 13,
                color: 'var(--ink-1)', background: 'transparent',
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--ink-3)' }}>
                <X size={12} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {/* Page list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px' }}>
          {grouped.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-3)', fontSize: 13 }}>
              No pages match &ldquo;{query}&rdquo;
            </div>
          )}
          {grouped.map(({ modName, entries }) => (
            <div key={modName} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '10px 0 5px',
              }}>
                {modName}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {entries.map(entry => {
                  const Icon = entry.icon;
                  const isPinned = pinnedPaths.has(entry.path);
                  const atMax = pins.length >= MAX_PINS && !isPinned;
                  return (
                    <div
                      key={entry.path}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '7px 10px', borderRadius: 9,
                        background: isPinned ? 'var(--pu-soft)' : 'transparent',
                        border: `1px solid ${isPinned ? 'rgba(109,74,255,0.15)' : 'transparent'}`,
                        transition: 'background 0.12s',
                        cursor: atMax ? 'not-allowed' : 'pointer',
                        opacity: atMax ? 0.45 : 1,
                      }}
                      onMouseEnter={e => { if (!isPinned && !atMax) e.currentTarget.style.background = 'var(--bg-1)'; }}
                      onMouseLeave={e => { if (!isPinned) e.currentTarget.style.background = 'transparent'; }}
                      onClick={() => {
                        if (atMax) return;
                        if (isPinned) onRemove(entry.path);
                        else onAdd({ path: entry.path, label: entry.label, modId: entry.modId });
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                        background: entry.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {Icon && <Icon size={13} strokeWidth={1.75} style={{ color: entry.ic }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: isPinned ? 'var(--pu)' : 'var(--ink-1)' }}>
                          {entry.label}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{entry.path}</div>
                      </div>
                      <div style={{
                        fontSize: 10.5, fontWeight: 600,
                        color: isPinned ? 'var(--pu)' : 'var(--ink-3)',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {isPinned
                          ? <><PinOff size={11} strokeWidth={2} /> Unpin</>
                          : <><Pin size={11} strokeWidth={2} /> Pin</>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
