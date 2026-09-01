import Link from "next/link";
import { HEALTH_PILLAR_ID, ANKYLOSING_SPONDYLITIS_AREA_ID } from "@/lib/health/seed-data";
import { computeMindmapLayout } from "@/lib/pillars/mindmap-layout";
import { pillarHref } from "@/lib/pillars/nav";
import styles from "./pillar-mindmap.module.css";

/** The Pillar-level "tap a node to go into it" Areas overview (#157/
 * ADR-0016) — generalized off the original Health-only mindmap, shown on
 * any Pillar page that has Areas (via /[pillarId]/[areaId]). The one
 * remaining Health-specific touch — highlighting the Ankylosing
 * Spondylitis node — is a small, deliberate exception to preserve Health's
 * exact prior look, not a generalized "highlighted Area" feature. */
export function PillarMindmap({
  pillarId,
  pillarName,
  areas,
  accentColor,
}: {
  pillarId: string;
  pillarName: string;
  areas: { id: string; name: string }[];
  /** The Pillar's chosen color (resolved hex) — the center node's fill and
   * the highlighted node's border use it instead of the default green, one
   * of the color system's propagation points. */
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

      <div className={styles.core}>{pillarName}</div>

      {nodes.map((n) => {
        const isHighlighted = pillarId === HEALTH_PILLAR_ID && n.id === ANKYLOSING_SPONDYLITIS_AREA_ID;
        return (
          <Link
            key={n.id}
            href={`${pillarHref(pillarId)}/${n.id}`}
            className={`${styles.leaf} ${isHighlighted ? styles.leafCondition : ""}`}
            style={{ left: `${n.left}%`, top: `${n.top}%` }}
          >
            {n.name}
          </Link>
        );
      })}
    </div>
  );
}
