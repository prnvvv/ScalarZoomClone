/**
 * Guards the frontend/backend boundary.
 *
 * The fixtures below are the exact JSON shapes the FastAPI backend returns
 * (`backend/app/schemas/*.py`, `backend/app/models/*`). If the backend changes
 * a field name or type, these assertions fail instead of the bug surfacing as
 * a broken meeting room.
 */
import { describe, expect, it } from "vitest";
import { isValidMeetingId } from "@/lib/validators";
import type { Meeting, MeetingStatus } from "@/types/meeting";
import type {
  Participant,
  ParticipantCreatePayload,
  ParticipantSummary,
} from "@/types/participant";
import type { ClientMessage, HostActionMessage, ServerMessage } from "@/types/realtime";

/** Mirrors `POST /api/meetings` (201) — captured from a live response. */
const MEETING_FIXTURE = {
  id: 1,
  meeting_id: "810288678",
  host_id: 1,
  title: "Team Meeting",
  description: "Weekly discussion",
  start_time: "2026-10-07T10:00:00Z",
  end_time: "2026-10-07T11:00:00Z",
  duration: 60,
  status: "active",
  meeting_link: "http://localhost:3000/meetings/810288678",
  created_at: "2026-10-07T09:00:00Z",
} as const;

/** Mirrors `ParticipantOut` — note `meeting_id` is an int and `joined_at` null. */
const PARTICIPANT_FIXTURE = {
  id: 4,
  meeting_id: 4,
  user_id: null,
  display_name: "John",
  is_host: false,
  is_muted: false,
  is_video_on: true,
  joined_at: null,
  left_at: null,
} as const;

const SUMMARY_FIXTURE = {
  id: 4,
  display_name: "John",
  is_host: false,
  is_muted: false,
  is_video_on: true,
  screen_share: false,
} as const;

describe("REST contract: meeting", () => {
  it("accepts the exact payload the server returns", () => {
    const meeting: Meeting = MEETING_FIXTURE;
    expect(meeting.meeting_id).toBe("810288678");
    expect(typeof meeting.id).toBe("number");
    expect(meeting.status).toBe<MeetingStatus>("active");
  });

  it("treats the public meeting id as a string the server accepts", () => {
    // A server-generated id must always pass our own validator.
    expect(isValidMeetingId(MEETING_FIXTURE.meeting_id)).toBe(true);
  });

  it("has no fields the server never sends", () => {
    const serverFields = [
      "id",
      "meeting_id",
      "host_id",
      "title",
      "description",
      "start_time",
      "end_time",
      "duration",
      "status",
      "meeting_link",
      "created_at",
    ];
    expect(Object.keys(MEETING_FIXTURE).sort()).toEqual([...serverFields].sort());
  });
});

describe("REST contract: participant", () => {
  it("types the internal meeting id as a number, not a string", () => {
    const participant: Participant = PARTICIPANT_FIXTURE;
    // This is the bug: the type used to say `meeting_id: string`, which can
    // never hold the integer the API actually sends.
    expect(typeof participant.meeting_id).toBe("number");
    expect(participant.meeting_id).toBe(4);
  });

  it("allows a null joined_at and left_at", () => {
    const participant: Participant = PARTICIPANT_FIXTURE;
    expect(participant.joined_at).toBeNull();
    expect(participant.left_at).toBeNull();
  });

  it("has no fields the server never sends", () => {
    const serverFields = [
      "id",
      "meeting_id",
      "user_id",
      "display_name",
      "is_host",
      "is_muted",
      "is_video_on",
      "joined_at",
      "left_at",
    ];
    expect(Object.keys(PARTICIPANT_FIXTURE).sort()).toEqual([...serverFields].sort());
  });

  it("omits user_id when creating a participant", () => {
    // ParticipantCreate on the server has no user_id and ignores extras, so
    // the frontend must not advertise one.
    const payload: ParticipantCreatePayload = { display_name: "John" };
    expect(Object.keys(payload)).toEqual(["display_name"]);
    expect("user_id" in payload).toBe(false);
  });

  it("types the participant summary broadcast over the socket", () => {
    const summary: ParticipantSummary = SUMMARY_FIXTURE;
    expect(summary.screen_share).toBe(false);
    expect(summary.is_host).toBe(false);
  });
});

describe("WebSocket contract", () => {
  it("covers every client event the server accepts", () => {
    const messages: ClientMessage[] = [
      { type: "join", meeting_id: "810288678", participant_id: null, display_name: "John" },
      { type: "leave", participant_id: 4 },
      { type: "meeting_state", participant_id: 4 },
      { type: "media_state", participant_id: 4, is_muted: false, is_video_on: true },
      { type: "screen_share", participant_id: 4, active: true },
      { type: "mute_participant", participant_id: 1, target_id: 4, is_muted: true },
      { type: "remove_participant", participant_id: 1, target_id: 4 },
      { type: "end_meeting", participant_id: 1 },
      { type: "ping" },
      {
        type: "offer",
        sender_id: 1,
        target_id: 4,
        payload: { type: "offer", sdp: "v=0" },
      },
      {
        type: "answer",
        sender_id: 4,
        target_id: 1,
        payload: { type: "answer", sdp: "v=0" },
      },
      {
        type: "ice_candidate",
        sender_id: 1,
        target_id: 4,
        payload: { candidate: "c:1", sdpMid: "0", sdpMLineIndex: 0 },
      },
    ];
    expect(new Set(messages.map((m) => m.type))).toEqual(
      new Set([
        "join",
        "leave",
        "meeting_state",
        "media_state",
        "screen_share",
        "mute_participant",
        "remove_participant",
        "end_meeting",
        "ping",
        "offer",
        "answer",
        "ice_candidate",
      ])
    );
  });

  it("covers every server event the app reacts to", () => {
    const messages: ServerMessage[] = [
      { type: "joined", meeting_id: "810288678", participant_id: 4, participants: [] },
      { type: "participant_joined", participant: SUMMARY_FIXTURE },
      { type: "participant_left", participant_id: 4 },
      { type: "participant_updated", participant: { id: 4, is_muted: true } },
      {
        type: "meeting_state",
        meeting_id: "810288678",
        participant_id: 4,
        is_host: false,
        participants: [],
        connected_participant_ids: [4],
      },
      { type: "host_action", action: "mute", target_id: 4 },
      { type: "meeting_ended", meeting_id: "810288678" },
      { type: "error", code: "MEETING_ENDED", message: "ended" },
      { type: "pong" },
    ];
    expect(new Set(messages.map((m) => m.type))).toEqual(
      new Set([
        "joined",
        "participant_joined",
        "participant_left",
        "participant_updated",
        "meeting_state",
        "host_action",
        "meeting_ended",
        "error",
        "pong",
      ])
    );
  });

  it("includes the unmute host action the server emits", () => {
    const message: HostActionMessage = { type: "host_action", action: "unmute", target_id: 4 };
    expect(message.action).toBe("unmute");
  });
});

describe("meeting id rule parity", () => {
  it("matches the backend rule: nine digits, no leading zero", () => {
    const backendRule = (value: string): boolean =>
      value.length === 9 && /^\d+$/.test(value) && !value.startsWith("0");

    const samples = [
      "810288678",
      "839452761",
      "100000000",
      "999999999",
      "abc",
      "123",
      "AAAAAAAAAAAAAAA",
      "000000001",
      "012345678",
      "12345678",
      "1234567890",
      "",
      "8102886780",
      "81028867",
      "810 288678",
      "810-288678",
    ];

    for (const sample of samples) {
      expect({ value: sample, frontend: isValidMeetingId(sample) }).toEqual({
        value: sample,
        frontend: backendRule(sample),
      });
    }
  });
});
