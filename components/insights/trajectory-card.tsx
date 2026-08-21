import type { TrajectoryPoint } from "@/lib/insights/trajectory";
import styles from "./trajectory-card.module.css";

const WIDTH = 300;
const HEIGHT = 100;
const PAD = 6;

export type TrajectorySummary = {
  currentValue: number;
  projection: TrajectoryPoint[];
  projectedDate: string | null;
  deltaVsDeadlineDays: number | null;
  writtenRead: string;
  actuals: TrajectoryPoint[];
  target: number;
  deadline: string | null;
};

function formatMoney(n: number): string {
  return `£${Math.round(n).toLocaleString()}`;
}

function buildPath(points: TrajectoryPoint[], minY: number, maxY: number, minX: number, maxX: number): string {
  if (points.length === 0) return "";
  const rangeY = maxY - minY || 1;
  const rangeX = maxX - minX || 1;
  return points
    .map((p, i) => {
      const x = PAD + ((new Date(`${p.date}T00:00:00.000Z`).getTime() - minX) / rangeX) * (WIDTH - PAD * 2);
      const y = HEIGHT - PAD - ((p.value - minY) / rangeY) * (HEIGHT - PAD * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function TrajectoryCard({ trajectory }: { trajectory: TrajectorySummary | null }) {
  if (!trajectory) {
    return (
      <div className={styles.card}>
        <div className={styles.eyebrow}>Trajectory</div>
        <p className={styles.empty}>Set a North Star target and deadline in Finances to see a trajectory.</p>
      </div>
    );
  }

  const allPoints = [...trajectory.actuals, ...trajectory.projection];
  const allDates = allPoints.map((p) => new Date(`${p.date}T00:00:00.000Z`).getTime());
  const allValues = [...allPoints.map((p) => p.value), trajectory.target];
  const minX = Math.min(...allDates);
  const maxX = Math.max(...allDates);
  const minY = Math.min(...allValues);
  const maxY = Math.max(...allValues);

  const targetY = HEIGHT - PAD - ((trajectory.target - minY) / (maxY - minY || 1)) * (HEIGHT - PAD * 2);

  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>Trajectory</div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={styles.svg}
        role="img"
        aria-label="Net worth trajectory toward North Star target"
        aria-describedby="trajectory-written-read"
      >
        <line x1={PAD} y1={HEIGHT / 2} x2={WIDTH - PAD} y2={HEIGHT / 2} className={styles.gridline} />
        <line x1={PAD} y1={targetY} x2={WIDTH - PAD} y2={targetY} className={styles.targetLine} />
        <path d={buildPath(trajectory.actuals, minY, maxY, minX, maxX)} className={styles.actualsLine} />
        {trajectory.projection.length > 0 && (
          <path d={buildPath(trajectory.projection, minY, maxY, minX, maxX)} className={styles.projectionLine} />
        )}
      </svg>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Current value</span>
          <span className={styles.statValue}>{formatMoney(trajectory.currentValue)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Projected date</span>
          <span className={styles.statValue}>{trajectory.projectedDate ?? "—"}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Vs. deadline</span>
          <span className={styles.statValue}>
            {trajectory.deltaVsDeadlineDays === null
              ? "—"
              : `${trajectory.deltaVsDeadlineDays > 0 ? "+" : ""}${trajectory.deltaVsDeadlineDays}d`}
          </span>
        </div>
      </div>

      <p id="trajectory-written-read" className={styles.read}>
        {trajectory.writtenRead}
      </p>
    </div>
  );
}
