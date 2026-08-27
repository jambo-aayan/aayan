"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { validateCreateSystemInput, canSetParent, type SystemType, type SystemState } from "./logic";

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
  try {
    const step = await prisma.systemStep.update({
      where: { id: stepId },
      data: { doneOn },
      include: { system: true },
    });
    revalidateSystemPaths(step.system.areaId, step.system.pillarId);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}
