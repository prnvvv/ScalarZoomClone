"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useToast } from "@/components/common/ToastProvider";
import { LinkIcon, VideoIcon } from "@/components/icons";
import { toUserMessage } from "@/lib/api-client";
import { STORAGE_KEYS } from "@/lib/constants";
import {
  extractMeetingId,
  validateJoinInput,
  type FieldError,
} from "@/lib/validators";
import { joinMeeting } from "@/services/meetingService";

export function JoinForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [values, setValues] = useState({ meetingId: "", displayName: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorFor = (field: string) =>
    fieldErrors.find((error) => error.field === field)?.message;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const meetingId = extractMeetingId(values.meetingId);
    const errors = validateJoinInput({
      meetingId,
      displayName: values.displayName,
    });
    setFieldErrors(errors);
    if (errors.length > 0) return;

    setSubmitting(true);
    try {
      await joinMeeting(meetingId, {
        display_name: values.displayName.trim(),
      });
      window.sessionStorage.setItem(
        STORAGE_KEYS.displayName,
        values.displayName.trim()
      );
      toast(`Joining as ${values.displayName.trim()}`, "success");
      router.push(`/meetings/${meetingId}`);
    } catch (error) {
      setSubmitError(toUserMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <form className="form-panel" onSubmit={onSubmit} noValidate>
      {submitError ? (
        <div className="form-error-banner" role="alert">
          {submitError}
        </div>
      ) : null}

      <div className="form-grid form-grid--full">
        <div className="field">
          <label className="field__label" htmlFor="join-meeting-id">
            Meeting ID or invite link
          </label>
          <span className="input-group">
            <span className="input-group__icon" aria-hidden="true">
              <LinkIcon size={16} />
            </span>
            <input
              id="join-meeting-id"
              className="input"
              type="text"
              placeholder="839452761 or https://…/meetings/839452761"
              value={values.meetingId}
              autoComplete="off"
              aria-invalid={errorFor("meetingId") ? true : undefined}
              aria-describedby={
                errorFor("meetingId") ? "join-meeting-id-error" : undefined
              }
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  meetingId: event.target.value,
                }))
              }
            />
          </span>
          {errorFor("meetingId") ? (
            <span className="field__error" id="join-meeting-id-error">
              {errorFor("meetingId")}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="join-display-name">
            Your name
          </label>
          <input
            id="join-display-name"
            className="input"
            type="text"
            placeholder="How others will see you"
            value={values.displayName}
            autoComplete="name"
            aria-invalid={errorFor("displayName") ? true : undefined}
            aria-describedby={
              errorFor("displayName") ? "join-display-name-error" : undefined
            }
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                displayName: event.target.value,
              }))
            }
          />
          {errorFor("displayName") ? (
            <span className="field__error" id="join-display-name-error">
              {errorFor("displayName")}
            </span>
          ) : null}
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn--primary"
          disabled={submitting}
        >
          <VideoIcon size={16} />
          {submitting ? "Joining…" : "Join Meeting"}
        </button>
        <Link href="/dashboard" className="btn btn--ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
