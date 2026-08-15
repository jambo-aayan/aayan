import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isSessionExpired, sessionExpiryDate } from "./session-expiry";
import { SESSION_COOKIE } from "./session-cookie-name";

export { SESSION_COOKIE };

export async function createSession(): Promise<void> {
  const now = new Date();
  const session = await prisma.session.create({
    data: { expiresAt: sessionExpiryDate(now) },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  if (token) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {
      // Session row already gone — nothing to clean up.
    });
  }
}

/** Authoritative check: validates the session cookie's token against the database. */
export async function getValidSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return false;

  const session = await prisma.session.findUnique({ where: { id: token } });
  if (!session) return false;

  if (isSessionExpired(session.expiresAt, new Date())) {
    // Lazily prune expired rows on read so the table doesn't grow unbounded.
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
    return false;
  }
  return true;
}
