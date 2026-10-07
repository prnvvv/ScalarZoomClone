"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPeerConnection,
  descriptionToPayload,
  shouldCreateOffer,
} from "@/lib/webrtc";
import type { ClientMessage, SignalPayloadMessage } from "@/types/realtime";

interface UseWebRtcOptions {
  selfId: number | null;
  localStream: MediaStream | null;
  send: (message: ClientMessage) => void;
  /**
   * Fired when the user stops sharing through the browser's own UI (the
   * floating "Stop sharing" bar) so the session can broadcast the change.
   * Not called for a `stopScreenShare()` triggered by the app itself.
   */
  onScreenShareStopped?: () => void;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
}

/**
 * Senders carrying `kind`, looked up through the transceiver as well: after
 * `replaceTrack(null)` (camera unavailable) `sender.track` is null but the
 * transceiver still knows its media kind, so screen share can find and reuse
 * the same video sender instead of silently going nowhere.
 */
function sendersOfKind(pc: RTCPeerConnection, kind: string): RTCRtpSender[] {
  return pc
    .getSenders()
    .filter((sender) => {
      if (sender.track?.kind === kind) return true;
      // `transceiver` is standard in browsers but missing from the DOM types.
      const withTransceiver = sender as RTCRtpSender & {
        transceiver?: RTCRtpTransceiver;
      };
      return withTransceiver.transceiver?.receiver.track.kind === kind;
    });
}

/**
 * How a screen-share attempt ended:
 * - `started` / `stopped` — state changed and peers were informed.
 * - `cancelled` — the picker was dismissed or permission denied; nothing
 *   changed and the meeting keeps running.
 * - `unsupported` — no `getDisplayMedia` (insecure context or old browser).
 * - `busy` — a share is already live or another attempt is in flight.
 * - `error` — an unexpected failure; the meeting is unaffected.
 */
export type ScreenShareResult =
  | "started"
  | "stopped"
  | "cancelled"
  | "unsupported"
  | "busy"
  | "error";

export interface WebRtcState {
  remoteStreams: Record<number, MediaStream>;
  /** Create peers for the connected set; offers when we are the lower id. */
  syncPeers: (peerIds: number[]) => void;
  handleSignal: (message: SignalPayloadMessage) => Promise<void>;
  closePeer: (peerId: number) => void;
  resetPeers: () => void;
  /**
   * Ask the browser for screen/window/tab capture. Resolves `started` only
   * when a usable video track was acquired — a cancelled picker resolves
   * `cancelled` and leaves every piece of state untouched.
   */
  startScreenShare: () => Promise<ScreenShareResult>;
  /** Stop screen sharing and restore the camera track. Safe to call twice. */
  stopScreenShare: () => void;
  isScreenSharing: boolean;
  /** The live display-media stream, for rendering a local share preview. */
  screenStream: MediaStream | null;
}

/**
 * Full-mesh WebRTC: one `RTCPeerConnection` per remote participant.
 * The lower `participant_id` creates offers (deterministic glare handling);
 * SDP/ICE are forwarded untouched over the signaling socket. Media travels
 * browser-to-browser only.
 */
export function useWebRTC({
  selfId,
  localStream,
  send,
  onScreenShareStopped,
}: UseWebRtcOptions): WebRtcState {
  const peersRef = useRef(new Map<number, PeerEntry>());
  const selfIdRef = useRef(selfId);
  const sendRef = useRef(send);
  const [remoteStreams, setRemoteStreams] = useState<Record<number, MediaStream>>({});
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const sharePendingRef = useRef(false);
  const onScreenShareStoppedRef = useRef(onScreenShareStopped);

  useEffect(() => {
    selfIdRef.current = selfId;
  }, [selfId]);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);
  useEffect(() => {
    onScreenShareStoppedRef.current = onScreenShareStopped;
  }, [onScreenShareStopped]);

  const removePeer = useCallback((peerId: number) => {
    const entry = peersRef.current.get(peerId);
    if (entry) {
      entry.pc.close();
      peersRef.current.delete(peerId);
    }
    setRemoteStreams((current) => {
      const stream = current[peerId];
      if (stream) {
        // Release the remote media; local tracks are shared and stay alive.
        stream.getTracks().forEach((track) => track.stop());
      }
      if (!(peerId in current)) return current;
      const next = { ...current };
      delete next[peerId];
      return next;
    });
  }, []);

  const replaceVideoTrack = useCallback((newTrack: MediaStreamTrack | null) => {
    for (const { pc } of peersRef.current.values()) {
      for (const sender of sendersOfKind(pc, "video")) {
        void sender.replaceTrack(newTrack).catch(() => undefined);
      }
    }
  }, []);

  const ensurePeer = useCallback(
    (peerId: number): RTCPeerConnection => {
      const existing = peersRef.current.get(peerId);
      if (existing) return existing.pc;

      const pc = createPeerConnection();
      const entry: PeerEntry = { pc, pendingCandidates: [] };
      peersRef.current.set(peerId, entry);

      // A peer created while a share is live must receive the screen, not
      // the camera. Audio and video senders are always reserved (via a
      // transceiver when no track exists yet) so `replaceTrack` has
      // somewhere to go even when the camera or microphone was never
      // granted — otherwise a screen share with no camera transmits nothing.
      const shareStream = screenStreamRef.current;
      const sharedVideo = shareStream?.getVideoTracks()[0] ?? null;
      if (localStream) {
        for (const track of localStream.getAudioTracks()) {
          pc.addTrack(track, localStream);
        }
      }
      const outgoingVideo = sharedVideo ?? localStream?.getVideoTracks()[0] ?? null;
      if (outgoingVideo) {
        const owner = sharedVideo === outgoingVideo ? shareStream : localStream;
        if (owner) pc.addTrack(outgoingVideo, owner);
      }
      if (sendersOfKind(pc, "video").length === 0) {
        pc.addTransceiver("video", { direction: "sendrecv" });
      }
      if (sendersOfKind(pc, "audio").length === 0) {
        pc.addTransceiver("audio", { direction: "sendrecv" });
      }

      pc.onicecandidate = (event) => {
        const me = selfIdRef.current;
        if (!event.candidate || me === null) return;
        sendRef.current({
          type: "ice_candidate",
          sender_id: me,
          target_id: peerId,
          payload: event.candidate.toJSON() as RTCIceCandidateInit,
        });
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        setRemoteStreams((current) => ({ ...current, [peerId]: stream }));
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          // Drop the dead peer; the next syncPeers() rebuilds it if the
          // participant is still connected.
          removePeer(peerId);
        }
      };

      return pc;
    },
    [localStream, removePeer]
  );

  const sendOffer = useCallback(
    async (peerId: number): Promise<void> => {
      const me = selfIdRef.current;
      if (me === null || !shouldCreateOffer(me, peerId)) return;
      const pc = ensurePeer(peerId);
      if (pc.remoteDescription || pc.signalingState !== "stable") return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendRef.current({
        type: "offer",
        sender_id: me,
        target_id: peerId,
        payload: descriptionToPayload(pc.localDescription ?? offer),
      });
    },
    [ensurePeer]
  );

  const syncPeers = useCallback(
    (peerIds: number[]) => {
      for (const peerId of peerIds) {
        if (peerId === selfIdRef.current) continue;
        void sendOffer(peerId);
      }
    },
    [sendOffer]
  );

  const handleSignal = useCallback(
    async (message: SignalPayloadMessage): Promise<void> => {
      const { sender_id: peerId, payload } = message;
      if (peerId === selfIdRef.current) return;

      if (message.type === "ice_candidate") {
        const entry = peersRef.current.get(peerId);
        if (!entry) return;
        const candidate = payload as RTCIceCandidateInit;
        if (entry.pc.remoteDescription) {
          await entry.pc.addIceCandidate(candidate).catch(() => undefined);
        } else {
          entry.pendingCandidates.push(candidate);
        }
        return;
      }

      const pc = ensurePeer(peerId);

      if (message.type === "offer") {
        const offer = payload as unknown as RTCSessionDescriptionInit;
        await pc.setRemoteDescription(offer);
        for (const candidate of entryCandidates(peersRef, peerId)) {
          await pc.addIceCandidate(candidate).catch(() => undefined);
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const me = selfIdRef.current;
        if (me !== null) {
          sendRef.current({
            type: "answer",
            sender_id: me,
            target_id: peerId,
            payload: descriptionToPayload(pc.localDescription ?? answer),
          });
        }
        return;
      }

      // answer
      const answer = payload as unknown as RTCSessionDescriptionInit;
      if (!pc.remoteDescription) {
        await pc.setRemoteDescription(answer);
        const entry = peersRef.current.get(peerId);
        for (const candidate of entry?.pendingCandidates ?? []) {
          await pc
            .addIceCandidate(candidate as RTCIceCandidateInit)
            .catch(() => undefined);
        }
        if (entry) entry.pendingCandidates = [];
      }
    },
    [ensurePeer]
  );

  const resetPeers = useCallback(() => {
    for (const peerId of [...peersRef.current.keys()]) {
      removePeer(peerId);
    }
  }, [removePeer]);

  // Attach the local stream when it arrives after peers exist. Switching a
  // device mid-meeting replaces the track on the existing sender instead of
  // adding a second one, so no renegotiation is needed. While a screen share
  // is live the camera must NOT take the sender back — the screen track owns
  // it until sharing ends, and the remembered camera track is refreshed here
  // so a device switch during a share still restores correctly.
  useEffect(() => {
    if (!localStream) return;
    const cameraTrack = localStream.getVideoTracks()[0] ?? null;
    cameraTrackRef.current = cameraTrack;
    for (const { pc } of peersRef.current.values()) {
      if (screenStreamRef.current) {
        // The screen owns the video sender until sharing ends; only the
        // remembered camera is refreshed for the eventual restore. Audio
        // still attaches (e.g. Join Audio while already sharing).
        for (const track of localStream.getAudioTracks()) {
          const [sender] = sendersOfKind(pc, "audio");
          if (sender) {
            void sender.replaceTrack(track).catch(() => undefined);
          } else {
            pc.addTrack(track, localStream);
          }
        }
        continue;
      }
      for (const track of localStream.getTracks()) {
        const [sender] = sendersOfKind(pc, track.kind);
        if (sender) {
          void sender.replaceTrack(track).catch(() => undefined);
        } else {
          pc.addTrack(track, localStream);
        }
      }
    }
  }, [localStream]);

  useEffect(() => {
    const peers = peersRef.current;
    return () => {
      for (const { pc } of peers.values()) pc.close();
      peers.clear();
      cameraTrackRef.current = null;
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
    };
  }, []);

  const stopScreenShare = useCallback(() => {
    if (!screenStreamRef.current) return;
    screenStreamRef.current.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    screenStreamRef.current = null;
    setScreenStream(null);
    replaceVideoTrack(cameraTrackRef.current);
    setIsScreenSharing(false);
  }, [replaceVideoTrack]);

  const startScreenShare = useCallback(async (): Promise<ScreenShareResult> => {
    // A second click while the picker or a previous attempt is in flight
    // must not open another picker or leak a stream.
    if (screenStreamRef.current || sharePendingRef.current) return "busy";
    if (
      typeof navigator === "undefined" ||
      typeof navigator.mediaDevices?.getDisplayMedia !== "function"
    ) {
      return "unsupported";
    }

    sharePendingRef.current = true;
    try {
      let display: MediaStream;
      try {
        display = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
      } catch (cause: unknown) {
        // Chrome reports both a dismissed picker and a denied permission as
        // NotAllowedError; either way nothing changed yet.
        const name = cause instanceof Error ? cause.name : "";
        if (name === "NotAllowedError" || name === "AbortError") {
          return "cancelled";
        }
        // getDisplayMedia exists but is blocked by the browser (e.g. insecure
        // HTTP origin); surface the same message as an unsupported context.
        if (name === "SecurityError") {
          return "unsupported";
        }
        return "error";
      }

      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) {
        display.getTracks().forEach((track) => track.stop());
        return "error";
      }

      cameraTrackRef.current = localStream?.getVideoTracks()[0] ?? null;
      screenStreamRef.current = display;
      setScreenStream(display);
      replaceVideoTrack(screenTrack);
      setIsScreenSharing(true);

      // Stopping from the browser's own floating bar must look identical to
      // stopping from the app: restore the camera and tell the session.
      screenTrack.onended = () => {
        if (screenStreamRef.current !== display) return;
        stopScreenShare();
        onScreenShareStoppedRef.current?.();
      };
      return "started";
    } finally {
      sharePendingRef.current = false;
    }
  }, [localStream, replaceVideoTrack, stopScreenShare]);

  return {
    remoteStreams,
    syncPeers,
    handleSignal,
    closePeer: removePeer,
    resetPeers,
    startScreenShare,
    stopScreenShare,
    isScreenSharing,
    screenStream,
  };
}

function entryCandidates(
  peersRefObj: { current: Map<number, PeerEntry> },
  peerId: number
): RTCIceCandidateInit[] {
  const entry = peersRefObj.current.get(peerId);
  if (!entry) return [];
  const queued = entry.pendingCandidates.splice(0);
  return queued;
}
