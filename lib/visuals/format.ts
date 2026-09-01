/** Day + short month, no year — chart axis labels and record lists (#163).
 * Same output as lib/finance/format.ts's formatDateShort; kept as its own
 * copy rather than a cross-domain import for one shared one-liner. */
export function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}
