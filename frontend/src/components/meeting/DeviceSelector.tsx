"use client";

import { deviceLabel } from "@/hooks/useMediaDevices";

interface DeviceSelectorProps {
  audioInputDevices: MediaDeviceInfo[];
  videoInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  selectedAudioInputId: string | null;
  selectedVideoInputId: string | null;
  selectedAudioOutputId: string | null;
  /** False on browsers without `HTMLMediaElement.setSinkId`. */
  canSelectSpeaker: boolean;
  disabled?: boolean;
  onAudioInputChange: (deviceId: string) => void;
  onVideoInputChange: (deviceId: string) => void;
  onAudioOutputChange: (deviceId: string) => void;
}

interface DeviceFieldProps {
  id: string;
  label: string;
  devices: MediaDeviceInfo[];
  value: string | null;
  disabled: boolean;
  emptyLabel: string;
  onChange: (deviceId: string) => void;
}

function DeviceField({
  id,
  label,
  devices,
  value,
  disabled,
  emptyLabel,
  onChange,
}: DeviceFieldProps) {
  return (
    <div className="field room-device__field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="select room-device__select"
        value={value ?? ""}
        disabled={disabled || devices.length === 0}
        onChange={(event) => onChange(event.target.value)}
      >
        {devices.length === 0 ? (
          <option value="">{emptyLabel}</option>
        ) : (
          devices.map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>
              {deviceLabel(device, index)}
            </option>
          ))
        )}
      </select>
    </div>
  );
}

/** Camera / microphone / speaker pickers for the room settings panel. */
export function DeviceSelector({
  audioInputDevices,
  videoInputDevices,
  audioOutputDevices,
  selectedAudioInputId,
  selectedVideoInputId,
  selectedAudioOutputId,
  canSelectSpeaker,
  disabled = false,
  onAudioInputChange,
  onVideoInputChange,
  onAudioOutputChange,
}: DeviceSelectorProps) {
  return (
    <div className="room-device">
      <DeviceField
        id="room-device-camera"
        label="Camera"
        devices={videoInputDevices}
        value={selectedVideoInputId}
        disabled={disabled}
        emptyLabel="No camera detected"
        onChange={onVideoInputChange}
      />
      <DeviceField
        id="room-device-microphone"
        label="Microphone"
        devices={audioInputDevices}
        value={selectedAudioInputId}
        disabled={disabled}
        emptyLabel="No microphone detected"
        onChange={onAudioInputChange}
      />
      <DeviceField
        id="room-device-speaker"
        label="Speakers"
        devices={canSelectSpeaker ? audioOutputDevices : []}
        value={selectedAudioOutputId}
        disabled={disabled || !canSelectSpeaker}
        emptyLabel={
          canSelectSpeaker
            ? "No speaker detected"
            : "Speaker selection is not supported by this browser"
        }
        onChange={onAudioOutputChange}
      />
    </div>
  );
}
