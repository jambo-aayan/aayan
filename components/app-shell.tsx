"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { MobileHeader } from "./mobile-header";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { CommandPalette } from "./command-palette";
import type { DailyFocusHabit } from "./daily-focus-types";
import type { PaletteItem } from "@/lib/palette/types";
import type { PillarNavItem } from "./nav-config";
import styles from "./app-shell.module.css";

export function AppShell({
  dailyFocusHabits,
  nudgesUnreadCount,
  paletteItems,
  pillarNavItems,
  children,
}: {
  dailyFocusHabits: DailyFocusHabit[];
  nudgesUnreadCount: number;
  paletteItems: PaletteItem[];
  pillarNavItems: PillarNavItem[];
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className={styles.shell}>
      <Sidebar
        dailyFocusHabits={dailyFocusHabits}
        nudgesUnreadCount={nudgesUnreadCount}
        pillarNavItems={pillarNavItems}
        onSearchClick={() => setPaletteOpen(true)}
      />
      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        dailyFocusHabits={dailyFocusHabits}
        nudgesUnreadCount={nudgesUnreadCount}
        pillarNavItems={pillarNavItems}
      />
      <div className={styles.main}>
        <MobileHeader
          onMenuClick={() => setDrawerOpen(true)}
          onSearchClick={() => setPaletteOpen(true)}
          nudgesUnreadCount={nudgesUnreadCount}
        />
        <main className={styles.content}>{children}</main>
      </div>
      <CommandPalette items={paletteItems} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
