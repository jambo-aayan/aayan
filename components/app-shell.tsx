"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { MobileHeader } from "./mobile-header";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import type { DailyFocusHabit } from "./daily-focus-types";
import styles from "./app-shell.module.css";

export function AppShell({
  dailyFocusHabits,
  nudgesUnreadCount,
  children,
}: {
  dailyFocusHabits: DailyFocusHabit[];
  nudgesUnreadCount: number;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <Sidebar dailyFocusHabits={dailyFocusHabits} nudgesUnreadCount={nudgesUnreadCount} />
      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        dailyFocusHabits={dailyFocusHabits}
        nudgesUnreadCount={nudgesUnreadCount}
      />
      <div className={styles.main}>
        <MobileHeader onMenuClick={() => setDrawerOpen(true)} nudgesUnreadCount={nudgesUnreadCount} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
