"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toUserMessage } from "@/lib/api-client";
import { STORAGE_KEYS } from "@/lib/constants";
import { joinMeeting } from "@/services/meetingService";
import { useMediaDevices } from "@/hooks/useMediaDevices";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Meeting } from "@/types/meeting";
import type { ParticipantSummary } from "@/types/participant";
import type { ClientMessage, ServerMessage } from "@/types/realtime";
import { wsErrorCopy } from "@/types/realtime";

export type MeetingPhase =
  | "preparing"
  | "joining"
  | "joined"
  | "rejected"
  | "failed"
  | "ended"
  | "removed"
  | "left";

interface UseMeetingOptions {
  meeting: Meeting | null;
  meetingId: string;
  displayName: string;
}

export interface MeetingDeviceSettings {
  audioInputDevices: MediaDeviceInfo[];
  videoInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  selectedAudioInputId: string | null;
  selectedVideoInputId: string | null;
  selectedAudioOutputId: string | null;
  canSelectSpeaker: boolean;
  refreshDevices: () => Promise<void>;
  setAudioInput: (deviceId: string) => void;
  setVideoInput: (deviceId: string) => void;
  setAudioOutput: (deviceId: string) => void;
}

export interface MeetingSession {
  phase: MeetingPhase;
  /** Failure copy for `rejected` / `failed` phases. */
  failure: string | null;
  connection: "connecting" | "connected" | "reconnecting" | "disconnected";
  isHost: boolean;
  selfId: number | null;
  participants: ParticipantSummary[];
  localStream: MediaStream | null;
  /** Remote participants' live streams, keyed by participant id. */
  remoteStreams: Record<number, MediaStream>;
  isMuted: boolean;
  isVideoOn: boolean;
  mediaError: string | null;
  devices: MeetingDeviceSettings;
  toggleMute: () => void;
  toggleVideo: () => void;
  /** Host-only; a no-op for anyone the server did not mark as host. */
  muteParticipant: (targetId: number, muted: boolean) => void;
  removeParticipant: (targetId: number) => void;
  muteAll: () => void;
  endMeeting: () => void;
  leave: () => void;
  retry: () => void;
  reconnect: () => void;
}

/**
 * Owns the meeting session: REST validation, the signaling socket, local
 * media and the WebRTC mesh. The server is authoritative for host status,
 * membership and meeting state — this hook never invents them.
 */
export function useMeeting({
  meeting,
  meetingId,
  displayName,
}: UseMeetingOptions): MeetingSession {
  const [phase, setPhase] = useState<MeetingPhase>("preparing");
  const [failure, setFailure] = useState<string | null>(null);
  const [selfId, setSelfId] = useState<number | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState<ParticipantSummary[]>([]);

  const phaseRef = useRef(phase);
  const nameRef = useRef(displayName);
  const selfIdRef = useRef(selfId);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    selfIdRef.current = selfId;
  }, [selfId]);

  const media = useMediaDevices();

  const sendRef = useRef<(message: ClientMessage) => void>(() => undefined);
  const send = useCallback((message: ClientMessage) => {
    sendRef.current(message);
  }, []);

  const rtc = useWebRTC({
    selfId,
    localStream: media.stream,
    send,
  });
  const rtcRef = useRef(rtc);
  useEffect(() => {
    rtcRef.current = rtc;
  }, [rtc]);

  const handleServerError = useCallback(
    (code: Parameters<typeof wsErrorCopy>[0]) => {
      if (code === "MEETING_ENDED") {
        setPhase("ended");
        media.stop();
        return;
      }
      if (code === "MEETING_NOT_FOUND") {
        setFailure(wsErrorCopy(code));
        setPhase("rejected");
        return;
      }
      const beforeJoin =
        phaseRef.current === "preparing" ||
        phaseRef.current === "joining";
      if (
        beforeJoin ||
        code === "NOT_A_PARTICIPANT" ||
        code === "UNAUTHORIZED_ACTION" ||
        code === "INTERNAL_ERROR"
      ) {
        setFailure(wsErrorCopy(code));
        setPhase("failed");
      }
      // NOT_HOST / TARGET_NOT_FOUND / INVALID_MESSAGE are action-scoped
      // failures; the room stays usable.
    },
    [media.stop]
  );

  const handleMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case "joined": {
          window.sessionStorage.setItem(
            STORAGE_KEYS.participantId(meetingId),
            String(message.participant_id)
          );
          setSelfId(message.participant_id);
          setParticipants(message.participants);
          setPhase("joined");
          rtcRef.current.resetPeers();
          send({
            type: "meeting_state",
            participant_id: message.participant_id,
          });
          break;
        }
        case "participant_joined":
          setParticipants((list) => {
            if (list.some((p) => p.id === message.participant.id)) return list;
            return [...list, message.participant];
          });
          rtcRef.current.syncPeers([message.participant.id]);
          break;
        case "participant_left":
          setParticipants((list) =>
            list.filter((p) => p.id !== message.participant_id)
          );
          rtcRef.current.closePeer(message.participant_id);
          break;
        case "participant_updated":
          setParticipants((list) =>
            list.map((p) =>
              p.id === message.participant.id
                ? { ...p, ...message.participant }
                : p
            )
          );
          break;
        case "meeting_state":
          setParticipants(message.participants);
          setIsHost(message.is_host);
          rtcRef.current.syncPeers(message.connected_participant_ids);
          break;
        case "offer":
        case "answer":
        case "ice_candidate":
          void rtcRef.current.handleSignal(message).catch(() => undefined);
          break;
        case "host_action": {
          if (message.target_id !== selfIdRef.current) break;
          if (message.action === "mute") media.setMuted(true);
          else if (message.action === "unmute") media.setMuted(false);
          else {
            setFailure(null);
            setPhase("removed");
            media.stop();
          }
          break;
        }
        case "meeting_ended":
          setFailure(null);
          setPhase("ended");
          media.stop();
          break;
        case "error":
          handleServerError(message.code);
          break;
        case "pong":
        default:
          break;
      }
    },
    [meetingId, send, handleServerError, media]
  );

  const ws = useWebSocket({
    meetingId,
    enabled: phase === "joining" || phase === "joined",
    onMessage: handleMessage,
  });

  useEffect(() => {
    sendRef.current = ws.send;
  }, [ws.send]);

  // Phase 1: validate over REST, acquire media, then enable the socket.
  useEffect(() => {
    if (!meeting || phase !== "preparing") return;
    let active = true;
    nameRef.current = displayName;
    void (async () => {
      try {
        await joinMeeting(meetingId, { display_name: displayName });
      } catch (cause: unknown) {
        if (!active) return;
        setFailure(toUserMessage(cause));
        const status = (cause as { status?: number }).status;
        setPhase(status === 404 || status === 409 ? "rejected" : "failed");
        return;
      }
      await media.acquire();
      if (!active) return;
      setPhase("joining");
    })();
    return () => {
      active = false;
    };
  }, [meeting, phase, meetingId, displayName, media]);

  // Phase 2: every time the socket opens (first connect or after a
  // reconnect), join and re-bind our participant row.
  useEffect(() => {
    if (ws.status !== "connected") return;
    if (phase !== "joining" && phase !== "joined") return;
    const stored = window.sessionStorage.getItem(
      STORAGE_KEYS.participantId(meetingId)
    );
    const participantId = stored ? Number(stored) : null;
    send({
      type: "join",
      meeting_id: meetingId,
      participant_id: participantId && participantId > 0 ? participantId : null,
      display_name: nameRef.current,
    });
  }, [ws.status, phase, meetingId, send]);

  // Report actual media state whenever it changes or the room is rejoined.
  useEffect(() => {
    if (phase !== "joined" || ws.status !== "connected" || selfId === null) {
      return;
    }
    send({
      type: "media_state",
      participant_id: selfId,
      is_muted: media.isMuted,
      is_video_on: media.isVideoOn,
    });
  }, [phase, ws.status, selfId, media.isMuted, media.isVideoOn, send]);

  const toggleMute = useCallback(() => {
    media.setMuted(!media.isMuted);
  }, [media]);

  const toggleVideo = useCallback(() => {
    media.setVideoOn(!media.isVideoOn);
  }, [media]);

  // Host actions. The server still validates `is_host`; guarding here only
  // avoids emitting messages the server would reject.
  const muteParticipant = useCallback(
    (targetId: number, muted: boolean) => {
      const me = selfIdRef.current;
      if (!isHost || me === null || phase !== "joined") return;
      if (targetId === me) return;
      send({
        type: "mute_participant",
        participant_id: me,
        target_id: targetId,
        is_muted: muted,
      });
    },
    [isHost, phase, send]
  );

  const removeParticipant = useCallback(
    (targetId: number) => {
      const me = selfIdRef.current;
      if (!isHost || me === null || phase !== "joined") return;
      if (targetId === me) return;
      send({
        type: "remove_participant",
        participant_id: me,
        target_id: targetId,
      });
    },
    [isHost, phase, send]
  );

  const muteAll = useCallback(() => {
    const me = selfIdRef.current;
    if (!isHost || me === null || phase !== "joined") return;
    for (const participant of participants) {
      if (participant.id === me || participant.is_muted) continue;
      send({
        type: "mute_participant",
        participant_id: me,
        target_id: participant.id,
        is_muted: true,
      });
    }
  }, [isHost, participants, phase, send]);

  const endMeeting = useCallback(() => {
    const me = selfIdRef.current;
    if (!isHost || me === null || phase !== "joined") return;
    send({ type: "end_meeting", participant_id: me });
  }, [isHost, phase, send]);

  const leave = useCallback(() => {
    if (selfId !== null && (phase === "joining" || phase === "joined")) {
      send({ type: "leave", participant_id: selfId });
    }
    setPhase("left");
    media.stop();
  }, [selfId, phase, send, media]);

  const retry = useCallback(() => {
    setFailure(null);
    setSelfId(null);
    setIsHost(false);
    setParticipants([]);
    setPhase("preparing");
  }, []);

  useEffect(() => {
    const stop = media.stop;
    return () => stop();
  }, [media.stop]);

  return {
    phase,
    failure,
    connection: ws.status,
    isHost,
    selfId,
    participants,
    localStream: media.stream,
    remoteStreams: rtc.remoteStreams,
    isMuted: media.isMuted,
    isVideoOn: media.isVideoOn,
    mediaError: media.error,
    devices: {
      audioInputDevices: media.audioInputDevices,
      videoInputDevices: media.videoInputDevices,
      audioOutputDevices: media.audioOutputDevices,
      selectedAudioInputId: media.selectedAudioInputId,
      selectedVideoInputId: media.selectedVideoInputId,
      selectedAudioOutputId: media.selectedAudioOutputId,
      canSelectSpeaker: media.canSelectSpeaker,
      refreshDevices: media.refreshDevices,
      setAudioInput: media.setAudioInput,
      setVideoInput: media.setVideoInput,
      setAudioOutput: media.setAudioOutput,
    },
    toggleMute,
    toggleVideo,
    muteParticipant,
    removeParticipant,
    muteAll,
    endMeeting,
    leave,
    retry,
    reconnect: ws.reconnect,
  };
}
