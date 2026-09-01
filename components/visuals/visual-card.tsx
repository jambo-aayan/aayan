import { Trash2 } from "lucide-react";
import styles from "./visual-card.module.css";

/** The card chrome shared by every chart Visual's rendering component
 * (#164) — title + remove button + card border, identical across Line/
 * Bar/Progress bar/Scatter/Streak heatmap, extracted once a 4th
 * byte-identical occurrence made the duplication real rather than
 * speculative. Each chart type's own body (the actual chart/grid, plus
 * its add-data form) is `children` — this owns only the shell. */
export function VisualCard({ title, onRemove, children }: { title: string; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        <div className={styles.actions}>
          <button type="button" className={styles.iconButton} onClick={onRemove} aria-label={`Remove ${title}`}>
            <Trash2 size={15} strokeWidth={2} />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
