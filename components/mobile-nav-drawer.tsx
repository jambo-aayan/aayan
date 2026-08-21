"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAV_ITEMS } from "./nav-config";
import { HabitDot } from "./habit-dot";
import type { DailyFocusHabit } from "./daily-focus-types";
import styles from "./mobile-nav-drawer.module.css";

export function MobileNavDrawer({
  open,
  onClose,
  dailyFocusHabits,
  nudgesUnreadCount,
}: {
  open: boolean;
  onClose: () => void;
  dailyFocusHabits: DailyFocusHabit[];
  nudgesUnreadCount: number;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      <div
        className={`${styles.overlay} ${open ? styles.overlayOpen : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div className={`${styles.drawer} ${open ? styles.drawerOpen : ""}`} role="dialog" aria-modal="true" aria-label="Navigation">
        <div className={styles.head}>
          <span className={styles.brand}>aayan</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close menu">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`${styles.item} ${active ? styles.active : ""}`}>
                <Icon size={18} strokeWidth={2} className={styles.icon} />
                {item.label}
                {item.href === "/nudges" && nudgesUnreadCount > 0 && (
                  <span className={styles.badge}>{nudgesUnreadCount}</span>
                )}
              </Link>
            );
          })}
        </div>
        {dailyFocusHabits.length > 0 && (
          <>
            <div className={styles.divider} />
            <div className={styles.focusRows}>
              {dailyFocusHabits.slice(0, 3).map((habit) => (
                <div key={habit.id} className={styles.focusRow}>
                  <HabitDot level={habit.todayLevel} accentColor={habit.pillarColor} size={13} />
                  <span className={habit.todayLevel === "FULL" ? styles.focusRowNameDone : styles.focusRowName}>
                    {habit.name}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
