import { NextResponse, type NextRequest } from "next/server";
import { runNudgeEvaluation } from "@/lib/nudges/data";
import type { NudgeRunKind } from "@/lib/nudges/eligibility";

const RUN_KINDS: Record<string, NudgeRunKind> = {
  morning: "MORNING",
  evening: "EVENING",
  "weekly-review": "WEEKLY_REVIEW",
};

/**
 * The Nudges eligibility engine's actual trigger. Vercel Cron (see
 * vercel.json) hits this three times a day/week — one request per
 * wall-clock trigger the design_handoff_aayan README's Delivery rules
 * table names (07:30 morning brief, 20:30 evening check-in, Sunday 18:00
 * weekly review) — rather than the app computing nudges per-page-load,
 * since these are wall-clock-based, not request-based.
 *
 * Not built on this session's CronCreate/Routine tools: those schedule a
 * *prompt back into this Claude session*, live only in memory for its
 * lifetime, and auto-expire after 7 days — none of which survives past
 * this coding session, let alone runs reliably against a deployed app
 * with no Claude session attached. Vercel Cron calling this route is the
 * durable equivalent for a Vercel-deployed Next.js app (see
 * package.json's `vercel-build` script).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const run = req.nextUrl.searchParams.get("run") ?? "";
  const runKind = RUN_KINDS[run];
  if (!runKind) {
    return NextResponse.json({ ok: false, error: `Unknown run "${run}" — expected one of ${Object.keys(RUN_KINDS).join(", ")}` }, { status: 400 });
  }

  try {
    const result = await runNudgeEvaluation(runKind);
    return NextResponse.json({ ok: true, runKind, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
