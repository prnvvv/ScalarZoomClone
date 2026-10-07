import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/common/ToastProvider";
import { ParticipantsPanel } from "./ParticipantsPanel";
import type { ParticipantSummary } from "@/types/participant";

afterEach(cleanup);

function participant(
  id: number,
  displayName: string,
  overrides: Partial<ParticipantSummary> = {}
): ParticipantSummary {
  return {
    id,
    display_name: displayName,
    is_host: false,
    is_muted: false,
    is_video_on: true,
    ...overrides,
  };
}

const ROSTER: ParticipantSummary[] = [
  participant(3, "Carol"),
  participant(1, "Alice", { is_host: true }),
  participant(2, "Bob", { is_muted: true, is_video_on: false }),
];

function renderPanel(
  overrides: Partial<Parameters<typeof ParticipantsPanel>[0]> = {}
) {
  const handlers = {
    onClose: vi.fn(),
    onMuteParticipant: vi.fn(),
    onRemoveParticipant: vi.fn(),
    onMuteAll: vi.fn(),
    onEndMeeting: vi.fn(),
  };
  const view = render(
    <ToastProvider>
      <ParticipantsPanel
        participants={ROSTER}
        meetingId="849201573"
        localName="Bob"
        selfId={2}
        {...handlers}
        {...overrides}
      />
    </ToastProvider>
  );
  return { ...handlers, view };
}

function renderedNames(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(".participant-row__name > span:first-child")
  ).map((node) => node.textContent?.trim() ?? "");
}

describe("ParticipantsPanel", () => {
  it("orders the roster as host, then you, then everyone else", () => {
    const { view } = renderPanel();
    const names = renderedNames(view.container);
    expect(names).toEqual(["Alice", "Bob", "Carol"]);
  });

  it("marks the host and the local participant", () => {
    renderPanel();
    const alice = screen.getByText("Alice").closest(".participant-row");
    expect(alice?.textContent).toContain("Host");
    expect(alice?.textContent).not.toContain("You");

    const bob = screen.getByText("Bob").closest(".participant-row");
    expect(bob?.textContent).toContain("You");
  });

  it("describes mute and camera state for each participant", () => {
    renderPanel();
    const bob = screen.getByText("Bob").closest(".participant-row");
    expect(bob?.textContent).toContain("Muted");
    expect(bob?.textContent).toContain("Camera off");

    const carol = screen.getByText("Carol").closest(".participant-row");
    expect(carol?.textContent).toContain("Unmuted");
    expect(carol?.textContent).toContain("Camera on");
  });

  it("hides host controls from participants", () => {
    renderPanel({ isHost: false });
    expect(screen.queryByRole("button", { name: "Mute everyone except the host" })).toBeNull();
    expect(screen.queryByRole("button", { name: "End meeting for everyone" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mute Carol" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove Carol/ })).toBeNull();
  });

  it("offers host controls only to the host", () => {
    const { onMuteAll, onEndMeeting } = renderPanel({ isHost: true });

    fireEvent.click(screen.getByRole("button", { name: "Mute everyone except the host" }));
    expect(onMuteAll).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "End meeting for everyone" }));
    expect(onEndMeeting).toHaveBeenCalledTimes(1);
  });

  it("mutes and removes the participant a host picks", () => {
    const { onMuteParticipant, onRemoveParticipant } = renderPanel({ isHost: true });

    fireEvent.click(screen.getByRole("button", { name: "Mute Carol" }));
    expect(onMuteParticipant).toHaveBeenCalledWith(3, true);

    fireEvent.click(screen.getByRole("button", { name: "Remove Carol from the meeting" }));
    expect(onRemoveParticipant).toHaveBeenCalledWith(3);
  });

  it("never offers a host action against the local participant", () => {
    renderPanel({ isHost: true });
    expect(screen.queryByRole("button", { name: "Mute Bob" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove Bob/ })).toBeNull();
  });

  it("asks to unmute a participant the host already muted", () => {
    const { onMuteParticipant } = renderPanel({
      isHost: true,
      participants: [participant(5, "Dave", { is_muted: true })],
      selfId: 2,
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Ask Dave to unmute" })
    );
    expect(onMuteParticipant).toHaveBeenCalledWith(5, false);
  });

  it("shows the meeting id and an invite copy action", () => {
    renderPanel();
    expect(screen.getByText("849201573")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy meeting ID" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy invite link" })).toBeTruthy();
  });

  it("closes from the header button", () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Close participants panel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("handles an empty room", () => {
    renderPanel({ participants: [], selfId: null });
    expect(screen.getByText("Nobody else is here yet.")).toBeTruthy();
  });
});
