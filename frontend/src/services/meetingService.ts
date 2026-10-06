import { apiRequest } from "@/lib/api-client";
import { REST } from "@/lib/constants";
import type {
  Meeting,
  MeetingCreatePayload,
  MeetingJoinPayload,
} from "@/types/meeting";

/** POST /api/meetings - the server generates the authoritative meeting ID. */
export function createMeeting(payload: MeetingCreatePayload): Promise<Meeting> {
  return apiRequest<Meeting>(REST.meetings, {
    method: "POST",
    body: payload,
  });
}

/** GET /api/meetings/{meeting_id} */
export function getMeeting(meetingId: string): Promise<Meeting> {
  return apiRequest<Meeting>(REST.meeting(meetingId));
}

/** POST /api/meetings/{meeting_id}/join - validates that the meeting is joinable. */
export function joinMeeting(
  meetingId: string,
  payload: MeetingJoinPayload
): Promise<Meeting> {
  return apiRequest<Meeting>(REST.meetingJoin(meetingId), {
    method: "POST",
    body: payload,
  });
}

/** DELETE /api/meetings/{meeting_id} - end or cancel a meeting. */
export function endMeeting(meetingId: string): Promise<Meeting> {
  return apiRequest<Meeting>(REST.meeting(meetingId), {
    method: "DELETE",
  });
}
