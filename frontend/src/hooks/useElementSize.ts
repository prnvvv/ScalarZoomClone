"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Observes an element's content box so the tile grid can re-fit on resize,
 * fullscreen changes, panel open/close and orientation flips. Falls back to
 * window resize events where `ResizeObserver` is unavailable (jsdom, older
 * browsers) and reports `0 x 0` until the first measurement.
 */
export function useElementSize<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  ElementSize
] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setSize((current) =>
      current.width === rect.width && current.height === rect.height
        ? current
        : { width: rect.width, height: rect.height }
    );
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    measure();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => measure());
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return [ref, size];
}
