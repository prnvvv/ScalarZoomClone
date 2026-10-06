"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useToast } from "@/components/common/ToastProvider";
import { toUserMessage } from "@/lib/api-client";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_DURATION_MINUTES,
  MAX_TITLE_LENGTH,
} from "@/lib/constants";
import {
  buildStartTimestamp,
  toLocalDateInputValue,
  toLocalTimeInputValue,
  validateScheduleForm,
  type FieldError,
} from "@/lib/validators";
import { scheduleMeeting } from "@/services/scheduleService";

const DEFAULT_DURATION = 30;

/** Next quarter hour, at least an hour out, so the default is always valid. */
function defaultStart(): Date {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  return start;
}

export function ScheduleForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [values, setValues] = useState(() => {
    const start = defaultStart();
    return {
      title: "",
      description: "",
      date: toLocalDateInputValue(start),
      time: toLocalTimeInputValue(start),
      duration: DEFAULT_DURATION,
    };
  });
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorFor = (field: string) =>
    fieldErrors.find((error) => error.field === field)?.message;

  const setValue = (field: keyof typeof values, value: string | number) =>
    setValues((current) => ({ ...current, [field]: value }));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const errors = validateScheduleForm(values);
    setFieldErrors(errors);
    if (errors.length > 0) return;

    const start_time = buildStartTimestamp(values.date, values.time);
    if (!start_time) {
      setFieldErrors([
        { field: "date", message: "That date and time is not valid." },
      ]);
      return;
    }

    setSubmitting(true);
    try {
      await scheduleMeeting({
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        start_time,
        duration: Number(values.duration),
      });
      toast("Meeting scheduled", "success");
      router.push("/meetings");
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

      <div className="form-grid">
        <div className="field form-grid__span">
          <label className="field__label" htmlFor="schedule-title">
            Topic
          </label>
          <input
            id="schedule-title"
            className="input"
            type="text"
            placeholder="Weekly standup"
            value={values.title}
            maxLength={MAX_TITLE_LENGTH}
            autoComplete="off"
            aria-invalid={errorFor("title") ? true : undefined}
            aria-describedby={errorFor("title") ? "schedule-title-error" : undefined}
            onChange={(event) => setValue("title", event.target.value)}
          />
          {errorFor("title") ? (
            <span className="field__error" id="schedule-title-error">
              {errorFor("title")}
            </span>
          ) : null}
        </div>

        <div className="field form-grid__span">
          <label className="field__label" htmlFor="schedule-description">
            Description
          </label>
          <textarea
            id="schedule-description"
            className="textarea"
            placeholder="Agenda, dial-in notes, links (optional)"
            value={values.description}
            maxLength={MAX_DESCRIPTION_LENGTH}
            aria-invalid={errorFor("description") ? true : undefined}
            aria-describedby={
              errorFor("description")
                ? "schedule-description-error"
                : "schedule-description-hint"
            }
            onChange={(event) => setValue("description", event.target.value)}
          />
          {errorFor("description") ? (
            <span className="field__error" id="schedule-description-error">
              {errorFor("description")}
            </span>
          ) : (
            <span className="field__hint" id="schedule-description-hint">
              Optional.
            </span>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="schedule-date">
            Date
          </label>
          <input
            id="schedule-date"
            className="input"
            type="date"
            value={values.date}
            aria-invalid={errorFor("date") ? true : undefined}
            aria-describedby={errorFor("date") ? "schedule-date-error" : undefined}
            onChange={(event) => setValue("date", event.target.value)}
          />
          {errorFor("date") ? (
            <span className="field__error" id="schedule-date-error">
              {errorFor("date")}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="schedule-time">
            Time
          </label>
          <input
            id="schedule-time"
            className="input"
            type="time"
            value={values.time}
            aria-invalid={errorFor("time") ? true : undefined}
            aria-describedby={errorFor("time") ? "schedule-time-error" : undefined}
            onChange={(event) => setValue("time", event.target.value)}
          />
          {errorFor("time") ? (
            <span className="field__error" id="schedule-time-error">
              {errorFor("time")}
            </span>
          ) : null}
        </div>

        <div className="field form-grid__span">
          <label className="field__label" htmlFor="schedule-duration">
            Duration
          </label>
          <input
            id="schedule-duration"
            className="input"
            type="number"
            min={1}
            max={MAX_DURATION_MINUTES}
            step={1}
            value={values.duration}
            aria-invalid={errorFor("duration") ? true : undefined}
            aria-describedby={
              errorFor("duration")
                ? "schedule-duration-error"
                : "schedule-duration-hint"
            }
            onChange={(event) =>
              setValue("duration", Number(event.target.value))
            }
          />
          {errorFor("duration") ? (
            <span className="field__error" id="schedule-duration-error">
              {errorFor("duration")}
            </span>
          ) : (
            <span className="field__hint" id="schedule-duration-hint">
              Minutes, up to {MAX_DURATION_MINUTES}.
            </span>
          )}
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn--primary"
          disabled={submitting}
        >
          {submitting ? "Scheduling…" : "Schedule Meeting"}
        </button>
        <Link href="/meetings" className="btn btn--ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
