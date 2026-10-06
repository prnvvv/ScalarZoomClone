"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Real fullscreen via the browser Fullscreen API, bound to one element.
 * ESC exits through the browser itself, which fires `fullscreenchange` and
 * keeps `isFullscreen` truthful; stage layout re-fits from the resize
 * observer whenever the viewport changes.
 */
export function useFullscreen<T extends HTMLElement>(): {
  ref: React.RefObject<T | null>;
  isFullscreen: boolean;
  supported: boolean;
  toggle: () => void;
  exit: () => void;
} {
  const ref = useRef<T | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const supported =
    typeof document !== "undefined" &&
    typeof document.fullscreenEnabled === "boolean" &&
    document.fullscreenEnabled;

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(
        typeof document !== "undefined" && Boolean(document.fullscreenElement)
      );
    };
    document.addEventListener("fullscreenchange", onChange);
    onChange();
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const exit = useCallback(() => {
    if (typeof document !== "undefined" && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  const toggle = useCallback(() => {
    const element = ref.current;
    if (!supported || !element) return;
    if (document.fullscreenElement) {
      exit();
      return;
    }
    void element.requestFullscreen().catch(() => undefined);
  }, [supported, ref, exit]);

  return {
    ref,
    isFullscreen,
    supported,
    toggle,
    exit,
  };
}
