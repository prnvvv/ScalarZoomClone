"use client";

import { useToast } from "@/components/common/ToastProvider";
import { CopyIcon, XIcon } from "@/components/icons";
import { buildInviteUrl, copyText } from "@/lib/utils";
import type { ParticipantSummary } from "@/types/participant";

interface ParticipantsPanelProps {
  participants: ParticipantSummary[];
  meetingId: string;
  localName: string;
  onClose: () => void;
}

/** Slide-in panel listing who is in the meeting. */
export function ParticipantsPanel({
  participants,
  meetingId,
  localName,
  onClose,
}: ParticipantsPanelProps) {
  const { toast } = useToast();

  const copyInvite = async () => {
    const ok = await copyText(buildInviteUrl(meetingId));
    toast(
      ok ? "Invite link copied" : "Could not copy the invite link",
      ok ? "success" : "error"
    );
  };

  return (
    <aside
      className="room-panel"
      role="dialog"
      aria-label={`Participants (${participants.length})`}
    >
      <div className="room-panel__head">
        <span className="room-panel__title">
          Participants ({participants.length})
        </span>
        <button
          type="button"
          className="room-icon-button"
          aria-label="Close participants panel"
          onClick={onClose}
        >
          <XIcon size={18} />
        </button>
      </div>

      <div className="room-panel__body">
        {participants.map((participant) => {
          const isYou = participant.display_name === localName;
          return (
            <div className="participant-row" key={participant.id}>
              <div className="participant-row__body">
                <div className="participant-row__name">
                  {participant.display_name}
                  {isYou ? " (You)" : ""}
                </div>
                <div className="participant-row__meta">
                  {participant.is_host ? "Host" : "Participant"}
                  {participant.is_muted ? " · Muted" : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="room-panel__footer">
        <button
          type="button"
          className="room__chip"
          onClick={copyInvite}
          aria-label="Copy invite link"
        >
          <CopyIcon size={14} />
          Copy invite link
        </button>
      </div>
    </aside>
  );
}
