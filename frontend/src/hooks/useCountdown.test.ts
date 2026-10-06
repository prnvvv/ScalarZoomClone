import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountdown } from "./useCountdown";

const START = 1_767_225_600_000; // 2026-01-01T00:00:00Z

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current time on mount", () => {
    const { result } = renderHook(() => useCountdown(1000));
    expect(result.current).toBe(START);
  });

  it("re-renders on every interval tick", () => {
    const { result } = renderHook(() => useCountdown(1000));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(START + 1000);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(START + 4000);
  });

  it("honours a custom interval", () => {
    const { result } = renderHook(() => useCountdown(5000));
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(result.current).toBe(START);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(START + 5000);
  });

  it("stops updating after unmount", () => {
    const { result, unmount } = renderHook(() => useCountdown(1000));
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(START);
  });
});
