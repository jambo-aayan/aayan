import "server-only";
import { prisma } from "@/lib/prisma";
import {
  BUILT_IN_COLUMNS,
  goalBuiltInValues,
  habitBuiltInValues,
  systemBuiltInValues,
  taskBuiltInValues,
} from "./table-binding";
import { parseTableBinding, type TableAdapterKind } from "./config";
import type { VisualWithRecords } from "./actions";
import type { Prisma } from "@/lib/generated/prisma/client";

type EntityValues = { entityId: string; values: Record<string, unknown> };

function scopeWhere(pillarId: string, areaId: string | null) {
  return areaId ? { areaId } : { pillarId, areaId: null };
}

async function fetchBoundEntities(adapter: TableAdapterKind, pillarId: string, areaId: string | null): Promise<EntityValues[]> {
  switch (adapter) {
    case "goals": {
      const goals = await prisma.lifeGoal.findMany({
        where: scopeWhere(pillarId, areaId),
        select: {
          id: true,
          name: true,
          status: true,
          // Same deletedAt: null lib/goals/data.ts's own getGoalTasks
          // uses — a soft-deleted linked Task shouldn't count toward (or
          // dilute) Progress %.
          tasks: { where: { deletedAt: null }, select: { completedAt: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      return goals.map((g) => ({ entityId: g.id, values: goalBuiltInValues(g) }));
    }
    case "habits": {
      const habits = await prisma.habit.findMany({
        where: scopeWhere(pillarId, areaId),
        select: {
          id: true,
          name: true,
          status: true,
          scheduleType: true,
          scheduleTargetCount: true,
          checkIns: { select: { date: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      return habits.map((h) => ({
        entityId: h.id,
        values: habitBuiltInValues({ ...h, checkInDates: h.checkIns.map((c) => c.date) }),
      }));
    }
    case "tasks": {
      // Not status: "ACTIVE" like lib/tasks/data.ts's baseActiveWhere — a
      // Completed task should still show up here (with its own Completed
      // column reading true), same "the table shows what's really there"
      // stance the built-in column exists for. deletedAt/archivedAt still
      // apply — those really are gone, not something to weigh dropping.
      const tasks = await prisma.task.findMany({
        where: { ...scopeWhere(pillarId, areaId), deletedAt: null, archivedAt: null },
        select: { id: true, title: true, dueDate: true, completedAt: true, list: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      return tasks.map((t) => ({ entityId: t.id, values: taskBuiltInValues({ ...t, listName: t.list?.name ?? null }) }));
    }
    case "systems": {
      // templateId: null excludes Experiment run instances, same as
      // lib/systems/data.ts's getSystemsForPillar/getSystemsForArea — a
      // run is a child of its template, not a first-class System the
      // Systems section (or this table) shows on its own.
      const systems = await prisma.system.findMany({
        where: { ...scopeWhere(pillarId, areaId), templateId: null },
        select: { id: true, name: true, type: true, state: true },
        orderBy: { createdAt: "asc" },
      });
      return systems.map((s) => ({ entityId: s.id, values: systemBuiltInValues(s) }));
    }
  }
}

/** Resolves one Table Visual's binding (#169, ADR-0017) — an unbound
 * (freeform, #168) or chart Visual passes through untouched. A bound
 * table's `rows` become exactly the adapter's live entity list, one row
 * per entity: a real TableRow if a custom-column value was ever entered
 * for that entity (`boundEntityId` match), or a synthetic
 * `bound-row-${visualId}-${entityId}` placeholder otherwise — both carry
 * the entity's fresh built-in values merged into `data` alongside any
 * real custom-column values, so table-visual.tsx's rendering (which just
 * reads `data[column.id]` for whichever columns are in `columns`) doesn't
 * need to know built-in from custom. `columns` gets the adapter's
 * built-in defs prepended ahead of the real custom TableColumns — see
 * table-binding.ts's isBuiltInColumnId for how the UI tells them apart
 * (built-in ids always contain a colon, a real TableColumn's cuid never
 * does). No row here is ever independently addable/removable — the row
 * set is exactly "one per live entity", recomputed on every fetch. */
export async function resolveTableBinding(visual: VisualWithRecords): Promise<VisualWithRecords> {
  const binding = parseTableBinding(visual.config);
  if (!binding) return visual;

  const entities = await fetchBoundEntities(binding.adapter, visual.pillarId, visual.areaId);
  const builtInColumns = BUILT_IN_COLUMNS[binding.adapter].map((def, i) => ({
    id: def.id,
    visualId: visual.id,
    name: def.name,
    type: def.type,
    sortOrder: i,
  }));

  const realRowByEntity = new Map(visual.rows.filter((r) => r.boundEntityId).map((r) => [r.boundEntityId as string, r]));
  const rows = entities.map((entity, i) => {
    const real = realRowByEntity.get(entity.entityId);
    const customData = real && typeof real.data === "object" && real.data !== null ? (real.data as Record<string, unknown>) : {};
    return {
      id: real?.id ?? `bound-row-${visual.id}-${entity.entityId}`,
      visualId: visual.id,
      boundEntityId: entity.entityId,
      data: { ...customData, ...entity.values } as Prisma.JsonValue,
      sortOrder: real?.sortOrder ?? i,
      createdAt: real?.createdAt ?? new Date(),
      updatedAt: real?.updatedAt ?? new Date(),
    };
  });

  return { ...visual, columns: [...builtInColumns, ...visual.columns], rows };
}

export async function resolveTableBindings(visuals: VisualWithRecords[]): Promise<VisualWithRecords[]> {
  return Promise.all(visuals.map(resolveTableBinding));
}
