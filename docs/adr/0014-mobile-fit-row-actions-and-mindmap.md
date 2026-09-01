# Mobile fit: a shared row-actions overflow menu, and a computed (not hand-placed) mindmap layout

Prompted by two screenshots on a real phone: the Accounts list and the Transactions list both
overflow off the right edge of the screen (`Update value / Upload statement / Edit / Delete`,
`Flag as receivable / Link as transfer / Edit / Delete`), and the Health Pillar's mindmap has two
node labels visibly colliding. Decided from the repo — no design handoff doc covers mobile
behavior for either of these, and neither `CONTEXT.md` nor any ADR documents a responsive
principle yet.

## Row actions: not isolated, and not new

The app already has a responsive shell — a `900px` breakpoint used consistently for sidebar vs.
mobile nav-drawer/header — so this is a case of the chrome being responsive while content isn't.
`.row`/`.rowActions` (a flex row with no wrap) is independently copy-pasted, not shared, across
6 components: `transactions-manager`, `accounts-manager`, `habits-list`, `budget-vs-actual`,
`goals-manager`, `receivables-list`. None have any `@media` query. This was always going to break
once enough actions accumulated on one row — `Link as transfer` (this session's own prior work)
was simply the action that finally pushed Transactions past the edge; Accounts was already over
with 4 actions before that.

**Fix**: consolidate the duplicated CSS into one shared row/row-actions component first — the same
"3+ duplicated call sites crosses the line" judgment already applied to `isRealSpend` earlier this
session — then add a "⋯" overflow menu below `900px` (reusing the existing breakpoint, not
inventing a second one) that holds every secondary action. Only the row's core info (name/category/
amount) stays always visible. No per-component "which action is primary" special-casing — a single
rule (everything secondary moves into the menu) is worth more than a marginally tighter layout per
component, since 6 places independently deciding "what's primary" is exactly the kind of drift this
consolidation is meant to prevent.

## Health mindmap: hand-placed percentages were always a stopgap

`components/health-mindmap.tsx`'s `NODE_POSITION` table is hand-placed `{left, top}` percentages
per known Area, explicitly documented in its own comment as "not a layout algorithm" — a direct
carry-over from the original design handoff spec, tuned for exactly today's 6 Areas at a wide
viewport. A `fallbackPosition()` radial algorithm already exists in the same file but was only used
for an Area outside the hand-placed set — dead code for the actual Areas in production. Neither
approach accounts for label width, so on a narrow screen the same percentage positions land
physically closer together in pixels, and long labels ("Training & body", "Grooming") collide.

**Fix**: replace `NODE_POSITION` entirely (all viewports, not just mobile — running two layout
systems for one diagram would double what can drift out of sync) with a computed radial layout:
radius derived from node count, labels wrapping within a max-width pill instead of colliding.
Font-size-only scaling was considered and rejected — it doesn't cap how wide a long label gets, so
it can't actually guarantee no collision the way wrapping + a computed radius can. This also
removes a real blocker for a future Pillars/Areas feature (discussed but not yet spec'd): nobody
can hand-place coordinates for an Area a user hasn't created yet.

**Is radial even the right visual, long-term?** Considered and deliberately not changed now. A
hub-and-spoke diagram needs circumference roughly proportional to node count — every label needs
room around the circle — so past some N on a phone-width screen, no font-size or wrapping trick
saves it; the choice becomes unreadably tiny text or a diagram taller than the viewport. A plain
grid/list of Area cards has no such ceiling. But "Seven areas, one body" is deliberate identity
copy the radial diagram reinforces, not just decoration, and at today's scale (6–7 Areas) the
computed radial is a real fix, not a band-aid — swapping the whole visual language out now would
trade away something intentional to solve a problem a smarter version of the same idea already
solves. Flagged, not built: if a Pillar's Area count grows materially past ~8–10 — plausible once
Pillars/Areas become user-creatable — the mindmap should switch to a grid/list on narrow viewports
specifically, since that's the point the math stops being fixable. Revisit then, not speculatively
now.

## Out of scope

- No full top-to-bottom mobile audit of every page (Insights grids, Systems tab, Daily log sheet,
  etc.) — this pass is scoped to the two confirmed, provably-broken patterns above. A broader sweep
  is a natural follow-up once this ships and more issues are actually seen on a phone.
- No grid/list fallback for the mindmap at high Area counts — noted above as a future trigger, not
  built speculatively today.
- No new breakpoint — `900px` is reused everywhere this ADR touches.
