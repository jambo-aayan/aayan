import styles from "./category-breakdown-view.module.css";

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

export function CategoryBreakdownView({
  breakdown,
}: {
  breakdown: { category: string; total: number }[];
}) {
  if (breakdown.length === 0) {
    return <p className={styles.empty}>No spending recorded this month yet.</p>;
  }

  const max = Math.max(...breakdown.map((b) => b.total));

  return (
    <ul className={styles.list}>
      {breakdown.map((b) => (
        <li key={b.category} className={styles.row}>
          <div className={styles.top}>
            <span className={styles.category}>{b.category}</span>
            <span className={styles.total}>{formatGBP(b.total)}</span>
          </div>
          <div className={styles.bar}>
            <div className={styles.barFill} style={{ width: `${(b.total / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
