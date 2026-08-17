import { Check } from "lucide-react";
import styles from "./task-checkbox.module.css";

export function TaskCheckbox({
  checked,
  onToggle,
  disabled,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  label: string;
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
    >
      {checked && <Check size={13} strokeWidth={3} />}
    </button>
  );
}
