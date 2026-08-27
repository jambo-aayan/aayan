export const HEALTH_PILLAR_ID = "health";
export const HEALTH_PILLAR_NAME = "Health";

/**
 * The Areas from CONTEXT.md's "Existing content, tuned to this user" — named
 * for the user's actual, specific issue rather than a generic category.
 * currentState/northStar are deliberately left unseeded (null); the user
 * fills those in from inside the app.
 *
 * v2 Phase 1 restructure (see docs/adr/0005-v2-phase1-foundations-migration.md):
 * Ankylosing Spondylitis/Body Composition/Looks are renamed in place (same
 * id, new name); Blood Pressure and Healthcare Navigation are merged into a
 * new "care" Area. On a database with existing rows, the rename/merge is
 * carried out by prisma/migrations/20260826120000_v2_phase1_foundations —
 * this list reflects the post-migration state so a fresh install seeds the
 * same structure directly, and so `ensureHealthAreasSeeded`'s missing-item
 * check never tries to recreate a retired id.
 */
export const HEALTH_AREAS_SEED = [
  { id: "ankylosing-spondylitis", name: "Spondylitis", sortOrder: 0 },
  { id: "sleep", name: "Sleep", sortOrder: 1 },
  { id: "diet", name: "Diet", sortOrder: 2 },
  { id: "body-composition", name: "Training & body", sortOrder: 3 },
  { id: "looks", name: "Grooming", sortOrder: 4 },
  { id: "care", name: "Care", sortOrder: 5 },
] as const;

/** Referenced by features scoped to this specific Area (e.g. Pain & Mobility
 * tracking) so they can't silently drift from the seeded id. */
export const ANKYLOSING_SPONDYLITIS_AREA_ID = HEALTH_AREAS_SEED[0].id;

/** Referenced by the daily log sheet's derived-field habit seeding (see
 * lib/daily-log/habit-seed.ts) — the stretch-routine habit lives here. */
export const TRAINING_AND_BODY_AREA_ID = HEALTH_AREAS_SEED[3].id;
