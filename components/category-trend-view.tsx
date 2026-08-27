import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { formatGBP } from "@/lib/finance/format";
import styles from "./category-trend-view.module.css";

type CategoryTimeSeriesRow = { category: string; totals: number[] };

function formatMonthShort(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date);
}

/** Per-category spend across a trailing window of months (ADR-0012) —
 * reuses lib/finance/statements.ts's categoryTimeSeries exactly as the
 * Statements page already calls it, just also surfaced here so it's
 * visible without a manual statement import. */
export function CategoryTrendView({ months, rows }: { months: Date[]; rows: CategoryTimeSeriesRow[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={BarChart3} message="No spending recorded in this window yet." />;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Category</th>
            {months.map((m) => (
              <th key={m.toISOString()}>{formatMonthShort(m)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.category}>
              <td className={styles.category}>{row.category}</td>
              {row.totals.map((total, i) => (
                <td key={months[i].toISOString()}>{formatGBP(total, true)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
