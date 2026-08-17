"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { MobileHeader } from "./mobile-header";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import styles from "./app-shell.module.css";

export function AppShell({
  dailyFocusPercent,
  children,
}: {
  dailyFocusPercent: number | null;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <Sidebar dailyFocusPercent={dailyFocusPercent} />
      <MobileNavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} dailyFocusPercent={dailyFocusPercent} />
      <div className={styles.main}>
        <MobileHeader onMenuClick={() => setDrawerOpen(true)} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
