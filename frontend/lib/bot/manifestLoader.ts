'use client';
import { useState, useEffect, useCallback } from 'react';
import type { BotContext, BotModuleManifest } from '@/types/bot';
import { studentsManifest } from './manifests/students';
import { attendanceManifest } from './manifests/attendance';
import { feesManifest } from './manifests/fees';

/**
 * Every registered manifest. Add new modules here as they're converted —
 * see TODO list in lib/bot/PILOT_STATUS.md for what's still pending.
 *
 * Structural precedent: lib/widgetStore.ts's flat ALL_WIDGETS array +
 * module-level store + pub/sub hook. lib/moduleStore.ts does not exist in
 * this codebase (checked) — this is a new pattern, built to match the
 * closest existing sibling instead of inventing a third shape.
 */
export const ALL_MANIFESTS: BotModuleManifest[] = [
  studentsManifest,
  attendanceManifest,
  feesManifest,
];

/**
 * RBAC + ABAC filtering, centralized here rather than per-action:
 * - RBAC: an action survives only if context.can(action.requiredPermissionCode).
 * - ABAC: a manifest survives only if the tenant's plan includes
 *   requiredFeatureFlag (or the manifest declares no flag at all).
 *
 * A manifest with zero surviving actions AND no entity-lookup use case
 * (i.e. actions were its only reason to exist) is dropped entirely.
 * Manifests that are pure lookups (empty `actions`, like students/fees)
 * are never dropped by the RBAC step — only the ABAC feature-flag check
 * applies to them.
 */
export function getFilteredManifests(context: Pick<BotContext, 'can' | 'hasFeature'>): BotModuleManifest[] {
  return ALL_MANIFESTS
    .filter(m => !m.requiredFeatureFlag || context.hasFeature(m.requiredFeatureFlag))
    .map(m => ({ ...m, actions: m.actions.filter(a => context.can(a.requiredPermissionCode)) }))
    .filter(m => m.actions.length > 0 || ALL_MANIFESTS.find(orig => orig.id === m.id)?.actions.length === 0);
}

export function getManifestById(id: string): BotModuleManifest | undefined {
  return ALL_MANIFESTS.find(m => m.id === id);
}

/** Reactive access to the RBAC/ABAC-filtered manifest list, for any UI
 *  that wants to show what the bot currently supports for this user. */
export function useFilteredManifests(context: Pick<BotContext, 'can' | 'hasFeature'> | null): BotModuleManifest[] {
  const [manifests, setManifests] = useState<BotModuleManifest[]>([]);

  const recompute = useCallback(() => {
    setManifests(context ? getFilteredManifests(context) : []);
  }, [context]);

  useEffect(() => { recompute(); }, [recompute]);

  return manifests;
}
