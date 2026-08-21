"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { APP_SETTINGS_ID } from "./constants";
import type { AppSettings } from "./data";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<ActionResult> {
  try {
    await prisma.appSettings.update({ where: { id: APP_SETTINGS_ID }, data: patch });
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
  // Reduce-motion is read in the root layout and affects every page, so it
  // needs a broad revalidation rather than just /settings.
  revalidatePath("/", "layout");
  return { ok: true };
}
