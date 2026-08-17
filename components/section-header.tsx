import styles from "./section-header.module.css";

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className={styles.eyebrow}>{children}</div>;
}
