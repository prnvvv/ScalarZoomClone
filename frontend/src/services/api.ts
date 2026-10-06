import { apiRequest } from "@/lib/api-client";
import { REST } from "@/lib/constants";
import type { CurrentUser } from "@/types/api";

/** GET /api/users/me */
export function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>(REST.me);
}
