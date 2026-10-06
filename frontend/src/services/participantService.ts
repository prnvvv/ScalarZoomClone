import { apiRequest } from "@/lib/api-client";
import { REST } from "@/lib/constants";
import type { Participant, ParticipantCreatePayload } from "@/types/participant";

/** GET /api/meetings/{meeting_id}/participants */
export function getParticipants(
  meetingId: string,
  activeOnly = false
): Promise<Participant[]> {
  const query = activeOnly ? "?active_only=true" : "";
  return apiRequest<Participant[]>(
    `${REST.meetingParticipants(meetingId)}${query}`
  );
}

/**
 * POST /api/meetings/{meeting_id}/participants
 *
 * Host status is derived server-side from `Meeting.host_id`, so the payload
 * carries no user identity.
 */
export function addParticipant(
  meetingId: string,
  payload: ParticipantCreatePayload
): Promise<Participant> {
  return apiRequest<Participant>(REST.meetingParticipants(meetingId), {
    method: "POST",
    body: payload,
  });
}

/** DELETE /api/participants/{participant_id} */
export function removeParticipant(participantId: number): Promise<void> {
  return apiRequest<void>(REST.participant(participantId), {
    method: "DELETE",
  });
}
