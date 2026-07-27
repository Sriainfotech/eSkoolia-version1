import { useState, useEffect } from 'react';
import { apiRequestWithRefresh } from '@/lib/api-auth';

export function useCurrentAcademicYear(fallbackYear: string) {
  const [year, setYear] = useState(fallbackYear);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequestWithRefresh('/api/v1/core/academic-years/?page_size=200');
        const list = Array.isArray(data)
          ? data
          : ((data as { results?: Array<{ name?: string; is_current?: boolean; start_date?: string }> }).results ?? []);
        if (!Array.isArray(list) || list.length === 0) return;

        const current = list.find((row) => row && row.is_current);
        let chosen = current;
        if (!chosen) {
          const sorted = [...list].sort((a, b) => {
            const ad = String(a?.start_date || a?.name || '');
            const bd = String(b?.start_date || b?.name || '');
            return bd.localeCompare(ad);
          });
          chosen = sorted[0];
        }

        const name = String(chosen?.name || '').trim();
        if (name && !cancelled) setYear(name);
      } catch {
        // Keep fallback on API failures.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fallbackYear]);

  return { year, loading };
}