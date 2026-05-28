"use client";
import { usePathname } from "next/navigation";
import { HrToastProvider } from "@/components/hr/HrUi";

export default function HrLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // On wizard/full-page routes, drop min-h-screen so the background
  // doesn't expand beyond the actual content and leave a blank area.
  const fullPage = pathname === "/hr/onboard";
  return (
    <HrToastProvider>
      <div
        className={fullPage ? "min-h-full" : "min-h-screen"}
        style={{ background: "var(--page)", padding: "12px 20px 40px" }}
      >
        {children}
      </div>
    </HrToastProvider>
  );
}

