import { Suspense } from "react";
import { AdmissionsCommandCenter } from "@/components/admissions/AdmissionsCommandCenter";

export default function AdmissionsCommandCenterPage() {
  return (
    <Suspense fallback={null}>
      <AdmissionsCommandCenter />
    </Suspense>
  );
}
