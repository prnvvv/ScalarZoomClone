"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useToast } from "@/components/common/ToastProvider";
import { AlertIcon, CopyIcon, UserIcon } from "@/components/icons";
import { ControlBar } from "@/components/meeting/ControlBar";
import { DeviceSelector } from "@/components/meeting/DeviceSelector";
import { ParticipantsPanel } from "@/components/meeting/ParticipantsPanel";
import { VideoTile } from "@/components/meeting/VideoTile";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMeeting } from "@/hooks/useMeeting";
import { useMeetingRoom } from "@/hooks/useMeetingRoom";
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

function gridCountClass(count: number): string {
  if (count <= 1) return "room__grid--count-1";
  if (count === 2) return "room__grid--count-2";
  if (count === 3) return "room__grid--count-3";
  if (count === 4) return "room__grid--count-4";
  return "room__grid--count-5plus";
}

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const storedName = useSyncExternalStore(
    subscribeToSessionName,
    () => window.sessionStorage.getItem(STORAGE_KEYS.displayName) ?? "",
    () => ""
  );
  const localName = storedName || user?.name || "You";

  const session = useMeeting({ meeting, meetingId, displayName: localName });

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

  const openSettings = () => {
    setSettingsOpen((open) => !open);
    setPanelOpen(false);
  };

  const toggleParticipants = () => {
    setPanelOpen((open) => !open);
    setSettingsOpen(false);
  };

  // One overlay at a time; Escape closes whichever is open.
  useEffect(() => {
    if (!panelOpen && !settingsOpen && !confirmEnd) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPanelOpen(false);
      setSettingsOpen(false);
      setConfirmEnd(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panelOpen, settingsOpen, confirmEnd]);

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
  const tileCount = 1 + others.length;
  const scheduledNotice = meeting.status === "scheduled";
  const connectionLost =
    session.phase === "joined" && session.connection === "disconnected";

  return (
    <div className="room">
      <span className="visually-hidden" role="status" aria-live="polite">
        {`${connectionLabel(session.connection)}. ${participants.length} in the meeting.`}
      </span>

      <header className="room__header">
        <div className="room__heading">
          <div className="room__title">{meeting.title}</div>
          <div className="room__subtitle">
            <span className="room__id">{meeting.meeting_id}</span>
            <span>
              {formatDateShort(meeting.start_time)} ·{" "}
              {formatTime(meeting.start_time)}
            </span>
            <span
              className={cx(
                "room__connection",
                session.connection === "reconnecting" &&
                  "room__connection--reconnecting",
                session.connection === "disconnected" &&
                  "room__connection--failed"
              )}
            >
              {connectionLabel(session.connection)}
            </span>
          </div>
        </div>
        <div className="room__header-actions">
          {meeting.status === "active" ? (
            <span className="room__chip room__chip--live">Live</span>
          ) : null}
          <button
            type="button"
            className="room__chip room__chip--hide-mobile"
            onClick={() => void copyInvite()}
            aria-label="Copy invite link"
          >
            <CopyIcon size={14} />
            Copy invite
          </button>
        </div>
      </header>

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
        <div className={cx("room__grid", gridCountClass(tileCount))}>
          <VideoTile
            name={`${localName} (You)`}
            isMuted={session.isMuted}
            isHost={isLocalHost}
            stream={session.localStream}
            isVideoOn={session.isVideoOn}
            videoMuted
          />

          {others.map((participant) => (
            <VideoTile
              key={participant.id}
              name={participant.display_name}
              isMuted={participant.is_muted}
              isHost={participant.is_host}
              stream={session.remoteStreams[participant.id]}
              isVideoOn={participant.is_video_on}
            />
          ))}

          {others.length === 0 ? (
            <div className="tile">
              <div className="tile__placeholder">
                <div className="tile__avatar">
                  <UserIcon size={24} />
                </div>
              </div>
              <span className="tile__name">Waiting for others…</span>
            </div>
          ) : null}
        </div>
      </main>

      <ControlBar
        isMuted={session.isMuted}
        isVideoOn={session.isVideoOn}
        participantsOpen={panelOpen}
        settingsOpen={settingsOpen}
        onToggleMute={session.toggleMute}
        onToggleVideo={session.toggleVideo}
        onToggleParticipants={toggleParticipants}
        onToggleSettings={openSettings}
        onLeave={leaveRoom}
      />

      {settingsOpen ? (
        <>
          <div
            className="room-panel__backdrop"
            onClick={() => setSettingsOpen(false)}
            aria-hidden="true"
          />
          <div
            className="room-settings"
            role="dialog"
            aria-label="Meeting settings"
          >
            <h2 className="room-settings__title">Audio and video</h2>
            <DeviceSelector
              audioInputDevices={session.devices.audioInputDevices}
              videoInputDevices={session.devices.videoInputDevices}
              audioOutputDevices={session.devices.audioOutputDevices}
              selectedAudioInputId={session.devices.selectedAudioInputId}
              selectedVideoInputId={session.devices.selectedVideoInputId}
              selectedAudioOutputId={session.devices.selectedAudioOutputId}
              canSelectSpeaker={session.devices.canSelectSpeaker}
              disabled={session.phase !== "joined"}
              onAudioInputChange={session.devices.setAudioInput}
              onVideoInputChange={session.devices.setVideoInput}
              onAudioOutputChange={session.devices.setAudioOutput}
            />
            <p className="room-settings__hint">
              {session.phase === "joined"
                ? "Changes apply to everyone in the meeting."
                : "Devices unlock once you are connected to the meeting."}
            </p>
          </div>
        </>
      ) : null}

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
