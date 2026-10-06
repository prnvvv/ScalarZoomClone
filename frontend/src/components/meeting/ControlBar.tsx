"use client";

import {
  AutoLayoutIcon,
  CopyIcon,
  GridViewIcon,
  KeyboardIcon,
  MaximizeIcon,
  MinimizeIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  ScreenShareIcon,
  ScreenShareOffIcon,
  SettingsIcon,
  ShieldIcon,
  SmileIcon,
  SpeakerViewIcon,
  UsersIcon,
  VideoIcon,
  VideoOffIcon,
  ChevronUpIcon,
} from "@/components/icons";
import {
  RoomMenuDivider,
  RoomMenuItem,
  RoomMenuLabel,
  RoomPopover,
} from "@/components/meeting/RoomPopover";
import { ReactionPicker } from "@/components/meeting/ReactionPicker";
import type { RoomLayoutMode } from "@/hooks/useRoomPreferences";
import { cx } from "@/lib/utils";

export type SettingsTab = "video" | "audio" | "meeting" | "general";

export interface ControlBarDeviceOptions {
  audioInputDevices: MediaDeviceInfo[];
  videoInputDevices: MediaDeviceInfo[];
  selectedAudioInputId: string | null;
  selectedVideoInputId: string | null;
  setAudioInput: (deviceId: string) => void;
  setVideoInput: (deviceId: string) => void;
}

interface ControlBarProps {
  isMuted: boolean;
  isVideoOn: boolean;
  /** False when the microphone could not be acquired (blocked or missing). */
  audioAvailable: boolean;
  /** False when the camera could not be acquired (blocked or missing). */
  videoAvailable: boolean;
  participantsOpen: boolean;
  isScreenSharing: boolean;
  isHost: boolean;
  layout: RoomLayoutMode;
  isFullscreen: boolean;
  fullscreenSupported: boolean;
  devices: ControlBarDeviceOptions;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleParticipants: () => void;
  onToggleScreenShare: () => void;
  onReact: (emoji: string) => void;
  onSetLayout: (layout: RoomLayoutMode) => void;
  onOpenSettings: (tab: SettingsTab) => void;
  onToggleFullscreen: () => void;
  onCopyInvite: () => void;
  /** Host-only actions; undefined hides the whole Host Tools control. */
  onMuteAll?: () => void;
  onEndMeeting?: () => void;
  onLeave: () => void;
}

function deviceName(device: MediaDeviceInfo, index: number): string {
  const base =
    device.kind === "videoinput"
      ? "Camera"
      : device.kind === "audiooutput"
        ? "Speaker"
        : "Microphone";
  return device.label || `${base} ${index + 1}`;
}

/** Bottom control strip of the meeting room (no Chat, by design). */
export function ControlBar({
  isMuted,
  isVideoOn,
  audioAvailable,
  videoAvailable,
  participantsOpen,
  isScreenSharing,
  isHost,
  layout,
  isFullscreen,
  fullscreenSupported,
  devices,
  onToggleMute,
  onToggleVideo,
  onToggleParticipants,
  onToggleScreenShare,
  onReact,
  onSetLayout,
  onOpenSettings,
  onToggleFullscreen,
  onCopyInvite,
  onMuteAll,
  onEndMeeting,
  onLeave,
}: ControlBarProps) {
  // Screen capture needs a secure context; on plain http over a LAN IP the
  // API does not exist at all, so the control says so instead of failing
  // silently when clicked.
  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function";

  const micIcon = !audioAvailable ? (
    <MicOffIcon size={20} />
  ) : isMuted ? (
    <MicOffIcon size={20} />
  ) : (
    <MicIcon size={20} />
  );

  return (
    <div className="room__controls" role="toolbar" aria-label="Meeting controls">
      <div className="room__controls-group">
        <RoomPopover
          label="Audio options"
          align="start"
          trigger={(triggerProps) => (
            <>
              <button
                type="button"
                className={cx(
                  "control",
                  (isMuted || !audioAvailable) && "control--off",
                  !audioAvailable && "control--unavailable"
                )}
                aria-pressed={isMuted}
                aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                title={
                  audioAvailable
                    ? isMuted
                      ? "Unmute microphone"
                      : "Mute microphone"
                    : "Microphone unavailable"
                }
                onClick={onToggleMute}
              >
                <span className="control__button">{micIcon}</span>
                <span className="control__label">Audio</span>
              </button>
              <button
                type="button"
                className="control__caret"
                aria-label="Audio options"
                title="Audio options"
                aria-expanded={triggerProps["aria-expanded"]}
                aria-haspopup={triggerProps["aria-haspopup"]}
                onClick={triggerProps.onToggle}
              >
                <ChevronUpIcon size={13} />
              </button>
            </>
          )}
        >
          {(close) => (
            <>
              <RoomMenuLabel>Microphone</RoomMenuLabel>
              {devices.audioInputDevices.length === 0 ? (
                <div className="room-menu__empty">No microphone detected</div>
              ) : (
                devices.audioInputDevices.map((device, index) => (
                  <RoomMenuItem
                    key={device.deviceId || index}
                    checked={device.deviceId === devices.selectedAudioInputId}
                    onSelect={() => {
                      devices.setAudioInput(device.deviceId);
                      close();
                    }}
                  >
                    {deviceName(device, index)}
                  </RoomMenuItem>
                ))
              )}
              <RoomMenuDivider />
              <RoomMenuItem
                icon={<SettingsIcon size={15} />}
                onSelect={() => {
                  close();
                  onOpenSettings("audio");
                }}
              >
                Audio settings…
              </RoomMenuItem>
            </>
          )}
        </RoomPopover>

        <RoomPopover
          label="Video options"
          align="start"
          trigger={(triggerProps) => (
            <>
              <button
                type="button"
                className={cx(
                  "control",
                  (!isVideoOn || !videoAvailable) && "control--off",
                  !videoAvailable && "control--unavailable"
                )}
                aria-pressed={!isVideoOn}
                aria-label={isVideoOn ? "Turn camera off" : "Turn camera on"}
                title={
                  videoAvailable
                    ? isVideoOn
                      ? "Turn camera off"
                      : "Turn camera on"
                    : "Camera unavailable"
                }
                onClick={onToggleVideo}
              >
                <span className="control__button">
                  {isVideoOn && videoAvailable ? (
                    <VideoIcon size={20} />
                  ) : (
                    <VideoOffIcon size={20} />
                  )}
                </span>
                <span className="control__label">Video</span>
              </button>
              <button
                type="button"
                className="control__caret"
                aria-label="Video options"
                title="Video options"
                aria-expanded={triggerProps["aria-expanded"]}
                aria-haspopup={triggerProps["aria-haspopup"]}
                onClick={triggerProps.onToggle}
              >
                <ChevronUpIcon size={13} />
              </button>
            </>
          )}
        >
          {(close) => (
            <>
              <RoomMenuLabel>Camera</RoomMenuLabel>
              {devices.videoInputDevices.length === 0 ? (
                <div className="room-menu__empty">No camera detected</div>
              ) : (
                devices.videoInputDevices.map((device, index) => (
                  <RoomMenuItem
                    key={device.deviceId || index}
                    checked={device.deviceId === devices.selectedVideoInputId}
                    onSelect={() => {
                      devices.setVideoInput(device.deviceId);
                      close();
                    }}
                  >
                    {deviceName(device, index)}
                  </RoomMenuItem>
                ))
              )}
              <RoomMenuDivider />
              <RoomMenuItem
                icon={<SettingsIcon size={15} />}
                onSelect={() => {
                  close();
                  onOpenSettings("video");
                }}
              >
                Video settings…
              </RoomMenuItem>
            </>
          )}
        </RoomPopover>

        <button
          type="button"
          className={cx("control", participantsOpen && "control--active")}
          aria-pressed={participantsOpen}
          aria-label="Show participants"
          title="Participants"
          onClick={onToggleParticipants}
        >
          <span className="control__button">
            <UsersIcon size={20} />
          </span>
          <span className="control__label">Participants</span>
        </button>

        <RoomPopover
          label="Reactions"
          trigger={(triggerProps) => (
            <button
              type="button"
              className="control"
              aria-label="Open reactions"
              title="React"
              aria-expanded={triggerProps["aria-expanded"]}
              aria-haspopup={triggerProps["aria-haspopup"]}
              onClick={triggerProps.onToggle}
            >
              <span className="control__button">
                <SmileIcon size={20} />
              </span>
              <span className="control__label">React</span>
            </button>
          )}
        >
          {(close) => (
            <ReactionPicker
              onReact={(emoji) => {
                onReact(emoji);
                close();
              }}
            />
          )}
        </RoomPopover>

        <button
          type="button"
          className={cx("control", isScreenSharing && "control--active")}
          aria-pressed={isScreenSharing}
          aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
          title={
            canShare
              ? isScreenSharing
                ? "Stop sharing"
                : "Share screen"
              : "Screen sharing needs HTTPS or localhost"
          }
          disabled={!canShare}
          onClick={onToggleScreenShare}
        >
          <span className="control__button">
            {isScreenSharing ? (
              <ScreenShareOffIcon size={20} />
            ) : (
              <ScreenShareIcon size={20} />
            )}
          </span>
          <span className="control__label">
            {isScreenSharing ? "Stop Share" : "Share"}
          </span>
        </button>

        {isHost ? (
          <RoomPopover
            label="Host tools"
            trigger={(triggerProps) => (
              <button
                type="button"
                className="control"
                aria-label="Open host tools"
                title="Host Tools"
                aria-expanded={triggerProps["aria-expanded"]}
                aria-haspopup={triggerProps["aria-haspopup"]}
                onClick={triggerProps.onToggle}
              >
                <span className="control__button">
                  <ShieldIcon size={20} />
                </span>
                <span className="control__label">Host Tools</span>
              </button>
            )}
          >
            {(close) => (
              <>
                <RoomMenuLabel>Host controls</RoomMenuLabel>
                <RoomMenuItem
                  icon={<MicOffIcon size={15} />}
                  onSelect={() => {
                    close();
                    onMuteAll?.();
                  }}
                >
                  Mute everyone
                </RoomMenuItem>
                <RoomMenuItem
                  icon={<UsersIcon size={15} />}
                  onSelect={() => {
                    close();
                    onToggleParticipants();
                  }}
                >
                  Manage participants
                </RoomMenuItem>
                <RoomMenuDivider />
                <RoomMenuItem
                  danger
                  icon={<PhoneOffIcon size={15} />}
                  onSelect={() => {
                    close();
                    onEndMeeting?.();
                  }}
                >
                  End meeting for all
                </RoomMenuItem>
              </>
            )}
          </RoomPopover>
        ) : null}

        <RoomPopover
          label="More options"
          align="end"
          trigger={(triggerProps) => (
            <button
              type="button"
              className="control"
              aria-label="Open more options"
              title="More"
              aria-expanded={triggerProps["aria-expanded"]}
              aria-haspopup={triggerProps["aria-haspopup"]}
              onClick={triggerProps.onToggle}
            >
              <span className="control__button">
                <SettingsIcon size={20} />
              </span>
              <span className="control__label">More</span>
            </button>
          )}
        >
          {(close) => (
            <>
              <RoomMenuItem
                icon={<SettingsIcon size={15} />}
                onSelect={() => {
                  close();
                  onOpenSettings("general");
                }}
              >
                Settings…
              </RoomMenuItem>
              <RoomMenuItem
                icon={<KeyboardIcon size={15} />}
                onSelect={() => {
                  close();
                  onOpenSettings("general");
                }}
              >
                Keyboard shortcuts
              </RoomMenuItem>
              <RoomMenuDivider />
              <RoomMenuLabel>Layout</RoomMenuLabel>
              <RoomMenuItem
                icon={<AutoLayoutIcon size={15} />}
                checked={layout === "auto"}
                onSelect={() => onSetLayout("auto")}
              >
                Auto
              </RoomMenuItem>
              <RoomMenuItem
                icon={<GridViewIcon size={15} />}
                checked={layout === "gallery"}
                onSelect={() => onSetLayout("gallery")}
              >
                Gallery view
              </RoomMenuItem>
              <RoomMenuItem
                icon={<SpeakerViewIcon size={15} />}
                checked={layout === "speaker"}
                onSelect={() => onSetLayout("speaker")}
              >
                Speaker view
              </RoomMenuItem>
              <RoomMenuDivider />
              {fullscreenSupported ? (
                <RoomMenuItem
                  icon={
                    isFullscreen ? <MinimizeIcon size={15} /> : <MaximizeIcon size={15} />
                  }
                  onSelect={() => {
                    close();
                    onToggleFullscreen();
                  }}
                >
                  {isFullscreen ? "Exit full screen" : "Enter full screen"}
                </RoomMenuItem>
              ) : null}
              <RoomMenuItem icon={<CopyIcon size={15} />} onSelect={onCopyInvite}>
                Copy invite link
              </RoomMenuItem>
              <RoomMenuDivider />
              <RoomMenuItem danger onSelect={onLeave}>
                Leave meeting
              </RoomMenuItem>
            </>
          )}
        </RoomPopover>
      </div>

      <button
        type="button"
        className="control control--danger room__controls-end"
        aria-label="Leave meeting"
        title="Leave"
        onClick={onLeave}
      >
        <span className="control__button">
          <PhoneOffIcon size={20} />
        </span>
        <span className="control__label">End</span>
      </button>
    </div>
  );
}
