"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Count-up animation hook using requestAnimationFrame.
 * Returns the current animated value.
 */
export function useCountUp(target: number, duration = 1200, startOnMount = true): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const startValue = 0;

  useEffect(() => {
    if (!startOnMount) return;
    if (target === 0) { setValue(0); return; }

    const animate = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(startValue + (target - startValue) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startRef.current = null;
    };
  }, [target, duration, startOnMount]);

  return value;
}
