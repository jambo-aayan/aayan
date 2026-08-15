export function missingSeedItems<T extends { id: string }>(
  seed: readonly T[],
  existingIds: readonly string[]
): T[] {
  const existing = new Set(existingIds);
  return seed.filter((item) => !existing.has(item.id));
}
