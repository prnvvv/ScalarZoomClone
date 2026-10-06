import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/lib/constants";
import { useMediaDevices } from "./useMediaDevices";

afterEach(cleanup);

interface FakeTrack {
  kind: "audio" | "video";
  enabled: boolean;
  stop: () => void;
}

function fakeTrack(kind: "audio" | "video", stop = vi.fn()): FakeTrack {
  return { kind, enabled: true, stop };
}

function fakeStream(audio: FakeTrack[], video: FakeTrack[]) {
  const tracks: FakeTrack[] = [...audio, ...video];
  return {
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
    getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
  };
}

function device(
  deviceId: string,
  kind: MediaDeviceKind,
  label: string
): MediaDeviceInfo {
  return {
    deviceId,
    kind,
    label,
    groupId: "group-1",
    toJSON: () => ({ deviceId, kind, label, groupId: "group-1" }),
  };
}

const MIC_A = device("mic-a", "audioinput", "Built-in Mic");
const MIC_B = device("mic-b", "audioinput", "Headset Mic");
const CAM_A = device("cam-a", "videoinput", "Built-in Cam");
const SPEAKER = device("out-a", "audiooutput", "Speakers");

const listeners = new Map<string, Set<EventListener>>();
let devices: MediaDeviceInfo[] = [MIC_A, MIC_B, CAM_A, SPEAKER];
let getUserMedia: ReturnType<typeof vi.fn>;

function installMediaDevices(): void {
  getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
    const wantAudio = Boolean(constraints.audio);
    const wantVideo = Boolean(constraints.video);
    return fakeStream(
      wantAudio ? [fakeTrack("audio")] : [],
      wantVideo ? [fakeTrack("video")] : []
    ) as unknown as MediaStream;
  });

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia,
      enumerateDevices: vi.fn(async () => devices),
      addEventListener: vi.fn((type: string, handler: EventListener) => {
        const set = listeners.get(type) ?? new Set<EventListener>();
        set.add(handler);
        listeners.set(type, set);
      }),
      removeEventListener: vi.fn((type: string, handler: EventListener) => {
        listeners.get(type)?.delete(handler);
      }),
    },
  });
}

function emitDeviceChange(): void {
  for (const handler of listeners.get("devicechange") ?? []) {
    handler(new Event("devicechange"));
  }
}

beforeEach(() => {
  devices = [MIC_A, MIC_B, CAM_A, SPEAKER];
  listeners.clear();
  window.sessionStorage.clear();
  installMediaDevices();
});

describe("useMediaDevices", () => {
  it("groups the enumerated devices by kind", async () => {
    const { result } = renderHook(() => useMediaDevices());

    await act(async () => undefined);

    expect(result.current.audioInputDevices.map((d) => d.deviceId)).toEqual([
      "mic-a",
      "mic-b",
    ]);
    expect(result.current.videoInputDevices.map((d) => d.deviceId)).toEqual([
      "cam-a",
    ]);
    expect(result.current.audioOutputDevices.map((d) => d.deviceId)).toEqual([
      "out-a",
    ]);
  });

  it("restores the device preference saved earlier in the tab", () => {
    window.sessionStorage.setItem(STORAGE_KEYS.audioInput, "mic-b");
    window.sessionStorage.setItem(STORAGE_KEYS.videoInput, "cam-a");

    const { result } = renderHook(() => useMediaDevices());

    expect(result.current.selectedAudioInputId).toBe("mic-b");
    expect(result.current.selectedVideoInputId).toBe("cam-a");
  });

  it("acquires with the stored device ids and reports a live stream", async () => {
    window.sessionStorage.setItem(STORAGE_KEYS.audioInput, "mic-b");
    const { result } = renderHook(() => useMediaDevices());

    await act(async () => {
      await result.current.acquire();
    });

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia.mock.calls[0][0]).toEqual({
      audio: { deviceId: { exact: "mic-b" } },
      video: true,
    });
    expect(result.current.stream).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("only acquires once when called repeatedly", async () => {
    const { result } = renderHook(() => useMediaDevices());

    await act(async () => {
      await result.current.acquire();
      await result.current.acquire();
    });

    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("re-acquires on the chosen microphone and keeps the mute state", async () => {
    const { result } = renderHook(() => useMediaDevices());

    await act(async () => {
      await result.current.acquire();
    });

    act(() => {
      result.current.setMuted(true);
    });
    expect(result.current.isMuted).toBe(true);

    const previous = result.current.stream;
    await act(async () => {
      result.current.setAudioInput("mic-b");
    });

    expect(window.sessionStorage.getItem(STORAGE_KEYS.audioInput)).toBe("mic-b");
    expect(result.current.selectedAudioInputId).toBe("mic-b");
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[1][0]).toMatchObject({
      audio: { deviceId: { exact: "mic-b" } },
    });
    // The replaced stream's tracks are stopped, and mute survives the swap.
    for (const track of previous?.getAudioTracks() ?? []) {
      expect(track.enabled).toBe(false);
    }
    expect(result.current.isMuted).toBe(true);
  });

  it("stops the previous stream when a device changes", async () => {
    const stops: Array<ReturnType<typeof vi.fn>> = [];
    getUserMedia.mockImplementation(async (constraints: MediaStreamConstraints) => {
      const audioStop = vi.fn();
      const videoStop = vi.fn();
      stops.push(audioStop, videoStop);
      return fakeStream(
        constraints.audio ? [fakeTrack("audio", audioStop)] : [],
        constraints.video ? [fakeTrack("video", videoStop)] : []
      ) as unknown as MediaStream;
    });

    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.acquire();
    });
    await act(async () => {
      result.current.setVideoInput("cam-a");
    });

    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(stops[1]).toHaveBeenCalledTimes(1);
  });

  it("falls back to the default device when the stored one is gone", async () => {
    window.sessionStorage.setItem(STORAGE_KEYS.audioInput, "mic-gone");
    const { result } = renderHook(() => useMediaDevices());

    getUserMedia.mockImplementationOnce(async () => {
      const error = new Error("nope");
      error.name = "OverconstrainedError";
      throw error;
    });

    await act(async () => {
      await result.current.acquire();
    });

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[1][0]).toEqual({ audio: true, video: true });
    expect(result.current.error).toContain("no longer available");
  });

  it("explains a blocked camera without leaking the DOM exception", async () => {
    const { result } = renderHook(() => useMediaDevices());

    getUserMedia.mockImplementationOnce(async () => {
      const error = new Error("denied");
      error.name = "NotAllowedError";
      throw error;
    });

    await act(async () => {
      await result.current.acquire();
    });

    expect(result.current.stream).toBeNull();
    expect(result.current.isVideoOn).toBe(false);
    expect(result.current.isMuted).toBe(true);
    expect(result.current.error).toContain("Camera access was blocked");
    expect(result.current.error).not.toContain("NotAllowedError");
  });

  it("falls back to microphone only when the camera is unavailable", async () => {
    const { result } = renderHook(() => useMediaDevices());

    getUserMedia
      .mockImplementationOnce(async () => {
        const error = new Error("no camera");
        error.name = "NotFoundError";
        throw error;
      })
      .mockImplementationOnce(async () =>
        fakeStream([fakeTrack("audio")], []) as unknown as MediaStream
      );

    await act(async () => {
      await result.current.acquire();
    });

    expect(result.current.error).toContain("Camera unavailable");
    expect(result.current.isVideoOn).toBe(false);
    expect(result.current.isMuted).toBe(false);
  });

  it("reports a device that another application is using", async () => {
    const { result } = renderHook(() => useMediaDevices());

    getUserMedia.mockImplementationOnce(async () => {
      const error = new Error("busy");
      error.name = "NotReadableError";
      throw error;
    });

    await act(async () => {
      await result.current.acquire();
    });

    expect(result.current.error).toContain("another application");
  });

  it("re-enumerates once for a burst of device changes", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useMediaDevices());
      await act(async () => undefined);
      expect(result.current.videoInputDevices).toHaveLength(1);

      devices = [
        MIC_A,
        MIC_B,
        CAM_A,
        SPEAKER,
        device("cam-b", "videoinput", "Webcam"),
      ];
      const enumerate = navigator.mediaDevices
        .enumerateDevices as unknown as ReturnType<typeof vi.fn>;
      const before = enumerate.mock.calls.length;

      await act(async () => {
        emitDeviceChange();
        emitDeviceChange();
        emitDeviceChange();
      });
      // Nothing is re-enumerated until the burst settles.
      expect(enumerate.mock.calls.length).toBe(before);

      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(enumerate.mock.calls.length).toBe(before + 1);
      expect(result.current.videoInputDevices.map((d) => d.deviceId)).toEqual([
        "cam-a",
        "cam-b",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("toggles tracks without renegotiating", async () => {
    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.acquire();
    });

    act(() => result.current.setMuted(true));
    expect(result.current.stream?.getAudioTracks()[0].enabled).toBe(false);

    act(() => result.current.setVideoOn(false));
    expect(result.current.stream?.getVideoTracks()[0].enabled).toBe(false);

    // Toggling never asks for a new stream.
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("stops every track when the media is released", async () => {
    const stops: Array<ReturnType<typeof vi.fn>> = [];
    getUserMedia.mockImplementation(async (constraints: MediaStreamConstraints) => {
      const audioStop = vi.fn();
      const videoStop = vi.fn();
      stops.push(audioStop, videoStop);
      return fakeStream(
        constraints.audio ? [fakeTrack("audio", audioStop)] : [],
        constraints.video ? [fakeTrack("video", videoStop)] : []
      ) as unknown as MediaStream;
    });

    const { result } = renderHook(() => useMediaDevices());
    await act(async () => {
      await result.current.acquire();
    });

    act(() => result.current.stop());
    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(stops[1]).toHaveBeenCalledTimes(1);
  });

  it("does not offer speaker selection where setSinkId is unavailable", () => {
    const { result } = renderHook(() => useMediaDevices());
    expect(result.current.canSelectSpeaker).toBe(false);
  });
});
