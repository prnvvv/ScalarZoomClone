import { useEffect, useRef } from "react";
import { MicOffIcon } from "@/components/icons";
import { cx, getInitials } from "@/lib/utils";

interface VideoTileProps {
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
  /** A custom node replaces the default video/placeholder rendering. */
  children?: React.ReactNode;
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
  children,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const showVideo = Boolean(stream) && isVideoOn;

  useEffect(() => {
    const element = videoRef.current;
    if (element) element.srcObject = showVideo ? stream : null;
  }, [stream, showVideo]);

  return (
    <div className={cx("tile", speaking && "tile--speaking")}>
      {children ?? (showVideo ? (
        <video
          ref={videoRef}
          className="tile__video"
          autoPlay
          playsInline
          muted={videoMuted}
        />
      ) : (
        <div className="tile__placeholder">
          <div className="tile__avatar">{getInitials(name)}</div>
        </div>
      ))}

      {isHost ? <span className="tile__host">Host</span> : null}

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
  );
}
