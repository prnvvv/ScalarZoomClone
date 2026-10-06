import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ControlBar } from "./ControlBar";

afterEach(cleanup);

function renderBar(overrides: Partial<Parameters<typeof ControlBar>[0]> = {}) {
  const handlers = {
    onToggleMute: vi.fn(),
    onToggleVideo: vi.fn(),
    onToggleParticipants: vi.fn(),
    onLeave: vi.fn(),
    onToggleScreenShare: vi.fn(),
  };
  render(
    <ControlBar
      isMuted={false}
      isVideoOn
      participantsOpen={false}
      {...handlers}
      {...overrides}
    />
  );
  return handlers;
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

  it("leaves the meeting when Leave is clicked", () => {
    const { onLeave } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Leave meeting" }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("toggles the participants panel", () => {
    const { onToggleParticipants } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Show participants" }));
    expect(onToggleParticipants).toHaveBeenCalledTimes(1);
  });

  it("toggles screen sharing when handler provided", () => {
    const onToggleScreenShare = vi.fn();
    renderBar({ onToggleScreenShare });
    const share = screen.getByRole("button", { name: "Share screen" });
    expect((share as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(share);
    expect(onToggleScreenShare).toHaveBeenCalledTimes(1);
  });

  it("shows stop sharing state when active", () => {
    renderBar({ onToggleScreenShare: vi.fn(), isScreenSharing: true });
    const share = screen.getByRole("button", { name: "Stop sharing screen" });
    expect((share as HTMLButtonElement).disabled).toBe(false);
  });
});
