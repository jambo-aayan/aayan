"use client";

import { useState } from "react";
import { startEnableBankingAuth } from "@/lib/enable-banking/actions";
import { useToast } from "@/components/toast/toast-provider";
import styles from "./bank-picker.module.css";

export type AspspOption = { name: string; country: string };

export function BankPicker({ aspsps }: { aspsps: AspspOption[] }) {
  const [query, setQuery] = useState("");
  const [connectingName, setConnectingName] = useState<string | null>(null);
  const { notifyError } = useToast();

  const filtered = query.trim()
    ? aspsps.filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase()))
    : aspsps;

  async function handleConnect(aspsp: AspspOption) {
    setConnectingName(aspsp.name);
    const result = await startEnableBankingAuth(aspsp.name, aspsp.country);
    if (!result.ok) {
      setConnectingName(null);
      notifyError(result.error, { onRetry: () => handleConnect(aspsp) });
      return;
    }
    window.location.assign(result.url);
  }

  return (
    <div>
      <input
        className={styles.search}
        placeholder="Search banks (e.g. Lloyds, Yonder)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {filtered.length === 0 ? (
        <p className={styles.empty}>No banks match &ldquo;{query}&rdquo;.</p>
      ) : (
        <ul className={styles.list}>
          {filtered.slice(0, 50).map((aspsp) => (
            <li key={`${aspsp.name}:${aspsp.country}`} className={styles.row}>
              <span className={styles.name}>{aspsp.name}</span>
              <button
                type="button"
                className={styles.connect}
                onClick={() => handleConnect(aspsp)}
                disabled={connectingName === aspsp.name}
              >
                {connectingName === aspsp.name ? "Connecting…" : "Connect"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {filtered.length > 50 && (
        <p className={styles.empty}>Showing the first 50 of {filtered.length} matches — narrow your search.</p>
      )}
    </div>
  );
}
