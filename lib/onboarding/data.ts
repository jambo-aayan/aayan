import "server-only";
import { prisma } from "@/lib/prisma";
import { HEALTH_PILLAR_ID } from "@/lib/health/seed-data";
import { FINANCE_PILLAR_ID } from "@/lib/finance/pillar-id";
import { FINANCE_NORTH_STAR_ID } from "@/lib/finance/north-star-id";

export type DayOneSteps = {
  pillars: boolean;
  northStar: boolean;
  habit: boolean;
  capture: boolean;
};

export type DayOneStatus = {
  /** True only when every step is still to-do — the signal for whether
   * Home should show Day-one instead of the normal dashboard. Health and
   * Finances auto-seed themselves as Pillars the first time their own
   * pages load (see lib/health/ensure-seeded.ts,
   * lib/finance/ensure-seeded.ts) — that's chrome, not something the user
   * did, so it's excluded from the "did they name a Pillar" check below. */
  isEmpty: boolean;
  steps: DayOneSteps;
};

export async function getDayOneStatus(): Promise<DayOneStatus> {
  const [userPillarCount, northStar, habitCount, taskCount, thoughtCount] = await Promise.all([
    prisma.pillar.count({ where: { id: { notIn: [HEALTH_PILLAR_ID, FINANCE_PILLAR_ID] } } }),
    prisma.financeNorthStar.findUnique({ where: { id: FINANCE_NORTH_STAR_ID }, select: { target: true } }),
    prisma.habit.count(),
    prisma.task.count(),
    prisma.thought.count(),
  ]);

  const steps: DayOneSteps = {
    pillars: userPillarCount > 0,
    northStar: northStar?.target !== null && northStar?.target !== undefined,
    habit: habitCount > 0,
    capture: taskCount > 0 || thoughtCount > 0,
  };

  return { isEmpty: !steps.pillars && !steps.northStar && !steps.habit && !steps.capture, steps };
}
