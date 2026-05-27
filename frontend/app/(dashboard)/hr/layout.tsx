"use client";
import { HrToastProvider } from "@/components/hr/HrUi";

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return (
    <HrToastProvider>
      <div
        className="min-h-screen"
        style={{ background: "var(--page)", padding: "12px 20px 40px" }}
      >
        {children}
      </div>
    </HrToastProvider>
  );
}

