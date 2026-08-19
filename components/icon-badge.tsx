import type { LucideIcon } from "lucide-react";
import styles from "./icon-badge.module.css";

type Accent = "health" | "finance" | "thoughts" | "neutral";

export function IconBadge({
  icon: Icon,
  accent = "neutral",
  size = 36,
  colorOverride,
}: {
  icon: LucideIcon;
  accent?: Accent;
  size?: number;
  /** A Pillar's chosen color (resolved hex), when set, wins over the
   * built-in accent — see lib/colors.ts for why colors propagate this way. */
  colorOverride?: string | null;
}) {
  return (
    <span
      className={`${styles.badge} ${styles[accent]}`}
      style={{
        width: size,
        height: size,
        ...(colorOverride ? { background: `${colorOverride}22`, color: colorOverride } : undefined),
      }}
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  );
}
