"use client";

import { useEffect, useState } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared focus-trapping and restore-focus-on-close behavior for every
 * dialog/sheet/drawer in the app (command palette, task/habit composers,
 * drill-down sheet, mobile nav drawer) — one place to get it right instead
 * of five near-identical Tab-trap effects. Escape-to-close stays each
 * component's own concern since it already differs slightly per dialog.
 */
export function useDialogFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active = true) {
  const [previouslyFocused, setPreviouslyFocused] = useState<HTMLElement | null>(null);
  const [wasActive, setWasActive] = useState(false);

  // Captured during render (React's blessed pattern for state that tracks
  // a transitioning prop), not inside the effect below: an autoFocus input
  // in the dialog's own JSX steals document.activeElement before a
  // useEffect would ever run, so by the time an effect could read it, it's
  // already the dialog's own input instead of whatever opened it. Reading
  // it here, synchronously before this render commits, still sees the
  // pre-transition element.
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setPreviouslyFocused(document.activeElement as HTMLElement | null);
  }

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (container && !container.contains(document.activeElement)) {
      const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? container).focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !container) return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [active, containerRef, previouslyFocused]);
}
