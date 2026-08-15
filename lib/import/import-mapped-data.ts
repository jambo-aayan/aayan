import "server-only";
import { prisma } from "@/lib/prisma";
import { BASELINE_ID } from "@/lib/finance/baseline-id";
import type { MappedImport } from "./map-legacy-export";

function toUtcDate(dateStr: string): Date {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Not a valid date: "${dateStr}"`);
  }
  return date;
}

export type ImportSummary = {
  habitsImported: number;
  checkInsImported: number;
  actionGoalsImported: number;
  itemsImported: number;
  goalsImported: number;
  transactionsImported: number;
  baselineImported: boolean;
  skipped: { bucketId: string; count: number }[];
};

/**
 * Writes an already-mapped legacy export into the database. Every row is
 * upserted keyed by its `legacy-*` id (derived from the prototype's own id),
 * so re-running the same export file twice is a no-op rather than a
 * duplicate import.
 */
export async function importMappedData(mapped: MappedImport): Promise<ImportSummary> {
  let checkInsImported = 0;

  for (const habit of mapped.habits) {
    await prisma.habit.upsert({
      where: { id: habit.id },
      update: { areaId: habit.areaId, name: habit.name, frequency: habit.frequency, active: habit.active },
      create: {
        id: habit.id,
        areaId: habit.areaId,
        name: habit.name,
        frequency: habit.frequency,
        active: habit.active,
      },
    });
    if (habit.checkIns.length > 0) {
      const result = await prisma.checkIn.createMany({
        data: habit.checkIns.map((c) => ({ habitId: habit.id, date: toUtcDate(c.date), level: c.level })),
        skipDuplicates: true,
      });
      checkInsImported += result.count;
    }
  }

  for (const goal of mapped.actionGoals) {
    await prisma.actionGoal.upsert({
      where: { id: goal.id },
      update: {
        areaId: goal.areaId,
        name: goal.name,
        status: goal.status,
        dueDate: goal.dueDate ? toUtcDate(goal.dueDate) : null,
        myday: goal.myday,
      },
      create: {
        id: goal.id,
        areaId: goal.areaId,
        name: goal.name,
        status: goal.status,
        dueDate: goal.dueDate ? toUtcDate(goal.dueDate) : null,
        myday: goal.myday,
      },
    });
  }

  for (const item of mapped.items) {
    await prisma.item.upsert({
      where: { id: item.id },
      update: { name: item.name, type: item.type, value: item.value, liquid: item.liquid, excluded: item.excluded },
      create: { ...item },
    });
  }

  for (const goal of mapped.goals) {
    await prisma.goal.upsert({
      where: { id: goal.id },
      update: { name: goal.name, target: goal.target, saved: goal.saved, monthlyContribution: goal.monthlyContribution },
      create: { ...goal },
    });
  }

  for (const tx of mapped.transactions) {
    await prisma.transaction.upsert({
      where: { id: tx.id },
      update: {
        date: toUtcDate(tx.date),
        amount: tx.amount,
        direction: tx.direction,
        category: tx.category,
      },
      create: {
        id: tx.id,
        date: toUtcDate(tx.date),
        amount: tx.amount,
        direction: tx.direction,
        category: tx.category,
      },
    });
  }

  let baselineImported = false;
  if (mapped.baseline) {
    await prisma.baseline.upsert({
      where: { id: BASELINE_ID },
      update: { monthlyIncome: mapped.baseline.monthlyIncome, fixedOutgoings: mapped.baseline.fixedOutgoings },
      create: { id: BASELINE_ID, monthlyIncome: mapped.baseline.monthlyIncome, fixedOutgoings: mapped.baseline.fixedOutgoings },
    });
    baselineImported = true;
  }

  return {
    habitsImported: mapped.habits.length,
    checkInsImported,
    actionGoalsImported: mapped.actionGoals.length,
    itemsImported: mapped.items.length,
    goalsImported: mapped.goals.length,
    transactionsImported: mapped.transactions.length,
    baselineImported,
    skipped: mapped.skipped,
  };
}
