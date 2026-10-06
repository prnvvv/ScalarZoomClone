"use client";

import Link from "next/link";
import { useState } from "react";
import { ErrorState } from "@/components/common/ErrorState";
import { RecentMeetingCard } from "@/components/dashboard/RecentMeetingCard";
import { UpcomingMeetingCard } from "@/components/dashboard/UpcomingMeetingCard";
import { SkeletonList } from "@/components/common/Skeleton";
import { AppShell } from "@/components/layout/AppShell";
import { useDashboardData } from "@/hooks/useDashboardData";

type TabKey = "upcoming" | "recent";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "upcoming", label: "Upcoming" },
  { key: "recent", label: "Recent" },
];

function EmptyPanel({ tab }: { tab: TabKey }) {
  return (
    <div className="cta-panel">
      <p className="cta-panel__title">
        {tab === "upcoming" ? "No upcoming meetings" : "No recent meetings"}
      </p>
      <p className="cta-panel__text">
        {tab === "upcoming"
          ? "Schedule a meeting and it will appear here with its invite link."
          : "Meetings you have hosted or attended will show up here once they finish."}
      </p>
      <Link href="/schedule" className="btn btn--primary">
        Schedule a Meeting
      </Link>
    </div>
  );
}

export default function MeetingsPage() {
  const [tab, setTab] = useState<TabKey>("upcoming");
  const { upcoming, recent, refresh } = useDashboardData();
  const active = tab === "upcoming" ? upcoming : recent;

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Meetings</h1>
          <p className="page-header__subtitle">
            Everything you have scheduled and everything you have attended.
          </p>
        </div>
        <div className="page-header__actions">
          <Link href="/schedule" className="btn btn--primary">
            Schedule
          </Link>
        </div>
      </div>

      <div className="tabs page-tabs" role="tablist" aria-label="Meeting lists">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`meetings-tab-${item.key}`}
            aria-selected={tab === item.key}
            aria-controls="meetings-panel"
            className="tab"
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section
        className="tab-panel section__body"
        id="meetings-panel"
        role="tabpanel"
        aria-labelledby={`meetings-tab-${tab}`}
      >
        {active.loading ? (
          <SkeletonList rows={3} />
        ) : active.error ? (
          <ErrorState message={active.error} onRetry={refresh} />
        ) : active.items.length === 0 ? (
          <EmptyPanel tab={tab} />
        ) : tab === "upcoming" ? (
          active.items.map((meeting) => (
            <UpcomingMeetingCard
              key={meeting.meeting_id}
              meeting={meeting}
            />
          ))
        ) : (
          active.items.map((meeting) => (
            <RecentMeetingCard
              key={meeting.meeting_id}
              meeting={meeting}
            />
          ))
        )}
      </section>
    </AppShell>
  );
}
