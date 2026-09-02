"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { MetricCadence, MetricValueType } from "@/lib/generated/prisma/client";
import { validateMetricInput } from "./logic";

export type MetricInput = {
  name: string;
  valueType: MetricValueType;
  cadence: MetricCadence;
  required: boolean;
  unit?: string | null;
  /** Only meaningful for valueType "ENUM" — a plain string array, stored
   * JSON-encoded on Metric.enumOptions (no separate join table for a
   * handful of fixed choices, see the schema's own doc comment). */
  enumOptions?: string[] | null;
  pillarId?: string | null;
  areaId?: string | null;
};

export type MetricResult = { ok: true; id: string } | { ok: false; error: string };

const SAVE_ERROR = "Couldn't save — try again.";

function toMetricData(input: MetricInput) {
  return {
    name: input.name.trim(),
    valueType: input.valueType,
    cadence: input.cadence,
    required: input.required,
    unit: input.unit?.trim() || null,
    enumOptions: input.valueType === "ENUM" && input.enumOptions ? JSON.stringify(input.enumOptions) : null,
    pillarId: input.pillarId ?? null,
    areaId: input.areaId ?? null,
  };
}

export async function createMetric(input: MetricInput): Promise<MetricResult> {
  const error = validateMetricInput(input);
  if (error) return { ok: false, error };
  try {
    const metric = await prisma.metric.create({ data: toMetricData(input) });
    revalidatePath("/log");
    return { ok: true, id: metric.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function updateMetric(id: string, input: MetricInput): Promise<MetricResult> {
  const error = validateMetricInput(input);
  if (error) return { ok: false, error };
  try {
    await prisma.metric.update({ where: { id }, data: toMetricData(input) });
    revalidatePath("/log");
    return { ok: true, id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export type ArchiveMetricResult = { ok: true } | { ok: false; error: string };

/** Soft-delete only — a Metric's entries stay intact for history/
 * correlations, it just stops appearing as loggable/due (see the schema's
 * own doc comment on why a hard delete isn't exposed at all). */
export async function archiveMetric(id: string): Promise<ArchiveMetricResult> {
  try {
    await prisma.metric.update({ where: { id }, data: { archivedAt: new Date() } });
    revalidatePath("/log");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't archive — try again." };
  }
}

export type LogEntryResult = { ok: true } | { ok: false; error: string };

/** Writes one MetricEntry for a given date. The caller is responsible for
 * `date`'s precision matching the metric's own cadence — a DAILY/WEEKLY
 * metric's date must already be truncated to that period's start (the
 * unique (metricId, date) constraint is what actually enforces "one entry
 * per period" — see the schema's own doc comment), an AD_HOC metric's date
 * is just the real log timestamp. Exactly one of numberValue/textValue is
 * expected non-null, per the metric's valueType — this action doesn't
 * itself validate that against the Metric's declared type, since the
 * caller (a typed form, #184) already knows which one applies. */
export async function logMetricEntry(
  metricId: string,
  date: Date,
  numberValue: number | null,
  textValue: string | null
): Promise<LogEntryResult> {
  try {
    await prisma.metricEntry.upsert({
      where: { metricId_date: { metricId, date } },
      create: { metricId, date, numberValue, textValue },
      update: { numberValue, textValue },
    });
    revalidatePath("/log");
    return { ok: true };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}
