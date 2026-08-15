import styles from "./page-header.module.css";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <div className={styles.topbar}>
        <h2 className={styles.title}>{title}</h2>
      </div>
      {subtitle && (
        <div className={styles.greetRow}>
          <div className={styles.headline}>{subtitle}</div>
        </div>
      )}
    </>
  );
}
