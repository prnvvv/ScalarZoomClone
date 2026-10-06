import { JoinForm } from "@/components/dashboard/JoinForm";
import { AppShell } from "@/components/layout/AppShell";

export default function JoinPage() {
  return (
    <AppShell>
      <div className="join-shell">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Join a Meeting</h1>
            <p className="page-header__subtitle">
              Paste an invite link or type a meeting ID, then tell everyone
              who you are.
            </p>
          </div>
        </div>

        <JoinForm />
      </div>
    </AppShell>
  );
}
