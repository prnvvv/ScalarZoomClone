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
  /** Start screen sharing; replaces the video track in all peer connections. */
  startScreenShare: () => Promise<void>;
  /** Stop screen sharing; restores the camera video track. */
  stopScreenShare: () => void;
  isScreenSharing: boolean;
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
}: UseWebRtcOptions): WebRtcState {
  const peersRef = useRef(new Map<number, PeerEntry>());
  const selfIdRef = useRef(selfId);
  const sendRef = useRef(send);
  const [remoteStreams, setRemoteStreams] = useState<Record<number, MediaStream>>({});
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    selfIdRef.current = selfId;
  }, [selfId]);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

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
  // adding a second one, so no renegotiation is needed.
  useEffect(() => {
    if (!localStream) return;
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

  const replaceVideoTrack = useCallback(
    (newTrack: MediaStreamTrack | null) => {
      for (const { pc } of peersRef.current.values()) {
        const sender = pc
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender) {
          void sender.replaceTrack(newTrack).catch(() => undefined);
        }
      }
    },
    []
  );

  const stopScreenShare = useCallback(() => {
    if (!isScreenSharing) return;
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    replaceVideoTrack(cameraTrackRef.current);
    setIsScreenSharing(false);
  }, [isScreenSharing, replaceVideoTrack]);

  const startScreenShare = useCallback(async () => {
    if (isScreenSharing) return;
    try {
      const displayMedia = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const screenTrack = displayMedia.getVideoTracks()[0];
      if (!screenTrack) {
        displayMedia.getTracks().forEach((t) => t.stop());
        return;
      }

      // Preserve the camera track so we can restore it later.
      if (localStream) {
        cameraTrackRef.current = localStream.getVideoTracks()[0] ?? null;
      }

      screenStreamRef.current = displayMedia;
      replaceVideoTrack(screenTrack);
      setIsScreenSharing(true);

      // When the user stops sharing via the browser's own UI (the floating bar),
      // we need to clean up and restore the camera.
      screenTrack.onended = () => {
        if (isScreenSharing) {
          stopScreenShare();
        }
      };
    } catch {
      // User denied permission or another error; silently ignore.
    }
  },
  [isScreenSharing, localStream, stopScreenShare, replaceVideoTrack]
);

  return {
    remoteStreams,
    syncPeers,
    handleSignal,
    closePeer: removePeer,
    resetPeers,
    startScreenShare,
    stopScreenShare,
    isScreenSharing,
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
