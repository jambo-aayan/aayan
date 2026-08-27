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
