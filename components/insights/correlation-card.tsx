"use client";

import { useState } from "react";
import type { CorrelationResult } from "@/lib/insights/correlations";
import { CORRELATION_CAVEAT } from "@/lib/insights/correlations";
import { DrillDownSheet } from "./drill-down-sheet";
import type { DrillDownData } from "@/lib/insights/kpis";
import styles from "./correlation-card.module.css";

const STRENGTH_LABEL = { strong: "Strong", moderate: "Moderate", weak: "Weak" };

/** Downsamples to at most 12 points for the mini scatter, evenly spaced
 * across the series — the pure module returns every paired observation,
 * but the handoff's scatter is drawn with exactly 12 dots. */
function sampleForScatter(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length <= 12) return points;
  const step = points.length / 12;
  return Array.from({ length: 12 }, (_, i) => points[Math.floor(i * step)]);
}

function buildDrillDown(result: CorrelationResult): DrillDownData {
  const dated = result.points.filter((p) => p.date !== null);
  return {
    kindEyebrow: `Correlation · r = ${result.r}`,
    title: `${result.labelA} & ${result.labelB}`,
    summaryStats: [
      { label: "r", value: `${result.r}` },
      { label: "n", value: `${result.n}` },
      { label: "Strength", value: STRENGTH_LABEL[result.strength] },
    ],
    series: result.points.slice(-14).map((p) => p.y),
    entries: dated
      .slice(-20)
      .reverse()
      .map((p) => ({
        date: p.date!,
        label: `${result.labelA}: ${p.x}`,
        value: `${result.labelB}: ${p.y}`,
        tone: "muted" as const,
      })),
    writtenRead: CORRELATION_CAVEAT,
  };
}

export function CorrelationCard({ result }: { result: CorrelationResult }) {
  const [open, setOpen] = useState(false);
  const sample = sampleForScatter(result.points);
  const xs = sample.map((p) => p.x);
  const ys = sample.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  return (
    <>
      <button type="button" className={`${styles.card} ${styles[result.strength]}`} onClick={() => setOpen(true)}>
        <div className={styles.head}>
          <span className={styles.badge}>{STRENGTH_LABEL[result.strength]}</span>
          <span className={styles.n}>n={result.n}</span>
        </div>
        <p className={styles.claim}>{result.claim}</p>
        <div className={styles.scatter}>
          {sample.map((p, i) => (
            <span
              key={i}
              className={styles.dot}
              style={{
                left: `${((p.x - minX) / rangeX) * 100}%`,
                bottom: `${((p.y - minY) / rangeY) * 100}%`,
              }}
              aria-hidden
            />
          ))}
        </div>
        <p className={styles.caveat}>{CORRELATION_CAVEAT}</p>
      </button>
      {open && <DrillDownSheet data={buildDrillDown(result)} onClose={() => setOpen(false)} />}
    </>
  );
}
