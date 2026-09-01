import Link from "next/link";
import { ANKYLOSING_SPONDYLITIS_AREA_ID } from "@/lib/health/seed-data";
import { computeMindmapLayout } from "@/lib/health/mindmap-layout";
import styles from "./health-mindmap.module.css";

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
  const nodes = computeMindmapLayout(areas);

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
