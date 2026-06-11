/**
 * Central portal module registry.
 *
 * Maps portal_type → module list and applies a consistent permission filter
 * for ALL roles — existing and future.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Adding a new role / portal                                     │
 * │  1. Create its module list in  lib/<role>-routes.ts             │
 * │  2. Import it here and add one line to PORTAL_MODULES           │
 * │  3. Permission filtering, caching and dynamic updates are free  │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { MODULES, type ModuleRoute } from './routes';
import { TEACHER_MODULES } from './teacher-routes';
import { PARENT_MODULES } from './parent-routes';
import type { MeData } from '@/hooks/usePermissions';

// ── Registry — extend this map to support new portals ─────────────────────────

const PORTAL_MODULES: Partial<Record<string, ModuleRoute[]>> = {
  admin:   MODULES,
  teacher: TEACHER_MODULES,
  parent:  PARENT_MODULES,
  // student: STUDENT_MODULES,  ← uncomment when student portal is built
  // accountant: ACCOUNTANT_MODULES,
  custom:  MODULES,   // custom roles default to admin modules, filtered by permissions
};

// ── IDs treated as "home" tiles — hidden unless includeHome=true ───────────────

const HOME_IDS = new Set(['teacher-home', 'parent-home']);

// ── Internal permission matcher (mirrors usePermissions.canAnyPrefix) ─────────

function hasPermission(permission: string | undefined, me: MeData): boolean {
  if (!permission) return true;                          // no guard → always show
  if (me.is_superuser) return true;
  if (!me.permission_codes?.length) return false;        // no codes → no access
  return me.permission_codes.some(
    (c) => c === '*' || c === permission || c.startsWith(`${permission}.`),
  );
}

// ── Options ────────────────────────────────────────────────────────────────────

export interface GetModulesOptions {
  /**
   * Include the portal's own home module (default false — the logo link
   * already navigates home so the pill is usually omitted from the grid).
   */
  includeHome?: boolean;
  /**
   * Admin portal only: apply the user's module-toggle preference from
   * moduleStore so hidden modules stay off the home grid.
   */
  isModuleEnabled?: (id: string) => boolean;
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Returns the ordered list of modules visible to `me` in their portal.
 *
 * Called by useVisibleModules() — not usually needed directly.
 */
export function getModulesForUser(
  me: MeData,
  options: GetModulesOptions = {},
): ModuleRoute[] {
  const portalType = me.portal_type ?? 'admin';
  const baseList = PORTAL_MODULES[portalType] ?? MODULES;

  // ── Portal-specific portals (teacher, parent, student, …) ─────────────────
  // Their own module list is ALWAYS shown in full — permissions control what
  // a user can DO within those pages, not whether the page appears in the nav.
  // Only admin / custom roles have their nav gated by permission_codes.
  const isAdminLike = portalType === 'admin' || portalType === 'custom';

  const filtered = baseList.filter((m) => {
    // Strip home modules unless explicitly included
    if (!options.includeHome && HOME_IDS.has(m.id)) return false;
    // superuserOnly gates apply to everyone
    if (m.superuserOnly && !(me.is_superuser || me.role_names?.includes('super_admin'))) return false;
    // Permission filtering only for admin-like portals
    if (isAdminLike && !hasPermission(m.permission, me)) return false;
    // Admin module-toggle preference (moduleStore) — admin only
    if (options.isModuleEnabled && !options.isModuleEnabled(m.id)) return false;
    return true;
  });

  // ── Extra admin-granted modules (teacher portal only) ────────────────────
  // Admins can grant admin-level modules (Fees, HR, etc.) to teacher roles via
  // Roles & Permissions.  Only the teacher portal surfaces these extras because:
  //   • Teachers are school staff who may legitimately need admin pages.
  //   • Parent / student portals are consumer-facing — they never get admin pages.
  // Extra modules still require a permission check (cross-portal grant).
  if (portalType === 'teacher') {
    const baseIds   = new Set(baseList.map((m) => m.id));
    const basePaths = new Set(baseList.map((m) => m.path));
    const extra = MODULES.filter(
      (m) =>
        m.permission &&
        hasPermission(m.permission, me) &&
        !baseIds.has(m.id) &&    // deduplicate by id
        !basePaths.has(m.path),  // deduplicate by path (e.g. prevents two Attendance tiles)
    );
    return [...filtered, ...extra];
  }

  return filtered;
}
