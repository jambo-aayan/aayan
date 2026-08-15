import { Ring } from "./ring";
import { goalProgressPercent } from "@/lib/finance/goal-math";
import styles from "./dashboard.module.css";

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(
    value
  );
}

export function GoalRingsCard({ goals }: { goals: { id: string; name: string; saved: number; target: number }[] }) {
  return (
    <div className={`${styles.bentoCard} ${styles.span2}`}>
      <div className={styles.cardHead}>Goals</div>
      {goals.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>No goals yet.</p>
      ) : (
        <div style={{ display: "flex", gap: 18, justifyContent: "space-around" }}>
          {goals.slice(0, 3).map((goal) => (
            <div key={goal.id} style={{ textAlign: "center" }}>
              <Ring
                percent={goalProgressPercent(goal.saved, goal.target)}
                size={64}
                centerLabel={`${goalProgressPercent(goal.saved, goal.target)}%`}
              />
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>{goal.name}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 1 }}>
                {formatGBP(goal.saved)} / {formatGBP(goal.target)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
