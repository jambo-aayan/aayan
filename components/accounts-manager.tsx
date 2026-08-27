"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import {
  createAccount,
  deleteAccount,
  restoreAccount,
  updateAccount,
  addSnapshot,
  uploadStatement,
  uploadValuationStatement,
  type AccountInput,
} from "@/lib/finance/actions";
import { useUndoableCrudList, type ActionResult } from "@/lib/hooks/use-undoable-crud-list";
import { isHeldForReview, validateStatementUpload } from "@/lib/finance/logic";
import { PrimaryButton } from "@/components/primary-button";
import { EmptyState } from "@/components/empty-state";
import styles from "./accounts-manager.module.css";

type Account = AccountInput & { id: string; valueConfidence: number | null };

const EMPTY_FORM: AccountInput = {
  name: "",
  type: "ASSET",
  kind: "VALUATION",
  cls: null,
  value: 0,
  accessible: false,
  excluded: false,
  manualOnly: false,
  active: true,
};

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

export function AccountsManager({ initialAccounts }: { initialAccounts: Account[] }) {
  const { items, error, undo, add, update, remove, undoDelete } = useUndoableCrudList<Account, AccountInput>(
    initialAccounts,
    {
      create: async (input) => {
        const result = await createAccount(input);
        return result.ok ? { ok: true, item: { ...result.item, valueConfidence: null } } : result;
      },
      update: updateAccount,
      remove: deleteAccount,
      restore: restoreAccount,
    }
  );
  const [form, setForm] = useState<AccountInput>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const visible = items.filter((a) => a.active);
  const hidden = items.filter((a) => !a.active);

  async function handleAdd() {
    if (!form.name.trim()) {
      setAddError("Name is required.");
      return;
    }
    setAdding(true);
    setAddError(null);
    const ok = await add(form);
    setAdding(false);
    if (ok) setForm(EMPTY_FORM);
  }

  function renderRow(account: Account) {
    return editingId === account.id ? (
      <AccountEditRow
        key={account.id}
        account={account}
        onCancel={() => setEditingId(null)}
        onSaved={async (input) => {
          const result = await update(account.id, input, {
            ...input,
            id: account.id,
            valueConfidence: account.valueConfidence,
          });
          if (result.ok) setEditingId(null);
          return result;
        }}
      />
    ) : (
      <li key={account.id} className={styles.row}>
        <div>
          <div className={styles.name}>{account.name}</div>
          <div className={styles.meta}>
            {account.type === "ASSET" ? "Asset" : "Liability"} · {account.kind === "TRANSACTIONAL" ? "Transactional" : "Valuation"}
            {account.cls && ` · ${account.cls}`}
            {account.accessible && " · accessible"}
            {account.excluded && " · excluded"}
            {account.manualOnly && " · manual only"}
            {!account.active && " · hidden"}
          </div>
        </div>
        <div className={styles.rowActions}>
          <span className={styles.value}>{formatGBP(account.value)}</span>
          {isHeldForReview(account.valueConfidence) && <span className={styles.badge}>Held for review</span>}
          <AddSnapshotControl accountId={account.id} />
          <UploadStatementControl accountId={account.id} kind={account.kind} />
          <button type="button" className={styles.link} onClick={() => setEditingId(account.id)}>
            Edit
          </button>
          <button type="button" className={styles.link} onClick={() => remove(account)}>
            Delete
          </button>
        </div>
      </li>
    );
  }

  return (
    <div>
      <ul className={styles.list}>{visible.map(renderRow)}</ul>
      {items.length === 0 && <EmptyState icon={Wallet} message="No accounts yet." />}
      {hidden.length > 0 && <ul className={styles.list}>{hidden.map(renderRow)}</ul>}
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.addForm}>
        <AccountFields form={form} onChange={setForm} />
        <PrimaryButton onClick={handleAdd} disabled={adding}>
          {adding ? "Adding…" : "Add account"}
        </PrimaryButton>
      </div>
      {addError && <p className={styles.error}>{addError}</p>}

      {undo && (
        <div className={styles.toast}>
          <span>Deleted &ldquo;{undo.name}&rdquo;.</span>
          <button type="button" className={styles.undoBtn} onClick={undoDelete}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

function AccountFields({
  form,
  onChange,
  showValue = true,
}: {
  form: AccountInput;
  onChange: (update: AccountInput) => void;
  /** The "Starting value" field only applies at creation — an existing
   * account's value comes from its Snapshot history (via "Update value"
   * below), so editing the account's own fields never shows it. */
  showValue?: boolean;
}) {
  return (
    <>
      <input
        className={styles.input}
        placeholder="Name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
      />
      <select
        className={styles.input}
        value={form.type}
        onChange={(e) => onChange({ ...form, type: e.target.value as AccountInput["type"] })}
      >
        <option value="ASSET">Asset</option>
        <option value="LIABILITY">Liability</option>
      </select>
      <select
        className={styles.input}
        value={form.kind}
        onChange={(e) => onChange({ ...form, kind: e.target.value as AccountInput["kind"] })}
      >
        <option value="VALUATION">Valuation (balance only)</option>
        <option value="TRANSACTIONAL">Transactional (itemised)</option>
      </select>
      <input
        className={styles.input}
        placeholder="Class (e.g. Cash, Property)"
        value={form.cls ?? ""}
        onChange={(e) => onChange({ ...form, cls: e.target.value.trim() || null })}
      />
      {showValue && (
        <input
          className={styles.input}
          type="number"
          step="0.01"
          placeholder="Starting value"
          value={form.value}
          onChange={(e) => onChange({ ...form, value: Number(e.target.value) })}
        />
      )}
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={form.accessible}
          onChange={(e) => onChange({ ...form, accessible: e.target.checked })}
        />
        Accessible
      </label>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={form.excluded}
          onChange={(e) => onChange({ ...form, excluded: e.target.checked })}
        />
        Excluded
      </label>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={form.manualOnly}
          onChange={(e) => onChange({ ...form, manualOnly: e.target.checked })}
        />
        Manual only
      </label>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => onChange({ ...form, active: e.target.checked })}
        />
        Active
      </label>
    </>
  );
}

function AccountEditRow({
  account,
  onCancel,
  onSaved,
}: {
  account: Account;
  onCancel: () => void;
  onSaved: (input: AccountInput) => Promise<ActionResult>;
}) {
  const [form, setForm] = useState<AccountInput>(account);
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
      <AccountFields form={form} onChange={setForm} showValue={false} />
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

/** An account's value comes from its own dated Snapshot history, not a
 * field on the account itself — this logs a new one rather than editing
 * the account's own row (ADR-0010). */
function AddSnapshotControl({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const balance = Number(value);
    if (!Number.isFinite(balance)) {
      setError("Enter a number.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await addSnapshot(accountId, new Date(), balance);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setValue("");
    // A manual value overwrite also clears any "Held for review" badge
    // left by a prior low-confidence statement parse — valueConfidence
    // comes from the latest Snapshot, so the badge needs a fresh read.
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className={styles.link} onClick={() => setOpen(true)}>
        Update value
      </button>
    );
  }

  return (
    <span className={styles.snapshotForm}>
      <input
        className={styles.input}
        type="number"
        step="0.01"
        placeholder="New value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="button" className={styles.link} onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" className={styles.link} onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </span>
  );
}

/** Uploads a statement for either account kind, parsed by Gemini — a
 * Transactional account's statement into dated Transactions (#115), a
 * Valuation account's into a single balance Snapshot with no Transaction
 * rows (#116), both per ADR-0010. The parsed result lives in server-
 * fetched sibling components (TransactionsManager, the account's own
 * value here), so a successful upload refreshes the route rather than
 * trying to thread new rows through client state across component
 * boundaries. */
function UploadStatementControl({ accountId, kind }: { accountId: string; kind: AccountInput["kind"] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelect(file: File | undefined) {
    if (!file) return;
    const validation = validateStatementUpload(file.type, file.size);
    if (!validation.ok) {
      setError(validation.error);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    setError(null);
    setStatus(null);
    const result =
      kind === "TRANSACTIONAL" ? await uploadStatement(accountId, file) : await uploadValuationStatement(accountId, file);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStatus(
      "importedCount" in result
        ? result.heldCount > 0
          ? `Imported ${result.importedCount} transactions, ${result.heldCount} held for review.`
          : `Imported ${result.importedCount} transactions.`
        : result.held
          ? "Balance updated (held for review)."
          : "Balance updated."
    );
    router.refresh();
  }

  return (
    <span className={styles.snapshotForm}>
      <label className={styles.link}>
        {uploading ? "Uploading…" : "Upload statement"}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,text/csv"
          style={{ display: "none" }}
          disabled={uploading}
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
        />
      </label>
      {status && <span className={styles.meta}>{status}</span>}
      {error && <p className={styles.error}>{error}</p>}
    </span>
  );
}
