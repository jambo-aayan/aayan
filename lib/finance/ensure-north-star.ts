import "server-only";
import { prisma } from "@/lib/prisma";
import { FINANCE_NORTH_STAR_ID } from "./north-star-id";

/** Ensures the singleton FinanceNorthStar row exists, never overwriting an existing one. */
export async function ensureFinanceNorthStarExists(): Promise<void> {
  await prisma.financeNorthStar.upsert({
    where: { id: FINANCE_NORTH_STAR_ID },
    create: { id: FINANCE_NORTH_STAR_ID },
    update: {},
  });
}
