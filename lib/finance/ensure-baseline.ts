import "server-only";
import { prisma } from "@/lib/prisma";
import { BASELINE_ID } from "./baseline-id";

/** Ensures the singleton Baseline row exists, never overwriting an existing one. */
export async function ensureBaselineExists(): Promise<void> {
  await prisma.baseline.upsert({
    where: { id: BASELINE_ID },
    create: { id: BASELINE_ID },
    update: {},
  });
}
