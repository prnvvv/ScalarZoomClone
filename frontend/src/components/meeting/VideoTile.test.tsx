import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VideoTile } from "./VideoTile";

afterEach(cleanup);

describe("VideoTile", () => {
  it("shows the participant name and avatar initials", () => {
    render(<VideoTile name="Priya Sharma" />);
    expect(screen.getByText("Priya Sharma")).toBeTruthy();
    expect(screen.getByText("PS")).toBeTruthy();
  });

  it("marks muted participants for screen readers", () => {
    render(<VideoTile name="Rahul Verma" isMuted />);
    expect(screen.getByLabelText("Rahul Verma is muted")).toBeTruthy();
  });

  it("does not render a mute status when unmuted", () => {
    render(<VideoTile name="Rahul Verma" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryAllByLabelText(/is muted/)).toHaveLength(0);
  });

  it("shows a host badge only for hosts", () => {
    const { rerender } = render(<VideoTile name="Host User" isHost />);
    expect(screen.getByText("Host")).toBeTruthy();

    rerender(<VideoTile name="Guest User" />);
    expect(screen.queryByText("Host")).toBeNull();
  });

  it("replaces the placeholder with custom children", () => {
    render(
      <VideoTile name="Priya Sharma">
        <video data-testid="tile-video" />
      </VideoTile>
    );
    expect(screen.getByTestId("tile-video")).toBeTruthy();
    expect(screen.queryByText("PS")).toBeNull();
  });
});
