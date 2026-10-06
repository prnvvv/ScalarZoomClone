import { ScheduleForm } from "@/components/dashboard/ScheduleForm";
import { AppShell } from "@/components/layout/AppShell";

export default function SchedulePage() {
  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Schedule a Meeting</h1>
          <p className="page-header__subtitle">
            Pick a topic, a time and a duration. You get an invite link as
            soon as it is saved.
          </p>
        </div>
      </div>

      <ScheduleForm />
    </AppShell>
  );
}
