"use client";

import { useState } from "react";
import { createItem, deleteItem, restoreItem, updateItem, type ItemInput } from "@/lib/finance/actions";
import { useUndoableCrudList } from "@/lib/hooks/use-undoable-crud-list";
import styles from "./items-manager.module.css";

type Item = ItemInput & { id: string };

const EMPTY_FORM: ItemInput = { name: "", type: "ASSET", value: 0, liquid: false, excluded: false };

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

export function ItemsManager({ initialItems }: { initialItems: Item[] }) {
  const { items, error, undo, add, update, remove, undoDelete } = useUndoableCrudList<Item, ItemInput>(
    initialItems,
    { create: createItem, update: updateItem, remove: deleteItem, restore: restoreItem }
  );
  const [form, setForm] = useState<ItemInput>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  return (
    <div>
      <ul className={styles.list}>
        {items.map((item) =>
          editingId === item.id ? (
            <ItemEditRow
              key={item.id}
              item={item}
              onCancel={() => setEditingId(null)}
              onSaved={async (input) => {
                const ok = await update(item.id, input, { ...input, id: item.id });
                if (ok) setEditingId(null);
                return ok;
              }}
            />
          ) : (
            <li key={item.id} className={styles.row}>
              <div>
                <div className={styles.name}>{item.name}</div>
                <div className={styles.meta}>
                  {item.type === "ASSET" ? "Asset" : "Liability"}
                  {item.liquid && " · liquid"}
                  {item.excluded && " · excluded"}
                </div>
              </div>
              <div className={styles.rowActions}>
                <span className={styles.value}>{formatGBP(item.value)}</span>
                <button type="button" className={styles.link} onClick={() => setEditingId(item.id)}>
                  Edit
                </button>
                <button type="button" className={styles.link} onClick={() => remove(item)}>
                  Delete
                </button>
              </div>
            </li>
          )
        )}
        {items.length === 0 && <li className={styles.empty}>No items yet.</li>}
      </ul>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.addForm}>
        <ItemFields form={form} onChange={setForm} />
        <button type="button" className={styles.add} onClick={handleAdd} disabled={adding}>
          {adding ? "Adding…" : "Add item"}
        </button>
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

function ItemFields({ form, onChange }: { form: ItemInput; onChange: (update: ItemInput) => void }) {
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
        onChange={(e) => onChange({ ...form, type: e.target.value as ItemInput["type"] })}
      >
        <option value="ASSET">Asset</option>
        <option value="LIABILITY">Liability</option>
      </select>
      <input
        className={styles.input}
        type="number"
        step="0.01"
        placeholder="Value"
        value={form.value}
        onChange={(e) => onChange({ ...form, value: Number(e.target.value) })}
      />
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={form.liquid}
          onChange={(e) => onChange({ ...form, liquid: e.target.checked })}
        />
        Liquid
      </label>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={form.excluded}
          onChange={(e) => onChange({ ...form, excluded: e.target.checked })}
        />
        Excluded
      </label>
    </>
  );
}

function ItemEditRow({
  item,
  onCancel,
  onSaved,
}: {
  item: Item;
  onCancel: () => void;
  onSaved: (input: ItemInput) => Promise<boolean>;
}) {
  const [form, setForm] = useState<ItemInput>(item);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSaved(form);
    setSaving(false);
  }

  return (
    <li className={styles.addForm}>
      <ItemFields form={form} onChange={setForm} />
      <button type="button" className={styles.add} onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" className={styles.link} onClick={onCancel}>
        Cancel
      </button>
    </li>
  );
}
