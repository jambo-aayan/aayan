"use client";

import { useState } from "react";
import {
  createTransaction,
  deleteTransaction,
  restoreTransaction,
  updateTransaction,
  type TransactionInput,
} from "@/lib/finance/actions";
import { useUndoableCrudList } from "@/lib/hooks/use-undoable-crud-list";
import { DEFAULT_CATEGORIES } from "@/lib/finance/categories";
import styles from "./transactions-manager.module.css";

type Transaction = TransactionInput & { id: string };

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

export function TransactionsManager({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const { items: transactions, error, undo, add, update, remove, undoDelete } = useUndoableCrudList<
    Transaction,
    TransactionInput
  >(initialTransactions, {
    create: createTransaction,
    update: updateTransaction,
    remove: deleteTransaction,
    restore: restoreTransaction,
  });
  const [form, setForm] = useState<TransactionInput>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime());

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
                const ok = await update(t.id, input, { ...input, id: t.id });
                if (ok) setEditingId(null);
                return ok;
              }}
            />
          ) : (
            <li key={t.id} className={styles.row}>
              <div>
                <div className={styles.category}>
                  {t.category}
                  {t.source && <span className={styles.source}> · {t.source}</span>}
                </div>
                <div className={styles.date}>{formatDate(t.date)}</div>
              </div>
              <div className={styles.rowActions}>
                <span className={t.direction === "IN" ? styles.amtPos : styles.amtNeutral}>
                  {t.direction === "IN" ? "+" : "−"}
                  {formatGBP(t.amount)}
                </span>
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
        {transactions.length === 0 && <li className={styles.empty}>No transactions yet.</li>}
      </ul>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.addForm}>
        <TransactionFields form={form} onChange={setForm} />
        <button type="button" className={styles.add} onClick={handleAdd} disabled={adding}>
          {adding ? "Adding…" : "Add transaction"}
        </button>
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
  onSaved: (input: TransactionInput) => Promise<boolean>;
}) {
  const [form, setForm] = useState<TransactionInput>(transaction);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSaved(form);
    setSaving(false);
  }

  return (
    <li className={styles.addForm}>
      <TransactionFields form={form} onChange={setForm} />
      <button type="button" className={styles.add} onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" className={styles.link} onClick={onCancel}>
        Cancel
      </button>
    </li>
  );
}
