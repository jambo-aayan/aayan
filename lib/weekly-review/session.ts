import "server-only";
import { prisma } from "@/lib/prisma";

export const WEEKLY_REVIEW_SESSION_ID = "weekly-review";

export type ReviewVerdict = "KEEP" | "PAUSE" | "REWORK";

export type WeeklyReviewSessionState = {
  step: number;
  draftDigest: string | null;
  verdicts: Record<string, ReviewVerdict>;
  rankOrder: string[];
};

/** Not upserted on read — the singleton row is seeded directly by its
 * migration (see prisma/migrations/*_weekly_review_session), same
 * reasoning as lib/settings/data.ts's getAppSettings. */
export async function getWeeklyReviewSession(): Promise<WeeklyReviewSessionState> {
  const row = await prisma.weeklyReviewSession.findUniqueOrThrow({ where: { id: WEEKLY_REVIEW_SESSION_ID } });
  return {
    step: row.step,
    draftDigest: row.draftDigest,
    verdicts: (row.verdicts as Record<string, ReviewVerdict>) ?? {},
    rankOrder: row.rankOrder,
  };
}
