/** Percentage-space geometry for the Pillar mindmap (any Pillar with Areas,
 * as of #157/ADR-0016 — Health originally) — replaces the old hand-placed
 * NODE_POSITION
 * table and its dead fallbackPosition path (#145, ADR-0014). Everything
 * stays in the same 0-100 percentage units the diagram's SVG viewBox
 * already uses, so this never needs a DOM measurement or ResizeObserver —
 * it works identically during SSR and at any container size. */

export const MINDMAP_CENTER_PERCENT = 50;
export const MINDMAP_MIN_RADIUS_PERCENT = 22;
export const MINDMAP_MAX_RADIUS_PERCENT = 40;

/** Must match pillar-mindmap.module.css's `.leaf` max-width (also a
 * percentage of the same container) — this is the value the radius math
 * below keeps adjacent nodes clear of. Long labels wrap within this width
 * via plain CSS (`white-space: normal`); this module never inspects a
 * node's `name` for spacing, only its position in the list, which is what
 * keeps a long name from needing any position recalculation at all. */
export const MINDMAP_NODE_WIDTH_PERCENT = 20;

export type MindmapNode = { id: string; name: string };
export type MindmapPosition = MindmapNode & { left: number; top: number };

/** The minimum radius keeping every pair of adjacent nodes at least
 * MINDMAP_NODE_WIDTH_PERCENT apart, clamped to a sane min/max band. The
 * chord between two points spaced 360/n degrees apart on a circle of
 * radius R is 2R·sin(π/n) — solving that for R against the node width is
 * an approximation (treats each pill as a point needing that much
 * clearance, not its true rounded-rect footprint), but is deliberately
 * conservative: real pills are usually narrower than the fixed max-width
 * they wrap within, so actual clearance is normally larger than this
 * floor, not smaller. */
function computeRadius(nodeCount: number): number {
  const required = MINDMAP_NODE_WIDTH_PERCENT / (2 * Math.sin(Math.PI / nodeCount));
  return Math.min(MINDMAP_MAX_RADIUS_PERCENT, Math.max(MINDMAP_MIN_RADIUS_PERCENT, required));
}

/** Lays out `nodes` evenly around the center, starting at the top (-90°)
 * and going clockwise — matches the orientation the old hand-placed
 * positions and fallbackPosition both used, so the diagram's basic shape
 * doesn't change, just its collision-safety. */
export function computeMindmapLayout(nodes: MindmapNode[]): MindmapPosition[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) {
    return [{ ...nodes[0], left: MINDMAP_CENTER_PERCENT, top: MINDMAP_CENTER_PERCENT - MINDMAP_MIN_RADIUS_PERCENT }];
  }

  const radius = computeRadius(nodes.length);
  return nodes.map((node, i) => {
    const angleDeg = -90 + (i * 360) / nodes.length;
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      ...node,
      left: MINDMAP_CENTER_PERCENT + Math.cos(angleRad) * radius,
      top: MINDMAP_CENTER_PERCENT + Math.sin(angleRad) * radius,
    };
  });
}
