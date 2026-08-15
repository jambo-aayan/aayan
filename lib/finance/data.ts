import "server-only";
import { prisma } from "@/lib/prisma";
import { ensureBaselineExists } from "./ensure-baseline";
import { BASELINE_ID } from "./baseline-id";
import { ensureFinanceNorthStarExists } from "./ensure-north-star";
import { FINANCE_NORTH_STAR_ID } from "./north-star-id";

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

export async function getGoals() {
  const goals = await prisma.goal.findMany({ orderBy: { createdAt: "asc" } });
  return goals.map((goal) => ({
    ...goal,
    target: goal.target.toNumber(),
    saved: goal.saved.toNumber(),
    monthlyContribution: goal.monthlyContribution.toNumber(),
  }));
}

export async function getFinanceNorthStar() {
  await ensureFinanceNorthStarExists();
  const northStar = await prisma.financeNorthStar.findUniqueOrThrow({
    where: { id: FINANCE_NORTH_STAR_ID },
  });
  return {
    target: northStar.target?.toNumber() ?? null,
    deadline: northStar.deadline,
  };
}
