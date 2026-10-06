"use client";

import React from "react";
import Link from "next/link";
import { ActionTiles } from "@/components/dashboard/ActionTiles";
import { RecentMeetingCard } from "@/components/dashboard/RecentMeetingCard";
import { UpcomingMeetingCard } from "@/components/dashboard/UpcomingMeetingCard";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SkeletonList } from "@/components/common/Skeleton";
import { AppShell } from "@/components/layout/AppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDashboardData } from "@/hooks/useDashboardData";
import { greetingForDate } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const { upcoming, recent, refresh } = useDashboardData();

  const firstName = user?.name?.split(" ")[0];
  const [today, setToday] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setToday(new Date());
  }, []);

  return (
    <AppShell>
      <div className="greeting">
        <h1 className="greeting__title">
          {greetingForDate()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        {today && <p className="greeting__date">{today.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}</p>}
      </div>

      <ActionTiles />

      <div className="dash-columns">
        <section className="section" aria-labelledby="upcoming-heading">
          <div className="section__head">
            <h2 className="section__title" id="upcoming-heading">
              Upcoming Meetings
            </h2>
            <Link href="/meetings" className="section__link">
              View all
            </Link>
          </div>

          <div className="section__body">
            {upcoming.loading ? (
              <SkeletonList rows={2} />
            ) : upcoming.error ? (
              <ErrorState message={upcoming.error} onRetry={refresh} />
            ) : upcoming.items.length === 0 ? (
              <EmptyState
                title="No upcoming meetings"
                description="Schedule a meeting and it will show up here with its invite link."
                action={
                  <Link href="/schedule" className="btn btn--primary">
                    Schedule a Meeting
                  </Link>
                }
              />
            ) : (
              upcoming.items.map((meeting) => (
                <UpcomingMeetingCard
                  key={meeting.meeting_id}
                  meeting={meeting}
                />
              ))
            )}
          </div>
        </section>

        <section className="section" aria-labelledby="recent-heading">
          <div className="section__head">
            <h2 className="section__title" id="recent-heading">
              Recent Meetings
            </h2>
          </div>

          <div className="section__body">
            {recent.loading ? (
              <SkeletonList rows={2} />
            ) : recent.error ? (
              <ErrorState message={recent.error} onRetry={refresh} />
            ) : recent.items.length === 0 ? (
              <EmptyState
                title="No recent meetings"
                description="Meetings you have hosted or attended will appear here."
              />
            ) : (
              recent.items.map((meeting) => (
                <RecentMeetingCard
                  key={meeting.meeting_id}
                  meeting={meeting}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
