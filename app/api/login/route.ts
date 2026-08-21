import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { getLockoutState, recordFailedAttempt, resetLockout } from "@/lib/auth/lockout";

function secondsUntil(date: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 1000));
}

export async function POST(request: NextRequest) {
  const { password } = await request.json().catch(() => ({ password: undefined }));

  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const lockout = await getLockoutState();
  if (lockout.locked && lockout.lockedUntil) {
    return NextResponse.json(
      { error: `Too many attempts — try again in ${secondsUntil(lockout.lockedUntil)}s` },
      { status: 429 }
    );
  }

  const valid = await verifyPassword(password);
  if (!valid) {
    const { lockedUntil } = await recordFailedAttempt();
    const error = lockedUntil
      ? `Too many attempts — try again in ${secondsUntil(lockedUntil)}s`
      : "Incorrect password";
    return NextResponse.json({ error }, { status: lockedUntil ? 429 : 401 });
  }

  await resetLockout();
  await createSession();
  return NextResponse.json({ ok: true });
}
