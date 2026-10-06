import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceSelector } from "./DeviceSelector";

afterEach(cleanup);

function makeDevice(
  deviceId: string,
  kind: MediaDeviceKind,
  label: string
): MediaDeviceInfo {
  return {
    deviceId,
    kind,
    label,
    groupId: "group-1",
    toJSON: () => ({ deviceId, kind, label, groupId: "group-1" }),
  };
}

function renderSelector(
  overrides: Partial<Parameters<typeof DeviceSelector>[0]> = {}
) {
  const handlers = {
    onAudioInputChange: vi.fn(),
    onVideoInputChange: vi.fn(),
    onAudioOutputChange: vi.fn(),
  };
  render(
    <DeviceSelector
      audioInputDevices={[]}
      videoInputDevices={[]}
      audioOutputDevices={[]}
      selectedAudioInputId={null}
      selectedVideoInputId={null}
      selectedAudioOutputId={null}
      canSelectSpeaker
      {...handlers}
      {...overrides}
    />
  );
  return handlers;
}

describe("DeviceSelector", () => {
  it("lists the detected devices as options", () => {
    renderSelector({
      videoInputDevices: [makeDevice("cam-1", "videoinput", "FaceTime HD")],
      audioInputDevices: [makeDevice("mic-1", "audioinput", "MacBook Mic")],
    });

    const camera = screen.getByLabelText<HTMLSelectElement>("Camera");
    const microphone = screen.getByLabelText<HTMLSelectElement>("Microphone");
    expect(camera.options).toHaveLength(1);
    expect(camera.options[0].textContent).toBe("FaceTime HD");
    expect(microphone.options[0].textContent).toBe("MacBook Mic");
  });

  it("reports the chosen device to the caller", () => {
    const { onVideoInputChange, onAudioInputChange } = renderSelector({
      videoInputDevices: [
        makeDevice("cam-1", "videoinput", "Built-in"),
        makeDevice("cam-2", "videoinput", "External"),
      ],
      audioInputDevices: [makeDevice("mic-1", "audioinput", "Built-in")],
      selectedVideoInputId: "cam-1",
    });

    fireEvent.change(screen.getByLabelText("Camera"), {
      target: { value: "cam-2" },
    });
    expect(onVideoInputChange).toHaveBeenCalledWith("cam-2");

    fireEvent.change(screen.getByLabelText("Microphone"), {
      target: { value: "mic-1" },
    });
    expect(onAudioInputChange).toHaveBeenCalledWith("mic-1");
  });

  it("falls back to a readable label when the browser hides device names", () => {
    renderSelector({
      videoInputDevices: [makeDevice("cam-1", "videoinput", "")],
    });
    expect(screen.getByLabelText<HTMLSelectElement>("Camera").options[0].textContent).toBe(
      "Camera 1"
    );
  });

  it("disables the speaker picker when the browser cannot route audio", () => {
    renderSelector({
      canSelectSpeaker: false,
      audioOutputDevices: [makeDevice("out-1", "audiooutput", "Speakers")],
    });
    const speakers = screen.getByLabelText<HTMLSelectElement>("Speakers");
    expect(speakers.disabled).toBe(true);
    expect(speakers.options[0].textContent).toContain("not supported");
  });

  it("disables every picker while devices are busy", () => {
    renderSelector({
      disabled: true,
      videoInputDevices: [makeDevice("cam-1", "videoinput", "Built-in")],
    });
    expect(screen.getByLabelText<HTMLSelectElement>("Camera").disabled).toBe(true);
  });

  it("explains an empty device list instead of showing a blank select", () => {
    renderSelector();
    expect(
      screen.getByLabelText<HTMLSelectElement>("Camera").options[0].textContent
    ).toBe("No camera detected");
    expect(screen.getByLabelText<HTMLSelectElement>("Microphone").disabled).toBe(
      true
    );
  });
});
