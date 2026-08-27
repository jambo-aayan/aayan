"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { BASELINE_ID } from "./baseline-id";
import { FINANCE_NORTH_STAR_ID } from "./north-star-id";

export type AccountInput = {
  name: string;
  type: "ASSET" | "LIABILITY";
  kind: "TRANSACTIONAL" | "VALUATION";
  cls: string | null;
  /** The account's starting/current value — used to seed a Snapshot on
   * create/restore, never stored on the Account row itself (ADR-0010).
   * Editing an existing account's value happens via addSnapshot, a
   * separate dated log entry, not by overwriting this field in place. */
  value: number;
  accessible: boolean;
  excluded: boolean;
  manualOnly: boolean;
  active: boolean;
};

export type AccountResult =
  | { ok: true; item: AccountInput & { id: string } }
  | { ok: false; error: string };

export type ActionResult = { ok: true } | { ok: false; error: string };

const SAVE_ERROR = "Couldn't save — try again.";

export async function createAccount(input: AccountInput): Promise<AccountResult> {
  const { value, ...accountFields } = input;
  try {
    const account = await prisma.account.create({
      data: { ...accountFields, snapshots: { create: { date: new Date(), balance: value } } },
    });
    revalidatePath("/finances");
    return { ok: true, item: { ...input, id: account.id } };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function updateAccount(id: string, input: AccountInput): Promise<ActionResult> {
  const { name, type, kind, cls, accessible, excluded, manualOnly, active } = input;
  try {
    await prisma.account.update({
      where: { id },
      data: { name, type, kind, cls, accessible, excluded, manualOnly, active },
    });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath("/finances");
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  try {
    await prisma.account.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidatePath("/finances");
  return { ok: true };
}

/** Recreates a just-deleted account with its original id, for the
 * delete-undo toast — seeds one fresh Snapshot at the value it held at
 * delete time (its earlier Snapshot history is not recovered, matching
 * every other delete-undo action in this app, which restores the row,
 * not a full audit trail). */
export async function restoreAccount(account: AccountInput & { id: string }): Promise<ActionResult> {
  const { value, id, ...accountFields } = account;
  try {
    await prisma.account.create({
      data: { id, ...accountFields, snapshots: { create: { date: new Date(), balance: value } } },
    });
  } catch {
    return { ok: false, error: "Couldn't undo — the account may already be back." };
  }
  revalidatePath("/finances");
  return { ok: true };
}

/** Logs a new dated Snapshot for an Account — an account's value comes
 * from its own history, so updating it adds a row rather than overwriting
 * one (ADR-0010). */
export async function addSnapshot(accountId: string, date: Date, balance: number): Promise<ActionResult> {
  try {
    await prisma.snapshot.create({ data: { accountId, date, balance } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath("/finances");
  return { ok: true };
}

export async function updateBaseline(
  monthlyIncome: number,
  fixedOutgoings: number
): Promise<ActionResult> {
  try {
    await prisma.baseline.upsert({
      where: { id: BASELINE_ID },
      create: { id: BASELINE_ID, monthlyIncome, fixedOutgoings },
      update: { monthlyIncome, fixedOutgoings },
    });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath("/finances");
  return { ok: true };
}

export type GoalInput = {
  name: string;
  target: number;
  saved: number;
  monthlyContribution: number;
  vehicle: "EMERGENCY_FUND" | "LISA" | "PENSION" | "STOCKS_ISA" | "CASH_ISA" | "GENERIC";
  priority: number;
};

export type GoalResult =
  | { ok: true; goal: GoalInput & { id: string } }
  | { ok: false; error: string };

export async function createGoal(input: GoalInput): Promise<GoalResult> {
  try {
    const goal = await prisma.goal.create({ data: input });
    revalidatePath("/finances");
    return { ok: true, goal: { ...input, id: goal.id } };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function updateGoal(id: string, input: GoalInput): Promise<ActionResult> {
  try {
    await prisma.goal.update({ where: { id }, data: input });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath("/finances");
  return { ok: true };
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  try {
    await prisma.goal.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidatePath("/finances");
  return { ok: true };
}

/** Recreates a just-deleted goal with its original id, for the delete-undo toast. */
export async function restoreGoal(goal: GoalInput & { id: string }): Promise<ActionResult> {
  try {
    await prisma.goal.create({ data: goal });
  } catch {
    return { ok: false, error: "Couldn't undo — the goal may already be back." };
  }
  revalidatePath("/finances");
  return { ok: true };
}

export async function updateFinanceNorthStar(
  target: number | null,
  deadline: Date | null
): Promise<ActionResult> {
  try {
    await prisma.financeNorthStar.upsert({
      where: { id: FINANCE_NORTH_STAR_ID },
      create: { id: FINANCE_NORTH_STAR_ID, target, deadline },
      update: { target, deadline },
    });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath("/finances");
  return { ok: true };
}

export type TransactionInput = {
  date: Date;
  amount: number;
  direction: "IN" | "OUT";
  category: string;
  source: string | null;
};

export type TransactionResult =
  | { ok: true; item: TransactionInput & { id: string } }
  | { ok: false; error: string };

export async function createTransaction(input: TransactionInput): Promise<TransactionResult> {
  try {
    const transaction = await prisma.transaction.create({ data: input });
    revalidatePath("/finances");
    return { ok: true, item: { ...input, id: transaction.id } };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<ActionResult> {
  try {
    await prisma.transaction.update({ where: { id }, data: input });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath("/finances");
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  try {
    await prisma.transaction.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidatePath("/finances");
  return { ok: true };
}

/** Recreates a just-deleted transaction with its original id, for the delete-undo toast. */
export async function restoreTransaction(
  transaction: TransactionInput & { id: string }
): Promise<ActionResult> {
  try {
    await prisma.transaction.create({ data: transaction });
  } catch {
    return { ok: false, error: "Couldn't undo — the transaction may already be back." };
  }
  revalidatePath("/finances");
  return { ok: true };
}
