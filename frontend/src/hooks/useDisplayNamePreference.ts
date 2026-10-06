"use client";

import { useCallback, useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "@/lib/constants";

const subscribeToSessionName = () => () => {};

/** sessionStorage is not observable; re-read on any re-render instead. */
function readSessionName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(STORAGE_KEYS.displayName) ?? "";
  } catch {
    return "";
  }
}

export interface DisplayNamePreference {
  /** Name saved for this browser tab, empty when never set. */
  displayName: string;
  saveDisplayName: (name: string) => void;
}

/**
 * The display name a participant joins with. It lives in `sessionStorage` so
 * the pre-join form, the room and the settings page all agree without a
 * backend profile endpoint.
 */
export function useDisplayNamePreference(): DisplayNamePreference {
  const displayName = useSyncExternalStore(
    subscribeToSessionName,
    readSessionName,
    () => ""
  );

  const saveDisplayName = useCallback((name: string) => {
    try {
      window.sessionStorage.setItem(STORAGE_KEYS.displayName, name);
    } catch {
      /* storage disabled — the name simply does not persist */
    }
  }, []);

  return { displayName, saveDisplayName };
}
