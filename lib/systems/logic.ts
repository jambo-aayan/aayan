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
