/** Validates a YYYY-MM-DD date string strictly — the JS `Date` constructor
 * doesn't reject an out-of-range day/month by itself, it silently rolls
 * over (`new Date("2026-02-30T00:00:00.000Z")` becomes March 2nd, no
 * `Invalid Date`). Round-tripping back through `toISOString` and comparing
 * catches that; only genuinely out-of-range values like month 13 happen to
 * produce `Invalid Date` on their own, so checking `isNaN` alone is
 * inconsistent. Shared by lib/visuals/parse-records.ts and
 * lib/visuals/actions.ts's date-taking actions — both need the exact same
 * strictness, and this is pure/dependency-free so it's directly
 * unit-testable without either of their surrounding concerns. */
export function isValidIsoDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === dateStr;
}
