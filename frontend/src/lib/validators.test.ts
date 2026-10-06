import { describe, expect, it } from "vitest";
import {
  buildStartTimestamp,
  extractMeetingId,
  isValidMeetingId,
  toLocalDateInputValue,
  validateJoinInput,
  validateScheduleForm,
} from "./validators";

describe("isValidMeetingId", () => {
  it("accepts alphanumeric ids up to 32 characters", () => {
    expect(isValidMeetingId("839452761")).toBe(true);
    expect(isValidMeetingId("abc-DEF_123")).toBe(true);
    expect(isValidMeetingId("a".repeat(32))).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    expect(isValidMeetingId("  839452761  ")).toBe(true);
  });

  it("rejects empty, over-long and unsafe values", () => {
    expect(isValidMeetingId("")).toBe(false);
    expect(isValidMeetingId("   ")).toBe(false);
    expect(isValidMeetingId("a".repeat(33))).toBe(false);
    expect(isValidMeetingId("has space")).toBe(false);
    expect(isValidMeetingId("slash/here")).toBe(false);
  });
});

describe("extractMeetingId", () => {
  it("passes a bare id through", () => {
    expect(extractMeetingId("839452761")).toBe("839452761");
    expect(extractMeetingId("  839452761  ")).toBe("839452761");
  });

  it("extracts from a full invite link", () => {
    expect(extractMeetingId("https://meet.example.com/meetings/839452761")).toBe(
      "839452761"
    );
  });

  it("ignores the query string", () => {
    expect(extractMeetingId("https://x.com/meetings/abc?tab=people")).toBe(
      "abc"
    );
  });

  it("extracts from a bare path", () => {
    expect(extractMeetingId("/meetings/xyz")).toBe("xyz");
    expect(extractMeetingId("join/meetings/xyz/")).toBe("xyz");
  });

  it("returns an empty string for unusable input", () => {
    expect(extractMeetingId("")).toBe("");
    expect(extractMeetingId("not a valid id")).toBe("");
    expect(extractMeetingId("https://example.com/nothing")).toBe("");
  });
});

describe("validateJoinInput", () => {
  it("passes valid input", () => {
    expect(validateJoinInput({ meetingId: "839452761", displayName: "Pri" })).toEqual([]);
  });

  it("reports both fields when empty", () => {
    const errors = validateJoinInput({ meetingId: " ", displayName: "" });
    expect(errors.map((e) => e.field)).toEqual(["meetingId", "displayName"]);
  });

  it("rejects an invalid meeting id", () => {
    const errors = validateJoinInput({
      meetingId: "bad id!",
      displayName: "Pri",
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("meetingId");
  });

  it("rejects an over-long display name", () => {
    const errors = validateJoinInput({
      meetingId: "839452761",
      displayName: "a".repeat(101),
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("displayName");
  });
});

describe("buildStartTimestamp", () => {
  it("composes a timezone-aware timestamp", () => {
    const iso = buildStartTimestamp("2026-12-01", "09:30");
    expect(iso).not.toBeNull();
    const date = new Date(iso as string);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(11);
    expect(date.getDate()).toBe(1);
    expect(date.getHours()).toBe(9);
    expect(date.getMinutes()).toBe(30);
  });

  it("returns null for incomplete input", () => {
    expect(buildStartTimestamp("", "09:30")).toBeNull();
    expect(buildStartTimestamp("2026-12-01", "")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(buildStartTimestamp("not-a-date", "09:30")).toBeNull();
    expect(buildStartTimestamp("2026-12-01", "abc")).toBeNull();
  });
});

describe("toLocalDateInputValue", () => {
  it("pads month and day", () => {
    expect(toLocalDateInputValue(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toLocalDateInputValue(new Date(2026, 11, 24))).toBe("2026-12-24");
  });
});

describe("validateScheduleForm", () => {
  const future = () => {
    const date = new Date(Date.now() + 24 * 3_600_000);
    return {
      date: toLocalDateInputValue(date),
      time: "10:00",
    };
  };

  it("passes a valid future schedule", () => {
    const { date, time } = future();
    expect(
      validateScheduleForm({
        title: "Standup",
        description: "",
        date,
        time,
        duration: 30,
      })
    ).toEqual([]);
  });

  it("requires title, date, time and duration", () => {
    const errors = validateScheduleForm({
      title: "  ",
      description: "",
      date: "",
      time: "",
      duration: 0,
    });
    expect(errors.map((e) => e.field).sort()).toEqual([
      "date",
      "duration",
      "time",
      "title",
    ]);
  });

  it("rejects a title over 255 characters", () => {
    const { date, time } = future();
    const errors = validateScheduleForm({
      title: "a".repeat(256),
      description: "",
      date,
      time,
      duration: 30,
    });
    expect(errors.some((e) => e.field === "title")).toBe(true);
  });

  it("rejects durations over 24 hours", () => {
    const { date, time } = future();
    const errors = validateScheduleForm({
      title: "Long run",
      description: "",
      date,
      time,
      duration: 1441,
    });
    expect(errors.some((e) => e.field === "duration")).toBe(true);
  });

  it("rejects a start time in the past", () => {
    const date = new Date(Date.now() - 24 * 3_600_000);
    const errors = validateScheduleForm({
      title: "Yesterday",
      description: "",
      date: toLocalDateInputValue(date),
      time: "10:00",
      duration: 30,
    });
    expect(
      errors.some((e) => e.message === "Pick a start time in the future.")
    ).toBe(true);
  });
});
