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

  it("attaches a live stream to the video element", () => {
    const stream = { id: "remote-stream" } as unknown as MediaStream;
    render(<VideoTile name="Rahul Verma" stream={stream} />);

    const video = document.querySelector("video");
    expect(video).toBeTruthy();
    expect(video?.srcObject).toBe(stream);
    expect(screen.queryByText("RV")).toBeNull();
  });

  it("keeps the local video muted to avoid echo", () => {
    const stream = { id: "local-stream" } as unknown as MediaStream;
    render(<VideoTile name="You" stream={stream} videoMuted />);
    expect(document.querySelector("video")?.muted).toBe(true);
  });

  it("falls back to the avatar when the camera is off", () => {
    const stream = { id: "remote-stream" } as unknown as MediaStream;
    render(<VideoTile name="Rahul Verma" stream={stream} isVideoOn={false} />);

    expect(document.querySelector("video")).toBeNull();
    expect(screen.getByText("RV")).toBeTruthy();
  });

  it("detaches the stream once the camera is switched off", () => {
    const stream = { id: "remote-stream" } as unknown as MediaStream;
    const { rerender } = render(<VideoTile name="Rahul" stream={stream} />);
    expect(document.querySelector("video")?.srcObject).toBe(stream);

    rerender(<VideoTile name="Rahul" stream={stream} isVideoOn={false} />);
    expect(document.querySelector("video")).toBeNull();
  });
});
