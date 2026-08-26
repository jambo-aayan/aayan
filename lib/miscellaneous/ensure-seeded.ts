import "server-only";
import { prisma } from "@/lib/prisma";
import { MISCELLANEOUS_PILLAR_ID, MISCELLANEOUS_PILLAR_NAME } from "./pillar-id";

/** Miscellaneous has no Areas — same flat shape as Finances (see
 * lib/finance/ensure-seeded.ts) — and is the default destination for an
 * untagged Thought (see docs/adr/0005-v2-phase1-foundations-migration.md).
 * Same idempotent upsert-and-never-touch-existing pattern as every other
 * Pillar's ensure-seeded. */
export async function ensureMiscellaneousPillarSeeded(): Promise<void> {
  await prisma.pillar.upsert({
    where: { id: MISCELLANEOUS_PILLAR_ID },
    create: {
      id: MISCELLANEOUS_PILLAR_ID,
      name: MISCELLANEOUS_PILLAR_NAME,
      desc: "Anything that isn't Health or Finances",
    },
    update: {},
  });
}
