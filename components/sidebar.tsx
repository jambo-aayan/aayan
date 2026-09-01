"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { NAV_BEFORE_PILLARS, NAV_AFTER_PILLARS, type PillarNavItem } from "./nav-config";
import { HabitDot } from "./habit-dot";
import { useDailyFocusHabits } from "./use-daily-focus-habits";
import type { DailyFocusHabit } from "./daily-focus-types";
import styles from "./sidebar.module.css";

export function Sidebar({
  dailyFocusHabits: initialDailyFocusHabits,
  nudgesUnreadCount,
  pillarNavItems,
  onSearchClick,
}: {
  dailyFocusHabits: DailyFocusHabit[];
  nudgesUnreadCount: number;
  pillarNavItems: PillarNavItem[];
  onSearchClick: () => void;
}) {
  const pathname = usePathname();
  const { habits: dailyFocusHabits, toggle } = useDailyFocusHabits(initialDailyFocusHabits);
  const doneCount = dailyFocusHabits.filter((h) => h.todayLevel !== null).length;

  return (
    <nav className={styles.sidebar} aria-label="Main">
      <div className={styles.wordmark}>
        <span className={styles.wordmarkBadge}>a</span>
        aayan
      </div>

      <button type="button" className={styles.search} onClick={onSearchClick}>
        <Search size={15} strokeWidth={2} />
        <span className={styles.searchPlaceholder}>Search or jump…</span>
        <span className={styles.keycap}>⌘K</span>
      </button>

      <div className={styles.nav}>
        {NAV_BEFORE_PILLARS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`${styles.item} ${active ? styles.active : ""}`}>
              <Icon size={17} strokeWidth={2} className={styles.icon} />
              {item.label}
            </Link>
          );
        })}
        {pillarNavItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.id} href={item.href} className={`${styles.item} ${active ? styles.active : ""}`}>
              <span className={styles.icon}>
                <HabitDot level="FULL" accentColor={item.color} size={9} />
              </span>
              {item.label}
            </Link>
          );
        })}
        {NAV_AFTER_PILLARS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`${styles.item} ${active ? styles.active : ""}`}>
              <Icon size={17} strokeWidth={2} className={styles.icon} />
              {item.label}
              {item.href === "/nudges" && nudgesUnreadCount > 0 && (
                <span className={styles.badge}>{nudgesUnreadCount}</span>
              )}
            </Link>
          );
        })}
      </div>

      <Link href="/weekly-review" className={styles.reviewCta}>
        <span className={styles.reviewEyebrow}>Sunday ritual</span>
        <span className={styles.reviewTitle}>Weekly review</span>
        <span className={styles.reviewMeta}>5 steps · about 6 minutes</span>
      </Link>

      <div className={styles.spacer} />

      {dailyFocusHabits.length > 0 && (
        <div className={styles.focus}>
          <div className={styles.focusHead}>
            <span className={styles.focusEyebrow}>Daily focus</span>
            <span className={styles.focusCount}>
              {doneCount}/{dailyFocusHabits.length}
            </span>
          </div>
          <div className={styles.focusRows}>
            {dailyFocusHabits.slice(0, 3).map((habit) => (
              <div key={habit.id} className={styles.focusRow}>
                <HabitDot
                  level={habit.todayLevel}
                  accentColor={habit.pillarColor}
                  size={13}
                  onToggle={() => toggle(habit)}
                  label={`Check in "${habit.name}": currently ${habit.todayLevel ?? "not checked in"}`}
                />
                <span className={habit.todayLevel === "FULL" ? styles.focusRowNameDone : styles.focusRowName}>
                  {habit.name}
                </span>
              </div>
            ))}
          </div>
          <Link href="/habits" className={styles.focusLink}>
            All habits →
          </Link>
        </div>
      )}
    </nav>
  );
}
