export const HEALTH_PILLAR_ID = "health";
export const HEALTH_PILLAR_NAME = "Health";

/**
 * The Areas from CONTEXT.md's "Existing content, tuned to this user" — named
 * for the user's actual, specific issue rather than a generic category.
 * currentState/northStar are deliberately left unseeded (null); the user
 * fills those in from inside the app.
 */
export const HEALTH_AREAS_SEED = [
  { id: "ankylosing-spondylitis", name: "Ankylosing Spondylitis", sortOrder: 0 },
  { id: "sleep", name: "Sleep", sortOrder: 1 },
  { id: "diet", name: "Diet", sortOrder: 2 },
  { id: "body-composition", name: "Body Composition", sortOrder: 3 },
  { id: "blood-pressure", name: "Blood Pressure", sortOrder: 4 },
  { id: "looks", name: "Looks", sortOrder: 5 },
  { id: "healthcare-navigation", name: "Healthcare Navigation", sortOrder: 6 },
] as const;

/** Referenced by features scoped to this specific Area (e.g. Pain & Mobility
 * tracking) so they can't silently drift from the seeded id. */
export const ANKYLOSING_SPONDYLITIS_AREA_ID = HEALTH_AREAS_SEED[0].id;
