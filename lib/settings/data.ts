import "server-only";
import { prisma } from "@/lib/prisma";
import { APP_SETTINGS_ID } from "./constants";

export type AppSettings = {
  reduceMotion: boolean;
  emptyAppMode: boolean;
  weeklyReviewPrompt: boolean;
};

/** The singleton row is seeded directly by its migration (see
 * prisma/migrations/*_app_settings), not upserted on read — reading in the
 * root layout means concurrent first-reads (e.g. parallel static
 * prerendering) would otherwise race to insert it themselves. */
export async function getAppSettings(): Promise<AppSettings> {
  const row = await prisma.appSettings.findUniqueOrThrow({ where: { id: APP_SETTINGS_ID } });
  return { reduceMotion: row.reduceMotion, emptyAppMode: row.emptyAppMode, weeklyReviewPrompt: row.weeklyReviewPrompt };
}
