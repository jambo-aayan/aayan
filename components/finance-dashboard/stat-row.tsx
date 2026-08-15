import styles from "./dashboard.module.css";

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(
    value
  );
}

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
      <StatCard color="#D9714B" label="Accessible net worth" value={formatGBP(accessible)} sub="excludes e.g. pension" />
      <StatCard color="#6C7A8C" label="Total net worth" value={formatGBP(total)} sub="everything, incl. excluded" />
      <StatCard color="#6E8B74" label="Monthly surplus" value={formatGBP(surplus)} sub="income − outgoings" />
      <StatCard
        color="#C79A3D"
        label="North Star"
        value={northStarPercent !== null ? `${northStarPercent}%` : "—"}
        sub={northStarPercent !== null ? "of target" : "not set"}
      />
    </div>
  );
}
