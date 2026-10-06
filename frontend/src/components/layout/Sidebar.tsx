"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarIcon,
  HomeIcon,
  MeetingsIcon,
  PlusIcon,
  ScreenShareIcon,
  SettingsIcon,
  UserIcon,
  VideoIcon,
} from "@/components/icons";
import { cx } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/meetings", label: "Meetings", icon: MeetingsIcon },
  { href: "/schedule", label: "Schedule", icon: CalendarIcon },
  { href: "/join", label: "Join a meeting", icon: UserIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

interface SidebarProps {
  open: boolean;
  onNavigate: () => void;
}

export function Sidebar({ open, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard" || pathname === "/"
      : pathname.startsWith(href);

  const startInstantMeeting = () => {
    onNavigate();
    router.push("/new-meeting");
  };

  const shareScreen = () => {
    onNavigate();
    router.push("/new-meeting?share=1");
  };

  return (
    <aside
      id="app-sidebar"
      className={cx("sidebar", open && "sidebar--open")}
      aria-label="Meeting navigation"
    >
      <div className="sidebar__actions">
        <button
          type="button"
          className="sidebar__action sidebar__action--primary"
          onClick={startInstantMeeting}
        >
          <VideoIcon size={18} />
          New Meeting
        </button>
        <button
          type="button"
          className="sidebar__action"
          onClick={() => {
            onNavigate();
            router.push("/join");
          }}
        >
          <PlusIcon size={18} />
          Join
        </button>
        <button
          type="button"
          className="sidebar__action"
          onClick={() => {
            onNavigate();
            router.push("/schedule");
          }}
        >
          <CalendarIcon size={18} />
          Schedule
        </button>
        <button
          type="button"
          className="sidebar__action"
          onClick={shareScreen}
        >
          <ScreenShareIcon size={18} />
          Share screen
        </button>
      </div>

      <div className="sidebar__divider" />

      <nav aria-label="Sections">
        <div className="sidebar__section-label">Menu</div>
        <ul className="nav-list">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cx(
                  "nav-item",
                  isActive(item.href) && "nav-item--active"
                )}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar__footer">Scalar Meet · v1.0</div>
    </aside>
  );
}
