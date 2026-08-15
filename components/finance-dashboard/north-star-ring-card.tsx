import { Ring } from "./ring";
import styles from "./dashboard.module.css";

export function NorthStarRingCard({ percent, hasTarget }: { percent: number | null; hasTarget: boolean }) {
  return (
    <div className={`${styles.bentoCard} ${styles.dark} ${styles.span2} ${styles.row2}`}>
      <div className={styles.cardHead}>North Star</div>
      <div className={styles.ringWrap}>
        <Ring
          percent={percent ?? 0}
          color="#D9714B"
          trackColor="rgba(244,239,231,.15)"
          centerLabel={hasTarget ? `${percent}%` : "—"}
          centerSub={hasTarget ? "to target" : "not set"}
        />
      </div>
    </div>
  );
}
