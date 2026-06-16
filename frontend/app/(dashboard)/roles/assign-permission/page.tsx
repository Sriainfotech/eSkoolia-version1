"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import AssignPermissionPanel from "@/components/access-control/AssignPermissionPanel";

function AssignPermissionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleIdParam = searchParams.get("roleId") ?? "";

  // If no roleId in the URL, bounce to the role list so the user picks one first.
  useEffect(() => {
    if (!roleIdParam) {
      router.replace("/roles");
    }
  }, [roleIdParam, router]);

  if (!roleIdParam) return null;

  return (
    <AssignPermissionPanel
      roleId={roleIdParam}
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
