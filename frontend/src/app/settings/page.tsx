"use client";

import { useState } from "react";
import { useToast } from "@/components/common/ToastProvider";
import { DeviceSelector } from "@/components/meeting/DeviceSelector";
import { AppShell } from "@/components/layout/AppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDisplayNamePreference } from "@/hooks/useDisplayNamePreference";
import { useMediaDevices } from "@/hooks/useMediaDevices";
import { APP_NAME, MAX_DISPLAY_NAME_LENGTH } from "@/lib/constants";

export default function SettingsPage() {
  const { user } = useCurrentUser();
  const { displayName, saveDisplayName } = useDisplayNamePreference();
  const { toast } = useToast();
  const media = useMediaDevices();

  // Seeded from the saved preference; the field owns the value while editing.
  const [name, setName] = useState(displayName);
  const [nameError, setNameError] = useState<string | null>(null);

  const submitName = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Enter the name other participants will see.");
      return;
    }
    if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
      setNameError(
        `Keep your name under ${MAX_DISPLAY_NAME_LENGTH} characters.`
      );
      return;
    }
    setNameError(null);
    saveDisplayName(trimmed);
    toast("Display name saved", "success");
  };

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Settings</h1>
          <p className="page-header__subtitle">
            Preferences are saved for this browser tab only.
          </p>
        </div>
      </div>

      <div className="section__body settings">
        <section className="card card--pad" aria-labelledby="settings-profile">
          <div className="card__header">
            <h2 className="card__title" id="settings-profile">
              Profile
            </h2>
          </div>
          <p className="card__subtitle">
            This build has no sign-in. The name below is what you join meetings
            with.
          </p>

          <form className="settings__form" onSubmit={submitName} noValidate>
            <div className="field">
              <label className="field__label" htmlFor="settings-display-name">
                Display name
              </label>
              <input
                id="settings-display-name"
                className={
                  nameError ? "input input--invalid" : "input"
                }
                value={name}
                maxLength={MAX_DISPLAY_NAME_LENGTH}
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameError) setNameError(null);
                }}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? "settings-display-name-error" : undefined}
              />
              {nameError ? (
                <p className="field__error" id="settings-display-name-error">
                  {nameError}
                </p>
              ) : (
                <p className="field__hint">
                  Shown to everyone else in the meeting.
                </p>
              )}
            </div>

            {user ? (
              <p className="settings__meta">
                Signed in as {user.name} · {user.email}
              </p>
            ) : null}

            <div>
              <button type="submit" className="btn btn--primary">
                Save display name
              </button>
            </div>
          </form>
        </section>

        <section className="card card--pad" aria-labelledby="settings-devices">
          <div className="card__header">
            <h2 className="card__title" id="settings-devices">
              Audio and video
            </h2>
          </div>
          <p className="card__subtitle">
            These devices are used when you join a meeting. Camera and
            microphone access is requested when you enter a room.
          </p>

          <DeviceSelector
            audioInputDevices={media.audioInputDevices}
            videoInputDevices={media.videoInputDevices}
            audioOutputDevices={media.audioOutputDevices}
            selectedAudioInputId={media.selectedAudioInputId}
            selectedVideoInputId={media.selectedVideoInputId}
            selectedAudioOutputId={media.selectedAudioOutputId}
            canSelectSpeaker={media.canSelectSpeaker}
            onAudioInputChange={media.setAudioInput}
            onVideoInputChange={media.setVideoInput}
            onAudioOutputChange={media.setAudioOutput}
          />

          {media.audioInputDevices.length === 0 &&
          media.videoInputDevices.length === 0 ? (
            <p className="field__hint">
              No devices detected yet. Allow camera and microphone access, then
              reload this page.
            </p>
          ) : null}
        </section>

        <section className="card card--pad" aria-labelledby="settings-appearance">
          <div className="card__header">
            <h2 className="card__title" id="settings-appearance">
              Appearance
            </h2>
          </div>
          <p className="card__subtitle">
            The workspace uses a light theme and the meeting room uses a dark
            one, so video is always the focus. There is no theme switch yet.
          </p>
        </section>

        <section className="card card--pad" aria-labelledby="settings-about">
          <div className="card__header">
            <h2 className="card__title" id="settings-about">
              About
            </h2>
          </div>
          <p className="card__subtitle">{APP_NAME}</p>
        </section>
      </div>
    </AppShell>
  );
}
