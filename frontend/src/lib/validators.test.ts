import { describe, expect, it } from "vitest";
import { MAX_DISPLAY_NAME_LENGTH } from "@/lib/constants";
import {
  buildStartTimestamp,
  clampDisplayName,
  extractMeetingId,
  isValidMeetingId,
  toLocalDateInputValue,
  validateJoinInput,
  validateScheduleForm,
} from "./validators";

describe("isValidMeetingId", () => {
  it("accepts exactly nine digits", () => {
    expect(isValidMeetingId("839452761")).toBe(true);
    expect(isValidMeetingId("100000000")).toBe(true);
    expect(isValidMeetingId("999999999")).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    expect(isValidMeetingId("  839452761  ")).toBe(true);
  });

  it("rejects a leading zero, exactly as the server does", () => {
    expect(isValidMeetingId("000000001")).toBe(false);
    expect(isValidMeetingId("012345678")).toBe(false);
  });

  it("rejects the wrong digit count", () => {
    expect(isValidMeetingId("")).toBe(false);
    expect(isValidMeetingId("   ")).toBe(false);
    expect(isValidMeetingId("123")).toBe(false);
    expect(isValidMeetingId("12345678")).toBe(false);
    expect(isValidMeetingId("1234567890")).toBe(false);
  });

  it("rejects non-numeric ids the server would 400 on", () => {
    expect(isValidMeetingId("abc")).toBe(false);
    expect(isValidMeetingId("abcdefghi")).toBe(false);
    expect(isValidMeetingId("AAAAAAAAAAAAAAA")).toBe(false);
    expect(isValidMeetingId("abc-DEF_123")).toBe(false);
    expect(isValidMeetingId("has space")).toBe(false);
    expect(isValidMeetingId("slash/here")).toBe(false);
    expect(isValidMeetingId("8394527619")).toBe(false);
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
    expect(extractMeetingId("https://x.com/meetings/839452761?tab=people")).toBe(
      "839452761"
    );
  });

  it("extracts from a bare path", () => {
    expect(extractMeetingId("/meetings/839452761")).toBe("839452761");
    expect(extractMeetingId("join/meetings/839452761/")).toBe("839452761");
  });

  it("returns an empty string for unusable input", () => {
    expect(extractMeetingId("")).toBe("");
    expect(extractMeetingId("not a valid id")).toBe("");
    expect(extractMeetingId("https://example.com/nothing")).toBe("");
  });

  it("does not treat a longer number as an id", () => {
    expect(extractMeetingId("12345678901")).toBe(
      "12345678901"
    );
    expect(isValidMeetingId(extractMeetingId("12345678901"))).toBe(false);
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

describe("clampDisplayName", () => {
  it("leaves a normal name untouched", () => {
    expect(clampDisplayName("Ann")).toBe("Ann");
  });

  it("trims surrounding whitespace", () => {
    expect(clampDisplayName("   Ann   ")).toBe("Ann");
  });

  it("never exceeds the server's 100 character limit", () => {
    // The REST layer rejects 101+; the socket accepts up to 120. Sending more
    // stores a row that then cannot be serialised by ParticipantOut.
    expect(clampDisplayName("x".repeat(140))).toHaveLength(100);
    expect(clampDisplayName("x".repeat(101))).toHaveLength(100);
    expect(clampDisplayName("x".repeat(100))).toHaveLength(100);
    expect(clampDisplayName("x".repeat(120))).toHaveLength(100);
  });

  it("matches MAX_DISPLAY_NAME_LENGTH", () => {
    expect(clampDisplayName("x".repeat(500)).length).toBe(
      MAX_DISPLAY_NAME_LENGTH
    );
  });

  it("trims before clamping so padding cannot push a valid name over", () => {
    expect(clampDisplayName(`  ${"x".repeat(100)}  `)).toBe("x".repeat(100));
  });
});
