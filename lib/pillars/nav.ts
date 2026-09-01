import { FINANCE_PILLAR_ID } from "../finance/pillar-id";

/** Every Pillar gets a nav entry (#157/ADR-0016), but Finances keeps its
 * existing literal /finances route rather than the generic /[pillarId]
 * route every other Pillar (including Health) resolves to — its page stays
 * bespoke, untouched by the generic Pillar/Area architecture. Pure and
 * dependency-free (a relative import only) so it's directly unit-testable,
 * unlike anything importing "@/lib/prisma" (see #156's commit). */
export function pillarHref(pillarId: string): string {
  return pillarId === FINANCE_PILLAR_ID ? "/finances" : `/${pillarId}`;
}
