"use client";
/**
 * Configure Policy — Leave Types, Entitlements, Approval Chain. A real page
 * (not a modal) so that modals it opens (Add Role, Govt Reference) aren't
 * nested inside another modal's DOM tree — see LeaveSetupWizard for why
 * that mattered.
 */
import { useRouter } from "next/navigation";
import { LeaveSetupWizard } from "@/components/hr/LeaveSetupWizard";

export default function LeaveSetupPage() {
  const router = useRouter();
  return <LeaveSetupWizard onClose={() => router.push("/hr/leave")} />;
}
