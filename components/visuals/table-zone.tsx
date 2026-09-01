import { Table2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PrimaryButton } from "@/components/primary-button";
import type { Visual } from "@/lib/generated/prisma/client";
import styles from "./table-zone.module.css";

/** The Table zone (#161/#162, ADR-0017) — holds any number of table
 * Visuals on a Pillar/Area page. The "+ Add table" trigger is inert in
 * this ticket (schema/skeleton only) — #168 wires it up to a real table,
 * which is why pillarId/areaId are already accepted here (unused for now)
 * rather than added to this component's signature again later. Separate
 * zone from ChartZone since a page's Charts and Table sections are
 * independently toggleable/reorderable. */
export function TableZone({ visuals }: { visuals: Visual[]; pillarId: string; areaId: string | null }) {
  return (
    <div className={styles.list}>
      {visuals.length === 0 && <EmptyState icon={Table2} message="No tables yet." />}
      <PrimaryButton className={styles.addTrigger} disabled title="Coming soon">
        + Add table
      </PrimaryButton>
    </div>
  );
}
