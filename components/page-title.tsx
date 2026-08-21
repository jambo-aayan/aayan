import styles from "./page-title.module.css";

/**
 * The "eyebrow-above-title" pattern the design_handoff_aayan README calls
 * out as used on every page — shared so each reskinned page (Pillars,
 * Health, Tasks, Habits, Goals, ...) doesn't reimplement the same three
 * lines of markup/CSS.
 */
export function PageTitle({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.eyebrow}>{eyebrow}</div>
      <h1 className={styles.title}>{title}</h1>
      {lede && <p className={styles.lede}>{lede}</p>}
    </div>
  );
}
