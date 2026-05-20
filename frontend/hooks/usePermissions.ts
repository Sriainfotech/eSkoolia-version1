'use client';
import { useState, useEffect } from 'react';
import { apiRequestWithRefresh } from '@/lib/api-auth';

export interface MeData {
  is_superuser: boolean;
  is_school_admin: boolean;
  permission_codes: string[];
}

// Module-level cache so the /me request fires only once per page load.
let _cache: MeData | null = null;
let _promise: Promise<MeData> | null = null;

function fetchMe(): Promise<MeData> {
  if (_cache) return Promise.resolve(_cache);
  if (_promise) return _promise;
  _promise = apiRequestWithRefresh<MeData>('/api/v1/auth/me/').then((data) => {
    _cache = data;
    return data;
  }).catch(() => {
    _promise = null;
    return { is_superuser: false, is_school_admin: false, permission_codes: [] } as MeData;
  });
  return _promise;
}

/** Returns the current user's permissions. Falls back to fully-open while loading. */
export function usePermissions() {
  const [me, setMe] = useState<MeData | null>(_cache);

  useEffect(() => {
    if (_cache) { setMe(_cache); return; }
    fetchMe().then(setMe);
  }, []);

  function can(code: string): boolean {
    if (!me) return true; // optimistic while loading
    if (me.is_superuser || me.is_school_admin) return true;
    const codes = me.permission_codes;
    return codes.includes('*') || codes.includes(code);
  }

  function canAnyPrefix(prefix: string): boolean {
    if (!me) return true;
    if (me.is_superuser || me.is_school_admin) return true;
    const codes = me.permission_codes;
    return codes.some((c) => c === '*' || c.startsWith(`${prefix}.`));
  }

  return { me, can, canAnyPrefix };
}
