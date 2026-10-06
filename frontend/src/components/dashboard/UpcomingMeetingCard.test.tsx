import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/common/ToastProvider";
import { UpcomingMeetingCard } from "@/components/dashboard/UpcomingMeetingCard";
import type { Meeting } from "@/types/meeting";

afterEach(cleanup);

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function buildMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 7,
    meeting_id: "abc-123-def",
    host_id: 1,
    title: "Design sync",
    description: null,
    start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    end_time: null,
    duration: 30,
    status: "scheduled",
    meeting_link: "http://localhost:3000/meetings/abc-123-def",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function renderCard(meeting: Meeting) {
  return render(
    <ToastProvider>
      <UpcomingMeetingCard meeting={meeting} />
    </ToastProvider>
  );
}

describe("UpcomingMeetingCard", () => {
  it("renders the meeting title and a live countdown label", () => {
    renderCard(buildMeeting());
    expect(
      screen.getByRole("heading", { name: "Design sync" })
    ).toBeTruthy();
    expect(screen.getByText(/^Starts in /)).toBeTruthy();
  });

  it("links the Join button to the meeting room", () => {
    renderCard(buildMeeting());
    const join = screen.getByRole("link", { name: "Join" });
    expect(join.getAttribute("href")).toBe("/meetings/abc-123-def");
  });

  it("shows Starting now once the start time has passed", () => {
    renderCard(
      buildMeeting({ start_time: new Date(Date.now() - 60_000).toISOString() })
    );
    expect(screen.getByText("Starting now")).toBeTruthy();
  });
});
