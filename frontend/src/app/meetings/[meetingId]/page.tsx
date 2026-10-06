"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useToast } from "@/components/common/ToastProvider";
import { AlertIcon, MicIcon, MicOffIcon, PinIcon, XIcon } from "@/components/icons";
import { ControlBar, type SettingsTab } from "@/components/meeting/ControlBar";
import { MeetingSettingsDialog } from "@/components/meeting/MeetingSettingsDialog";
import { MeetingTopBar } from "@/components/meeting/MeetingTopBar";
import { ParticipantGrid, type StageTile } from "@/components/meeting/ParticipantGrid";
import { ParticipantsPanel } from "@/components/meeting/ParticipantsPanel";
import { useActiveSpeakerId } from "@/hooks/useActiveSpeaker";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useMeeting } from "@/hooks/useMeeting";
import { useMeetingRoom } from "@/hooks/useMeetingRoom";
import {
  readPinnedParticipant,
  useRoomPreferences,
  writePinnedParticipant,
} from "@/hooks/useRoomPreferences";
import { STORAGE_KEYS } from "@/lib/constants";
import {
  buildInviteUrl,
  copyText,
  cx,
  formatDateShort,
  formatTime,
} from "@/lib/utils";
import type { ParticipantSummary } from "@/types/participant";

/** sessionStorage is not observable; re-read on any re-render instead. */
const subscribeToSessionName = () => () => {};

function connectionLabel(status: string): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "reconnecting":
      return "Reconnecting…";
    case "disconnected":
      return "Disconnected";
    default:
      return "Connecting…";
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

function RoomScreen({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="room room-loading">
      <div className="room-overlay-screen">
        <span className="room-overlay-screen__icon room-overlay-screen__icon--danger">
          <AlertIcon size={24} />
        </span>
        <div className="room-overlay-screen__title">{title}</div>
        <div className="room-overlay-screen__text">{body}</div>
        {children}
      </div>
    </div>
  );
}

export default function MeetingRoomPage() {
  const params = useParams<{ meetingId: string }>();
  const meetingId = params.meetingId;
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { meeting, participants, loading, error, notFound, refresh } =
    useMeetingRoom(meetingId);

  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [pinnedId, setPinnedId] = useState<number | null>(null);

  const prefs = useRoomPreferences();
  const {
    ref: roomRef,
    isFullscreen,
    supported: fullscreenSupported,
    toggle: toggleFullscreen,
  } = useFullscreen<HTMLDivElement>();

  const storedName = useSyncExternalStore(
    subscribeToSessionName,
    () => window.sessionStorage.getItem(STORAGE_KEYS.displayName) ?? "",
    () => ""
  );
  const localName = storedName || user?.name || "You";

  const session = useMeeting({ meeting, meetingId, displayName: localName });
  const settingsOpen = settingsTab !== null;

  // Restore the pinned participant once we are in the browser (deferred so
  // hydration sees the same value the server rendered).
  useEffect(() => {
    const stored = readPinnedParticipant(meetingId);
    if (stored === null) return;
    const timer = window.setTimeout(() => setPinnedId(stored), 0);
    return () => window.clearTimeout(timer);
  }, [meetingId]);

  const togglePin = useCallback(
    (participantId: number) => {
      setPinnedId((current) => {
        const next = current === participantId ? null : participantId;
        writePinnedParticipant(meetingId, next);
        return next;
      });
    },
    [meetingId]
  );

  const activeSpeakerId = useActiveSpeakerId({
    selfId: session.selfId,
    localStream: session.localStream,
    remoteStreams: session.remoteStreams,
  });

  const copyInvite = async () => {
    const ok = await copyText(buildInviteUrl(meetingId));
    toast(
      ok ? "Invite link copied" : "Could not copy the invite link",
      ok ? "success" : "error"
    );
  };

  const leaveRoom = () => {
    session.leave();
    router.push("/dashboard");
  };

  const openSettings = useCallback((tab: SettingsTab) => {
    setSettingsTab(tab);
    setPanelOpen(false);
  }, []);

  const toggleParticipants = useCallback(() => {
    setPanelOpen((open) => !open);
    setSettingsTab(null);
  }, []);

  const endMeetingForAll = session.endMeeting;
  const muteEveryone = session.muteAll;

  const endMeeting = useCallback(() => {
    setConfirmEnd(false);
    endMeetingForAll();
  }, [endMeetingForAll]);

  const muteAll = useCallback(() => {
    muteEveryone();
    toast("Asked everyone to mute", "success");
  }, [muteEveryone, toast]);

  // One overlay at a time; Escape closes whichever is open.
  useEffect(() => {
    if (!panelOpen && !settingsOpen && !confirmEnd) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPanelOpen(false);
      setSettingsTab(null);
      setConfirmEnd(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panelOpen, settingsOpen, confirmEnd]);

  // Room shortcuts: M mute, V video, P participants, F fullscreen.
  const joined = session.phase === "joined";
  const { toggleMute, toggleVideo } = session;
  useEffect(() => {
    if (!joined) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (settingsTab !== null || confirmEnd) return;
      const key = event.key.toLowerCase();
      if (key === "m") {
        event.preventDefault();
        toggleMute();
      } else if (key === "v") {
        event.preventDefault();
        toggleVideo();
      } else if (key === "p") {
        event.preventDefault();
        setPanelOpen((open) => !open);
      } else if (key === "f" && fullscreenSupported) {
        event.preventDefault();
        toggleFullscreen();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    joined,
    settingsTab,
    confirmEnd,
    toggleMute,
    toggleVideo,
    fullscreenSupported,
    toggleFullscreen,
  ]);

  const reactionsByParticipant = useMemo(() => {
    const grouped = new Map<number, string[]>();
    for (const reaction of session.reactions) {
      const list = grouped.get(reaction.participantId);
      if (list) {
        list.push(reaction.emoji);
      } else {
        grouped.set(reaction.participantId, [reaction.emoji]);
      }
    }
    return grouped;
  }, [session.reactions]);

  if (loading) {
    return (
      <div className="room room-loading">
        <span className="spinner" aria-hidden="true" />
        Loading meeting…
      </div>
    );
  }

  if (notFound) {
    return (
      <RoomScreen
        title="Meeting not found"
        body="We could not find that meeting. Check the link and try again."
      >
        <Link href="/dashboard" className="btn btn--primary">
          Back to dashboard
        </Link>
      </RoomScreen>
    );
  }

  if (error) {
    return (
      <RoomScreen title="Could not open the meeting" body={error}>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void refresh()}
        >
          Try again
        </button>
        <Link href="/dashboard" className="btn btn--ghost">
          Back to dashboard
        </Link>
      </RoomScreen>
    );
  }

  if (meeting && (meeting.status === "ended" || meeting.status === "cancelled")) {
    return (
      <RoomScreen
        title="This meeting has ended"
        body={`${meeting.title} is no longer running.`}
      >
        <Link href="/dashboard" className="btn btn--primary">
          Back to dashboard
        </Link>
      </RoomScreen>
    );
  }

  if (!meeting) {
    return null;
  }

  if (session.phase === "left") {
    return null;
  }

  if (session.phase === "ended") {
    return (
      <RoomScreen
        title="This meeting has ended"
        body="The meeting is no longer running."
      >
        <Link href="/dashboard" className="btn btn--primary">
          Back to dashboard
        </Link>
      </RoomScreen>
    );
  }

  if (session.phase === "removed") {
    return (
      <RoomScreen
        title="You were removed"
        body="The host removed you from this meeting."
      >
        <Link href="/dashboard" className="btn btn--primary">
          Back to dashboard
        </Link>
      </RoomScreen>
    );
  }

  if (session.phase === "rejected" || session.phase === "failed") {
    return (
      <RoomScreen
        title="Could not join the meeting"
        body={
          session.failure ?? "Something went wrong while joining the meeting."
        }
      >
        <button
          type="button"
          className="btn btn--primary"
          onClick={session.retry}
        >
          Try again
        </button>
        <Link href="/dashboard" className="btn btn--ghost">
          Back to dashboard
        </Link>
      </RoomScreen>
    );
  }

  if (
    session.phase === "joining" &&
    session.connection === "disconnected"
  ) {
    return (
      <RoomScreen
        title="Could not connect"
        body="The meeting service is unreachable. Check your connection and try again."
      >
        <button
          type="button"
          className="btn btn--primary"
          onClick={session.retry}
        >
          Try again
        </button>
        <Link href="/dashboard" className="btn btn--ghost">
          Back to dashboard
        </Link>
      </RoomScreen>
    );
  }

  // Host status comes from the server once joined; the local user id is only
  // a pre-join hint.
  const isLocalHost = session.phase === "joined" && session.isHost;
  const roster: ParticipantSummary[] =
    session.phase === "joined" ? session.participants : participants;
  const others = roster.filter((participant) => {
    if (session.selfId !== null) return participant.id !== session.selfId;
    return participant.display_name !== localName;
  });
  const scheduledNotice = meeting.status === "scheduled";
  const connectionLost =
    session.phase === "joined" && session.connection === "disconnected";

  const selfKey = session.selfId ?? -1;
  const tiles: StageTile[] = [
    {
      id: selfKey,
      name: localName,
      isMuted: session.isMuted,
      isHost: isLocalHost,
      isVideoOn: session.isVideoOn,
      isScreenShare: session.isScreenSharing ?? false,
      stream: session.isScreenSharing
        ? (session.screenShareStream ?? session.localStream)
        : session.localStream,
      reactions: reactionsByParticipant.get(selfKey) ?? [],
      isSelf: true,
    },
    ...others.map((participant) => ({
      id: participant.id,
      name: participant.display_name,
      isMuted: participant.is_muted,
      isHost: participant.is_host,
      isVideoOn: participant.is_video_on,
      isScreenShare: participant.screen_share ?? false,
      stream: session.remoteStreams[participant.id] ?? null,
      reactions: reactionsByParticipant.get(participant.id) ?? [],
      isSelf: false,
    })),
  ];

  const renderTileMenu = (tile: StageTile) => (
    <div className="tile__menu-actions">
      <button
        type="button"
        className="tile__menu-button"
        aria-pressed={pinnedId === tile.id}
        aria-label={
          pinnedId === tile.id
            ? `Unpin ${tile.name}`
            : `Pin ${tile.name} to the stage`
        }
        onClick={() => togglePin(tile.id)}
      >
        <PinIcon size={15} />
        {pinnedId === tile.id ? "Unpin" : "Pin"}
      </button>
      {session.isHost && !tile.isSelf ? (
        <>
          <button
            type="button"
            className="tile__menu-button"
            aria-label={
              tile.isMuted
                ? `Ask ${tile.name} to unmute`
                : `Mute ${tile.name}`
            }
            onClick={() => session.muteParticipant(tile.id, !tile.isMuted)}
          >
            {tile.isMuted ? <MicIcon size={15} /> : <MicOffIcon size={15} />}
            {tile.isMuted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            className="tile__menu-button tile__menu-button--danger"
            aria-label={`Remove ${tile.name} from the meeting`}
            onClick={() => session.removeParticipant(tile.id)}
          >
            <XIcon size={15} />
            Remove
          </button>
        </>
      ) : null}
    </div>
  );

  return (
    <div className={cx("room", panelOpen && "room--panel")} ref={roomRef}>
      <span className="visually-hidden" role="status" aria-live="polite">
        {`${connectionLabel(session.connection)}. ${roster.length} in the meeting.`}
      </span>

      <MeetingTopBar
        title={meeting.title}
        meetingId={meeting.meeting_id}
        connection={session.connection}
        participantCount={roster.length}
        isLive={meeting.status === "active"}
        participantsOpen={panelOpen}
        isFullscreen={isFullscreen}
        fullscreenSupported={fullscreenSupported}
        onToggleParticipants={toggleParticipants}
        onCopyInvite={() => void copyInvite()}
        onToggleFullscreen={toggleFullscreen}
      />

      {scheduledNotice ? (
        <div className="room-notice">
          <AlertIcon size={16} />
          Scheduled for {formatDateShort(meeting.start_time)} at{" "}
          {formatTime(meeting.start_time)}
        </div>
      ) : null}

      {connectionLost ? (
        <div className="room-notice room-notice--error">
          <AlertIcon size={16} />
          Connection lost.
          <button
            type="button"
            className="room__chip room-notice__action"
            onClick={session.reconnect}
          >
            Reconnect
          </button>
        </div>
      ) : null}

      {session.mediaError ? (
        <div className="room-notice">
          <AlertIcon size={16} />
          {session.mediaError}
        </div>
      ) : null}

      <main className="room__stage">
        <ParticipantGrid
          tiles={tiles}
          layout={prefs.preferences.layout}
          screenLayout={prefs.preferences.screenLayout}
          activeSpeakerId={activeSpeakerId}
          pinnedId={pinnedId}
          mirroredSelf={prefs.preferences.mirrorSelf}
          videoFit={prefs.preferences.videoFit}
          renderMenu={renderTileMenu}
        />
      </main>

      <ControlBar
        isMuted={session.isMuted}
        isVideoOn={session.isVideoOn}
        audioAvailable={session.audioAvailable}
        videoAvailable={session.videoAvailable}
        participantsOpen={panelOpen}
        isScreenSharing={session.isScreenSharing}
        isHost={session.isHost}
        layout={prefs.preferences.layout}
        isFullscreen={isFullscreen}
        fullscreenSupported={fullscreenSupported}
        devices={session.devices}
        onToggleMute={session.toggleMute}
        onToggleVideo={session.toggleVideo}
        onToggleParticipants={toggleParticipants}
        onToggleScreenShare={session.toggleScreenShare}
        onReact={session.sendReaction}
        onSetLayout={prefs.setLayout}
        onOpenSettings={openSettings}
        onToggleFullscreen={toggleFullscreen}
        onCopyInvite={() => void copyInvite()}
        onMuteAll={session.isHost ? muteAll : undefined}
        onEndMeeting={session.isHost ? () => setConfirmEnd(true) : undefined}
        onLeave={leaveRoom}
      />

      <MeetingSettingsDialog
        open={settingsOpen}
        tab={settingsTab ?? "general"}
        onTabChange={setSettingsTab}
        devices={session.devices}
        preferences={prefs.preferences}
        localStream={session.localStream}
        isFullscreen={isFullscreen}
        fullscreenSupported={fullscreenSupported}
        onSetLayout={prefs.setLayout}
        onSetScreenLayout={prefs.setScreenLayout}
        onSetMirrorSelf={prefs.setMirrorSelf}
        onSetVideoFit={prefs.setVideoFit}
        onToggleFullscreen={toggleFullscreen}
        onClose={() => setSettingsTab(null)}
      />

      {panelOpen ? (
        <>
          <div
            className="room-panel__backdrop"
            onClick={() => setPanelOpen(false)}
            aria-hidden="true"
          />
          <ParticipantsPanel
            participants={roster}
            meetingId={meetingId}
            localName={localName}
            isHost={session.isHost}
            selfId={session.selfId}
            pinnedId={pinnedId}
            onTogglePin={togglePin}
            onClose={() => setPanelOpen(false)}
            onMuteParticipant={
              session.isHost ? session.muteParticipant : undefined
            }
            onRemoveParticipant={
              session.isHost ? session.removeParticipant : undefined
            }
            onMuteAll={session.isHost ? muteAll : undefined}
            onEndMeeting={session.isHost ? () => setConfirmEnd(true) : undefined}
          />
        </>
      ) : null}

      <ConfirmDialog
        open={confirmEnd}
        title="End meeting for everyone?"
        message="Every participant will be disconnected. This cannot be undone."
        confirmLabel="End meeting"
        destructive
        onConfirm={endMeeting}
        onCancel={() => setConfirmEnd(false)}
      />
    </div>
  );
}
