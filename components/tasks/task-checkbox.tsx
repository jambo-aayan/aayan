import { Check } from "lucide-react";
import styles from "./task-checkbox.module.css";

export function TaskCheckbox({
  checked,
  onToggle,
  disabled,
  label,
  accentColor,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  label: string;
  /** The task's Pillar color (resolved hex), when set — the checked/hover
   * state uses it instead of the default green, one of the "subtle...
   * checkbox/accent state" propagation points from the color system spec. */
  accentColor?: string | null;
}) {
  return (
    <button
      type="button"
      className={`${styles.checkbox} ${checked ? styles.checked : ""}`}
      onClick={onToggle}
      disabled={disabled}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      style={accentColor ? ({ "--task-accent": accentColor } as React.CSSProperties) : undefined}
    >
      {checked && <Check size={13} strokeWidth={3} />}
    </button>
  );
}
