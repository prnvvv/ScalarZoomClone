import { AlertIcon } from "@/components/icons";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
}: ErrorStateProps) {
  return (
    <div className="state-block state-block--error" role="alert">
      <div className="state-block__icon">
        <AlertIcon size={24} />
      </div>
      <div className="state-block__title">{title}</div>
      <p className="state-block__text">{message}</p>
      {onRetry ? (
        <div className="state-block__actions">
          <button type="button" className="btn btn--secondary" onClick={onRetry}>
            {retryLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
