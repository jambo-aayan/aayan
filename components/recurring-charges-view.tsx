import { Repeat } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { formatGBP } from "@/lib/finance/format";
import styles from "./recurring-charges-view.module.css";

type RecurringCharge = { source: string; amount: number; occurrences: number };

/** Detected subscriptions/recurring charges (ADR-0012) — reuses
 * lib/finance/statements.ts's detectRecurringCharges exactly as the
 * Statements page already calls it, just also surfaced here so standing
 * charges are visible without a manual statement import. */
export function RecurringChargesView({ charges }: { charges: RecurringCharge[] }) {
  if (charges.length === 0) {
    return <EmptyState icon={Repeat} message="No recurring charges detected yet." />;
  }

  return (
    <ul className={styles.list}>
      {charges.map((c) => (
        <li key={`${c.source}-${c.amount}`} className={styles.row}>
          <span className={styles.source}>{c.source}</span>
          <span className={styles.detail}>
            {formatGBP(c.amount)} · {c.occurrences} months
          </span>
        </li>
      ))}
    </ul>
  );
}
