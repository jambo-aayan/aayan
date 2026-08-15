export type ItemForNetWorth = {
  value: number;
  type: "ASSET" | "LIABILITY";
  excluded: boolean;
};

export function netWorth(items: ItemForNetWorth[]): { accessible: number; total: number } {
  const signed = (item: ItemForNetWorth) => (item.type === "ASSET" ? item.value : -item.value);

  const total = items.reduce((sum, item) => sum + signed(item), 0);
  const accessible = items.filter((item) => !item.excluded).reduce((sum, item) => sum + signed(item), 0);

  return { accessible, total };
}
