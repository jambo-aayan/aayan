"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import styles from "@/components/tasks/task-filters.module.css";

type Option = { id: string; name: string };

const SEARCH_DEBOUNCE_MS = 400;

/** The full transaction browser's filter bar (#150, ADR-0015) — same
 * URL-searchParams-driven pattern as Goals/Habits/Tasks (GoalsFilters),
 * so a filtered view is a shareable, bookmarkable link. Changing any
 * filter resets back to page 1 — a stale page number past the new
 * filtered result's end would just show an empty page. */
export function TransactionFilters({ categories, accounts }: { categories: Option[]; accounts: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Without this, typing into search then navigating away (a category
  // filter, a pagination link) within the debounce window still fires the
  // pending setParam("search", ...) afterward, overriding whatever
  // navigation the user just took with a stale search push — same
  // cleanup shape as editable-text.tsx's own debounced autosave.
  useEffect(() => {
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, []);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function setSearchParam(value: string) {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => setParam("search", value), SEARCH_DEBOUNCE_MS);
  }

  function toggleGroupByStatement() {
    const next = new URLSearchParams(searchParams.toString());
    if (next.get("groupByStatement") === "1") next.delete("groupByStatement");
    else next.set("groupByStatement", "1");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className={styles.bar}>
      <select
        className={styles.select}
        aria-label="Category"
        value={searchParams.get("categoryId") ?? ""}
        onChange={(e) => setParam("categoryId", e.target.value)}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        className={styles.select}
        aria-label="Account"
        value={searchParams.get("accountId") ?? ""}
        onChange={(e) => setParam("accountId", e.target.value)}
      >
        <option value="">All accounts</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <input
        className={styles.select}
        type="date"
        aria-label="From date"
        value={searchParams.get("dateFrom") ?? ""}
        onChange={(e) => setParam("dateFrom", e.target.value)}
      />
      <input
        className={styles.select}
        type="date"
        aria-label="To date"
        value={searchParams.get("dateTo") ?? ""}
        onChange={(e) => setParam("dateTo", e.target.value)}
      />
      <input
        className={styles.select}
        type="search"
        placeholder="Search description…"
        aria-label="Search description"
        defaultValue={searchParams.get("search") ?? ""}
        onChange={(e) => setSearchParam(e.target.value)}
      />
      <label className={styles.select}>
        <input
          type="checkbox"
          checked={searchParams.get("groupByStatement") === "1"}
          onChange={toggleGroupByStatement}
        />{" "}
        Group by statement
      </label>
    </div>
  );
}
