import { attentionGapLabel } from "@/lib/insights/attention-balance";
import type { AttentionBalanceRow } from "@/lib/insights/attention-balance";
import styles from "./attention-balance.module.css";

export function AttentionBalance({ rows }: { rows: AttentionBalanceRow[] }) {
  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>Attention balance</div>

      <div className={styles.rows}>
        {rows.map((row) => (
          <div key={row.id} className={styles.row}>
            <div className={styles.head}>
              <span className={styles.label}>{row.label}</span>
              <span className={styles.pct}>{row.actualSharePct}%</span>
            </div>
            <div className={styles.track}>
              <div className={styles.fill} style={{ width: `${Math.min(100, row.actualSharePct)}%` }} />
              {row.intendedSharePct !== null && (
                <div className={styles.marker} style={{ left: `${Math.min(100, row.intendedSharePct)}%` }} aria-hidden />
              )}
            </div>
            <p className={row.gapIsDanger ? styles.gapDanger : styles.gapMuted}>{attentionGapLabel(row)}</p>
          </div>
        ))}
      </div>

      <p className={styles.caption}>Thin marker = where you said you wanted it.</p>
    </div>
  );
}
