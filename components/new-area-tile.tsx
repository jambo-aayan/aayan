"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createArea } from "@/lib/areas/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { PrimaryButton } from "@/components/primary-button";
import styles from "./new-area-tile.module.css";

/** Mirrors NewPillarTile's pre-color-picker minimalism (#159/ADR-0016) — a
 * new Area is just its row + a name, no separate fields. A compact inline
 * trigger rather than NewPillarTile's dashed tile-grid box, since this sits
 * under a Pillar page's mindmap/areas overview rather than in a tile grid. */
export function NewAreaTile({ pillarId }: { pillarId: string }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { notifyError } = useToast();

  function reset() {
    setAdding(false);
    setName("");
    setError(null);
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("Give the area a name first.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await withRetry(() => createArea(pillarId, name));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleCreate });
      return;
    }
    reset();
    router.refresh();
  }

  if (adding) {
    return (
      <div className={styles.form}>
        <input
          type="text"
          className={styles.input}
          placeholder="Area name"
          value={name}
          autoFocus
          disabled={saving}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
            if (e.key === "Escape") reset();
          }}
        />
        <PrimaryButton onClick={handleCreate} disabled={saving}>
          {saving ? "Adding…" : "Add area"}
        </PrimaryButton>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    );
  }

  return (
    <button type="button" className={styles.trigger} onClick={() => setAdding(true)}>
      + New area
    </button>
  );
}
