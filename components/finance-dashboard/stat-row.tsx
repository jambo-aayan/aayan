import styles from "./dashboard.module.css";
import { formatGBP } from "@/lib/finance/format";
import { CHART_COLORS } from "@/lib/finance/palette";

function StatCard({
  color,
  label,
  value,
  sub,
}: {
  color: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statTop}>
        <span className={styles.statSwatch} style={{ background: color }} />
        <span className={styles.statLabel}>{label}</span>
      </div>
      <div className={styles.statNum}>{value}</div>
      <div className={styles.statSub}>{sub}</div>
    </div>
  );
}

export function StatRow({
  accessible,
  total,
  surplus,
  northStarPercent,
}: {
  accessible: number;
  total: number;
  surplus: number;
  northStarPercent: number | null;
}) {
  return (
    <div className={styles.statRow}>
      <StatCard
        color={CHART_COLORS.coral}
        label="Accessible net worth"
        value={formatGBP(accessible, true)}
        sub="excludes e.g. pension"
      />
      <StatCard
        color={CHART_COLORS.slate}
        label="Total net worth"
        value={formatGBP(total, true)}
        sub="everything, incl. excluded"
      />
      <StatCard
        color={CHART_COLORS.health}
        label="Monthly surplus"
        value={formatGBP(surplus, true)}
        sub="income − outgoings"
      />
      <StatCard
        color={CHART_COLORS.amber}
        label="North Star"
        value={northStarPercent !== null ? `${northStarPercent}%` : "—"}
        sub={northStarPercent !== null ? "of target" : "not set"}
      />
    </div>
  );
}
