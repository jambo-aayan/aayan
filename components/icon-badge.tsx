import type { LucideIcon } from "lucide-react";
import styles from "./icon-badge.module.css";

type Accent = "health" | "finance" | "thoughts" | "neutral";

export function IconBadge({ icon: Icon, accent = "neutral", size = 36 }: { icon: LucideIcon; accent?: Accent; size?: number }) {
  return (
    <span className={`${styles.badge} ${styles[accent]}`} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  );
}
