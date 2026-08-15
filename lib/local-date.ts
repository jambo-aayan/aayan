/**
 * The user's local calendar "today" — `.toISOString()` reads the UTC day,
 * which can default a date field to tomorrow in the evening for a browser
 * west of UTC. Stored dates stay UTC-midnight; only "what does today
 * default to" cares about the local clock.
 */
export function todayLocalDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
