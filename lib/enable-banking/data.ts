import "server-only";
import { prisma } from "@/lib/prisma";
import { enableBankingFetch } from "./client";

export type Aspsp = { name: string; country: string; logo?: string } & Record<string, unknown>;

export async function listAspsps(country: string): Promise<Aspsp[]> {
  const result = await enableBankingFetch<{ aspsps: Aspsp[] }>(`/aspsps?country=${country}`);
  return result.aspsps;
}

export async function getLinkedBanks() {
  return prisma.enableBankingLink.findMany({ orderBy: { createdAt: "desc" } });
}
