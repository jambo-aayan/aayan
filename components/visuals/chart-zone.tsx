import { LineChart } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PrimaryButton } from "@/components/primary-button";
import type { Visual } from "@/lib/generated/prisma/client";
import styles from "./chart-zone.module.css";

/** The Charts zone (#161/#162, ADR-0017) — holds any number of chart
 * Visuals on a Pillar/Area page, unlike the six singular sections it sits
 * alongside in the same section list. The "+ Add chart" trigger is inert
 * in this ticket (schema/skeleton only) — #163 wires it up to the real
 * add-chart modal, which is why pillarId/areaId are already accepted here
 * (unused for now) rather than added to this component's signature again
 * in that immediately-following ticket. */
export function ChartZone({ visuals }: { visuals: Visual[]; pillarId: string; areaId: string | null }) {
  return (
    <div className={styles.list}>
      {visuals.length === 0 && <EmptyState icon={LineChart} message="No charts yet." />}
      <PrimaryButton className={styles.addTrigger} disabled title="Coming soon">
        + Add chart
      </PrimaryButton>
    </div>
  );
}
