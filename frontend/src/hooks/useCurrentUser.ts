"use client";

import { useEffect, useState } from "react";
import { getCurrentUser } from "@/services/api";
import type { CurrentUser } from "@/types/api";

let cachedUser: CurrentUser | null = null;
let inFlight: Promise<CurrentUser> | null = null;

/** GET /api/users/me, fetched at most once per page load. */
export function fetchCurrentUser(): Promise<CurrentUser> {
  if (cachedUser) return Promise.resolve(cachedUser);
  if (!inFlight) {
    inFlight = getCurrentUser()
      .then((user) => {
        cachedUser = user;
        return user;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCurrentUser()
      .then((result) => {
        if (active) setUser(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { user, loading, failed };
}
