export interface Participant {
  id: number;
  meeting_id: string;
  user_id: number | null;
  display_name: string;
  is_host: boolean;
  is_muted: boolean;
  is_video_on: boolean;
  joined_at: string;
  left_at: string | null;
}

export interface ParticipantSummary {
  id: number;
  display_name: string;
  is_host: boolean;
  is_muted: boolean;
  is_video_on: boolean;
  screen_share?: boolean;
}

export interface ParticipantCreatePayload {
  display_name: string;
  user_id?: number | null;
  is_muted?: boolean;
  is_video_on?: boolean;
}

/** Partial update broadcast as `participant_updated`. */
export interface ParticipantPatch {
  id: number;
  display_name?: string;
  is_host?: boolean;
  is_muted?: boolean;
  is_video_on?: boolean;
  screen_share?: boolean;
}

export type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";
