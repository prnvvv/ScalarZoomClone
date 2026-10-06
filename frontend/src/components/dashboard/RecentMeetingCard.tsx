import Link from "next/link";
import { MeetingsIcon } from "@/components/icons";
import {
  cx,
  formatDate,
  formatDuration,
  formatTime,
  statusLabel,
  statusTone,
} from "@/lib/utils";
import type { Meeting } from "@/types/meeting";

interface RecentMeetingCardProps {
  meeting: Meeting;
}

/** Compact row used for finished meetings on the dashboard and meetings page. */
export function RecentMeetingCard({ meeting }: RecentMeetingCardProps) {
  return (
    <div className="meeting-row">
      <span className="meeting-row__icon" aria-hidden="true">
        <MeetingsIcon size={18} />
      </span>
      <div className="meeting-row__body">
        <div className="meeting-row__title">{meeting.title}</div>
        <div className="meeting-row__meta">
          <span>
            {formatDate(meeting.start_time)} at {formatTime(meeting.start_time)}
          </span>
          {formatDuration(meeting.duration) ? (
            <span>{formatDuration(meeting.duration)}</span>
          ) : null}
        </div>
      </div>
      <div className="meeting-row__side">
        <span
          className={cx(
            "badge",
            statusTone(meeting.status) && `badge--${statusTone(meeting.status)}`
          )}
        >
          {statusLabel(meeting.status)}
        </span>
        <Link
          href={`/meetings/${meeting.meeting_id}`}
          className="btn btn--ghost btn--sm"
        >
          Open
        </Link>
      </div>
    </div>
  );
}
