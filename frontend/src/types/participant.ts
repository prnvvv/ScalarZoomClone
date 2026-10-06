/**
 * Persisted participant row, as returned by
 * `GET /api/meetings/{meeting_id}/participants`
 * (mirrors `backend/app/schemas/participant.py::ParticipantOut`).
 */
export interface Participant {
  id: number;
  /**
   * Internal `meetings.id` foreign key — an integer, *not* the public
   * nine-digit `meeting_id` string shown to users.
   */
  meeting_id: number;
  /** Kept for contract compatibility; the backend has no user column yet. */
  user_id: number | null;
  display_name: string;
  is_host: boolean;
  is_muted: boolean;
  is_video_on: boolean;
  joined_at: string | null;
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

/**
 * Body for `POST /api/meetings/{meeting_id}/participants`.
 *
 * There is deliberately no `user_id`: `ParticipantCreate` on the server has no
 * such field and derives host status from `Meeting.host_id`. Sending one would
 * be silently ignored.
 */
export interface ParticipantCreatePayload {
  display_name: string;
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
