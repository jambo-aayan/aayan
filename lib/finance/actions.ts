"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { BASELINE_ID } from "./baseline-id";

export type ItemInput = {
  name: string;
  type: "ASSET" | "LIABILITY";
  value: number;
  liquid: boolean;
  excluded: boolean;
};

export type ItemResult =
  | { ok: true; item: ItemInput & { id: string } }
  | { ok: false; error: string };

export type ActionResult = { ok: true } | { ok: false; error: string };

const SAVE_ERROR = "Couldn't save — try again.";

export async function createItem(input: ItemInput): Promise<ItemResult> {
  try {
    const item = await prisma.item.create({ data: input });
    revalidatePath("/finances");
    return { ok: true, item: { ...input, id: item.id } };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function updateItem(id: string, input: ItemInput): Promise<ActionResult> {
  try {
    await prisma.item.update({ where: { id }, data: input });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath("/finances");
  return { ok: true };
}

export async function deleteItem(id: string): Promise<ActionResult> {
  try {
    await prisma.item.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidatePath("/finances");
  return { ok: true };
}

/** Recreates a just-deleted item with its original id, for the delete-undo toast. */
export async function restoreItem(item: ItemInput & { id: string }): Promise<ActionResult> {
  try {
    await prisma.item.create({ data: item });
  } catch {
    return { ok: false, error: "Couldn't undo — the item may already be back." };
  }
  revalidatePath("/finances");
  return { ok: true };
}

export async function updateBaseline(
  monthlyIncome: number,
  fixedOutgoings: number
): Promise<ActionResult> {
  try {
    await prisma.baseline.upsert({
      where: { id: BASELINE_ID },
      create: { id: BASELINE_ID, monthlyIncome, fixedOutgoings },
      update: { monthlyIncome, fixedOutgoings },
    });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath("/finances");
  return { ok: true };
}
