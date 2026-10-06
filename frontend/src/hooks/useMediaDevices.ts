"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS } from "@/lib/constants";

export interface MediaDevicePreferences {
  audioInputId?: string | null;
  videoInputId?: string | null;
}

export interface MediaDevicesState {
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoOn: boolean;
  /** False when no microphone track could be acquired (missing or blocked). */
  audioAvailable: boolean;
  /** False when no camera track could be acquired (missing or blocked). */
  videoAvailable: boolean;
  /** Friendly message when camera/microphone could not be acquired. */
  error: string | null;
  audioInputDevices: MediaDeviceInfo[];
  videoInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  selectedAudioInputId: string | null;
  selectedVideoInputId: string | null;
  selectedAudioOutputId: string | null;
  /** False when the browser cannot route remote audio to a chosen speaker. */
  canSelectSpeaker: boolean;
  acquire: (preferences?: MediaDevicePreferences) => Promise<void>;
  refreshDevices: () => Promise<void>;
  setAudioInput: (deviceId: string) => void;
  setVideoInput: (deviceId: string) => void;
  setAudioOutput: (deviceId: string) => void;
  setMuted: (next: boolean) => void;
  setVideoOn: (next: boolean) => void;
  stop: () => void;
}

const MEDIA_ERROR =
  "Camera and microphone are unavailable. Others in the meeting cannot see or hear you.";

const CAMERA_BLOCKED =
  "Camera access was blocked. Allow camera access in your browser settings, then try again.";

const DEVICE_BUSY =
  "Your camera or microphone is in use by another application. Close it and try again.";

const DEVICE_GONE =
  "The selected device is no longer available. We switched to the default device.";

/** Plugging in one device can emit a burst of `devicechange` events. */
const DEVICE_CHANGE_DEBOUNCE_MS = 300;

const DEVICE_LABELS: Record<MediaDeviceKind, string> = {
  audioinput: "Microphone",
  audiooutput: "Speaker",
  videoinput: "Camera",
};

/** Browsers hide labels until permission is granted; keep a stable fallback. */
function deviceLabel(device: MediaDeviceInfo, index: number): string {
  const base = DEVICE_LABELS[device.kind] ?? "Device";
  return device.label || `${base} ${index + 1}`;
}

function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    /* storage disabled — preferences simply do not persist */
  }
}

function errorName(cause: unknown): string {
  return cause instanceof Error ? cause.name : "";
}

/** User-facing copy; raw DOMException names never reach the UI. */
function friendlyError(cause: unknown): string {
  switch (errorName(cause)) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return CAMERA_BLOCKED;
    case "NotReadableError":
    case "TrackStartError":
      return DEVICE_BUSY;
    case "OverconstrainedError":
    case "NotFoundError":
      return DEVICE_GONE;
    default:
      return MEDIA_ERROR;
  }
}

function audioConstraint(deviceId: string | null): MediaTrackConstraints | boolean {
  return deviceId ? { deviceId: { exact: deviceId } } : true;
}

function videoConstraint(deviceId: string | null): MediaTrackConstraints | boolean {
  return deviceId ? { deviceId: { exact: deviceId } } : true;
}

function canEnumerate(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.enumerateDevices === "function"
  );
}

function canGetUserMedia(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/** `setSinkId` is Chromium-only; elsewhere the speaker list is not offered. */
export function supportsSpeakerSelection(): boolean {
  return (
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype
  );
}

/**
 * Local media plus device selection.
 *
 * `acquire()` with no arguments is idempotent (the meeting hook calls it from
 * an effect); passing preferences re-acquires with those devices, replacing the
 * previous stream while preserving the mute/camera state the user chose.
 * `stop()` never touches React state, so it is safe from effect cleanup.
 */
export function useMediaDevices(): MediaDevicesState {
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [videoAvailable, setVideoAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState<string | null>(() =>
    readStored(STORAGE_KEYS.audioInput)
  );
  const [selectedVideoInputId, setSelectedVideoInputId] = useState<string | null>(() =>
    readStored(STORAGE_KEYS.videoInput)
  );
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState<string | null>(() =>
    readStored(STORAGE_KEYS.audioOutput)
  );
  const [canSelectSpeaker] = useState(supportsSpeakerSelection);

  // Mirrors of state that async code needs to read without re-subscribing.
  const audioInputIdRef = useRef<string | null>(selectedAudioInputId);
  const videoInputIdRef = useRef<string | null>(selectedVideoInputId);
  const mutedRef = useRef(false);
  const videoOnRef = useRef(true);

  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);
  useEffect(() => {
    videoOnRef.current = isVideoOn;
  }, [isVideoOn]);

  const applyDeviceList = useCallback((devices: MediaDeviceInfo[]) => {
    setAudioInputDevices(devices.filter((d) => d.kind === "audioinput"));
    setVideoInputDevices(devices.filter((d) => d.kind === "videoinput"));
    setAudioOutputDevices(devices.filter((d) => d.kind === "audiooutput"));
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!canEnumerate()) return;
    try {
      applyDeviceList(await navigator.mediaDevices.enumerateDevices());
    } catch {
      /* enumeration is best-effort */
    }
  }, [applyDeviceList]);

  // Initial enumeration runs after the first commit so a room the user leaves
  // immediately never pays for it.
  useEffect(() => {
    if (!canEnumerate()) return;
    let active = true;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (active) applyDeviceList(devices);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [applyDeviceList]);

  // Device hot-plug is reported by the browser, not polled. Plugging in a
  // webcam can fire `devicechange` several times in a row, so re-enumeration
  // is debounced to a single pass.
  useEffect(() => {
    if (!canEnumerate()) return;
    const media = navigator.mediaDevices;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onDeviceChange = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void refreshDevices();
      }, DEVICE_CHANGE_DEBOUNCE_MS);
    };
    media.addEventListener("devicechange", onDeviceChange);
    return () => {
      if (timer !== null) clearTimeout(timer);
      media.removeEventListener("devicechange", onDeviceChange);
    };
  }, [refreshDevices]);

  const adoptStream = useCallback((next: MediaStream, preserveFlags: boolean) => {
    const previous = streamRef.current;
    if (previous && previous !== next) {
      previous.getTracks().forEach((track) => track.stop());
    }
    const audioTracks = next.getAudioTracks();
    const videoTracks = next.getVideoTracks();
    setAudioAvailable(audioTracks.length > 0);
    setVideoAvailable(videoTracks.length > 0);

    if (preserveFlags) {
      audioTracks.forEach((track) => {
        track.enabled = !mutedRef.current;
      });
      videoTracks.forEach((track) => {
        track.enabled = videoOnRef.current;
      });
      // A device without the requested kind must report as off, not on.
      if (audioTracks.length === 0) setIsMuted(true);
      if (videoTracks.length === 0) setIsVideoOn(false);
    } else {
      setIsMuted(audioTracks.length === 0);
      setIsVideoOn(videoTracks.length > 0);
    }

    streamRef.current = next;
    setStream(next);
    void refreshDevices();
  }, [refreshDevices]);

  const requestStream = useCallback(
    async (audioId: string | null, videoId: string | null): Promise<MediaStream> => {
      const request = (audio: string | null, video: string | null) =>
        navigator.mediaDevices.getUserMedia({
          audio: audioConstraint(audio),
          video: videoConstraint(video),
        });

      try {
        return await request(audioId, videoId);
      } catch (cause: unknown) {
        const name = errorName(cause);
        if (name === "OverconstrainedError" && (audioId || videoId)) {
          // The remembered device is gone — fall back to system defaults.
          setError(DEVICE_GONE);
          return request(null, null);
        }
        throw cause;
      }
    },
    []
  );

  const acquire = useCallback(
    async (preferences?: MediaDevicePreferences) => {
      const audioId =
        preferences && preferences.audioInputId !== undefined
          ? preferences.audioInputId
          : audioInputIdRef.current;
      const videoId =
        preferences && preferences.videoInputId !== undefined
          ? preferences.videoInputId
          : videoInputIdRef.current;

      // Idempotent unless the caller explicitly asked for other devices.
      if (!preferences && streamRef.current) return;

      if (!canGetUserMedia()) {
        setIsMuted(true);
        setIsVideoOn(false);
        setAudioAvailable(false);
        setVideoAvailable(false);
        setError(MEDIA_ERROR);
        return;
      }

      const preserveFlags = streamRef.current !== null;
      try {
        let acquired: MediaStream;
        try {
          acquired = await requestStream(audioId, videoId);
        } catch (cause: unknown) {
          if (errorName(cause) === "NotAllowedError") {
            setIsMuted(true);
            setIsVideoOn(false);
            setAudioAvailable(false);
            setVideoAvailable(false);
            setError(CAMERA_BLOCKED);
            return;
          }
          if (errorName(cause) === "NotReadableError") {
            setIsMuted(true);
            setIsVideoOn(false);
            setAudioAvailable(false);
            setVideoAvailable(false);
            setError(DEVICE_BUSY);
            return;
          }
          // Fall back to microphone-only when the camera is unavailable.
          acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
          setError("Camera unavailable — audio only.");
        }
        adoptStream(acquired, preserveFlags);
      } catch (cause: unknown) {
        streamRef.current = null;
        setStream(null);
        setIsMuted(true);
        setIsVideoOn(false);
        setAudioAvailable(false);
        setVideoAvailable(false);
        setError(friendlyError(cause));
      }
    },
    [adoptStream, requestStream]
  );

  const setAudioInput = useCallback(
    (deviceId: string) => {
      audioInputIdRef.current = deviceId;
      setSelectedAudioInputId(deviceId);
      writeStored(STORAGE_KEYS.audioInput, deviceId);
      void acquire({ audioInputId: deviceId });
    },
    [acquire]
  );

  const setVideoInput = useCallback(
    (deviceId: string) => {
      videoInputIdRef.current = deviceId;
      setSelectedVideoInputId(deviceId);
      writeStored(STORAGE_KEYS.videoInput, deviceId);
      void acquire({ videoInputId: deviceId });
    },
    [acquire]
  );

  const setAudioOutput = useCallback((deviceId: string) => {
    setSelectedAudioOutputId(deviceId);
    writeStored(STORAGE_KEYS.audioOutput, deviceId);
  }, []);

  const setMuted = useCallback((next: boolean) => {
    mutedRef.current = next;
    const current = streamRef.current;
    current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setIsMuted(next);
  }, []);

  const setVideoOn = useCallback((next: boolean) => {
    videoOnRef.current = next;
    const current = streamRef.current;
    current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setIsVideoOn(next);
  }, []);

  const stop = useCallback(() => {
    const current = streamRef.current;
    streamRef.current = null;
    current?.getTracks().forEach((track) => track.stop());
  }, []);

  return {
    stream,
    isMuted,
    isVideoOn,
    audioAvailable,
    videoAvailable,
    error,
    audioInputDevices,
    videoInputDevices,
    audioOutputDevices,
    selectedAudioInputId,
    selectedVideoInputId,
    selectedAudioOutputId,
    canSelectSpeaker,
    acquire,
    refreshDevices,
    setAudioInput,
    setVideoInput,
    setAudioOutput,
    setMuted,
    setVideoOn,
    stop,
  };
}

export { deviceLabel };
