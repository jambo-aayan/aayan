"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { BASELINE_ID } from "./baseline-id";
import { canReclassifyTransaction, isHeldForReview, resolveStatementBalance, validateStatementUpload } from "./logic";
import { FINANCE_NORTH_STAR_ID } from "./north-star-id";
import { parseStatement, parseValuation } from "./statement-parser";

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

export type UploadStatementResult =
  | { ok: true; importedCount: number; heldCount: number }
  | { ok: false; error: string };

/** Uploads a bank statement (PDF/CSV) for a Transactional Account, keeps
 * the file in Vercel Blob (referenced from the new Snapshot, not
 * discarded), and parses it via Gemini 2.5 Flash into dated Transactions
 * linked to the account (#115, ADR-0010). The new Snapshot's balance
 * prefers the statement's own stated closing balance when it has one —
 * carrying the account's prior balance forward plus the net of the newly
 * parsed transactions is only a fallback for a statement that doesn't
 * state a balance at all (resolveStatementBalance, lib/finance/logic.ts). */
export async function uploadStatement(accountId: string, file: File): Promise<UploadStatementResult> {
  const validation = validateStatementUpload(file.type, file.size);
  if (!validation.ok) return validation;

  try {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { snapshots: { orderBy: { date: "desc" }, take: 1 } },
    });
    if (!account) return { ok: false, error: SAVE_ERROR };
    if (account.kind !== "TRANSACTIONAL") {
      return { ok: false, error: "Statement upload is only for Transactional accounts." };
    }

    const blob = await put(`statements/${accountId}-${Date.now()}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { transactions, closingBalance } = await parseStatement(fileBuffer, file.type);
    // Distinguish "nothing to import" from a successful zero-transaction
    // parse — an empty Gemini response (blocked, safety-filtered, no
    // candidate) shouldn't silently write a same-balance Snapshot and
    // report a misleading "Imported 0 transactions" success.
    if (transactions.length === 0) {
      return { ok: false, error: "Couldn't find any transactions in that statement — try again." };
    }

    const previousBalance = account.snapshots[0]?.balance.toNumber() ?? 0;
    const newBalance = resolveStatementBalance(previousBalance, transactions, closingBalance);

    await prisma.$transaction([
      prisma.snapshot.create({
        data: { accountId, date: new Date(), balance: newBalance, sourceFileUrl: blob.url },
      }),
      prisma.transaction.createMany({
        data: transactions.map((t) => ({
          date: new Date(t.date),
          amount: t.amount,
          direction: t.direction,
          category: t.category,
          source: t.description,
          accountId,
          confidence: t.confidence,
        })),
      }),
    ]);

    revalidatePath("/finances");
    return {
      ok: true,
      importedCount: transactions.length,
      heldCount: transactions.filter((t) => isHeldForReview(t.confidence)).length,
    };
  } catch (error) {
    // Logged (not just swallowed) so a real failure — a missing Blob token,
    // a Gemini/API error, a DB write error — shows up in Vercel's runtime
    // logs instead of leaving every cause indistinguishable behind the
    // same generic message shown to the user.
    console.error("uploadStatement failed", error);
    return { ok: false, error: "Couldn't upload or parse the statement — try again." };
  }
}

export type UploadValuationStatementResult =
  | { ok: true; balance: number; held: boolean }
  | { ok: false; error: string };

/** Uploads a bank/pension statement (PDF/CSV) for a Valuation Account —
 * the same upload flow as #115, but parsed for a single balance figure
 * and as-of date rather than a transaction list; no Transaction rows are
 * created (#116, ADR-0010). */
export async function uploadValuationStatement(
  accountId: string,
  file: File
): Promise<UploadValuationStatementResult> {
  const validation = validateStatementUpload(file.type, file.size);
  if (!validation.ok) return validation;

  try {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return { ok: false, error: SAVE_ERROR };
    if (account.kind !== "VALUATION") {
      return { ok: false, error: "This upload is only for Valuation accounts." };
    }

    const blob = await put(`statements/${accountId}-${Date.now()}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseValuation(fileBuffer, file.type);
    if (!parsed) {
      return { ok: false, error: "Couldn't find a balance in that statement — try again." };
    }

    await prisma.snapshot.create({
      data: {
        accountId,
        date: new Date(parsed.asOfDate),
        balance: parsed.balance,
        sourceFileUrl: blob.url,
        confidence: parsed.confidence,
      },
    });

    revalidatePath("/finances");
    return { ok: true, balance: parsed.balance, held: isHeldForReview(parsed.confidence) };
  } catch (error) {
    console.error("uploadValuationStatement failed", error);
    return { ok: false, error: "Couldn't upload or parse the statement — try again." };
  }
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

/** Sets (or replaces) the standing monthly spending limit for a category
 * — one row per category, upserted by its unique category value rather
 * than an id the caller would need to already know (#123, ADR-0010). */
export async function setBudget(category: string, limit: number): Promise<ActionResult> {
  try {
    await prisma.budget.upsert({
      where: { category },
      create: { category, limit },
      update: { limit },
    });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath("/finances");
  return { ok: true };
}

export async function deleteBudget(category: string): Promise<ActionResult> {
  try {
    await prisma.budget.delete({ where: { category } });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidatePath("/finances");
  return { ok: true };
}

export type GoalInput = {
  name: string;
  target: number;
  /** The goal's starting saved amount — seeds an initial GoalContribution
   * on create/restore, never stored on the Goal row itself (#120,
   * ADR-0010). Editing an existing goal's saved total happens via
   * logGoalContribution, a separate dated log entry, not by overwriting
   * this field in place — same shape as AccountInput.value/Snapshot. */
  saved: number;
  monthlyContribution: number;
  vehicle: "EMERGENCY_FUND" | "LISA" | "PENSION" | "STOCKS_ISA" | "CASH_ISA" | "GENERIC";
  priority: number;
};

export type GoalResult =
  | { ok: true; goal: GoalInput & { id: string } }
  | { ok: false; error: string };

export async function createGoal(input: GoalInput): Promise<GoalResult> {
  const { saved, ...goalFields } = input;
  try {
    const goal = await prisma.goal.create({
      data: { ...goalFields, contributions: { create: { date: new Date(), amount: saved } } },
    });
    revalidatePath("/finances");
    return { ok: true, goal: { ...input, id: goal.id } };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function updateGoal(id: string, input: GoalInput): Promise<ActionResult> {
  const { name, target, monthlyContribution, vehicle, priority } = input;
  try {
    await prisma.goal.update({ where: { id }, data: { name, target, monthlyContribution, vehicle, priority } });
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

/** Recreates a just-deleted goal with its original id, for the
 * delete-undo toast — seeds one fresh GoalContribution at the saved total
 * it held at delete time (its earlier contribution log is not recovered,
 * matching every other delete-undo action in this app). */
export async function restoreGoal(goal: GoalInput & { id: string }): Promise<ActionResult> {
  const { saved, id, ...goalFields } = goal;
  try {
    await prisma.goal.create({
      data: { id, ...goalFields, contributions: { create: { date: new Date(), amount: saved } } },
    });
  } catch {
    return { ok: false, error: "Couldn't undo — the goal may already be back." };
  }
  revalidatePath("/finances");
  return { ok: true };
}

export type GoalContributionResult =
  | { ok: true; contributionId: string }
  | { ok: false; error: string };

/** Logs a new dated GoalContribution — a Goal's saved total comes from
 * its own history, so contributing adds a row rather than overwriting one
 * (#120, ADR-0010), same shape as addSnapshot. Optionally links an
 * existing transaction as the funding record (claimed atomically, same
 * mechanism as settleReceivable's optional repayment link) — standalone
 * contributions (no linked transaction) are equally valid. */
export async function logGoalContribution(
  goalId: string,
  date: Date,
  amount: number,
  note: string | null,
  transactionId: string | null
): Promise<GoalContributionResult> {
  try {
    if (transactionId !== null) {
      const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
      if (!transaction) return { ok: false, error: SAVE_ERROR };
      if (!canReclassifyTransaction(transaction)) return { ok: false, error: ALREADY_LINKED_ERROR };
    }

    const contribution = await prisma.goalContribution.create({ data: { goalId, date, amount, note } });
    if (transactionId !== null && !(await claimTransaction(transactionId, { goalContributionId: contribution.id }))) {
      await prisma.goalContribution.delete({ where: { id: contribution.id } });
      return { ok: false, error: ALREADY_LINKED_ERROR };
    }

    revalidatePath("/finances");
    return { ok: true, contributionId: contribution.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

/** "This went toward Goal X" — reclassifies an outgoing transaction as a
 * goal contribution rather than real spend, mirroring flagAsReceivable
 * exactly (#120, ADR-0010). Refuses a transaction already linked to a
 * reclassification (a receivable or another goal contribution). */
export async function flagAsGoalContribution(
  transactionId: string,
  goalId: string,
  amount: number,
  note: string | null
): Promise<GoalContributionResult> {
  try {
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) return { ok: false, error: SAVE_ERROR };
    if (!canReclassifyTransaction(transaction)) return { ok: false, error: ALREADY_LINKED_ERROR };

    const contribution = await prisma.goalContribution.create({
      data: { goalId, date: transaction.date, amount, note },
    });
    if (!(await claimTransaction(transactionId, { goalContributionId: contribution.id }))) {
      await prisma.goalContribution.delete({ where: { id: contribution.id } });
      return { ok: false, error: ALREADY_LINKED_ERROR };
    }

    revalidatePath("/finances");
    revalidatePath("/finances/uncategorised");
    return { ok: true, contributionId: contribution.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
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

/** Corrects a held-for-review transaction's fields and clears its
 * confidence, removing it from the Uncategorised queue — a corrected
 * transaction is no longer "uncategorised" (#117, ADR-0010). Distinct
 * from updateTransaction, which never touches confidence, so an edit
 * from the regular ledger view doesn't accidentally clear a still-unverified
 * transaction's held status. */
export async function resolveHeldTransaction(id: string, input: TransactionInput): Promise<ActionResult> {
  try {
    await prisma.transaction.update({ where: { id }, data: { ...input, confidence: null } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath("/finances");
  revalidatePath("/finances/uncategorised");
  return { ok: true };
}

export type ReceivableResult =
  | { ok: true; receivableId: string }
  | { ok: false; error: string };

const ALREADY_LINKED_ERROR = "Already linked to a reclassification.";

/** Atomically claims a transaction for a reclassification link — the
 * WHERE clause (not just the pure canReclassifyTransaction check, which
 * only catches the common case) is what actually prevents two concurrent
 * flags/settles on the same transaction from both succeeding: only one
 * UPDATE can match both receivableId AND goalContributionId still null,
 * so the loser's count is 0. Shared by the receivable and goal-
 * contribution flows (#114/#120, ADR-0010) since a transaction can only
 * ever carry one or the other. */
async function claimTransaction(
  transactionId: string,
  data: { receivableId: string } | { goalContributionId: string }
): Promise<boolean> {
  const claimed = await prisma.transaction.updateMany({
    where: { id: transactionId, receivableId: null, goalContributionId: null },
    data,
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
    if (!canReclassifyTransaction(transaction)) {
      return { ok: false, error: ALREADY_LINKED_ERROR };
    }
    const receivable = await prisma.receivable.create({ data: { amount, note } });
    if (!(await claimTransaction(transactionId, { receivableId: receivable.id }))) {
      await prisma.receivable.delete({ where: { id: receivable.id } });
      return { ok: false, error: ALREADY_LINKED_ERROR };
    }
    revalidatePath("/finances");
    revalidatePath("/finances/uncategorised");
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
      if (!canReclassifyTransaction(repayment)) {
        return { ok: false, error: ALREADY_LINKED_ERROR };
      }
      if (!(await claimTransaction(repaymentTransactionId, { receivableId }))) {
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
