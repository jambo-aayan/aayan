import "server-only";
import { prisma } from "@/lib/prisma";
import { missingSeedItems } from "./missing-seed-items";
import { HEALTH_AREAS_SEED, HEALTH_PILLAR_ID, HEALTH_PILLAR_NAME } from "./seed-data";

/**
 * Per-item, idempotent seeding: only ever creates rows for seed ids that
 * don't exist yet, and never touches an existing row — so a later edit to
 * an Area's currentState/northStar is never clobbered by a reseed, and a
 * seed list that grows over time still lands its new items on next load.
 */
export async function ensureHealthAreasSeeded(): Promise<void> {
  await prisma.pillar.upsert({
    where: { id: HEALTH_PILLAR_ID },
    create: { id: HEALTH_PILLAR_ID, name: HEALTH_PILLAR_NAME, desc: "Habits, Areas, and Pain & Mobility tracking" },
    update: {},
  });

  const existing = await prisma.area.findMany({
    where: { pillarId: HEALTH_PILLAR_ID },
    select: { id: true },
  });
  const missing = missingSeedItems(
    HEALTH_AREAS_SEED,
    existing.map((a) => a.id)
  );

  if (missing.length === 0) return;

  // skipDuplicates guards against two concurrent first-loads both computing
  // the same "missing" set and racing to insert the same id.
  await prisma.area.createMany({
    data: missing.map((area) => ({ ...area, pillarId: HEALTH_PILLAR_ID })),
    skipDuplicates: true,
  });
}
