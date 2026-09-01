"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useDialogFocusTrap } from "@/components/use-dialog-focus-trap";
import styles from "./row-actions.module.css";

/** The shared trailing-actions cluster for every list-manager row
 * (Transactions, Accounts, Habits, Budget vs. actual, Goals, Receivables)
 * — consolidates what was 6 independently copy-pasted `.rowActions` CSS
 * blocks, none with any mobile handling (#143, ADR-0014). Above the app's
 * existing 900px breakpoint, `children` render inline exactly as they
 * always have. Below it, they collapse into a "⋯" overflow menu — `value`
 * (e.g. an amount) is the one thing that never collapses, always visible
 * either way. `gap` overrides the default 10px gap between `value` and the
 * actions, for the one call site (budget-vs-actual) whose original layout
 * used 8px.
 *
 * `children` are rendered twice (once inline, once inside the menu),
 * toggled between by CSS rather than a JS viewport check — this app has
 * no existing media-query hook, and a resize-across-900px mid-interaction
 * is not a real mobile usage pattern (a phone's viewport doesn't change
 * width). A stateful child (e.g. an inline "update value" form) does get
 * two independent live instances as a result, one of them always
 * display:none — an accepted tradeoff for staying CSS-only and consistent
 * with how the rest of the app's responsiveness already works.
 *
 * The menu popup itself stays mounted at all times (visibility toggled via
 * a CSS class, never conditional JSX) — closing it must never unmount a
 * stateful child like an in-progress "update value" form, only hide it.
 * It follows this app's shared dialog/overlay convention
 * (useDialogFocusTrap, role="dialog", Escape-to-close — see
 * mobile-nav-drawer.tsx) and closes on any click inside it, since every
 * action here is a one-shot trigger — except multi-step controls (an
 * expand-in-place form, a <select> whose dropdown shouldn't be dismissed
 * mid-choice) that opt out by stopping click propagation on their own
 * wrapper at the call site. */
export function RowActions({
  value,
  children,
  gap,
}: {
  value?: React.ReactNode;
  children: React.ReactNode;
  gap?: number;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap(menuRef, open);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div className={styles.rowActions} style={gap !== undefined ? { gap: `${gap}px` } : undefined}>
      {value}
      <div className={styles.inline}>{children}</div>
      <div className={styles.menuWrap}>
        <button
          type="button"
          className={styles.menuToggle}
          aria-label="More actions"
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <MoreHorizontal size={16} />
        </button>
        {open && <button type="button" className={styles.menuBackdrop} aria-label="Close menu" onClick={() => setOpen(false)} />}
        <div
          ref={menuRef}
          className={`${styles.menu} ${open ? styles.menuOpen : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Row actions"
          tabIndex={-1}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
