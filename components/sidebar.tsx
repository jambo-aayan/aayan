"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { NAV_ITEMS } from "./nav-config";
import styles from "./sidebar.module.css";

export function Sidebar({ dailyFocusPercent }: { dailyFocusPercent: number | null }) {
  const pathname = usePathname();

  return (
    <nav className={styles.sidebar} aria-label="Main">
      <div className={styles.brand}>aayan</div>

      <div className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.item} ${active ? styles.active : ""}`}
              style={item.accent ? ({ "--nav-accent": item.accent } as React.CSSProperties) : undefined}
            >
              <Icon size={17} strokeWidth={2} className={styles.icon} />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className={styles.footer}>
        {dailyFocusPercent !== null && (
          <div className={styles.focus}>
            <div className={styles.focusHead}>
              <span>Daily focus</span>
              <span className={styles.focusPercent}>{dailyFocusPercent}%</span>
            </div>
            <div className={styles.focusTrack}>
              <div className={styles.focusFill} style={{ width: `${dailyFocusPercent}%` }} />
            </div>
            <div className={styles.focusHint}>
              {dailyFocusPercent >= 100 ? "All habits checked in" : "Keep going, every day counts."}
            </div>
          </div>
        )}
        <Link
          href="/settings"
          className={`${styles.item} ${pathname === "/settings" ? styles.active : ""}`}
        >
          <Settings size={17} strokeWidth={2} className={styles.icon} />
          Settings
        </Link>
      </div>
    </nav>
  );
}
