import Link from "next/link";
import styles from "./health-mindmap.module.css";

const START_ANGLE = -60;
const ANGLE_STEP = 40;
const RADIUS = 100;

export function HealthMindmap({ areas }: { areas: { id: string; name: string }[] }) {
  const nodes = areas.map((area, i) => {
    const angleDeg = START_ANGLE + i * ANGLE_STEP;
    const rad = (angleDeg * Math.PI) / 180;
    return {
      ...area,
      angleDeg,
      x: 50 + (Math.cos(rad) * RADIUS) / 2.6,
      y: 50 + (Math.sin(rad) * RADIUS) / 3.6,
    };
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.core}>Health</div>
      {nodes.map((n) => (
        <span
          key={n.id}
          className={styles.link}
          style={{ width: `${RADIUS / 2.6}px`, transform: `rotate(${n.angleDeg}deg)` }}
        />
      ))}
      {nodes.map((n) => (
        <Link
          key={n.id}
          href={`/health/${n.id}`}
          className={styles.leaf}
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
        >
          {n.name}
        </Link>
      ))}
    </div>
  );
}
