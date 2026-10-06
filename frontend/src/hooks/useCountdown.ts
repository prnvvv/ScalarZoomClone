"use client";

import { useEffect, useState } from "react";

/**
 * Re-renders on an interval so countdown labels stay accurate.
 * Returns the current timestamp in milliseconds.
 */
export function useCountdown(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}
