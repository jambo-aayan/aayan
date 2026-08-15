import "server-only";
import { prisma } from "@/lib/prisma";

export async function getPainMobilityLogs(areaId: string) {
  return prisma.painMobilityLog.findMany({ where: { areaId }, orderBy: { date: "asc" } });
}
