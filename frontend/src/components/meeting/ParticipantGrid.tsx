"use client";

import { useMemo, useState, type ReactNode } from "react";
import { VideoTile } from "@/components/meeting/VideoTile";
import { useElementSize } from "@/hooks/useElementSize";
import type {
  RoomLayoutMode,
  ScreenShareLayoutMode,
} from "@/hooks/useRoomPreferences";
import { fitGrid, lastRowStart, pageSlice } from "@/lib/gridLayout";
import { cx } from "@/lib/utils";

export interface StageTile {
  id: number;
  name: string;
  isMuted: boolean;
  isHost: boolean;
  isVideoOn: boolean;
  /** This participant's video track currently carries their screen. */
  isScreenShare: boolean;
  stream: MediaStream | null;
  reactions: string[];
  isSelf: boolean;
}

interface ParticipantGridProps {
  tiles: StageTile[];
  layout: RoomLayoutMode;
  screenLayout: ScreenShareLayoutMode;
  activeSpeakerId: number | null;
  pinnedId: number | null;
  mirroredSelf: boolean;
  videoFit: "fill" | "fit";
  /** Hover menu rendered inside each tile. */
  renderMenu?: (tile: StageTile) => ReactNode;
}

function pickMain(
  tiles: StageTile[],
  mode: "share" | "speaker",
  activeSpeakerId: number | null,
  pinnedId: number | null
): StageTile | null {
  if (mode === "share") {
    return tiles.find((tile) => tile.isScreenShare) ?? null;
  }
  if (pinnedId !== null) {
    const pinned = tiles.find((tile) => tile.id === pinnedId);
    if (pinned) return pinned;
  }
  if (activeSpeakerId !== null) {
    const speaker = tiles.find((tile) => tile.id === activeSpeakerId);
    if (speaker) return speaker;
  }
  return tiles.find((tile) => !tile.isSelf) ?? tiles[0] ?? null;
}

/**
 * The meeting stage: gallery grid, speaker view or screen-share focus view.
 * Every mode re-fits from the measured stage size, so tiles never overlap the
 * toolbar and never overflow the viewport.
 */
export function ParticipantGrid({
  tiles,
  layout,
  screenLayout,
  activeSpeakerId,
  pinnedId,
  mirroredSelf,
  videoFit,
  renderMenu,
}: ParticipantGridProps) {
  const [stageRef, size] = useElementSize<HTMLDivElement>();
  const [page, setPage] = useState(0);

  const sharing = useMemo(
    () => tiles.find((tile) => tile.isScreenShare) ?? null,
    [tiles]
  );

  const mode: "gallery" | "speaker" | "focus" = useMemo(() => {
    if (layout === "gallery") return "gallery";
    if (layout === "speaker") return "speaker";
    // auto
    if (sharing && screenLayout === "focus") return "focus";
    if (pinnedId !== null && tiles.some((tile) => tile.id === pinnedId)) {
      return "speaker";
    }
    if (activeSpeakerId !== null && tiles.length > 1) return "speaker";
    return "gallery";
  }, [layout, screenLayout, sharing, pinnedId, activeSpeakerId, tiles]);

  const focused =
    mode === "focus"
      ? pickMain(tiles, "share", activeSpeakerId, pinnedId)
      : mode === "speaker"
        ? pickMain(tiles, "speaker", activeSpeakerId, pinnedId)
        : null;
  const focusedId = focused?.id ?? null;
  const filmstrip = focused ? tiles.filter((tile) => tile.id !== focusedId) : tiles;

  const fit = useMemo(
    () => fitGrid(tiles.length, size.width, size.height),
    [tiles.length, size.width, size.height]
  );

  // The page index is clamped on read, so shrinking tile counts can never
  // leave the grid pointing past the last page.
  const safePage = Math.min(page, Math.max(0, fit.pageCount - 1));
  const { visible } = pageSlice(tiles, safePage, fit);
  const centerStart = lastRowStart(visible.length, fit.columns);

  const renderTile = (tile: StageTile, extraClass?: string) => (
    <VideoTile
      key={tile.id}
      name={tile.isSelf ? `${tile.name} (You)` : tile.name}
      isMuted={tile.isMuted}
      isHost={tile.isHost}
      speaking={!tile.isScreenShare && tile.id === activeSpeakerId}
      stream={tile.stream}
      isVideoOn={tile.isVideoOn}
      videoMuted={tile.isSelf}
      mirrored={tile.isSelf && mirroredSelf && !tile.isScreenShare}
      fit={tile.isScreenShare ? "fit" : videoFit}
      isScreenShare={tile.isScreenShare}
      isPinned={tile.id === pinnedId}
      reactions={tile.reactions}
      menu={renderMenu?.(tile)}
      className={extraClass}
    />
  );

  if (tiles.length === 0) {
    return (
      <div className="stage stage--empty" ref={stageRef}>
        <div className="stage__empty">
          <div className="stage__empty-title">Waiting for others…</div>
          <div className="stage__empty-text">
            Share your invite link so people can join this meeting.
          </div>
        </div>
      </div>
    );
  }

  if (focused) {
    const stripVertical = size.width >= 900;
    return (
      <div
        className={cx(
          "stage stage--focus",
          stripVertical ? "stage--focus-side" : "stage--focus-bottom"
        )}
        ref={stageRef}
      >
        <div className="stage__main">{renderTile(focused, "tile--featured")}</div>
        {filmstrip.length > 0 ? (
          <div className="stage__filmstrip" role="list">
            {filmstrip.map((tile) => renderTile(tile))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="stage" ref={stageRef}>
      <div
        className="stage__grid"
        style={{
          gridTemplateColumns: `repeat(${fit.columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${fit.rows}, minmax(0, 1fr))`,
        }}
      >
        {visible.map((tile, index) => {
          const remainder = visible.length % fit.columns;
          const lastRowOffset = visible.length - remainder;
          const style =
            remainder !== 0 && index >= lastRowOffset
              ? { gridColumnStart: centerStart + (index - lastRowOffset) }
              : undefined;
          return (
            <div key={tile.id} className="stage__cell" style={style}>
              {renderTile(tile)}
            </div>
          );
        })}
      </div>

      {fit.pageCount > 1 ? (
        <div className="stage__pager">
          <button
            type="button"
            className="stage__pager-button"
            aria-label="Previous page of participants"
            disabled={safePage === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            ‹
          </button>
          <span className="stage__pager-label">
            {safePage + 1} / {fit.pageCount}
          </span>
          <button
            type="button"
            className="stage__pager-button"
            aria-label="Next page of participants"
            disabled={safePage >= fit.pageCount - 1}
            onClick={() => setPage((current) => current + 1)}
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
