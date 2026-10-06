"use client";

import { useCallback, useRef, useState } from "react";

export interface MediaDevicesState {
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoOn: boolean;
  /** Friendly message when camera/microphone could not be acquired. */
  error: string | null;
  acquire: () => Promise<void>;
  setMuted: (next: boolean) => void;
  setVideoOn: (next: boolean) => void;
  stop: () => void;
}

const MEDIA_ERROR =
  "Camera and microphone are unavailable. Others in the meeting cannot see or hear you.";

/**
 * Local media: getUserMedia once, then toggle tracks by enabling/disabling
 * them (no renegotiation needed). `stop()` never touches React state so it
 * is safe to call from effect cleanup.
 */
export function useMediaDevices(): MediaDevicesState {
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const acquire = useCallback(async () => {
    if (streamRef.current) return;
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setIsMuted(true);
      setIsVideoOn(false);
      setError(MEDIA_ERROR);
      return;
    }
    const constraints: MediaStreamConstraints = { audio: true, video: true };
    try {
      let acquired: MediaStream;
      try {
        acquired = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        // Fall back to microphone-only when the camera is unavailable.
        acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
        setError("Camera unavailable — audio only.");
      }
      streamRef.current = acquired;
      setStream(acquired);
      setIsMuted(acquired.getAudioTracks().length === 0);
      setIsVideoOn(acquired.getVideoTracks().length > 0);
    } catch {
      streamRef.current = null;
      setStream(null);
      setIsMuted(true);
      setIsVideoOn(false);
      setError(MEDIA_ERROR);
    }
  }, []);

  const setMuted = useCallback((next: boolean) => {
    const current = streamRef.current;
    current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setIsMuted(next);
  }, []);

  const setVideoOn = useCallback((next: boolean) => {
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

  return { stream, isMuted, isVideoOn, error, acquire, setMuted, setVideoOn, stop };
}
