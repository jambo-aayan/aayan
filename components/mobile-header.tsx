"use client";

import Link from "next/link";
import { Search, Bell } from "lucide-react";
import styles from "./mobile-header.module.css";

export function MobileHeader({
  onMenuClick,
  onSearchClick,
  nudgesUnreadCount,
}: {
  onMenuClick: () => void;
  onSearchClick: () => void;
  nudgesUnreadCount: number;
}) {
  return (
    <header className={styles.header}>
      <button type="button" className={styles.iconButton} onClick={onMenuClick} aria-label="Open menu">
        <span className={styles.hamburgerBar} />
        <span className={styles.hamburgerBar} />
      </button>
      <span className={styles.brand}>aayan</span>
      <div className={styles.actions}>
        <button type="button" className={styles.iconButton} onClick={onSearchClick} aria-label="Search">
          <Search size={17} strokeWidth={2} />
        </button>
        <Link href="/nudges" className={styles.iconButton} aria-label="Nudges">
          <Bell size={17} strokeWidth={2} />
          {nudgesUnreadCount > 0 && <span className={styles.unreadDot} aria-hidden />}
        </Link>
      </div>
    </header>
  );
}
