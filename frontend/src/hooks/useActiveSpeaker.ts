"use client";

import { useEffect, useRef, useState } from "react";

interface UseActiveSpeakerOptions {
  selfId: number | null;
  localStream: MediaStream | null;
  remoteStreams: Record<number, MediaStream>;
}

/** RMS above this counts as speaking (0..1 on a 0..127 byte range). */
const SPEECH_THRESHOLD = 0.06;
/** How long the highlight lingers after the last loud sample. */
const HOLD_MS = 1_500;
const SAMPLE_MS = 150;

interface AnalyserEntry {
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
}

type AudioContextCtor = typeof AudioContext;

function resolveAudioContextCtor(): AudioContextCtor | undefined {
  if (typeof AudioContext !== "undefined") return AudioContext;
  if (typeof window === "undefined") return undefined;
  return (window as { webkitAudioContext?: AudioContextCtor })
    .webkitAudioContext;
}

/**
 * Active-speaker detection using the Web Audio API.
 *
 * Every local/remote stream gets an analyser; a poll picks the loudest
 * participant above a threshold and holds the highlight briefly so speaker
 * view does not flicker. Degrades to `null` (no highlight) where Web Audio
 * is unavailable — never throws, never blocks the room.
 */
export function useActiveSpeakerId({
  selfId,
  localStream,
  remoteStreams,
}: UseActiveSpeakerOptions): number | null {
  const [activeId, setActiveId] = useState<number | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const entriesRef = useRef(new Map<number, AnalyserEntry>());
  const lastLoudRef = useRef<{ id: number; at: number } | null>(null);
  const localStreamRef = useRef(localStream);
  const remoteStreamsRef = useRef(remoteStreams);
  const selfIdRef = useRef(selfId);

  useEffect(() => {
    localStreamRef.current = localStream;
    remoteStreamsRef.current = remoteStreams;
    selfIdRef.current = selfId;
  }, [localStream, remoteStreams, selfId]);

  useEffect(() => {
    const Ctor = resolveAudioContextCtor();
    if (!Ctor) return;
    const entries = entriesRef.current;

    let context: AudioContext;
    try {
      context = new Ctor();
    } catch {
      return;
    }
    contextRef.current = context;

    // Browsers start the context suspended until a user gesture.
    const resume = () => {
      if (context.state === "suspended") void context.resume().catch(() => undefined);
    };
    resume();
    document.addEventListener("pointerdown", resume);

    const attach = (id: number, stream: MediaStream) => {
      if (entriesRef.current.has(id)) return;
      try {
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        entriesRef.current.set(id, {
          analyser,
          data: new Uint8Array(new ArrayBuffer(analyser.fftSize)),
        });
      } catch {
        /* a stream without audio tracks simply produces no entry */
      }
    };

    const detach = (id: number) => {
      entriesRef.current.delete(id);
    };

    const timer = window.setInterval(() => {
      const local = localStreamRef.current;
      const self = selfIdRef.current;
      if (local && self !== null) attach(self, local);

      const remotes = remoteStreamsRef.current;
      for (const [id, stream] of Object.entries(remotes)) {
        attach(Number(id), stream);
      }
      for (const id of [...entriesRef.current.keys()]) {
        if (id === self) continue;
        if (!(String(id) in remotes)) detach(id);
      }

      let loudest: number | null = null;
      let loudestLevel = 0;
      for (const [id, entry] of entriesRef.current) {
        entry.analyser.getByteTimeDomainData(entry.data);
        let sum = 0;
        for (let i = 0; i < entry.data.length; i += 1) {
          const sample = (entry.data[i] - 128) / 128;
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / entry.data.length);
        if (rms > loudestLevel) {
          loudestLevel = rms;
          loudest = id;
        }
      }

      const now = Date.now();
      if (loudest !== null && loudestLevel >= SPEECH_THRESHOLD) {
        lastLoudRef.current = { id: loudest, at: now };
        setActiveId((current) => (current === loudest ? current : loudest));
      } else if (
        lastLoudRef.current &&
        now - lastLoudRef.current.at > HOLD_MS
      ) {
        setActiveId(null);
      }
    }, SAMPLE_MS);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("pointerdown", resume);
      entries.clear();
      lastLoudRef.current = null;
      contextRef.current = null;
      void context.close().catch(() => undefined);
    };
  }, []);

  return activeId;
}
