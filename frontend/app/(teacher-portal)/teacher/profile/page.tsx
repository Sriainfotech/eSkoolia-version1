'use client';

/**
 * Teacher Portal — My Profile
 *
 * Reuses the admin Settings > Staff Profile panel unchanged (same pattern as
 * teacher/attendance reusing admin attendance components 1-to-1). The panel
 * already self-scopes: a teacher without human_resource.staff.view only ever
 * sees their own record via /api/v1/hr/staff/me/, never a staff picker.
 */

import { StaffProfilePanel } from '@/components/settings/StaffProfilePanel';

export default function TeacherProfilePage() {
  return <StaffProfilePanel />;
}
