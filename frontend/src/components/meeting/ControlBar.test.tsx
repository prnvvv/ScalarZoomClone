import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ControlBar } from "./ControlBar";

afterEach(cleanup);

beforeEach(() => {
  // jsdom ships no media devices; give the share control a screen-capture API.
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getDisplayMedia: vi.fn().mockResolvedValue(null),
      enumerateDevices: vi.fn().mockResolvedValue([]),
    },
  });
});

const devices = {
  audioInputDevices: [] as MediaDeviceInfo[],
  videoInputDevices: [] as MediaDeviceInfo[],
  selectedAudioInputId: null,
  selectedVideoInputId: null,
  setAudioInput: vi.fn(),
  setVideoInput: vi.fn(),
};

function renderBar(overrides: Partial<Parameters<typeof ControlBar>[0]> = {}) {
  const handlers = {
    onToggleMute: vi.fn(),
    onToggleVideo: vi.fn(),
    onToggleParticipants: vi.fn(),
    onLeave: vi.fn(),
    onToggleScreenShare: vi.fn(),
    onReact: vi.fn(),
    onSetLayout: vi.fn(),
    onOpenSettings: vi.fn(),
    onToggleFullscreen: vi.fn(),
    onCopyInvite: vi.fn(),
  };
  render(
    <ControlBar
      isMuted={false}
      isVideoOn
      audioAvailable
      videoAvailable
      participantsOpen={false}
      isScreenSharing={false}
      isHost={false}
      layout="auto"
      isFullscreen={false}
      fullscreenSupported
      devices={devices}
      {...handlers}
      {...overrides}
    />
  );
  return handlers;
}

function toolbarLabels(): string[] {
  const toolbar = screen.getByRole("toolbar", { name: "Meeting controls" });
  return Array.from(toolbar.querySelectorAll("button")).map((button) => {
    const label =
      button.getAttribute("aria-label") ??
      button.textContent?.trim() ??
      "";
    return label;
  });
}

describe("ControlBar", () => {
  it("toggles mute and reflects the muted state", () => {
    const { onToggleMute } = renderBar();
    const mute = screen.getByRole("button", { name: "Mute microphone" });
    expect(mute.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(mute);
    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });

  it("shows unmute controls while muted", () => {
    renderBar({ isMuted: true, isVideoOn: false });
    expect(screen.getByRole("button", { name: "Unmute microphone" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Turn camera on" })).toBeTruthy();
  });

  it("leaves the meeting when End is clicked", () => {
    const { onLeave } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Leave meeting" }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("toggles the participants panel", () => {
    const { onToggleParticipants } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Show participants" }));
    expect(onToggleParticipants).toHaveBeenCalledTimes(1);
  });

  it("toggles screen sharing", () => {
    const { onToggleScreenShare } = renderBar();
    const share = screen.getByRole("button", { name: "Share screen" });

    fireEvent.click(share);
    expect(onToggleScreenShare).toHaveBeenCalledTimes(1);
  });

  it("disables share when screen capture is unsupported", () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    renderBar();
    const share = screen.getByRole("button", { name: "Share screen" });
    expect((share as HTMLButtonElement).disabled).toBe(true);
    expect(share.getAttribute("title")).toMatch(/HTTPS/);
  });

  it("shows stop sharing state when active", () => {
    renderBar({ isScreenSharing: true });
    expect(
      screen.getByRole("button", { name: "Stop sharing screen" })
    ).toBeTruthy();
  });

  it("orders controls like Zoom: Audio, Video, Participants, React, Share, More, End", () => {
    renderBar();
    const labels = toolbarLabels();
    const expected = [
      "Mute microphone",
      "Turn camera off",
      "Show participants",
      "Open reactions",
      "Share screen",
      "Open more options",
      "Leave meeting",
    ];
    let cursor = -1;
    for (const label of expected) {
      const index = labels.indexOf(label);
      expect(index).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("never renders a Chat control", () => {
    renderBar();
    expect(screen.queryByRole("button", { name: /chat/i })).toBeNull();
    expect(screen.queryByText("Chat")).toBeNull();
  });

  it("hides host tools unless the server says we are host", () => {
    renderBar({ isHost: false });
    expect(screen.queryByRole("button", { name: "Open host tools" })).toBeNull();
  });

  it("shows host tools for the host and opens the host menu", () => {
    renderBar({ isHost: true });
    const hostTools = screen.getByRole("button", { name: "Open host tools" });
    expect(toolbarLabels().indexOf("Open host tools")).toBeGreaterThan(
      toolbarLabels().indexOf("Share screen")
    );

    fireEvent.click(hostTools);
    expect(screen.getByText("Mute everyone")).toBeTruthy();
    expect(screen.getByText("End meeting for all")).toBeTruthy();
  });

  it("opens reactions and reports the chosen emoji", () => {
    const { onReact } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Open reactions" }));
    const emoji = screen.getAllByRole("button").find((button) =>
      (button.getAttribute("aria-label") ?? "").includes("React with")
    );
    expect(emoji).toBeTruthy();
    fireEvent.click(emoji as HTMLElement);
    expect(onReact).toHaveBeenCalledTimes(1);
  });

  it("opens audio settings from the audio menu", () => {
    const { onOpenSettings } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Audio options" }));
    fireEvent.click(screen.getByText("Audio settings…"));
    expect(onOpenSettings).toHaveBeenCalledWith("audio");
  });

  it("reports the chosen layout from the More menu", () => {
    const { onSetLayout } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Open more options" }));
    fireEvent.click(screen.getByText("Speaker view"));
    expect(onSetLayout).toHaveBeenCalledWith("speaker");
  });

  it("opens settings from the More menu", () => {
    const { onOpenSettings } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Open more options" }));
    fireEvent.click(screen.getByText("Settings…"));
    expect(onOpenSettings).toHaveBeenCalledWith("general");
  });
});
