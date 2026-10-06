"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { VideoIcon } from "@/components/icons";
import { toUserMessage } from "@/lib/api-client";
import { createMeeting } from "@/services/meetingService";

export default function NewMeetingPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function startMeeting() {
    setStarting(true);
    setError(null);
    try {
      const meeting = await createMeeting({ title: "Instant Meeting" });
      router.push(`/meetings/${meeting.meeting_id}`);
    } catch (cause) {
      setError(toUserMessage(cause));
      setStarting(false);
    }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">New Meeting</h1>
          <p className="page-header__subtitle">
            Start an instant meeting and share the link with anyone you want.
          </p>
        </div>
      </div>

      <div className="form-panel">
        {error ? (
          <div className="form-error-banner" role="alert">
            {error}
          </div>
        ) : null}

        <p style={{ color: "var(--color-text-secondary)", marginBottom: 4 }}>
          The meeting goes live the moment you start it. You can invite
          people from inside the room.
        </p>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={startMeeting}
            disabled={starting}
          >
            <VideoIcon size={18} />
            {starting ? "Starting…" : "Start Meeting"}
          </button>
          <Link href="/dashboard" className="btn btn--ghost" aria-disabled={starting}>
            Cancel
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
