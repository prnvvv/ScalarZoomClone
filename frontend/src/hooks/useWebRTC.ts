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

export interface WebRtcState {
  remoteStreams: Record<number, MediaStream>;
  /** Create peers for the connected set; offers when we are the lower id. */
  syncPeers: (peerIds: number[]) => void;
  handleSignal: (message: SignalPayloadMessage) => Promise<void>;
  closePeer: (peerId: number) => void;
  resetPeers: () => void;
  /**
   * Ask the browser for screen/window/tab capture. Resolves `true` only when
   * a usable video track was acquired — a cancelled picker resolves `false`
   * and leaves every piece of state untouched.
   */
  startScreenShare: () => Promise<boolean>;
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
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
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

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
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
    if (screenStreamRef.current) {
      cameraTrackRef.current = cameraTrack;
      return;
    }
    cameraTrackRef.current = cameraTrack;
    for (const { pc } of peersRef.current.values()) {
      for (const track of localStream.getTracks()) {
        const sender = pc
          .getSenders()
          .find((candidate) => candidate.track?.kind === track.kind);
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

  const startScreenShare = useCallback(async (): Promise<boolean> => {
    if (screenStreamRef.current) return false;
    if (
      typeof navigator === "undefined" ||
      typeof navigator.mediaDevices?.getDisplayMedia !== "function"
    ) {
      return false;
    }

    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
    } catch {
      // Picker cancelled or permission denied: nothing changed yet.
      return false;
    }

    const screenTrack = display.getVideoTracks()[0];
    if (!screenTrack) {
      display.getTracks().forEach((track) => track.stop());
      return false;
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
    return true;
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
