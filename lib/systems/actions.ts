"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  validateCreateSystemInput,
  canSetParent,
  resolveBackdate,
  isValidRating,
  isValidMeasureNumber,
  type SystemType,
  type SystemState,
} from "./logic";

export type ActionResult = { ok: true } | { ok: false; error: string };
const SAVE_ERROR = "Couldn't save — try again.";

function revalidateSystemPaths(areaId: string | null, pillarId: string) {
  if (areaId) revalidatePath(`/health/${areaId}`);
  revalidatePath(`/pillars/${pillarId}`);
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
    revalidateSystemPaths(input.areaId, input.pillarId);
    return { ok: true, id: system.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function setSystemState(systemId: string, state: SystemState): Promise<ActionResult> {
  try {
    const system = await prisma.system.update({ where: { id: systemId }, data: { state } });
    revalidateSystemPaths(system.areaId, system.pillarId);
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
    revalidateSystemPaths(system.areaId, system.pillarId);
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
    revalidateSystemPaths(copy.areaId, copy.pillarId);
    return { ok: true, id: copy.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function setSystemParent(systemId: string, parentId: string | null): Promise<ActionResult> {
  try {
    if (parentId) {
      const childCount = await prisma.system.count({ where: { parentId: systemId } });
      if (!canSetParent(childCount > 0)) {
        return { ok: false, error: "This System already has children — nesting is capped at one level." };
      }
    }
    const system = await prisma.system.update({ where: { id: systemId }, data: { parentId } });
    revalidateSystemPaths(system.areaId, system.pillarId);
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
    revalidateSystemPaths(system.areaId, system.pillarId);
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
    revalidateSystemPaths(system.areaId, system.pillarId);
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
    revalidateSystemPaths(step.system.areaId, step.system.pillarId);
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
    revalidateSystemPaths(system.areaId, system.pillarId);
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
    revalidateSystemPaths(system.areaId, system.pillarId);
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
    revalidateSystemPaths(step.system.areaId, step.system.pillarId);
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
    revalidateSystemPaths(step.system.areaId, step.system.pillarId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

export async function deleteSystemStep(stepId: string): Promise<ActionResult> {
  try {
    const step = await prisma.systemStep.delete({ where: { id: stepId }, include: { system: true } });
    revalidateSystemPaths(step.system.areaId, step.system.pillarId);
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
    revalidateSystemPaths(step.system.areaId, step.system.pillarId);
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
    revalidateSystemPaths(system.areaId, system.pillarId);
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
    revalidateSystemPaths(step.system.areaId, step.system.pillarId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}
