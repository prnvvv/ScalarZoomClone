"use client";

import {
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  ScreenShareIcon,
  UsersIcon,
  VideoIcon,
  VideoOffIcon,
} from "@/components/icons";
import { cx } from "@/lib/utils";

interface ControlBarProps {
  isMuted: boolean;
  isVideoOn: boolean;
  participantsOpen: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleParticipants: () => void;
  onLeave: () => void;
}

/** Bottom control strip of the meeting room. */
export function ControlBar({
  isMuted,
  isVideoOn,
  participantsOpen,
  onToggleMute,
  onToggleVideo,
  onToggleParticipants,
  onLeave,
}: ControlBarProps) {
  return (
    <div className="room__controls" role="toolbar" aria-label="Meeting controls">
      <button
        type="button"
        className={cx("control", isMuted && "control--off")}
        aria-pressed={isMuted}
        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        onClick={onToggleMute}
      >
        <span className="control__button">
          {isMuted ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
        </span>
        {isMuted ? "Unmute" : "Mute"}
      </button>

      <button
        type="button"
        className={cx("control", !isVideoOn && "control--off")}
        aria-pressed={!isVideoOn}
        aria-label={isVideoOn ? "Turn camera off" : "Turn camera on"}
        onClick={onToggleVideo}
      >
        <span className="control__button">
          {isVideoOn ? <VideoIcon size={20} /> : <VideoOffIcon size={20} />}
        </span>
        {isVideoOn ? "Stop video" : "Start video"}
      </button>

      <button
        type="button"
        className="control"
        disabled
        title="Screen sharing is wired up with the realtime layer"
        aria-label="Share screen (not connected yet)"
      >
        <span className="control__button">
          <ScreenShareIcon size={20} />
        </span>
        Share
      </button>

      <button
        type="button"
        className={cx("control", participantsOpen && "control--active")}
        aria-pressed={participantsOpen}
        aria-label="Show participants"
        onClick={onToggleParticipants}
      >
        <span className="control__button">
          <UsersIcon size={20} />
        </span>
        People
      </button>

      <button
        type="button"
        className="control control--danger"
        aria-label="Leave meeting"
        onClick={onLeave}
      >
        <span className="control__button">
          <PhoneOffIcon size={20} />
        </span>
        Leave
      </button>
    </div>
  );
}
