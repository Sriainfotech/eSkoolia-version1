'use client';
import { useState } from 'react';
import type { BotAction, BotActionResult, BotContext } from '@/types/bot';

interface Props {
  action: BotAction;
  params: Record<string, unknown>;
  context: BotContext;
  onDone: (result: BotActionResult) => void;
  onCancel: () => void;
}

/**
 * Generic Yes/No confirmation for ANY BotAction with requiresConfirmation:
 * true — driven entirely by action.label/description/params, never a
 * per-action component. See lib/bot/resolvers/ManifestFuzzyResolver.ts
 * for how params are populated before this renders.
 */
export function ConfirmationCard({ action, params, context, onDone, onCancel }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const visibleParams = Object.entries(params).filter(([k]) => !k.startsWith('_'));
  const studentLabel = params._studentLabel as string | undefined;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await action.execute(params, context);
      onDone(result);
    } catch {
      setError('Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div style={{
      width: '100%', padding: 12, border: '1px solid rgba(124,91,255,0.25)',
      borderRadius: 10, background: 'rgba(124,91,255,0.05)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 6 }}>
        {action.label}{studentLabel ? ` — ${studentLabel}` : ''}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginBottom: 8 }}>
        {action.description}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
        {visibleParams.map(([key, value]) => (
          <div key={key} style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            <span style={{ fontWeight: 600 }}>{action.parameters[key]?.description ?? key}:</span>{' '}
            {String(value)}
          </div>
        ))}
      </div>
      {error && <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={confirm}
          disabled={busy}
          style={{
            fontSize: 11.5, fontWeight: 600, color: '#fff', background: 'var(--pu)',
            border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Working…' : 'Yes, confirm'}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          style={{
            fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg-2)',
            border: '1px solid var(--bd)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
