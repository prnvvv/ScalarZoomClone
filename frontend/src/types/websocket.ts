import type {
  ParticipantSummary,
  ParticipantPatch,
} from "./participant";

export type SignalPayload =
  | RTCSessionDescriptionInit
  | RTCIceCandidateInit
  | Record<string, unknown>;

/* ---------------------------------------------------------------
   Client -> server events
   --------------------------------------------------------------- */

export interface ClientJoinEvent {
  type: "join";
  meeting_id: string;
  participant_id?: number | null;
  display_name: string;
}

export interface ClientLeaveEvent {
  type: "leave";
  participant_id: number;
}

export interface ClientSignalEvent {
  type: "offer" | "answer" | "ice_candidate";
  sender_id: number;
  target_id: number;
  payload: SignalPayload;
}

export interface ClientMediaStateEvent {
  type: "media_state";
  participant_id: number;
  is_muted: boolean;
  is_video_on: boolean;
}

export interface ClientScreenShareEvent {
  type: "screen_share";
  participant_id: number;
  active: boolean;
}

export interface ClientMuteParticipantEvent {
  type: "mute_participant";
  participant_id: number;
  target_id: number;
}

export interface ClientRemoveParticipantEvent {
  type: "remove_participant";
  participant_id: number;
  target_id: number;
}

export interface ClientEndMeetingEvent {
  type: "end_meeting";
  participant_id: number;
}

export interface ClientMeetingStateEvent {
  type: "meeting_state";
  participant_id: number;
}

export interface ClientPingEvent {
  type: "ping";
}

export type ClientEvent =
  | ClientJoinEvent
  | ClientLeaveEvent
  | ClientSignalEvent
  | ClientMediaStateEvent
  | ClientScreenShareEvent
  | ClientMuteParticipantEvent
  | ClientRemoveParticipantEvent
  | ClientEndMeetingEvent
  | ClientMeetingStateEvent
  | ClientPingEvent;

/* ---------------------------------------------------------------
   Server -> client events
   --------------------------------------------------------------- */

export interface ServerJoinedEvent {
  type: "joined";
  meeting_id: string;
  participant_id: number;
  participants: ParticipantSummary[];
}

export interface ServerParticipantJoinedEvent {
  type: "participant_joined";
  participant: ParticipantSummary;
}

export interface ServerParticipantLeftEvent {
  type: "participant_left";
  participant_id: number;
}

export interface ServerSignalEvent {
  type: "offer" | "answer" | "ice_candidate";
  sender_id: number;
  target_id: number;
  payload: SignalPayload;
}

export interface ServerParticipantUpdatedEvent {
  type: "participant_updated";
  participant: ParticipantPatch;
}

export interface ServerMeetingStateEvent {
  type: "meeting_state";
  meeting_id: string;
  participant_id: number;
  is_host: boolean;
  participants: ParticipantSummary[];
  connected_participant_ids: number[];
}

export interface ServerHostActionEvent {
  type: "host_action";
  action: "mute" | "removed" | string;
  target_id: number;
}

export interface ServerMeetingEndedEvent {
  type: "meeting_ended";
  meeting_id: string;
}

export type WebSocketErrorCode =
  | "MEETING_NOT_FOUND"
  | "MEETING_ENDED"
  | "NOT_A_PARTICIPANT"
  | "NOT_HOST"
  | "TARGET_NOT_FOUND"
  | "INVALID_MESSAGE"
  | "UNAUTHORIZED_ACTION"
  | "INTERNAL_ERROR";

export interface ServerErrorEvent {
  type: "error";
  code: WebSocketErrorCode | string;
  message: string;
}

export interface ServerPongEvent {
  type: "pong";
}

export type ServerEvent =
  | ServerJoinedEvent
  | ServerParticipantJoinedEvent
  | ServerParticipantLeftEvent
  | ServerSignalEvent
  | ServerParticipantUpdatedEvent
  | ServerMeetingStateEvent
  | ServerHostActionEvent
  | ServerMeetingEndedEvent
  | ServerErrorEvent
  | ServerPongEvent;
