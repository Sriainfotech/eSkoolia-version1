'use client';
import { useState, useEffect } from 'react';
import { apiRequestWithRefresh } from '@/lib/api-auth';

export interface SchoolBranding {
  name: string | null;
  brand_color: string | null;
  logo_url: string | null;
}

export interface MeData {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_superuser: boolean;
  is_school_admin: boolean;
  permission_codes: string[];
  /** Which portal this user belongs to: admin | teacher | parent | student | custom */
  portal_type: 'admin' | 'teacher' | 'parent' | 'student' | 'custom';
  school_branding: SchoolBranding;
  school_id: number | null;
  school_name: string | null;
  role_names: string[];
  must_change_password: boolean;
}

// ── Cache ─────────────────────────────────────────────────────────────────────
// Module-level cache with a 5-minute TTL.
// – Multiple components in the same portal share one in-flight request (_promise).
// – After 5 minutes the next call fetches fresh data so newly-assigned permissions
//   appear without requiring a hard reload.
// – clearPermissionsCache() must be called on logout / portal switch so a different
//   user never sees stale identity data.

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let _cache: MeData | null = null;
let _cacheAt  = 0;
let _promise: Promise<MeData> | null = null;

/** Wipe the cache — call on logout and whenever the authenticated user changes. */
export function clearPermissionsCache() {
  _cache   = null;
  _cacheAt = 0;
  _promise = null;
}

function isCacheValid() {
  return _cache !== null && Date.now() - _cacheAt < CACHE_TTL_MS;
}

function fetchMe(): Promise<MeData> {
  if (isCacheValid()) return Promise.resolve(_cache!);
  // Cache expired or absent — start a fresh request (deduplicated via _promise)
  if (!_promise) {
    _promise = apiRequestWithRefresh<MeData>('/api/v1/auth/me/')
      .then((data) => {
        _cache   = data;
        _cacheAt = Date.now();
        _promise = null;
        return data;
      })
      .catch(() => {
        _promise = null;
        // Return a safe no-permission fallback so the app stays usable
        const fallback: MeData = {
          id: 0, username: '', first_name: '', last_name: '', email: '',
          is_superuser: false, is_school_admin: false,
          permission_codes: [],
          portal_type: 'admin',
          school_branding: { name: null, brand_color: null, logo_url: null },
          school_id: null, school_name: null,
          role_names: [], must_change_password: false,
        };
        return fallback;
      });
  }
  return _promise;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Returns the current user's identity + permission helpers.
 *
 * – Starts as null (never seeds from potentially-stale module cache) so a
 *   teacher logging in after a parent never sees the previous user's name.
 * – Re-fetches automatically on tab focus if the 5-minute TTL has expired,
 *   so newly-assigned modules appear without a hard reload.
 */
export function usePermissions() {
  // Always start null — do NOT seed from _cache here.
  // Seeding from module-level state means a stale cached user (e.g. parent
  // "Sunil") would appear in the teacher portal before useEffect can correct it.
  const [me, setMe] = useState<MeData | null>(null);

  // Initial fetch
  useEffect(() => {
    fetchMe().then(setMe);
  }, []);

  // Re-fetch on tab visibility regain so permission changes made by an admin
  // (e.g. assigning a new module to a teacher) are picked up within one TTL cycle
  // without requiring a full page reload.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        // fetchMe() respects the TTL — only hits the network when cache is stale
        fetchMe().then(setMe);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  function can(code: string): boolean {
    if (!me) return false; // deny while loading — show loading state, not content
    if (me.is_superuser) return true;
    const codes = me.permission_codes;
    return codes.includes('*') || codes.includes(code);
  }

  function canAnyPrefix(prefix: string): boolean {
    if (!me) return false;
    if (me.is_superuser) return true;
    const codes = me.permission_codes;
    return codes.some((c) => c === '*' || c.startsWith(`${prefix}.`));
  }

  return { me, can, canAnyPrefix };
}
