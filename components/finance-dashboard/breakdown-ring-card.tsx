import { BreakdownRing } from "./ring";
import { formatGBP } from "@/lib/finance/format";
import { BREAKDOWN_SEGMENT_COLORS } from "@/lib/finance/palette";
import styles from "./dashboard.module.css";

export function BreakdownRingCard({
  breakdown,
  accessible,
}: {
  breakdown: { name: string; value: number }[];
  accessible: number;
}) {
  const segments = breakdown.map((b, i) => ({
    ...b,
    color: BREAKDOWN_SEGMENT_COLORS[i % BREAKDOWN_SEGMENT_COLORS.length],
  }));

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
                <span style={{ marginLeft: "auto", color: "var(--muted)" }}>{formatGBP(seg.value, true)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
