"use client";

// Brand-sanctioned number reveal (≤600ms): counts from 0 to a target once,
// on mount. Respects prefers-reduced-motion (jumps straight to the value).

import { useEffect, useRef, useState } from "react";

export default function CountUp({
  value,
  durationMs = 600,
  decimals = 0,
  suffix = "",
  prefix = "",
}: {
  value: number;
  durationMs?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || durationMs <= 0) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out (sharp in, settled out) — matches the brand easing feel
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, durationMs]);

  return (
    <span className="kb-data">
      {prefix}
      {display.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}
