import { BreakdownRing } from "./ring";
import styles from "./dashboard.module.css";

const SEGMENT_COLORS = ["#D9714B", "#C79A3D", "#6C7A8C", "#6E8B74", "#8A6FB8", "#4A90A4"];

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(
    value
  );
}

export function BreakdownRingCard({
  breakdown,
  accessible,
}: {
  breakdown: { name: string; value: number }[];
  accessible: number;
}) {
  const segments = breakdown.map((b, i) => ({ ...b, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }));

  return (
    <div className={`${styles.bentoCard} ${styles.span2}`}>
      <div className={styles.cardHead}>Breakdown</div>
      {segments.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>No assets logged yet.</p>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <BreakdownRing
            segments={segments}
            centerLabel={`£${Math.round(accessible / 1000)}k`}
            centerSub="accessible"
          />
          <div style={{ flex: 1 }}>
            {segments.map((seg) => (
              <div
                key={seg.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 11.5,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: seg.color,
                    flexShrink: 0,
                  }}
                />
                {seg.name}
                <span style={{ marginLeft: "auto", color: "var(--muted)" }}>{formatGBP(seg.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
