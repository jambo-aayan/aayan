import { describe, expect, it } from "vitest";
import {
  computeMindmapLayout,
  MINDMAP_CENTER_PERCENT,
  MINDMAP_MAX_RADIUS_PERCENT,
  MINDMAP_MIN_RADIUS_PERCENT,
} from "./mindmap-layout";

function distanceFromCenter(pos: { left: number; top: number }): number {
  return Math.sqrt((pos.left - MINDMAP_CENTER_PERCENT) ** 2 + (pos.top - MINDMAP_CENTER_PERCENT) ** 2);
}

describe("computeMindmapLayout", () => {
  it("returns an empty array for zero nodes", () => {
    expect(computeMindmapLayout([])).toEqual([]);
  });

  it("places a single node directly above center at the minimum radius", () => {
    const [pos] = computeMindmapLayout([{ id: "sleep", name: "Sleep" }]);
    expect(pos.left).toBeCloseTo(MINDMAP_CENTER_PERCENT, 5);
    expect(pos.top).toBeCloseTo(MINDMAP_CENTER_PERCENT - MINDMAP_MIN_RADIUS_PERCENT, 5);
  });

  it("spaces nodes evenly by angle, starting from the top and going clockwise", () => {
    const positions = computeMindmapLayout([
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
      { id: "d", name: "D" },
    ]);
    const [a, b, c, d] = positions;
    // -90deg (top), 0deg (right), 90deg (bottom), 180deg (left) — exact
    // trig values at these angles, so this also catches a sign/axis flip.
    expect(a.left).toBeCloseTo(MINDMAP_CENTER_PERCENT, 5);
    expect(a.top).toBeLessThan(MINDMAP_CENTER_PERCENT);
    expect(b.left).toBeGreaterThan(MINDMAP_CENTER_PERCENT);
    expect(b.top).toBeCloseTo(MINDMAP_CENTER_PERCENT, 5);
    expect(c.left).toBeCloseTo(MINDMAP_CENTER_PERCENT, 5);
    expect(c.top).toBeGreaterThan(MINDMAP_CENTER_PERCENT);
    expect(d.left).toBeLessThan(MINDMAP_CENTER_PERCENT);
    expect(d.top).toBeCloseTo(MINDMAP_CENTER_PERCENT, 5);
  });

  it("keeps today's real node count (7) within the min/max radius band", () => {
    const nodes = Array.from({ length: 7 }, (_, i) => ({ id: `n${i}`, name: `Node ${i}` }));
    const positions = computeMindmapLayout(nodes);
    for (const pos of positions) {
      const r = distanceFromCenter(pos);
      expect(r).toBeGreaterThanOrEqual(MINDMAP_MIN_RADIUS_PERCENT - 0.001);
      expect(r).toBeLessThanOrEqual(MINDMAP_MAX_RADIUS_PERCENT + 0.001);
    }
  });

  it("increases radius as node count grows, up to the max", () => {
    const radiusFor = (count: number) => {
      const nodes = Array.from({ length: count }, (_, i) => ({ id: `n${i}`, name: `Node ${i}` }));
      return distanceFromCenter(computeMindmapLayout(nodes)[0]);
    };
    const r6 = radiusFor(6);
    const r14 = radiusFor(14);
    expect(r14).toBeGreaterThan(r6);
    expect(r14).toBeLessThanOrEqual(MINDMAP_MAX_RADIUS_PERCENT + 0.001);
  });

  it("never exceeds the max radius even for a very large node count", () => {
    const nodes = Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, name: `Node ${i}` }));
    const positions = computeMindmapLayout(nodes);
    for (const pos of positions) {
      expect(distanceFromCenter(pos)).toBeLessThanOrEqual(MINDMAP_MAX_RADIUS_PERCENT + 0.001);
    }
  });

  it("never drops below the min radius even for a small node count", () => {
    const positions = computeMindmapLayout([
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ]);
    for (const pos of positions) {
      expect(distanceFromCenter(pos)).toBeGreaterThanOrEqual(MINDMAP_MIN_RADIUS_PERCENT - 0.001);
    }
  });

  it("handles a very long label name without erroring — wrapping is a CSS concern, not a position one", () => {
    const positions = computeMindmapLayout([
      { id: "a", name: "A" },
      { id: "b", name: "A Very Long Area Name That Would Wrap Across Multiple Lines" },
    ]);
    expect(positions).toHaveLength(2);
    expect(Number.isFinite(positions[1].left)).toBe(true);
    expect(Number.isFinite(positions[1].top)).toBe(true);
  });

  it("preserves each node's id and name in the output", () => {
    const positions = computeMindmapLayout([{ id: "sleep", name: "Sleep" }]);
    expect(positions[0]).toMatchObject({ id: "sleep", name: "Sleep" });
  });
});
