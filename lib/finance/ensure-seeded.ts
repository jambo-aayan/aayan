import "server-only";
import { prisma } from "@/lib/prisma";
import { FINANCE_PILLAR_ID } from "./pillar-id";

/** Finances has no Areas (it's flat — see #49's Data model notes), so
 * unlike Health there's nothing to seed but the Pillar row itself. Same
 * idempotent upsert-and-never-touch-existing pattern as
 * lib/health/ensure-seeded.ts. */
export async function ensureFinancePillarSeeded(): Promise<void> {
  await prisma.pillar.upsert({
    where: { id: FINANCE_PILLAR_ID },
    create: { id: FINANCE_PILLAR_ID, name: "Finances", desc: "Net worth, Goals, and Transactions" },
    update: {},
  });
}
