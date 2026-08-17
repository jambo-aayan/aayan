import * as chrono from "chrono-node";

export type ParsedTaskInput = {
  title: string;
  dueDate: Date | null;
  dueTime: string | null;
};

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function formatHHmm(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Strips the matched date/time phrase out of the title and tidies up what's left
 * (collapsed whitespace, no dangling comma from "Call Sarah, tomorrow"). */
function stripMatch(text: string, index: number, matchedText: string): string {
  const before = text.slice(0, index);
  const after = text.slice(index + matchedText.length);
  const stripped = `${before} ${after}`.replace(/\s+/g, " ").trim();
  return stripped.replace(/[,\s]+$/, "").replace(/^[,\s]+/, "");
}

/**
 * Detects natural-language date/time phrases inside a task title (e.g. "Call
 * Mum today", "Submit report tomorrow 9am") and splits them out into
 * structured due-date/due-time fields, returning the title with that phrase
 * removed. Falls back to the raw text as the title with no due date when
 * nothing is recognized, or when stripping the match would leave an empty
 * title (e.g. the whole input was just "tomorrow").
 *
 * `referenceDate` is the "now" the parse is relative to — pass the real
 * current time in production, a fixed date in tests.
 */
export function parseTaskInput(rawText: string, referenceDate: Date = new Date()): ParsedTaskInput {
  const text = rawText.trim();
  const results = chrono.parse(text, referenceDate, { forwardDate: true });

  if (results.length === 0) {
    return { title: text, dueDate: null, dueTime: null };
  }

  const match = results[0];
  const cleanedTitle = stripMatch(text, match.index, match.text);
  if (!cleanedTitle) {
    return { title: text, dueDate: null, dueTime: null };
  }

  const parsedDate = match.start.date();
  return {
    title: cleanedTitle,
    dueDate: toUtcMidnight(parsedDate),
    dueTime: match.start.isCertain("hour") ? formatHHmm(parsedDate) : null,
  };
}
