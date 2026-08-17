import styles from "./primary-button.module.css";

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className={`${styles.button} ${className ?? ""}`}>
      {children}
    </button>
  );
}
