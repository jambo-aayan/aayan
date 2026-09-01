"use client";

import { useState } from "react";
import { Tags } from "lucide-react";
import { createCategory, mergeCategory, renameCategory } from "@/lib/finance/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { PrimaryButton } from "@/components/primary-button";
import { EmptyState } from "@/components/empty-state";
import { RowActions } from "@/components/row-actions";
import styles from "./category-manager.module.css";

type Category = { id: string; name: string };

/** Add/rename/merge for the Transaction category taxonomy (#147,
 * ADR-0015) — merge is the one operation that actually cleans up an
 * existing near-duplicate mess, not just prevents new ones. */
export function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const { notifyError } = useToast();

  function upsertRenamed(id: string, name: string) {
    setCategories((prev) => [...prev.filter((c) => c.id !== id), { id, name }].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function handleAdd() {
    if (!newName.trim()) {
      setAddError("Enter a category name.");
      return;
    }
    setAdding(true);
    setAddError(null);
    const result = await withRetry(() => createCategory(newName));
    setAdding(false);
    if (!result.ok) {
      setAddError(result.error);
      notifyError(result.error, { onRetry: handleAdd });
      return;
    }
    upsertRenamed(result.item.id, result.item.name);
    setNewName("");
  }

  return (
    <div>
      <ul className={styles.list}>
        {categories.map((c) =>
          editingId === c.id ? (
            <li key={c.id} className={styles.row}>
              <RenameForm
                category={c}
                notifyError={notifyError}
                onCancel={() => setEditingId(null)}
                onRenamed={(name) => { upsertRenamed(c.id, name); setEditingId(null); }}
              />
            </li>
          ) : mergingId === c.id ? (
            <li key={c.id} className={styles.row}>
              <MergeForm
                category={c}
                targets={categories.filter((x) => x.id !== c.id)}
                notifyError={notifyError}
                onCancel={() => setMergingId(null)}
                onMerged={() => { setCategories((prev) => prev.filter((x) => x.id !== c.id)); setMergingId(null); }}
              />
            </li>
          ) : (
            <li key={c.id} className={styles.row}>
              <span className={styles.name}>{c.name}</span>
              <RowActions>
                <button type="button" className={styles.link} onClick={() => setEditingId(c.id)}>
                  Rename
                </button>
                {categories.length > 1 && (
                  <button type="button" className={styles.link} onClick={() => setMergingId(c.id)}>
                    Merge into…
                  </button>
                )}
              </RowActions>
            </li>
          )
        )}
      </ul>
      {categories.length === 0 && <EmptyState icon={Tags} message="No categories yet." />}

      <div className={styles.addForm}>
        <input
          className={styles.input}
          placeholder="New category"
          aria-label="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <PrimaryButton onClick={handleAdd} disabled={adding}>
          {adding ? "Adding…" : "Add category"}
        </PrimaryButton>
      </div>
      {addError && <p className={styles.error}>{addError}</p>}
    </div>
  );
}

type NotifyError = ReturnType<typeof useToast>["notifyError"];

function RenameForm({
  category,
  notifyError,
  onCancel,
  onRenamed,
}: {
  category: Category;
  notifyError: NotifyError;
  onCancel: () => void;
  onRenamed: (name: string) => void;
}) {
  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Enter a category name.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await withRetry(() => renameCategory(category.id, name));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleSave });
      return;
    }
    onRenamed(name.trim());
  }

  return (
    <div className={styles.editForm}>
      <input className={styles.input} aria-label="Category name" value={name} onChange={(e) => setName(e.target.value)} />
      <PrimaryButton onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </PrimaryButton>
      <button type="button" className={styles.link} onClick={onCancel}>
        Cancel
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

function MergeForm({
  category,
  targets,
  notifyError,
  onCancel,
  onMerged,
}: {
  category: Category;
  targets: Category[];
  notifyError: NotifyError;
  onCancel: () => void;
  onMerged: () => void;
}) {
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const [confirming, setConfirming] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = targets.find((t) => t.id === targetId);

  async function handleMerge() {
    if (!targetId) return;
    setMerging(true);
    setError(null);
    const result = await withRetry(() => mergeCategory(category.id, targetId));
    setMerging(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleMerge });
      return;
    }
    onMerged();
  }

  // A confirm step, not the row-actions undo-toast pattern most deletes in
  // this app use — merge bulk-reassigns every Transaction on `category`
  // and deletes it in the same action, with no per-transaction undo once
  // it's done, so it gets a heavier "are you sure" than a routine delete.
  if (confirming) {
    return (
      <div className={styles.editForm}>
        <span className={styles.mergeLabel}>
          Merge &ldquo;{category.name}&rdquo; into &ldquo;{target?.name}&rdquo;? This can&rsquo;t be undone.
        </span>
        <PrimaryButton onClick={handleMerge} disabled={merging}>
          {merging ? "Merging…" : "Yes, merge"}
        </PrimaryButton>
        <button type="button" className={styles.link} onClick={() => setConfirming(false)} disabled={merging}>
          Cancel
        </button>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    );
  }

  return (
    <div className={styles.editForm}>
      <span className={styles.mergeLabel}>Merge &ldquo;{category.name}&rdquo; into</span>
      <select className={styles.input} aria-label="Merge into" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <PrimaryButton onClick={() => setConfirming(true)} disabled={!targetId}>
        Merge
      </PrimaryButton>
      <button type="button" className={styles.link} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
