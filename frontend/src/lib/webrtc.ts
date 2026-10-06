import { STUN_SERVER } from "@/lib/constants";

/** RTCConfiguration with the configured STUN server; no hardcoded TURN. */
export function peerConnectionConfig(): RTCConfiguration {
  return {
    iceServers: [{ urls: STUN_SERVER }],
  };
}

/**
 * Deterministic glare handling: for a pair of participants the one with the
 * lower `participant_id` creates the offer; the other answers.
 */
export function shouldCreateOffer(selfId: number, otherId: number): boolean {
  return selfId < otherId;
}

/** One `RTCPeerConnection` per remote participant. Media never touches the server. */
export function createPeerConnection(
  config: RTCConfiguration = peerConnectionConfig()
): RTCPeerConnection {
  return new RTCPeerConnection(config);
}

/** SDP/ICE payloads are forwarded untouched as plain JSON. */
export function descriptionToPayload(
  description: RTCSessionDescription | RTCSessionDescriptionInit
): Record<string, unknown> {
  return {
    type: description.type,
    sdp: description.sdp,
  } as Record<string, unknown>;
}
