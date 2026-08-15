import { netWorth, type ItemForNetWorth } from "@/lib/finance/net-worth";
import styles from "./net-worth-stats.module.css";

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function NetWorthStats({ items }: { items: ItemForNetWorth[] }) {
  const { accessible, total } = netWorth(items);

  return (
    <div className={styles.row}>
      <div className={styles.stat}>
        <div className={styles.label}>Accessible net worth</div>
        <div className={styles.num}>{formatGBP(accessible)}</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.label}>Total net worth</div>
        <div className={styles.num}>{formatGBP(total)}</div>
        <div className={styles.sub}>excluded items included here only</div>
      </div>
    </div>
  );
}
