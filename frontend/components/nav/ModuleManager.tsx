'use client';
import { useState, useRef, useEffect } from 'react';
import { Layers, X } from 'lucide-react';
import { MODULES } from '@/lib/routes';
import { useModuleStore } from '@/lib/moduleStore';

export function ModuleManager() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isEnabled, toggle, enabledCount } = useModuleStore();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Manage visible modules"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          height: 32, padding: '0 12px', borderRadius: 8,
          border: open ? '1px solid rgba(109,74,255,0.5)' : '1px solid var(--bd)',
          background: open ? 'var(--pu-soft)' : 'var(--bg-2)',
          color: open ? 'var(--pu)' : 'var(--ink-2)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!open) { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'rgba(109,74,255,0.4)'; b.style.background = 'var(--pu-soft)'; b.style.color = 'var(--pu)'; } }}
        onMouseLeave={e => { if (!open) { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'var(--bd)'; b.style.background = 'var(--bg-2)'; b.style.color = 'var(--ink-2)'; } }}
      >
        <Layers size={13} strokeWidth={2} />
        <span>Modules</span>
        <span style={{
          minWidth: 18, height: 18, borderRadius: 20, padding: '0 5px',
          background: 'var(--pu)', color: '#fff', fontSize: 10, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{enabledCount}</span>
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          top: 64,
          right: 16,
          background: 'var(--bg-1)', border: '1px solid var(--bd)',
          borderRadius: 16, boxShadow: 'var(--sh-3)',
          zIndex: 400, width: 340, maxHeight: 560, overflowY: 'auto',
          animation: 'fadeIn 0.15s ease both',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 16px 10px', borderBottom: '1px solid var(--bd)', position: 'sticky', top: 0, background: 'var(--bg-1)', zIndex: 1 }}>
            <Layers size={14} color="var(--pu)" strokeWidth={2} style={{ marginRight: 8, marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-1)' }}>Manage Modules</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                Control which modules appear in the header &amp; home screen
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', display: 'flex', padding: 4, flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Module list */}
          <div style={{ padding: '8px 0 4px' }}>
            {MODULES.map(mod => {
              const Icon = mod.icon;
              const enabled = isEnabled(mod.id);
              return (
                <div
                  key={mod.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onClick={() => toggle(mod.id)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: mod.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: enabled ? 1 : 0.4,
                  }}>
                    <Icon size={15} strokeWidth={1.5} style={{ color: mod.ic }} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: enabled ? 'var(--ink-1)' : 'var(--ink-3)' }}>
                      {mod.name}
                    </div>
                    {mod.sub.length > 0 && (
                      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}>
                        {mod.sub.length} pages
                      </div>
                    )}
                  </div>
                  {/* Toggle switch */}
                  <div
                    onClick={e => { e.stopPropagation(); toggle(mod.id); }}
                    style={{
                      width: 36, height: 20, borderRadius: 20, flexShrink: 0,
                      background: enabled ? 'var(--pu)' : '#D1D5DB',
                      position: 'relative', transition: 'background 0.2s',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3,
                      left: enabled ? 19 : 3,
                      width: 14, height: 14, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--bd)', fontSize: 10.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
            Changes take effect immediately across header &amp; home screen
          </div>
        </div>
      )}
    </div>
  );
}
