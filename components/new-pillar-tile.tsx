"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createPillar } from "@/lib/pillars/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { ColorSwatchPicker } from "@/components/color-swatch-picker";
import { PrimaryButton } from "@/components/primary-button";
import type { ColorKey } from "@/lib/colors";
import styles from "./new-pillar-tile.module.css";

/** Per #49's Out of Scope: a new Pillar is just its row + a name, no
 * Area-template picker or guided setup. As of #156/ADR-0016, creation also
 * asks for a color up front (via the same picker used everywhere else a
 * Pillar's color is set) — every other field stays fill-in-later. A color
 * picker needs an explicit submit rather than the old single-field
 * onBlur-submits pattern, since clicking a swatch blurs the name input. */
export function NewPillarTile() {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<ColorKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { notifyError } = useToast();

  function reset() {
    setEditing(false);
    setName("");
    setColor(null);
    setError(null);
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("Give the pillar a name first.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await withRetry(() => createPillar(name, color));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleCreate });
      return;
    }
    reset();
    router.refresh();
  }

  if (editing) {
    return (
      <div className={styles.form}>
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
            if (e.key === "Escape") reset();
          }}
        />
        <div className={styles.colorRow}>
          <span className={styles.label}>Color</span>
          <ColorSwatchPicker value={color} onChange={(key) => !saving && setColor(key as ColorKey | null)} />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <PrimaryButton onClick={handleCreate} disabled={saving}>
          {saving ? "Adding…" : "Add pillar"}
        </PrimaryButton>
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
