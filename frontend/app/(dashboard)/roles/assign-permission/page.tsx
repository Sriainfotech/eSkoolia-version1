"use client";

import { useRouter, useSearchParams } from "next/navigation";
import AssignPermissionPanel from "@/components/access-control/AssignPermissionPanel";

export default function AssignPermissionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleIdParam = searchParams.get("roleId") ?? "";

  return (
    <AssignPermissionPanel
      roleId={roleIdParam}
      onBack={() => router.back()}
    />
  );
}
