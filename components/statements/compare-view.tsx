"use client";

import { useState } from "react";
import { categoryBreakdown } from "@/lib/finance/category-breakdown";
import { yearOverYearComparison, type StatementTransaction } from "@/lib/finance/statements";
import styles from "./compare-view.module.css";

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function toMonthInputValue(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fromMonthInputValue(value: string): Date {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

/** Month-vs-month picker + same-month year-over-year comparison — both
 * recompute client-side from the same pure functions the server already
 * used elsewhere (categoryBreakdown, yearOverYearComparison), so picking
 * a month needs no round trip (#118, ADR-0010). */
export function CompareView({ transactions, today }: { transactions: StatementTransaction[]; today: Date }) {
  const thisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const lastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const [monthA, setMonthA] = useState(toMonthInputValue(lastMonth));
  const [monthB, setMonthB] = useState(toMonthInputValue(thisMonth));

  const breakdownA = categoryBreakdown(transactions, fromMonthInputValue(monthA));
  const breakdownB = categoryBreakdown(transactions, fromMonthInputValue(monthB));
  const totalA = breakdownA.reduce((sum, c) => sum + c.total, 0);
  const totalB = breakdownB.reduce((sum, c) => sum + c.total, 0);

  const yoy = yearOverYearComparison(transactions, thisMonth);

  return (
    <div>
      <div className={styles.picker}>
        <input
          className={styles.input}
          type="month"
          aria-label="First month"
          value={monthA}
          onChange={(e) => setMonthA(e.target.value)}
        />
        <span>vs</span>
        <input
          className={styles.input}
          type="month"
          aria-label="Second month"
          value={monthB}
          onChange={(e) => setMonthB(e.target.value)}
        />
      </div>
      <div className={styles.totals}>
        <span>
          {formatMonth(fromMonthInputValue(monthA))}: {formatGBP(totalA)}
        </span>
        <span>
          {formatMonth(fromMonthInputValue(monthB))}: {formatGBP(totalB)}
        </span>
      </div>

      <div className={styles.yoy}>
        <div className={styles.sectionLabel}>Year over year ({formatMonth(thisMonth)})</div>
        {yoy === null ? (
          <p className={styles.muted}>Needs a second year of data to compare.</p>
        ) : (
          <p>
            {formatGBP(yoy.currentTotal)} this year vs {formatGBP(yoy.priorYearTotal)} last year
            {yoy.diffPercent !== null && ` (${yoy.diffPercent > 0 ? "+" : ""}${yoy.diffPercent.toFixed(1)}%)`}
          </p>
        )}
      </div>
    </div>
  );
}
