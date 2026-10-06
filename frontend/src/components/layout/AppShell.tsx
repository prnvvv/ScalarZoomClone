"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="app-shell">
      <TopNav
        onMenuToggle={() => setSidebarOpen((open) => !open)}
        sidebarOpen={sidebarOpen}
      />
      <div className="app-body">
        <Sidebar open={sidebarOpen} onNavigate={closeSidebar} />
        {sidebarOpen ? (
          <div
            className="sidebar-backdrop"
            onClick={closeSidebar}
            role="presentation"
          />
        ) : null}
        <main className="app-main">
          <div className="app-main__inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
