const DAY_MS = 24 * 60 * 60 * 1000;

export type NeglectKind = "area" | "goal" | "list" | "thoughts";
export type NeglectSeverity = "red" | "coral" | "gold" | "muted";

export type NeglectFixture = {
  kind: NeglectKind;
  id: string;
  label: string;
  /** Null means no activity has ever been recorded — treated as more
   * neglected than any finite day count. */
  lastActivityAt: Date | null;
};

export type NeglectRow = {
  kind: NeglectKind;
  id: string;
  label: string;
  daysSince: number | null;
  severity: NeglectSeverity;
};

/** red > 14 days, coral > 7, gold > 5, else muted — per the
 * design_handoff_aayan README's Neglect radar spec. Null ("never") is
 * always red: it's strictly worse than any finite day count. */
export function neglectSeverity(daysSince: number | null): NeglectSeverity {
  if (daysSince === null) return "red";
  if (daysSince > 14) return "red";
  if (daysSince > 7) return "coral";
  if (daysSince > 5) return "gold";
  return "muted";
}

/**
 * Rows sorted by days since activity, most neglected first — the
 * highest-value module per the handoff, since it's the one plain "what am
 * I ignoring" answer nothing else on the page gives directly. Pure:
 * `fixtures` is whatever the caller already resolved as "last activity"
 * for each Area/Goal/List/Thoughts row (see lib/insights/data.ts for how
 * each kind's last-activity date is actually computed).
 */
export function computeNeglectRadar(fixtures: NeglectFixture[], asOf: Date): NeglectRow[] {
  const rows = fixtures.map((f): NeglectRow => {
    const daysSince = f.lastActivityAt === null ? null : Math.floor((asOf.getTime() - f.lastActivityAt.getTime()) / DAY_MS);
    return { kind: f.kind, id: f.id, label: f.label, daysSince, severity: neglectSeverity(daysSince) };
  });

  return rows.sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity));
}
