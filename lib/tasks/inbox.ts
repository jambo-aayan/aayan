import "server-only";
import { prisma } from "@/lib/prisma";

/** Stable, well-known id (same pattern as Pillar's slug ids) so every task
 * without an explicit List lands in the same row rather than a fresh one
 * each time — "every task has a List" per the Tasks UX brief, with capture
 * staying frictionless since nothing forces the user to pick one upfront. */
export const INBOX_LIST_ID = "inbox";

let ensured = false;

/** Idempotent — cheap to call from every task-create path. Cached per
 * server instance after the first successful ensure so routine task
 * creation doesn't pay for an upsert every time. */
export async function ensureInboxList(): Promise<string> {
  if (ensured) return INBOX_LIST_ID;
  await prisma.taskList.upsert({
    where: { id: INBOX_LIST_ID },
    create: { id: INBOX_LIST_ID, name: "Inbox", sortOrder: -1 },
    update: {},
  });
  ensured = true;
  return INBOX_LIST_ID;
}
