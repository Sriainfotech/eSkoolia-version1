'use client';
import { useState } from 'react';
import type { DisambiguationResult, ResolvedIntent } from '@/types/bot';

interface Props {
  result: DisambiguationResult;
  onResolved: (intent: ResolvedIntent | null) => void;
}

/** Generic clarifying-choice card — renders whatever DisambiguationResult
 *  a resolver returns, never a per-manifest list dump. */
export function DisambiguationCard({ result, onResolved }: Props) {
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);

  const pick = async (index: number) => {
    setPickedIndex(index);
    const intent = await result.options[index].resolve();
    onResolved(intent);
  };

  return (
    <div style={{
      width: '100%', padding: 12, border: '1px solid var(--bd)',
      borderRadius: 10, background: 'var(--bg-0)',
    }}>
      <div style={{ fontSize: 12.5, color: 'var(--ink-1)', marginBottom: 8 }}>{result.prompt}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {result.options.map((opt, i) => (
          <button
            key={`${opt.label}-${i}`}
            onClick={() => pick(i)}
            disabled={pickedIndex !== null}
            style={{
              textAlign: 'left', fontSize: 12, padding: '7px 10px',
              border: '1px solid var(--bd)', borderRadius: 8,
              background: pickedIndex === i ? 'var(--pu-soft)' : 'var(--bg-1)',
              cursor: pickedIndex === null ? 'pointer' : 'default',
              opacity: pickedIndex !== null && pickedIndex !== i ? 0.5 : 1,
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--ink-1)' }}>{opt.label}</div>
            {opt.description && <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{opt.description}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
