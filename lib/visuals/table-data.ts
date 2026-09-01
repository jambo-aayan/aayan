/** Pure helpers for a freeform Table's TableRow.data JSON (#168, keyed by
 * TableColumn id per the schema comment) — no Prisma/React, so directly
 * unit-testable. Row data arrives as `unknown` (Prisma's Json type), so
 * every read narrows defensively rather than trusting the shape. */

export function readCells(data: unknown): Record<string, unknown> {
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
}

/** Removes one column's value from a row's data — used when a column is
 * deleted, so the dropped key doesn't linger in every row's JSON. */
export function stripCell(data: unknown, columnId: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(readCells(data)).filter(([key]) => key !== columnId));
}

/** Sets (or overwrites) one column's value in a row's data — used for
 * both an inline cell edit and restoring a deleted column's values on
 * undo. */
export function withCell(data: unknown, columnId: string, value: unknown): Record<string, unknown> {
  return { ...readCells(data), [columnId]: value };
}
