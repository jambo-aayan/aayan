export type SystemType = "PROCESS" | "EXPERIMENT";
export type SystemState = "ACTIVE" | "PAUSED" | "DRAFT" | "ARCHIVED";
export type SystemVerdict = "CONTINUE" | "ESCALATE" | "STOP";

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
 * children cannot itself be given a parentId (it would become both a
 * parent and a child), and a System cannot be nested under a candidate
 * parent that is itself already a child (that would create a
 * grandparent -> parent -> child chain, two levels deep). Both checks
 * are needed — checking only the first still lets a child-of-A become a
 * parent-of-B, silently building the second level from the other end. */
export function canSetParent(hasChildren: boolean, candidateParentHasParent: boolean): boolean {
  return !hasChildren && !candidateParentHasParent;
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

export type ReviewTemplate = { review: Date | null; reviewOffsetDays: number | null };

/** Resolves a run's concrete review date from its template — relative
 * (`reviewOffsetDays` days after the run's start) or absolute (`review`
 * copied straight through). A run always ends up with one concrete date
 * (or null, for a Process template / an Experiment template somehow
 * lacking both), so downstream verdict-trigger logic never has to know
 * which flavor the template used. */
export function resolveRunReview(template: ReviewTemplate, runStart: Date): Date | null {
  if (template.reviewOffsetDays !== null) {
    return new Date(runStart.getTime() + template.reviewOffsetDays * DAY_MS);
  }
  return template.review;
}

/** An Experiment run surfaces "Set verdict" once its review date has
 * arrived — a render-time comparison, no cron, same pattern as the
 * existing Nudge computation. */
export function isVerdictDue(review: Date | null, today: Date): boolean {
  return review !== null && utcMidnight(today).getTime() >= utcMidnight(review).getTime();
}

/** An Experiment created without criteria (the creation form should
 * prevent this, but defensively) shows an explicit "no criteria was set"
 * notice at verdict time rather than presenting the verdict as if it
 * passed a real test. */
export function hasCriteria(criteria: string | null): boolean {
  return criteria !== null && criteria.trim().length > 0;
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

export type AreaLoad = { name: string; count: number };

/** A one-line highlight of load distribution across Areas — the busiest
 * Area's share plus a callout for one Area sitting at zero, not an
 * exhaustive per-Area readout (the Load section's own rows already show
 * that). Null when there are no active Systems anywhere yet — nothing to
 * highlight. */
export function describeLoad(areas: AreaLoad[]): string | null {
  const total = areas.reduce((sum, a) => sum + a.count, 0);
  if (total === 0) return null;

  const busiest = [...areas].sort((a, b) => b.count - a.count)[0];
  const empty = areas.find((a) => a.count === 0);
  let text = `${busiest.count} of ${total} sit in ${busiest.name}.`;
  if (empty) text += ` Nothing at all in ${empty.name}.`;
  return text;
}

export type TimelineBar = { id: string; endOffsetDays: number | null };

/** Position on the "Everything running" timeline, whose axis starts at
 * today: a Process has no end date at all (the schema has none), so it
 * always renders full width — open-ended. An Experiment's bar ends at its
 * review date, clamped to non-negative — a review that's already overdue
 * (but not yet given a verdict) still renders, as a zero-width marker at
 * today rather than a negative offset off the left edge. */
export function timelineBar(system: { id: string; type: SystemType; review: Date | null }, today: Date): TimelineBar {
  if (system.type === "PROCESS" || system.review === null) return { id: system.id, endOffsetDays: null };
  const days = Math.round((utcMidnight(system.review).getTime() - utcMidnight(today).getTime()) / DAY_MS);
  return { id: system.id, endOffsetDays: Math.max(days, 0) };
}

export type RollupInput = {
  id: string;
  type: SystemType;
  state: SystemState;
  review: Date | null;
  verdict: SystemVerdict | null;
  stepsDone: number;
  totalSteps: number;
};

export type RollupCategory = "REVIEW_DUE" | "REVIEW_UPCOMING" | "IN_PROGRESS" | "VERDICTED" | "INACTIVE";

const ROLLUP_CATEGORY_ORDER: Record<RollupCategory, number> = {
  REVIEW_DUE: 0,
  REVIEW_UPCOMING: 1,
  IN_PROGRESS: 2,
  VERDICTED: 3,
  INACTIVE: 4,
};

/** Which "what needs attention" bucket a System's rollup row falls into.
 * Non-active states always sort last regardless of type — a Paused or
 * Draft System isn't asking for anything right now. */
export function rollupCategory(system: RollupInput, today: Date): RollupCategory {
  if (system.state !== "ACTIVE") return "INACTIVE";
  if (system.type === "EXPERIMENT") {
    if (system.verdict !== null) return "VERDICTED";
    return isVerdictDue(system.review, today) ? "REVIEW_DUE" : "REVIEW_UPCOMING";
  }
  return "IN_PROGRESS";
}

/** Sorts the rollup by what needs attention, not creation order: an
 * Experiment whose review is overdue comes first, then ones with a review
 * approaching soonest, then in-progress Processes (least complete first —
 * furthest from done needs the most attention), then already-verdicted
 * Experiments, then non-active states last. Ties within a category keep
 * their input order (Array.prototype.sort is stable). */
export function sortRollup<T extends RollupInput>(systems: T[], today: Date): T[] {
  return [...systems].sort((a, b) => {
    const orderA = ROLLUP_CATEGORY_ORDER[rollupCategory(a, today)];
    const orderB = ROLLUP_CATEGORY_ORDER[rollupCategory(b, today)];
    if (orderA !== orderB) return orderA - orderB;

    if (orderA === ROLLUP_CATEGORY_ORDER.REVIEW_UPCOMING) {
      return (a.review?.getTime() ?? 0) - (b.review?.getTime() ?? 0);
    }
    if (orderA === ROLLUP_CATEGORY_ORDER.IN_PROGRESS) {
      const fractionA = a.totalSteps === 0 ? 0 : a.stepsDone / a.totalSteps;
      const fractionB = b.totalSteps === 0 ? 0 : b.stepsDone / b.totalSteps;
      return fractionA - fractionB;
    }
    return 0;
  });
}

/** Narrows the rollup to name matches — case-insensitive substring, same
 * as any other "find the thing" search box in the app. A blank query
 * (including whitespace-only) returns every row unfiltered rather than
 * an empty list. */
export function filterRollupByName<T extends { name: string }>(rows: T[], query: string): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return rows;
  return rows.filter((r) => r.name.toLowerCase().includes(trimmed));
}
