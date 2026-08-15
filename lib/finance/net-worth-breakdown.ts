export type ItemForBreakdown = {
  name: string;
  value: number;
  type: "ASSET" | "LIABILITY";
  excluded: boolean;
};

/**
 * What makes up accessible net worth, as ring-chart segments. Liabilities
 * are excluded (a proportional ring can't represent a negative slice) and
 * so are excluded items — this deliberately mirrors netWorth()'s
 * "accessible" figure, not total.
 */
export function netWorthBreakdown(items: ItemForBreakdown[]): { name: string; value: number }[] {
  return items
    .filter((item) => item.type === "ASSET" && !item.excluded)
    .map((item) => ({ name: item.name, value: item.value }))
    .sort((a, b) => b.value - a.value);
}
