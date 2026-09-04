"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AssignPermissionPanel from "@/components/access-control/AssignPermissionPanel";

function AssignPermissionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleIdParam = searchParams.get("roleId") ?? "";

  // No roleId in the URL (e.g. reached via the top-nav "Assign Permissions"
  // tab rather than a specific role's hover action) — AssignPermissionPanel
  // already has its own "select a role" picker for this case, so just let
  // it render instead of bouncing back to /roles before it gets the chance.
  return (
    <AssignPermissionPanel
      roleId={roleIdParam || null}
      onBack={() => router.back()}
    />
  );
}

export default function AssignPermissionPage() {
  return (
    <Suspense>
      <AssignPermissionContent />
    </Suspense>
  );
}
