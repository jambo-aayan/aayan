/** Small static reference icons for the add-chart gallery (#163, ADR-0017)
 * — illustrative shapes, not live-rendered mini-charts, per the grilling
 * session's explicit ask ("big icons/static images... not charts with the
 * real data in there"). One per VisualType (TABLE excluded — it has its
 * own creation flow, no gallery step). */
function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 48 32" width="48" height="32" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

export function LineChartIcon() {
  return (
    <IconBase>
      <polyline points="4,26 14,14 24,20 34,6 44,12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

export function BarChartIcon() {
  return (
    <IconBase>
      <rect x="5" y="16" width="7" height="12" fill="currentColor" rx="1.5" />
      <rect x="17" y="8" width="7" height="20" fill="currentColor" rx="1.5" />
      <rect x="29" y="20" width="7" height="8" fill="currentColor" rx="1.5" />
      <rect x="41" y="4" width="6" height="24" fill="currentColor" rx="1.5" />
    </IconBase>
  );
}

export function ProgressBarIcon() {
  return (
    <IconBase>
      <rect x="4" y="13" width="40" height="6" rx="3" fill="currentColor" opacity="0.22" />
      <rect x="4" y="13" width="26" height="6" rx="3" fill="currentColor" />
    </IconBase>
  );
}

export function ScatterIcon() {
  return (
    <IconBase>
      {[[6, 24], [14, 10], [20, 20], [27, 6], [33, 16], [40, 9], [43, 22]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" fill="currentColor" />
      ))}
    </IconBase>
  );
}

export function StreakHeatmapIcon() {
  const opacities = [0.15, 0.9, 0.4, 0.15, 0.9, 0.6, 0.15, 0.4, 0.9, 0.15, 0.6, 0.9, 0.15, 0.9, 0.4];
  return (
    <IconBase>
      {opacities.map((opacity, i) => (
        <rect key={i} x={4 + (i % 5) * 8.5} y={4 + Math.floor(i / 5) * 9} width="6.5" height="7" rx="1.5" fill="currentColor" opacity={opacity} />
      ))}
    </IconBase>
  );
}
