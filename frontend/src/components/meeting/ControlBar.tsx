"use client";

import {
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  ScreenShareIcon,
  SettingsIcon,
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
  /** Room settings popover (camera / microphone / speaker choice). */
  settingsOpen?: boolean;
  onToggleSettings?: () => void;
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
  settingsOpen = false,
  onToggleSettings,
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
        <span className="control__label">
          {isMuted ? "Unmute" : "Mute"}
        </span>
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
        <span className="control__label">
          {isVideoOn ? "Stop video" : "Start video"}
        </span>
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
        <span className="control__label">Share</span>
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
        <span className="control__label">People</span>
      </button>

      {onToggleSettings ? (
        <button
          type="button"
          className={cx("control", settingsOpen && "control--active")}
          aria-pressed={settingsOpen}
          aria-label="Open meeting settings"
          aria-expanded={settingsOpen}
          onClick={onToggleSettings}
        >
          <span className="control__button">
            <SettingsIcon size={20} />
          </span>
          <span className="control__label">Settings</span>
        </button>
      ) : null}

      <button
        type="button"
        className="control control--danger"
        aria-label="Leave meeting"
        onClick={onLeave}
      >
        <span className="control__button">
          <PhoneOffIcon size={20} />
        </span>
        <span className="control__label">Leave</span>
      </button>
    </div>
  );
}
