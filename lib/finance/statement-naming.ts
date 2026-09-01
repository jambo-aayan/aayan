export type StatementNamingInput = {
  institutionName: string | null;
  periodEnd: Date | null;
  accountName: string;
  uploadedAt: Date;
};

function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatFallbackDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

/** Generates a statement's display name (#148, ADR-0015) — extraction
 * confidently gives `{institutionName} — {accountName} — {month YYYY}`
 * (using periodEnd, the month the statement closes in, matching how a
 * bank names its own statements). Falls back to `{accountName} —
 * Statement {uploadedAt}` — using data already in the DB, never Gemini's
 * — whenever institution or period wasn't confidently extracted, so a
 * low-confidence extraction never produces a blank or broken name.
 * User-editable afterward regardless of which path generated it. */
export function generateStatementName(input: StatementNamingInput): string {
  const institution = input.institutionName?.trim();
  if (institution && input.periodEnd) {
    return `${institution} — ${input.accountName} — ${formatMonthYear(input.periodEnd)}`;
  }
  return `${input.accountName} — Statement ${formatFallbackDate(input.uploadedAt)}`;
}
