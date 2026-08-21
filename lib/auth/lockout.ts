import "server-only";
import { prisma } from "@/lib/prisma";
import { isLockedOut, lockedUntilFor } from "./rate-limit";

const LOGIN_LOCKOUT_ID = "login";

async function ensureLockoutRow() {
  return prisma.loginLockout.upsert({
    where: { id: LOGIN_LOCKOUT_ID },
    create: { id: LOGIN_LOCKOUT_ID },
    update: {},
  });
}

/** Whether login is currently locked out, and — if so — until when. */
export async function getLockoutState(): Promise<{ locked: boolean; lockedUntil: Date | null }> {
  const row = await ensureLockoutRow();
  const locked = isLockedOut(row.lockedUntil, new Date());
  return { locked, lockedUntil: locked ? row.lockedUntil : null };
}

/** Records a failed password attempt and returns the resulting lockout state. */
export async function recordFailedAttempt(): Promise<{ lockedUntil: Date | null }> {
  const row = await ensureLockoutRow();
  const failedCount = row.failedCount + 1;
  const lockedUntil = lockedUntilFor(failedCount, new Date());
  await prisma.loginLockout.update({
    where: { id: LOGIN_LOCKOUT_ID },
    data: { failedCount, lockedUntil },
  });
  return { lockedUntil };
}

/** Resets the lockout state on a successful login. */
export async function resetLockout(): Promise<void> {
  await prisma.loginLockout.upsert({
    where: { id: LOGIN_LOCKOUT_ID },
    create: { id: LOGIN_LOCKOUT_ID, failedCount: 0, lockedUntil: null },
    update: { failedCount: 0, lockedUntil: null },
  });
}
