import "server-only";
import { prisma } from "@/lib/prisma";
import { ensureBaselineExists } from "./ensure-baseline";
import { BASELINE_ID } from "./baseline-id";

// Prisma's Decimal isn't a plain serializable value — Client Components
// need a plain number, so every read converts here at the DB boundary.

export async function getItems() {
  const items = await prisma.item.findMany({ orderBy: { createdAt: "asc" } });
  return items.map((item) => ({ ...item, value: item.value.toNumber() }));
}

export async function getBaseline() {
  await ensureBaselineExists();
  const baseline = await prisma.baseline.findUniqueOrThrow({ where: { id: BASELINE_ID } });
  return {
    monthlyIncome: baseline.monthlyIncome.toNumber(),
    fixedOutgoings: baseline.fixedOutgoings.toNumber(),
  };
}
