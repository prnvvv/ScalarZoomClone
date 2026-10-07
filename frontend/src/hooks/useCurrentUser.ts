"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "@/services/api";
import { useDisplayNamePreference } from "./useDisplayNamePreference";
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

export interface ResolvedUser extends Omit<CurrentUser, "id"> {
  /** Clerk user IDs are strings; legacy backend IDs are integers. */
  id: string | number;
  /** True when the profile comes from Clerk instead of the demo backend user. */
  isClerk?: boolean;
  /** True when the user has not signed in and no display name is saved. */
  isGuest?: boolean;
}

/**
 * Returns the current user identity.
 * - Signed-in Clerk users take precedence and mirror the Clerk profile.
 * - When signed out, the legacy demo backend user is used as a fallback so
 *   existing meeting flows keep working until the backend supports Clerk.
 * - If the backend call also fails, a guest identity is derived from the
 *   saved display name preference.
 */
export function useCurrentUser() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { displayName } = useDisplayNamePreference();
  const [demoUser, setDemoUser] = useState<CurrentUser | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser && !clerkLoaded);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCurrentUser()
      .then((result) => {
        if (active) setDemoUser(result);
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

  const user = useMemo<ResolvedUser | null>(() => {
    if (clerkLoaded && clerkUser) {
      const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress ?? "";
      const firstName = clerkUser.firstName ?? "";
      const lastName = clerkUser.lastName ?? "";
      const fullName =
        clerkUser.fullName ??
        ([firstName, lastName].filter(Boolean).join(" ") || displayName || "You");
      return {
        id: clerkUser.id,
        name: fullName,
        email: primaryEmail,
        created_at: clerkUser.createdAt?.toISOString() ?? new Date().toISOString(),
        isClerk: true,
      };
    }

    if (demoUser) {
      return { ...demoUser, isGuest: false };
    }

    if (displayName) {
      return {
        id: "guest",
        name: displayName,
        email: "",
        created_at: new Date().toISOString(),
        isGuest: true,
      };
    }

    return null;
  }, [clerkLoaded, clerkUser, demoUser, displayName]);

  return { user, loading: loading && !clerkLoaded, failed };
}
