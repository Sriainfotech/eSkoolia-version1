"use client";

import { useEffect, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";

/**
 * Returns the school's current academic year label (e.g. "2026-27").
 *
 * Resolution order:
 *  1. Backend year flagged with `is_current = true`.
 *  2. Most recent year by `start_date` (or by name if start_date missing).
 *  3. The provided fallback (defaults to "2026-27").
 *
 * @param {string} [fallback]
 * @returns {{ year: string, loading: boolean }}
 */
export function useCurrentAcademicYear(fallback = "2026-27") {
  const [year, setYear] = useState(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequestWithRefresh("/api/v1/core/academic-years/?page_size=200");
        const list = Array.isArray(data) ? data : (data?.results || data?.data || []);
        if (!Array.isArray(list) || list.length === 0) return;

        const current = list.find((row) => row && row.is_current);
        let chosen = current;
        if (!chosen) {
          const sorted = [...list].sort((a, b) => {
            const ad = String(a?.start_date || a?.name || "");
            const bd = String(b?.start_date || b?.name || "");
            return bd.localeCompare(ad);
          });
          chosen = sorted[0];
        }
        const name = String(chosen?.name || "").trim();
        if (name && !cancelled) setYear(name);
      } catch {
        /* keep fallback */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { year, loading };
}

export default useCurrentAcademicYear;
