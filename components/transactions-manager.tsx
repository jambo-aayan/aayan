"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import {
  createTransaction,
  deleteTransaction,
  restoreTransaction,
  unlinkTransfer,
  updateTransaction,
  type TransactionInput,
} from "@/lib/finance/actions";
import { useUndoableCrudList, type ActionResult } from "@/lib/hooks/use-undoable-crud-list";
import { canReclassifyTransaction, isHeldForReview } from "@/lib/finance/logic";
import { DEFAULT_CATEGORIES } from "@/lib/finance/categories";
import { PrimaryButton } from "@/components/primary-button";
import { EmptyState } from "@/components/empty-state";
import { FlagReceivableForm } from "@/components/flag-receivable-form";
import { FlagGoalContributionForm, type GoalOption } from "@/components/flag-goal-contribution-form";
import { LinkTransferForm } from "@/components/link-transfer-form";
import { withRetry } from "@/lib/with-retry";
import styles from "./transactions-manager.module.css";

type Transaction = TransactionInput & {
  id: string;
  accountId: string | null;
  receivableId: string | null;
  goalContributionId: string | null;
  transferId: string | null;
  confidence: number | null;
};

export type AccountOption = { id: string; name: string };

const EMPTY_FORM: TransactionInput = {
  date: new Date(),
  amount: 0,
  direction: "OUT",
  category: "",
  source: null,
};

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function TransactionsManager({
  initialTransactions,
  goals,
  accounts,
}: {
  initialTransactions: Transaction[];
  goals: GoalOption[];
  accounts: AccountOption[];
}) {
  const { items: transactions, error, undo, add, update, remove, undoDelete } = useUndoableCrudList<
    Transaction,
    TransactionInput
  >(initialTransactions, {
    create: async (input) => {
      const result = await createTransaction(input);
      return result.ok
        ? {
            ok: true,
            item: { ...result.item, accountId: null, receivableId: null, goalContributionId: null, transferId: null, confidence: null },
          }
        : result;
    },
    update: updateTransaction,
    remove: deleteTransaction,
    restore: restoreTransaction,
  });
  const [form, setForm] = useState<TransactionInput>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [flaggingRowId, setFlaggingRowId] = useState<string | null>(null);
  const [flaggingMode, setFlaggingMode] = useState<"receivable" | "goal" | "transfer">("receivable");
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  // Overlays flagAsReceivable's/flagAsGoalContribution's/linkTransfer's
  // result onto the list without a redundant updateTransaction write —
  // each action already persists its id server-side, so the hook's
  // update() (which calls updateTransaction) would be both wasted and
  // semantically wrong here. transferOverrides holds BOTH linked
  // transaction ids at once, since linkTransfer claims two rows in one
  // call; null is a valid override value (an explicit "unlinked",
  // distinguishing it from "no override recorded yet").
  const [receivableOverrides, setReceivableOverrides] = useState<Record<string, string>>({});
  const [goalContributionOverrides, setGoalContributionOverrides] = useState<Record<string, string>>({});
  const [transferOverrides, setTransferOverrides] = useState<Record<string, string | null>>({});
  const accountNames = Object.fromEntries(accounts.map((a) => [a.id, a.name]));

  const sorted = [...transactions]
    .map((t) => ({
      ...t,
      receivableId: receivableOverrides[t.id] ?? t.receivableId,
      goalContributionId: goalContributionOverrides[t.id] ?? t.goalContributionId,
      transferId: t.id in transferOverrides ? transferOverrides[t.id] : t.transferId,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  async function handleAdd() {
    if (!form.category.trim()) {
      setAddError("Category is required.");
      return;
    }
    setAdding(true);
    setAddError(null);
    const ok = await add(form);
    setAdding(false);
    if (ok) setForm({ ...EMPTY_FORM, date: new Date() });
  }

  async function handleUnlinkTransfer(transferId: string) {
    setUnlinkingId(transferId);
    setUnlinkError(null);
    const result = await withRetry(() => unlinkTransfer(transferId));
    setUnlinkingId(null);
    if (!result.ok) {
      setUnlinkError(result.error);
      return;
    }
    setTransferOverrides((prev) => {
      const next = { ...prev };
      for (const t of sorted) {
        if (t.transferId === transferId) next[t.id] = null;
      }
      return next;
    });
  }

  return (
    <div>
      <ul className={styles.list}>
        {sorted.map((t) =>
          editingId === t.id ? (
            <TransactionEditRow
              key={t.id}
              transaction={t}
              onCancel={() => setEditingId(null)}
              onSaved={async (input) => {
                const result = await update(t.id, input, {
                  ...input,
                  id: t.id,
                  accountId: t.accountId,
                  receivableId: t.receivableId,
                  goalContributionId: t.goalContributionId,
                  transferId: t.transferId,
                  confidence: t.confidence,
                });
                if (result.ok) setEditingId(null);
                return result;
              }}
            />
          ) : flaggingRowId === t.id ? (
            <li key={t.id} className={styles.addForm}>
              {flaggingMode === "receivable" ? (
                <FlagReceivableForm
                  transactionId={t.id}
                  initialAmount={t.amount}
                  onCancel={() => setFlaggingRowId(null)}
                  onConfirmed={(receivableId) => {
                    setReceivableOverrides((prev) => ({ ...prev, [t.id]: receivableId }));
                    setFlaggingRowId(null);
                  }}
                />
              ) : flaggingMode === "goal" ? (
                <FlagGoalContributionForm
                  transactionId={t.id}
                  initialAmount={t.amount}
                  goals={goals}
                  onCancel={() => setFlaggingRowId(null)}
                  onConfirmed={(contributionId) => {
                    setGoalContributionOverrides((prev) => ({ ...prev, [t.id]: contributionId }));
                    setFlaggingRowId(null);
                  }}
                />
              ) : (
                <LinkTransferForm
                  transaction={t}
                  accountNames={accountNames}
                  candidates={sorted.filter((c) => c.id !== t.id && canReclassifyTransaction(c))}
                  onCancel={() => setFlaggingRowId(null)}
                  onConfirmed={(transferId) => {
                    // linkTransfer claims both sides server-side in one call, but
                    // this callback only knows about this row — the matched
                    // counterpart's badge shows up on its next natural refresh,
                    // matching how receivableOverrides/goalContributionOverrides
                    // already only update the row that was actively flagged.
                    setTransferOverrides((prev) => ({ ...prev, [t.id]: transferId }));
                    setFlaggingRowId(null);
                  }}
                />
              )}
            </li>
          ) : (
            <li key={t.id} className={styles.row}>
              <div>
                <div className={styles.category}>
                  {t.category}
                  {t.source && <span className={styles.source}> · {t.source}</span>}
                  {t.receivableId && <span className={styles.badge}>Receivable</span>}
                  {t.goalContributionId && <span className={styles.badge}>Goal contribution</span>}
                  {t.transferId && (
                    <span className={styles.badge}>
                      Transfer{" "}
                      <button
                        type="button"
                        className={styles.unlinkLink}
                        disabled={unlinkingId === t.transferId}
                        onClick={() => handleUnlinkTransfer(t.transferId!)}
                      >
                        {unlinkingId === t.transferId ? "Unlinking…" : "Unlink"}
                      </button>
                    </span>
                  )}
                  {isHeldForReview(t.confidence) && <span className={styles.badge}>Held for review</span>}
                </div>
                <div className={styles.date}>{formatDate(t.date)}</div>
              </div>
              <div className={styles.rowActions}>
                <span className={t.direction === "IN" ? styles.amtPos : styles.amtNeutral}>
                  {t.direction === "IN" ? "+" : "−"}
                  {formatGBP(t.amount)}
                </span>
                {t.direction === "OUT" && canReclassifyTransaction(t) && (
                  <>
                    <button
                      type="button"
                      className={styles.link}
                      onClick={() => {
                        setFlaggingMode("receivable");
                        setFlaggingRowId(t.id);
                      }}
                    >
                      Flag as receivable
                    </button>
                    {goals.length > 0 && (
                      <button
                        type="button"
                        className={styles.link}
                        onClick={() => {
                          setFlaggingMode("goal");
                          setFlaggingRowId(t.id);
                        }}
                      >
                        Flag as goal contribution
                      </button>
                    )}
                  </>
                )}
                {t.accountId !== null && canReclassifyTransaction(t) && (
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => {
                      setFlaggingMode("transfer");
                      setFlaggingRowId(t.id);
                    }}
                  >
                    Link as transfer
                  </button>
                )}
                <button type="button" className={styles.link} onClick={() => setEditingId(t.id)}>
                  Edit
                </button>
                <button type="button" className={styles.link} onClick={() => remove(t)}>
                  Delete
                </button>
              </div>
            </li>
          )
        )}
      </ul>
      {transactions.length === 0 && <EmptyState icon={Receipt} message="No transactions yet." />}
      {error && <p className={styles.error}>{error}</p>}
      {unlinkError && <p className={styles.error}>{unlinkError}</p>}

      <div className={styles.addForm}>
        <TransactionFields form={form} onChange={setForm} />
        <PrimaryButton onClick={handleAdd} disabled={adding}>
          {adding ? "Adding…" : "Add transaction"}
        </PrimaryButton>
      </div>
      {addError && <p className={styles.error}>{addError}</p>}

      {undo && (
        <div className={styles.toast}>
          <span>Deleted &ldquo;{undo.category}&rdquo; transaction.</span>
          <button type="button" className={styles.undoBtn} onClick={undoDelete}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

function TransactionFields({
  form,
  onChange,
}: {
  form: TransactionInput;
  onChange: (update: TransactionInput) => void;
}) {
  return (
    <>
      <input
        className={styles.input}
        type="date"
        aria-label="Date"
        value={toDateInputValue(form.date)}
        onChange={(e) => onChange({ ...form, date: new Date(`${e.target.value}T00:00:00.000Z`) })}
      />
      <select
        className={styles.input}
        aria-label="Direction"
        value={form.direction}
        onChange={(e) => onChange({ ...form, direction: e.target.value as TransactionInput["direction"] })}
      >
        <option value="OUT">Out</option>
        <option value="IN">In</option>
      </select>
      <input
        className={styles.input}
        type="number"
        step="0.01"
        placeholder="Amount"
        aria-label="Amount"
        value={form.amount}
        onChange={(e) => onChange({ ...form, amount: Number(e.target.value) })}
      />
      <input
        className={styles.input}
        list="finance-categories"
        placeholder="Category"
        aria-label="Category"
        value={form.category}
        onChange={(e) => onChange({ ...form, category: e.target.value })}
      />
      <datalist id="finance-categories">
        {DEFAULT_CATEGORIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <input
        className={styles.input}
        placeholder="Source (optional)"
        aria-label="Source or medium"
        value={form.source ?? ""}
        onChange={(e) => onChange({ ...form, source: e.target.value || null })}
      />
    </>
  );
}

function TransactionEditRow({
  transaction,
  onCancel,
  onSaved,
}: {
  transaction: Transaction;
  onCancel: () => void;
  onSaved: (input: TransactionInput) => Promise<ActionResult>;
}) {
  const [form, setForm] = useState<TransactionInput>(transaction);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await onSaved(form);
    setSaving(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <li className={styles.addForm}>
      <TransactionFields form={form} onChange={setForm} />
      <PrimaryButton onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </PrimaryButton>
      <button type="button" className={styles.link} onClick={onCancel}>
        Cancel
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </li>
  );
}
