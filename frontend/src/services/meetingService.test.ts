import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/constants";
import {
  createMeeting,
  endMeeting,
  getMeeting,
  joinMeeting,
} from "./meetingService";
import { addParticipant, getParticipants, removeParticipant } from "./participantService";

const MEETING_ID = "810288678";

let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function lastCall(): [string, RequestInit] {
  const call = fetchMock.mock.calls.at(-1);
  return [String(call?.[0]), (call?.[1] ?? {}) as RequestInit];
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("meetingService", () => {
  it("creates a meeting and returns the server-generated id", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: 1, meeting_id: MEETING_ID, status: "active" })
    );
    const meeting = await createMeeting({ title: "Team Meeting" });

    const [url, init] = lastCall();
    expect(url).toBe(`${API_BASE_URL}/api/meetings`);
    expect(init.method).toBe("POST");
    // The frontend must never invent the public id.
    expect(JSON.parse(String(init.body))).toEqual({ title: "Team Meeting" });
    expect(meeting.meeting_id).toBe(MEETING_ID);
  });

  it("fetches a single meeting by its public id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ meeting_id: MEETING_ID }));
    await getMeeting(MEETING_ID);

    const [url, init] = lastCall();
    expect(url).toBe(`${API_BASE_URL}/api/meetings/${MEETING_ID}`);
    expect(init.method).toBeUndefined();
  });

  it("posts the join validation with the display name", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ meeting_id: MEETING_ID }));
    await joinMeeting(MEETING_ID, { display_name: "John" });

    const [url, init] = lastCall();
    expect(url).toBe(`${API_BASE_URL}/api/meetings/${MEETING_ID}/join`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ display_name: "John" });
  });

  it("ends a meeting with DELETE", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: "ended" }));
    await endMeeting(MEETING_ID);

    const [url, init] = lastCall();
    expect(url).toBe(`${API_BASE_URL}/api/meetings/${MEETING_ID}`);
    expect(init.method).toBe("DELETE");
  });

  it("encodes a hostile meeting id instead of breaking the path", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ meeting_id: "x" }));
    await getMeeting("../../admin");

    expect(String(fetchMock.mock.calls.at(-1)?.[0])).not.toContain("../..");
  });

  it("surfaces the server's 404 message for an unknown meeting", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Meeting not found" }, 404));
    await expect(getMeeting("000000000")).rejects.toMatchObject({
      status: 404,
      message: "Meeting not found",
    });
  });

  it("translates an unreachable backend into friendly copy", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(getMeeting(MEETING_ID)).rejects.toMatchObject({
      status: 0,
      message: "Cannot reach the meeting service. Check your connection.",
    });
  });
});

describe("participantService", () => {
  it("lists participants", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await getParticipants(MEETING_ID);

    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toBe(
      `${API_BASE_URL}/api/meetings/${MEETING_ID}/participants`
    );
  });

  it("requests only active participants when asked", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await getParticipants(MEETING_ID, true);

    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toBe(
      `${API_BASE_URL}/api/meetings/${MEETING_ID}/participants?active_only=true`
    );
  });

  it("creates a participant without a user id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 4 }, 201));
    await addParticipant(MEETING_ID, { display_name: "John" });

    const [url, init] = lastCall();
    expect(url).toBe(`${API_BASE_URL}/api/meetings/${MEETING_ID}/participants`);
    expect(init.method).toBe("POST");
    // ParticipantCreate on the server has no user_id field.
    expect(JSON.parse(String(init.body))).toEqual({ display_name: "John" });
  });

  it("removes a participant by its numeric id", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, text: async () => "" } as Response);
    await removeParticipant(4);

    const [url, init] = lastCall();
    expect(url).toBe(`${API_BASE_URL}/api/participants/4`);
    expect(init.method).toBe("DELETE");
  });

  it("rejects an over-long display name with the server's wording", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { detail: [{ loc: ["body", "display_name"], msg: "String should have at most 100 characters" }] },
        422
      )
    );
    await expect(
      addParticipant(MEETING_ID, { display_name: "x".repeat(101) })
    ).rejects.toMatchObject({
      status: 422,
      message: "String should have at most 100 characters",
    });
  });
});
