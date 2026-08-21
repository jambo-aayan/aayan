import Link from "next/link";
import { ANKYLOSING_SPONDYLITIS_AREA_ID } from "@/lib/health/seed-data";
import styles from "./health-mindmap.module.css";

/** Hand-placed percentages from the design_handoff_aayan README's Health
 * mindmap spec, keyed by the seeded Area id — per the handoff's own note,
 * "node positions are hand-placed percentages, not a layout algorithm."
 * Falls back to a generic radial layout for any Area outside this fixed
 * set (a custom-created Area, or the seed list growing later). */
const NODE_POSITION: Record<string, { left: number; top: number }> = {
  sleep: { left: 50, top: 16 },
  diet: { left: 80, top: 29 },
  "blood-pressure": { left: 79, top: 59 },
  "body-composition": { left: 62, top: 81 },
  looks: { left: 36, top: 80 },
  "healthcare-navigation": { left: 21, top: 56 },
  [ANKYLOSING_SPONDYLITIS_AREA_ID]: { left: 28, top: 27 },
};

function fallbackPosition(index: number, total: number): { left: number; top: number } {
  const angleDeg = -90 + (index * 360) / total;
  const rad = (angleDeg * Math.PI) / 180;
  return { left: 50 + Math.cos(rad) * 38, top: 50 + Math.sin(rad) * 38 };
}

export function HealthMindmap({
  areas,
  accentColor,
}: {
  areas: { id: string; name: string }[];
  /** The Health Pillar's chosen color (resolved hex) — the center node's
   * fill and the condition node's border use it instead of the default
   * green, one of the color system's propagation points. */
  accentColor?: string | null;
}) {
  const nodes = areas.map((area, i) => ({
    ...area,
    ...(NODE_POSITION[area.id] ?? fallbackPosition(i, areas.length)),
  }));

  return (
    <div className={styles.wrap} style={accentColor ? ({ "--pillar-accent": accentColor } as React.CSSProperties) : undefined}>
      <svg className={styles.spokes} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {nodes.map((n) => (
          <line key={n.id} x1={50} y1={50} x2={n.left} y2={n.top} className={styles.spoke} />
        ))}
      </svg>

      <div className={styles.core}>Health</div>

      {nodes.map((n) => (
        <Link
          key={n.id}
          href={`/health/${n.id}`}
          className={`${styles.leaf} ${n.id === ANKYLOSING_SPONDYLITIS_AREA_ID ? styles.leafCondition : ""}`}
          style={{ left: `${n.left}%`, top: `${n.top}%` }}
        >
          {n.name}
        </Link>
      ))}
    </div>
  );
}
