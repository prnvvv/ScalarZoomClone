import { MicOffIcon } from "@/components/icons";
import { cx, getInitials } from "@/lib/utils";

interface VideoTileProps {
  name: string;
  isMuted?: boolean;
  isHost?: boolean;
  speaking?: boolean;
  /** A <video> element (or preview) replaces the avatar placeholder. */
  children?: React.ReactNode;
}

/** One participant on the room stage. */
export function VideoTile({
  name,
  isMuted = false,
  isHost = false,
  speaking = false,
  children,
}: VideoTileProps) {
  return (
    <div className={cx("tile", speaking && "tile--speaking")}>
      {children ?? (
        <div className="tile__placeholder">
          <div className="tile__avatar">{getInitials(name)}</div>
        </div>
      )}

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
