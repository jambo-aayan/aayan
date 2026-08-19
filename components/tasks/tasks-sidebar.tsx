"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Plus, Calendar, ListChecks, Star, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { TaskMenu } from "./task-menu";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import { createTaskList, renameTaskList, archiveTaskList, deleteTaskList } from "@/lib/tasks/actions";
import { COLOR_PALETTE, resolveColorHex, type ColorKey } from "@/lib/colors";
import type { TaskListSummary } from "@/lib/tasks/data";
import styles from "./tasks-sidebar.module.css";

const SMART_VIEWS = [
  { view: "active", label: "All Tasks", icon: ListChecks },
  { view: "important", label: "Important", icon: Star },
  { view: "completed", label: "Completed", icon: CheckCircle2 },
] as const;

function ColorSwatchPicker({ value, onChange }: { value: string | null; onChange: (key: string | null) => void }) {
  return (
    <div className={styles.swatches}>
      <button
        type="button"
        className={`${styles.swatch} ${styles.swatchNone} ${!value ? styles.swatchActive : ""}`}
        aria-label="No color"
        onClick={() => onChange(null)}
      />
      {COLOR_PALETTE.map((c) => (
        <button
          key={c.key}
          type="button"
          className={`${styles.swatch} ${value === c.key ? styles.swatchActive : ""}`}
          style={{ background: c.hex }}
          aria-label={c.label}
          onClick={() => onChange(c.key)}
        />
      ))}
    </div>
  );
}

export function TasksSidebar({ lists: initialLists }: { lists: TaskListSummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { notifyError } = useToast();

  const [lists, setLists] = useState(initialLists);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);

  const activeView = searchParams.get("view") ?? "active";
  const activeListId = searchParams.get("listId") ?? "";

  function goToView(view: string) {
    const next = new URLSearchParams();
    next.set("view", view);
    router.push(`${pathname}?${next.toString()}`);
  }

  function goToList(listId: string) {
    const next = new URLSearchParams();
    next.set("listId", listId);
    router.push(`${pathname}?${next.toString()}`);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const result = await withRetry(() => createTaskList(name, newColor));
    if (!result.ok) {
      notifyError(result.error);
      return;
    }
    setLists((prev) => [...prev, { id: result.id, name, color: newColor, taskCount: 0 }]);
    setNewName("");
    setNewColor(null);
    setCreating(false);
    goToList(result.id);
  }

  function startEdit(list: TaskListSummary) {
    setEditingId(list.id);
    setEditName(list.name);
    setEditColor(list.color);
  }

  async function handleRename(id: string) {
    const name = editName.trim();
    if (!name) return;
    const prev = lists;
    setLists((p) => p.map((l) => (l.id === id ? { ...l, name, color: editColor } : l)));
    setEditingId(null);
    const result = await withRetry(() => renameTaskList(id, name, editColor));
    if (!result.ok) {
      setLists(prev);
      notifyError(result.error);
    }
  }

  async function handleArchive(id: string) {
    const prev = lists;
    setLists((p) => p.filter((l) => l.id !== id));
    const result = await withRetry(() => archiveTaskList(id));
    if (!result.ok) {
      setLists(prev);
      notifyError(result.error);
      return;
    }
    if (activeListId === id) goToView("active");
  }

  async function handleDelete(id: string) {
    const prev = lists;
    setLists((p) => p.filter((l) => l.id !== id));
    const result = await withRetry(() => deleteTaskList(id));
    if (!result.ok) {
      setLists(prev);
      notifyError(result.error);
      return;
    }
    if (activeListId === id) goToView("active");
  }

  return (
    <div className={styles.wrap}>
      <Link href="/today" className={styles.myDayLink}>
        <Calendar size={15} strokeWidth={2} />
        My Day
      </Link>

      <div className={styles.group}>
        <span className={styles.groupLabel}>Smart views</span>
        {SMART_VIEWS.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            type="button"
            className={`${styles.row} ${!activeListId && activeView === view ? styles.rowActive : ""}`}
            onClick={() => goToView(view)}
          >
            <Icon size={15} strokeWidth={2} className={styles.rowIcon} />
            {label}
          </button>
        ))}
      </div>

      <div className={styles.group}>
        <div className={styles.groupHead}>
          <span className={styles.groupLabel}>Lists</span>
          <button type="button" className={styles.addBtn} onClick={() => setCreating((v) => !v)} aria-label="New list">
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>

        {creating && (
          <div className={styles.editForm}>
            <input
              type="text"
              className={styles.editInput}
              placeholder="List name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <ColorSwatchPicker value={newColor} onChange={setNewColor} />
            <div className={styles.editActions}>
              <button type="button" className={styles.saveBtn} onClick={handleCreate}>
                Add
              </button>
              <button type="button" className={styles.cancelBtn} onClick={() => setCreating(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {lists.map((list) => {
          const hex = resolveColorHex(list.color as ColorKey | null);
          if (editingId === list.id) {
            return (
              <div key={list.id} className={styles.editForm}>
                <input
                  type="text"
                  className={styles.editInput}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleRename(list.id)}
                />
                <ColorSwatchPicker value={editColor} onChange={setEditColor} />
                <div className={styles.editActions}>
                  <button type="button" className={styles.saveBtn} onClick={() => handleRename(list.id)}>
                    Save
                  </button>
                  <button type="button" className={styles.cancelBtn} onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div key={list.id} className={`${styles.row} ${activeListId === list.id ? styles.rowActive : ""}`}>
              <button type="button" className={styles.rowMain} onClick={() => goToList(list.id)}>
                <span className={styles.dot} style={{ background: hex ?? "var(--border-soft)" }} />
                {list.name}
                <span className={styles.count}>{list.taskCount}</span>
              </button>
              <TaskMenu
                items={[
                  { label: "Rename / recolor", onSelect: () => startEdit(list) },
                  ...(list.id !== "inbox"
                    ? [
                        { label: "Archive", onSelect: () => handleArchive(list.id) },
                        { label: "Delete", onSelect: () => handleDelete(list.id), danger: true },
                      ]
                    : []),
                ]}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
