"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, X } from "lucide-react";
import { NAV_ITEMS } from "./nav-config";
import styles from "./mobile-nav-drawer.module.css";

export function MobileNavDrawer({
  open,
  onClose,
  dailyFocusPercent,
}: {
  open: boolean;
  onClose: () => void;
  dailyFocusPercent: number | null;
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
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.item} ${active ? styles.active : ""}`}
                style={item.accent ? ({ "--nav-accent": item.accent } as React.CSSProperties) : undefined}
              >
                <Icon size={18} strokeWidth={2} className={styles.icon} />
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
            </div>
          )}
          <Link href="/settings" className={`${styles.item} ${pathname === "/settings" ? styles.active : ""}`}>
            <Settings size={18} strokeWidth={2} className={styles.icon} />
            Settings
          </Link>
        </div>
      </div>
    </>
  );
}
