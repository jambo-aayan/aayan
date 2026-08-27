export type SystemType = "PROCESS" | "EXPERIMENT";
export type SystemState = "ACTIVE" | "PAUSED" | "DRAFT" | "ARCHIVED";

export type CreateSystemInput = {
  name: string;
  type: SystemType;
  review: Date | null;
  criteria: string | null;
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

/** Process: name + description only. Experiment: review date and success
 * criteria are both required — creation is blocked without them, because
 * the whole point of criteria is that the verdict is judged against
 * something written in advance (DATA_MODEL.md §5). */
export function validateCreateSystemInput(input: CreateSystemInput): ValidationResult {
  if (!input.name.trim()) return { ok: false, error: "Give the System a name first." };
  if (input.type === "EXPERIMENT") {
    if (!input.review) return { ok: false, error: "Experiments need a review date." };
    if (!input.criteria?.trim()) return { ok: false, error: "Experiments need success criteria." };
  }
  return { ok: true };
}

/** Nesting is capped at one level (ADR-0008): a System that already has
 * children cannot itself be given a parentId. */
export function canSetParent(hasChildren: boolean): boolean {
  return !hasChildren;
}

/** Any completed step supports backdating: ticking stamps today, a
 * "Not today?" picker corrects it after. A backdated date can't be in the
 * future — that would misrepresent work not yet done. */
export function resolveBackdate(candidate: Date, today: Date): { ok: true; date: Date } | { ok: false; error: string } {
  if (candidate.getTime() > today.getTime()) {
    return { ok: false, error: "That date hasn't happened yet." };
  }
  return { ok: true, date: candidate };
}

/** Checkpoint ratings are 1-5, same scale as the rest of this app. */
export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"]);

/** Client-side and server-side pre-upload check for a Checkpoint photo —
 * standard image MIME types, 10MB cap. Enforced on both sides: the client
 * check gives an instant rejection message, the server check is the real
 * trust boundary (a direct action call bypasses the client). */
export function validatePhotoUpload(mimeType: string, sizeBytes: number): ValidationResult {
  if (!ALLOWED_PHOTO_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: "That doesn't look like an image — try a JPEG, PNG, WebP, GIF, or HEIC." };
  }
  if (sizeBytes > MAX_PHOTO_BYTES) {
    return { ok: false, error: "That photo is too large — keep it under 10MB." };
  }
  return { ok: true };
}

/** A Measure step's value/target must be a real, finite number — guards
 * against a blank or malformed numeric input parsing to NaN and getting
 * silently persisted. */
export function isValidMeasureNumber(value: number): boolean {
  return Number.isFinite(value);
}

export type RepeatingSchedule = {
  cadenceDays: number;
  anchorDate: Date;
  endCondition: "FIXED_COUNT" | "REVIEW_DATE";
  endValue: number | null;
  /** The System's review date — only consulted for REVIEW_DATE. */
  reviewDate: Date | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight UTC of the given date's calendar day — matches how dated
 * columns (e.g. SystemStepOccurrence.occurredOn) are stored (`@db.Date`).
 * Every date this module works with is normalized through this first, so
 * a full-precision timestamp like a step's `createdAt` never desyncs from
 * a midnight-stored logged date by a few hours and silently misclassifies. */
export function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** A Repeating step's expected occurrence dates — computed on the fly
 * from its cadence, same idiom as the Phase 1 schedule engine
 * (schedOf/isDue), never materialized as rows. Stops at the end
 * condition: a fixed count of occurrences, or the System's review date
 * (whichever the template chose). `upTo` bounds how far into the future
 * to compute (typically "today"), so this never generates an unbounded
 * list for an open-ended cadence. */
export function expectedOccurrenceDates(schedule: RepeatingSchedule, upTo: Date): Date[] {
  if (schedule.cadenceDays < 1) return [];

  const upToMidnight = utcMidnight(upTo);
  const hardStop =
    schedule.endCondition === "REVIEW_DATE" && schedule.reviewDate
      ? new Date(Math.min(upToMidnight.getTime(), utcMidnight(schedule.reviewDate).getTime()))
      : upToMidnight;

  const dates: Date[] = [];
  let cursor = utcMidnight(schedule.anchorDate).getTime();
  const step = schedule.cadenceDays * DAY_MS;

  while (cursor <= hardStop.getTime()) {
    if (schedule.endCondition === "FIXED_COUNT" && schedule.endValue !== null && dates.length >= schedule.endValue) {
      break;
    }
    dates.push(new Date(cursor));
    cursor += step;
  }
  return dates;
}

export type OccurrenceStatus = "ON_TIME" | "LATE" | "SKIPPED";

/**
 * Classifies each expected occurrence against the logged dates: ON_TIME if
 * a log falls on the expected date itself, LATE if a log falls after it
 * but before the next expected date, SKIPPED if no log exists in that
 * window and the window has already closed (the next expected date has
 * arrived, or there is no next one and `today` is past it).
 */
export function classifyOccurrences(expected: Date[], logged: Date[], today: Date): OccurrenceStatus[] {
  const expectedMidnight = expected.map(utcMidnight);
  const loggedTimes = logged.map((d) => utcMidnight(d).getTime()).sort((a, b) => a - b);
  const todayMidnight = utcMidnight(today);

  return expectedMidnight.map((date, i) => {
    const windowStart = date.getTime();
    const windowEnd = i + 1 < expectedMidnight.length ? expectedMidnight[i + 1].getTime() : Infinity;
    const match = loggedTimes.find((t) => t >= windowStart && t < windowEnd);

    if (match === windowStart) return "ON_TIME";
    if (match !== undefined) return "LATE";
    const windowClosed = windowEnd !== Infinity ? true : todayMidnight.getTime() > windowStart;
    return windowClosed ? "SKIPPED" : "ON_TIME";
  });
}
