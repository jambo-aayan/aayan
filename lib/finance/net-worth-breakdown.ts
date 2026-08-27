export type AccountForBreakdown = {
  name: string;
  value: number;
  type: "ASSET" | "LIABILITY";
  excluded: boolean;
  cls: string | null;
};

/**
 * What makes up accessible net worth, as ring-chart segments, grouped by
 * the user's own free-text `cls` (ADR-0010) — not a fixed category list.
 * An account with no class set falls back to its own name, so ungrouped
 * accounts still each get their own segment rather than collapsing into
 * one "uncategorised" slice. Liabilities are excluded (a proportional
 * ring can't represent a negative slice) and so are excluded accounts —
 * this deliberately mirrors netWorth()'s "accessible" figure, not total.
 */
export function netWorthBreakdown(accounts: AccountForBreakdown[]): { name: string; value: number }[] {
  const eligible = accounts.filter((a) => a.type === "ASSET" && !a.excluded);
  const byGroup = new Map<string, number>();
  for (const account of eligible) {
    const key = account.cls ?? account.name;
    byGroup.set(key, (byGroup.get(key) ?? 0) + account.value);
  }
  return [...byGroup.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
