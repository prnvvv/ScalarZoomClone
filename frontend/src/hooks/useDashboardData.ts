"use client";

import { useCallback, useEffect, useState } from "react";
import { toUserMessage } from "@/lib/api-client";
import {
  getRecentMeetings,
  getUpcomingMeetings,
} from "@/services/scheduleService";
import type { Meeting } from "@/types/meeting";

export interface AsyncList<T> {
  items: T[];
  loading: boolean;
  error: string | null;
}

interface DashboardData {
  upcoming: AsyncList<Meeting>;
  recent: AsyncList<Meeting>;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

const EMPTY: AsyncList<Meeting> = { items: [], loading: true, error: null };

/** Loads upcoming and recent meetings for the dashboard. */
export function useDashboardData(): DashboardData {
  const [upcoming, setUpcoming] = useState<AsyncList<Meeting>>(EMPTY);
  const [recent, setRecent] = useState<AsyncList<Meeting>>({
    ...EMPTY,
    loading: false,
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setUpcoming((current) => ({ ...current, loading: true, error: null }));
    setRecent((current) => ({ ...current, loading: true, error: null }));

    const [upcomingResult, recentResult] = await Promise.allSettled([
      getUpcomingMeetings(),
      getRecentMeetings(),
    ]);

    if (upcomingResult.status === "fulfilled") {
      setUpcoming({ items: upcomingResult.value, loading: false, error: null });
    } else {
      setUpcoming({
        items: [],
        loading: false,
        error: toUserMessage(upcomingResult.reason),
      });
    }

    if (recentResult.status === "fulfilled") {
      setRecent({ items: recentResult.value, loading: false, error: null });
    } else {
      setRecent({
        items: [],
        loading: false,
        error: toUserMessage(recentResult.reason),
      });
    }

    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { upcoming, recent, refreshing, refresh: load };
}
