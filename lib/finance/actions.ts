"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { BASELINE_ID } from "./baseline-id";
import { canFlagAsReceivable } from "./logic";
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

export type ReceivableResult =
  | { ok: true; receivableId: string }
  | { ok: false; error: string };

const ALREADY_LINKED_ERROR = "Already linked to a receivable.";

/** Atomically claims a transaction for a reclassification link — the
 * WHERE clause (not just the pure canFlagAsReceivable check, which only
 * catches the common case) is what actually prevents two concurrent
 * flags/settles on the same transaction from both succeeding: only one
 * UPDATE can match receivableId: null, so the loser's count is 0. */
async function claimTransactionForReceivable(transactionId: string, receivableId: string): Promise<boolean> {
  const claimed = await prisma.transaction.updateMany({
    where: { id: transactionId, receivableId: null },
    data: { receivableId },
  });
  return claimed.count === 1;
}

/** "This became a receivable" — reclassifies an outgoing transaction as
 * money owed to the user rather than real spend, creating a new open
 * Receivable linked to it, its amount pre-filled from the transaction but
 * editable (#114, ADR-0010). Refuses a transaction already linked to a
 * reclassification. */
export async function flagAsReceivable(
  transactionId: string,
  amount: number,
  note: string | null
): Promise<ReceivableResult> {
  try {
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) return { ok: false, error: SAVE_ERROR };
    if (!canFlagAsReceivable({ receivableId: transaction.receivableId })) {
      return { ok: false, error: ALREADY_LINKED_ERROR };
    }
    const receivable = await prisma.receivable.create({ data: { amount, note } });
    if (!(await claimTransactionForReceivable(transactionId, receivable.id))) {
      await prisma.receivable.delete({ where: { id: receivable.id } });
      return { ok: false, error: ALREADY_LINKED_ERROR };
    }
    revalidatePath("/finances");
    return { ok: true, receivableId: receivable.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

/** Marks a Receivable settled — no net-worth change, since the money was
 * already excluded from spend totals when it was flagged (ADR-0010).
 * Settling is independent of finding a matching incoming transaction, but
 * one can optionally be linked as the repayment record — that linked
 * transaction is excluded from spend totals the same way the original
 * flagged transaction is, so it's not double-counted as new income. */
export async function settleReceivable(
  receivableId: string,
  repaymentTransactionId: string | null
): Promise<ActionResult> {
  try {
    if (repaymentTransactionId !== null) {
      const repayment = await prisma.transaction.findUnique({ where: { id: repaymentTransactionId } });
      if (!repayment) return { ok: false, error: SAVE_ERROR };
      if (!canFlagAsReceivable({ receivableId: repayment.receivableId })) {
        return { ok: false, error: ALREADY_LINKED_ERROR };
      }
      if (!(await claimTransactionForReceivable(repaymentTransactionId, receivableId))) {
        return { ok: false, error: ALREADY_LINKED_ERROR };
      }
    }
    await prisma.receivable.update({
      where: { id: receivableId },
      data: { status: "SETTLED", settledAt: new Date() },
    });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath("/finances");
  return { ok: true };
}
