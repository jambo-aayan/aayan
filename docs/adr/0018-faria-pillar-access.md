# Faria Pillar: separate password and a non-secure identity pick

The Faria Pillar (see `CONTEXT.md`) is the one genuinely two-person space in an otherwise
single-user app — Aayan's partner Faria needs her own access, but only to this Pillar, never to
Health/Finances/Tasks/anything else. The app's existing auth (`lib/auth/`) is a single shared
password/session for the whole app with no per-user concept at all, so it can't be scoped down as-is.
Building real accounts/multi-tenancy was considered and rejected — it contradicts the app's
deliberate single-user simplicity (`CONTEXT.md`) for a feature Aayan explicitly asked to "keep it
very simple." Reusing the main app's existing password for Faria's link was also rejected — it
would hand her the whole app, not just this Pillar.

**Decision:** the Faria Pillar gets its own password, independent of `APP_PASSWORD_HASH_B64`,
reusing the exact same password + signed-cookie mechanism already in `lib/auth/` (bcrypt hash env
var, HttpOnly cookie), but checked by middleware scoped only to `/faria/*` routes and stored under
its own cookie name. Aayan's existing main-app session bypasses this second gate entirely — he's
already proven who he is.

On top of that, first visit per device prompts a **non-secure identity pick** — "I'm Faria" or
"I'm Aayan" — stored client-side (e.g. `localStorage`) and remembered indefinitely, no re-asking.
This has no access-control role; it exists purely to attribute content (e.g. which voice field a
Memory entry writes into — see "Memory" in `CONTEXT.md`). Anyone holding the Faria link could pick
either identity — accepted, since the whole feature is intentionally low-stakes on security ("chill,
just for us," per Aayan), not a real second user account.
