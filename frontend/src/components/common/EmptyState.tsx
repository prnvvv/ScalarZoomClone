import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

function DefaultInboxIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 13.5h4.5l1.6 3h5.8l1.6-3H21" />
      <path d="M5.6 5h12.8a2 2 0 0 1 1.9 1.4L21 13.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4.5l.7-7.1A2 2 0 0 1 5.6 5Z" />
    </svg>
  );
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="state-block">
      <div className="state-block__icon">{icon ?? <DefaultInboxIcon />}</div>
      <div className="state-block__title">{title}</div>
      {description ? <p className="state-block__text">{description}</p> : null}
      {action ? <div className="state-block__actions">{action}</div> : null}
    </div>
  );
}
