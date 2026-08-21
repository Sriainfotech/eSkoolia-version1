/**
 * Tests — Bot manifest loader (RBAC + ABAC filtering)
 * ====================================================
 * Pure function tests — no DOM, no network.
 */
import { ALL_MANIFESTS, getFilteredManifests, getManifestById } from '@/lib/bot/manifestLoader';

function contextWith(can: (code: string) => boolean, hasFeature: (flag: string) => boolean) {
  return { can, hasFeature };
}

describe('getFilteredManifests — RBAC (action-level)', () => {
  it('keeps a manifest with an allowed action, action list unchanged', () => {
    const ctx = contextWith(() => true, () => true);
    const filtered = getFilteredManifests(ctx);
    const attendance = filtered.find(m => m.id === 'attendance');
    expect(attendance).toBeDefined();
    expect(attendance!.actions.length).toBe(getManifestById('attendance')!.actions.length);
  });

  it('strips a disallowed action but keeps the manifest (a role/tenant-plan combo that should not have "mark absent" is denied)', () => {
    const ctx = contextWith(() => false, () => true);
    const filtered = getFilteredManifests(ctx);
    const attendance = filtered.find(m => m.id === 'attendance');
    // attendance's only action is mark-absent — with can() denying
    // everything, that action must not survive filtering.
    expect(attendance?.actions ?? []).toHaveLength(0);
  });

  it('never strips actions from a pure-lookup manifest (no actions to begin with)', () => {
    const ctx = contextWith(() => false, () => true);
    const filtered = getFilteredManifests(ctx);
    const students = filtered.find(m => m.id === 'students');
    expect(students).toBeDefined();
    expect(students!.actions).toEqual([]);
  });
});

describe('getFilteredManifests — ABAC (tenant feature flag)', () => {
  it('drops a manifest whose requiredFeatureFlag is not enabled for this tenant', () => {
    const ctx = contextWith(() => true, (flag) => flag !== 'attendance_enabled');
    const filtered = getFilteredManifests(ctx);
    expect(filtered.find(m => m.id === 'attendance')).toBeUndefined();
    expect(filtered.find(m => m.id === 'fees')).toBeDefined();
  });

  it('drops fees when fees_enabled is off, independent of attendance', () => {
    const ctx = contextWith(() => true, (flag) => flag !== 'fees_enabled');
    const filtered = getFilteredManifests(ctx);
    expect(filtered.find(m => m.id === 'fees')).toBeUndefined();
    expect(filtered.find(m => m.id === 'attendance')).toBeDefined();
  });

  it('never drops students — it declares no requiredFeatureFlag', () => {
    const ctx = contextWith(() => true, () => false);
    const filtered = getFilteredManifests(ctx);
    expect(filtered.find(m => m.id === 'students')).toBeDefined();
  });

  it('a plan with every feature off + no permissions leaves only pure lookups with no actions', () => {
    const ctx = contextWith(() => false, () => false);
    const filtered = getFilteredManifests(ctx);
    const ids = filtered.map(m => m.id);
    expect(ids).toContain('students'); // no feature flag, no actions to deny
    expect(ids).not.toContain('attendance'); // feature flag denied
    expect(ids).not.toContain('fees'); // feature flag denied
  });
});

describe('ALL_MANIFESTS registry', () => {
  it('has a unique id per manifest', () => {
    const ids = ALL_MANIFESTS.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every action declares a non-empty requiredPermissionCode', () => {
    for (const manifest of ALL_MANIFESTS) {
      for (const action of manifest.actions) {
        expect(action.requiredPermissionCode.length).toBeGreaterThan(0);
      }
    }
  });
});
