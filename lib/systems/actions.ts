"use server";

import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import {
  validateCreateSystemInput,
  canSetParent,
  resolveBackdate,
  isValidRating,
  isValidMeasureNumber,
  validatePhotoUpload,
  resolveRunReview,
  isVerdictDue,
  type SystemType,
  type SystemState,
} from "./logic";

export type ActionResult = { ok: true } | { ok: false; error: string };
const SAVE_ERROR = "Couldn't save — try again.";

/** No per-Pillar dynamic route exists yet (`/pillars` is a flat index),
 * so revalidating one isn't possible — only the index. */
function revalidateSystemPaths(areaId: string | null) {
  if (areaId) revalidatePath(`/health/${areaId}`);
  revalidatePath("/pillars");
  revalidatePath("/my-day");
  revalidatePath("/systems");
}

export type CreateSystemInput = {
  name: string;
  pillarId: string;
  areaId: string | null;
  type: SystemType;
  body: string | null;
  review: Date | null;
  criteria: string | null;
};

export type CreateSystemResult = { ok: true; id: string } | { ok: false; error: string };

export async function createSystem(input: CreateSystemInput): Promise<CreateSystemResult> {
  const validation = validateCreateSystemInput({
    name: input.name,
    type: input.type,
    review: input.review,
    criteria: input.criteria,
  });
  if (!validation.ok) return validation;

  try {
    const system = await prisma.system.create({
      data: {
        name: input.name.trim(),
        pillarId: input.pillarId,
        areaId: input.areaId,
        type: input.type,
        body: input.body,
        review: input.type === "EXPERIMENT" ? input.review : null,
        criteria: input.type === "EXPERIMENT" ? input.criteria : null,
      },
    });
    revalidateSystemPaths(input.areaId);
    return { ok: true, id: system.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function setSystemTemplate(
  systemId: string,
  isTemplate: boolean,
  runNoun: string | null
): Promise<ActionResult> {
  try {
    const system = await prisma.system.update({
      where: { id: systemId },
      data: { isTemplate, runNoun: isTemplate ? runNoun?.trim() || null : null },
    });
    revalidateSystemPaths(system.areaId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

export type StartSystemRunResult = { ok: true; id: string } | { ok: false; error: string };

/** A run is a System row with templateId set, not a separate entity — its
 * steps are copied (not referenced) from the template at creation time,
 * so editing the template later never rewrites history for runs already
 * in progress or concluded. review is always stamped as a concrete
 * DateTime, resolved from the template's relative-offset or absolute
 * flavor, so verdict-trigger logic downstream only ever reads one field. */
export async function startSystemRun(templateId: string): Promise<StartSystemRunResult> {
  try {
    const template = await prisma.system.findUniqueOrThrow({ where: { id: templateId }, include: { steps: true } });
    if (!template.isTemplate) return { ok: false, error: "This System isn't a template." };

    const runStart = new Date();
    const review = resolveRunReview(
      { review: template.review, reviewOffsetDays: template.reviewOffsetDays },
      runStart
    );

    const run = await prisma.system.create({
      data: {
        name: template.name,
        pillarId: template.pillarId,
        areaId: template.areaId,
        type: template.type,
        body: template.body,
        review,
        criteria: template.criteria,
        sequential: template.sequential,
        templateId: template.id,
        createdAt: runStart,
        steps: {
          create: template.steps.map((s) => ({
            type: s.type,
            text: s.text,
            sortOrder: s.sortOrder,
            targetDate: s.targetDate,
            date: s.date,
            unit: s.unit,
            target: s.target,
            metricName: s.metricName,
            cadenceDays: s.cadenceDays,
            endCondition: s.endCondition,
            endValue: s.endValue,
          })),
        },
      },
    });
    revalidateSystemPaths(run.areaId);
    return { ok: true, id: run.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export type ConcludeRunResult = { ok: true } | { ok: false; error: string };

/** A Process run's conclusion: a plain "mark concluded" plus an optional
 * outcome note — not forced into an Experiment's continue/escalate/stop
 * framing. */
export async function concludeProcessRun(runId: string, outcome: string | null): Promise<ConcludeRunResult> {
  try {
    const run = await prisma.system.findUniqueOrThrow({ where: { id: runId }, include: { steps: true } });
    if (run.type !== "PROCESS") return { ok: false, error: "Only Process runs conclude this way." };

    await prisma.system.update({
      where: { id: runId },
      data: {
        runEnd: new Date(),
        runOutcome: outcome?.trim() || null,
        runStepsDone: run.steps.filter((s) => s.done).length,
      },
    });
    revalidateSystemPaths(run.areaId);
    return { ok: true };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export type SetVerdictInput = { verdict: "CONTINUE" | "ESCALATE" | "STOP"; outcome: string | null };
export type SetVerdictResult = { ok: true } | { ok: false; error: string };

/** An Experiment run's verdict — Continue/Escalate/Stop plus an optional
 * outcome note, tied to the review date having been reached (render-time
 * check, not a manually added step). */
export async function setRunVerdict(runId: string, input: SetVerdictInput): Promise<SetVerdictResult> {
  try {
    const run = await prisma.system.findUniqueOrThrow({ where: { id: runId }, include: { steps: true } });
    if (run.type !== "EXPERIMENT") return { ok: false, error: "Only Experiment runs get a verdict." };
    if (!isVerdictDue(run.review, new Date())) {
      return { ok: false, error: "This run hasn't reached its review date yet." };
    }

    const ratings = run.steps.filter((s) => s.rating !== null).map((s) => s.rating!);
    const runRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null;

    await prisma.system.update({
      where: { id: runId },
      data: {
        verdict: input.verdict,
        runEnd: new Date(),
        runOutcome: input.outcome?.trim() || null,
        runStepsDone: run.steps.filter((s) => s.done).length,
        runRating,
      },
    });
    revalidateSystemPaths(run.areaId);
    return { ok: true };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function setSystemSequential(systemId: string, sequential: boolean): Promise<ActionResult> {
  try {
    const system = await prisma.system.update({ where: { id: systemId }, data: { sequential } });
    revalidateSystemPaths(system.areaId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

export async function setSystemState(systemId: string, state: SystemState): Promise<ActionResult> {
  try {
    const system = await prisma.system.update({ where: { id: systemId }, data: { state } });
    revalidateSystemPaths(system.areaId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

export async function updateSystemReference(systemId: string, reference: string): Promise<ActionResult> {
  try {
    const system = await prisma.system.update({
      where: { id: systemId },
      data: { reference: reference.trim() || null },
    });
    revalidateSystemPaths(system.areaId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

export type DuplicateSystemResult = { ok: true; id: string } | { ok: false; error: string };

/** A one-time, unlinked, editable copy created as a Draft — deliberately
 * not the template/run relationship (no templateId set on the copy). */
export async function duplicateSystem(systemId: string): Promise<DuplicateSystemResult> {
  try {
    const source = await prisma.system.findUniqueOrThrow({
      where: { id: systemId },
      include: { steps: true },
    });
    const copy = await prisma.system.create({
      data: {
        name: `${source.name} (copy)`,
        pillarId: source.pillarId,
        areaId: source.areaId,
        type: source.type,
        state: "DRAFT",
        body: source.body,
        reference: source.reference,
        review: source.review,
        criteria: source.criteria,
        sequential: source.sequential,
        steps: {
          create: source.steps.map((s) => ({
            type: s.type,
            text: s.text,
            sortOrder: s.sortOrder,
          })),
        },
      },
    });
    revalidateSystemPaths(copy.areaId);
    return { ok: true, id: copy.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function setSystemParent(systemId: string, parentId: string | null): Promise<ActionResult> {
  try {
    if (parentId) {
      if (parentId === systemId) {
        return { ok: false, error: "A System can't be its own parent." };
      }
      const [child, childCount, candidateParent] = await Promise.all([
        prisma.system.findUniqueOrThrow({ where: { id: systemId } }),
        prisma.system.count({ where: { parentId: systemId } }),
        prisma.system.findUniqueOrThrow({ where: { id: parentId } }),
      ]);
      // Nesting is scoped like the System list itself (per Area, or per
      // Pillar for pillar-level Systems) — otherwise a cross-scope parent
      // never appears alongside its child in any one list, and the child
      // silently vanishes from grouped views (groupByParent treats an
      // out-of-scope parentId as unparented rather than dropping the row,
      // but the "Inside this"/"Part of" pairing itself would still never
      // render together anywhere).
      if (candidateParent.pillarId !== child.pillarId || candidateParent.areaId !== child.areaId) {
        return { ok: false, error: "A System can only nest under another System in the same Area/Pillar." };
      }
      if (!canSetParent(childCount > 0, candidateParent.parentId !== null)) {
        return {
          ok: false,
          error: candidateParent.parentId !== null
            ? "That System is already nested under another — nesting is capped at one level."
            : "This System already has children — nesting is capped at one level.",
        };
      }
    }
    const system = await prisma.system.update({ where: { id: systemId }, data: { parentId } });
    revalidateSystemPaths(system.areaId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

export type AddChecklistStepResult = { ok: true; id: string } | { ok: false; error: string };

export async function addChecklistStep(systemId: string, text: string): Promise<AddChecklistStepResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Give the step some text first." };

  try {
    const [system, count] = await Promise.all([
      prisma.system.findUniqueOrThrow({ where: { id: systemId } }),
      prisma.systemStep.count({ where: { systemId } }),
    ]);
    const step = await prisma.systemStep.create({
      data: { systemId, type: "CHECKLIST", text: trimmed, sortOrder: count },
    });
    revalidateSystemPaths(system.areaId);
    return { ok: true, id: step.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export type AddCheckpointStepResult = { ok: true; id: string } | { ok: false; error: string };

export async function addCheckpointStep(
  systemId: string,
  text: string,
  targetDate: Date | null
): Promise<AddCheckpointStepResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Give the step some text first." };

  try {
    const [system, count] = await Promise.all([
      prisma.system.findUniqueOrThrow({ where: { id: systemId } }),
      prisma.systemStep.count({ where: { systemId } }),
    ]);
    const step = await prisma.systemStep.create({
      data: { systemId, type: "CHECKPOINT", text: trimmed, targetDate, sortOrder: count },
    });
    revalidateSystemPaths(system.areaId);
    return { ok: true, id: step.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

/** The tick-then-prompt capture — rating/comment are always optional and
 * skippable, never blocking the tick itself. */
export async function captureCheckpoint(
  stepId: string,
  input: { rating: number | null; comment: string | null }
): Promise<ActionResult> {
  if (input.rating !== null && !isValidRating(input.rating)) {
    return { ok: false, error: "Rating must be 1-5." };
  }

  try {
    const step = await prisma.systemStep.update({
      where: { id: stepId },
      data: { rating: input.rating, comment: input.comment?.trim() || null },
      include: { system: true },
    });
    revalidateSystemPaths(step.system.areaId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

export type AddMilestoneStepResult = { ok: true; id: string } | { ok: false; error: string };

export async function addMilestoneStep(systemId: string, text: string, date: Date): Promise<AddMilestoneStepResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Give the milestone some text first." };

  try {
    const [system, count] = await Promise.all([
      prisma.system.findUniqueOrThrow({ where: { id: systemId } }),
      prisma.systemStep.count({ where: { systemId } }),
    ]);
    const step = await prisma.systemStep.create({
      data: { systemId, type: "MILESTONE", text: trimmed, date, sortOrder: count },
    });
    revalidateSystemPaths(system.areaId);
    return { ok: true, id: step.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export type AddMeasureStepInput = {
  text: string;
  metricName: string;
  unit: string | null;
  target: number | null;
};

export type AddMeasureStepResult = { ok: true; id: string } | { ok: false; error: string };

export async function addMeasureStep(systemId: string, input: AddMeasureStepInput): Promise<AddMeasureStepResult> {
  const text = input.text.trim();
  const metricName = input.metricName.trim();
  if (!text) return { ok: false, error: "Give the step some text first." };
  if (!metricName) return { ok: false, error: "Name the metric first." };
  if (input.target !== null && !isValidMeasureNumber(input.target)) {
    return { ok: false, error: "Target must be a number." };
  }

  try {
    const [system, count] = await Promise.all([
      prisma.system.findUniqueOrThrow({ where: { id: systemId } }),
      prisma.systemStep.count({ where: { systemId } }),
    ]);
    const step = await prisma.systemStep.create({
      data: { systemId, type: "MEASURE", text, metricName, unit: input.unit, target: input.target, sortOrder: count },
    });
    revalidateSystemPaths(system.areaId);
    return { ok: true, id: step.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

/** Ticking a Measure step prompts for its numeric reading — the same
 * tick-then-prompt shape as Checkpoint's rating capture (toggleSystemStep
 * flips done/doneOn; this separately records the value). */
export async function captureMeasureValue(stepId: string, value: number): Promise<ActionResult> {
  if (!isValidMeasureNumber(value)) return { ok: false, error: "Value must be a number." };

  try {
    const step = await prisma.systemStep.update({
      where: { id: stepId },
      data: { value },
      include: { system: true },
    });
    revalidateSystemPaths(step.system.areaId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

export type AddRepeatingStepInput = {
  text: string;
  cadenceDays: number;
  endCondition: "FIXED_COUNT" | "REVIEW_DATE";
  endValue: number | null;
};

export type AddRepeatingStepResult = { ok: true; id: string } | { ok: false; error: string };

export async function addRepeatingStep(systemId: string, input: AddRepeatingStepInput): Promise<AddRepeatingStepResult> {
  const text = input.text.trim();
  if (!text) return { ok: false, error: "Give the step some text first." };
  if (input.cadenceDays < 1) return { ok: false, error: "Cadence must be at least 1 day." };
  if (input.endCondition === "FIXED_COUNT" && (!input.endValue || input.endValue < 1)) {
    return { ok: false, error: "Give a fixed occurrence count of at least 1." };
  }

  try {
    const [system, count] = await Promise.all([
      prisma.system.findUniqueOrThrow({ where: { id: systemId } }),
      prisma.systemStep.count({ where: { systemId } }),
    ]);
    if (input.endCondition === "REVIEW_DATE" && !system.review) {
      return { ok: false, error: "This System has no review date to tie the cadence to." };
    }
    const step = await prisma.systemStep.create({
      data: {
        systemId,
        type: "REPEATING",
        text,
        cadenceDays: input.cadenceDays,
        endCondition: input.endCondition,
        endValue: input.endCondition === "FIXED_COUNT" ? input.endValue : null,
        sortOrder: count,
      },
    });
    revalidateSystemPaths(system.areaId);
    return { ok: true, id: step.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export type LogOccurrenceResult = { ok: true; id: string; occurredOn: Date } | { ok: false; error: string };

/** Logs a completion of a Repeating step, backdatable the same way as any
 * other step (see resolveBackdate). */
export async function logSystemStepOccurrence(stepId: string, occurredOn: Date): Promise<LogOccurrenceResult> {
  const resolved = resolveBackdate(occurredOn, new Date());
  if (!resolved.ok) return resolved;

  try {
    const step = await prisma.systemStep.findUniqueOrThrow({ where: { id: stepId }, include: { system: true } });
    const occurrence = await prisma.systemStepOccurrence.create({
      data: { stepId, occurredOn: resolved.date },
    });
    revalidateSystemPaths(step.system.areaId);
    return { ok: true, id: occurrence.id, occurredOn: occurrence.occurredOn };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

/** Corrects a mis-logged occurrence (wrong date, duplicate log) — the
 * counterpart to logSystemStepOccurrence, surfaced next to each logged
 * date in the UI. */
export async function deleteSystemStepOccurrence(occurrenceId: string): Promise<ActionResult> {
  try {
    const occurrence = await prisma.systemStepOccurrence.delete({
      where: { id: occurrenceId },
      include: { step: { include: { system: true } } },
    });
    revalidateSystemPaths(occurrence.step.system.areaId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

export type LinkSystemHabitResult =
  | { ok: true; status: string; checkInDates: Date[] }
  | { ok: false; error: string };

/** Returns the habit's real current status/check-in dates rather than just
 * `{ok: true}` — the caller's optimistic chip needs real data immediately
 * (not a placeholder that never gets corrected until a full page reload),
 * since checkInDates feed the rating-vs-adherence scatter widget. */
export async function linkSystemHabit(systemId: string, habitId: string): Promise<LinkSystemHabitResult> {
  try {
    const [system, habit] = await Promise.all([
      prisma.system.findUniqueOrThrow({ where: { id: systemId } }),
      prisma.habit.findUniqueOrThrow({ where: { id: habitId }, include: { checkIns: { select: { date: true } } } }),
    ]);
    await prisma.systemHabit.upsert({
      where: { systemId_habitId: { systemId, habitId } },
      create: { systemId, habitId },
      update: {},
    });
    revalidateSystemPaths(system.areaId);
    return { ok: true, status: habit.status, checkInDates: habit.checkIns.map((c) => c.date) };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function unlinkSystemHabit(systemId: string, habitId: string): Promise<ActionResult> {
  try {
    const system = await prisma.system.findUniqueOrThrow({ where: { id: systemId } });
    await prisma.systemHabit.deleteMany({ where: { systemId, habitId } });
    revalidateSystemPaths(system.areaId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

export type LinkSystemGoalResult = { ok: true; status: string } | { ok: false; error: string };

export async function linkSystemGoal(systemId: string, goalId: string): Promise<LinkSystemGoalResult> {
  try {
    const [system, goal] = await Promise.all([
      prisma.system.findUniqueOrThrow({ where: { id: systemId } }),
      prisma.lifeGoal.findUniqueOrThrow({ where: { id: goalId } }),
    ]);
    await prisma.systemGoal.upsert({
      where: { systemId_goalId: { systemId, goalId } },
      create: { systemId, goalId },
      update: {},
    });
    revalidateSystemPaths(system.areaId);
    return { ok: true, status: goal.status };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function unlinkSystemGoal(systemId: string, goalId: string): Promise<ActionResult> {
  try {
    const system = await prisma.system.findUniqueOrThrow({ where: { id: systemId } });
    await prisma.systemGoal.deleteMany({ where: { systemId, goalId } });
    revalidateSystemPaths(system.areaId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

export async function updateChecklistStep(stepId: string, text: string): Promise<ActionResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Give the step some text first." };

  try {
    const step = await prisma.systemStep.update({
      where: { id: stepId },
      data: { text: trimmed },
      include: { system: true },
    });
    revalidateSystemPaths(step.system.areaId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

/** Deletes the Blob object alongside the Prisma delete when the step
 * carries a photo — a stray Blob otherwise has no code path that ever
 * cleans it up. Best-effort: if the Blob delete fails (already gone,
 * network issue) it's swallowed rather than blocking the step delete —
 * an orphaned Blob object is a cost, not a correctness problem, and the
 * step row is the source of truth the user is acting on. */
export async function deleteSystemStep(stepId: string): Promise<ActionResult> {
  try {
    const step = await prisma.systemStep.delete({ where: { id: stepId }, include: { system: true } });
    if (step.photoUrl) {
      await del(step.photoUrl).catch(() => {});
    }
    revalidateSystemPaths(step.system.areaId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

export type UploadCheckpointPhotoResult = { ok: true; photoUrl: string } | { ok: false; error: string };

/** Uploads a Checkpoint photo to Vercel Blob and stores only the returned
 * CDN URL — no binary data in Postgres. Replaces (and deletes) any
 * existing photo on the step, since a Checkpoint step carries at most
 * one photo per DATA_MODEL.md §5. */
export async function uploadCheckpointPhoto(stepId: string, file: File): Promise<UploadCheckpointPhotoResult> {
  const validation = validatePhotoUpload(file.type, file.size);
  if (!validation.ok) return validation;

  try {
    const step = await prisma.systemStep.findUniqueOrThrow({ where: { id: stepId }, include: { system: true } });
    const blob = await put(`system-checkpoints/${stepId}-${Date.now()}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    // The DB write is confirmed durable before the old blob is touched —
    // if it were the other way around and this update failed, the old
    // (working) photo would already be gone from storage while the row
    // still pointed at its now-dead URL. Only once the row points at the
    // new blob is the old one's deletion safe to attempt (best-effort,
    // per deleteSystemStep's rationale — an orphan here is a cost, not a
    // correctness problem, unlike a broken reference would be).
    await prisma.systemStep.update({ where: { id: stepId }, data: { photoUrl: blob.url } });
    if (step.photoUrl) {
      await del(step.photoUrl).catch(() => {});
    }
    revalidateSystemPaths(step.system.areaId);
    return { ok: true, photoUrl: blob.url };
  } catch {
    return { ok: false, error: "Couldn't upload the photo — try again." };
  }
}

export async function deleteCheckpointPhoto(stepId: string): Promise<ActionResult> {
  try {
    const step = await prisma.systemStep.findUniqueOrThrow({ where: { id: stepId }, include: { system: true } });
    if (step.photoUrl) {
      await del(step.photoUrl).catch(() => {});
    }
    await prisma.systemStep.update({ where: { id: stepId }, data: { photoUrl: null } });
    revalidateSystemPaths(step.system.areaId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

/** Ticking stamps today's date on doneOn; a "Not today?" backdate picker
 * (a separate call) corrects it after. Un-ticking clears doneOn. */
export async function toggleSystemStep(stepId: string): Promise<ActionResult> {
  try {
    const step = await prisma.systemStep.findUniqueOrThrow({ where: { id: stepId }, include: { system: true } });
    const done = !step.done;
    await prisma.systemStep.update({
      where: { id: stepId },
      data: { done, doneOn: done ? new Date() : null },
    });
    revalidateSystemPaths(step.system.areaId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

export type AddSystemDecisionResult = { ok: true; id: string; when: Date } | { ok: false; error: string };

export async function addSystemDecision(systemId: string, body: string): Promise<AddSystemDecisionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Write the decision first." };

  try {
    const system = await prisma.system.findUniqueOrThrow({ where: { id: systemId } });
    const decision = await prisma.systemDecision.create({ data: { systemId, body: trimmed } });
    revalidateSystemPaths(system.areaId);
    return { ok: true, id: decision.id, when: decision.when };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function backdateSystemStep(stepId: string, doneOn: Date): Promise<ActionResult> {
  const resolved = resolveBackdate(doneOn, new Date());
  if (!resolved.ok) return resolved;

  try {
    const step = await prisma.systemStep.update({
      where: { id: stepId },
      data: { doneOn: resolved.date },
      include: { system: true },
    });
    revalidateSystemPaths(step.system.areaId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}
