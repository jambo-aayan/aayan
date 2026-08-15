"use client";

import { useEffect, useRef, useState } from "react";
import { createItem, deleteItem, restoreItem, updateItem, type ItemInput } from "@/lib/finance/actions";
import styles from "./items-manager.module.css";

type Item = ItemInput & { id: string };

const UNDO_WINDOW_MS = 5000;

const EMPTY_FORM: ItemInput = { name: "", type: "ASSET", value: 0, liquid: false, excluded: false };

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

export function ItemsManager({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [form, setForm] = useState<ItemInput>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [undo, setUndo] = useState<Item | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  async function handleAdd() {
    if (!form.name.trim()) {
      setAddError("Name is required.");
      return;
    }
    setAdding(true);
    setAddError(null);
    const result = await createItem(form);
    setAdding(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setItems((prev) => [...prev, result.item]);
    setForm(EMPTY_FORM);
  }

  async function handleDelete(item: Item) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await deleteItem(item.id);
    setUndo(item);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_WINDOW_MS);
  }

  async function handleUndo() {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const item = undo;
    setUndo(null);
    const result = await restoreItem(item);
    if (result.ok) setItems((prev) => [...prev, item]);
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
              onSaved={(updated) => {
                setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
                setEditingId(null);
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
                <button type="button" className={styles.link} onClick={() => handleDelete(item)}>
                  Delete
                </button>
              </div>
            </li>
          )
        )}
        {items.length === 0 && <li className={styles.empty}>No items yet.</li>}
      </ul>

      <div className={styles.addForm}>
        <input
          className={styles.input}
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <select
          className={styles.input}
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ItemInput["type"] }))}
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
          onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
        />
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={form.liquid}
            onChange={(e) => setForm((f) => ({ ...f, liquid: e.target.checked }))}
          />
          Liquid
        </label>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={form.excluded}
            onChange={(e) => setForm((f) => ({ ...f, excluded: e.target.checked }))}
          />
          Excluded
        </label>
        <button type="button" className={styles.add} onClick={handleAdd} disabled={adding}>
          {adding ? "Adding…" : "Add item"}
        </button>
      </div>
      {addError && <p className={styles.error}>{addError}</p>}

      {undo && (
        <div className={styles.toast}>
          <span>Deleted &ldquo;{undo.name}&rdquo;.</span>
          <button type="button" className={styles.undoBtn} onClick={handleUndo}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

function ItemEditRow({
  item,
  onCancel,
  onSaved,
}: {
  item: Item;
  onCancel: () => void;
  onSaved: (item: Item) => void;
}) {
  const [form, setForm] = useState<ItemInput>(item);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateItem(item.id, form);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved({ ...form, id: item.id });
  }

  return (
    <li className={styles.addForm}>
      <input
        className={styles.input}
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
      />
      <select
        className={styles.input}
        value={form.type}
        onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ItemInput["type"] }))}
      >
        <option value="ASSET">Asset</option>
        <option value="LIABILITY">Liability</option>
      </select>
      <input
        className={styles.input}
        type="number"
        step="0.01"
        value={form.value}
        onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
      />
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={form.liquid}
          onChange={(e) => setForm((f) => ({ ...f, liquid: e.target.checked }))}
        />
        Liquid
      </label>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={form.excluded}
          onChange={(e) => setForm((f) => ({ ...f, excluded: e.target.checked }))}
        />
        Excluded
      </label>
      <button type="button" className={styles.add} onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" className={styles.link} onClick={onCancel}>
        Cancel
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </li>
  );
}
