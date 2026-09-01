-- Closes a race in updateTableCell's lazy-create-on-first-edit path (#169):
-- two concurrent first edits for the same bound entity could otherwise each
-- create a duplicate TableRow. Postgres treats multiple NULLs as distinct
-- under a unique index, so this only actually constrains bound rows
-- (boundEntityId non-null) — freeform rows (boundEntityId null) are
-- unaffected.
DROP INDEX "TableRow_visualId_boundEntityId_idx";

CREATE UNIQUE INDEX "TableRow_visualId_boundEntityId_key" ON "TableRow"("visualId", "boundEntityId");
