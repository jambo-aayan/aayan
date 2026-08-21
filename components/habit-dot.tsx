import { resolveColorHex, type ColorKey } from "@/lib/colors";
import styles from "./habit-dot.module.css";

/**
 * The tri-state check-in dot per the design_handoff_aayan README's spec:
 * none = transparent w/ faint border, full = solid accent fill, minimum
 * ("partial" in the handoff's vocabulary) = a 50/50 gradient fill. This is
 * the display-only 13px sidebar-widget size; #53 (Habit row reskin) adds
 * the larger tappable 20px/30px variants used in rows and My Day cards.
 */
export function HabitDot({
  level,
  accentColor,
  size,
}: {
  level: "FULL" | "MINIMUM" | null;
  /** The habit's Pillar color key — falls back to green when unset. */
  accentColor?: string | null;
  size: number;
}) {
  const accent = resolveColorHex(accentColor as ColorKey | null) ?? "var(--green)";
  return (
    <span
      className={`${styles.dot} ${level === "FULL" ? styles.full : ""} ${level === "MINIMUM" ? styles.partial : ""}`}
      style={{ "--habit-accent": accent, width: size, height: size } as React.CSSProperties}
      aria-hidden
    />
  );
}
