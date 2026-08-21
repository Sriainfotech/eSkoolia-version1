'use client';
import type { BotEntityResult, BotModuleManifest } from '@/types/bot';

interface Props {
  manifest: BotModuleManifest;
  results: BotEntityResult[];
  query?: string;
}

/** Fallback renderer for any manifest whose entity rows aren't
 *  student-shaped (StudentLookupResults covers students/attendance).
 *  Renders whatever displayFields the manifest declared — no per-manifest
 *  component needed for a simple read-only list. */
export function GenericEntityResults({ manifest, results, query }: Props) {
  if (results.length === 0) {
    return (
      <div style={{ padding: '10px 0', textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
        No {manifest.label.toLowerCase()} records found{query ? ` for "${query}"` : ''}.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
        {manifest.label}: {results.length} record{results.length > 1 ? 's' : ''}
      </div>
      {results.map(r => (
        <div
          key={r.id}
          style={{
            padding: '8px 10px', border: '1px solid var(--bd)', borderRadius: 10,
            background: 'var(--bg-0)',
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}>{r.displayLabel}</div>
          {r.subtitle && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{r.subtitle}</div>}
        </div>
      ))}
    </div>
  );
}
