import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Proves the deployed app can actually reach the Neon database via Prisma. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
