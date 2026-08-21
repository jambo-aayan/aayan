"use client";

import { useState } from "react";
import { DrillDownSheet } from "./drill-down-sheet";
import type { KpiWithDrillDown } from "@/lib/insights/data";
import styles from "./kpi-card.module.css";

function deltaLabel(delta: number): string {
  if (delta === 0) return "±0";
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function KpiCard({ label, unit, kpi }: { label: string; unit: string; kpi: KpiWithDrillDown }) {
  const [open, setOpen] = useState(false);
  const deltaClass = kpi.delta > 0 ? styles.positive : kpi.delta < 0 ? styles.negative : styles.flat;
  const maxBar = Math.max(...kpi.sparkline, 1);

  return (
    <>
      <button type="button" className={styles.card} onClick={() => setOpen(true)}>
        <div className={styles.head}>
          <span className={styles.label}>{label}</span>
          <span className={`${styles.delta} ${deltaClass}`}>{deltaLabel(kpi.delta)}</span>
        </div>
        <span className={styles.value}>
          {kpi.value}
          {unit}
        </span>
        <div className={styles.sparkline} aria-hidden>
          {kpi.sparkline.map((v, i) => (
            <span key={i} className={styles.bar} style={{ height: `${Math.max(6, (v / maxBar) * 100)}%` }} />
          ))}
        </div>
        <p className={styles.diagnosis}>{kpi.diagnosis}</p>
        <span className={styles.breakdown}>Break down →</span>
      </button>
      {open && <DrillDownSheet data={kpi.drillDown} onClose={() => setOpen(false)} />}
    </>
  );
}
