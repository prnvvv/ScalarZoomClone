"use client";

import {
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellIcon,
  HelpIcon,
  MenuIcon,
  SettingsIcon,
  VideoSlashBrandIcon,
} from "@/components/icons";
import { APP_NAME } from "@/lib/constants";
import { cx } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/meetings", label: "Meetings" },
  { href: "/schedule", label: "Schedule" },
  { href: "/join", label: "Join" },
];

interface TopNavProps {
  onMenuToggle: () => void;
  sidebarOpen: boolean;
}

export function TopNav({ onMenuToggle, sidebarOpen }: TopNavProps) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard" || pathname === "/"
      : pathname.startsWith(href);

  return (
    <header className="topnav">
      <button
        type="button"
        className="icon-button topnav__menu-toggle"
        onClick={onMenuToggle}
        aria-expanded={sidebarOpen}
        aria-controls="app-sidebar"
        aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
      >
        <MenuIcon />
      </button>

      <Link href="/dashboard" className="brand" aria-label={`${APP_NAME} home`}>
        <span className="brand__mark">
          <VideoSlashBrandIcon size={30} />
        </span>
        <span className="brand__name">{APP_NAME}</span>
      </Link>

      <nav className="topnav__links" aria-label="Primary">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cx(
              "topnav__link",
              isActive(link.href) && "topnav__link--active"
            )}
            aria-current={isActive(link.href) ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="topnav__spacer" />

      <div className="topnav__actions">
        <button type="button" className="icon-button" aria-label="Help">
          <HelpIcon />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Notifications"
        >
          <BellIcon />
        </button>

        <Show when="signed-out">
          <SignInButton mode="modal">
            <button type="button" className="btn btn--secondary btn--sm">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button type="button" className="btn btn--primary btn--sm">
              Sign up
            </button>
          </SignUpButton>
        </Show>

        <Show when="signed-in">
          <Link
            href="/settings"
            className="icon-button"
            aria-label="Settings"
          >
            <SettingsIcon />
          </Link>
          <UserButton />
        </Show>
      </div>
    </header>
  );
}
