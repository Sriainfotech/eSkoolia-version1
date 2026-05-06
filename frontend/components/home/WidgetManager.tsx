'use client';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Sliders, X, Home } from 'lucide-react';
import { ALL_WIDGETS, useWidgetStore } from '@/lib/widgetStore';

export function WidgetManager() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { enabled, toggle, enabledCount } = useWidgetStore();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const leftWidgets  = ALL_WIDGETS.filter(w => w.rail === 'left');
  const rightWidgets = ALL_WIDGETS.filter(w => w.rail === 'right');

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Customize home screen widgets"
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
        <Sliders size={13} strokeWidth={2} />
        <span>Widgets</span>
        <span style={{
          minWidth: 18, height: 18, borderRadius: 20, padding: '0 5px',
          background: 'var(--pu)', color: '#fff', fontSize: 10, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{enabledCount}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'var(--bg-1)', border: '1px solid var(--bd)',
          borderRadius: 16, boxShadow: 'var(--sh-3)',
          zIndex: 300, width: 360, maxHeight: 520, overflowY: 'auto',
          animation: 'fadeIn 0.15s ease both',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 16px 10px', borderBottom: '1px solid var(--bd)' }}>
            <Sliders size={14} color="var(--pu)" strokeWidth={2} style={{ marginRight: 8, marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-1)' }}>Customize Widgets</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Home size={10} strokeWidth={2} style={{ flexShrink: 0 }} />
                Widgets only appear on the Home screen
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', display: 'flex', padding: 4, flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Left Rail */}
          <Section title="Today's Pulse" subtitle="Left sidebar" color="#6D4AFF">
            {leftWidgets.map(w => (
              <WidgetRow key={w.id} widget={w} enabled={!!enabled[w.id]} onToggle={() => toggle(w.id)} />
            ))}
          </Section>

          {/* Right Rail */}
          <Section title="Admin Cockpit" subtitle="Right sidebar" color="#0EA5E9">
            {rightWidgets.map(w => (
              <WidgetRow key={w.id} widget={w} enabled={!!enabled[w.id]} onToggle={() => toggle(w.id)} />
            ))}
          </Section>

          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--bd)', fontSize: 10.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
            Changes take effect immediately on the home screen
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, color, children }: { title: string; subtitle: string; color: string; children: ReactNode }) {
  return (
    <div style={{ padding: '10px 0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '0 16px 6px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
        <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>· {subtitle}</span>
      </div>
      {children}
    </div>
  );
}

function WidgetRow({ widget, enabled, onToggle }: { widget: typeof ALL_WIDGETS[0]; enabled: boolean; onToggle: () => void }) {
  const isDisabled = widget.disabled;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px',
        cursor: isDisabled ? 'default' : 'pointer', transition: 'background 0.12s',
        opacity: isDisabled ? 0.5 : 1,
      }}
      onClick={() => { if (!isDisabled) onToggle(); }}
      onMouseEnter={e => !isDisabled && (e.currentTarget.style.background = 'var(--bg-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{widget.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}>{widget.name}</span>
          {isDisabled && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#D97706', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em' }}>
              SOON
            </span>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{widget.description}</div>
      </div>
      {/* Toggle switch */}
      <div
        onClick={e => { e.stopPropagation(); if (!isDisabled) onToggle(); }}
        style={{
          width: 36, height: 20, borderRadius: 20, flexShrink: 0,
          background: isDisabled ? '#E5E7EB' : (enabled ? 'var(--pu)' : '#D1D5DB'),
          position: 'relative', transition: 'background 0.2s',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        <span style={{
          position: 'absolute', top: 3,
          left: (!isDisabled && enabled) ? 19 : 3,
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
    </div>
  );
}
