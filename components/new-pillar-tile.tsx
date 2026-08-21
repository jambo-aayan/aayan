"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createPillar } from "@/lib/pillars/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import styles from "./new-pillar-tile.module.css";

/** Per #49's Out of Scope: a new Pillar is just its row + name, no
 * Area-template picker or guided setup — so this is a single inline
 * name field, not a full composer. */
export function NewPillarTile() {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { notifyError } = useToast();

  async function handleCreate() {
    if (!name.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const result = await withRetry(() => createPillar(name));
    setSaving(false);
    if (!result.ok) {
      notifyError(result.error, { onRetry: handleCreate });
      return;
    }
    setName("");
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className={styles.tile}>
        <input
          type="text"
          className={styles.input}
          placeholder="Pillar name"
          value={name}
          autoFocus
          disabled={saving}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
            if (e.key === "Escape") {
              setEditing(false);
              setName("");
            }
          }}
          onBlur={handleCreate}
        />
      </div>
    );
  }

  return (
    <button type="button" className={styles.tile} onClick={() => setEditing(true)}>
      <Plus size={18} strokeWidth={2} />
      New pillar
    </button>
  );
}
