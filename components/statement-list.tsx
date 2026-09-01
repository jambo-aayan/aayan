"use client";

import { useState } from "react";
import { renameStatement } from "@/lib/finance/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { PrimaryButton } from "@/components/primary-button";
import { RowActions } from "@/components/row-actions";
import styles from "./statement-list.module.css";

type Statement = { id: string; name: string; accountName: string; uploadedAt: Date };

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** Every uploaded statement, with its generated name inline-editable
 * (#148, ADR-0015) — for when extraction's institution/period guess is
 * wrong or missing. */
export function StatementList({ initialStatements }: { initialStatements: Statement[] }) {
  const [statements, setStatements] = useState(initialStatements);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { notifyError } = useToast();

  return (
    <ul className={styles.list}>
      {statements.map((s) =>
        editingId === s.id ? (
          <li key={s.id} className={styles.row}>
            <RenameForm
              statement={s}
              notifyError={notifyError}
              onCancel={() => setEditingId(null)}
              onRenamed={(name) => {
                setStatements((prev) => prev.map((x) => (x.id === s.id ? { ...x, name } : x)));
                setEditingId(null);
              }}
            />
          </li>
        ) : (
          <li key={s.id} className={styles.row}>
            <div>
              <div className={styles.name}>{s.name}</div>
              <div className={styles.meta}>
                {s.accountName} · {formatDate(s.uploadedAt)}
              </div>
            </div>
            <RowActions>
              <button type="button" className={styles.link} onClick={() => setEditingId(s.id)}>
                Rename
              </button>
            </RowActions>
          </li>
        )
      )}
      {statements.length === 0 && <li className={styles.muted}>No statements uploaded yet.</li>}
    </ul>
  );
}

type NotifyError = ReturnType<typeof useToast>["notifyError"];

function RenameForm({
  statement,
  notifyError,
  onCancel,
  onRenamed,
}: {
  statement: Statement;
  notifyError: NotifyError;
  onCancel: () => void;
  onRenamed: (name: string) => void;
}) {
  const [name, setName] = useState(statement.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await withRetry(() => renameStatement(statement.id, name));
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
      <input className={styles.input} aria-label="Statement name" value={name} onChange={(e) => setName(e.target.value)} />
      <PrimaryButton onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </PrimaryButton>
      <button type="button" className={styles.link} onClick={onCancel} disabled={saving}>
        Cancel
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
