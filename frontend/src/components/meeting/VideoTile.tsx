import { useEffect, useRef, type ReactNode } from "react";
import { MicOffIcon, VideoOffIcon } from "@/components/icons";
import { cx, getInitials } from "@/lib/utils";

export interface VideoTileProps {
  name: string;
  isMuted?: boolean;
  isHost?: boolean;
  speaking?: boolean;
  /** Live WebRTC/local stream for this tile, if any. */
  stream?: MediaStream | null;
  /** When false the avatar placeholder is shown instead of the video. */
  isVideoOn?: boolean;
  /** Mute the <audio> of a local tile to avoid echo. */
  videoMuted?: boolean;
  /** Mirror the preview of the local camera (display-only). */
  mirrored?: boolean;
  /** `fill` crops to the tile, `fit` letterboxes the whole frame. */
  fit?: "fill" | "fit";
  /** This tile is showing a screen share (always letterboxed + badged). */
  isScreenShare?: boolean;
  /** Locally pinned participant. */
  isPinned?: boolean;
  /** Floating reactions currently shown above this tile. */
  reactions?: string[];
  /** Hover menu (pin / host actions) for this participant. */
  menu?: ReactNode;
  /** Extra classes for layout modifiers (e.g. featured/speaker tile). */
  className?: string;
  /** A custom node replaces the default video/placeholder rendering. */
  children?: ReactNode;
}

/** One participant on the room stage. */
export function VideoTile({
  name,
  isMuted = false,
  isHost = false,
  speaking = false,
  stream = null,
  isVideoOn = true,
  videoMuted = false,
  mirrored = false,
  fit = "fill",
  isScreenShare = false,
  isPinned = false,
  reactions = [],
  menu,
  className,
  children,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // A live screen share always renders, even when the camera itself is off.
  const showVideo = Boolean(stream) && (isVideoOn || isScreenShare);

  useEffect(() => {
    const element = videoRef.current;
    if (element) element.srcObject = showVideo ? stream : null;
  }, [stream, showVideo]);

  return (
    <div
      className={cx(
        "tile",
        speaking && "tile--speaking",
        isScreenShare && "tile--screen",
        isPinned && "tile--pinned",
        className
      )}
    >
      {children ??
        (showVideo ? (
          <video
            ref={videoRef}
            className={cx(
              "tile__video",
              mirrored && !isScreenShare && "tile__video--mirrored",
              fit === "fit" && "tile__video--contain"
            )}
            autoPlay
            playsInline
            muted={videoMuted}
          />
        ) : (
          <div className="tile__placeholder">
            <div className="tile__avatar">{getInitials(name)}</div>
            {!isVideoOn ? (
              <span className="tile__camera-off" aria-hidden="true">
                <VideoOffIcon size={16} />
              </span>
            ) : null}
          </div>
        ))}

      <div className="tile__badges tile__badges--top">
        {isHost ? <span className="tile__host">Host</span> : null}
        {isPinned ? (
          <span className="tile__pin" title="Pinned">
            Pinned
          </span>
        ) : null}
        {isScreenShare ? (
          <span className="tile__screen-badge">Presenting</span>
        ) : null}
      </div>

      {reactions.length > 0 ? (
        <div className="tile__reactions" aria-live="polite">
          {reactions.map((emoji, index) => (
            <span
              className="tile__reaction"
              key={`${emoji}-${index}`}
              role="img"
              aria-label={`${name} reacted ${emoji}`}
            >
              {emoji}
            </span>
          ))}
        </div>
      ) : null}

      <div className="tile__footer">
        <span className="tile__name">
          <span>{name}</span>
        </span>
        {isMuted ? (
          <span
            className="tile__status tile__status--muted"
            title="Muted"
            aria-label={`${name} is muted`}
          >
            <MicOffIcon size={14} />
          </span>
        ) : null}
      </div>

      {menu ? <div className="tile__menu">{menu}</div> : null}
    </div>
  );
}
