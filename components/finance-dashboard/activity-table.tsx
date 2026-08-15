import styles from "./activity-table.module.css";
import dashboardStyles from "./dashboard.module.css";

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

type Transaction = { id: string; date: Date; amount: number; direction: "IN" | "OUT"; category: string };

export function ActivityTable({ transactions }: { transactions: Transaction[] }) {
  const recent = [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);

  return (
    <div className={`${dashboardStyles.bentoCard} ${dashboardStyles.span6}`}>
      <div className={dashboardStyles.cardHead}>Recent activity</div>
      {recent.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>No transactions logged yet.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Category</th>
              <th>Date</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((t) => (
              <tr key={t.id}>
                <td>{t.category}</td>
                <td>{formatDate(t.date)}</td>
                <td className={t.direction === "IN" ? styles.amtPos : styles.amtNeutral}>
                  {t.direction === "IN" ? "+" : "−"}
                  {formatGBP(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
