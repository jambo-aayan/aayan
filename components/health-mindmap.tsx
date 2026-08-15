import Link from "next/link";
import styles from "./health-mindmap.module.css";

const START_ANGLE = -60;
const ANGLE_STEP = 40;
const RADIUS = 100;
// The .wrap container is wider than it is tall, so a node placed at equal
// x/y offsets from center would look squashed toward the sides. These
// scale the same trig radius down more on x than y to compensate — tuned
// by eye against .wrap's actual aspect ratio, not derived from a formula.
const X_SCALE = 2.6;
const Y_SCALE = 3.6;

export function HealthMindmap({ areas }: { areas: { id: string; name: string }[] }) {
  const nodes = areas.map((area, i) => {
    const angleDeg = START_ANGLE + i * ANGLE_STEP;
    const rad = (angleDeg * Math.PI) / 180;
    return {
      ...area,
      angleDeg,
      x: 50 + (Math.cos(rad) * RADIUS) / X_SCALE,
      y: 50 + (Math.sin(rad) * RADIUS) / Y_SCALE,
    };
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.core}>Health</div>
      {nodes.map((n) => (
        <span
          key={n.id}
          className={styles.link}
          style={{ width: `${RADIUS / X_SCALE}px`, transform: `rotate(${n.angleDeg}deg)` }}
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
