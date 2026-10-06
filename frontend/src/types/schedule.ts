export interface ScheduleCreatePayload {
  title: string;
  description?: string | null;
  /** Timezone-aware ISO 8601 string (the API rejects naive values). */
  start_time: string;
  /** Minutes, 1..1440. */
  duration: number;
}
