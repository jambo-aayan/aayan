"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { BASELINE_ID } from "./baseline-id";
import { canLinkTransfer, canReclassifyTransaction, isHeldForReview, resolveStatementBalance, validateStatementUpload } from "./logic";
import { FINANCE_NORTH_STAR_ID } from "./north-star-id";
import { parseStatement, parseValuation } from "./statement-parser";
import { resolveCategoryId } from "./categories";
import { generateStatementName } from "./statement-naming";
import { partitionNewTransactions } from "./statement-dedup";

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
  | { ok: true; importedCount: number; skippedCount: number; heldCount: number }
  | { ok: false; error: string };

/** Uploads a bank statement (PDF/CSV) for a Transactional Account, keeps
 * the file in Vercel Blob (referenced from the new Statement, not
 * discarded), and parses it via Gemini 2.5 Flash into dated Transactions
 * linked to the account (#115, ADR-0010). The new Snapshot's balance
 * prefers the statement's own stated closing balance when it has one —
 * carrying the account's prior balance forward plus the net of the newly
 * parsed transactions is only a fallback for a statement that doesn't
 * state a balance at all (resolveStatementBalance, lib/finance/logic.ts).
 * A Statement row records the upload event itself; the new Snapshot and
 * every newly inserted Transaction link back to it (#148, ADR-0015).
 * Rows already present for this account — same (date, amount, direction),
 * ignoring the free-text description — are skipped rather than inserted
 * again, so a re-uploaded statement whose date range overlaps a previous
 * upload only adds genuinely new transactions (#149, ADR-0015). */
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

    // Gemini's per-transaction category is constrained to the user's real
    // taxonomy (#147/#148, ADR-0015) rather than free-generated — still
    // resolved defensively via resolveCategoryId below, since an LLM can
    // occasionally return something outside the given enum despite the
    // constraint.
    const categories = await prisma.category.findMany({ select: { id: true, name: true } });
    // At least one Category always exists — the migration seeds a default
    // set and merge (the only removal path) always keeps its target.
    const fallbackCategoryId = (categories.find((c) => c.name.toLowerCase() === "other") ?? categories[0]).id;

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseStatement(fileBuffer, file.type, categories.map((c) => c.name));
    // Distinguish "nothing to import" from a successful zero-transaction
    // parse — an empty Gemini response (blocked, safety-filtered, no
    // candidate) shouldn't silently write a same-balance Snapshot and
    // report a misleading "Imported 0 transactions" success.
    if (parsed.transactions.length === 0) {
      return { ok: false, error: "Couldn't find any transactions in that statement — try again." };
    }

    // Scoped to the statement's own date span (±1 day buffer) rather than
    // the account's whole history — dedup only ever needs to compare
    // against rows that could share a key, and this runs on every upload,
    // not just once (#149, ADR-0015).
    const parsedDates = parsed.transactions.map((t) => new Date(t.date).getTime());
    const dayMs = 24 * 60 * 60 * 1000;
    const existingTransactions = await prisma.transaction.findMany({
      where: {
        accountId,
        date: { gte: new Date(Math.min(...parsedDates) - dayMs), lte: new Date(Math.max(...parsedDates) + dayMs) },
      },
      select: { accountId: true, date: true, amount: true, direction: true },
    });
    const { toInsert, skipped } = partitionNewTransactions(
      accountId,
      parsed.transactions,
      existingTransactions.map((t) => ({ ...t, amount: t.amount.toNumber() }))
    );

    const previousBalance = account.snapshots[0]?.balance.toNumber() ?? 0;
    // Only toInsert, not every parsed row: previousBalance already
    // reflects whatever a prior overlapping upload already recorded, so
    // re-adding the net of rows that were already counted there would
    // double-count them (#149, ADR-0015).
    const newBalance = resolveStatementBalance(previousBalance, toInsert, parsed.closingBalance, account.type);
    const uploadedAt = new Date();
    const periodEnd = parsed.periodEnd ? new Date(parsed.periodEnd) : null;
    const statementName = generateStatementName({
      institutionName: parsed.institutionName,
      periodEnd,
      accountName: account.name,
      uploadedAt,
    });

    await prisma.$transaction(async (tx) => {
      const statement = await tx.statement.create({
        data: {
          accountId,
          name: statementName,
          institutionName: parsed.institutionName,
          periodStart: parsed.periodStart ? new Date(parsed.periodStart) : null,
          periodEnd,
          sourceFileUrl: blob.url,
          originalFilename: file.name || null,
          uploadedAt,
        },
      });
      await tx.snapshot.create({
        data: { accountId, date: uploadedAt, balance: newBalance, statementId: statement.id },
      });
      if (toInsert.length > 0) {
        await tx.transaction.createMany({
          data: toInsert.map((t) => ({
            date: new Date(t.date),
            amount: t.amount,
            direction: t.direction,
            categoryId: resolveCategoryId(categories, t.category, fallbackCategoryId),
            source: t.description,
            accountId,
            confidence: t.confidence,
            statementId: statement.id,
          })),
        });
      }
    });

    revalidatePath("/finances");
    return {
      ok: true,
      importedCount: toInsert.length,
      skippedCount: skipped.length,
      heldCount: toInsert.filter((t) => isHeldForReview(t.confidence)).length,
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

    const uploadedAt = new Date();
    await prisma.$transaction(async (tx) => {
      const statement = await tx.statement.create({
        data: {
          accountId,
          // parseValuation extracts only a balance + as-of date, no
          // institution/period — always the fallback naming path here.
          name: generateStatementName({ institutionName: null, periodEnd: null, accountName: account.name, uploadedAt }),
          sourceFileUrl: blob.url,
          originalFilename: file.name || null,
          uploadedAt,
        },
      });
      await tx.snapshot.create({
        data: {
          accountId,
          date: new Date(parsed.asOfDate),
          balance: parsed.balance,
          confidence: parsed.confidence,
          statementId: statement.id,
        },
      });
    });

    revalidatePath("/finances");
    return { ok: true, balance: parsed.balance, held: isHeldForReview(parsed.confidence) };
  } catch (error) {
    console.error("uploadValuationStatement failed", error);
    return { ok: false, error: "Couldn't upload or parse the statement — try again." };
  }
}

/** Overrides a Statement's generated name (#148, ADR-0015) — for when
 * extraction's name guess is wrong. Doesn't touch anything it produced
 * (Snapshot/Transaction rows keep their statementId regardless). */
export async function renameStatement(id: string, name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Enter a name." };
  try {
    await prisma.statement.update({ where: { id }, data: { name: trimmed } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath("/finances");
  revalidatePath("/finances/statements");
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

export type CategoryResult =
  | { ok: true; item: { id: string; name: string } }
  | { ok: false; error: string };

/** Category taxonomy's own name uniqueness is enforced case-insensitively
 * — `Category.name`'s DB unique index is case-sensitive, so without this
 * check a user could re-introduce the exact "Food"/"food" fragmentation
 * this taxonomy exists to eliminate, just through the real table instead
 * of free text (ADR-0015). Excludes `excludeId` so renaming a category to
 * its own current name (different casing included) isn't rejected. */
async function findCaseInsensitiveDuplicate(name: string, excludeId?: string) {
  return prisma.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
}

function revalidateCategoryPaths() {
  revalidatePath("/settings");
  revalidatePath("/finances");
  revalidatePath("/finances/uncategorised");
}

export async function createCategory(name: string): Promise<CategoryResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Enter a category name." };
  if (await findCaseInsensitiveDuplicate(trimmed)) return { ok: false, error: "That category already exists." };
  try {
    const category = await prisma.category.create({ data: { name: trimmed } });
    revalidateCategoryPaths();
    return { ok: true, item: { id: category.id, name: category.name } };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

/** Renames a Category — also renames any standing Budget on its old name,
 * since Budget.category is still a free-text string keyed to the
 * category's name (ADR-0015 left Budget's own schema unchanged). */
export async function renameCategory(id: string, name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Enter a category name." };
  if (await findCaseInsensitiveDuplicate(trimmed, id)) return { ok: false, error: "That category already exists." };
  try {
    const existing = await prisma.category.findUniqueOrThrow({ where: { id } });
    await prisma.$transaction([
      prisma.category.update({ where: { id }, data: { name: trimmed } }),
      prisma.budget.updateMany({ where: { category: existing.name }, data: { category: trimmed } }),
    ]);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateCategoryPaths();
  return { ok: true };
}

/** Merges one category into another: every Transaction on `fromId` is
 * reassigned to `intoId`, then `fromId` is deleted (ADR-0015) — the one
 * operation that actually cleans up an existing near-duplicate mess, not
 * just prevents new ones. Any standing Budget on the merged-away category
 * is dropped too, rather than guessing how to combine its limit with the
 * target's. */
export async function mergeCategory(fromId: string, intoId: string): Promise<ActionResult> {
  if (fromId === intoId) return { ok: false, error: "Choose two different categories to merge." };
  try {
    const from = await prisma.category.findUniqueOrThrow({ where: { id: fromId } });
    await prisma.$transaction([
      prisma.transaction.updateMany({ where: { categoryId: fromId }, data: { categoryId: intoId } }),
      prisma.budget.deleteMany({ where: { category: from.name } }),
      prisma.category.delete({ where: { id: fromId } }),
    ]);
  } catch {
    return { ok: false, error: "Couldn't merge — try again." };
  }
  revalidateCategoryPaths();
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
    if (transactionId !== null && !(await claimTransaction(prisma, transactionId, { goalContributionId: contribution.id }))) {
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
    if (!(await claimTransaction(prisma, transactionId, { goalContributionId: contribution.id }))) {
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
  categoryId: string;
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

export type DeletedTransactionRecord = TransactionInput & {
  id: string;
  accountId: string | null;
  receivableId: string | null;
  goalContributionId: string | null;
  transferId: string | null;
  confidence: number | null;
  statementId: string | null;
};

export type DeletedSnapshotRecord = {
  id: string;
  accountId: string;
  date: Date;
  balance: number;
  confidence: number | null;
  statementId: string | null;
};

export type BulkDeleteTransactionsResult =
  | { ok: true; deleted: DeletedTransactionRecord[]; deletedSnapshots: DeletedSnapshotRecord[] }
  | { ok: false; error: string };

/** Deletes several Transactions in one action — the transaction list's
 * multi-select "Delete selected" (#151, ADR-0015), including the
 * per-statement "select all in this statement" shortcut, which routes
 * through this same action rather than a separate deletion path. If a
 * Statement's transactions all end up deleted (whether via that shortcut
 * or a hand-picked selection that happens to cover the whole statement),
 * its linked Snapshot(s) are deleted in the same action too — a
 * half-deleted statement (transactions gone, a stale balance snapshot
 * left behind) is a more confusing state than either extreme, and
 * removing a statement's transactions is almost always because they
 * were wrong or duplicated, which puts the balance they recorded in the
 * same doubt. Returns the deleted rows (transactions and any cascaded
 * snapshots) so the caller can offer a real undo. */
// Under the default READ COMMITTED isolation, "delete these rows, then
// count what's left for their statement" is a genuine check-then-act race
// between two concurrent bulk deletes against the same Statement (e.g.
// two browser tabs): each only sees the other's delete once it commits,
// so both can independently count "1 remaining" and skip the snapshot
// cascade, even though the statement ends up with zero transactions
// once both commit. Serializable isolation makes Postgres detect that
// conflict and abort one side with a retryable error (P2034) instead of
// silently letting it through — retried here since the client's own
// withRetry only handles network/ok:false failures, not a thrown
// serialization error from inside the action itself.
const DELETE_TRANSACTIONS_MAX_ATTEMPTS = 3;

export async function deleteTransactions(ids: string[]): Promise<BulkDeleteTransactionsResult> {
  if (ids.length === 0) return { ok: true, deleted: [], deletedSnapshots: [] };
  for (let attempt = 1; attempt <= DELETE_TRANSACTIONS_MAX_ATTEMPTS; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const transactions = await tx.transaction.findMany({ where: { id: { in: ids } } });
          const statementIds = [...new Set(transactions.map((t) => t.statementId).filter((id): id is string => id !== null))];

          await tx.transaction.deleteMany({ where: { id: { in: ids } } });

          const deletedSnapshots: Awaited<ReturnType<typeof tx.snapshot.findMany>> = [];
          for (const statementId of statementIds) {
            const remaining = await tx.transaction.count({ where: { statementId } });
            if (remaining === 0) {
              const snapshots = await tx.snapshot.findMany({ where: { statementId } });
              if (snapshots.length > 0) {
                await tx.snapshot.deleteMany({ where: { statementId } });
                deletedSnapshots.push(...snapshots);
              }
            }
          }
          return { transactions, deletedSnapshots };
        },
        { isolationLevel: "Serializable" }
      );

      revalidatePath("/finances");
      revalidatePath("/finances/transactions");
      revalidatePath("/finances/statements");
      return {
        ok: true,
        deleted: result.transactions.map((t) => ({ ...t, amount: t.amount.toNumber() })),
        deletedSnapshots: result.deletedSnapshots.map((s) => ({ ...s, balance: s.balance.toNumber() })),
      };
    } catch (error) {
      const isSerializationConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (isSerializationConflict && attempt < DELETE_TRANSACTIONS_MAX_ATTEMPTS) continue;
      return { ok: false, error: "Couldn't delete — try again." };
    }
  }
  return { ok: false, error: "Couldn't delete — try again." };
}

/** Undoes a bulk delete — recreates every deleted Transaction and any
 * cascaded Snapshot with their original ids, for the "Delete selected"
 * undo toast (#151, ADR-0015). Snapshots first, since Transaction has no
 * dependency on them but the reverse ordering would briefly leave a
 * Transaction referencing a not-yet-recreated Snapshot mid-restore. */
export async function restoreDeletedTransactions(
  transactions: DeletedTransactionRecord[],
  snapshots: DeletedSnapshotRecord[]
): Promise<ActionResult> {
  try {
    await prisma.$transaction(async (tx) => {
      if (snapshots.length > 0) await tx.snapshot.createMany({ data: snapshots });
      if (transactions.length > 0) await tx.transaction.createMany({ data: transactions });
    });
  } catch {
    return { ok: false, error: "Couldn't undo — try again." };
  }
  revalidatePath("/finances");
  revalidatePath("/finances/transactions");
  revalidatePath("/finances/statements");
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
 * UPDATE can match receivableId, goalContributionId, AND transferId all
 * still null, so the loser's count is 0. Shared by the receivable, goal-
 * contribution, and transfer flows (#114/#120, ADR-0010; #138, ADR-0013)
 * since a transaction can only ever carry one of the three. Takes the
 * Prisma client as a parameter (rather than closing over the module-level
 * `prisma`) so linkTransfer can run both of its claims inside one
 * interactive transaction — a plain client for the single-claim callers
 * (flagAsReceivable, settleReceivable), the transaction's own `tx` client
 * when a caller needs its claim to roll back atomically with other
 * writes. */
async function claimTransaction(
  client: Pick<typeof prisma, "transaction">,
  transactionId: string,
  data: { receivableId: string } | { goalContributionId: string } | { transferId: string }
): Promise<boolean> {
  const claimed = await client.transaction.updateMany({
    where: { id: transactionId, receivableId: null, goalContributionId: null, transferId: null },
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
    if (!(await claimTransaction(prisma, transactionId, { receivableId: receivable.id }))) {
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
      if (!(await claimTransaction(prisma, repaymentTransactionId, { receivableId }))) {
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

export type TransferResult =
  | { ok: true; transferId: string }
  | { ok: false; error: string };

const INVALID_TRANSFER_ERROR = "Transfers need two transactions on different accounts, moving in opposite directions.";

/** Links two transactions as a Transfer — the same money moving between
 * two of the user's own accounts, e.g. paying a credit card bill from a
 * bank account (#138, ADR-0013). No amount-equality check, mirroring
 * settleReceivable's optional repayment link. Refuses a transaction
 * already linked to any reclassification, and refuses a same-account or
 * same-direction pairing (canLinkTransfer). The Transfer create and both
 * claims run inside one interactive transaction — thrown on either claim
 * losing a race, so Postgres rolls back the whole thing atomically rather
 * than leaving a one-sided claim or an orphaned Transfer row for a crash
 * between separate compensating writes to land in the middle of. */
export async function linkTransfer(
  transactionIdA: string,
  transactionIdB: string,
  note: string | null
): Promise<TransferResult> {
  try {
    if (transactionIdA === transactionIdB) return { ok: false, error: INVALID_TRANSFER_ERROR };
    const [a, b] = await Promise.all([
      prisma.transaction.findUnique({ where: { id: transactionIdA } }),
      prisma.transaction.findUnique({ where: { id: transactionIdB } }),
    ]);
    if (!a || !b) return { ok: false, error: SAVE_ERROR };
    if (!canReclassifyTransaction(a) || !canReclassifyTransaction(b)) {
      return { ok: false, error: ALREADY_LINKED_ERROR };
    }
    if (!canLinkTransfer(a, b)) {
      return { ok: false, error: INVALID_TRANSFER_ERROR };
    }

    const transferId = await prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.create({ data: { note } });
      if (!(await claimTransaction(tx, transactionIdA, { transferId: transfer.id }))) {
        throw new Error(ALREADY_LINKED_ERROR);
      }
      if (!(await claimTransaction(tx, transactionIdB, { transferId: transfer.id }))) {
        throw new Error(ALREADY_LINKED_ERROR);
      }
      return transfer.id;
    });

    revalidatePath("/finances");
    return { ok: true, transferId };
  } catch (error) {
    const message = error instanceof Error ? error.message : SAVE_ERROR;
    return { ok: false, error: message === ALREADY_LINKED_ERROR ? ALREADY_LINKED_ERROR : SAVE_ERROR };
  }
}

/** Undoes a Transfer link — clears transferId on both linked transactions
 * (so they count as real spend/income again) and deletes the Transfer row
 * (#138, ADR-0013). Unlike Receivable/GoalContribution, Transfers support
 * unlinking from day one: a suggestion-driven UI makes a wrong link more
 * likely than the fully-manual receivable flow ever was. */
export async function unlinkTransfer(transferId: string): Promise<ActionResult> {
  try {
    await prisma.$transaction([
      prisma.transaction.updateMany({ where: { transferId }, data: { transferId: null } }),
      prisma.transfer.delete({ where: { id: transferId } }),
    ]);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath("/finances");
  return { ok: true };
}

/** Wipes all transaction data and everything that hangs off it, so the
 * user can re-upload statements onto the fixed Category/Statement/dedup
 * foundation instead of data affected by the bugs those fixes exist for
 * (#154, ADR-0015). Deletes Transaction, Snapshot, Transfer, Receivable,
 * GoalContribution, and Statement, in that order — every FK among these
 * six is nullable with ON DELETE SET NULL (see prisma/schema.prisma), so
 * no ordering is actually load-bearing against today's schema; kept in
 * this order anyway since it's the natural "leaves first" reading and
 * matches the spec's own listing, not because reordering it would break.
 * Account, Goal, Habit, and Category are all left untouched — this
 * clears the ledger, not the structure it's re-uploaded into. Requires
 * the caller to have already confirmed via
 * RESET_FINANCE_DATA_CONFIRMATION; this function itself doesn't re-check
 * the phrase, since that's a UI-level gate, not a data-integrity one. */
export async function resetFinanceData(): Promise<ActionResult> {
  try {
    await prisma.$transaction([
      prisma.transaction.deleteMany({}),
      prisma.snapshot.deleteMany({}),
      prisma.transfer.deleteMany({}),
      prisma.receivable.deleteMany({}),
      prisma.goalContribution.deleteMany({}),
      prisma.statement.deleteMany({}),
    ]);
  } catch {
    return { ok: false, error: "Couldn't reset — try again." };
  }
  revalidatePath("/finances");
  revalidatePath("/finances/transactions");
  revalidatePath("/finances/statements");
  revalidatePath("/finances/uncategorised");
  // Both read finance transaction data too (Insights' surplus-rate KPI
  // and net-worth trajectory; Nudges' eligibility evaluation) — stale
  // otherwise until each page's own next natural revalidation.
  revalidatePath("/insights");
  revalidatePath("/nudges");
  return { ok: true };
}
