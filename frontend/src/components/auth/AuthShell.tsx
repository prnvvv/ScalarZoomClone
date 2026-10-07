import Link from "next/link";
import { VideoSlashBrandIcon } from "@/components/icons";
import { APP_NAME } from "@/lib/constants";

interface AuthShellProps {
  children: React.ReactNode;
}

/**
 * Full-screen authentication shell used by the Clerk SignIn and SignUp pages.
 * Provides one intentional, centered authentication surface: brand on top and
 * a single panel that Clerk renders flush inside (no card inside a card).
 */
export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="auth-page">
      <header className="auth-page__header">
        <Link href="/" className="auth-page__brand" aria-label={`${APP_NAME} home`}>
          <span className="auth-page__logo">
            <VideoSlashBrandIcon size={36} />
          </span>
          <span className="auth-page__name">{APP_NAME}</span>
        </Link>
      </header>

      <main className="auth-page__main">
        <div className="auth-panel">{children}</div>
      </main>

      <footer className="auth-page__footer">
        <span>Privacy</span>
        <span aria-hidden="true">·</span>
        <span>Terms</span>
      </footer>
    </div>
  );
}
