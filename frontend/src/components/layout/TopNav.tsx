"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BellIcon,
  HelpIcon,
  MenuIcon,
  SettingsIcon,
  VideoSlashBrandIcon,
} from "@/components/icons";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { APP_NAME } from "@/lib/constants";
import { cx, getInitials } from "@/lib/utils";

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
  const { user } = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const displayName = user?.name ?? "Guest";
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

        <div className="menu-anchor" ref={menuRef}>
          <button
            type="button"
            className="avatar"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Account menu for ${displayName}`}
          >
            {getInitials(displayName)}
          </button>

          {menuOpen ? (
            <div className="menu" role="menu">
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontWeight: 600 }}>{displayName}</div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {user?.email ?? "Signed in as guest"}
                </div>
              </div>
              <div className="menu__divider" />
              <Link
                href="/settings"
                className="menu__item"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                <SettingsIcon size={16} /> Settings
              </Link>
              <button
                type="button"
                className="menu__item"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                <HelpIcon size={16} /> Help &amp; support
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
