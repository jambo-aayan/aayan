"use client";

import { usePathname, useRouter } from "next/navigation";
import type { InsightsRange } from "@/lib/insights/range";
import { INSIGHTS_RANGES, DEFAULT_INSIGHTS_RANGE } from "@/lib/insights/range";
import styles from "./range-control.module.css";

/** Persists the selection in the URL (`?range=`) rather than component
 * state or localStorage — a reload or a shared link keeps the same range,
 * and every later Insights module can read it server-side from
 * searchParams without its own client state. */
export function RangeControl({ value }: { value: InsightsRange }) {
  const router = useRouter();
  const pathname = usePathname();

  function setRange(next: InsightsRange) {
    if (next === value) return;
    const qs = next === DEFAULT_INSIGHTS_RANGE ? "" : `?range=${next}`;
    router.replace(`${pathname}${qs}`);
  }

  return (
    <div className={styles.control} role="radiogroup" aria-label="Date range">
      {INSIGHTS_RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          role="radio"
          aria-checked={value === r.value}
          className={`${styles.segment} ${value === r.value ? styles.active : ""}`}
          onClick={() => setRange(r.value)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
