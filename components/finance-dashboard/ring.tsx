const STROKE_WIDTH = 9;

/** A single-value progress ring (0-100%). */
export function Ring({
  percent,
  color = "#D9714B",
  trackColor = "#EAE2D3",
  size = 92,
  centerLabel,
  centerSub,
}: {
  percent: number;
  color?: string;
  trackColor?: string;
  size?: number;
  centerLabel: string;
  centerSub?: string;
}) {
  const r = size / 2 - STROKE_WIDTH;
  const circumference = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, percent)) / 100) * circumference;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={STROKE_WIDTH} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: size >= 90 ? 19 : 14, fontWeight: 700 }}>{centerLabel}</span>
        {centerSub && <span style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>{centerSub}</span>}
      </div>
    </div>
  );
}

/** A multi-segment breakdown ring (e.g. net-worth composition by item). */
export function BreakdownRing({
  segments,
  size = 100,
  centerLabel,
  centerSub,
}: {
  segments: { name: string; value: number; color: string }[];
  size?: number;
  centerLabel: string;
  centerSub?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const r = size / 2 - 8;
  const circumference = 2 * Math.PI * r;

  const arcs = segments.reduce<{ length: number; offset: number; seg: (typeof segments)[number] }[]>(
    (acc, seg) => {
      const length = total > 0 ? (seg.value / total) * circumference : 0;
      const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].length + 3 : 0;
      return [...acc, { length, offset, seg }];
    },
    []
  );

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {arcs.map(({ length, offset, seg }) => (
          <circle
            key={seg.name}
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={seg.color}
            strokeWidth={11}
            fill="none"
            strokeDasharray={`${length} ${circumference}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700 }}>{centerLabel}</span>
        {centerSub && <span style={{ fontSize: 10, color: "var(--muted)" }}>{centerSub}</span>}
      </div>
    </div>
  );
}
