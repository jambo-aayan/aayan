"use client";

import { useState } from "react";
import { LineTrendChart } from "@/components/visuals/line-trend-chart";
import { formatGBP } from "@/lib/finance/format";
import type { CategorySpendSummary } from "@/lib/insights/data";
import styles from "./category-spend-card.module.css";

function monthLabel(iso: string): string {
  return new Date(`${iso}-01T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

/** Category/subcategory spend trend, comprehensive over the whole
 * hierarchy rather than just the categories currently over threshold
 * (#180) — the browsable, always-on complement to #179's one-off
 * anomaly nudge. A row's own callout badge reuses the same "more"/"less"
 * ADR-0012 language SpendDeviationView already shows on the Finance
 * dashboard; clicking a row plots its 6-month trend below, defaulting to
 * the top-spending category so the card never opens empty. */
export function CategorySpendCard({ summary }: { summary: CategorySpendSummary }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { months, rows } = summary;

  if (rows.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.eyebrow}>Category spend</div>
        <p className={styles.empty}>Keep logging transactions — category trends need some spending history first.</p>
      </div>
    );
  }

  const rowKey = (r: CategorySpendSummary["rows"][number]) => `${r.categoryParent}: ${r.category}`;
  const selected = rows.find((r) => rowKey(r) === selectedKey) ?? rows[0];
  const points = months.map((m, i) => ({ label: monthLabel(m), value: selected.totals[i] }));

  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>Category spend</div>

      <p className={styles.chartLabel}>{selected.categoryParent}: {selected.category}</p>
      <LineTrendChart points={points} height={140} color="var(--gold)" />

      <ul className={styles.list}>
        {rows.map((r) => {
          const key = rowKey(r);
          const current = r.totals[r.totals.length - 1];
          return (
            <li key={key}>
              <button
                type="button"
                className={`${styles.row} ${key === rowKey(selected) ? styles.rowActive : ""}`}
                onClick={() => setSelectedKey(key)}
              >
                <span className={styles.rowName}>
                  {r.categoryParent}: {r.category}
                </span>
                {r.callout && <span className={`${styles.badge} ${styles[r.callout]}`}>{r.callout}</span>}
                <span className={styles.rowAmount}>{formatGBP(current, true)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
