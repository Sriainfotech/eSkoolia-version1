'use client';
import { usePermissions } from './usePermissions';
import { useModuleStore } from '@/lib/moduleStore';
import { getModulesForUser } from '@/lib/portal-modules';
import type { ModuleRoute } from '@/lib/routes';

/**
 * Returns the list of modules visible to the current user.
 *
 * Works for every portal_type — admin, teacher, parent, custom, and any
 * future role added to the registry in lib/portal-modules.ts.
 *
 * Module visibility is driven entirely by:
 *   • me.portal_type  → which base module list to use
 *   • me.permission_codes → which modules in that list are allowed
 *   • moduleStore     → admin-only: which modules the user has toggled on
 *
 * The list refreshes automatically when:
 *   • The 5-minute TTL expires and the user returns to the tab
 *   • The user logs out / in (cache is cleared)
 */
export function useVisibleModules(
  options: { includeHome?: boolean } = {},
): ModuleRoute[] {
  const { me } = usePermissions();
  const { isEnabled } = useModuleStore();

  // While permissions are still loading return an empty list.
  // Each portal renders its own loading state independently.
  if (!me) return [];

  return getModulesForUser(me, {
    includeHome: options.includeHome,
    // Only the admin portal respects the per-user module toggle
    isModuleEnabled: me.portal_type === 'admin' ? isEnabled : undefined,
  });
}
