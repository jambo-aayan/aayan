import styles from "./card.module.css";

export function Card({ title, children, id }: { title?: string; children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className={styles.card}>
      {title && <div className={styles.title}>{title}</div>}
      {children}
    </div>
  );
}
