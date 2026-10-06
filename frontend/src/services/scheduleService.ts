import { apiRequest } from "@/lib/api-client";
import { REST } from "@/lib/constants";
import type { Meeting } from "@/types/meeting";
import type { ScheduleCreatePayload } from "@/types/schedule";

/** GET /api/schedules/upcoming */
export function getUpcomingMeetings(limit = 50): Promise<Meeting[]> {
  return apiRequest<Meeting[]>(`${REST.schedulesUpcoming}?limit=${limit}`);
}

/** GET /api/schedules/recent */
export function getRecentMeetings(limit = 50): Promise<Meeting[]> {
  return apiRequest<Meeting[]>(`${REST.schedulesRecent}?limit=${limit}`);
}

/** POST /api/schedules */
export function scheduleMeeting(payload: ScheduleCreatePayload): Promise<Meeting> {
  return apiRequest<Meeting>(REST.schedules, {
    method: "POST",
    body: payload,
  });
}
