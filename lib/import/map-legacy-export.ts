export type LegacyActionItem = {
  id: string;
  text: string;
  type: "habit" | "goal";
  status?: "not-started" | "in-progress" | "done";
  frequency?: "daily" | "weekly";
  history?: Record<string, number | boolean>;
  dueDate?: string;
};

export type LegacyFinanceItem = {
  id: string;
  name: string;
  amount: number;
  kind: "asset" | "liability";
  liquid?: boolean;
  excluded?: boolean;
};

export type LegacyFinanceGoal = { id: string; name: string; target: number; saved: number; monthly?: number };
export type LegacyFinanceExpense = { id: string; name: string; amount: number; date: string };
export type LegacyFinanceFixed = { id: string; name: string; amount: number };

export type LegacyFinance = {
  items: LegacyFinanceItem[];
  goals: LegacyFinanceGoal[];
  expenses: LegacyFinanceExpense[];
  fixed: LegacyFinanceFixed[];
  income: number;
};

export type LegacyExport = {
  exportedAt: string;
  data: {
    actions: Record<string, LegacyActionItem[]>;
    myDayOrder: string[];
    finance: LegacyFinance | null;
  };
};

export type MappedHabit = {
  id: string;
  areaId: string;
  name: string;
  frequency: "DAILY" | "WEEKLY";
  active: boolean;
  checkIns: { date: string; level: "FULL" | "MINIMUM" }[];
};

export type MappedActionGoal = {
  id: string;
  areaId: string;
  name: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "DONE";
  dueDate: string | null;
  myday: boolean;
};

export type MappedItem = {
  id: string;
  name: string;
  type: "ASSET" | "LIABILITY";
  value: number;
  liquid: boolean;
  excluded: boolean;
};

export type MappedGoal = { id: string; name: string; target: number; saved: number; monthlyContribution: number };

export type MappedTransaction = { id: string; date: string; amount: number; direction: "OUT"; category: string };

export type MappedBaseline = { monthlyIncome: number; fixedOutgoings: number };

export type MappedImport = {
  habits: MappedHabit[];
  actionGoals: MappedActionGoal[];
  items: MappedItem[];
  goals: MappedGoal[];
  transactions: MappedTransaction[];
  baseline: MappedBaseline | null;
  skipped: { bucketId: string; count: number }[];
};

/**
 * The old prototype's flat bucket ids that Health absorbed, mapped to their
 * new Area ids (see lib/health/seed-data.ts). Any bucket not listed here —
 * "productivity" and "religion" (no MVP home yet) and "money" (superseded
 * by the richer `data.finance` import below) — is reported in `skipped`
 * rather than silently dropped.
 *
 * "bp" and "healthcare" both map to "care" — the v2 Phase 1 restructure
 * merged Blood Pressure and Healthcare Navigation into a single Care Area
 * (see docs/adr/0005-v2-phase1-foundations-migration.md); a legacy import
 * run after that migration must land in the Area that actually exists.
 */
const BUCKET_TO_AREA_ID: Record<string, string> = {
  spine: "ankylosing-spondylitis",
  sleep: "sleep",
  diet: "diet",
  bodycomp: "body-composition",
  bp: "care",
  dental: "looks",
  healthcare: "care",
};

const STATUS_MAP: Record<string, "NOT_STARTED" | "IN_PROGRESS" | "DONE"> = {
  "not-started": "NOT_STARTED",
  "in-progress": "IN_PROGRESS",
  done: "DONE",
};

// External JSON isn't guaranteed to match the TS union it's typed as —
// an unrecognized status falls back to NOT_STARTED explicitly rather than
// indexing STATUS_MAP with an unknown key and silently getting `undefined`.
function goalStatus(status: string | undefined): "NOT_STARTED" | "IN_PROGRESS" | "DONE" {
  return STATUS_MAP[status ?? "not-started"] ?? "NOT_STARTED";
}

function checkInLevel(value: number | boolean): "FULL" | "MINIMUM" | null {
  if (value === 2 || value === true) return "FULL";
  if (value === 1) return "MINIMUM";
  return null;
}

export function mapLegacyExport(legacy: LegacyExport): MappedImport {
  const habits: MappedHabit[] = [];
  const actionGoals: MappedActionGoal[] = [];
  const skipped: { bucketId: string; count: number }[] = [];

  for (const [bucketId, items] of Object.entries(legacy.data.actions)) {
    const areaId = BUCKET_TO_AREA_ID[bucketId];
    if (!areaId) {
      skipped.push({ bucketId, count: items.length });
      continue;
    }

    for (const item of items) {
      // Bucket-qualified: the prototype's action ids are only ever looked up
      // scoped to a bucket (data.actions[bucketId]), so two different
      // buckets could in principle reuse the same raw id without collision
      // there — qualifying here avoids two items silently overwriting one
      // upserted row in the new schema, where ids are globally unique.
      const id = `legacy-${bucketId}-${item.id}`;
      if (item.type === "habit") {
        const checkIns = Object.entries(item.history ?? {})
          .map(([date, value]) => ({ date, level: checkInLevel(value) }))
          .filter((c): c is { date: string; level: "FULL" | "MINIMUM" } => c.level !== null);
        habits.push({
          id,
          areaId,
          name: item.text,
          frequency: item.frequency === "weekly" ? "WEEKLY" : "DAILY",
          active: true,
          checkIns,
        });
      } else {
        const myday = legacy.data.myDayOrder.includes(`${bucketId}:${item.id}`);
        actionGoals.push({
          id,
          areaId,
          name: item.text,
          status: goalStatus(item.status),
          dueDate: item.dueDate ?? null,
          myday,
        });
      }
    }
  }

  const finance = legacy.data.finance;
  const items: MappedItem[] = (finance?.items ?? []).map((i) => ({
    id: `legacy-${i.id}`,
    name: i.name,
    type: i.kind === "asset" ? "ASSET" : "LIABILITY",
    value: i.amount,
    liquid: i.liquid ?? false,
    excluded: i.excluded ?? false,
  }));

  const goals: MappedGoal[] = (finance?.goals ?? []).map((g) => ({
    id: `legacy-${g.id}`,
    name: g.name,
    target: g.target,
    saved: g.saved,
    monthlyContribution: g.monthly ?? 0,
  }));

  const transactions: MappedTransaction[] = (finance?.expenses ?? []).map((e) => ({
    id: `legacy-${e.id}`,
    date: e.date,
    amount: e.amount,
    direction: "OUT",
    category: e.name,
  }));

  const baseline: MappedBaseline | null = finance
    ? {
        monthlyIncome: finance.income,
        fixedOutgoings: (finance.fixed ?? []).reduce((sum, f) => sum + f.amount, 0),
      }
    : null;

  return { habits, actionGoals, items, goals, transactions, baseline, skipped };
}
