import { describe, expect, it } from "vitest";
import {
  descriptionToPayload,
  peerConnectionConfig,
  shouldCreateOffer,
} from "./webrtc";
import { STUN_SERVER } from "@/lib/constants";

describe("shouldCreateOffer", () => {
  it("lets the lower participant id offer", () => {
    expect(shouldCreateOffer(1, 2)).toBe(true);
  });

  it("makes the higher participant id answer", () => {
    expect(shouldCreateOffer(2, 1)).toBe(false);
  });

  it("never lets a participant offer to itself", () => {
    expect(shouldCreateOffer(4, 4)).toBe(false);
  });

  it("resolves glare the same way for both sides of a pair", () => {
    const pair = [7, 12] as const;
    const offers = pair.filter((self) => shouldCreateOffer(self, pair[0] === self ? pair[1] : pair[0]));
    expect(offers).toHaveLength(1);
  });
});

describe("peerConnectionConfig", () => {
  it("uses the configured STUN server and no hardcoded TURN", () => {
    const config = peerConnectionConfig();
    expect(config.iceServers).toEqual([{ urls: STUN_SERVER }]);
    expect(JSON.stringify(config)).not.toContain("turn:");
  });
});

describe("descriptionToPayload", () => {
  it("forwards the SDP untouched", () => {
    const payload = descriptionToPayload({
      type: "offer",
      sdp: "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n",
    });
    expect(payload).toEqual({
      type: "offer",
      sdp: "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n",
    });
  });

  it("accepts a live RTCSessionDescription", () => {
    const payload = descriptionToPayload({
      type: "answer",
      sdp: "v=0",
    } as RTCSessionDescription);
    expect(payload).toEqual({ type: "answer", sdp: "v=0" });
  });
});
