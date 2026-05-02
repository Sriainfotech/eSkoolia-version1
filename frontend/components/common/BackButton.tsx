"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type BackButtonProps = {
  label?: string;
  className?: string;
};

export function BackButton({ label = "Back", className = "" }: BackButtonProps) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(true);

  useEffect(() => {
    // Check if browser history is available
    // In most cases, we can go back if history.length > 1
    if (typeof window !== "undefined") {
      setCanGoBack(window.history.length > 1);
    }
  }, []);

  const handleClick = () => {
    // Allow other components to intercept navigation (e.g. unsaved-changes prompts)
    if (typeof window !== "undefined") {
      const guard = (window as unknown as { __navGuard?: (proceed: () => void) => boolean }).__navGuard;
      if (typeof guard === "function") {
        const blocked = guard(() => {
          if (canGoBack) router.back();
          else router.push("/dashboard");
        });
        if (blocked) return;
      }
    }
    if (canGoBack) {
      router.back();
    } else {
      // Fallback to dashboard if no history exists
      router.push("/dashboard");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex h-8 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm transition-colors duration-200 ease-in-out hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${className}`}
      title={label}
    >
      <span className="text-sm leading-none">←</span>
      <span>{label}</span>
    </button>
  );
}
