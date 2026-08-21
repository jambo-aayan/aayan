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
  onToggle,
  label,
}: {
  level: "FULL" | "MINIMUM" | null;
  /** The habit's Pillar color, already resolved to hex — falls back to
   * green when unset. Callers resolve from the stored color key
   * themselves (see lib/colors.ts's resolveColorHex), matching
   * TaskCheckbox's accentColor convention. */
  accentColor?: string | null;
  size: number;
  /** Cycles none -> full -> partial -> none, per the handoff's tri-state
   * dot spec. Omit for a display-only dot (e.g. a read-only summary). */
  onToggle?: () => void;
  label?: string;
}) {
  const accent = accentColor ?? "var(--green)";
  const className = `${styles.dot} ${level === "FULL" ? styles.full : ""} ${level === "MINIMUM" ? styles.partial : ""}`;
  const style = { "--habit-accent": accent, width: size, height: size } as React.CSSProperties;

  if (!onToggle) {
    return <span className={className} style={style} aria-hidden />;
  }

  return (
    <button type="button" className={className} style={style} onClick={onToggle} aria-label={label ?? "Cycle check-in"} />
  );
}
