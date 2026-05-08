"use client";

import { useRouter, useParams } from "next/navigation";
import AssignPermissionPanel from "@/components/access-control/AssignPermissionPanel";

export default function AssignPermissionByRolePage() {
  const router = useRouter();
  const params = useParams();
  const roleId = params.id as string;

  return (
    <AssignPermissionPanel
      roleId={roleId}
      onBack={() => router.back()}
    />
  );
}
