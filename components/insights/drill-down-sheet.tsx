"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { DrillDownData } from "@/lib/insights/kpis";
import { useDialogFocusTrap } from "@/components/use-dialog-focus-trap";
import styles from "./drill-down-sheet.module.css";

export function DrillDownSheet({ data, onClose }: { data: DrillDownData; onClose: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap(sheetRef);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const maxBar = Math.max(...data.series, 1);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <div ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-label={data.title} tabIndex={-1}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>{data.kindEyebrow}</div>
            <div className={styles.title}>{data.title}</div>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.stats}>
            {data.summaryStats.map((s) => (
              <div key={s.label} className={styles.stat}>
                <span className={styles.statLabel}>{s.label}</span>
                <span className={styles.statValue}>{s.value}</span>
              </div>
            ))}
          </div>

          <div className={styles.series} aria-hidden>
            {data.series.map((v, i) => (
              <span key={i} className={styles.seriesBar} style={{ height: `${Math.max(4, (v / maxBar) * 100)}%` }} />
            ))}
          </div>

          <div className={styles.entriesSection}>
            <div className={styles.entriesLabel}>Underlying entries</div>
            {data.entries.length === 0 ? (
              <p className={styles.emptyEntries}>No entries in this period.</p>
            ) : (
              <ul className={styles.entries}>
                {data.entries.map((e) => (
                  <li key={e.date} className={styles.entry}>
                    <span className={styles.entryDate}>{e.date}</span>
                    <span className={styles.entryLabel}>{e.label}</span>
                    <span className={`${styles.entryValue} ${styles[e.tone]}`}>{e.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className={styles.read}>{data.writtenRead}</p>
        </div>
      </div>
    </>
  );
}
