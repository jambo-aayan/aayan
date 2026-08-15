# Stack: Next.js on Vercel, Postgres on Neon, Prisma, password-gate auth, PWA

**Status**: accepted

The user deferred the stack choice, with two hard constraints: it must work well on both laptop and phone, and it must be free to run at this (single-user) scale. We chose **Next.js (App Router) + TypeScript**, deployed on **Vercel's free tier** (one deploy target for frontend + API routes, PWA manifest so it installs on mobile as the primary surface); **PostgreSQL hosted on Neon's free tier** accessed via **Prisma** — chosen over a JSON-blob store because habit-correlation and net-worth-over-time views need real date-range queries; and a **password gate** rather than a full identity provider, since this is explicitly single-user with no multi-tenancy planned.

## Considered options

- **Hosting/DB**: Railway and Fly.io were both floated in the original prototype notes, but neither has a durable free tier at this point — ruled out once "free" was confirmed as a hard constraint. Vercel + Neon is the standard free-tier-friendly pairing for this stack.
- **Supabase** was considered as a Postgres host (also free-tier) but not chosen — no immediate need for its bundled auth/storage/realtime features given the password-gate auth decision; can be revisited if that changes.
